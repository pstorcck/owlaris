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

export function isProbablyTopic(value: string) {
  const cleaned = cleanTopic(value)
  if (cleaned.length < 3 || cleaned.length > 130) return false
  const normalized = normalizeText(cleaned)
  // Hallazgo real CRÍTICO (QA en vivo, 2026-07-19, cuenta Paul): esta
  // coincidencia no tenía límite de palabra, así que rechazaba temas reales
  // que solo COMENZABAN con la forma plural de estas palabras ("Recursos de
  // Guatemala, América y otros continentes", "Indicadores y comparación de
  // poblaciones mundiales", "Fuentes documentales, orales, visuales y
  // electrónicas") como si fueran una etiqueta de metadata ("Recurso: ...",
  // "Fuente: ...") — 4 de 87 temas reales de un documento real se perdían
  // por esto. Se exige un límite de palabra para que solo la palabra EXACTA
  // (no un prefijo de otra palabra distinta) dispare el rechazo.
  if (/^(objetivo|competencia|indicador|evaluacion|actividad|material|recurso|descripcion|introduccion|instruccion|nota|fuente|pagina|resumen|aprendizaje esperado)\b/.test(normalized)) return false
  if (/^(objective|assessment|activity|material|resource|description|introduction|instruction|note|source|page|summary)\b/.test(normalized)) return false
  // Un tema real es un nombre de concepto/habilidad, no una pregunta ni una
  // instrucción de ejercicio — sin esto, una lista numerada de preguntas o
  // instrucciones de práctica ("1. ¿Cuánto es...? 2. Explica...") se leía
  // como si fuera un menú de temas seleccionable por número.
  if (/[?¿]/.test(cleaned)) return false
  if (/^(explica|resuelve|calcula|responde|describe|analiza|identifica|menciona|define|desarrolla|justifica|practica|escribe|dibuja|completa|observa|investiga)\b/.test(normalized)) return false
  if (/^(explain|solve|calculate|answer|describe|analyze|identify|define|discuss|justify|practice|write|draw|complete|observe|investigate)\b/.test(normalized)) return false
  // Hallazgo real CRÍTICO (QA en vivo, 2026-07-14, eScholaris Algebra 1):
  // "Temas de esta materia" devolvió una mezcla de rutas de archivo
  // ("Sources/.../Common Core Math source card.md"), referencias a otros
  // recursos internos ("Brandbook eScholaris", "Local eScholaris Common
  // Core mathematics base matrix") y reglas de cómo debe enseñar el tutor
  // ("No mezclar este curso con otros marcos curriculares", "Diagnosticar
  // primero qué entiende el estudiante") como si fueran temas del curso —
  // el documento fuente es una lista numerada de configuración/política
  // interna, no un índice de temas, y el respaldo de línea numerada no
  // distingue eso de un tema real. Dos señales nuevas: una ruta de
  // archivo (contiene una extensión de documento conocida, o "Sources/"
  // al inicio) nunca es un tema; y una instrucción en infinitivo dirigida
  // al tutor ("Diagnosticar...", "Explicar...", "No crear...") tampoco lo
  // es — los temas reales son frases nominales (nombran un concepto), no
  // verbos de acción al inicio.
  if (/\.(?:md|pdf|docx?|xlsx?|pptx?|csv|txt)\b/i.test(cleaned)) return false
  if (/^sources\//i.test(normalized) || /^`?sources\//i.test(cleaned)) return false
  if ((cleaned.match(/\//g) || []).length >= 2) return false
  // "eScholaris" es el nombre de la plataforma/programa, no un tema
  // curricular — una línea que lo menciona describe un recurso interno
  // (ej. "Local eScholaris Common Core mathematics base matrix"), nunca
  // el nombre de un concepto o habilidad que se enseña.
  if (/escholaris/.test(normalized)) return false
  if (/^no\s+[a-z]+(?:ar|er|ir)\b/.test(normalized)) return false
  if (/^(diagnosticar|explicar|pedir|dar|mezclar|crear|usar|evitar|mantener|mostrar|permitir|seguir|resolver|calcular|responder|describir|analizar|identificar|mencionar|definir|desarrollar|justificar|practicar|escribir|dibujar|completar|observar|investigar|distinguir|conservar|verificar|delimitar|senalar|solicitar|preguntar|cerrar)\b/.test(normalized)) return false
  // Hallazgo real CRÍTICO (QA en vivo, 2026-07-19, cuenta Paul): en
  // documentos con una sección de metadata en viñetas ("- Colegio: Colegio
  // Montano.", "- Grado: 6 Primaria.", "- Idioma de tutoría: español."), el
  // respaldo de lista sin filtro de sección (list_items) recogía esas
  // líneas como si fueran "temas" del curso — ninguna de las reglas
  // anteriores las reconocía porque no son preguntas, instrucciones ni
  // rutas de archivo, son metadata de identificación del documento.
  if (/^(colegio|grado|materia|idioma de tutoria|marco|estado|organizacion|integridad|areas? oficiales? integradas?|modalidad|programa|curso|codigo|source id)\s*:/.test(normalized)) return false
  // Hallazgo real (sexta verificación, 2026-07-13): el respaldo de línea
  // suelta (para índices que perdieron su viñeta/número vía mammoth)
  // empezó a tratar la línea de metadata "Cantidad de temas: N" como si
  // fuera un tema más — esa frase ya tiene su propio parser dedicado
  // (extractDeclaredTopicCount) y nunca debe contarse como un tema en sí.
  if (/\b(?:cantidad|total)\s+de\s+temas\b/.test(normalized)) return false
  if (/\btemas?\s+de\s+ciclo\s+completo\b/.test(normalized)) return false
  if (/\bcurso\s+tiene\s+\d+\s+temas\b/.test(normalized)) return false
  if (/^\d+\s+(?:temas|topics)\b/.test(normalized)) return false
  // Hallazgo real (QA 2026-07-14, Prim4mate7.docx): el respaldo de línea
  // numerada/con viñeta (sin estar dentro de ninguna sección de índice)
  // capturó "Un punto (●) vale 1• Una barra (—) vale 5• Un caracol o
  // concha representa el 0" como si fuera un tema — es una explicación de
  // varios datos encadenados (numeración maya), no un título de tema. Un
  // "•" en medio del texto (no al inicio, ya recortado por cleanTopic)
  // señala varios ítems pegados en una sola línea, y un conteo de
  // palabras alto es otra señal de que es una oración explicativa y no un
  // nombre corto de concepto/habilidad.
  if (cleaned.includes('•')) return false
  if (cleaned.split(/\s+/).filter(Boolean).length > 12) return false
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
  source: 'tema_tutor_table' | 'markdown_index_table' | 'topic_headings' | 'explicit_index' | 'list_items' | 'headings' | 'llm_fallback' | 'none'
  incomplete: boolean
}

// Hallazgo real CRÍTICO (séptima verificación, 2026-07-13): con evidencia
// real de los logs de producción (no una suposición más), se confirmó que
// los documentos CNB reales de este colegio no usan una lista de temas en
// absoluto — usan una TABLA de Word titulada "Mapa de contenidos para
// tutoría" con columnas [#, Competencia, Indicador, Tema tutor].
// mammoth.extractRawText() aplana esa tabla en una secuencia de líneas
// sueltas, celda por celda, fila por fila (sin ningún separador de tabla):
// primero la fila de encabezados completa, luego cada fila de datos
// completa en el mismo orden de columnas. Esta función reconstruye esa
// tabla a partir de las líneas planas y extrae la columna que contiene la
// palabra "tema" en su encabezado (tolerante a variantes: "Tema tutor",
// "Tema", "Tema/Contenido", etc., no solo el nombre exacto visto en este
// documento).
function extractTemaTutorTable(lines: string[]): string[] {
  const inicioIdx = lines.findIndex((linea) => /mapa\s+de\s+contenidos/i.test(linea))
  if (inicioIdx === -1) return []

  // La fila de encabezados de una tabla real son celdas cortas (nombres de
  // columna, no oraciones) — se prueba con ventanas crecientes hasta
  // encontrar una que incluya una columna de "tema" y donde todas las
  // celdas candidatas sean cortas (encabezados reales, no párrafos).
  let colTemaIdx = -1
  let numCols = 0
  for (let n = 2; n <= 6 && inicioIdx + n <= lines.length; n++) {
    const candidato = lines.slice(inicioIdx + 1, inicioIdx + 1 + n)
    if (candidato.some((h) => h.length > 40)) continue
    const idxTema = candidato.findIndex((h) => /\btema\b/i.test(h))
    if (idxTema !== -1) {
      colTemaIdx = idxTema
      numCols = n
      break
    }
  }
  if (colTemaIdx === -1) return []

  // Las filas de datos de esta plantilla siempre empiezan con el número de
  // fila (columna "#") — se usa como ancla para no desalinear la lectura
  // de columnas si alguna celda tiene saltos de línea inesperados.
  const temas: string[] = []
  let idx = inicioIdx + 1 + numCols
  while (idx + numCols <= lines.length && /^\d+$/.test(lines[idx])) {
    const fila = lines.slice(idx, idx + numCols)
    const valor = fila[colTemaIdx]
    if (valor) pushUnique(temas, valor)
    idx += numCols
  }
  return temas
}

// Hallazgo real CRÍTICO (QA en vivo, 2026-07-19, cuenta Paul): en los
// documentos base MÁS RECIENTES (ej. "Ciencias Sociales y Formación
// Ciudadana Primaria" y "Comunicación y Lenguaje", ambas 6to Primaria), el
// índice de temas vive en una tabla MARKDOWN genuina bajo el encabezado
// "## Índice completo" ("| No. | Código | Bloque | Tema | Meta |") — un
// formato distinto tanto de extractTemaTutorTable (tabla de Word aplanada
// por mammoth, sin pipes, activada por "mapa de contenidos") como de
// cualquier otra estrategia de abajo. Ninguna las reconocía, así que el
// código caía hasta el respaldo más débil (list_items, sin ningún
// encabezado de sección que lo acote), que terminaba recogiendo viñetas de
// metadata ("Colegio: Colegio Montano.") e instrucciones internas
// ("Distinguir fuente primaria, secundaria...") como si fueran "temas" del
// curso — los 87 temas reales de la tabla nunca se usaban.
function extractMarkdownIndexTable(lines: string[]): string[] {
  const esFilaDeTabla = (linea: string) => /^\s*\|.*\|\s*$/.test(linea)
  const esFilaSeparadora = (linea: string) => /^[\s|:\-]+$/.test(linea) && linea.includes('-')

  const headerIdx = lines.findIndex((linea) => esFilaDeTabla(linea) && /\|\s*tema\s*\|/i.test(linea))
  if (headerIdx === -1) return []
  if (!esFilaSeparadora(lines[headerIdx + 1] || '')) return []

  const encabezados = lines[headerIdx].split('|').map((c) => c.trim())
  const colTemaIdx = encabezados.findIndex((c) => /^tema$/i.test(c))
  if (colTemaIdx === -1) return []

  const temas: string[] = []
  for (let i = headerIdx + 2; i < lines.length; i++) {
    const linea = lines[i]
    if (!esFilaDeTabla(linea)) break
    const celdas = linea.split('|').map((c) => c.trim())
    const valor = celdas[colTemaIdx]
    if (valor) pushUnique(temas, valor)
  }
  return temas
}

export function extractCourseTopicIndex(content: string): CourseTopicIndex {
  const declaredCount = extractDeclaredTopicCount(content)
  const lines = (content || '').split(/\r?\n/)
  const topics: string[] = []

  const temasDeTabla = extractTemaTutorTable(lines.map((l) => l.trim()).filter(Boolean))
  if (temasDeTabla.length > 0) {
    return { topics: temasDeTabla, declaredCount, source: 'tema_tutor_table', incomplete: declaredCount !== null && temasDeTabla.length < declaredCount }
  }

  const temasDeTablaMarkdown = extractMarkdownIndexTable(lines)
  if (temasDeTablaMarkdown.length > 0) {
    return { topics: temasDeTablaMarkdown, declaredCount, source: 'markdown_index_table', incomplete: declaredCount !== null && temasDeTablaMarkdown.length < declaredCount }
  }

  // Hallazgo real CRÍTICO (sexta verificación, 2026-07-13): "temas de esta
  // materia" respondía "no tengo suficiente información" para un documento
  // .docx REAL y correctamente encontrado (el nombre del archivo aparecía
  // como fuente) — el bug no era de contenido faltante, era de extracción.
  // extraerTexto() lee .docx con mammoth.extractRawText(), que DESCARTA los
  // números y viñetas de una lista nativa de Word (esa numeración la
  // dibuja Word desde numbering.xml, no forma parte del texto del párrafo)
  // — así que un índice de temas con formato de lista nativa de Word (el
  // caso más común en documentos reales preparados en Word) se convierte
  // en líneas sueltas de texto plano SIN NINGÚN marcador, y ninguna de las
  // cuatro estrategias de abajo (que exigen "#", "-", "*", "•" o "N."/"N)")
  // podía reconocerlas jamás. Se hace opcional el prefijo "#" en
  // topic_headings (un encabezado de Word "Tema 1: X" también pierde su
  // "#" al pasar por mammoth) y se agrega un respaldo de línea suelta en el
  // índice explícito (ver más abajo).
  for (const line of lines) {
    const match = line.match(/^\s*#{0,5}\s*(?:tema|topic)\s*(?:\d+)?\s*[:.\-–—]\s*(.+)$/i)
    if (match) pushUnique(topics, match[1])
  }
  if (topics.length > 0) {
    return { topics, declaredCount, source: 'topic_headings', incomplete: declaredCount !== null && topics.length < declaredCount }
  }

  let inIndex = false
  // Hallazgo real (séptima verificación, 2026-07-13): la sección real
  // "Cobertura del paquete" del documento de Lenguaje sí se reconocía,
  // pero el respaldo de línea suelta seguía arrastrando la sección
  // SIGUIENTE ("Banco de práctica integrado", "Comprensión Literal" como
  // subtítulo repetido) porque esas líneas también "parecen" un tema
  // aislado. Las 4 líneas reales de esa sección tienen el patrón
  // "Etiqueta: descripción" (una etiqueta corta seguida de dos puntos); una
  // vez que ese patrón queda establecido, una línea sin esa forma señala
  // el inicio de una sección nueva, no una continuación de la lista.
  let modoEtiquetaDescripcion: boolean | null = null
  for (const line of lines) {
    const normalized = normalizeText(line)
    if (/^(#{1,4}\s*)?(indice de temas|indice del curso|temas|secuencia de temas|mapa del curso|cobertura del paquete|course index|topics|course map)\b/.test(normalized)) {
      inIndex = true
      modoEtiquetaDescripcion = null
      continue
    }
    if (inIndex && /^#{1,2}\s+/.test(line) && !/(tema|topic|unidad|unit|bloque|block)/i.test(line)) break
    if (!inIndex) continue
    if (!line.trim()) continue
    const item = line.match(/^\s*(?:[-*•]|\d{1,3}[.)])\s+(.+)$/)
    if (item) {
      pushUnique(topics, item[1])
      continue
    }
    // Respaldo de línea suelta (sin viñeta/número): trata la línea como
    // tema si "parece" uno (isProbablyTopic ya filtra objetivos, preguntas
    // e instrucciones) — y corta la sección en cuanto aparece una línea
    // que claramente no lo es, una vez que ya se llevan temas acumulados,
    // para no arrastrar párrafos de prosa no relacionados que vengan
    // después del índice.
    if (isProbablyTopic(line)) {
      const idxDosPuntos = line.indexOf(':')
      const esEtiquetaDescripcion = idxDosPuntos > 0 && idxDosPuntos <= 60
      if (modoEtiquetaDescripcion === null) modoEtiquetaDescripcion = esEtiquetaDescripcion
      if (modoEtiquetaDescripcion && !esEtiquetaDescripcion && topics.length > 0) break
      pushUnique(topics, line)
    } else if (topics.length > 0) {
      break
    }
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
    if (!inIndex && /^(#{1,4}\s*)?(indice de temas|indice del curso|temas|secuencia de temas|mapa del curso|cobertura del paquete|course index|topics|course map)\b/.test(normalized)) {
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

// Hallazgo real (verificación posterior, 2026-07-12): "dame los temas de
// campos e interacciones" — sin decir "bloque" ni "unidad" — no activaba
// esta detección en absoluto; el sistema devolvía el índice completo sin
// filtrar. Se agrega la forma genérica "temas de X" como disparador
// también. La ambigüedad con una petición normal ("dame los temas de esta
// clase") se resuelve en route.ts: solo se responde con el bloque
// filtrado si el nombre consultado coincide con un bloque real extraído
// de la fuente (findBlockByQuery) — si no coincide con ninguno, la
// petición sigue el flujo normal del índice completo.
// Hallazgo real (segunda verificación, 2026-07-12): la lista de frases
// fijas de arriba usaba coincidencia de substring exacto (.includes), que
// se rompe con una sola palabra insertada — "dame TODOS los temas de
// verificación de dominio" no contiene la substring literal "dame los
// temas de" por la palabra "todos" en medio. Un primer intento de arreglo
// enumeró palabras insertables específicas (todos/todas, el listado de),
// pero eso es la MISMA clase de bug con una lista distinta: "dame
// ABSOLUTAMENTE todos los temas de X" (tercera verificación, 2026-07-13)
// volvió a fallar porque "absolutamente" no estaba en la lista. Enumerar
// palabras insertables es una carrera perdida — se reemplaza por un hueco
// de longitud acotada (hasta 40 caracteres) entre el verbo/pregunta y "los
// temas de"/"topics of", que tolera CUALQUIER palabra o combinación
// intermedia sin necesidad de enumerarlas. El riesgo de falso positivo es
// bajo porque route.ts solo intercepta si el nombre consultado coincide
// con un bloque REAL extraído de la fuente (findBlockByQuery).
const PATRONES_BLOQUE_O_TEMAS_DE = [
  /que\s+temas\s+incluye\s+el\s+bloque/,
  /que\s+temas\s+tiene\s+el\s+bloque/,
  /cuales\s+son\s+los\s+temas\s+del\s+bloque/,
  /que\s+abarca\s+el\s+bloque/,
  /que\s+temas\s+incluye\s+la\s+unidad/,
  /cuales\s+son\s+los\s+temas\s+de\s+la\s+unidad/,
  /que\s+abarca\s+la\s+unidad/,
  /what\s+topics\s+does\s+the\s+block\s+include/,
  /what\s+topics\s+are\s+in\s+the\s+unit/,
  /what\s+does\s+the\s+block\s+cover/,
  /what\s+does\s+the\s+unit\s+cover/,
  /\b(?:dame|deme|quiero|necesito)\b.{0,40}\blos\s+temas\s+de\b/,
  /cuales\s+son.{0,40}\blos\s+temas\s+de\b/,
  /que\s+temas\s+tiene/,
  /\b(?:give\s+me|i\s+want|i\s+need)\b.{0,40}\btopics\s+of\b/,
  /what\s+are.{0,40}\btopics\s+of\b/,
  /topics\s+of/,
  /topics\s+in/,
]

export function isBlockGroupingQuestion(value: string): boolean {
  const text = normalizeText(value)
  if (!text) return false
  return PATRONES_BLOQUE_O_TEMAS_DE.some((pattern) => pattern.test(text))
}

// Hallazgo real CRÍTICO (cuarta verificación, 2026-07-13): "dame
// absolutamente todos los temas de verificación de dominio de este curso,
// por favor" capturaba "verificación de dominio de este curso, por favor"
// completo como consulta — el ruido final ("de este curso", "por favor")
// nunca coincidía con ningún bloque ni con ninguna categoría real, así que
// la búsqueda fallaba silenciosamente y el flujo caía al índice completo
// sin filtrar. Se recorta el ruido final común de forma iterativa (puede
// venir combinado, ej. "...de este curso, por favor").
const RUIDO_FINAL_CONSULTA = /,?\s*(?:de\s+este\s+curso|de\s+esta\s+clase|de\s+esta\s+materia|por\s+favor|please)\s*$/i

export function extractBlockQuery(value: string): string | null {
  const texto = (value || '').trim()
  const match = /(?:bloque|unidad|unit|block)\s+(?:de\s+)?(.+?)[?¿]?$/i.exec(texto) ||
    /(?:temas|topics)\s+(?:de|of|in)\s+(.+?)[?¿]?$/i.exec(texto)
  if (!match) return null
  let query = match[1].trim()
  let cambio = true
  while (cambio) {
    const recortado = query.replace(RUIDO_FINAL_CONSULTA, '').trim()
    cambio = recortado !== query
    query = recortado
  }
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

// Hallazgo real CRÍTICO (cuarta verificación, 2026-07-13): "dame todos los
// temas de verificación de dominio" NO es una pregunta sobre un bloque con
// encabezado propio ("## Bloque N: X") — es una categoría que se repite
// como parte del TÍTULO de temas individuales dispersos en el índice (ej.
// "6. Verificación de dominio: células y evidencia", "24. Proyecto de
// dominio: evolución y diversidad"). extractCourseBlocks nunca encuentra
// esto (no hay bloques con ese nombre), así que findBlockByQuery siempre
// devolvía null y el flujo caía al índice completo sin filtrar — el bug
// reportado no era de tolerancia a palabras insertadas, sino que faltaba
// por completo este segundo mecanismo de filtrado por categoría/palabra
// clave dentro de los títulos de los temas.
const PALABRAS_VACIAS_CATEGORIA = new Set([
  'de', 'del', 'la', 'los', 'las', 'el', 'y', 'a', 'que', 'es', 'un', 'una',
  'este', 'esta', 'esa', 'ese', 'curso', 'clase', 'materia', 'favor', 'por',
  'the', 'of', 'this', 'course', 'class', 'in', 'for',
])

function extractCategoryKeywords(query: string): string[] {
  return normalizeText(query)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !PALABRAS_VACIAS_CATEGORIA.has(w))
}

export function filterTopicsByCategory(topics: string[], query: string): { indice: number; tema: string }[] {
  const palabras = extractCategoryKeywords(query)
  if (palabras.length === 0) return []
  return topics
    .map((tema, i) => ({ indice: i + 1, tema }))
    .filter(({ tema }) => {
      const normTema = normalizeText(tema)
      return palabras.some((palabra) => normTema.includes(palabra))
    })
}

// Devuelve null cuando el filtro no reduce nada de forma útil (ninguna
// coincidencia, o coincide con TODOS los temas) — en ese caso el llamador
// debe seguir el flujo normal del índice completo en vez de forzar una
// respuesta filtrada que no aporta nada.
export function buildCategoryTopicsResponse(input: {
  topics: string[]
  query: string
  idiomaIngles?: boolean
}): string | null {
  const { topics, query, idiomaIngles } = input
  const filtrados = filterTopicsByCategory(topics, query)
  if (filtrados.length === 0 || filtrados.length === topics.length) return null
  const items = filtrados.map((f) => `${f.indice}. ${f.tema}`).join('\n')
  return idiomaIngles
    ? `These are the topics related to "${query}" in this course:\n\n${items}`
    : `Estos son los temas de ${query} en este curso:\n\n${items}`
}

// Hallazgo real CRÍTICO (verificación posterior al instructivo, 2026-07-12):
// la instrucción de PROMPT_BASE de "nunca inventes alineación a estándares
// oficiales" no se cumplía de forma confiable — al preguntar si el curso
// está alineado con NGSS, el modelo respondió con total confianza "Sí...
// específicamente con el bloque de 'High School Life Sciences'", una
// afirmación inventada sin ninguna fuente que la respalde. Una instrucción
// de prompt por sí sola no es suficiente para esto — se agrega un guard
// determinístico: solo se confirma una alineación si el nombre del
// estándar aparece LITERALMENTE en el contenido oficial disponible; si no,
// se responde con cautela explícita en vez de dejar que el modelo decida.
export function isStandardsAlignmentQuestion(value: string): boolean {
  const text = normalizeText(value)
  if (!text) return false
  const mencionaEstandar = /\b(ngss|common core|estandar(?:es)? (?:curricular(?:es)?|oficial(?:es)?|nacional(?:es)?)|standard)\b/.test(text)
  if (!mencionaEstandar) return false
  return /(?:esta|est[aá]n)\s+alineado|alinead[oa]\s+con|cumple\s+con|se\s+alinea|is\s+(?:this\s+)?aligned|aligned\s+with|does\s+this\s+(?:course|class)\s+(?:meet|follow|align)/.test(text)
}

const NOMBRES_ESTANDAR_CONOCIDOS = ['NGSS', 'Common Core', 'CNB', 'TEKS', 'IB', 'AP']

export function extractStandardQuery(value: string): string | null {
  const texto = (value || '').trim()
  for (const nombre of NOMBRES_ESTANDAR_CONOCIDOS) {
    if (new RegExp(`\\b${nombre.replace(/\s+/g, '\\s+')}\\b`, 'i').test(texto)) return nombre
  }
  const match = /(?:con|with)\s+(?:los\s+est[aá]ndares\s+de\s+|el\s+est[aá]ndar\s+de\s+)?([a-z0-9 .-]{2,40}?)[?¿.]?$/i.exec(texto)
  if (!match) return null
  const estandar = match[1].trim()
  return estandar.length >= 2 ? estandar : null
}

// Hallazgo real CRÍTICO (segunda verificación, 2026-07-12): el guard de
// arriba respondía correctamente a la pregunta directa de alineación, pero
// el pedido natural de SEGUIMIENTO ("cítame textualmente dónde dice eso")
// no coincidía con isStandardsAlignmentQuestion (no repite el nombre del
// estándar ni la frase de alineación) — así que caía a generación libre
// del modelo, que inventó una justificación elaborada y falsa al sentirse
// presionado a dar una cita. Para prevenir esto, la respuesta inicial ya
// incluye la línea literal donde aparece el estándar (si existe), y
// además se agrega un guard separado (ver isStandardsCitationFollowUp)
// para interceptar la pregunta de seguimiento y reutilizar el mismo
// resultado determinístico en vez de dejarlo en manos del modelo.
function extractLiteralMention(content: string, standard: string): string | null {
  const idx = (content || '').toLowerCase().indexOf(standard.toLowerCase())
  if (idx === -1) return null
  const start = content.lastIndexOf('\n', idx)
  const end = content.indexOf('\n', idx)
  const line = content.slice(start === -1 ? 0 : start + 1, end === -1 ? content.length : end).trim()
  return line.length > 0 ? line : null
}

export function buildStandardsAlignmentResponse(input: {
  content: string
  standard: string | null
  idiomaIngles?: boolean
}): string {
  const { content, standard, idiomaIngles } = input
  if (!standard) {
    return idiomaIngles
      ? 'I cannot confirm alignment with an official standard unless it is explicitly stated in the official course material — I do not have enough information to answer that with certainty.'
      : 'No puedo confirmar una alineación con un estándar oficial a menos que esté indicada explícitamente en el material oficial del curso — no tengo suficiente información para responder eso con seguridad.'
  }
  const contenidoNormalizado = normalizeText(content || '')
  const estandarNormalizado = normalizeText(standard)
  const mencionado = !!contenidoNormalizado && contenidoNormalizado.includes(estandarNormalizado)
  if (mencionado) {
    const cita = extractLiteralMention(content, standard)
    const citaTexto = cita
      ? (idiomaIngles ? ` The literal line in the source is: "${cita}"` : ` La línea literal en la fuente es: "${cita}"`)
      : (idiomaIngles
        ? ' I cannot pinpoint the exact literal line right now, so I will not quote one — I can only confirm the name appears in the source.'
        : ' No puedo ubicar la línea literal exacta ahora mismo, así que no voy a citar una — solo puedo confirmar que el nombre aparece en la fuente.')
    return idiomaIngles
      ? `The official material for this course explicitly mentions "${standard}" — but I can only confirm what is literally stated there, not interpret how each topic maps to it.${citaTexto}`
      : `El material oficial de este curso menciona explícitamente "${standard}" — pero solo puedo confirmar lo que está indicado ahí literalmente, no interpretar cómo se relaciona cada tema con ese estándar.${citaTexto}`
  }
  return idiomaIngles
    ? `I do not see "${standard}" mentioned anywhere in the official material available for this course, so I cannot confirm that alignment — I will not invent a mapping to a standard that is not explicitly stated in the source.`
    : `No veo "${standard}" mencionado en ninguna parte del material oficial disponible para este curso, así que no puedo confirmar esa alineación — no voy a inventar una relación con un estándar que no esté indicado explícitamente en la fuente.`
}

const FRASES_CITA_TEXTUAL_SEGUIMIENTO = [
  /c[ií]tame\s+textualmente/,
  /citar\s+textualmente/,
  /puedes\s+citar/,
  /muestrame\s+(?:textualmente\s+)?donde/,
  /donde\s+dice\s+eso/,
  /donde\s+aparece\s+eso/,
  /en\s+que\s+parte\s+(?:exacta\s+)?(?:dice|aparece)/,
  /cita\s+textual/,
  /texto\s+exacto\s+donde/,
  /quote\s+it\s+exactly/,
  /can\s+you\s+quote/,
  /show\s+me\s+exactly\s+where/,
  /where\s+exactly\s+does\s+it\s+say/,
]

// Detecta el pedido de seguimiento ("cítame textualmente dónde dice eso")
// SIN exigir que repita el nombre del estándar — el alumno normalmente no
// lo repite en un seguimiento natural. El llamador debe confirmar además
// que el turno anterior fue una respuesta de este mismo guard antes de
// reutilizar el resultado (ver extractStandardFromPriorResponse).
export function isStandardsCitationFollowUp(value: string): boolean {
  const text = normalizeText(value)
  if (!text) return false
  return FRASES_CITA_TEXTUAL_SEGUIMIENTO.some((pattern) => pattern.test(text))
}

// El guard siempre envuelve el nombre del estándar entre comillas dobles
// en su propia respuesta anterior — se reutiliza ese formato para
// recuperar el estándar consultado sin depender de que el alumno lo repita.
export function extractStandardFromPriorResponse(previousAssistantMessage: string): string | null {
  const text = previousAssistantMessage || ''
  const esRespuestaDelGuard = /menciona expl[ií]citamente|no veo ".*" mencionado|explicitly mentions|do not see ".*" mentioned/i.test(text)
  if (!esRespuestaDelGuard) return null
  const match = /"([^"]+)"/.exec(text)
  return match ? match[1] : null
}

// Hallazgo real CRÍTICO (tercera verificación, 2026-07-13): el seguimiento
// "¿puedes citar textualmente dónde dice eso?" seguía sin interceptarse en
// la práctica — la causa más probable es que extractStandardFromPriorResponse
// depende de que el turno INMEDIATAMENTE anterior sea exactamente el texto
// canónico de este guard, y la pregunta inicial de alineación pudo no haber
// pasado por isStandardsAlignmentQuestion (frase distinta a la esperada) o
// haber otro turno intermedio. Esta función es una red más amplia y
// tolerante: busca el nombre de un estándar conocido en CUALQUIER mensaje
// reciente del historial (de cualquier rol), no solo en el turno anterior
// con el formato exacto del guard — así el seguimiento se puede resolver de
// forma determinística incluso si la respuesta inicial fue generada
// libremente por el modelo (siempre que haya nombrado el estándar).
export function extractStandardMentionedInHistory(
  historial: { rol: string; contenido: string }[] | undefined,
  maxTurnsAtras = 6
): string | null {
  if (!Array.isArray(historial)) return null
  const recientes = historial.slice(-maxTurnsAtras)
  for (let i = recientes.length - 1; i >= 0; i -= 1) {
    const texto = recientes[i]?.contenido || ''
    for (const nombre of NOMBRES_ESTANDAR_CONOCIDOS) {
      if (new RegExp(`\\b${nombre.replace(/\s+/g, '\\s+')}\\b`, 'i').test(texto)) return nombre
    }
  }
  return null
}
