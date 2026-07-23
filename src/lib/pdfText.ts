// Hallazgo real (QA Ronda 3, 2026-07-10, confirmado reproducible en Anexo B):
// las fuentes estandar de jsPDF (helvetica) solo soportan el rango Latin-1.
// Cuando el anexo de evidencia del reporte incluye texto crudo del alumno con
// emojis u otros caracteres fuera de ese rango, jsPDF los codifica mal y el
// PDF muestra texto corrupto (mojibake), aunque el chat en vivo los muestre
// bien. sanitizarTextoPdf reemplaza cualquier racha de caracteres fuera de
// Latin-1 (ademas de espacio, tab y salto de linea) por un marcador legible
// en vez de dejar que jsPDF los codifique mal.
const RANGO_LATIN1_IMPRIMIBLE = new RegExp('[^\\u0009\\u000a\\u000d\\u0020-\\u00ff]+', 'g')

// Hallazgo real (QA en vivo, 2026-07-22, reporte de Brenda): una etiqueta
// estructurada del reporte ("Materia: Matemáticas Primaria") salió como
// "Matemá[emoji]ticas Primaria" en el PDF — el nombre de la materia
// probablemente arrastra un carácter invisible de formato (espacio de
// ancho cero, marca direccional, selector de variación, etc., típico de
// texto copiado desde un título de documento), no un emoji real. Esos
// caracteres nunca se ven, ni siquiera en el chat en vivo, así que
// mostrarlos como "[emoji]" hace parecer corrupta una etiqueta normal. Se
// eliminan en silencio ANTES de aplicar el reemplazo por "[emoji]", que se
// reserva para contenido visible fuera de Latin-1 (el caso real que esta
// función fue creada para resolver: emojis genuinos en respuestas libres
// del alumno).
const CARACTERES_INVISIBLES = new RegExp('[\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u2064\\uFEFF\\uFE00-\\uFE0F]', 'g')

export function sanitizarTextoPdf<T>(valor: T): T {
  if (typeof valor === 'string') {
    return valor
      .replace(CARACTERES_INVISIBLES, '')
      .replace(RANGO_LATIN1_IMPRIMIBLE, '[emoji]') as unknown as T
  }
  if (Array.isArray(valor)) {
    return valor.map(sanitizarTextoPdf) as unknown as T
  }
  return valor
}
