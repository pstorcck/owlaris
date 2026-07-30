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

  // Hallazgo real (QA en vivo, 2026-07-22, reporte de Brenda): una etiqueta
  // estructurada ("Materia: Matemáticas Primaria") salió como "Matemá
  // [emoji]ticas Primaria" en el PDF. La causa probable es un carácter
  // invisible de formato (espacio de ancho cero, marca direccional,
  // selector de variación) incrustado en el nombre de la materia, no un
  // emoji real — esos caracteres deben eliminarse en silencio, no
  // mostrarse como "[emoji]", porque nunca fueron visibles para nadie.
  const zwsp = String.fromCharCode(0x200b)
  const conEspacioAnchoCero = `Matemá${zwsp}ticas Primaria`
  assert.equal(sanitizarTextoPdf(conEspacioAnchoCero), 'Matemáticas Primaria')

  const marcaDireccional = String.fromCharCode(0x200e)
  const selectorVariacion = String.fromCharCode(0xfe0f)
  const bom = String.fromCharCode(0xfeff)
  assert.equal(sanitizarTextoPdf(`Grado: 4to${marcaDireccional} Primaria`), 'Grado: 4to Primaria')
  assert.equal(sanitizarTextoPdf(`${bom}Materia: Matemáticas${selectorVariacion}`), 'Materia: Matemáticas')

  // Un emoji genuino (visible, con codepoint fuera del plano básico) sigue
  // mostrando el marcador "[emoji]" — no se debe perder esa protección.
  const emojiReal = String.fromCodePoint(0x1f605)
  assert.equal(sanitizarTextoPdf(`Comentario: todo bien ${emojiReal}`), 'Comentario: todo bien [emoji]')

  // Hallazgo real (QA en vivo, 2026-07-30, informe de Gabriela Alfaro): el
  // PDF mostró "Owlaris - Matema[emoji]ticas Primaria.md" 18 veces. NO era
  // un carácter invisible como en el caso de Brenda: el nombre del documento
  // de SharePoint trae la "á" DESCOMPUESTA (NFD: "a" + U+0301 acento
  // combinante). La "a" base cae dentro de Latin-1 y sobrevive, pero el
  // acento combinante no, así que quedaba un "[emoji]" en medio de la
  // palabra. Normalizar a NFC lo recompone en "á" (U+00E1).
  const acentoCombinante = String.fromCharCode(0x0301)
  const nfdDescompuesta = `Owlaris - Matema${acentoCombinante}ticas Primaria.md`
  assert.equal(sanitizarTextoPdf(nfdDescompuesta), 'Owlaris - Matemáticas Primaria.md')
  assert.ok(!sanitizarTextoPdf(nfdDescompuesta).includes('[emoji]'))

  const enieDescompuesta = `Ni${String.fromCharCode(0x006e, 0x0303)}o`
  assert.equal(sanitizarTextoPdf(enieDescompuesta), 'Niño')

  // Puntuación tipográfica fuera de Latin-1 que el propio informe usa en sus
  // títulos ("Anexo — miércoles, 29 de julio") salía como "Anexo [emoji]".
  // Se transcribe a su equivalente ASCII, no se marca como emoji.
  const guionLargo = String.fromCharCode(0x2014)
  assert.equal(sanitizarTextoPdf(`Anexo ${guionLargo} miércoles`), 'Anexo - miércoles')

  const comillaIzq = String.fromCharCode(0x201c)
  const comillaDer = String.fromCharCode(0x201d)
  const apostrofo = String.fromCharCode(0x2019)
  const elipsis = String.fromCharCode(0x2026)
  assert.equal(
    sanitizarTextoPdf(`Dijo ${comillaIzq}hola${comillaDer} y no s${apostrofo}e${elipsis}`),
    'Dijo "hola" y no s\'e...'
  )

  const espacioDuro = String.fromCharCode(0x00a0)
  const espacioFino = String.fromCharCode(0x202f)
  assert.equal(sanitizarTextoPdf(`10${espacioDuro}a${espacioFino}15 minutos`), '10 a 15 minutos')

  console.log('pdf-text smoke passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
