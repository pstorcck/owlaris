import assert from 'node:assert/strict'
import {
  buildGuidedMathHint,
  handleMathEvaluation,
  inferCanonicalOperationFromText,
  isLikelyNumericSubject,
  looksLikeMathPracticePrompt,
  normalizeStudentAnswer,
  opCoincideConTexto,
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
  assert.match(wrong?.feedback || '', /Todavía no/i)
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

  // Equivalencias en lenguaje natural: el alumno no siempre escribe "x = 6".
  // Todas estas variantes deben normalizar al mismo número.
  const equivalentes = [
    '6', 'x = 6', 'x=6', 'x es 6', 'x vale 6', 'la x es 6', 'el valor de x es 6',
    'creo que x vale 6', 'x es igual a 6',
    'el problema era 2x+5=17 y x vale 6',
    'la ecuacion 2x+5=17 entonces x es igual a 6',
  ]
  for (const respuestaAlumno of equivalentes) {
    assert.equal(normalizeStudentAnswer(respuestaAlumno), 6, `"${respuestaAlumno}" debería normalizar a 6`)
  }

  const equationPromptEquivalencias = 'Resuelve: 2x + 5 = 17 [OP: 2*x+5=17]'
  for (const respuestaAlumno of ['x = 6', 'x es 6', 'x vale 6', 'creo que x vale 6', 'el valor de x es 6']) {
    const evaluado = await handleMathEvaluation(equationPromptEquivalencias, respuestaAlumno, false)
    assert.equal(evaluado?.estado, 'correcto', `"${respuestaAlumno}" debería marcarse correcto`)
  }

  // Bug real: un número que acompaña a "grado/tema/unidad/..." no es una
  // respuesta matemática — "Dime los temas de Science Grade 8" tiene un
  // solo número suelto (8) y se extraía como si fuera la respuesta al
  // ejercicio activo.
  for (const mensajeSinRelacion of [
    'Dime los temas de Science Grade 8',
    'quiero ver Biology Grade 10',
    'Dame los temas de Math Grade 6',
    'el tema 6',
    'la unidad 3',
    'el capítulo 5',
  ]) {
    assert.equal(normalizeStudentAnswer(mensajeSinRelacion), null, `"${mensajeSinRelacion}" no debería normalizar a un número`)
  }
  // Pero una respuesta real de un solo número sigue funcionando.
  assert.equal(normalizeStudentAnswer('8'), 8)
  assert.equal(normalizeStudentAnswer('creo que es 8'), 8)

  // Hallazgo real (QA Ronda 4, caso residual de Álgebra 1): una pregunta
  // conceptual sobre el ejercicio activo con un solo número incidental
  // ("¿por qué se resta 5 de ambos lados?") también caía en el mismo
  // respaldo de "un único número en el mensaje" y se evaluaba como
  // incorrecta, aunque el alumno solo preguntaba por el procedimiento.
  for (const preguntaConceptual of [
    '¿por qué se resta 5 de ambos lados?',
    '¿cómo se despeja la x en este paso con el 3?',
    '¿por qué multiplicamos por 2 aquí?',
    'why do we subtract 5 from both sides?',
    'how do we isolate x with the 4 here?',
  ]) {
    assert.equal(normalizeStudentAnswer(preguntaConceptual), null, `"${preguntaConceptual}" no debería normalizar a un número`)
  }
  // Pero una respuesta real que casualmente contiene un signo de pregunta
  // (sin ser una pregunta conceptual con palabra interrogativa) sigue
  // funcionando como respuesta.
  assert.equal(normalizeStudentAnswer('es 6?'), 6)

  // Números escritos en palabras (con variantes/contracciones reales) y
  // frases equivalentes completas — instructivo de mejoras, punto 19-20.
  const numerosEnPalabras: Array<[string, number]> = [
    ['treinta y uno', 31],
    ['treintaiuno', 31],
    ['treintiuno', 31],
    ['treinta uno', 31],
    ['thirty one', 31],
    ['29', 29],
    ['veintinueve', 29],
    ['veinti nueve', 29],
    ['veinti-nueve', 29],
    ['la mitad de 22', 11],
    ['el doble de 6', 12],
    ['10 más 4', 14],
    ['20 dividido entre 4', 5],
    ['3 al cuadrado', 9],
    ['55 dividido entre 5', 11],
  ]
  for (const [respuestaAlumno, esperado] of numerosEnPalabras) {
    assert.equal(normalizeStudentAnswer(respuestaAlumno), esperado, `"${respuestaAlumno}" debería normalizar a ${esperado}`)
  }

  // Ejercicio activo x + 30 = 61, respuesta en palabras: debe marcarse
  // correcta, nunca incorrecta (ejemplo del instructivo, prueba 2).
  const wordAnswerEquation = await handleMathEvaluation('Resuelve: x + 30 = 61 [OP: x+30=61]', 'treinta y uno', false)
  assert.equal(wordAnswerEquation?.estado, 'correcto')
  assert.equal(wordAnswerEquation?.correctAnswer, 31)

  // Hallazgo real (auditoría QA 2026-07-07, seguimiento): cuando el alumno
  // pide explícitamente un tipo de ejercicio ("Dame un ejercicio con la
  // incógnita en ambos lados") y el modelo responde SIN "?" ni tag [OP:]
  // limpio (ej. "Intenta resolverlo y dime el valor de x."), el ejercicio
  // debía seguir detectándose como una pregunta de práctica para poder
  // quedar marcado como pendiente — antes exigir "?" hacía que se perdiera
  // y la siguiente respuesta del alumno se evaluara contra un ejercicio
  // viejo ya abandonado.
  const respuestaSinSignoDePregunta = 'Aquí tienes un ejercicio con la incógnita en ambos lados:\n3x + 5 = 2x + 12\nIntenta resolverlo y dime el valor de x.\n(Fuente: Owlaris - Math Grade 8.md)'
  assert.doesNotMatch(respuestaSinSignoDePregunta, /\?/)
  assert.equal(looksLikeMathPracticePrompt(respuestaSinSignoDePregunta), true)
  const opDetectada = inferCanonicalOperationFromText(respuestaSinSignoDePregunta)
  assert.equal(opDetectada, '3x+5=2x+12')
  const evalAmbosLados = await handleMathEvaluation(respuestaSinSignoDePregunta, 'x = 3', false)
  assert.equal(evalAmbosLados?.estado, 'incorrecto')
  assert.equal(evalAmbosLados?.correctAnswer, 7)
  assert.match(evalAmbosLados?.feedback || '', /ambos lados|un mismo lado/i)

  // Hallazgo real (QA amplia 2026-07-08): la pista para cada tipo de error
  // caía en ramas genéricas o directamente equivocadas. Cada caso debe
  // devolver ahora una pista específica a su propio tipo de error, no la
  // genérica de "orden de operaciones" ni el mensaje viejo de "identifica
  // qué operación afecta a x".
  assert.match(buildGuidedMathHint('1/4+2/3', false), /denominador com[uú]n/i)
  assert.doesNotMatch(buildGuidedMathHint('1/4+2/3', false), /orden de operaciones/i)
  assert.match(buildGuidedMathHint('-3x+5=8', false), /coeficiente de x es negativo/i)
  assert.doesNotMatch(buildGuidedMathHint('-3x+5=8', false), /identifica qu[eé] operaci[oó]n afecta/i)
  assert.match(buildGuidedMathHint('0.5x-2.3=1.7', false), /decimales/i)
  assert.match(buildGuidedMathHint('2*(3+5)-4', false), /par[eé]ntesis/i)
  assert.doesNotMatch(buildGuidedMathHint('2*(3+5)-4', false), /orden de operaciones/i)
  // Casos ya cubiertos que no deben regresionar.
  assert.match(buildGuidedMathHint('2*(x+3)=18', false), /distribuye/i)
  assert.match(buildGuidedMathHint('5x+3=2x+15', false), /junta los t[eé]rminos con x/i)
  assert.match(buildGuidedMathHint('3x-7=2', false), /identifica qu[eé] operaci[oó]n afecta/i)

  // Hallazgo real (QA ~80 pruebas, 2026-07-08): un ejercicio de exponentes
  // (ej. 3^4*3^2) caía en la pista genérica de multiplicación u orden de
  // operaciones, sin mencionar la propiedad de exponentes.
  assert.match(buildGuidedMathHint('3^4*3^2', false), /exponentes/i)
  assert.doesNotMatch(buildGuidedMathHint('3^4*3^2', false), /grupos iguales|orden de operaciones/i)

  // Hallazgo real (QA Ronda 3, 2026-07-10): el modelo etiquetó un problema
  // de palabras recién redactado con un [OP: ...] que en realidad
  // pertenecía a un ejercicio anterior (una ecuación con x), causando que
  // una respuesta correcta se calificara como incorrecta. opCoincideConTexto
  // debe rechazar una etiqueta cuyos números no aparecen en el texto visible.
  assert.equal(
    opCoincideConTexto(
      '2*x+3=11',
      'María tiene 12 manzanas, compra 8 más y regala 5. ¿Cuántas manzanas tiene al final?'
    ),
    false
  )
  assert.equal(
    opCoincideConTexto('2*x+5=15', 'Intenta esta ecuación distinta: 2x + 5 = 15. ¿Cuánto vale x?'),
    true
  )
  assert.equal(opCoincideConTexto('x', 'No hay números aquí, solo x.'), true)
  assert.equal(opCoincideConTexto(null, 'cualquier texto'), false)

  // Hallazgo real (QA Ronda 4, 2026-07-11): exigir que coincidiera UN solo
  // número (con .some) era insuficiente — un problema nuevo de "coches de
  // juguete" (15 + 5 = 20) fue calificado incorrectamente contra la
  // ecuación vieja "2x+5=17" porque el "5" coincidía por pura casualidad,
  // aunque el 2 y el 17 no tenían ninguna relación con el problema real.
  // Ahora se exige que TODOS los números de la etiqueta coincidan.
  assert.equal(
    opCoincideConTexto(
      '2*x+5=17',
      'El primer dia hizo 15 coches. El segundo dia hizo 5 mas: 15 + 5 = 20 coches de juguete en total despues de los dos dias'
    ),
    false
  )

  console.log('math-safety smoke passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
