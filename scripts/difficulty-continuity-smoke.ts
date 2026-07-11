// Hallazgo real (instructivo de mejoras, ronda 2026-07-11), ítems 1-2
// (continuidad pedagógica):
// - Ítem 1: pedir explícitamente "sube el nivel" y responder correctamente
//   no tenía ningún efecto inmediato — había que esperar 5 aciertos
//   seguidos para que la dificultad subiera de verdad.
// - Ítem 2: un problema de aplicación (palabras) respondido con solo el
//   número final, sin mostrar la ecuación o el procedimiento, se marcaba
//   "correcto" igual que si hubiera mostrado el razonamiento completo.
import assert from 'node:assert/strict'
import { calculateAdaptiveDifficulty, isExplicitDifficultyUpRequest } from '../src/lib/mathPractice'
import { handleMathEvaluation, looksLikeWordProblem, respuestaEsSoloNumero } from '../src/lib/mathSafety'

type Failure = { name: string; message: string }
const failures: Failure[] = []
let total = 0

function test(name: string, fn: () => void | Promise<void>) {
  total += 1
  return Promise.resolve()
    .then(() => fn())
    .catch((error) => {
      failures.push({ name, message: error instanceof Error ? error.message : String(error) })
    })
}

async function main() {
  // ── Ítem 1 ──
  for (const frase of [
    'sube el nivel',
    'súbele el nivel por favor',
    'quiero algo más difícil',
    'ponme algo más complicado',
    'quiero subir de nivel',
    'raise the difficulty',
    'give me something harder',
  ]) {
    await test(`explicit-difficulty-up-detectado: ${frase}`, () => {
      assert.equal(isExplicitDifficultyUpRequest(frase), true, frase)
    })
  }
  await test('frase normal no activa la petición explícita', () => {
    assert.equal(isExplicitDifficultyUpRequest('¿cuánto es 5+5?'), false)
  })

  await test('con petición explícita y respuesta correcta, sube de inmediato sin esperar la racha de 5', () => {
    const resultado = calculateAdaptiveDifficulty({
      currentLevel: 3,
      correctStreak: 1,
      wrongStreak: 0,
      pidioSubirNivel: true,
    })
    assert.equal(resultado.tipo, 'sube')
    assert.equal(resultado.nivel_nuevo, 4)
    assert.match(resultado.motivo, /pidi[oó] expl[ií]citamente/i)
  })

  await test('sin racha correcta (fallo), la petición explícita no sube el nivel', () => {
    const resultado = calculateAdaptiveDifficulty({
      currentLevel: 3,
      correctStreak: 0,
      wrongStreak: 1,
      pidioSubirNivel: true,
    })
    assert.notEqual(resultado.tipo, 'sube')
  })

  await test('en el nivel máximo, la petición explícita no sube más allá de 8', () => {
    const resultado = calculateAdaptiveDifficulty({
      currentLevel: 8,
      correctStreak: 1,
      wrongStreak: 0,
      pidioSubirNivel: true,
    })
    assert.equal(resultado.nivel_nuevo, 8)
  })

  await test('sin petición explícita, el comportamiento normal (cada 5 aciertos) sigue igual', () => {
    const resultado = calculateAdaptiveDifficulty({
      currentLevel: 3,
      correctStreak: 1,
      wrongStreak: 0,
    })
    assert.equal(resultado.tipo, 'mantiene')
    assert.equal(resultado.nivel_nuevo, 3)
  })

  // ── Ítem 2 ──
  const problemaAplicacion = 'Juan tiene 24 manzanas y le regala 6 a cada uno de sus 3 amigos. ¿Cuántas manzanas le quedan a Juan? [OP: 24-6*3]'
  const ecuacionSimple = '¿Cuánto es 24 / 3 + 5? [OP: 24/3+5]'

  await test('reconoce un problema de aplicación por su redacción', () => {
    assert.equal(looksLikeWordProblem(problemaAplicacion), true)
    assert.equal(looksLikeWordProblem(ecuacionSimple), false)
  })

  await test('reconoce una respuesta de solo número sin procedimiento', () => {
    assert.equal(respuestaEsSoloNumero('6'), true)
    assert.equal(respuestaEsSoloNumero('6 manzanas'), true)
    assert.equal(respuestaEsSoloNumero('6 porque 24-18=6'), false)
    assert.equal(respuestaEsSoloNumero('24-6*3=6'), false)
  })

  await test('problema de aplicación respondido con solo el número: correcto pero pide el procedimiento', async () => {
    const resultado = await handleMathEvaluation(problemaAplicacion, '6', false)
    assert.equal(resultado?.estado, 'correcto')
    assert.equal(resultado?.procedimientoMostrado, false)
    assert.match(resultado?.feedback || '', /problema de aplicaci[oó]n/i)
    assert.match(resultado?.feedback || '', /ecuaci[oó]n u operaci[oó]n/i)
  })

  await test('problema de aplicación respondido mostrando el procedimiento: correcto sin pedir más', async () => {
    const resultado = await handleMathEvaluation(problemaAplicacion, '24-6*3=6', false)
    assert.equal(resultado?.estado, 'correcto')
    assert.equal(resultado?.procedimientoMostrado, true)
    assert.doesNotMatch(resultado?.feedback || '', /problema de aplicaci[oó]n/i)
  })

  await test('una ecuación simple (no problema de aplicación) respondida con solo el número no activa el pedido de procedimiento', async () => {
    const resultado = await handleMathEvaluation(ecuacionSimple, '13', false)
    assert.equal(resultado?.estado, 'correcto')
    assert.equal(resultado?.procedimientoMostrado, true)
  })

  await test('una respuesta incorrecta en un problema de aplicación no se ve afectada por este cambio', async () => {
    const resultado = await handleMathEvaluation(problemaAplicacion, '10', false)
    assert.equal(resultado?.estado, 'incorrecto')
  })

  await Promise.resolve()

  if (failures.length > 0) {
    console.error(`difficulty-continuity smoke failed: ${failures.length}/${total}`)
    for (const failure of failures) {
      console.error(`- ${failure.name}: ${failure.message}`)
    }
    process.exit(1)
  }

  console.log(`difficulty-continuity smoke passed: ${total}/${total}`)
}

main()
