import assert from 'node:assert/strict'
import { buildNextMathExercise, isRepeatedMathOperation } from '../src/lib/mathPractice'
import { solveOperation } from '../src/lib/mathSafety'
import { shouldGuideWithoutFinalAnswer, guardNoFinalAnswer } from '../src/lib/pedagogicalGuard'

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

// ============================================================
// PARTE A — 5000 ejercicios generados simulando un alumno que
// responde bien seguido (incluye el peor caso: nivel 1, cuyo
// banco solo tiene 6 operaciones, forzado a 25 aciertos seguidos).
// Ningún ejercicio ya visto en la sesión debe repetirse.
// ============================================================

const REALISTIC_SESSION_CAP = 60 // nadie responde bien 60+ veces seguidas en una sesión real

for (let level = 1; level <= 8; level += 1) {
  const sessionsPerLevel = 25
  const exercisesPerSession = 25 // 8 niveles x 25 x 25 = 5000
  for (let s = 0; s < sessionsPerLevel; s += 1) {
    const blockedOps: string[] = []
    for (let i = 0; i < exercisesPerSession; i += 1) {
      const idiomaIngles = (level + s + i) % 3 === 0
      const next = buildNextMathExercise(blockedOps, level, idiomaIngles)
      test(`no-repeat-level${level}-session${s}-exercise${i}`, () => {
        assert.equal(isRepeatedMathOperation(next.op, blockedOps), false, `repeated ${next.op}`)
        assert.notEqual(solveOperation(next.op), null, `unsolved ${next.op}`)
      })
      blockedOps.push(next.op)
    }
  }
}

// ============================================================
// PARTE B1 — clasificador de "pide respuesta directa": para
// materias numéricas el guard debe activarse sin importar la
// frase exacta (2500 variaciones de "dame la respuesta").
// ============================================================

const copyPhrasesTemplates = [
  'dame la respuesta', 'dame solo la respuesta', 'solo dime la respuesta',
  'solo dime qué va', 'hazme la tarea', 'resuélveme todo',
  'no me expliques, solo dime el resultado', 'just give me the answer',
  'just tell me the answer', 'give me the answer already',
  'puedes solo darme el resultado', 'necesito que me resuelvas esto ya',
  'pásame la respuesta correcta', 'cuál es la respuesta, no quiero explicación',
  'no quiero pasos, solo el número',
]

const practiceFrames: Array<(p: string) => string> = [
  (p) => `${p} de este ejercicio: 2*x-4=10`,
  (p) => `${p}, cuánto es 48-19`,
  (p) => `tengo tarea de matemática, ${p}`,
  (p) => `estoy en un problema de física, ${p}`,
  (p) => `${p} por favor, es para mi repaso`,
  (p) => `${p}!!!`,
  (p) => `${p}?`,
  (p) => `oye Owlaris, ${p}`,
  (p) => `${p} :(`,
  (p) => `de verdad, ${p}`,
]

for (let i = 0; i < 2500; i += 1) {
  const phrase = copyPhrasesTemplates[i % copyPhrasesTemplates.length]
  const frame = practiceFrames[Math.floor(i / copyPhrasesTemplates.length) % practiceFrames.length]
  const text = frame(phrase)
  test(`copy-request-detected-${i}`, () => {
    const shouldGuide = shouldGuideWithoutFinalAnswer({
      pregunta: text,
      tipoPregunta: 'academica',
      materiaNumerica: i % 5 !== 0, // 20% simula materia detectada incorrectamente como no numérica
    })
    assert.equal(shouldGuide, true, `not detected: "${text}"`)
  })
}

// ============================================================
// PARTE B2 — fuga de respuesta final: el guard debe detectar la
// respuesta final del modelo sin importar cómo la redacte
// (2500 variaciones de fraseo).
// ============================================================

const leakTemplates: Array<(n: number) => string> = [
  (n) => `La respuesta correcta es ${n}.`,
  (n) => `El resultado correcto es ${n}.`,
  (n) => `La respuesta es ${n}.`,
  (n) => `El resultado es ${n}.`,
  (n) => `Entonces x = ${n}.`,
  (n) => `Entonces x vale ${n}.`,
  (n) => `El valor de x es ${n}.`,
  (n) => `Así que x es igual a ${n}.`,
  (n) => `x=${n}`,
  (n) => `So x is ${n}.`,
  (n) => `So x equals ${n}.`,
  (n) => `The answer is ${n}.`,
  (n) => `The result is ${n}.`,
  (n) => `Therefore, x = ${n}.`,
  (n) => `En conclusión, el valor final es ${n}.`,
  (n) => `Al final llegamos a ${n}.`,
  (n) => `Despejando, x queda en ${n}.`,
  (n) => `Con eso, x da ${n}.`,
  (n) => `That gives us x = ${n}.`,
  (n) => `Final answer: ${n}`,
]

for (let i = 0; i < 2500; i += 1) {
  const template = leakTemplates[i % leakTemplates.length]
  const n = (i % 37) + 1
  const modelText = `Vamos paso a paso resolviendo la ecuación. ${template(n)} ¿Puedes explicar cómo llegaste ahí?`
  test(`leak-blocked-${i}`, () => {
    const guard = guardNoFinalAnswer(modelText, {
      pregunta: 'resuelve 2*x-4=10',
      tipoPregunta: 'academica',
      materiaNumerica: true,
    })
    assert.equal(guard.guardActivado, true, `guard did not activate for: "${template(n)}"`)
    assert.equal(guard.text.includes(String(n)), false, `leaked number in: "${guard.text}"`)
  })
}

assert.equal(total, 5000 + 2500 + 2500)

if (failures.length > 0) {
  console.error(`exercise-repetition stress failed: ${failures.length}/${total}`)
  for (const failure of failures.slice(0, 25)) {
    console.error(`- ${failure.name}: ${failure.message}`)
  }
  process.exit(1)
}

console.log(`exercise-repetition stress passed: ${total}/${total}`)
