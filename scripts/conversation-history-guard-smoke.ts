import assert from 'node:assert/strict'
import {
  buildConversationHistoryLimitResponse,
  isConversationHistoryMetaQuestion,
} from '../src/lib/tutorContext'

type Failure = { name: string; message: string }
const failures: Failure[] = []
let total = 0

function test(name: string, fn: () => void) {
  total += 1
  try {
    fn()
  } catch (error) {
    failures.push({ name, message: error instanceof Error ? error.message : String(error) })
  }
}

async function main() {
  // Hallazgo real (QA Ronda 3, 2026-07-10): el modelo confabuló una
  // respuesta segura pero incorrecta sobre "cuál fue el primer tema que
  // discutimos hoy", ya que el frontend solo envía los últimos 6 mensajes.
  const preguntasQueDebenInterceptarse = [
    'cual fue el primer tema que discutimos hoy',
    '¿Cuál fue el primer ejercicio que vimos?',
    'Cuál fue mi primera pregunta de hoy',
    'desde el principio de la conversación, ¿qué hemos hecho?',
    'recuerdas todo lo que hemos hablado hoy',
    'hazme un resumen de toda la conversación',
    'what was the first topic we discussed today?',
    'what was the first question you asked me',
    'do you remember everything we have talked about',
    'how many messages have we exchanged today',
  ]
  preguntasQueDebenInterceptarse.forEach((pregunta, i) => {
    test(`intercepta-${i}`, () => {
      assert.equal(isConversationHistoryMetaQuestion(pregunta), true, pregunta)
    })
  })

  // No debe interceptar preguntas normales sobre el ejercicio activo actual
  // (eso ya lo maneja isExerciseRecallRequest/isPendingContextQuestion) ni
  // preguntas académicas comunes.
  const preguntasQueNoDebenInterceptarse = [
    'cual era el ejercicio',
    '¿Cuánto es 25 - 9?',
    'no entiendo este paso',
    'quiero practicar geometría',
    'what is the first step to solve this equation',
  ]
  preguntasQueNoDebenInterceptarse.forEach((pregunta, i) => {
    test(`no-intercepta-${i}`, () => {
      assert.equal(isConversationHistoryMetaQuestion(pregunta), false, pregunta)
    })
  })

  test('respuesta-es-honesta-y-en-espanol', () => {
    const respuesta = buildConversationHistoryLimitResponse(false)
    assert.match(respuesta, /no tengo un registro confiable/i)
    assert.match(respuesta, /reporte de hoy/i)
  })

  test('respuesta-es-honesta-y-en-ingles', () => {
    const respuesta = buildConversationHistoryLimitResponse(true)
    assert.match(respuesta, /do not have a reliable record/i)
    assert.match(respuesta, /today's report/i)
    assert.doesNotMatch(respuesta, /[áéíóúñ]/i)
  })

  if (failures.length > 0) {
    console.error(`conversation-history-guard smoke failed: ${failures.length}/${total}`)
    for (const failure of failures) {
      console.error(`- ${failure.name}: ${failure.message}`)
    }
    process.exit(1)
  }

  console.log(`conversation-history-guard smoke passed: ${total}/${total}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
