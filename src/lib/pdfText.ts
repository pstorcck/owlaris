// Hallazgo real (QA Ronda 3, 2026-07-10, confirmado reproducible en Anexo B):
// las fuentes estandar de jsPDF (helvetica) solo soportan el rango Latin-1.
// Cuando el anexo de evidencia del reporte incluye texto crudo del alumno con
// emojis u otros caracteres fuera de ese rango, jsPDF los codifica mal y el
// PDF muestra texto corrupto (mojibake), aunque el chat en vivo los muestre
// bien. sanitizarTextoPdf reemplaza cualquier racha de caracteres fuera de
// Latin-1 (ademas de espacio, tab y salto de linea) por un marcador legible
// en vez de dejar que jsPDF los codifique mal.
const RANGO_LATIN1_IMPRIMIBLE = /[^\u0009\u000a\u000d\u0020-\u00ff]+/g

export function sanitizarTextoPdf<T>(valor: T): T {
  if (typeof valor === 'string') {
    return valor.replace(RANGO_LATIN1_IMPRIMIBLE, '[emoji]') as unknown as T
  }
  if (Array.isArray(valor)) {
    return valor.map(sanitizarTextoPdf) as unknown as T
  }
  return valor
}
