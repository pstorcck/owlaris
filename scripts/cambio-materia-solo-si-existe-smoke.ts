// Hallazgo real (reporte del usuario, 2026-08-04, Ciencias 3ero Básico): el
// alumno eligió Ciencias por el chip, preguntó sobre velocidad y tiempo, y el
// tutor le ofreció cambiarse a "Física" — una clase que en 3ero Básico ni
// siquiera existe en su colegio.
//
// Dos causas independientes:
//   1. resolverMateriaRealDisponible devolvía la categoría detectada aunque NO
//      estuviera entre las materias del alumno (el `|| categoriaDetectada`).
//      Ofrecer un cambio a una clase que no existe nunca es correcto.
//   2. Ciencias Naturales es la materia PARAGUAS: Física, Química y Biología
//      son ramas suyas, sobre todo en básicos. Que una pregunta de velocidad
//      "parezca de Física" no es motivo para sacar al alumno de Ciencias.
import assert from 'node:assert/strict'
import {
  materiaParaOfrecerCambio,
  esMateriaParaguasDeCiencias,
} from '../src/lib/materiaDetection'

// Materias típicas de 3ero Básico: no hay Física, Química ni Biología sueltas.
const CHIPS_TERCERO = [
  'Ciencias Naturales',
  'Matemática',
  'Comunicación y Lenguaje',
  'Ciencias Sociales y Formación Ciudadana',
  'Inglés',
]

function main() {
  // El caso exacto del reporte.
  assert.equal(
    materiaParaOfrecerCambio('Física', 'Ciencias Naturales', CHIPS_TERCERO), null,
    'no debe ofrecerse Física desde Ciencias Naturales: es una rama suya y además no existe en el grado'
  )

  // Las otras dos ramas, por el mismo motivo.
  for (const rama of ['Química', 'Biología']) {
    assert.equal(
      materiaParaOfrecerCambio(rama, 'Ciencias Naturales', CHIPS_TERCERO), null,
      `${rama} es una rama de Ciencias Naturales, no un cambio de materia`
    )
  }

  // Y en inglés, donde la materia paraguas se llama Science.
  assert.equal(
    materiaParaOfrecerCambio('Física', 'Science Primaria', CHIPS_TERCERO), null,
    'Science también es materia paraguas'
  )

  // Nunca se ofrece una materia que el alumno no tiene, aunque no venga de
  // ciencias.
  assert.equal(
    materiaParaOfrecerCambio('Biología', 'Matemática', CHIPS_TERCERO), null,
    'no debe ofrecerse una clase que no está entre las materias del alumno'
  )

  // Lo que SÍ debe seguir funcionando: un cambio real a una materia que existe.
  assert.equal(
    materiaParaOfrecerCambio('Matemática', 'Ciencias Naturales', CHIPS_TERCERO), 'Matemática',
    'un cambio legítimo a una materia disponible debe seguir ofreciéndose'
  )
  assert.equal(
    materiaParaOfrecerCambio('Inglés', 'Matemática', CHIPS_TERCERO), 'Inglés',
    'un cambio legítimo a Inglés debe seguir ofreciéndose'
  )

  // Sin lista de materias no se puede comprobar nada: se conserva el
  // comportamiento anterior en vez de bloquear todos los cambios.
  assert.equal(
    materiaParaOfrecerCambio('Biología', 'Matemática', []), 'Biología',
    'sin lista disponible no se bloquea el cambio'
  )

  // "Ciencias Sociales" contiene "ciencias" pero NO es la materia paraguas de
  // las ciencias naturales: un cambio desde ahí a Biología sí es real.
  assert.equal(
    esMateriaParaguasDeCiencias('Ciencias Sociales y Formación Ciudadana'), false,
    'Ciencias Sociales no es la materia paraguas de ciencias naturales'
  )

  console.log('cambio-materia-solo-si-existe smoke passed')
}

main()
