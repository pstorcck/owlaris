import assert from 'node:assert/strict'
import { describeResumeTopicPolicyForPrompt, isResumeTopicChipRequest } from '../src/lib/tutorContext'
import { handleMathEvaluation, normalizeStudentAnswer } from '../src/lib/mathSafety'

type Failure = { name: string; message: string }
const failures: Failure[] = []
let total = 0

async function test(name: string, fn: () => void | Promise<void>) {
  total += 1
  try {
    await fn()
  } catch (error) {
    failures.push({ name, message: error instanceof Error ? error.message : String(error) })
  }
}

async function main() {
  // Hallazgo real (QA Ronda 2, revisión 2026-07-10): el chip "Resume el
  // tema" es no determinístico porque solo manda ese texto literal, sin
  // señal de cuál tema resumir.
  await test('detecta-chip-espanol', () => {
    assert.equal(isResumeTopicChipRequest('Resume el tema'), true)
    assert.equal(isResumeTopicChipRequest('  resume el tema  '), true)
  })
  await test('detecta-chip-ingles', () => {
    assert.equal(isResumeTopicChipRequest('Summarize the topic'), true)
  })
  await test('no-detecta-parafrasis-libre', () => {
    // Solo el clic exacto del chip debe activar esto — una petición libre
    // parecida ("resúmeme el tema de fracciones") debe seguir su propio
    // camino normal, no este guard específico del botón.
    assert.equal(isResumeTopicChipRequest('resúmeme el tema de fracciones por favor'), false)
    assert.equal(isResumeTopicChipRequest('¿Cuánto es 25 - 9?'), false)
  })

  await test('prioriza-ejercicio-pendiente-si-existe', () => {
    const instruccion = describeResumeTopicPolicyForPrompt({ pendingOperation: '2*x+5=15', materia: 'Algebra 1' })
    assert.match(instruccion, /2 \* x \+ 5 = 15/)
    assert.match(instruccion, /ejercicio en el que estamos trabajando ahora mismo/)
  })

  await test('usa-materia-si-no-hay-ejercicio-pendiente', () => {
    const instruccion = describeResumeTopicPolicyForPrompt({ pendingOperation: null, materia: 'Biología' })
    assert.match(instruccion, /Biología/)
    assert.doesNotMatch(instruccion, /ejercicio en el que estamos trabajando/)
  })

  await test('respaldo-generico-sin-materia-ni-ejercicio', () => {
    const instruccion = describeResumeTopicPolicyForPrompt({ pendingOperation: null, materia: null })
    assert.match(instruccion, /tema más específico y reciente/)
  })

  await test('version-en-ingles', () => {
    const instruccion = describeResumeTopicPolicyForPrompt({ pendingOperation: null, materia: 'Biology', idiomaIngles: true })
    assert.match(instruccion, /Summarize specifically/)
    assert.doesNotMatch(instruccion, /[áéíóúñ]/i)
  })

  // Hallazgo real (QA 100 pruebas, 2026-07-14): con un ejercicio pendiente
  // activo, el clic del chip "Resume el tema" caía como si fuera un
  // intento de RESPUESTA a ese ejercicio — el flujo real en
  // preguntar/route.ts llamaba a handleMathEvaluation con "Resume el tema"
  // como respuesta del alumno. Se documenta aquí el efecto real de esa
  // llamada (no_evaluable, porque normalizeStudentAnswer no reconoce
  // ningún número en el texto del chip) para justificar por qué route.ts
  // ahora debe SALTARSE esta llamada por completo cuando
  // isResumeTopicChipRequest(pregunta) es true, en vez de dejar que caiga
  // en la evaluación matemática — la instrucción de backend que dispara
  // "no_evaluable" ("pide al alumno que escriba la operación") pisaba por
  // completo la nota de resumen y terminaba en un ejercicio nuevo no
  // relacionado en vez de un resumen del tema activo.
  await test('resume-el-tema-no-es-una-respuesta-matematica', async () => {
    assert.equal(normalizeStudentAnswer('Resume el tema'), null)
    const textoConOP = '¿Cuánto es 2*x+5=15?\n[OP: 2*x+5=15]'
    const evaluacion = await handleMathEvaluation(textoConOP, 'Resume el tema', false)
    assert.equal(evaluacion?.estado, 'no_evaluable')
  })

  if (failures.length > 0) {
    console.error(`resume-topic-guard smoke failed: ${failures.length}/${total}`)
    for (const failure of failures) {
      console.error(`- ${failure.name}: ${failure.message}`)
    }
    process.exit(1)
  }

  console.log(`resume-topic-guard smoke passed: ${total}/${total}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
