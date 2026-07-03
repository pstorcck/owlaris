import assert from 'node:assert/strict'
import {
  handleMathEvaluation,
  inferCanonicalOperationFromText,
  isLikelyNumericSubject,
  looksLikeMathPracticePrompt,
  solveOperation,
} from '../src/lib/mathSafety'
import {
  buildPendingContextResponse,
  isPendingContextQuestion,
} from '../src/lib/tutorContext'

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

  const simpleEquationBareAnswer = await handleMathEvaluation('Muy bien, resuelve: x + 5 = 12. ¿Qué valor tiene x? [OP: x+5=12]', '7', false)
  assert.equal(simpleEquationBareAnswer?.estado, 'correcto')
  assert.equal(simpleEquationBareAnswer?.correctAnswer, 7)

  const parenthesisEquation = await handleMathEvaluation('Resuelve: 2(x + 3) = 18 [OP: 2(x+3)=18]', '6', false)
  assert.equal(parenthesisEquation?.estado, 'correcto')
  assert.equal(parenthesisEquation?.correctAnswer, 6)

  const bothSidesEquation = await handleMathEvaluation('Resuelve: 5x + 3 = 2x + 15 [OP: 5x+3=2x+15]', '4', false)
  assert.equal(bothSidesEquation?.estado, 'correcto')
  assert.equal(bothSidesEquation?.correctAnswer, 4)

  const implicitEquationPrompt = 'Resuelve la siguiente ecuación: 3x + 5 = 20. ¿Qué valor de x obtienes?'
  const implicitEquation = inferCanonicalOperationFromText(implicitEquationPrompt)
  assert.equal(implicitEquation, '3x+5=20')
  assert.equal(solveOperation(implicitEquation), 5)

  const implicitEquationCorrect = await handleMathEvaluation(implicitEquationPrompt, '5', false)
  assert.equal(implicitEquationCorrect?.estado, 'correcto')
  assert.equal(implicitEquationCorrect?.correctAnswer, 5)

  const implicitEquationPhrase = await handleMathEvaluation(implicitEquationPrompt, 'si es 5', false)
  assert.equal(implicitEquationPhrase?.estado, 'correcto')
  assert.equal(implicitEquationPhrase?.correctAnswer, 5)

  const inferredEquation = inferCanonicalOperationFromText('Ahora resuelve: 2*x - 4 = 10. ¿Cuánto vale x?')
  assert.equal(inferredEquation, '2*x-4=10')
  assert.equal(solveOperation(inferredEquation), 7)

  const equationPrompt = 'Resuelve la ecuación: 2x - 4 = 10 [OP: 2*x-4=10]'
  const equationAnswers = [
    '7',
    '7?',
    '¿7?',
    '7.',
    'es 7',
    'creo que es 7',
    'la respuesta es 7',
    'x=7',
    'x = 7',
    'Para resolver: 2x - 4 = 10. Sumamos 4 a ambos lados: 2x = 14. Dividimos entre 2: x = 7',
  ]
  for (const answer of equationAnswers) {
    const result = await handleMathEvaluation(equationPrompt, answer, false)
    assert.equal(result?.estado, 'correcto', `falló con ${answer}`)
    assert.equal(result?.correctAnswer, 7)
    assert.doesNotMatch(result?.feedback || '', /\b7[?.]/, `feedback crudo con ${answer}`)
  }

  const intermediatePrompt = 'Suma 4 a ambos lados. ¿Qué obtienes? [OP: 2*x-4=10]'
  const intermediateExpression = await handleMathEvaluation(intermediatePrompt, '2x = 10 + 4', false)
  assert.equal(intermediateExpression?.estado, 'paso_correcto')
  assert.equal(intermediateExpression?.pasoIntermedio, true)
  assert.doesNotMatch(intermediateExpression?.feedback || '', /incorrect/i)
  assert.doesNotMatch(intermediateExpression?.feedback || '', /\b7\b/)

  const intermediateSimplified = await handleMathEvaluation(intermediatePrompt, '2x = 14', false)
  assert.equal(intermediateSimplified?.estado, 'paso_correcto')
  assert.equal(intermediateSimplified?.pasoIntermedio, true)
  assert.doesNotMatch(intermediateSimplified?.feedback || '', /incorrect/i)
  assert.doesNotMatch(intermediateSimplified?.feedback || '', /\b7\b/)

  const studentProvidedEquation = inferCanonicalOperationFromText('quiero resolver esta ecuación 2x - 4 = 10')
  assert.equal(studentProvidedEquation, '2x-4=10')

  assert.equal(isLikelyNumericSubject('Math'), true)
  assert.equal(isLikelyNumericSubject('Owlaris - Math Grade 8.md'), true)
  assert.equal(isLikelyNumericSubject('Environmental Systems'), false)

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

  const decimalWrong = await handleMathEvaluation('¿Cuánto es 0.15 * 60? [OP: 0.15*60]', '8', false)
  assert.equal(decimalWrong?.estado, 'incorrecto')
  assert.match(decimalWrong?.feedback || '', /decimal|15\/100|porcentaje/i)
  assert.doesNotMatch(decimalWrong?.feedback || '', /grupos iguales/i)

  assert.equal(isPendingContextQuestion('puedo usar calculadora para esa?'), true)
  const calculatorResponse = buildPendingContextResponse({
    studentQuestion: 'puedo usar calculadora para esa?',
    activeOperation: '48-19',
    activePrompt: 'Intenta este ejercicio distinto: 48 - 19. ¿Cual es el resultado?',
    idiomaIngles: false,
  })
  assert.match(calculatorResponse, /comprobar al final/i)
  assert.match(calculatorResponse, /48 - 19/i)

  console.log('math-safety smoke passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
