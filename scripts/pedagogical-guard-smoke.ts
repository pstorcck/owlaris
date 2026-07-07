import assert from 'node:assert/strict'
import { guardNoFinalAnswer, shouldGuideWithoutFinalAnswer } from '../src/lib/pedagogicalGuard'
import {
  buildExerciseRecallResponse,
  buildPendingContextResponse,
  isExerciseRecallRequest,
  isLikelyMathAnswerText,
  isPendingContextQuestion,
  stripUnapprovedExternalResources,
} from '../src/lib/tutorContext'
import {
  buildCourseTopicListResponse,
  extractCourseTopicIndex,
  isCourseTopicListRequest,
} from '../src/lib/courseTopics'

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
  // La regla de no dar la respuesta final debe funcionar como comportamiento
  // interno: el texto visible no debe anunciarla ("no te voy a dar...").
  assert.doesNotMatch(guardedMath.text, /no te voy a dar/i)
  assert.match(guardedMath.text, /paso a paso|primer paso|identificar qu[eé] nos pide|pista|pensemos juntos/i)

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

  assert.equal(isPendingContextQuestion('lo puedo lograr sin usar calculadora?'), true)
  assert.equal(isLikelyMathAnswerText('lo puedo lograr sin usar calculadora?'), false)
  const fractionContext = buildPendingContextResponse({
    studentQuestion: 'lo puedo lograr sin usar calculadora?',
    activeOperation: '3/8',
    activePrompt: 'Convierte la fracción 3/8 a decimal.',
  })
  assert.match(fractionContext, /Usemos el ejemplo que veníamos trabajando: 3\/8/)
  assert.match(fractionContext, /3 ÷ 8/)
  assert.doesNotMatch(fractionContext, /0\.375/)

  // Instructivo de mejoras, sección E: nada de jerga algebraica al aclarar
  // una ecuación activa ("término separado", "deshacer el término").
  const equationClarification = buildPendingContextResponse({
    studentQuestion: 'no entiendo, me ayudas?',
    activeOperation: 'x+30=61',
    activePrompt: 'Resuelve: x + 30 = 61',
  })
  assert.doesNotMatch(equationClarification, /término separado|estructura algebraica|componente operacional|elemento aislado|deshacer el término/i)
  assert.match(equationClarification, /sumando o restando|dejar la x sola/i)

  const complaintContext = buildPendingContextResponse({
    studentQuestion: 'te pregunté esto pero no me respondiste',
    activeOperation: '3/8',
    activePrompt: 'Convierte la fracción 3/8 a decimal.',
  })
  assert.match(complaintContext, /Tienes razón/)
  assert.match(complaintContext, /3 \/ 8/)

  const strippedResource = stripUnapprovedExternalResources(
    'Te comparto este recurso de Eduardo Montano que puede ayudarte: https://www.youtube.com/c/EduardoMontano',
    false
  )
  assert.equal(strippedResource.guardActivado, true)
  assert.doesNotMatch(strippedResource.text, /youtube|Eduardo/i)
  assert.match(strippedResource.text, /material oficial/)

  assert.equal(isCourseTopicListRequest('Dame todos los temas de esta clase'), true)
  const completeIndex = extractCourseTopicIndex(`
## Índice de temas
Cantidad de temas: 3
1. Forces and motion
2. Energy in interactions
3. Waves and information
`)
  assert.equal(completeIndex.declaredCount, 3)
  assert.equal(completeIndex.topics.length, 3)
  assert.equal(completeIndex.incomplete, false)
  const completeResponse = buildCourseTopicListResponse({
    index: completeIndex,
    subject: 'Science Grade 8',
    documentName: 'Owlaris - Science Grade 8.md',
  })
  assert.match(completeResponse, /Forces and motion/)

  const incompleteIndex = extractCourseTopicIndex(`
Mapa del curso
36 temas de ciclo completo
- Forces and motion
- Energy transfer
`)
  assert.equal(incompleteIndex.declaredCount, 36)
  assert.equal(incompleteIndex.incomplete, true)
  const incompleteResponse = buildCourseTopicListResponse({
    index: incompleteIndex,
    subject: 'Science Grade 8',
  })
  assert.match(incompleteResponse, /36 temas/)
  assert.match(incompleteResponse, /solo puedo recuperar 2/)

  // ── Bugs reales del instructivo: pedir aclarar el mismo paso NO debe
  // cambiar de ejercicio ──
  for (const frase of [
    'Explícame ese paso otra vez',
    'No entendí ese paso',
    'Repite eso',
    '¿Por qué hiciste eso?',
    'Explícalo más fácil',
    'Empieza desde cero',
    'No cambies de ejercicio',
    'Sigo sin entender',
    '¿Me lo puedes decir de otra forma?',
    'Explícamelo como si no supiera nada',
    // Hallazgo #1/#3 (auditoría QA 2026-07-07): estas frases exactas se
    // interpretaban como "quiero otro ejercicio" en vez de pedir ayuda con
    // el que ya estaba activo.
    'No sé qué hacer con este ejercicio',
    'Necesito ayuda con esto',
    'Me preocupa no entender este tema',
  ]) {
    assert.equal(isPendingContextQuestion(frase), true, `"${frase}" debería mantener el ejercicio activo`)
  }

  // Hallazgo #1/#3 (auditoría QA 2026-07-07): "quiero resolver esto yo
  // solo" pide lo opuesto a un ejercicio nuevo — debe dejarlo intentar el
  // mismo ejercicio, sin darle la respuesta ni una pista que se la regale.
  assert.equal(isPendingContextQuestion('Quiero resolver esto yo solo'), true)
  const autonomyResponse = buildPendingContextResponse({
    studentQuestion: 'Quiero resolver esto yo solo',
    activeOperation: 'x+30=61',
    activePrompt: 'Resuelve: x + 30 = 61',
  })
  assert.match(autonomyResponse, /inténtalo/i)
  assert.match(autonomyResponse, /x\s*\+\s*30\s*=\s*61/)
  assert.doesNotMatch(autonomyResponse, /\b31\b/)

  // ── "¿Cuál era el ejercicio?" debe recuperar el ejercicio activo ──
  for (const frase of [
    '¿Cuál era el ejercicio que estábamos haciendo?',
    '¿Qué estábamos haciendo?',
    '¿Cuál era la pregunta anterior?',
    'Recuérdame el problema',
    'Volvamos al ejercicio',
    '¿Dónde íbamos?',
    '¿Cuál era la ecuación?',
    'What was the exercise?',
    'Where were we?',
  ]) {
    assert.equal(isExerciseRecallRequest(frase), true, `"${frase}" debería reconocerse como solicitud de recordar el ejercicio`)
  }
  assert.equal(isExerciseRecallRequest('quiero practicar'), false)

  const recall = buildExerciseRecallResponse({ activeOperation: '2*(x+3)=14', idiomaIngles: false })
  assert.match(recall || '', /2 \* \(x \+ 3\) = 14/)
  assert.equal(buildExerciseRecallResponse({ activeOperation: null, idiomaIngles: false }), null)

  console.log('pedagogical-guard smoke passed')
}

main()
