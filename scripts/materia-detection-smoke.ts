import assert from 'node:assert/strict'
import {
  detectarMateriaDesdeTexto,
  materiaActualEnSistemaCNB,
  normalizarMateria,
} from '../src/lib/materiaDetection'

function main() {
  // Montano/CNB: la materia activa SÍ está en el set cerrado en español.
  assert.equal(materiaActualEnSistemaCNB('Matemática'), true)
  assert.equal(materiaActualEnSistemaCNB('Biología'), true)
  assert.equal(materiaActualEnSistemaCNB('Física'), true)

  // eScholaris: "Biology"/"Physics"/"Chemistry" normalizan a una materia CNB
  // (mismo tema, otro idioma) — deben quedar dentro del set.
  assert.equal(materiaActualEnSistemaCNB('Biology'), true)
  assert.equal(materiaActualEnSistemaCNB('Physics'), true)
  assert.equal(materiaActualEnSistemaCNB('Chemistry'), true)

  // eScholaris: ramas de matemática con nombre propio que NO contienen la
  // palabra "math"/"matemática" — no deben tratarse como si pertenecieran a
  // ninguna de las 8 materias en español (a diferencia de "Math Grade 6",
  // que sí contiene "math" y legítimamente cae dentro de esa materia).
  assert.equal(materiaActualEnSistemaCNB('Geometry'), false)
  assert.equal(materiaActualEnSistemaCNB('Algebra I'), false)
  assert.equal(materiaActualEnSistemaCNB('Algebra II'), false)
  assert.equal(materiaActualEnSistemaCNB(''), false)

  // Bug real: un alumno de eScholaris en "Biology" que menciona "genética"
  // no debe verse como un cambio de materia — normalizarMateria("Biology")
  // ya da "Biología", igual que detectarMateriaDesdeTexto sobre el mensaje.
  const materiaActual = 'Biology'
  const materiaDetectada = detectarMateriaDesdeTexto('¿cómo funciona la genética en los cromosomas?')
  assert.equal(materiaDetectada, 'Biología')
  assert.equal(normalizarMateria(materiaActual), 'Biología')
  assert.equal(materiaDetectada, normalizarMateria(materiaActual), 'no debería verse como cambio de materia')

  // Bug real: un alumno de "Geometry" que menciona "ecuaciones" — la materia
  // activa no está en el set CNB, así que la detección de cambio no debe
  // aplicar (aunque detectarMateriaDesdeTexto sí devuelva "Matemática").
  assert.equal(detectarMateriaDesdeTexto('necesito resolver estas ecuaciones del triángulo'), 'Matemática')
  assert.equal(materiaActualEnSistemaCNB('Geometry'), false)

  // Cambio real entre dos materias CNB SÍ debe seguir detectándose.
  assert.equal(materiaActualEnSistemaCNB('Historia'), true)
  assert.equal(detectarMateriaDesdeTexto('quiero entender la revolución francesa'), 'Historia')
  assert.notEqual(detectarMateriaDesdeTexto('quiero entender la fotosíntesis'), normalizarMateria('Historia'))

  console.log('materia-detection smoke passed')
}

main()
