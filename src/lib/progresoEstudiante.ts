// Rediseño premium (instructivo 2026-07-14): racha de días activos y puntos
// para el header del chat — calculados con datos reales de `interacciones`,
// no inventados. La zona horaria usada (Guatemala, UTC-6) es la misma que
// ya usa fechaGuatemala.ts para "actividad de hoy" en el resto de la app.
const GUATEMALA_OFFSET_MS = 6 * 60 * 60 * 1000
const UN_DIA_MS = 24 * 60 * 60 * 1000

export function fechaCalendarioGuatemala(fecha: Date): string {
  const gt = new Date(fecha.getTime() - GUATEMALA_OFFSET_MS)
  return `${gt.getUTCFullYear()}-${String(gt.getUTCMonth() + 1).padStart(2, '0')}-${String(gt.getUTCDate()).padStart(2, '0')}`
}

// Racha de días consecutivos con al menos una interacción, terminando hoy o
// ayer (si hoy todavía no hay actividad, la racha no se rompe hasta que pase
// un día completo sin ninguna interacción).
export function calcularRachaDiasActivos(timestampsIso: string[], ahora: Date = new Date()): number {
  const diasUnicos = new Set(
    timestampsIso
      .map((t) => new Date(t))
      .filter((d) => !isNaN(d.getTime()))
      .map((d) => fechaCalendarioGuatemala(d))
  )
  if (diasUnicos.size === 0) return 0

  const hoy = fechaCalendarioGuatemala(ahora)
  const ayer = fechaCalendarioGuatemala(new Date(ahora.getTime() - UN_DIA_MS))
  if (!diasUnicos.has(hoy) && !diasUnicos.has(ayer)) return 0

  let racha = 0
  let cursor = diasUnicos.has(hoy) ? ahora.getTime() : ahora.getTime() - UN_DIA_MS
  while (diasUnicos.has(fechaCalendarioGuatemala(new Date(cursor)))) {
    racha += 1
    cursor -= UN_DIA_MS
  }
  return racha
}

// Puntos: métrica simple y transparente (no una calificación oculta) — 10
// puntos por cada respuesta correcta o equivalente registrada.
export function calcularPuntos(totalCorrectas: number, puntosPorCorrecta = 10): number {
  return Math.max(0, Math.round(totalCorrectas)) * puntosPorCorrecta
}
