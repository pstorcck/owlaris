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

// Número al final de una frase corta de selección: "2", "el 2", "quiero el
// tema 6", "dame el número 8", "explícame el 4". No exige que TODO el
// mensaje sea el número — el alumno rara vez responde con un número pelado.
const NUMERO_AL_FINAL_DE_FRASE_CORTA = /^.{0,40}?(\d{1,3})\s*[.)]?$/

const ORDINALES: Record<string, number> = {
  primero: 1, primer: 1, primera: 1,
  segundo: 2, segunda: 2,
  tercero: 3, tercer: 3, tercera: 3,
  cuarto: 4, cuarta: 4,
  quinto: 5, quinta: 5,
  sexto: 6, sexta: 6,
  septimo: 7, septima: 7,
  octavo: 8, octava: 8,
  noveno: 9, novena: 9,
  decimo: 10, decima: 10,
}

function normalizeSeleccion(value: string) {
  return normalizeText(value)
}

// Cuando el tutor acaba de mostrar una lista numerada (temas, subtemas,
// opciones) y el alumno la referencia — por número, por ordinal ("el
// primero", "el último") o por nombre ("el de genética") — eso selecciona
// un elemento de la lista, no es la respuesta a un ejercicio matemático.
// Se basa en extractCourseTopicIndex, que ya sabe reconocer listas
// numeradas o con viñetas en texto libre (no solo en el índice oficial).
export function matchNumberedListSelection(
  pregunta: string,
  ultimoMensajeAsistente: string
): { indice: number; tema: string } | null {
  const texto = (pregunta || '').trim()
  if (!texto || texto.split(/\s+/).length > 8) return null

  const { topics } = extractCourseTopicIndex(ultimoMensajeAsistente || '')
  if (topics.length < 2) return null

  const matchNumero = NUMERO_AL_FINAL_DE_FRASE_CORTA.exec(texto)
  if (matchNumero) {
    const n = parseInt(matchNumero[1], 10)
    if (n >= 1 && n <= topics.length) return { indice: n, tema: topics[n - 1] }
  }

  const normalizado = normalizeSeleccion(texto)

  if (/\b[uú]ltimo\b/i.test(normalizado)) return { indice: topics.length, tema: topics[topics.length - 1] }
  for (const [palabra, indice] of Object.entries(ORDINALES)) {
    if (indice <= topics.length && new RegExp(`\\b${palabra}\\b`).test(normalizado)) {
      return { indice, tema: topics[indice - 1] }
    }
  }

  const matchNombre = /\b(?:el|la)\s+de\s+(.+)$/i.exec(texto)
  const fraseBuscada = matchNombre ? normalizeSeleccion(matchNombre[1]) : null
  if (fraseBuscada && fraseBuscada.length >= 3) {
    const idx = topics.findIndex((tema) => normalizeSeleccion(tema).includes(fraseBuscada))
    if (idx !== -1) return { indice: idx + 1, tema: topics[idx] }
  }

  return null
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

// Hallazgo real (instructivo de mejoras, ronda 2026-07-11), ítems 22-23:
// "qué sigue después de X" se respondía con el orden que el modelo
// improvisaba en el momento (no siempre el orden real del documento
// oficial) — extractCourseTopicIndex ya devuelve el índice ordenado, pero
// no existía ninguna función que lo usara para resolver "el siguiente".
export function isNextTopicRequest(value: string): boolean {
  const text = normalizeText(value)
  if (!text) return false
  return [
    'que sigue despues de', 'que sigue luego de', 'cual es el siguiente tema',
    'siguiente tema despues de', 'que viene despues de', 'que tema sigue',
    'cual tema sigue', 'cual sigue despues', 'que sigue en el curso',
    'que sigue en la clase', 'cual es el proximo tema',
    'what comes after', 'what is the next topic', 'next topic after',
    'what topic comes next', 'what comes next in the course',
  ].some((needle) => text.includes(needle))
}

// Extrae el nombre del tema de referencia mencionado en la pregunta ("qué
// sigue después de la fotosíntesis" -> "la fotosíntesis"). Si no se
// menciona un tema explícito, el llamador debe usar el tema activo de la
// sesión como referencia.
export function extractNextTopicReference(value: string): string | null {
  const texto = (value || '').trim()
  const match = /(?:despu[eé]s de|luego de|after)\s+(.+?)[?¿]?$/i.exec(texto)
  if (!match) return null
  const referencia = match[1].trim()
  return referencia.length >= 2 ? referencia : null
}

export function findNextTopic(
  index: CourseTopicIndex,
  referencia: string | null
): { actual: { indice: number; tema: string } | null; siguiente: { indice: number; tema: string } | null } {
  const { topics } = index
  if (topics.length === 0 || !referencia) return { actual: null, siguiente: null }
  const norm = normalizeText(referencia)
  let idx = topics.findIndex((t) => normalizeText(t) === norm)
  if (idx === -1) idx = topics.findIndex((t) => norm.includes(normalizeText(t)) || normalizeText(t).includes(norm))
  if (idx === -1) return { actual: null, siguiente: null }
  const actual = { indice: idx + 1, tema: topics[idx] }
  const siguiente = idx + 1 < topics.length ? { indice: idx + 2, tema: topics[idx + 1] } : null
  return { actual, siguiente }
}

export function buildNextTopicResponse(input: {
  index: CourseTopicIndex
  referencia: string | null
  idiomaIngles?: boolean
}): string {
  const { index, referencia, idiomaIngles } = input
  if (index.topics.length === 0) {
    return idiomaIngles
      ? 'I do not have enough official content available right now to confirm the order of topics.'
      : 'No tengo suficiente contenido oficial disponible ahora mismo para confirmar el orden de los temas.'
  }
  const { actual, siguiente } = findNextTopic(index, referencia)
  if (!actual) {
    return idiomaIngles
      ? `I could not find "${referencia}" in the official topic index, so I cannot confirm what comes after it safely.`
      : `No encontré "${referencia}" en el índice oficial de temas, así que no puedo confirmar con seguridad qué sigue después.`
  }
  if (!siguiente) {
    return idiomaIngles
      ? `"${actual.tema}" is the last topic in the official index I have available — there is no next topic after it right now.`
      : `"${actual.tema}" es el último tema del índice oficial que tengo disponible — no hay un siguiente tema después de este por ahora.`
  }
  return idiomaIngles
    ? `According to the official course order, after "${actual.tema}" (topic ${actual.indice}) comes "${siguiente.tema}" (topic ${siguiente.indice}).`
    : `Según el orden oficial del curso, después de "${actual.tema}" (tema ${actual.indice}) sigue "${siguiente.tema}" (tema ${siguiente.indice}).`
}

// Hallazgo real (instructivo de mejoras, ronda 2026-07-11), ítem 25:
// preguntas sobre si un área amplia está incluida en el curso ("¿este curso
// incluye genética?", "¿vemos guerra fría en esta clase?") deben
// responderse a partir del índice real, no de una suposición del modelo.
export function isBroadAreaPresenceQuestion(value: string): boolean {
  const text = normalizeText(value)
  if (!text) return false
  return [
    'este curso incluye', 'esta clase incluye', 'esta materia incluye',
    'vemos', 'vemos algo de', 'en este curso vemos', 'en esta clase vemos',
    'este curso cubre', 'esta clase cubre', 'este curso tiene',
    'does this course include', 'does this class include', 'does this course cover',
    'do we cover', 'do we see',
  ].some((needle) => text.includes(needle))
}

export function extractAreaQuery(value: string): string | null {
  const texto = (value || '').trim()
  const match = /(?:incluye|cubre|vemos(?:\s+algo\s+de)?|include|cover|see)\s+(.+?)[?¿]?$/i.exec(texto)
  if (!match) return null
  const area = match[1].trim()
  return area.length >= 2 ? area : null
}

export function buildAreaPresenceResponse(input: {
  index: CourseTopicIndex
  area: string | null
  idiomaIngles?: boolean
}): string {
  const { index, area, idiomaIngles } = input
  if (index.topics.length === 0 || !area) {
    return idiomaIngles
      ? 'I do not have enough official content available right now to confirm that with certainty.'
      : 'No tengo suficiente contenido oficial disponible ahora mismo para confirmarlo con seguridad.'
  }
  const norm = normalizeText(area)
  const coincidencias = index.topics.filter((t) => normalizeText(t).includes(norm) || norm.includes(normalizeText(t)))
  if (coincidencias.length === 0) {
    return idiomaIngles
      ? `Based on the official topic index I have available, I do not see "${area}" listed — it may still be covered in material I do not have access to, so I cannot say for certain it is excluded.`
      : `Con base en el índice oficial de temas que tengo disponible, no veo "${area}" en la lista — puede que sí se cubra en material al que no tengo acceso, así que no puedo asegurar que esté excluido.`
  }
  return idiomaIngles
    ? `Yes, based on the official index: ${coincidencias.join(', ')}.`
    : `Sí, según el índice oficial: ${coincidencias.join(', ')}.`
}

// Hallazgo real (instructivo de mejoras, ronda 2026-07-11), ítem 24:
// reconocer bloques/agrupaciones de temas (ej. "campos e interacciones"
// que abarca los temas 15-20) cuando el documento oficial los organiza en
// secciones con encabezado ("## Bloque 3: Campos e interacciones") antes
// de cada grupo de temas. Depende de que la fuente use esa estructura de
// encabezados — si el documento solo lista temas sin agrupar, no hay
// bloques que reconocer y las funciones simplemente devuelven una lista
// vacía (no inventan agrupaciones que no están en la fuente).
export type CourseTopicBlock = { nombre: string; temas: string[]; desde: number; hasta: number }

const PATRON_BLOQUE = /^\s*#{1,4}\s*(?:bloque|unidad|unit|block)\s*\d*\s*[:.\-–—]?\s*(.+)$/i

export function extractCourseBlocks(content: string): CourseTopicBlock[] {
  const lines = (content || '').split(/\r?\n/)
  const blocks: CourseTopicBlock[] = []
  let currentBlockName: string | null = null
  let currentTopics: string[] = []
  let inIndex = false
  let topicCounter = 0

  const commitBlock = () => {
    if (currentBlockName && currentTopics.length > 0) {
      blocks.push({
        nombre: currentBlockName,
        temas: [...currentTopics],
        desde: topicCounter - currentTopics.length + 1,
        hasta: topicCounter,
      })
    }
    currentTopics = []
  }

  for (const line of lines) {
    const normalized = normalizeText(line)
    if (!inIndex && /^(#{1,4}\s*)?(indice de temas|indice del curso|temas|secuencia de temas|mapa del curso|course index|topics|course map)\b/.test(normalized)) {
      inIndex = true
      continue
    }
    if (!inIndex) continue

    const bloqueMatch = line.match(PATRON_BLOQUE)
    if (bloqueMatch) {
      commitBlock()
      currentBlockName = cleanTopic(bloqueMatch[1])
      continue
    }

    const item = line.match(/^\s*(?:[-*•]|\d{1,3}[.)])\s+(.+)$/)
    if (item && currentBlockName && isProbablyTopic(item[1])) {
      topicCounter += 1
      currentTopics.push(cleanTopic(item[1]))
    }
  }
  commitBlock()
  return blocks
}

export function isBlockGroupingQuestion(value: string): boolean {
  const text = normalizeText(value)
  if (!text) return false
  return [
    'que temas incluye el bloque', 'que temas tiene el bloque', 'cuales son los temas del bloque',
    'que abarca el bloque', 'que temas incluye la unidad', 'cuales son los temas de la unidad',
    'que abarca la unidad', 'what topics does the block include', 'what topics are in the unit',
    'what does the block cover', 'what does the unit cover',
  ].some((needle) => text.includes(needle))
}

export function extractBlockQuery(value: string): string | null {
  const texto = (value || '').trim()
  const match = /(?:bloque|unidad|unit|block)\s+(?:de\s+)?(.+?)[?¿]?$/i.exec(texto)
  if (!match) return null
  const query = match[1].trim()
  return query.length >= 2 ? query : null
}

export function findBlockByQuery(blocks: CourseTopicBlock[], query: string | null): CourseTopicBlock | null {
  if (!query || blocks.length === 0) return null
  const norm = normalizeText(query)
  return blocks.find((b) => normalizeText(b.nombre).includes(norm) || norm.includes(normalizeText(b.nombre))) || null
}

export function buildBlockTopicsResponse(input: {
  blocks: CourseTopicBlock[]
  query: string | null
  idiomaIngles?: boolean
}): string {
  const { blocks, query, idiomaIngles } = input
  const block = findBlockByQuery(blocks, query)
  if (!block) {
    return idiomaIngles
      ? `I could not find a block or unit matching "${query}" in the official index I have available.`
      : `No encontré un bloque o unidad que coincida con "${query}" en el índice oficial que tengo disponible.`
  }
  const items = block.temas.map((t, i) => `${block.desde + i}. ${t}`).join('\n')
  return idiomaIngles
    ? `The block "${block.nombre}" covers topics ${block.desde} to ${block.hasta}:\n\n${items}`
    : `El bloque "${block.nombre}" abarca los temas ${block.desde} a ${block.hasta}:\n\n${items}`
}
