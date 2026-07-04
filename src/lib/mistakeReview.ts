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

export function primeraOperacionValida(errores: RegistroError[]): string | null {
  const conOperacion = errores.find((error) => !!error.operacion_canonica)
  return conOperacion?.operacion_canonica || null
}
