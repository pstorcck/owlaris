// Prueba de integración del bloque de cambio de materia no-CNB agregado a
// preguntar/route.ts (instructivo de mejoras, punto 12/24). Replica la
// misma decisión que toma el route (isExplicitCourseSwitchRequest +
// comparación normalizada contra la materia activa) para verificar el
// comportamiento de extremo a extremo sin depender de credenciales de
// Supabase/OpenAI.
import assert from 'node:assert/strict'
import { isExplicitCourseSwitchRequest } from '../src/lib/courseSwitchDetection'
import { normalizarMateria } from '../src/lib/materiaDetection'

function decidirCambioMateriaNoCNB(pregunta: string, materiaActivaId: string, materiasDisponibles: string[]) {
  const cursoExplicito = isExplicitCourseSwitchRequest(pregunta, materiasDisponibles)
  if (
    cursoExplicito.detectado &&
    cursoExplicito.coincideDisponible &&
    normalizarMateria(cursoExplicito.coincideDisponible) !== normalizarMateria(materiaActivaId) &&
    cursoExplicito.coincideDisponible.toLowerCase() !== materiaActivaId.toLowerCase()
  ) {
    return { cambia: true, nuevaMateria: cursoExplicito.coincideDisponible }
  }
  return { cambia: false, nuevaMateria: null }
}

function main() {
  const materiasDisponibles = ['Algebra 2', 'Geometry', 'Biology Grade 10', 'Science Grade 8']

  // Bug real confirmado: alumno en Algebra 2 (curso granular eScholaris, no
  // pertenece al set CNB) con una ecuación activa pide un curso distinto por
  // nombre completo — debe cambiar de materia, nunca evaluarse como
  // respuesta al ejercicio (eso ya lo garantiza normalizeStudentAnswer,
  // aquí se verifica que la materia sí cambie).
  const cambio = decidirCambioMateriaNoCNB('Dime los temas de Science Grade 8', 'Algebra 2', materiasDisponibles)
  assert.equal(cambio.cambia, true)
  assert.equal(cambio.nuevaMateria, 'Science Grade 8')

  // Ya estar en la materia mencionada no debe generar un cambio inútil.
  const sinCambio = decidirCambioMateriaNoCNB('Enséñame el curso de Algebra 2', 'Algebra 2', materiasDisponibles)
  assert.equal(sinCambio.cambia, false)

  // Curso mencionado que NO está entre las materias disponibles del alumno
  // no debe generar un cambio silencioso a algo inexistente.
  const cursoInexistente = decidirCambioMateriaNoCNB('Cambia a Chemistry Grade 9', 'Algebra 2', materiasDisponibles)
  assert.equal(cursoInexistente.cambia, false)

  // Mensaje sin mención de curso no debe activar nada.
  const sinMencion = decidirCambioMateriaNoCNB('¿Cuánto es 24 / 3 + 5?', 'Algebra 2', materiasDisponibles)
  assert.equal(sinMencion.cambia, false)

  console.log('route-course-switch integration test passed')
}

main()
