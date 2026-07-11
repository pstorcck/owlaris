// Hallazgo real (instructivo de mejoras, ronda 2026-07-11), ítems 22-23 y
// 25: "qué sigue después de X" debe respetar el orden real del índice
// oficial de temas, y "¿este curso incluye X?" debe responderse con base
// en el índice real, no en una suposición del modelo.
import assert from 'node:assert/strict'
import {
  buildAreaPresenceResponse,
  buildNextTopicResponse,
  extractAreaQuery,
  extractCourseTopicIndex,
  extractNextTopicReference,
  findNextTopic,
  isBroadAreaPresenceQuestion,
  isNextTopicRequest,
} from '../src/lib/courseTopics'

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
  const contenido = `
## Índice de temas
Cantidad de temas: 5
1. Fotosíntesis
2. Respiración celular
3. Mitosis
4. Meiosis
5. Genética básica
`
  const index = extractCourseTopicIndex(contenido)
  assert.equal(index.topics.length, 5)

  // Detección de la petición "qué sigue después de X".
  for (const frase of [
    'qué sigue después de la fotosíntesis',
    '¿qué viene después de mitosis?',
    'cuál es el siguiente tema después de respiración celular',
    'what comes after photosynthesis',
  ]) {
    test(`next-topic-request-detectado: ${frase}`, () => {
      assert.equal(isNextTopicRequest(frase), true, frase)
    })
  }

  test('extrae referencia del tema mencionado', () => {
    assert.equal(extractNextTopicReference('qué sigue después de la fotosíntesis'), 'la fotosíntesis')
    assert.equal(extractNextTopicReference('¿qué viene después de mitosis?'), 'mitosis')
    assert.equal(extractNextTopicReference('qué sigue en el curso'), null)
  })

  test('encuentra el siguiente tema respetando el orden real del índice', () => {
    const resultado = findNextTopic(index, 'fotosíntesis')
    assert.equal(resultado.actual?.tema, 'Fotosíntesis')
    assert.equal(resultado.siguiente?.tema, 'Respiración celular')
  })

  test('el último tema no tiene siguiente', () => {
    const resultado = findNextTopic(index, 'genética básica')
    assert.equal(resultado.actual?.tema, 'Genética básica')
    assert.equal(resultado.siguiente, null)
  })

  test('respuesta de siguiente tema cita el tema real del índice', () => {
    const respuesta = buildNextTopicResponse({ index, referencia: 'mitosis', idiomaIngles: false })
    assert.match(respuesta, /Meiosis/)
    assert.match(respuesta, /Mitosis/)
  })

  test('respuesta cuando el tema de referencia no está en el índice', () => {
    const respuesta = buildNextTopicResponse({ index, referencia: 'ecología', idiomaIngles: false })
    assert.match(respuesta, /no encontré/i)
  })

  // Ítem 25: preguntas de presencia de un área amplia.
  for (const frase of [
    '¿este curso incluye genética?',
    '¿esta clase incluye mitosis?',
    '¿vemos algo de meiosis en esta materia?',
    'does this course include genetics?',
  ]) {
    test(`area-presence-detectada: ${frase}`, () => {
      assert.equal(isBroadAreaPresenceQuestion(frase), true, frase)
    })
  }

  test('extrae el área consultada', () => {
    assert.equal(extractAreaQuery('¿este curso incluye genética?'), 'genética')
  })

  test('confirma presencia real basada en el índice', () => {
    const respuesta = buildAreaPresenceResponse({ index, area: 'genética', idiomaIngles: false })
    assert.match(respuesta, /Sí/)
    assert.match(respuesta, /Genética básica/)
  })

  test('responde con cautela cuando el área no está en el índice disponible', () => {
    const respuesta = buildAreaPresenceResponse({ index, area: 'ecología', idiomaIngles: false })
    assert.match(respuesta, /no veo/i)
    assert.doesNotMatch(respuesta, /^Sí/i)
  })

  if (failures.length > 0) {
    console.error(`course-topic-navigation smoke failed: ${failures.length}/${total}`)
    for (const failure of failures) {
      console.error(`- ${failure.name}: ${failure.message}`)
    }
    process.exit(1)
  }

  console.log(`course-topic-navigation smoke passed: ${total}/${total}`)
}

main()
