import assert from 'node:assert/strict'
import { buildProgressResponse, isProgressQuestion } from '../src/lib/tutorContext'

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
  // Hallazgo real (QA Ronda 3, 2026-07-10): "¿cuál es mi progreso?" recibía
  // respuestas vagas en el chat, aunque el Reporte de hoy sí tiene datos
  // precisos ya calculados (racha, nivel de dificultad).
  const preguntasQueDebenInterceptarse = [
    'cual es mi progreso',
    '¿Cuál es mi progreso hoy?',
    'que tanto he avanzado',
    'como voy en esto',
    'como voy en la materia',
    'como vamos en esto',
    'que tal voy',
    'how am i doing',
    'what is my progress',
    'am i improving',
  ]
  preguntasQueDebenInterceptarse.forEach((pregunta, i) => {
    test(`intercepta-${i}`, () => {
      assert.equal(isProgressQuestion(pregunta), true, pregunta)
    })
  })

  // "como voy" a secas colisiona con frases comunes que NO preguntan por
  // progreso — no deben interceptarse.
  const preguntasQueNoDebenInterceptarse = [
    'no se como voy a resolver esto',
    'no se como voy a hacer esta tarea',
    '¿Cuánto es 25 - 9?',
    'quiero practicar geometría',
    'no entiendo este paso',
  ]
  preguntasQueNoDebenInterceptarse.forEach((pregunta, i) => {
    test(`no-intercepta-${i}`, () => {
      assert.equal(isProgressQuestion(pregunta), false, pregunta)
    })
  })

  test('respuesta-con-racha-de-aciertos', () => {
    const respuesta = buildProgressResponse({ correctStreak: 3, wrongStreak: 0, currentLevel: 4, materia: 'Algebra 1' })
    assert.match(respuesta, /racha de 3 respuestas correctas seguidas/i)
    assert.match(respuesta, /Algebra 1/)
    assert.match(respuesta, /nivel de dificultad 4 de 8/)
    assert.match(respuesta, /Reporte de hoy/)
  })

  test('respuesta-con-racha-de-fallos', () => {
    const respuesta = buildProgressResponse({ correctStreak: 0, wrongStreak: 2, currentLevel: 3, materia: null })
    assert.match(respuesta, /2 intentos incorrectos seguidos/i)
    assert.doesNotMatch(respuesta, / en $/)
  })

  test('respuesta-sin-racha-activa', () => {
    const respuesta = buildProgressResponse({ correctStreak: 0, wrongStreak: 0, currentLevel: 1, materia: null })
    assert.match(respuesta, /sin una racha activa/i)
  })

  test('respuesta-en-ingles-sin-acentos', () => {
    const respuesta = buildProgressResponse({ correctStreak: 5, wrongStreak: 0, currentLevel: 2, materia: 'Biology', idiomaIngles: true })
    assert.match(respuesta, /streak of 5 correct answers/i)
    assert.match(respuesta, /Today's report/)
    assert.doesNotMatch(respuesta, /[áéíóúñ]/i)
  })

  test('singular-correcto-con-racha-de-1', () => {
    const respuesta = buildProgressResponse({ correctStreak: 1, wrongStreak: 0, currentLevel: 1, materia: null })
    assert.match(respuesta, /racha de 1 respuesta correcta seguida\b/i)
    assert.doesNotMatch(respuesta, /1 respuestas/)
  })

  if (failures.length > 0) {
    console.error(`progress-guard smoke failed: ${failures.length}/${total}`)
    for (const failure of failures) {
      console.error(`- ${failure.name}: ${failure.message}`)
    }
    process.exit(1)
  }

  console.log(`progress-guard smoke passed: ${total}/${total}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
