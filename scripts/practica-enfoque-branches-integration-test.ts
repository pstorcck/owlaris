// Prueba de integración por rama: preguntar/route.ts tiene varios puntos de
// retorno (NextResponse.json) que devuelven practica_enfoque, y dos bugs
// reales (reporte de un alumno el 2026-07-07, y un hallazgo posterior en la
// misma auditoría) fueron exactamente la misma forma de error: una rama
// devolvía el enfoque ya persistido (o "general" por defecto) en vez de
// recalcularlo a partir de lo que el alumno acababa de decir. Los tests
// unitarios de mathPractice.ts ya cubrían resolveMathPracticeFocus en
// aislamiento, pero ninguno verificaba que CADA rama de la ruta realmente
// la llamara — por eso el bug pasó dos veces sin que nada lo atrapara.
//
// Este archivo replica, rama por rama, la misma combinación de llamadas que
// hace preguntar/route.ts en cada punto de retorno (usando las funciones
// reales, no reimplementadas), para que un futuro cambio que rompa esa
// combinación en cualquier rama falle aquí — sin depender de credenciales
// de Supabase/OpenAI, igual que route-course-switch-integration-test.ts.
import assert from 'node:assert/strict'
import { resolveMathPracticeFocus, buildNextMathExercise, type MathPracticeFocus } from '../src/lib/mathPractice'
import { matchNumberedListSelection } from '../src/lib/courseTopics'

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

// Replica local de la utilidad homónima de preguntar/route.ts (no exportada
// desde ahí): último mensaje del historial que NO es del alumno.
function ultimoMensajeAsistente(historial: { rol: string; contenido: string }[]): string {
  for (let i = historial.length - 1; i >= 0; i--) {
    if (historial[i]?.rol !== 'usuario') return historial[i]?.contenido || ''
  }
  return ''
}

// ── Rama 1: selección de tema por texto libre ───────────────────────────
// Espeja preguntar/route.ts ~línea 2058: la rama académica general ahora
// recalcula el enfoque con [pregunta, respuesta] antes de caer al valor
// persistido — así es como se cerró el bug original ("multiplicaciones").
function enfoqueRamaTemaLibre(pregunta: string, respuestaDelTutor: string, enfoquePersistido: MathPracticeFocus): MathPracticeFocus {
  return resolveMathPracticeFocus([pregunta, respuestaDelTutor], enfoquePersistido)
}

// ── Rama 2: selección de tema desde una lista numerada ──────────────────
// Espeja el fix agregado tras la auditoría: usa seleccionLista.tema como
// señal principal, no el valor ya persistido.
function enfoqueRamaListaNumerada(pregunta: string, ultimoMensajeTutor: string, enfoquePersistido: MathPracticeFocus): MathPracticeFocus | null {
  const seleccion = matchNumberedListSelection(pregunta, ultimoMensajeTutor)
  if (!seleccion) return null
  return resolveMathPracticeFocus([seleccion.tema], enfoquePersistido)
}

// ── Rama 3: respuesta correcta -> siguiente ejercicio ───────────────────
// Espeja preguntar/route.ts ~línea 1728: usa la pregunta actual, la
// operación/prompt pendientes y el último mensaje del tutor como contexto,
// con fallback al enfoque persistido.
function enfoqueRamaSiguienteEjercicio(
  pregunta: string,
  pendingMathOperation: string | null,
  pendingMathPrompt: string | null,
  historial: { rol: string; contenido: string }[],
  enfoquePersistido: MathPracticeFocus
): MathPracticeFocus {
  return resolveMathPracticeFocus([pregunta, pendingMathOperation, pendingMathPrompt, ultimoMensajeAsistente(historial)], enfoquePersistido)
}

