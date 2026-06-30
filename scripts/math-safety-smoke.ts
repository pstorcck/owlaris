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
  assert.equal(wrong?.correctAnswer, 16)
  assert.match(wrong?.feedback || '', /Todavía no llegamos|No te voy/i)
  assert.doesNotMatch(wrong?.feedback || '', /16/)

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
  assert.doesNotMatch(combinedWrong?.feedback || '', /\b13\b/)

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

  const simpleEquation = await handleMathEvaluation('Resuelve: x + 5 = 12 [OP: x+5=12]', 'x = 7', false)
  assert.equal(simpleEquation?.estado, 'correcto')
  assert.equal(simpleEquation?.correctAnswer, 7)

  const parenthesisEquation = await handleMathEvaluation('Resuelve: 2(x + 3) = 18 [OP: 2(x+3)=18]', '6', false)
  assert.equal(parenthesisEquation?.estado, 'correcto')
  assert.equal(parenthesisEquation?.correctAnswer, 6)

  const bothSidesEquation = await handleMathEvaluation('Resuelve: 5x + 3 = 2x + 15 [OP: 5x+3=2x+15]', '4', false)
  assert.equal(bothSidesEquation?.estado, 'correcto')
  assert.equal(bothSidesEquation?.correctAnswer, 4)

  const inferredEquation = inferCanonicalOperationFromText('Ahora resuelve: 2*x - 4 = 10. ¿Cuánto vale x?')
  assert.equal(inferredEquation, '2*x-4=10')
  assert.equal(solveOperation(inferredEquation), 7)

  const multipleChoicePrompt = `¿Cuánto es 20 - 4 * 2?
A) 16
B) 12
C) 8
D) 10
[OP: 20-4*2]`
  const multipleChoiceCorrect = await handleMathEvaluation(multipleChoicePrompt, 'B', false)
  assert.equal(multipleChoiceCorrect?.estado, 'correcto')
  assert.equal(multipleChoiceCorrect?.correctAnswer, 12)

  const multipleChoiceWrong = await handleMathEvaluation(multipleChoicePrompt, 'opción A', false)
  assert.equal(multipleChoiceWrong?.estado, 'incorrecto')
  assert.equal(multipleChoiceWrong?.correctAnswer, 12)
  assert.doesNotMatch(multipleChoiceWrong?.feedback || '', /\b12\b/)

  console.log('math-safety smoke passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
