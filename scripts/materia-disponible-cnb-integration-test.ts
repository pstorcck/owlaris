// Prueba de integración del chequeo de disponibilidad agregado al camino de
// cambio de materia basado en palabras clave CNB en preguntar/route.ts.
// Hallazgo real (QA 80 pruebas, 2026-07-08): en Grado 12 (solo con
// "Environmental Systems" configurada), al decir "mejor hablemos de
// matemáticas" el tutor confirmaba "Claro, cambiamos a Matemática" sin
// verificar que esa materia existiera realmente para el grado del alumno —
// no había ningún botón ni contenido detrás de esa confirmación. Este
// script replica la misma decisión que ahora toma route.ts para verificar
// el comportamiento sin depender de credenciales de Supabase/OpenAI.
import assert from 'node:assert/strict'
import { normalizarMateria } from '../src/lib/materiaDetection'

const MATERIAS_KEYWORDS = ['matemática','matematica','física','fisica','química','quimica','biología','biologia','historia','español','espanol','inglés','ingles','ciencias naturales','mineduc','olimpiadas']

function decidirCambioMateriaCNB(pregunta: string, materiaActivaId: string, materiasDisponibles: string[]) {
  const preguntaLow = pregunta.toLowerCase()
  const cambioExplicito = /(?:quiero estudiar|cambia(?:mos)? a|ahora estudiemos|vamos con)\s+(.+)/i.exec(pregunta)
  const mencionaMateria = MATERIAS_KEYWORDS.some((m) => preguntaLow.includes(m))
  if (!cambioExplicito || !mencionaMateria) return { cambia: false, rechazadoPorDisponibilidad: false, nuevaMateria: null }
  const nuevaMateria = normalizarMateria(cambioExplicito[1].trim())
  if (!nuevaMateria || nuevaMateria === normalizarMateria(materiaActivaId) || nuevaMateria.startsWith('__')) {
    return { cambia: false, rechazadoPorDisponibilidad: false, nuevaMateria: null }
  }
  const materiaRealmenteDisponible = materiasDisponibles.length === 0 ||
    materiasDisponibles.some((m) => normalizarMateria(m) === nuevaMateria || m.toLowerCase() === nuevaMateria.toLowerCase())
  if (!materiaRealmenteDisponible) return { cambia: false, rechazadoPorDisponibilidad: true, nuevaMateria }
  return { cambia: true, rechazadoPorDisponibilidad: false, nuevaMateria }
}

function main() {
  // Grado 12 solo tiene "Environmental Systems" configurada — pedir
  // Matemática ya NO debe confirmarse como si existiera.
  const grado12 = decidirCambioMateriaCNB('cambiamos a matemáticas', 'Environmental Systems', ['Environmental Systems'])
  assert.equal(grado12.cambia, false)
  assert.equal(grado12.rechazadoPorDisponibilidad, true)
  assert.equal(grado12.nuevaMateria, 'Matemática')

  // Un colegio CNB normal, donde Física sí está entre las disponibles,
  // debe seguir confirmando el cambio con normalidad (no regresión).
  const cnbNormal = decidirCambioMateriaCNB('cambiamos a física', 'Matemática', ['Matemática', 'Física', 'Química', 'Biología'])
  assert.equal(cnbNormal.cambia, true)
  assert.equal(cnbNormal.nuevaMateria, 'Física')

  // Sin lista de materias disponibles en el body (clientes antiguos o
  // llamadas sin ese campo) debe seguir permitiendo el cambio, no bloquear
  // todo por falta de datos.
  const sinLista = decidirCambioMateriaCNB('cambiamos a física', 'Matemática', [])
  assert.equal(sinLista.cambia, true)

  // Ya estar en la materia mencionada no debe generar ningún cambio.
  const sinCambio = decidirCambioMateriaCNB('quiero estudiar matemática', 'Matemática', ['Matemática'])
  assert.equal(sinCambio.cambia, false)
  assert.equal(sinCambio.rechazadoPorDisponibilidad, false)

  console.log('materia-disponible-cnb integration test passed')
}

main()
