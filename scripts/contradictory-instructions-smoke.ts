// Hallazgo real (instructivo de mejoras, ronda 2026-07-11), ítems 19-21:
// un mensaje con dos instrucciones opuestas en la misma entrada no tenía
// ningún manejo específico — debía reconocerse y responder con una
// pregunta de aclaración puntual, no obedecer en silencio una lectura
// arbitraria ni responder con un error genérico.
import assert from 'node:assert/strict'
import { buildContradictionClarificationResponse, detectContradictoryInstruction } from '../src/lib/contradictoryInstructions'

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
  const casos: Array<[string, ReturnType<typeof detectContradictoryInstruction>]> = [
    ['dame la respuesta pero no me la digas', 'respuesta_si_no'],
    ['dime la respuesta, pero no me des la respuesta', 'respuesta_si_no'],
    ['ayúdame con esto pero no me ayudes', 'ayuda_si_no'],
    ['resuélvelo pero no lo resuelvas', 'ayuda_si_no'],
    ['sube el nivel pero baja la dificultad', 'nivel_sube_baja'],
    ['sube la dificultad y también baja el nivel', 'nivel_sube_baja'],
    ['contéstame en español y también en inglés', 'idioma_doble'],
    ['cambiamos a historia pero no cambies de materia', 'materia_cambia_no_cambia'],
    ['cambia a biología, pero quédate en la misma', 'materia_cambia_no_cambia'],
  ]
  casos.forEach(([frase, esperado], i) => {
    test(`contradiccion-detectada-${i}: ${frase}`, () => {
      assert.equal(detectContradictoryInstruction(frase), esperado, frase)
    })
  })

  // Mensajes normales (sin contradicción) no deben activarse.
  const normales = [
    'dame la respuesta',
    'no me des la respuesta, ayúdame a razonarla',
    'ayúdame con esto',
    'sube el nivel',
    'contéstame en inglés',
    'cambiamos a historia',
    '¿qué es la fotosíntesis?',
    '',
  ]
  normales.forEach((frase, i) => {
    test(`sin-contradiccion-${i}: ${frase}`, () => {
      assert.equal(detectContradictoryInstruction(frase), null, frase)
    })
  })

  test('respuesta de aclaración nombra ambos lados del conflicto (español)', () => {
    const respuesta = buildContradictionClarificationResponse('respuesta_si_no', false)
    assert.match(respuesta, /respuesta/i)
    assert.match(respuesta, /\?/)
    assert.doesNotMatch(respuesta, /error/i)
  })

  test('respuesta de aclaración en inglés', () => {
    const respuesta = buildContradictionClarificationResponse('nivel_sube_baja', true)
    assert.match(respuesta, /harder|easier/i)
  })

  if (failures.length > 0) {
    console.error(`contradictory-instructions smoke failed: ${failures.length}/${total}`)
    for (const failure of failures) {
      console.error(`- ${failure.name}: ${failure.message}`)
    }
    process.exit(1)
  }

  console.log(`contradictory-instructions smoke passed: ${total}/${total}`)
}

main()
