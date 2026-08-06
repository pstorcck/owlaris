// Hallazgo real (QA semanal en vivo, 2026-07-31, Química — Americano): ante
// una estequiometría correcta (34 g de NH₃) el tutor respondió con una pista
// genérica de primaria y el adjunto salió como "Owlaris - Física.md". Se
// reprodujo en sesión NUEVA con Química como primera materia, sin tocar
// Física, y el adjunto salió igual — así que no es arrastre de contexto: el
// índice de contenido de Química trae un archivo de Física.
//
// La causa de fondo es de organización del contenido en SharePoint y se
// arregla ahí. Este test fija la red de seguridad del código: cuando hay
// material de la materia pedida, un documento que declara pertenecer a OTRA
// materia no debe competir por ser el elegido.
import assert from 'node:assert/strict'
import { preferirArchivosDeMateria } from '../src/lib/sharepointFolders'

const doc = (nombre: string) => ({ nombre })
const nombres = (indice: { nombre: string }[]) => indice.map((d) => d.nombre)

function main() {
  // El caso del QA: si además del archivo de Física hay material de Química,
  // el de Física queda fuera.
  const conMaterialPropio = [
    doc('Owlaris - Física.md'),
    doc('Owlaris - Química.md'),
  ]
  assert.deepEqual(
    nombres(preferirArchivosDeMateria(conMaterialPropio, 'Química')),
    ['Owlaris - Química.md'],
    'un documento de Física no debe competir cuando existe material de Química'
  )

  // Los nombres neutros no declaran materia: no hay motivo para descartarlos.
  const conNeutros = [
    doc('Owlaris - Física.md'),
    doc('Owlaris - Química.md'),
    doc('Unidad 3 - ejercicios.docx'),
  ]
  assert.deepEqual(
    nombres(preferirArchivosDeMateria(conNeutros, 'Química')),
    ['Owlaris - Química.md', 'Unidad 3 - ejercicios.docx'],
    'los archivos de nombre neutro se conservan'
  )

  // Si NO hay nada de la materia pedida, no se descarta nada: quedarse sin
  // índice sería peor, y es justo el caso de una carpeta paraguas como
  // "Ciencias Naturales" cuyos archivos se llaman por su rama.
  const soloOtraMateria = [doc('Owlaris - Física.md'), doc('Owlaris - Biología.md')]
  assert.deepEqual(
    nombres(preferirArchivosDeMateria(soloOtraMateria, 'Química')),
    ['Owlaris - Física.md', 'Owlaris - Biología.md'],
    'sin material propio no se descarta nada'
  )

  const cienciasNaturales = [doc('Owlaris - Biología.md'), doc('Owlaris - Física.md')]
  assert.deepEqual(
    nombres(preferirArchivosDeMateria(cienciasNaturales, 'Ciencias Naturales')),
    ['Owlaris - Biología.md', 'Owlaris - Física.md'],
    'una carpeta paraguas conserva sus ramas'
  )

  // Un solo documento nunca se descarta, aunque sea de otra materia: es lo
  // único que hay y el comportamiento previo se conserva tal cual.
  assert.deepEqual(
    nombres(preferirArchivosDeMateria([doc('Owlaris - Física.md')], 'Química')),
    ['Owlaris - Física.md'],
    'con un único documento no se cambia el comportamiento'
  )

  console.log('contenido-materia-cruzada smoke passed')
}

main()
