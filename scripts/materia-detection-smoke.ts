import assert from 'node:assert/strict'
import {
  detectarMateriaDesdeTexto,
  isLanguageSwitchRequest,
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

  // Hallazgo real (reporte de un maestro, 2026-07-08): un problema de
  // aplicación de Matemática que menciona "velocidad" y "tiempo" no debe
  // detectarse como un cambio de tema hacia Física — es un ejercicio de
  // álgebra legítimo (despejar una variable en distancia = velocidad * tiempo).
  assert.equal(
    detectarMateriaDesdeTexto('tendriamos que encontrar la distancia que recorio multiplicando la velocidad y el timepo sabemos que la velocidad es de 20 como podrias sacar el timepo'),
    null,
    '"velocidad" por sí sola no debería activar un cambio de materia a Física'
  )
  assert.equal(detectarMateriaDesdeTexto('necesito ayuda con mi trabajo de matemática'), null, '"trabajo" no debería detectarse como Física')

  // Hallazgo real CRÍTICO (verificación posterior, 2026-07-12): dos fallas
  // distintas hacían que "responde/explícame en inglés" siguiera
  // confundiéndose con cambiar a la clase de Inglés pese a un fix
  // anterior: (1) el verbo "explica"/"explícame" no estaba cubierto, y
  // (2) la función no le quitaba los acentos al texto, así que
  // "explícame" (con acento) nunca coincidía con un patrón sin acento.
  for (const frase of [
    'responde en inglés',
    'contéstame en inglés por favor',
    '¿me lo explicas en inglés?',
    'explícame esto en inglés',
    'puedes explicarme en inglés',
    '¿me lo puedes decir en inglés?',
    'can you explain this in english?',
    'answer in english please',
  ]) {
    assert.equal(isLanguageSwitchRequest(frase), true, frase)
  }
  assert.equal(isLanguageSwitchRequest('¿qué es la fotosíntesis?'), false)
  assert.equal(isLanguageSwitchRequest(''), false)

  console.log('materia-detection smoke passed')
}

main()
