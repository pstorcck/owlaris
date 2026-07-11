import assert from 'node:assert/strict'
import { describeResumeTopicPolicyForPrompt, isResumeTopicChipRequest } from '../src/lib/tutorContext'

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
  // Hallazgo real (QA Ronda 2, revisión 2026-07-10): el chip "Resume el
  // tema" es no determinístico porque solo manda ese texto literal, sin
  // señal de cuál tema resumir.
  test('detecta-chip-espanol', () => {
    assert.equal(isResumeTopicChipRequest('Resume el tema'), true)
    assert.equal(isResumeTopicChipRequest('  resume el tema  '), true)
  })
  test('detecta-chip-ingles', () => {
    assert.equal(isResumeTopicChipRequest('Summarize the topic'), true)
  })
  test('no-detecta-parafrasis-libre', () => {
    // Solo el clic exacto del chip debe activar esto — una petición libre
    // parecida ("resúmeme el tema de fracciones") debe seguir su propio
    // camino normal, no este guard específico del botón.
    assert.equal(isResumeTopicChipRequest('resúmeme el tema de fracciones por favor'), false)
    assert.equal(isResumeTopicChipRequest('¿Cuánto es 25 - 9?'), false)
  })

  test('prioriza-ejercicio-pendiente-si-existe', () => {
    const instruccion = describeResumeTopicPolicyForPrompt({ pendingOperation: '2*x+5=15', materia: 'Algebra 1' })
    assert.match(instruccion, /2 \* x \+ 5 = 15/)
    assert.match(instruccion, /ejercicio en el que estamos trabajando ahora mismo/)
  })

  test('usa-materia-si-no-hay-ejercicio-pendiente', () => {
    const instruccion = describeResumeTopicPolicyForPrompt({ pendingOperation: null, materia: 'Biología' })
    assert.match(instruccion, /Biología/)
    assert.doesNotMatch(instruccion, /ejercicio en el que estamos trabajando/)
  })

  test('respaldo-generico-sin-materia-ni-ejercicio', () => {
    const instruccion = describeResumeTopicPolicyForPrompt({ pendingOperation: null, materia: null })
    assert.match(instruccion, /tema más específico y reciente/)
  })

  test('version-en-ingles', () => {
    const instruccion = describeResumeTopicPolicyForPrompt({ pendingOperation: null, materia: 'Biology', idiomaIngles: true })
    assert.match(instruccion, /Summarize specifically/)
    assert.doesNotMatch(instruccion, /[áéíóúñ]/i)
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
