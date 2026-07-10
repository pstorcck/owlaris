import assert from 'node:assert/strict'
import { sanitizarTextoPdf } from '../src/lib/pdfText'

async function main() {
  // Hallazgo real (QA Ronda 3, 2026-07-10, confirmado reproducible en Anexo
  // B): una rafaga de emojis se guardaba como texto corrupto (mojibake) en
  // el PDF del reporte. sanitizarTextoPdf debe reemplazar cualquier racha de
  // caracteres fuera de Latin-1 por un marcador legible.
  assert.equal(sanitizarTextoPdf('Tema: 😀😀😂👍'), 'Tema: [emoji]')
  assert.equal(sanitizarTextoPdf('😀 hola 😂 mundo'), '[emoji] hola [emoji] mundo')

  // Texto normal en español (con acentos y ñ, dentro de Latin-1) no debe
  // modificarse en absoluto.
  const textoNormal = 'María tiene 12 manzanas, compra 8 más y regala 5. ¿Cuántas le quedan?'
  assert.equal(sanitizarTextoPdf(textoNormal), textoNormal)

  // Saltos de línea y tabs deben preservarse (se usan para formatear el
  // anexo de evidencia con múltiples campos por línea).
  const multilinea = 'Materia: Algebra 1\nTema: Ecuaciones\nRespuesta: 27 manzanas'
  assert.equal(sanitizarTextoPdf(multilinea), multilinea)

  // Debe aplicarse recursivamente sobre arreglos (como los que produce
  // doc.splitTextToSize antes de pasarlos a doc.text).
  assert.deepEqual(
    sanitizarTextoPdf(['línea normal', 'con emoji 😀 aquí']),
    ['línea normal', 'con emoji [emoji] aquí']
  )

  // Valores no-string (numbers, null, undefined) deben regresar intactos.
  assert.equal(sanitizarTextoPdf(42 as unknown as string), 42)
  assert.equal(sanitizarTextoPdf(null as unknown as string), null)

  console.log('pdf-text smoke passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
