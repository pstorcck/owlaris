// Guardas de lenguaje para el reporte familiar: evita inferencias
// emocionales que no están respaldadas por datos observables, y evita
// recomendar recursos externos no aprobados (videos, artículos, enlaces).

const FRASES_EMOCIONALES_NO_OBSERVABLES = [
  /mostr[oó]\s+(?:mucho\s+|gran\s+)?inter[eé]s(?:\s+y\s+receptividad)?/gi,
  /mostr[oó]\s+receptividad/gi,
  /se\s+mostr[oó]\s+(?:muy\s+)?motivad[oa]/gi,
  /estuvo\s+(?:muy\s+)?comprometid[oa]/gi,
  /particip[oó]\s+con\s+(?:mucho\s+)?entusiasmo/gi,
  /con\s+(?:mucho\s+)?entusiasmo/gi,
  /demostr[oó]\s+(?:gran\s+)?inter[eé]s/gi,
  /showed\s+(?:great\s+|a\s+lot\s+of\s+)?interest(?:\s+and\s+receptiveness)?/gi,
  /was\s+(?:very\s+)?motivated/gi,
  /participated\s+with\s+enthusiasm/gi,
  /showed\s+commitment/gi,
  /seemed\s+(?:very\s+)?engaged/gi,
]

export function stripUngroundedEmotionalClaims(text: string, idiomaIngles = false): { text: string; guardActivado: boolean } {
  if (!text) return { text, guardActivado: false }
  let cleaned = text
  for (const pattern of FRASES_EMOCIONALES_NO_OBSERVABLES) cleaned = cleaned.replace(pattern, '')
  cleaned = cleaned
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/^[,.;:\s]+/, '')
    .trim()
  if (cleaned === text.trim()) return { text, guardActivado: false }
  const fallback = idiomaIngles ? 'Activity recorded during the session.' : 'Actividad registrada durante la sesión.'
  return { text: cleaned || fallback, guardActivado: true }
}

const NEEDLES_RECURSOS_EXTERNOS = [
  'youtube', 'youtu.be', 'video', 'articulo', 'article', 'lectura recomendada', 'recommended reading',
  'enlace', 'link', 'pagina web', 'website', 'khan academy',
]

const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g')

function normalize(value: string) {
  return (value || '').toLowerCase().normalize('NFD').replace(COMBINING_MARKS, '')
}

export function esRecomendacionConRecursoExterno(texto: string): boolean {
  const t = normalize(texto)
  return NEEDLES_RECURSOS_EXTERNOS.some((needle) => t.includes(normalize(needle)))
}

// Filtra cualquier recomendación que sugiera un recurso externo no aprobado;
// si todas quedan filtradas, usa el fallback (acciones dentro de Owlaris).
export function filtrarRecomendaciones(items: string[], fallback: string[]): string[] {
  const limpias = items.filter((item) => !esRecomendacionConRecursoExterno(item))
  return limpias.length > 0 ? limpias : fallback
}
