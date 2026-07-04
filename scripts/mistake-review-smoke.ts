import assert from 'node:assert/strict'
import {
  isReviewMistakesRequest,
  primeraOperacionValida,
  temaMasFrecuente,
} from '../src/lib/mistakeReview'
import { inferMathPracticeFocusFromOperation } from '../src/lib/mathPractice'

function main() {
  assert.equal(isReviewMistakesRequest('Revisemos mis errores'), true)
  assert.equal(isReviewMistakesRequest('revisemos mis errores.'), true)
  assert.equal(isReviewMistakesRequest('REVISEMOS MIS ERRORES'), true)
  assert.equal(isReviewMistakesRequest("Let's review my mistakes"), true)
  assert.equal(isReviewMistakesRequest('review my errors please'), true)
  assert.equal(isReviewMistakesRequest('quiero practicar'), false)
  assert.equal(isReviewMistakesRequest('resume el tema'), false)

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

  console.log('mistake-review smoke passed')
}

main()
