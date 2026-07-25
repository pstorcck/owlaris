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

// Misma ventana de día calendario Guatemala, pero para CUALQUIER fecha (no
// solo hoy) — usada por el filtro "ver por día" del informe de alumno, para
// que un padre/guía/director pueda revisar un día pasado puntual.
export function ventanaDiaGuatemala(fechaYYYYMMDD: string) {
  const [anio, mes, dia] = fechaYYYYMMDD.split('-').map(Number)
  const startUtc = new Date(Date.UTC(anio, mes - 1, dia, 6, 0, 0, 0))
  return {
    start: startUtc,
    end: new Date(startUtc.getTime() + 24 * 60 * 60 * 1000),
  }
}

// Clave YYYY-MM-DD del día calendario Guatemala al que pertenece un
// timestamp — usada para agrupar interacciones por día sin repetir la
// aritmética de offset en cada lugar que lo necesite.
export function diaGuatemalaDeFecha(iso: string): string {
  const guatemalaOffsetMs = 6 * 60 * 60 * 1000
  const gt = new Date(new Date(iso).getTime() - guatemalaOffsetMs)
  const anio = gt.getUTCFullYear()
  const mes = String(gt.getUTCMonth() + 1).padStart(2, '0')
  const dia = String(gt.getUTCDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}
