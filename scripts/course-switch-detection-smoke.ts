import assert from 'node:assert/strict'
import {
  extractExplicitCourseMention,
  isExplicitCourseSwitchRequest,
  looksLikeCourseOrGradeName,
  matchesAvailableCourse,
} from '../src/lib/courseSwitchDetection'

function main() {
  assert.equal(looksLikeCourseOrGradeName('Science Grade 8'), true)
  assert.equal(looksLikeCourseOrGradeName('Biology Grade 10'), true)
  assert.equal(looksLikeCourseOrGradeName('Geometry'), true)
  assert.equal(looksLikeCourseOrGradeName('Algebra 2'), true)
  assert.equal(looksLikeCourseOrGradeName('Math Grade 6'), true)
  assert.equal(looksLikeCourseOrGradeName('no se, ayuda'), false)
  assert.equal(looksLikeCourseOrGradeName(''), false)

  assert.equal(extractExplicitCourseMention('Dime los temas de Science Grade 8'), 'Science Grade 8')
  assert.equal(extractExplicitCourseMention('Quiero ver Biology Grade 10'), 'Biology Grade 10')
  assert.equal(extractExplicitCourseMention('Cambia a Geometry'), 'Geometry')
  assert.equal(extractExplicitCourseMention('Dame los temas de Math Grade 6'), 'Math Grade 6')
  assert.equal(extractExplicitCourseMention('Quiero practicar Science'), 'Science')
  assert.equal(extractExplicitCourseMention('Enséñame el curso de Algebra 2'), 'Algebra 2')

  // Sin nombre de curso reconocible después de la frase disparadora, no debe
  // inventar una mención (evita falsos positivos con "quiero practicar" a
  // secas, que se maneja como solicitud general en otro lugar).
  assert.equal(extractExplicitCourseMention('Quiero practicar'), null)
  assert.equal(extractExplicitCourseMention('Quiero estudiar un rato'), null)
  assert.equal(extractExplicitCourseMention('¿Cuánto es 24 / 3 + 5?'), null)

  const disponibles = ['Algebra 2', 'Geometry', 'Biology Grade 10', 'Science Grade 8']
  assert.equal(matchesAvailableCourse('Science Grade 8', disponibles), 'Science Grade 8')
  assert.equal(matchesAvailableCourse('geometry', disponibles), 'Geometry')
  assert.equal(matchesAvailableCourse('Chemistry Grade 9', disponibles), null)

  const conocido = isExplicitCourseSwitchRequest('Dime los temas de Science Grade 8', disponibles)
  assert.equal(conocido.detectado, true)
  assert.equal(conocido.coincideDisponible, 'Science Grade 8')

  const desconocido = isExplicitCourseSwitchRequest('Cambia a Chemistry Grade 9', disponibles)
  assert.equal(desconocido.detectado, true)
  assert.equal(desconocido.coincideDisponible, null)

  const sinMencion = isExplicitCourseSwitchRequest('¿Cuánto es 5 + 3?', disponibles)
  assert.equal(sinMencion.detectado, false)

  console.log('course-switch-detection smoke passed')
}

main()
