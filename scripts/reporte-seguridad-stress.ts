import assert from 'node:assert/strict'
import {
  contarAlertasSensibles,
  contarSospechasCopia,
  resumenBienestarSeguridad,
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
      assert.deepEqual(resumenBienestarSeguridad(contarAlertasSensibles(interacciones)), [])
      assert.deepEqual(resumenSeguridadIntegridad(contarSospechasCopia(interacciones)), [])
    })
  }

  // ── Bloqueo de content safety (estado_evaluacion: 'alerta_seguridad') ──
  // simula exactamente la fila que preguntar/route.ts inserta cuando
  // checkContentSafety bloquea un mensaje. Hallazgo real (QA Ronda 3,
  // 2026-07-10): esto debe producir su PROPIA sección de bienestar, no un
  // texto genérico mezclado con honestidad académica.
  for (let i = 1; i <= 5; i += 1) {
    const interacciones: InteraccionSeguridad[] = [
      ...sesionNormal(4),
      ...Array.from({ length: i }, () => ({ estado_evaluacion: 'alerta_seguridad', sospecha_copia: false })),
    ]
    test(`cuenta-alertas-seguridad-${i}`, () => {
      assert.equal(contarAlertasSensibles(interacciones), i)
      const resumen = resumenBienestarSeguridad(i)
      assert.equal(resumen.length, 1)
      assert.match(resumen[0], /bienestar o seguridad/)
      assert.match(resumen[0], i === 1 ? /\b1 momento\b/ : new RegExp(`\\b${i} momentos\\b`))
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
      const resumen = resumenSeguridadIntegridad(i)
      assert.equal(resumen.length, 1)
      assert.match(resumen[0], /copiar/)
      assert.match(resumen[0], i === 1 ? /\b1 posible intento\b/ : new RegExp(`\\b${i} posibles intentos\\b`))
    })
  }

  // ── Ambas senales a la vez deben producir cada una su propio resumen,
  // en secciones separadas (ya no un solo arreglo combinado). ──
  test('ambas-alertas-por-separado', () => {
    const interacciones: InteraccionSeguridad[] = [
      ...sesionNormal(3),
      { estado_evaluacion: 'alerta_seguridad', sospecha_copia: false },
      { estado_evaluacion: 'correcto', sospecha_copia: true },
    ]
    const bienestar = resumenBienestarSeguridad(contarAlertasSensibles(interacciones))
    const integridad = resumenSeguridadIntegridad(contarSospechasCopia(interacciones))
    assert.equal(bienestar.length, 1)
    assert.equal(integridad.length, 1)
    assert.match(bienestar[0], /bienestar o seguridad/)
    assert.match(integridad[0], /copiar/)
  })

  // ── En inglés (sesión practicada en inglés) debe traducirse por completo. ──
  test('bilingue-ingles', () => {
    const bienestar = resumenBienestarSeguridad(2, true)
    const integridad = resumenSeguridadIntegridad(3, true)
    assert.equal(bienestar.length, 1)
    assert.equal(integridad.length, 1)
    assert.match(bienestar[0], /2 moments/)
    assert.match(integridad[0], /3 possible attempts/)
    assert.doesNotMatch(bienestar.join(' ') + integridad.join(' '), /[áéíóúñ]/i)
  })

  // ── El texto sensible NUNCA debe aparecer en el resumen — solo el conteo. ──
  test('no-expone-texto-crudo', () => {
    const bienestar = resumenBienestarSeguridad(1)
    const integridad = resumenSeguridadIntegridad(1)
    for (const linea of [...bienestar, ...integridad]) {
      assert.doesNotMatch(linea, /me quiero matar|suicidar|abuso|violar|dame la respuesta|pastillas|drogas|gordo/i)
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
