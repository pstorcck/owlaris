import assert from 'node:assert/strict'
import {
  buildNextMathExercise,
  isRepeatedMathOperation,
  normalizePracticeOperation,
} from '../src/lib/mathPractice'
import { solveOperation } from '../src/lib/mathSafety'
import { shouldGuideWithoutFinalAnswer, guardNoFinalAnswer } from '../src/lib/pedagogicalGuard'

// ============================================================
// PARTE A — 5000 ejercicios generados, verificando que NUNCA
// se repita un ejercicio ya visto por el alumno tras responder bien.
// ============================================================

type RepeatFailure = { level: number; sessionLen: number; op: string; index: number }

const repeatFailuresRealistic: RepeatFailure[] = []
const repeatFailuresExtreme: RepeatFailure[] = []
const unsolvable: { level: number; op: string }[] = []
let totalExercisesA = 0
const firstRepeatAt: Record<number, number | null> = {}

const REALISTIC_SESSION_CAP = 60 // nadie responde bien 60+ seguidas en una sesión real

for (let level = 1; level <= 8; level += 1) {
  firstRepeatAt[level] = null
  // Varias sesiones por nivel para acumular exactamente 5000 ejercicios (8 niveles x 25 sesiones x 25 ejercicios)
  const sessionsPerLevel = 25
  const exercisesPerSession = 25
  for (let s = 0; s < sessionsPerLevel; s += 1) {
    const blockedOps: string[] = [] // todo lo que el alumno ya vio en esta sesión (correcto)
    for (let i = 0; i < exercisesPerSession; i += 1) {
      const idiomaIngles = (level + s + i) % 3 === 0
      const next = buildNextMathExercise(blockedOps, level, idiomaIngles)
      totalExercisesA += 1

      const solved = solveOperation(next.op)
      if (solved === null) unsolvable.push({ level, op: next.op })

      const repeated = isRepeatedMathOperation(next.op, blockedOps)
      if (repeated) {
        const failure = { level, sessionLen: i + 1, op: next.op, index: totalExercisesA }
        if (i + 1 <= REALISTIC_SESSION_CAP) repeatFailuresRealistic.push(failure)
        else repeatFailuresExtreme.push(failure)
        if (firstRepeatAt[level] === null) firstRepeatAt[level] = i + 1
      }

      blockedOps.push(next.op)
    }
  }
}

// ============================================================
// PARTE B1 — clasificador de "pide respuesta directa": ¿el guard
// de materia numérica se activa sin importar la frase?
// ============================================================

const copyPhrasesTemplates = [
  'dame la respuesta',
  'dame solo la respuesta',
  'solo dime la respuesta',
  'solo dime qué va',
  'hazme la tarea',
  'resuélveme todo',
  'no me expliques, solo dime el resultado',
  'just give me the answer',
  'just tell me the answer',
  'give me the answer already',
  'puedes solo darme el resultado',
  'necesito que me resuelvas esto ya',
  'pásame la respuesta correcta',
  'cuál es la respuesta, no quiero explicación',
  'no quiero pasos, solo el número',
]

const practiceFrames = [
  (p: string) => `${p} de este ejercicio: 2*x-4=10`,
  (p: string) => `${p}, cuánto es 48-19`,
  (p: string) => `tengo tarea de matemática, ${p}`,
  (p: string) => `estoy en un problema de física, ${p}`,
  (p: string) => `${p} por favor, es para mi repaso`,
  (p: string) => `${p}!!!`,
  (p: string) => `${p}?`,
  (p: string) => `oye Owlaris, ${p}`,
  (p: string) => `${p} :(`,
  (p: string) => `de verdad, ${p}`,
]

type CopyCase = { text: string; materiaNumerica: boolean }
const copyCases: CopyCase[] = []
for (let i = 0; i < 2500; i += 1) {
  const phrase = copyPhrasesTemplates[i % copyPhrasesTemplates.length]
  const frame = practiceFrames[Math.floor(i / copyPhrasesTemplates.length) % practiceFrames.length]
  copyCases.push({ text: frame(phrase), materiaNumerica: i % 5 !== 0 }) // 20% simula materia marcada como no-numérica por error de detección
}

let copyGuardTriggered = 0
const copyGuardMissed: string[] = []
for (const c of copyCases) {
  const shouldGuide = shouldGuideWithoutFinalAnswer({
    pregunta: c.text,
    tipoPregunta: 'academica',
    materiaNumerica: c.materiaNumerica,
  })
  if (shouldGuide) copyGuardTriggered += 1
  else copyGuardMissed.push(c.text)
}

// ============================================================
// PARTE B2 — fuga de respuesta final: ¿el guard detecta la
// respuesta final del modelo sin importar cómo la redacte?
// ============================================================

