// Hallazgo real (instructivo de mejoras, ronda 2026-07-11), ítem 4: frases
// de autonomía sin "solo/mismo" ("ahora quiero explicar yo", "quiero hacerlo
// yo", "yo te digo los pasos", "te explico cómo lo haría") no activaban la
// continuidad del ejercicio en curso — el tutor las trataba como pregunta
// nueva o cambiaba de ejercicio en vez de ceder el turno al alumno.
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

function main() {
  const frasesAutonomia = [
    'ahora quiero explicar yo',
    'espera, quiero hacerlo yo',
    'no, quiero intentarlo yo',
    'mejor yo te digo los pasos',
    'yo te explico los pasos que segui',
    'te explico como lo haria yo',
    'dejame explicarte como lo pensé',
    'wait, i want to explain it',
    'i want to do it',
    'ok, i will tell you the steps',
    "let me explain how i would do it",
  ]
  frasesAutonomia.forEach((frase, i) => {
    test(`autonomia-activa-continuidad-${i}`, () => {
      assert.equal(isPendingContextQuestion(frase), true, frase)
    })
  })

  if (failures.length > 0) {
    console.error(`autonomy-phrases smoke failed: ${failures.length}/${total}`)
    for (const failure of failures) {
      console.error(`- ${failure.name}: ${failure.message}`)
    }
    process.exit(1)
  }

  console.log(`autonomy-phrases smoke passed: ${total}/${total}`)
}

main()
