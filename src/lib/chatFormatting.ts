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

// La interfaz del alumno no renderiza markdown técnico (encabezados con #,
// negritas con **, tablas con pipes). El prompt ya le pide al modelo que no
// lo use, pero esta limpieza es la red de seguridad determinística cuando el
// modelo lo genera de todas formas.
export function sanitizeChatFormatting(text: string): string {
  if (!text) return text

  let out = text
  out = out.replace(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/gm, '$1')
  out = out.replace(/\*\*(.+?)\*\*/g, '$1')
  out = convertMarkdownTables(out)
  out = out.replace(new RegExp(SEPARATOR_ROW.source, 'gm'), '')
  out = out
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()

  return out
}
