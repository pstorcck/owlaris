const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g')

function normalizeText(value: string) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Reemplaza la acción rápida "Propón otro tema" (empujaba a cambiar de tema
// en vez de dominar el actual) por "Revisemos mis errores".
export function isReviewMistakesRequest(pregunta: string): boolean {
  const t = normalizeText(pregunta)
  return [
    'revisemos mis errores',
    'revisa mis errores',
    'revisar mis errores',
    'repasemos mis errores',
    'repasar mis errores',
    'review my mistakes',
    'review my errors',
    "let's review my mistakes",
    'lets review my mistakes',
    // Instrucciones del 13 de julio — nueva "opción de ayuda" ("Revisa lo
    // que hice") apunta a la misma funcionalidad de revisión de errores.
    'revisa lo que hice',
    'review what i did',
  ].some((needle) => t.includes(needle))
}

export type RegistroError = {
  tema_detectado?: string | null
  operacion_canonica?: string | null
}

// Identifica el patrón (tema que más se repite) entre los errores recientes,
// para explicar qué concepto base pudo fallar en vez de solo contar cuántos
// hubo.
export function temaMasFrecuente(errores: RegistroError[]): string | null {
  const conteo: Record<string, number> = {}
  for (const error of errores) {
    const tema = (error.tema_detectado || '').trim()
    if (!tema) continue
    conteo[tema] = (conteo[tema] || 0) + 1
  }
  const ordenado = Object.entries(conteo).sort((a, b) => b[1] - a[1])
  return ordenado[0]?.[0] || null
}

export type PatronErrores = { tema: string; conteo: number; totalConTema: number }

// Hallazgo real (QA 2026-07-14): "Noté un patrón: la mayoría de tus errores
// recientes fueron en X" se decía SIEMPRE que hubiera al menos un error con
// tema (incluido un solo error), aunque un solo dato nunca es "la mayoría"
// de nada. Esta función expone también el conteo real, para que quien arma
// el mensaje pueda decidir si de verdad hay un patrón (repetición genuina,
// no un solo error) antes de usar esa palabra.
export function detectarPatronErrores(errores: RegistroError[]): PatronErrores | null {
  const conteo: Record<string, number> = {}
  let totalConTema = 0
  for (const error of errores) {
    const tema = (error.tema_detectado || '').trim()
    if (!tema) continue
    conteo[tema] = (conteo[tema] || 0) + 1
    totalConTema += 1
  }
  const ordenado = Object.entries(conteo).sort((a, b) => b[1] - a[1])
  if (!ordenado[0]) return null
  return { tema: ordenado[0][0], conteo: ordenado[0][1], totalConTema }
}

export function primeraOperacionValida(errores: RegistroError[]): string | null {
  const conOperacion = errores.find((error) => !!error.operacion_canonica)
  return conOperacion?.operacion_canonica || null
}
