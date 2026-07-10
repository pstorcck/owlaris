import assert from 'node:assert/strict'
import {
  describeCompoundMessagePolicyForPrompt,
  isCompoundMultiIntentMessage,
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
  // Hallazgo real (QA Ronda 3, 2026-07-10): un mensaje con tres solicitudes
  // distintas en una sola entrada no se descomponía — el sistema no
  // atendió ninguna de las tres partes.
  const mensajesCompuestos = [
    '¿Cuánto es 5+5 y además explícame las fracciones y también quiero practicar geometría?',
    'quiero saber esto y tambien necesito ayuda con aquello',
    '¿me explicas esto? ¿y también aquello?',
    'me puedes ayudar con esto? y tambien con esto otro?',
    'can you help with X and also explain Y',
    'what is 5 plus 5 and additionally can you explain fractions',
  ]
  mensajesCompuestos.forEach((mensaje, i) => {
    test(`compuesto-${i}`, () => {
      assert.equal(isCompoundMultiIntentMessage(mensaje), true, mensaje)
    })
  })

  // Preguntas normales, de una sola solicitud, no deben marcarse como
  // compuestas.
  const mensajesSimples = [
    '¿Cuánto es 25 - 9?',
    'no entiendo este paso',
    'quiero practicar geometría',
    'what is the first step to solve this equation?',
    'explícame las fracciones',
  ]
  mensajesSimples.forEach((mensaje, i) => {
    test(`simple-${i}`, () => {
      assert.equal(isCompoundMultiIntentMessage(mensaje), false, mensaje)
    })
  })

  test('instruccion-de-prompt-no-vacia', () => {
    const instruccion = describeCompoundMessagePolicyForPrompt()
    assert.ok(instruccion.length > 20)
    assert.match(instruccion, /solicitudes distintas/i)
  })

  if (failures.length > 0) {
    console.error(`compound-message-guard smoke failed: ${failures.length}/${total}`)
    for (const failure of failures) {
      console.error(`- ${failure.name}: ${failure.message}`)
    }
    process.exit(1)
  }

  console.log(`compound-message-guard smoke passed: ${total}/${total}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
