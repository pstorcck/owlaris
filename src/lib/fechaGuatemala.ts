// Ventana del día calendario completo en Guatemala (UTC-6). Se usa en
// cualquier lugar que necesite contar "actividad de hoy" por alumno (límite
// diario de preguntas, reporte de hoy) — usar la fecha UTC cruda en vez de
// esto hace que el "día" reinicie a las 6pm hora de Guatemala (medianoche
// UTC) en vez de medianoche real en Guatemala.
export function ventanaHoyGuatemala(now: Date = new Date()) {
  const guatemalaOffsetMs = 6 * 60 * 60 * 1000
  const gtNow = new Date(now.getTime() - guatemalaOffsetMs)
  const startUtc = new Date(Date.UTC(gtNow.getUTCFullYear(), gtNow.getUTCMonth(), gtNow.getUTCDate(), 6, 0, 0, 0))
  return {
    start: startUtc,
    end: new Date(startUtc.getTime() + 24 * 60 * 60 * 1000),
  }
}
