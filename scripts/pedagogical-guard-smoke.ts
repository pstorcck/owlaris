import assert from 'node:assert/strict'
import { guardNoFinalAnswer, shouldGuideWithoutFinalAnswer } from '../src/lib/pedagogicalGuard'

function main() {
  assert.equal(shouldGuideWithoutFinalAnswer({
    pregunta: 'Resuelve 24 / 3 + 5',
    tipoPregunta: 'academica',
    materiaNumerica: true,
  }), true)

  const guardedMath = guardNoFinalAnswer(
    'Incorrecto. El resultado correcto es 13. Intenta de nuevo.',
    {
      pregunta: 'Resuelve 24 / 3 + 5',
      tipoPregunta: 'academica',
      materiaNumerica: true,
    }
  )
  assert.equal(guardedMath.guardActivado, true)
  assert.doesNotMatch(guardedMath.text, /resultado correcto|13/i)
  assert.match(guardedMath.text, /No te voy a dar la respuesta final/i)

  const directRequest = guardNoFinalAnswer(
    'La respuesta correcta es fotosíntesis. Copia eso.',
    {
      pregunta: 'Solo dime la respuesta del ejercicio',
      tipoPregunta: 'academica',
      materiaNumerica: false,
    }
  )
  assert.equal(directRequest.guardActivado, true)
  assert.doesNotMatch(directRequest.text, /fotosíntesis|respuesta correcta/i)

  const verifiedCorrect = guardNoFinalAnswer(
    'Correcto. 16 es la respuesta correcta. ¿Puedes explicar el proceso?',
    {
      pregunta: '16',
      tipoPregunta: 'academica',
      materiaNumerica: true,
      respuestaVerificadaCorrecta: true,
    }
  )
  assert.equal(verifiedCorrect.guardActivado, false)
  assert.match(verifiedCorrect.text, /16/)

  console.log('pedagogical-guard smoke passed')
}

main()
