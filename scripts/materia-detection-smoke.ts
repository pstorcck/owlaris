import assert from 'node:assert/strict'
import {
  detectarMateriaDesdeTexto,
  esClaseDePracticaDeIngles,
  isLanguageSwitchRequest,
  materiaActualEnSistemaCNB,
  normalizarMateria,
  resolverMateriaRealDisponible,
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
  // "ecosistema", "biodiversidad" y "planta" son excepciones conocidas y
  // aceptadas: aparecen tal cual en Biología Y en Ciencias Naturales
  // (temas legítimamente compartidos, no un error de substring — ver
  // hallazgo real de "planta"/"crecimiento" más abajo), así que gana la
  // primera materia en orden de declaración.
  const EXCEPCIONES_CONOCIDAS = new Set(['ecosistema', 'biodiversidad', 'planta'])
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

  // Hallazgo real (QA 2026-07-14): al elegir "Olimpiadas" y luego
  // "Biología" desde el sidebar, se envía el compuesto "Olimpiadas -
  // Biología" de una sola vez — normalizarMateria debe reconocer la
  // materia específica ya incluida en el texto, no solo la palabra
  // "Olimpiadas" sola (eso hacía que preguntar/route.ts volviera a
  // preguntar "¿de cuál materia?" pese a que el alumno ya la había
  // elegido).
  assert.equal(normalizarMateria('Olimpiadas - Biología'), 'Olimpiadas - Biología')
  assert.equal(normalizarMateria('Olimpiadas - Matemática'), 'Olimpiadas - Matemática')
  assert.equal(normalizarMateria('Olimpiadas - Física'), 'Olimpiadas - Física')
  assert.equal(normalizarMateria('Olimpiadas - Química'), 'Olimpiadas - Química')
  assert.equal(normalizarMateria('Olimpiadas - Ciencias Naturales'), 'Olimpiadas - Ciencias Naturales')
  // Sin materia específica, sigue devolviendo el sentinel genérico.
  assert.equal(normalizarMateria('Olimpiadas'), '__OLIMPIADAS__')

  // Hallazgo real (QA 100 pruebas, 2026-07-14): el candado de tema
  // ofrecía cambiar a "Biología" (categoría CNB genérica) para una cuenta
  // eScholaris de Grado 8 cuya materia real disponible es "Science Grade
  // 8" — "Biología" es exclusiva de Grado 10 en esa cuenta y no existe
  // como opción real para el alumno. resolverMateriaRealDisponible debe
  // preferir la materia real disponible sobre la categoría genérica.
  assert.equal(
    resolverMateriaRealDisponible('Biología', ['Math Grade 8', 'Science Grade 8', 'English Grade 8']),
    'Science Grade 8'
  )
  assert.equal(
    resolverMateriaRealDisponible('Física', ['Math Grade 10', 'Physical Science Grade 10']),
    'Physical Science Grade 10'
  )
  assert.equal(
    resolverMateriaRealDisponible('Matemática', ['Math Grade 8', 'Science Grade 8']),
    'Math Grade 8'
  )
  // Cuenta Mineduc/CNB: la materia real disponible SÍ usa el nombre CNB
  // literal — se prefiere la coincidencia exacta sobre la búsqueda por
  // palabra clave.
  assert.equal(
    resolverMateriaRealDisponible('Biología', ['Matemática', 'Biología', 'Física']),
    'Biología'
  )
  // Sin lista de materias disponibles (o sin ninguna coincidencia), se
  // conserva la categoría genérica — mismo comportamiento que antes, sin
  // regresión.
  assert.equal(resolverMateriaRealDisponible('Biología', []), 'Biología')
  assert.equal(resolverMateriaRealDisponible('Historia', ['Math Grade 8', 'Science Grade 8']), 'Historia')

  // Hallazgo real (QA en vivo, 2026-07-14, cuenta Paul): en Biology
  // (Grado 10), tras un ejercicio sobre "preguntas científicas, evidencia
  // y modelos", el tutor pidió un ejemplo de pregunta científica — el
  // alumno respondió con un ejemplo genuino de Biología ("¿cómo afecta la
  // cantidad de agua diaria al crecimiento de una planta de frijol
  // durante cuatro semanas?"), y el candado de materia lo marcó como un
  // tema de "Ciencias Naturales" en vez de reconocerlo como Biología —
  // "planta"/"crecimiento" no estaban en la lista de Biología, solo en la
  // de Ciencias Naturales. Con las palabras agregadas, debe detectarse
  // como Biología (no dispara el candado).
  assert.equal(
    detectarMateriaDesdeTexto('¿Cómo afecta la cantidad de agua diaria al crecimiento de una planta de frijol durante cuatro semanas?'),
    'Biología'
  )
  assert.equal(
    detectarMateriaDesdeTexto('¿Cómo afecta la cantidad de agua diaria al crecimiento de una planta de frijol durante cuatro semanas?', 'Biología'),
    null,
    'coincide también con la materia activa (Biología) — no debe verse como cambio'
  )

  // Defensa general (no solo este caso puntual): si el mensaje coincide
  // con palabras clave de la materia ACTIVA, detectarMateriaDesdeTexto no
  // debe devolver una materia distinta, aunque el mensaje TAMBIÉN
  // coincida con el vocabulario de otra materia con dominio superpuesto.
  assert.equal(
    detectarMateriaDesdeTexto('quiero hablar de la nutrición de las plantas y el ecosistema', 'Ciencias Naturales'),
    null,
    'coincide con Ciencias Naturales (materia activa) — no debe ofrecer cambio aunque también toque vocabulario de Biología'
  )
  // Sin materia activa que coincida, el comportamiento normal de detección
  // sigue funcionando igual que antes (sin regresión).
  assert.equal(
    detectarMateriaDesdeTexto('quiero entender la revolución francesa', 'Biología'),
    'Historia',
    'un cambio real de materia (que no coincide con la activa) debe seguir detectándose'
  )

  // Hallazgo real (QA en vivo, 2026-07-16, cuenta Paul): en "Comunicación y
  // Lenguaje Idioma Español", el alumno seleccionó el tema oficial "Signo
  // lingüístico, funciones, dialectos y paralenguaje" directamente de la
  // lista de temas que Owlaris acababa de mostrarle — pero "funciones"
  // (también vocabulario típico de Matemática) disparó un falso candado
  // sugiriendo cambiar a Matemática, en un tema 100% de Lenguaje. Ninguna
  // palabra de vocabulario lingüístico ("lingüístico", "paralenguaje",
  // "dialecto") estaba en la lista de Español para que la materia activa
  // absorbiera la coincidencia antes de llegar a "funciones".
  assert.equal(
    detectarMateriaDesdeTexto('Signo lingüístico, funciones, dialectos y paralenguaje', 'Español'),
    null,
    'un tema oficial de Lenguaje no debe disparar el candado de Matemática solo por "funciones"'
  )

  // Hallazgo real (QA en vivo, 2026-07-19, 1ero y 2do Básico): un ejercicio
  // de ESCRITURA que el propio tutor asignó en Comunicación y Lenguaje ("tu
  // animal favorito", "un árbol con pájaros") se marcó como posible cambio
  // a Ciencias Naturales solo porque la respuesta del alumno —al responder
  // exactamente lo pedido— mencionaba esas palabras. Las materias de
  // lenguaje/escritura son temáticamente libres por diseño: el vocabulario
  // de contenido de la respuesta nunca es señal confiable de cambio de
  // materia ahí, a diferencia de Matemática/Ciencias/Historia.
  assert.equal(
    detectarMateriaDesdeTexto('Mi animal favorito es el perro porque es muy leal y juguetón.', 'Español'),
    null,
    'un ejercicio de escritura sobre un animal no debe disparar el candado de Ciencias Naturales en una materia de lenguaje'
  )
  assert.equal(
    detectarMateriaDesdeTexto('Había un árbol grande donde vivían muchos pájaros felices.', 'Español'),
    null,
    'un texto de comprensión lectora sobre un árbol con pájaros no debe disparar el candado en una materia de lenguaje'
  )
  // El vocabulario SÍ debe seguir importando en materias de contenido (no de
  // lenguaje/escritura) — sin regresión para Ciencias Sociales, Matemática,
  // etc.
  assert.equal(
    detectarMateriaDesdeTexto('quiero entender la fotosíntesis', 'Ciencias Sociales'),
    'Biología',
    'fuera de una materia de lenguaje, el vocabulario de contenido sigue siendo una señal válida de cambio'
  )

  // Hallazgo real (QA en vivo, 2026-07-22, Listening & Speaking, cuenta
  // Paul): con el interruptor de idioma en Español, el tutor generó un
  // diálogo de práctica completo en español para una clase de práctica de
  // inglés. esClaseDePracticaDeIngles identifica estas clases para que
  // route.ts pueda instruir que el CONTENIDO de práctica vaya en inglés
  // aunque las explicaciones del tutor vayan en español.
  assert.equal(esClaseDePracticaDeIngles('Listening & Speaking'), true)
  assert.equal(esClaseDePracticaDeIngles('Public Speaking'), true)
  assert.equal(esClaseDePracticaDeIngles('English II'), true)
  assert.equal(esClaseDePracticaDeIngles('Grammar'), true)
  assert.equal(esClaseDePracticaDeIngles('Advanced English'), true)
  assert.equal(esClaseDePracticaDeIngles('Inglés'), true)
  // No debe activarse para materias sin relación con inglés, incluyendo
  // otras materias de lenguaje/comunicación en español.
  assert.equal(esClaseDePracticaDeIngles('Comunicación y Lenguaje Idioma Español'), false)
  assert.equal(esClaseDePracticaDeIngles('Ciencias Sociales y Formación Ciudadana'), false)
  assert.equal(esClaseDePracticaDeIngles('Matemáticas'), false)

  console.log('materia-detection smoke passed')
}

main()
