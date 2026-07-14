import assert from 'node:assert/strict'
import {
  detectarPatronErrores,
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

  // Hallazgo real (QA 2026-07-14): "Noté un patrón: la mayoría de tus
  // errores recientes fueron en X" se decía incluso con UN SOLO error
  // registrado — un solo dato nunca es "la mayoría" de nada.
  // detectarPatronErrores expone el conteo real para que quien arme el
  // mensaje pueda decidir si de verdad hay un patrón.
  const unSoloError = [{ tema_detectado: 'Suma y resta', operacion_canonica: '39+15' }]
  const patronUnSolo = detectarPatronErrores(unSoloError)
  assert.deepEqual(patronUnSolo, { tema: 'Suma y resta', conteo: 1, totalConTema: 1 })
  // conteo=1 no es una mayoría real — quien consuma esto no debe decir
  // "la mayoría de tus errores" con un solo dato.
  assert.equal(patronUnSolo!.conteo >= 2 && patronUnSolo!.conteo > patronUnSolo!.totalConTema / 2, false)

  const patronReal = detectarPatronErrores(errores)
  assert.deepEqual(patronReal, { tema: 'Suma y resta', conteo: 2, totalConTema: 3 })
  // conteo=2 de 3 SÍ es una mayoría real (más de la mitad).
  assert.equal(patronReal!.conteo >= 2 && patronReal!.conteo > patronReal!.totalConTema / 2, true)

  // Errores sin ninguna repetición (cada tema aparece una sola vez) tampoco
  // es un patrón real, aunque haya varios errores en total.
  const sinRepeticion = [
    { tema_detectado: 'Suma y resta', operacion_canonica: '39+15' },
    { tema_detectado: 'Fracciones', operacion_canonica: '1/2+1/3' },
    { tema_detectado: 'Ecuaciones', operacion_canonica: 'x+5=12' },
  ]
  const patronSinRepeticion = detectarPatronErrores(sinRepeticion)
  assert.equal(patronSinRepeticion!.conteo, 1)
  assert.equal(patronSinRepeticion!.conteo > patronSinRepeticion!.totalConTema / 2, false)

  assert.equal(detectarPatronErrores([]), null)

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
