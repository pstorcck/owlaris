// Hallazgo real (verificación posterior al instructivo, 2026-07-12): el
// contenido curricular enviado al modelo como contexto siempre tomaba los
// primeros 3000 caracteres del documento (contenidoCurricular.substring(0,
// 3000)), sin importar de qué tratara la pregunta del alumno. Si el
// documento empieza con un índice de temas o una introducción general y la
// pregunta real es sobre un tema que aparece más adelante, el modelo solo
// tenía ese contenido inicial disponible — y terminaba citando o
// resumiendo ese fragmento inicial (índice, otro tema) antes de responder,
// lo que se percibe como "contexto de otro turno/tema pegado al inicio de
// la respuesta". Esta función busca una ventana de contenido centrada en
// la primera palabra clave de la pregunta que aparezca en el documento, en
// vez de tomar siempre el encabezado.
const PALABRAS_VACIAS = new Set([
  'el', 'la', 'los', 'las', 'de', 'del', 'en', 'y', 'a', 'que', 'es', 'un',
  'una', 'unos', 'unas', 'como', 'por', 'para', 'con', 'se', 'su', 'sus',
  'mi', 'tu', 'o', 'no', 'si', 'al', 'lo', 'le', 'les', 'me', 'te', 'nos',
  'este', 'esta', 'esto', 'ese', 'esa', 'eso', 'sobre', 'pero', 'mas',
  'the', 'of', 'in', 'and', 'to', 'a', 'is', 'that', 'for', 'on', 'with',
  'what', 'how', 'why', 'about', 'explain', 'explica', 'explicame',
  'cual', 'cuales', 'cuanto', 'cuantos', 'quiero', 'puedes', 'dame',
])

function normalizeText(value: string) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function extractKeywords(pregunta: string): string[] {
  return normalizeText(pregunta)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !PALABRAS_VACIAS.has(w))
}

export function extractRelevantContentWindow(content: string, pregunta: string, maxLen = 3000): string {
  if (!content) return content
  if (content.length <= maxLen) return content

  const normalizedContent = normalizeText(content)
  for (const keyword of extractKeywords(pregunta)) {
    const idx = normalizedContent.indexOf(keyword)
    if (idx === -1) continue
    const start = Math.max(0, idx - Math.floor(maxLen * 0.3))
    const end = Math.min(content.length, start + maxLen)
    return content.slice(start, end)
  }

  return content.slice(0, maxLen)
}
