import type OpenAI from 'openai'
import { withOpenAIRetry } from './openaiRetry'

// Hallazgo real (QA en vivo, 2026-07-13): con el toggle en inglés, el texto
// envolvente de la lista de temas ya se traducía ("Sure. These are all the
// topics..."), pero los temas mismos venían directo del documento oficial
// (siempre en español) sin traducir — el alumno veía una respuesta en
// inglés con una lista de temas en español en medio. Se traduce la lista
// completa en UNA sola llamada al modelo (preserva orden y cantidad exacta
// de elementos), cacheada por el contenido exacto de la lista, para no
// repetir la traducción en cada pregunta sobre el mismo documento.
const cacheTemasIngles = new Map<string, { topics: string[]; timestamp: number }>()
const CACHE_TTL = 1000 * 60 * 60 // 1 hora: la lista de temas de un documento no cambia entre preguntas

function claveCache(temas: string[]): string {
  return temas.join('|||')
}

export async function traducirTemasAIngles(openaiClient: OpenAI, temas: string[]): Promise<string[]> {
  if (temas.length === 0) return temas
  const clave = claveCache(temas)
  const cached = cacheTemasIngles.get(clave)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.topics

  try {
    const completion = await withOpenAIRetry(() => openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 700,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'Traduces una lista de temas curriculares del español al inglés, uno a uno. Responde SOLO con JSON: {"temas": string[]}. El array de salida debe tener EXACTAMENTE el mismo ORDEN y la MISMA CANTIDAD de elementos que el array de entrada — no agregues, no quites, no combines ni dividas elementos, no resumas: solo tradúcelos literalmente.',
        },
        { role: 'user', content: JSON.stringify(temas) },
      ],
    }), { maxRetries: 1, baseDelayMs: 400 })
    const raw = completion.choices[0].message.content || '{}'
    const parsed = JSON.parse(raw)
    const traducidos = Array.isArray(parsed?.temas)
      ? parsed.temas.filter((t: unknown): t is string => typeof t === 'string' && t.trim().length > 0)
      : []
    // Si la traducción no preserva la cantidad exacta de elementos, es más
    // seguro devolver la lista original (en español) que arriesgar una
    // lista desalineada, incompleta o con temas inventados.
    if (traducidos.length !== temas.length) return temas
    cacheTemasIngles.set(clave, { topics: traducidos, timestamp: Date.now() })
    return traducidos
  } catch {
    return temas
  }
}
