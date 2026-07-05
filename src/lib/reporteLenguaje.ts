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
  // "Mostró iniciativa"/"de manera proactiva" son juicios de actitud, no
  // hechos observables — encontrado en un reporte real de producción.
  /(?:mostr[oó]|demostr[oó]|tuvo)\s+(?:mucha\s+|gran\s+)?iniciativa/gi,
  /de\s+(?:manera|forma)\s+proactiv[ao]/gi,
  /actu[oó]\s+de\s+(?:manera|forma)\s+proactiv[ao]/gi,
  /showed\s+(?:great\s+|a\s+lot\s+of\s+)?interest(?:\s+and\s+receptiveness)?/gi,
  /was\s+(?:very\s+)?motivated/gi,
  /participated\s+with\s+enthusiasm/gi,
  /showed\s+commitment/gi,
  /seemed\s+(?:very\s+)?engaged/gi,
  /showed\s+(?:great\s+)?initiative/gi,
  /(?:acted|worked)\s+proactively/gi,
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

// Palabras sin ambigüedad: nunca aparecen como contenido curricular legítimo.
const NEEDLES_RECURSOS_EXTERNOS_SIMPLES = [
  'youtube', 'youtu.be', 'video', 'khan academy', 'pagina web', 'website',
  'lectura recomendada', 'recommended reading',
]

// "enlace" y "articulo/article" son ambiguos: "enlace" es un tema real de
// Química (enlace químico/covalente/iónico) y "artículo" es un tema real de
// Español/Inglés (el artículo determinado/indeterminado como parte de la
// gramática) — un escaneo de las palabras clave curriculares reales
// encontró esta colisión exacta. Requieren contexto explícito de recurso
// externo, no basta con que la palabra aparezca.
const PATRONES_RECURSOS_EXTERNOS_AMBIGUOS = [
  /enlace\s+(?:externo|web|de\s+internet)/i,
  /(?:compartir|visita|aqu[ií]\s+est[aá])\s+(?:un\s+|este\s+)?enlace\b/i,
  /\blink\b/i,
  /articulo\s+(?:externo|de\s+internet)/i,
  /\b(?:leer|revisar|ver)\s+(?:un\s+|este\s+)?articulo\s+sobre\b/i,
  /\ban?\s+article\s+about\b/i,
  /\ba\s+reading\s+about\b/i,
]

const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g')

function normalize(value: string) {
  return (value || '').toLowerCase().normalize('NFD').replace(COMBINING_MARKS, '')
}

export function esRecomendacionConRecursoExterno(texto: string): boolean {
  const t = normalize(texto)
  if (NEEDLES_RECURSOS_EXTERNOS_SIMPLES.some((needle) => t.includes(normalize(needle)))) return true
  return PATRONES_RECURSOS_EXTERNOS_AMBIGUOS.some((pattern) => pattern.test(t))
}

// Filtra cualquier recomendación que sugiera un recurso externo no aprobado;
// si todas quedan filtradas, usa el fallback (acciones dentro de Owlaris).
export function filtrarRecomendaciones(items: string[], fallback: string[]): string[] {
  const limpias = items.filter((item) => !esRecomendacionConRecursoExterno(item))
  return limpias.length > 0 ? limpias : fallback
}
