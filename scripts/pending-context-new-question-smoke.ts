import assert from 'node:assert/strict'
import { isPendingContextQuestion } from '../src/lib/tutorContext'

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
  // Hallazgo real (QA Ronda 4, 2026-07-11): "no entiendo" también aparece en
  // preguntas conceptuales genuinas y nuevas al inicio de una sesión, no
  // solo en reacciones cortas sobre el ejercicio en curso. Tratarlas igual
  // hacía que el tutor resucitara un ejercicio pendiente viejo (a veces de
  // otra materia) en vez de responder la pregunta real.
  const preguntasNuevasQueNoDebenActivarContinuidad = [
    'hola, no entiendo bien qué es la fotosíntesis, me puedes explicar?',
    'no entiendo como se suman fracciones con diferente denominador',
    'no entiendo que es el efecto invernadero',
    'no entiendo como funciona la fotosintesis',
    'i do not understand how photosynthesis works',
    "i don't understand what the greenhouse effect is",
  ]
  preguntasNuevasQueNoDebenActivarContinuidad.forEach((pregunta, i) => {
    test(`pregunta-nueva-no-activa-continuidad-${i}`, () => {
      assert.equal(isPendingContextQuestion(pregunta), false, pregunta)
    })
  })

  // El uso original (reacción corta sobre el ejercicio activo) debe seguir
  // funcionando exactamente igual — sin esto, el fix rompería el
  // comportamiento correcto ya establecido.
  const reaccionesCortasQueSiActivanContinuidad = [
    'no entiendo',
    'no entiendo esto',
    'no entiendo este paso',
    'no entiendo nada',
    "i don't understand",
    'i do not understand',
  ]
  reaccionesCortasQueSiActivanContinuidad.forEach((pregunta, i) => {
    test(`reaccion-corta-si-activa-continuidad-${i}`, () => {
      assert.equal(isPendingContextQuestion(pregunta), true, pregunta)
    })
  })

  if (failures.length > 0) {
    console.error(`pending-context-new-question smoke failed: ${failures.length}/${total}`)
    for (const failure of failures) {
      console.error(`- ${failure.name}: ${failure.message}`)
    }
    process.exit(1)
  }

  console.log(`pending-context-new-question smoke passed: ${total}/${total}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
