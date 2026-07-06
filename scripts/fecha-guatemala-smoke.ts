import assert from 'node:assert/strict'
import { ventanaHoyGuatemala } from '../src/lib/fechaGuatemala'

function main() {
  // Bug real: usar la fecha UTC cruda (new Date().toISOString().split('T')[0])
  // hace que el "día" reinicie a las 6pm hora de Guatemala (medianoche UTC),
  // no a medianoche real en Guatemala — permitiendo hasta el doble del
  // límite diario configurado si el alumno pregunta antes y después de esa
  // hora. ventanaHoyGuatemala() debe dar la MISMA ventana durante todo el
  // día calendario real en Guatemala (medianoche a medianoche GT).
  const momentosDelMismoDiaGT = [
    '2026-07-07T14:00:00Z', // 8:00am GT (GT = UTC-6)
    '2026-07-07T20:00:00Z', // 2:00pm GT
    '2026-07-07T23:59:00Z', // 5:59pm GT
    '2026-07-08T00:00:00Z', // 6:00pm GT — el momento exacto donde el bug UTC cambiaba de "día"
    '2026-07-08T02:00:00Z', // 8:00pm GT
    '2026-07-08T05:59:00Z', // 11:59pm GT
  ]

  let ventanaEsperada: string | null = null
  for (const momento of momentosDelMismoDiaGT) {
    const { start } = ventanaHoyGuatemala(new Date(momento))
    if (ventanaEsperada === null) ventanaEsperada = start.toISOString()
    assert.equal(start.toISOString(), ventanaEsperada, `la ventana cambió a mitad del día real de Guatemala (momento UTC: ${momento})`)
  }

  // El primer momento después de medianoche real en Guatemala (6:00am UTC)
  // SÍ debe iniciar una ventana nueva.
  const { start: inicioSiguienteDia } = ventanaHoyGuatemala(new Date('2026-07-08T06:00:00Z'))
  assert.notEqual(inicioSiguienteDia.toISOString(), ventanaEsperada, 'debería haber una ventana nueva después de medianoche real en Guatemala')

  // La ventana debe durar exactamente 24 horas.
  const { start, end } = ventanaHoyGuatemala(new Date('2026-07-07T14:00:00Z'))
  assert.equal(end.getTime() - start.getTime(), 24 * 60 * 60 * 1000)

  // El inicio de la ventana debe corresponder a medianoche EN GUATEMALA
  // (06:00 UTC), no medianoche UTC.
  assert.equal(start.getUTCHours(), 6)

  console.log('fecha-guatemala smoke passed')
}

main()
