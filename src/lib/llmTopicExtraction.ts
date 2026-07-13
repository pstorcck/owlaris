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

const SYSTEM_PROMPT_EXTRAER_TEMAS =
  'Extraes la lista de temas, lecciones o contenidos de un documento curricular. Responde SOLO con JSON: {"temas": string[]}. Cada elemento debe ser un tema/lección/contenido que aparezca LITERALMENTE en el documento (puedes limpiar numeración o formato, pero no inventes, no resumas de más ni agregues información externa). Si el documento no contiene una lista identificable de temas (por ejemplo, si es un banco de ejercicios o preguntas sin un índice de contenidos), responde {"temas": []}.'

export function parseTemasLLMResponse(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed?.temas)) return []
    return parsed.temas
      .filter((t: unknown): t is string => typeof t === 'string' && t.trim().length > 0)
      .map((t: string) => t.trim())
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
