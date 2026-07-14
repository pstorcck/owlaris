import assert from 'node:assert/strict'
import { calcularPuntos, calcularRachaDiasActivos, fechaCalendarioGuatemala } from '../src/lib/progresoEstudiante'

function main() {
  // fechaCalendarioGuatemala: Guatemala es UTC-6, así que medianoche UTC
  // todavía es el día anterior en Guatemala.
  assert.equal(fechaCalendarioGuatemala(new Date('2026-07-14T00:00:00Z')), '2026-07-13')
  assert.equal(fechaCalendarioGuatemala(new Date('2026-07-14T06:00:00Z')), '2026-07-14')
  assert.equal(fechaCalendarioGuatemala(new Date('2026-07-14T23:59:59Z')), '2026-07-14')

  const ahora = new Date('2026-07-14T18:00:00Z') // 12:00pm Guatemala

  // Sin actividad → racha 0.
  assert.equal(calcularRachaDiasActivos([], ahora), 0)

  // Actividad solo hoy → racha 1.
  assert.equal(calcularRachaDiasActivos(['2026-07-14T15:00:00Z'], ahora), 1)

  // Actividad hoy + los 3 días anteriores consecutivos → racha 4.
  assert.equal(calcularRachaDiasActivos([
    '2026-07-14T15:00:00Z',
    '2026-07-13T15:00:00Z',
    '2026-07-12T15:00:00Z',
    '2026-07-11T15:00:00Z',
  ], ahora), 4)

  // Actividad ayer pero no hoy todavía → la racha no se rompe (no ha pasado
  // un día completo sin actividad), se cuenta desde ayer hacia atrás.
  assert.equal(calcularRachaDiasActivos([
    '2026-07-13T15:00:00Z',
    '2026-07-12T15:00:00Z',
  ], ahora), 2)

  // Actividad hace 3 días, nada ayer ni hoy → racha rota, 0.
  assert.equal(calcularRachaDiasActivos(['2026-07-11T15:00:00Z'], ahora), 0)

  // Un hueco en medio corta la racha (cuenta solo desde el día más reciente
  // hacia atrás hasta el primer día sin actividad).
  assert.equal(calcularRachaDiasActivos([
    '2026-07-14T15:00:00Z',
    '2026-07-13T15:00:00Z',
    '2026-07-11T15:00:00Z', // hueco en el 12
  ], ahora), 2)

  // Múltiples interacciones el mismo día no inflan la racha.
  assert.equal(calcularRachaDiasActivos([
    '2026-07-14T10:00:00Z',
    '2026-07-14T15:00:00Z',
    '2026-07-14T20:00:00Z',
  ], ahora), 1)

  // Timestamps inválidos se ignoran sin romper el cálculo.
  assert.equal(calcularRachaDiasActivos(['no-es-fecha', '2026-07-14T15:00:00Z'], ahora), 1)

  // Puntos: métrica simple y transparente, 10 por acierto.
  assert.equal(calcularPuntos(0), 0)
  assert.equal(calcularPuntos(5), 50)
  assert.equal(calcularPuntos(42), 420)
  assert.equal(calcularPuntos(-3), 0, 'no debe dar puntos negativos')
  assert.equal(calcularPuntos(3.7), 40, 'redondea antes de multiplicar')

  console.log('progreso-estudiante smoke passed')
}

main()
