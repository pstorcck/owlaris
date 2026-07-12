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

export function isExplicitTableRequest(value: string): boolean {
  const text = normalizeText(value)
  if (!text) return false
  return FRASES_TABLA_EXPLICITA.some((needle) => text.includes(needle)) || PALABRA_TABLA.test(text)
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
