import type OpenAI from 'openai'
import { withOpenAIRetry } from './openaiRetry'

// Hallazgo real CRÍTICO (verificación en vivo, 2026-07-13): cada documento
// curricular real (CNB/Mineduc) usa su propia estructura — tablas con
// distinto título/orden de columnas, secciones de "cobertura" en prosa, o
// ni siquiera tiene una lista de temas (bancos de ejercicios). Escribir un
// parser de regex por cada formato nuevo no escala a las 15+ materias por
// grado que se están subiendo esta semana: cada documento con un formato no
// visto antes vuelve a dejar el índice vacío. Este respaldo con el modelo,
// cacheado por documento, se usa SOLO cuando ninguna heurística estructural
// (extractCourseTopicIndex) encontró nada — se adapta automáticamente a
// cualquier formato sin tocar código, y al cachear por documento solo
// cuesta una llamada extra la primera vez que se consulta cada documento
// (confirmado con el usuario antes de implementar, dado el costo/latencia
// de la llamada extra al modelo).
const cacheTemasLLM = new Map<string, { topics: string[]; timestamp: number }>()
const TEMAS_LLM_CACHE_TTL = 1000 * 60 * 60 // 1 hora: el documento cambia poco, no vale la pena repetir la llamada por cada pregunta

// Hallazgo real (QA en vivo, 2026-07-13): en un documento de Lenguaje que
// es un banco de ejercicios de comprensión lectora, el modelo listó los
// primeros 4 temas genuinos de comprensión (literal, inferencial, crítica)
// pero LUEGO siguió con los TÍTULOS de las lecturas usadas como ejercicio
// ("La teoría de la relatividad general", "Indicadores económicos de
// Guatemala", "El Protocolo de Montreal"...) como si fueran temas propios
// de Lenguaje — son títulos de textos sobre OTRAS materias (física,
// economía, ciencias sociales) usados solo como material de lectura, no
// contenidos curriculares de Lenguaje. Una instrucción de una sola pasada
// ("no incluyas X") NO bastó — el modelo repitió el mismo error tras el
// primer intento de corrección por prompt. Se cambia el esquema de
// respuesta para exigir una CLASIFICACIÓN explícita por elemento
// (es_tema_curricular: true/false) en vez de solo una lista ya filtrada —
// un juicio individual por ítem es más confiable que una exclusión general
// aplicada de una vez a toda la lista — y el filtrado final se hace en
// código de forma determinística según esa bandera, no confiando en que
// el modelo ya haya excluido todo correctamente por sí solo.
const SYSTEM_PROMPT_EXTRAER_TEMAS =
  'Identificas candidatos a tema/lección/contenido de un documento curricular. Responde SOLO con JSON: {"items": [{"texto": string, "es_tema_curricular": boolean}]}. Cada "texto" debe aparecer LITERALMENTE en el documento (puedes limpiar numeración o formato, pero no inventes ni resumas de más). ' +
  'Para CADA candidato, marca "es_tema_curricular" en true SOLO si es una habilidad, competencia o contenido que se enseña explícitamente (ej. "Comprensión inferencial", "Fracciones algebraicas"). Marca false si es el TÍTULO de una lectura, pasaje, texto o ejercicio usado solo como material (ej. "La teoría de la relatividad general", "El Protocolo de Montreal", "Indicadores económicos de Guatemala") — estos títulos NUNCA son temas de la materia, incluso si el documento los usa como encabezado de cada ejercicio y aunque traten sobre ciencias, economía o historia dentro de una materia de lenguaje/lectura. Marca false también en fragmentos de encabezado del documento que no sean en sí un tema (ej. "NIVEL LITERAL" en mayúsculas como rótulo de sección). ' +
  'Si el documento no contiene ningún tema curricular real (por ejemplo, si es solo un banco de ejercicios o lecturas), responde {"items": []}.'

export function parseTemasLLMResponse(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed?.items)) return []
    return parsed.items
      .filter((item: unknown): item is { texto: string; es_tema_curricular: boolean } =>
        !!item &&
        typeof item === 'object' &&
        typeof (item as { texto?: unknown }).texto === 'string' &&
        (item as { texto: string }).texto.trim().length > 0 &&
        (item as { es_tema_curricular?: unknown }).es_tema_curricular === true
      )
      .map((item: { texto: string }) => item.texto.trim())
  } catch {
    return []
  }
}

export function temasLLMCacheKey(documentoFuente: string | null, longitudContenido: number): string {
  return `${documentoFuente || ''}::${longitudContenido}`
}

export async function extraerTemasConModelo(
  openaiClient: OpenAI,
  contenido: string,
  documentoFuente: string | null
): Promise<string[]> {
  const cacheKey = temasLLMCacheKey(documentoFuente, contenido.length)
  const cached = cacheTemasLLM.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < TEMAS_LLM_CACHE_TTL) return cached.topics

  try {
    const completion = await withOpenAIRetry(() => openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 700,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT_EXTRAER_TEMAS },
        { role: 'user', content: contenido.slice(0, 16000) },
      ],
    }), { maxRetries: 1, baseDelayMs: 400 })
    const temas = parseTemasLLMResponse(completion.choices[0].message.content || '{}')
    cacheTemasLLM.set(cacheKey, { topics: temas, timestamp: Date.now() })
    return temas
  } catch {
    return []
  }
}
