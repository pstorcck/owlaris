import assert from 'node:assert/strict'
import {
  detectarMateriaDesdeTexto,
  materiaActualEnSistemaCNB,
  normalizarMateria,
  TEMAS_POR_MATERIA,
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

  // Escaneo exhaustivo: cada palabra clave de cada materia debe clasificarse
  // en SU PROPIA materia, no en otra por colisión de substring — este mismo
  // escaneo encontró el bug real de "revolución" (Historia) confundida con
  // "evolución" (Biología) por un match de substring sin límite de palabra.
  // "ecosistema" y "biodiversidad" son excepciones conocidas y aceptadas:
  // aparecen tal cual en Biología Y en Ciencias Naturales (temas
  // legítimamente compartidos, no un error de substring), así que gana la
  // primera materia en orden de declaración.
  const EXCEPCIONES_CONOCIDAS = new Set(['ecosistema', 'biodiversidad'])
  for (const [materiaEsperada, temas] of Object.entries(TEMAS_POR_MATERIA)) {
    for (const tema of temas) {
      if (EXCEPCIONES_CONOCIDAS.has(tema)) continue
      const detectada = detectarMateriaDesdeTexto(`quiero entender ${tema}`)
      assert.equal(detectada, materiaEsperada, `"${tema}" debería detectarse como ${materiaEsperada}, no ${detectada}`)
    }
  }

  // Instructivo de mejoras, sección K: genética, herencia, alelos, rasgos,
  // anatomía, fisiología, organismos, adn, reproducción y adaptación deben
  // reconocerse como Biología (antes solo "genética" tenía suerte por
  // coincidir con otra palabra en la lista; el resto no estaba cubierto).
  for (const termino of ['gen', 'genes', 'herencia', 'alelo', 'rasgo', 'anatomía', 'fisiología', 'organismos', 'adn', 'reproducción', 'adaptación']) {
    assert.equal(detectarMateriaDesdeTexto(`quiero entender ${termino}`), 'Biología', `"${termino}" debería detectarse como Biología`)
  }

  console.log('materia-detection smoke passed')
}

main()
