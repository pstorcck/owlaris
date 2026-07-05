function normalizeText(value: string) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanTopic(value: string) {
  return (value || '')
    .replace(/^[#*\-\s•\d.)]+/, '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[.:;\-–—\s]+$/, '')
    .trim()
}

function isProbablyTopic(value: string) {
  const cleaned = cleanTopic(value)
  if (cleaned.length < 3 || cleaned.length > 130) return false
  const normalized = normalizeText(cleaned)
  if (/^(objetivo|competencia|indicador|evaluacion|actividad|material|recurso|descripcion|introduccion|instruccion|nota|fuente|pagina|resumen|aprendizaje esperado)/.test(normalized)) return false
  if (/^(objective|assessment|activity|material|resource|description|introduction|instruction|note|source|page|summary)/.test(normalized)) return false
  // Un tema real es un nombre de concepto/habilidad, no una pregunta ni una
  // instrucción de ejercicio — sin esto, una lista numerada de preguntas o
  // instrucciones de práctica ("1. ¿Cuánto es...? 2. Explica...") se leía
  // como si fuera un menú de temas seleccionable por número.
  if (/[?¿]/.test(cleaned)) return false
  if (/^(explica|resuelve|calcula|responde|describe|analiza|identifica|menciona|define|desarrolla|justifica)\b/.test(normalized)) return false
  if (/^(explain|solve|calculate|answer|describe|analyze|identify|define|discuss|justify)\b/.test(normalized)) return false
  return /[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(cleaned)
}

function pushUnique(items: string[], value: string) {
  const cleaned = cleanTopic(value)
  if (!isProbablyTopic(cleaned)) return
  const key = normalizeText(cleaned)
  if (!items.some(item => normalizeText(item) === key)) items.push(cleaned)
}

export function isCourseTopicListRequest(question: string) {
  const text = normalizeText(question)
  return [
    'todos los temas',
    'todas las unidades',
    'lista completa de temas',
    'indice de la clase',
    'indice del curso',
    'que temas tiene',
    'temas de esta clase',
    'temas de esta materia',
    'mapa del curso',
    'subtemas de esta materia',
    'all topics',
    'complete list of topics',
    'course index',
    'class topics',
    'course map',
  ].some(needle => text.includes(needle))
}

export function extractDeclaredTopicCount(content: string) {
  const text = normalizeText(content)
  const patterns = [
    /cantidad de temas\s*[:\-]?\s*(\d{1,3})/,
    /total de temas\s*[:\-]?\s*(\d{1,3})/,
    /(\d{1,3})\s+temas de ciclo completo/,
    /curso tiene\s+(\d{1,3})\s+temas/,
    /(\d{1,3})\s+topics/,
    /(\d{1,3})\s+full-cycle topics/,
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) return parseInt(match[1], 10)
  }
  return null
}

export type CourseTopicIndex = {
  topics: string[]
  declaredCount: number | null
  source: 'topic_headings' | 'explicit_index' | 'list_items' | 'headings' | 'none'
  incomplete: boolean
}

export function extractCourseTopicIndex(content: string): CourseTopicIndex {
  const declaredCount = extractDeclaredTopicCount(content)
  const lines = (content || '').split(/\r?\n/)
  const topics: string[] = []

  for (const line of lines) {
    const match = line.match(/^\s*#{1,5}\s*(?:tema|topic)\s*(?:\d+)?\s*[:.\-–—]\s*(.+)$/i)
    if (match) pushUnique(topics, match[1])
  }
  if (topics.length > 0) {
    return { topics, declaredCount, source: 'topic_headings', incomplete: declaredCount !== null && topics.length < declaredCount }
  }

  let inIndex = false
  for (const line of lines) {
    const normalized = normalizeText(line)
    if (/^(#{1,4}\s*)?(indice de temas|indice del curso|temas|secuencia de temas|mapa del curso|course index|topics|course map)\b/.test(normalized)) {
      inIndex = true
      continue
    }
    if (inIndex && /^#{1,2}\s+/.test(line) && !/(tema|topic|unidad|unit|bloque|block)/i.test(line)) break
    if (!inIndex) continue
    const item = line.match(/^\s*(?:[-*•]|\d{1,3}[.)])\s+(.+)$/)
    if (item) pushUnique(topics, item[1])
  }
  if (topics.length > 0) {
    return { topics, declaredCount, source: 'explicit_index', incomplete: declaredCount !== null && topics.length < declaredCount }
  }

  for (const line of lines) {
    const item = line.match(/^\s*(?:[-*•]|\d{1,3}[.)])\s+(.+)$/)
    if (item) pushUnique(topics, item[1])
  }
  if (topics.length > 0) {
    return { topics, declaredCount, source: 'list_items', incomplete: declaredCount !== null && topics.length < declaredCount }
  }

  for (const line of lines) {
    const heading = line.match(/^\s*#{1,3}\s+(.+)$/)
    if (heading) pushUnique(topics, heading[1])
  }
  return {
    topics,
    declaredCount,
    source: topics.length > 0 ? 'headings' : 'none',
    incomplete: declaredCount !== null && topics.length < declaredCount,
  }
}

const BARE_NUMBER_SELECTION = /^\s*(?:opci[oó]n\s+|n[uú]mero\s+|el\s+|la\s+)?(\d{1,3})\s*[.)]?\s*$/i

// Cuando el tutor acaba de mostrar una lista numerada (temas, subtemas,
// opciones) y el alumno responde solo con un número, ese número selecciona un
// elemento de la lista — no es la respuesta a un ejercicio matemático. Se basa
// en extractCourseTopicIndex, que ya sabe reconocer listas numeradas o con
// viñetas en texto libre (no solo en el índice oficial del curso).
export function matchNumberedListSelection(
  pregunta: string,
  ultimoMensajeAsistente: string
): { indice: number; tema: string } | null {
  const match = BARE_NUMBER_SELECTION.exec((pregunta || '').trim())
  if (!match) return null
  const n = parseInt(match[1], 10)
  if (!n || n < 1) return null

  const { topics } = extractCourseTopicIndex(ultimoMensajeAsistente || '')
  if (topics.length < 2) return null
  if (n > topics.length) return null

  return { indice: n, tema: topics[n - 1] }
}

export function buildCourseTopicListResponse(input: {
  index: CourseTopicIndex
  subject: string
  documentName?: string | null
  idiomaIngles?: boolean
}) {
  const { index, subject, documentName, idiomaIngles } = input
  if (index.topics.length === 0) {
    return idiomaIngles
      ? `With the content available for ${subject || 'this class'}, I do not have enough information to list all topics safely. I will not complete the list with external information.`
      : `Con el contenido disponible para ${subject || 'esta clase'}, no tengo suficiente información para listar todos los temas con seguridad. No voy a completar la lista con información externa.`
  }

  const sourceLine = documentName
    ? idiomaIngles ? `Source: ${documentName}.` : `Fuente: ${documentName}.`
    : ''
  const countLine = index.declaredCount
    ? idiomaIngles
      ? `The official source indicates ${index.declaredCount} topics.`
      : `La fuente oficial indica ${index.declaredCount} temas.`
    : ''
  const items = index.topics.map((topic, idx) => `${idx + 1}. ${topic}`).join('\n')

  if (index.incomplete) {
    return idiomaIngles
      ? `The official source indicates ${index.declaredCount} topics, but with the content available right now I can safely recover ${index.topics.length}. I will not invent the missing topics.\n\n${sourceLine}\n\nTopics recovered:\n${items}`.trim()
      : `La fuente oficial indica ${index.declaredCount} temas, pero con el contenido disponible ahora solo puedo recuperar ${index.topics.length} con seguridad. No voy a inventar los temas faltantes.\n\n${sourceLine}\n\nTemas recuperados:\n${items}`.trim()
  }

  return idiomaIngles
    ? `Sure. These are all the topics I can identify in the official content for ${subject || 'this class'}. ${countLine} ${sourceLine}\n\n${items}`.trim()
    : `Claro. Estos son todos los temas que puedo identificar en el contenido oficial de ${subject || 'esta clase'}. ${countLine} ${sourceLine}\n\n${items}`.trim()
}
