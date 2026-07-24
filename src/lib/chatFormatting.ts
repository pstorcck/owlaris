const SEPARATOR_ROW = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/

function splitTableRow(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim())
}

function convertMarkdownTables(text: string): string {
  const lines = text.split('\n')
  const result: string[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const nextIsSeparator = i + 1 < lines.length && /\|/.test(line) && SEPARATOR_ROW.test(lines[i + 1] || '')
    if (nextIsSeparator) {
      const headers = splitTableRow(line)
      i += 2
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        const cells = splitTableRow(lines[i])
        const parts = headers
          .map((header, idx) => (cells[idx] ? `${header}: ${cells[idx]}` : ''))
          .filter(Boolean)
        if (parts.length > 0) result.push(parts.join(' — '))
        i += 1
      }
      continue
    }
    result.push(line)
    i += 1
  }
  return result.join('\n')
}

// Quita las marcas ``` de un bloque de código, dejando el contenido como
// texto plano — la interfaz del alumno no lo renderiza como bloque, así que
// mostrar los backticks crudos se ve tan roto como un encabezado sin procesar.
function stripCodeFences(text: string): string {
  return text.replace(/```[a-zA-Z0-9_-]*\n([\s\S]*?)```/g, (_match, contenido) => contenido.trim())
}

// La interfaz del alumno no renderiza markdown técnico (encabezados con #,
// negritas con **, tablas con pipes, bloques de código). El prompt ya le
// pide al modelo que no lo use, pero esta limpieza es la red de seguridad
// determinística cuando el modelo lo genera de todas formas.
// Hallazgo real (verificación posterior al instructivo, 2026-07-12): el
// PROMPT_BASE ya permite una tabla con pipes cuando el alumno la pide
// explícitamente (ítem 17), pero esta función seguía convirtiendo CUALQUIER
// tabla a formato "Etiqueta: valor" en línea sin excepción — el modelo
// obedecía la petición y esta limpieza la deshacía de todas formas. Se
// agrega el parámetro preserveTables para saltar esa conversión cuando el
// alumno pidió la tabla explícitamente.
export function sanitizeChatFormatting(text: string, preserveTables = false): string {
  if (!text) return text

  let out = text
  out = stripCodeFences(out)
  out = out.replace(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/gm, '$1')
  out = out.replace(/\*\*(.+?)\*\*/g, '$1')
  if (!preserveTables) {
    out = convertMarkdownTables(out)
    out = out.replace(new RegExp(SEPARATOR_ROW.source, 'gm'), '')
  }
  out = out
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()

  return out
}

// Hallazgo real (instructivo de mejoras, ronda 2026-07-11), ítems 18, 29:
// una petición de formato ("ponme esto en una tabla", "organiza esto
// bonito", "hazlo en lista") es una petición de REFORMATEAR el contenido
// activo, no una señal de cambio de tema — se usa como categoría propia en
// el clasificador de intención para que no se confunda con una pregunta
// nueva sin relación con lo que se venía trabajando.
function normalizeText(value: string) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Subconjunto específico de isFormatRequest: SOLO frases que piden una
// tabla explícitamente. Se usa para decidir si sanitizeChatFormatting debe
// preservar la tabla en vez de convertirla a "Etiqueta: valor" en línea —
// las demás peticiones de formato (lista, viñetas, "más bonito") no deben
// activar esa excepción, solo la de tabla.
const FRASES_TABLA_EXPLICITA = [
  'ponme esto en una tabla', 'en una tabla', 'en formato de tabla', 'hazlo en tabla',
  'put this in a table', 'in a table', 'in table format', 'make it a table',
]

// Hallazgo real (segunda verificación, 2026-07-12): la lista de frases
// fijas de arriba exige una frase completa ("en una tabla"), pero un
// pedido natural como "una tabla comparando célula procariota vs
// eucariota" no la contiene (falta la palabra "en" antes de "una tabla") —
// así que la petición explícita de tabla no se detectaba. Se agrega un
// segundo criterio: la sola palabra "tabla"/"table" con límite de palabra,
// que cubre cualquier frase donde el alumno la nombra como el formato que
// quiere, sin depender de una redacción exacta.
const PALABRA_TABLA = /\btabla\b|\btable\b/i