const leakTemplates: Array<(n: number) => string> = [
  (n) => `La respuesta correcta es ${n}.`, // frase cubierta (control positivo)
  (n) => `El resultado correcto es ${n}.`, // frase cubierta (control positivo)
  (n) => `La respuesta es ${n}.`, // sin "correcta" -> no cubierta
  (n) => `El resultado es ${n}.`, // sin "correcto" -> no cubierta
  (n) => `Entonces x = ${n}.`,
  (n) => `Entonces x vale ${n}.`,
  (n) => `El valor de x es ${n}.`,
  (n) => `Así que x es igual a ${n}.`,
  (n) => `x=${n}`,
  (n) => `So x is ${n}.`,
  (n) => `So x equals ${n}.`,
  (n) => `The answer is ${n}.`, // sin "correct" -> no cubierta
  (n) => `The result is ${n}.`, // sin "correct" -> no cubierta
  (n) => `Therefore, x = ${n}.`,
  (n) => `En conclusión, el valor final es ${n}.`,
  (n) => `Al final llegamos a ${n}.`,
  (n) => `Despejando, x queda en ${n}.`,
  (n) => `Con eso, x da ${n}.`,
  (n) => `That gives us x = ${n}.`,
  (n) => `Final answer: ${n}`,
]

let leaksCaught = 0
let leaksMissed = 0
const missedExamples: string[] = []

for (let i = 0; i < 2500; i += 1) {
  const template = leakTemplates[i % leakTemplates.length]
  const n = (i % 37) + 1
  const modelText = `Vamos paso a paso resolviendo la ecuación. ${template(n)} ¿Puedes explicar cómo llegaste ahí?`
  const guard = guardNoFinalAnswer(modelText, {
    pregunta: 'resuelve 2*x-4=10',
    tipoPregunta: 'academica',
    materiaNumerica: true,
  })
  const numberStillVisible = guard.text.includes(String(n))
  if (guard.guardActivado && !numberStillVisible) {
    leaksCaught += 1
  } else {
    leaksMissed += 1
    if (missedExamples.length < 12) missedExamples.push(template(n))
  }
}

// ============================================================
// REPORTE
// ============================================================

console.log('=== PARTE A: Anti-repetición de ejercicios (objetivo 5000) ===')
console.log(`Ejercicios generados: ${totalExercisesA}`)
console.log(`Ejercicios sin solución válida: ${unsolvable.length}`)
console.log(`Repeticiones en rango realista (<= ${REALISTIC_SESSION_CAP} aciertos seguidos): ${repeatFailuresRealistic.length}`)
console.log(`Repeticiones solo en sesiones extremas (> ${REALISTIC_SESSION_CAP} aciertos seguidos, teórico): ${repeatFailuresExtreme.length}`)
console.log('Primer repetido detectado por nivel (aciertos seguidos, null = nunca en la sesión probada):')
for (const level of Object.keys(firstRepeatAt)) {
  console.log(`  nivel ${level}: ${firstRepeatAt[Number(level)]}`)
}
if (repeatFailuresRealistic.length > 0) {
  console.log('Ejemplos de repetición en rango realista:')
  for (const f of repeatFailuresRealistic.slice(0, 10)) console.log(`  - nivel ${f.level}, acierto #${f.sessionLen}: ${f.op}`)
}
if (repeatFailuresExtreme.length > 0) {
  console.log('Ejemplos de repetición en rango extremo (fallback agotado):')
  for (const f of repeatFailuresExtreme.slice(0, 10)) console.log(`  - nivel ${f.level}, acierto #${f.sessionLen}: ${f.op}`)
}

console.log('\n=== PARTE B1: Clasificador anti-copia (input del alumno), 2500 casos ===')
console.log(`Casos donde el guard "no dar respuesta final" SÍ se activa: ${copyGuardTriggered}/${copyCases.length}`)
console.log(`Casos NO detectados por el clasificador: ${copyGuardMissed.length}`)
if (copyGuardMissed.length > 0) {
  console.log('Ejemplos no detectados:')
  for (const m of copyGuardMissed.slice(0, 10)) console.log(`  - "${m}"`)
}

console.log('\n=== PARTE B2: Fuga de respuesta final en texto del modelo, 2500 casos ===')
console.log(`Fugas bloqueadas correctamente: ${leaksCaught}/${leaksCaught + leaksMissed}`)
console.log(`Fugas NO bloqueadas (el número final queda visible): ${leaksMissed}/${leaksCaught + leaksMissed}`)
if (missedExamples.length > 0) {
  console.log('Ejemplos de fuga no bloqueada:')
  for (const m of missedExamples) console.log(`  - "${m}"`)
}

const totalRun = totalExercisesA + copyCases.length + (leaksCaught + leaksMissed)
console.log(`\nTotal de casos ejecutados en este script: ${totalRun}`)

// No hacemos process.exit(1) — este es un reporte diagnóstico, no un gate de CI.
