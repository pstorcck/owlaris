import assert from 'node:assert/strict'
import {
  isReviewMistakesRequest,
  primeraOperacionValida,
  temaMasFrecuente,
} from '../src/lib/mistakeReview'
import { buildNextMathExercise, inferMathPracticeFocusFromOperation } from '../src/lib/mathPractice'
import { buildGuidedMathHint } from '../src/lib/mathSafety'

function main() {
  assert.equal(isReviewMistakesRequest('Revisemos mis errores'), true)
  assert.equal(isReviewMistakesRequest('revisemos mis errores.'), true)
  assert.equal(isReviewMistakesRequest('REVISEMOS MIS ERRORES'), true)
  assert.equal(isReviewMistakesRequest("Let's review my mistakes"), true)
  assert.equal(isReviewMistakesRequest('review my errors please'), true)
  assert.equal(isReviewMistakesRequest('quiero practicar'), false)
  assert.equal(isReviewMistakesRequest('resume el tema'), false)

  // Instrucciones del 13 de julio — la nueva "opción de ayuda" "Revisa lo
  // que hice" debe disparar el mismo flujo que "Revisemos mis errores".
  assert.equal(isReviewMistakesRequest('Revisa lo que hice'), true)
  assert.equal(isReviewMistakesRequest('Review what I did'), true)

  const errores = [
    { tema_detectado: 'Suma y resta', operacion_canonica: '62-13' },
    { tema_detectado: 'Suma y resta', operacion_canonica: null },
    { tema_detectado: 'Ecuaciones', operacion_canonica: 'x+5=12' },
  ]
  assert.equal(temaMasFrecuente(errores), 'Suma y resta')
  assert.equal(primeraOperacionValida(errores), '62-13')
  assert.equal(temaMasFrecuente([]), null)
  assert.equal(primeraOperacionValida([{ tema_detectado: 'x', operacion_canonica: null }]), null)

  // El enfoque derivado del error real debe coincidir con el tipo de
  // operación fallada, no con una palabra clave que el alumno deba repetir.
  assert.equal(inferMathPracticeFocusFromOperation('62-13'), 'resta')
  assert.equal(inferMathPracticeFocusFromOperation('12+7'), 'suma')
  assert.equal(inferMathPracticeFocusFromOperation('6*7'), 'multiplicacion')
  assert.equal(inferMathPracticeFocusFromOperation('40/8'), 'division')
  assert.equal(inferMathPracticeFocusFromOperation('x+5=12'), 'equation')
  assert.equal(inferMathPracticeFocusFromOperation('0.25*80'), 'decimal')
  assert.equal(inferMathPracticeFocusFromOperation('8+3*2'), 'general')

  // ── Hallazgo #6 (auditoría QA 2026-07-07): la pista de "Revisemos mis
  // errores" era idéntica para una ecuación con paréntesis/distribución y
  // para una ecuación con la incógnita en ambos lados — dos errores de
  // naturaleza distinta necesitan una pista distinta.
  const hintParentesis = buildGuidedMathHint('7*(x+5)=119', false)
  const hintAmbosLados = buildGuidedMathHint('8*x+26=2*x+68', false)
  const hintUnPaso = buildGuidedMathHint('x+3=55', false)
  assert.match(hintParentesis, /paréntesis|distribuye/i)
  assert.match(hintAmbosLados, /ambos lados|un mismo lado/i)
  assert.match(hintUnPaso, /operación inversa/i)
  assert.notEqual(hintParentesis, hintAmbosLados)
  assert.notEqual(hintParentesis, hintUnPaso)
  assert.notEqual(hintAmbosLados, hintUnPaso)

  // ── Hallazgo #7 (auditoría QA 2026-07-07): la consulta de errores
  // recientes para "Revisemos mis errores" dependía de materia_uuid (el FK
  // resuelto contra la tabla materias). Cuando no resolvía, la consulta
  // quedaba SIN filtro de materia y mezclaba errores de otras materias o
  // sesiones muy anteriores en el patrón detectado — replica la misma
  // decisión que preguntar/route.ts toma para construir el filtro.
  function decidirFiltroMateriaErrores(materiaUuid: string | null, materiaConsultaSharePoint: string) {
    if (materiaUuid) return { campo: 'materia_id', valor: materiaUuid }
    if (materiaConsultaSharePoint) return { campo: 'materia_nombre_snapshot', valor: materiaConsultaSharePoint }
    return null
  }
  assert.deepEqual(decidirFiltroMateriaErrores('uuid-123', 'Math Grade 8'), { campo: 'materia_id', valor: 'uuid-123' })
  assert.deepEqual(decidirFiltroMateriaErrores(null, 'Math Grade 8'), { campo: 'materia_nombre_snapshot', valor: 'Math Grade 8' })
  assert.equal(decidirFiltroMateriaErrores(null, ''), null)

  // ── Hallazgo #12 (auditoría QA 2026-07-07): tildes faltantes recurrentes
  // en el texto de "ejercicio distinto" ("ecuacion", "Cuanto", "Cual").
  const ejercicioEcuacion = buildNextMathExercise([], 5, false, 'equation')
  assert.match(ejercicioEcuacion.text, /ecuación distinta/)
  assert.match(ejercicioEcuacion.text, /¿Cuánto vale x\?/)
  assert.doesNotMatch(ejercicioEcuacion.text, /ecuacion|Cuanto/)
  const ejercicioAritmetico = buildNextMathExercise([], 3, false, 'suma')
  assert.match(ejercicioAritmetico.text, /¿Cuál es el resultado\?/)
  assert.doesNotMatch(ejercicioAritmetico.text, /\bCual\b/)

  console.log('mistake-review smoke passed')
}

main()