// Hallazgo real CRÍTICO (QA en vivo, 2026-07-24, Olimpiadas de Ciencias —
// Química): "tabla periódica"/"periodic table" es un TÉRMINO DE QUÍMICA
// (el objeto de estudio), no una petición de formato — "en la tabla
// periódica, ¿qué significa el número atómico?" es una pregunta
// conceptual que solo menciona "tabla" de paso, pero PALABRA_TABLA la
// marcaba como petición explícita de tabla igual. Se excluye ese caso
// específico del match de palabra suelta.
const TABLA_PERIODICA = /tabla periodica|periodic table/i

// Hallazgo real CRÍTICO (mismo QA): cuando el tutor SÍ respondió con una
// tabla que el alumno no pidió, sus siguientes mensajes para rechazarla
// ("no quiero la tabla", "otra vez la misma tabla", "contesta con
// palabras no con tabla") NECESARIAMENTE repiten la palabra "tabla" para
// describir lo que no quieren — y PALABRA_TABLA los marcaba, en cada
// turno, como una NUEVA petición explícita de tabla, reforzando el mismo
// bucle exactamente en el momento en que el alumno lo confrontaba. Un
// rechazo explícito nunca debe contar como petición, sin importar que
// contenga la palabra "tabla".
const FRASES_RECHAZO_TABLA = [
  'no quiero la tabla', 'no quiero tabla', 'sin la tabla', 'sin tabla',
  'no la tabla', 'otra vez la tabla', 'otra vez la misma tabla', 'misma tabla',
  'ya la vi', 'no con tabla', 'sin usar tabla', 'no en tabla', 'no en una tabla',
  'no me dice', 'no me explicaste', 'no me diste', 'contesta con palabras',
  'explicamelo con palabras', 'con palabras no con tabla', 'no quiero una tabla',
  "don't want the table", 'not the table', 'without a table', 'without the table',
  'same table again', 'keep sending the same table', 'in words, not a table',
]

export function isTableRejection(value: string): boolean {
  const text = normalizeText(value)
  if (!text) return false
  return FRASES_RECHAZO_TABLA.some((needle) => text.includes(needle))
}

export function isExplicitTableRequest(value: string): boolean {
  const text = normalizeText(value)
  if (!text) return false
  if (isTableRejection(value)) return false
  if (FRASES_TABLA_EXPLICITA.some((needle) => text.includes(needle))) return true
  if (!PALABRA_TABLA.test(text)) return false
  // "tabla periódica" no cuenta como mención de formato salvo que, además,
  // aparezca en alguna de las frases explícitas de arriba (ya evaluadas).
  const textoSinTablaPeriodica = text.replace(TABLA_PERIODICA, '')
  return PALABRA_TABLA.test(textoSinTablaPeriodica)
}

// Hallazgo real (cuarta y quinta verificación, 2026-07-13): incluso con la
// excepción del prompt y una instrucción puntual por turno, el modelo a
// veces igual entregaba viñetas en vez de una tabla explícitamente pedida
// — a veces con un rechazo verbal reconocible ("no puedo hacer una tabla
// en formato visual"), a veces en silencio (mismo prompt, dos intentos,
// resultados distintos). Se necesita poder detectar la AUSENCIA de sintaxis
// de tabla real de forma determinística para poder reintentar, sin
// depender de que el rechazo sea verbal y reconocible.
export function looksLikeMarkdownTable(text: string): boolean {
  const lineas = (text || '').split('\n')
  for (let i = 0; i < lineas.length - 1; i++) {
    if (/\|/.test(lineas[i]) && SEPARATOR_ROW.test(lineas[i + 1] || '')) return true
  }
  return false
}

export function isFormatRequest(value: string): boolean {
  const text = normalizeText(value)
  if (!text) return false
  return [
    ...FRASES_TABLA_EXPLICITA,
    'organiza esto bonito', 'organizalo mejor', 'organiza esto mejor', 'ordenalo mejor',
    'hazlo en lista', 'ponlo en una lista', 'en viñetas', 'en bullets',
    'hazlo mas bonito', 'hazlo mas ordenado', 'ponlo mas claro',
    'organize this nicely', 'make it more organized', 'put it in a list',
    'in bullet points', 'make it clearer', 'make it neater',
  ].some((needle) => text.includes(needle))
}
