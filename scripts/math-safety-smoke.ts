import assert from 'node:assert/strict'
import {
  handleMathEvaluation,
  inferCanonicalOperationFromText,
  looksLikeMathPracticePrompt,
  solveOperation,
} from '../src/lib/mathSafety'

async function main() {
  const tutorPrompt = 'La pregunta es: ¿Cuánto es 25 - 9? Intenta resolverlo y dame tu respuesta.'
  const inferred = inferCanonicalOperationFromText(tutorPrompt)

  assert.equal(inferred, '25-9')
  assert.equal(solveOperation(inferred), 16)
  assert.equal(looksLikeMathPracticePrompt(tutorPrompt), true)

  const correct = await handleMathEvaluation(tutorPrompt, '16', false)
  assert.equal(correct?.estado, 'correcto')
  assert.match(correct?.feedback || '', /Correcto|correcta/i)

  const wrong = await handleMathEvaluation(tutorPrompt, '17', false)
  assert.equal(wrong?.estado, 'incorrecto')
  assert.match(wrong?.feedback || '', /16/)

  const explicit = await handleMathEvaluation('¿Cuánto es 25 - 9? [OP: 25-9]', '16', false)
  assert.equal(explicit?.estado, 'correcto')

  const combinedTutorMessage = `Me alegra que hayas aplicado correctamente el orden de operaciones.
En este caso, multiplicaste 3 * 2 para obtener 6 y luego restaste de 15, lo que te dio 9.

Vamos a practicar con otra pregunta:

¿Cuánto es 24 / 3 + 5?`
  const combinedInferred = inferCanonicalOperationFromText(combinedTutorMessage)
  assert.equal(combinedInferred, '24/3+5')
  assert.equal(solveOperation(combinedInferred), 13)

  const combinedCorrect = await handleMathEvaluation(combinedTutorMessage, '13', false)
  assert.equal(combinedCorrect?.estado, 'correcto')
  assert.equal(combinedCorrect?.correctAnswer, 13)

  const combinedWrong = await handleMathEvaluation(combinedTutorMessage, '6', false)
  assert.equal(combinedWrong?.estado, 'incorrecto')
  assert.equal(combinedWrong?.correctAnswer, 13)

  const explainedAnswer = await handleMathEvaluation(
    combinedTutorMessage,
    `Primero hacemos la división:
24 ÷ 3 = 8

Luego sumamos:
8 + 5 = 13

Respuesta: 13`,
    false
  )
  assert.equal(explainedAnswer?.estado, 'correcto')

  console.log('math-safety smoke passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