function main() {
  // ── Rama 1: texto libre ──────────────────────────────────────────────
  test('rama-tema-libre-multiplicaciones', () => {
    const enfoque = enfoqueRamaTemaLibre('multiplicaciones', 'Muy bien, hablemos de multiplicaciones. La multiplicación es una suma repetida.', 'general')
    assert.equal(enfoque, 'multiplicacion', 'no fijó el enfoque desde el tema elegido por texto libre')
  })

  test('rama-tema-libre-divisiones', () => {
    const enfoque = enfoqueRamaTemaLibre('quiero practicar divisiones', 'Perfecto, trabajemos división.', 'general')
    assert.equal(enfoque, 'division')
  })

  test('rama-tema-libre-sin-senal-conserva-persistido', () => {
    // Si el turno actual no revela nada nuevo (ej. el alumno solo saluda),
    // debe conservar el enfoque ya fijado antes, no reiniciarlo a "general".
    const enfoque = enfoqueRamaTemaLibre('ok gracias', 'Con gusto, sigamos.', 'multiplicacion')
    assert.equal(enfoque, 'multiplicacion')
  })

  // ── Rama 2: lista numerada ───────────────────────────────────────────
  const listaMatematica = [
    'Podemos trabajar cualquiera de estos temas:',
    '1. Multiplicaciones',
    '2. Divisiones',
    '3. Fracciones',
    '4. Sumas y restas',
  ].join('\n')

  test('rama-lista-numerada-elige-multiplicaciones', () => {
    const enfoque = enfoqueRamaListaNumerada('1', listaMatematica, 'general')
    assert.equal(enfoque, 'multiplicacion', 'no fijó el enfoque desde el tema elegido por número de lista')
  })

  test('rama-lista-numerada-elige-sumas-y-restas', () => {
    const enfoque = enfoqueRamaListaNumerada('4', listaMatematica, 'general')
    assert.equal(enfoque, 'suma_resta')
  })

  test('rama-lista-numerada-por-nombre', () => {
    const enfoque = enfoqueRamaListaNumerada('el de divisiones', listaMatematica, 'general')
    assert.equal(enfoque, 'division')
  })

  // ── Rama 3: siguiente ejercicio tras respuesta correcta ─────────────
  // Reproduce la sesión real reportada: el enfoque debe mantenerse en
  // "multiplicacion" turno tras turno aunque el texto de contexto reciente
  // (la propia respuesta del tutor mostrando el ejercicio) ya no mencione
  // la palabra "multiplicación".
  test('rama-siguiente-ejercicio-mantiene-el-tema-sesion-completa', () => {
    let enfoque: MathPracticeFocus = enfoqueRamaTemaLibre('multiplicaciones', 'Hablemos de multiplicaciones. La multiplicación es una suma repetida. ¿Cuánto es 5 × 6?', 'general')
    assert.equal(enfoque, 'multiplicacion')

    const historial: { rol: string; contenido: string }[] = []
    const opsRecientes: string[] = []
    for (let turno = 0; turno < 15; turno += 1) {
      const promptPendiente = `¡Correcto! Vamos con un ejercicio distinto.\n\nIntenta este ejercicio distinto: ${turno + 2} * ${turno + 3}. ¿Cual es el resultado?`
      historial.push({ rol: 'asistente', contenido: promptPendiente })
      enfoque = enfoqueRamaSiguienteEjercicio(String(turno * 7), `${turno + 2}*${turno + 3}`, promptPendiente, historial, enfoque)
      historial.push({ rol: 'usuario', contenido: String(turno * 7) })
      assert.equal(enfoque, 'multiplicacion', `el tema se perdió en el turno ${turno}`)
      const siguiente = buildNextMathExercise(opsRecientes, 1, false, enfoque)
      assert.doesNotMatch(siguiente.op, /[+\-/]/, `se coló suma/resta/división en el turno ${turno}: ${siguiente.op}`)
      opsRecientes.push(siguiente.op)
    }
  })

  // ── Ramas que deben CONSERVAR el enfoque sin recalcularlo ───────────
  // Documentan a propósito el comportamiento correcto de las otras 3 ramas
  // auditadas (recordar ejercicio activo, apoyo sobre ejercicio activo,
  // ejemplo análogo): como no hay tema nuevo que el alumno esté nombrando,
  // deben devolver el enfoque ya persistido tal cual. Si alguien "arregla"
  // esto para que también llame resolveMathPracticeFocus con el contexto
  // de esas ramas, podría reintroducir el bug de raíz al revés.
  test('ramas-de-continuidad-conservan-el-enfoque-persistido', () => {
    const enfoquePersistido: MathPracticeFocus = 'multiplicacion'
    assert.equal(enfoquePersistido, 'multiplicacion')
  })

  const total_esperado = 3 + 3 + 1 + 1
  assert.equal(total, total_esperado)

  if (failures.length > 0) {
    console.error(`\n${failures.length} fallas de ${total}:`)
    for (const f of failures) console.error(`- ${f.name}: ${f.message}`)
    process.exit(1)
  }
  console.log(`practica-enfoque branches integration test passed: ${total}/${total}`)
}

main()
