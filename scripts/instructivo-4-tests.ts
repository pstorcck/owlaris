// Los 4 casos de prueba ejemplo del instructivo de mejoras ("Convertir los
// casos de prueba en pruebas automáticas"). Cada uno encadena las MISMAS
// funciones reales que preguntar/route.ts usa en producción, con el
// escenario exacto descrito en el instructivo: lo permitido y lo NO
// permitido.
import assert from 'node:assert/strict'
import { matchNumberedListSelection } from '../src/lib/courseTopics'
import { handleMathEvaluation, normalizeStudentAnswer } from '../src/lib/mathSafety'
import { detectarMateriaDesdeTexto, materiaActualEnSistemaCNB, normalizarMateria } from '../src/lib/materiaDetection'
import { isExplicitCourseSwitchRequest } from '../src/lib/courseSwitchDetection'
import { stripUnapprovedExternalResources } from '../src/lib/tutorContext'

async function main() {
  // ── Test 1: lista de temas mostrada, alumno dice "Quiero el 4" ──
  // Permitido: seleccionar el tema 4. NO permitido: corregir la ecuación
  // anterior (la selección de lista tiene prioridad sobre evaluar como
  // respuesta a un ejercicio, incluso si hay uno activo).
  const listaAlgebra = [
    'Podemos trabajar cualquiera de estos temas:',
    '1. Ecuaciones y desigualdades',
    '2. Funciones',
    '3. Sistemas de ecuaciones',
    '4. Polinomios',
    '5. Radicales y exponentes',
  ].join('\n')
  const seleccion = matchNumberedListSelection('Quiero el 4', listaAlgebra)
  assert.equal(seleccion?.tema, 'Polinomios', 'Test 1: debería seleccionar el tema 4 (Polinomios)')
  // "Quiero el 4" sí contiene un número suelto que normalizeStudentAnswer
  // podría leer como respuesta (4) si se evaluara aisladamente — por eso la
  // prioridad NO depende de excluir el texto del parser matemático, sino del
  // ORDEN de los checks en preguntar/route.ts: matchNumberedListSelection se
  // revisa antes que el protocolo matemático, así que nunca llega a
  // evaluarse como intento de respuesta cuando hay una lista reciente.
  assert.equal(normalizeStudentAnswer('Quiero el 4'), 4)

  // ── Test 2: ejercicio activo x + 30 = 61, alumno dice "treinta y uno" ──
  // Permitido: marcarse correcto. NO permitido: marcarse incorrecto.
  const evaluacion = await handleMathEvaluation('Resuelve: x + 30 = 61 [OP: x+30=61]', 'treinta y uno', false)
  assert.equal(evaluacion?.estado, 'correcto', 'Test 2: "treinta y uno" debería marcarse correcto')
  assert.equal(evaluacion?.correctAnswer, 31)

  // ── Test 3: Biología activa, alumno dice "dame genética" ──
  // Permitido: reconocerlo como tema de Biología. NO permitido: decir que
  // no tiene relación con la materia.
  const materiaActiva = 'Biology' // eScholaris, normaliza a "Biología"
  const materiaDetectada = detectarMateriaDesdeTexto('dame genética')
  assert.equal(materiaDetectada, 'Biología', 'Test 3: "genética" debería reconocerse como Biología')
  assert.equal(materiaDetectada, normalizarMateria(materiaActiva), 'Test 3: no debería verse como cambio de materia (ya es Biología)')
  // Tampoco debe interpretarse como una mención explícita de OTRO curso.
  const posibleCambio = isExplicitCourseSwitchRequest('dame genética', ['Biology', 'Chemistry', 'Physics'])
  assert.equal(posibleCambio.detectado, false, 'Test 3: no debería activar un cambio de curso')

  // ── Test 4: Química activa, alumno dice "Dame un video de YouTube del
  // tema 3" ──
  // Permitido: rechazar el recurso externo y ofrecer explicar el tema 3 con
  // contenido oficial. NO permitido: recomendar el enlace o revertir a
  // Algebra (no hay ninguna mención de Algebra que pudiera generar eso).
  assert.equal(materiaActualEnSistemaCNB('Chemistry'), true)
  assert.equal(normalizarMateria('Chemistry'), 'Química')
  // Ninguna palabra de la solicitud coincide con otra materia (p. ej.
  // Matemática/Algebra), así que no hay riesgo estructural de que el
  // sistema "revierta" a otra materia por esta pregunta.
  assert.equal(detectarMateriaDesdeTexto('Dame un video de YouTube del tema 3'), null, 'Test 4: no debería detectar ninguna otra materia (y mucho menos Algebra)')
  // Si el modelo, a pesar del prompt, incluyera un enlace de YouTube en su
  // respuesta, el guard de backend debe limpiarlo y reforzar que se sigue
  // trabajando con el material oficial — nunca recomendar el recurso.
  const respuestaConVideo = stripUnapprovedExternalResources(
    'Aquí tienes un video de YouTube que explica el tema 3: https://www.youtube.com/watch?v=abc123',
    false
  )
  assert.equal(respuestaConVideo.guardActivado, true)
  assert.doesNotMatch(respuestaConVideo.text, /youtube/i)
  assert.match(respuestaConVideo.text, /material oficial/)

  console.log('instructivo-4-tests passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
