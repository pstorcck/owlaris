import assert from 'node:assert/strict'
import {
  contarAlertasSensibles,
  contarSospechasCopia,
  resumenSeguridadIntegridad,
  type InteraccionSeguridad,
} from '../src/lib/reporteSeguridad'

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

function sesionNormal(n: number): InteraccionSeguridad[] {
  return Array.from({ length: n }, () => ({ estado_evaluacion: 'correcto', sospecha_copia: false }))
}

async function main() {
  // ── Una sesion sin ninguna senal no debe generar ninguna alerta. ──
  for (let i = 0; i < 30; i += 1) {
    const interacciones = sesionNormal((i % 10) + 1)
    test(`sesion-normal-sin-alertas-${i}`, () => {
      assert.equal(contarAlertasSensibles(interacciones), 0)
      assert.equal(contarSospechasCopia(interacciones), 0)
      assert.deepEqual(resumenSeguridadIntegridad(contarAlertasSensibles(interacciones), contarSospechasCopia(interacciones)), [])
    })
  }

  // ── Bloqueo de content safety (estado_evaluacion: 'alerta_seguridad') ──
  // simula exactamente la fila que preguntar/route.ts inserta cuando
  // checkContentSafety bloquea un mensaje.
  for (let i = 1; i <= 5; i += 1) {
    const interacciones: InteraccionSeguridad[] = [
      ...sesionNormal(4),
      ...Array.from({ length: i }, () => ({ estado_evaluacion: 'alerta_seguridad', sospecha_copia: false })),
    ]
    test(`cuenta-alertas-seguridad-${i}`, () => {
      assert.equal(contarAlertasSensibles(interacciones), i)
      const resumen = resumenSeguridadIntegridad(i, 0)
      assert.equal(resumen.length, 1)
      assert.match(resumen[0], /tema sensible/)
      assert.match(resumen[0], i === 1 ? /\b1 vez\b/ : new RegExp(`\\b${i} veces\\b`))
    })
  }

  // ── Clasificacion "crisis" (mas suave, sin bloqueo) tambien debe contarse. ──
  for (let i = 1; i <= 5; i += 1) {
    const interacciones: InteraccionSeguridad[] = [
      ...sesionNormal(3),
      ...Array.from({ length: i }, () => ({ estado_evaluacion: 'crisis_emocional', sospecha_copia: false })),
    ]
    test(`cuenta-crisis-emocional-${i}`, () => {
      assert.equal(contarAlertasSensibles(interacciones), i)
    })
  }

  // ── sospecha_copia (ya existia por fila, ahora debe leerse y contarse). ──
  for (let i = 1; i <= 5; i += 1) {
    const interacciones: InteraccionSeguridad[] = [
      ...sesionNormal(4),
      ...Array.from({ length: i }, () => ({ estado_evaluacion: 'correcto', sospecha_copia: true })),
    ]
    test(`cuenta-sospechas-copia-${i}`, () => {
      assert.equal(contarSospechasCopia(interacciones), i)
      const resumen = resumenSeguridadIntegridad(0, i)
      assert.equal(resumen.length, 1)
      assert.match(resumen[0], /copiar/)
      assert.match(resumen[0], i === 1 ? /\b1 posible intento\b/ : new RegExp(`\\b${i} posibles intentos\\b`))
    })
  }

  // ── Ambas senales a la vez deben aparecer juntas, en el orden correcto. ──
  test('ambas-alertas-juntas', () => {
    const interacciones: InteraccionSeguridad[] = [
      ...sesionNormal(3),
      { estado_evaluacion: 'alerta_seguridad', sospecha_copia: false },
      { estado_evaluacion: 'correcto', sospecha_copia: true },
    ]
    const resumen = resumenSeguridadIntegridad(contarAlertasSensibles(interacciones), contarSospechasCopia(interacciones))
    assert.equal(resumen.length, 2)
    assert.match(resumen[0], /tema sensible/)
    assert.match(resumen[1], /copiar/)
  })

  // ── En inglés (sesión practicada en inglés) debe traducirse por completo. ──
  test('bilingue-ingles', () => {
    const resumen = resumenSeguridadIntegridad(2, 3, true)
    assert.equal(resumen.length, 2)
    assert.match(resumen[0], /sensitive topic 2 times/)
    assert.match(resumen[1], /3 possible attempts/)
    assert.doesNotMatch(resumen.join(' '), /[áéíóúñ]/i)
  })

  // ── El texto sensible NUNCA debe aparecer en el resumen — solo el conteo. ──
  test('no-expone-texto-crudo', () => {
    const resumen = resumenSeguridadIntegridad(1, 1)
    for (const linea of resumen) {
      assert.doesNotMatch(linea, /me quiero matar|suicidar|abuso|violar|dame la respuesta/i)
    }
  })

  assert.equal(total, 30 + 5 + 5 + 5 + 1 + 1 + 1)

  if (failures.length > 0) {
    console.error(`reporte-seguridad stress failed: ${failures.length}/${total}`)
    for (const failure of failures.slice(0, 25)) {
      console.error(`- ${failure.name}: ${failure.message}`)
    }
    process.exit(1)
  }

  console.log(`reporte-seguridad stress passed: ${total}/${total}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
