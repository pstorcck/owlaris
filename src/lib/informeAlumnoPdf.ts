// Generador de PDF del Informe Pedagógico Familiar (reporte-alumno), en el
// mismo espíritu que el generador de "Reporte de hoy" de ChatInterface.tsx:
// jsPDF corriendo enteramente en el navegador, sin backend nuevo. Hallazgo
// real (2026-07-25): un botón "Descargar PDF" que solo abre el diálogo de
// impresión (window.print()) no se sintió como una descarga real para el
// usuario — pidió un PDF de verdad, con un clic. Se construye aquí en vez de
// reutilizar el generador de ChatInterface porque ese informe (actividad del
// día, vista del propio alumno) tiene secciones distintas a este (histórico
// familiar/pedagógico, vista de guía/director).

export type InformeAlumnoPdfData = {
  alumno: { nombreCompleto: string; email: string; grado: string; colegioNombre: string }
  fechaGeneradoLabel: string
  etiquetaPeriodo: string
  estadoGeneral: { txt: string; colorHex: string }
  lecturaFamilia: string
  tasaAcierto: number | null
  alertasAbiertas: number
  materiaPrioritaria: string | null
  fraseMotivacional: string
  rutaDificultad: {
    nivelFinal: number
    eventos: { tipo: 'sube' | 'baja' | 'refuerza'; nivelAnterior: number; nivelNuevo: number; motivo: string }[]
  }
  recomendaciones: string[]
  fortalezas: string[]
  resumenMaterias: { nombre: string; interacciones: number; tasa: number | null; temas: string[] }[]
  metricas: { totalSesiones: number; materias: number; temas: number; correctos: number; incorrectos: number; sospechas: number }
  alertas: { tipoLabel: string; descripcion: string | null; contexto: string | null; fechaLabel: string }[]
  ultimaActividadLabel: string
  conversaciones: {
    materia: string
    items: { tema: string; badgeTxt: string | null; fechaLabel: string; sospecha: boolean; pregunta: string; respuesta: string; documentoFuente: string | null }[]
  }[]
}

function hexToRgb(hex: string): number[] {
  const clean = hex.replace('#', '')
  const n = parseInt(clean, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export async function generarInformeAlumnoPdf(data: InformeAlumnoPdfData): Promise<void> {
  const { sanitizarTextoPdf } = await import('@/lib/pdfText')
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  // Mismo saneo que el generador de "Reporte de hoy": las fuentes estándar
  // de jsPDF solo cubren Latin-1 y corrompen emojis/caracteres fuera de ese
  // rango si el texto crudo del alumno los trae.
  const _docTextOriginal = doc.text.bind(doc)
  doc.text = ((texto: unknown, ...rest: unknown[]) =>
    (_docTextOriginal as (...args: unknown[]) => typeof doc)(sanitizarTextoPdf(texto), ...rest)) as typeof doc.text
  const _docSplitOriginal = doc.splitTextToSize.bind(doc)
  doc.splitTextToSize = ((texto: unknown, ...rest: unknown[]) =>
    (_docSplitOriginal as (...args: unknown[]) => string[])(sanitizarTextoPdf(texto), ...rest)) as typeof doc.splitTextToSize

  const W = 210
  const margin = 16
  const maxW = W - margin * 2
  let y = 0
  const palette = {
    ink: [20, 28, 45],
    muted: [96, 110, 130],
    violet: [109, 40, 217],
    blue: [37, 99, 235],
    teal: [14, 116, 144],
    green: [22, 163, 74],
    amber: [180, 83, 9],
    red: [185, 28, 28],
    line: [226, 232, 240],
  }
  const setColor = (color: number[]) => doc.setTextColor(color[0], color[1], color[2])
  const addPage = () => { doc.addPage(); y = 20 }
  const checkY = (needed = 10) => { if (y + needed > 276) addPage() }
  const text = (value: string, x: number, yy: number, size: number, bold = false, color = palette.ink) => {
    doc.setFontSize(size); doc.setFont('helvetica', bold ? 'bold' : 'normal'); setColor(color)
    doc.text(String(value || ''), x, yy)
  }
  const wrapped = (value: string, x: number, yy: number, width: number, size = 9.5, color = palette.muted, bold = false) => {
    doc.setFontSize(size); doc.setFont('helvetica', bold ? 'bold' : 'normal'); setColor(color)
    const lines = doc.splitTextToSize(String(value || ''), width)
    doc.text(lines, x, yy)
    return lines.length * (size * 0.38 + 1.6)
  }
  const section = (title: string, color = palette.violet) => {
    checkY(14)
    doc.setFillColor(color[0], color[1], color[2]); doc.roundedRect(margin, y, 3, 7, 1, 1, 'F')
    text(title, margin + 7, y + 5.2, 11, true, color)
    y += 13
  }
  const bulletList = (items: string[], color: number[]) => {
    for (const item of items.filter(Boolean)) {
      checkY(9)
      doc.setFillColor(color[0], color[1], color[2]); doc.circle(margin + 2, y - 1.5, 1.3, 'F')
      y += wrapped(item, margin + 7, y, maxW - 8, 9.2, palette.ink)
    }
    y += 2
  }
  const metricCard = (x: number, yy: number, w: number, title: string, value: string, color: number[]) => {
    doc.setFillColor(248, 250, 252); doc.roundedRect(x, yy, w, 22, 3, 3, 'F')
    text(title, x + 5, yy + 7, 7.2, true, palette.muted)
    let valueSize = 13
    doc.setFont('helvetica', 'bold'); doc.setFontSize(valueSize)
    while (valueSize > 7 && doc.getTextWidth(String(value || '')) > w - 10) {
      valueSize -= 0.5
      doc.setFontSize(valueSize)
    }
    text(value, x + 5, yy + 16, valueSize, true, color)
  }

  // Portada / encabezado
  doc.setFillColor(30, 58, 95); doc.rect(0, 0, W, 44, 'F')
  text('Owlaris', margin, 15, 15, true, [255, 255, 255])
  text('Informe Pedagógico Familiar', margin, 24, 10.5, false, [226, 232, 240])
  text(data.alumno.colegioNombre || 'Sin colegio', margin, 32, 9, false, [180, 190, 210])
  doc.setFontSize(16); doc.setFont('helvetica', 'bold'); setColor([255, 255, 255])
  doc.text(data.alumno.nombreCompleto, W - margin, 20, { align: 'right' })
  text(data.alumno.email, W - margin, 27, 9, false, [200, 210, 230])
  text(`Grado: ${data.alumno.grado || 'No asignado'}`, W - margin, 33, 9, false, [200, 210, 230])
  text(`Generado: ${data.fechaGeneradoLabel}`, W - margin, 39, 8, false, [180, 190, 210])
  y = 54

  const estadoColor = hexToRgb(data.estadoGeneral.colorHex)
  text('Período analizado:', margin, y, 9.5, true, palette.ink)
  text(data.etiquetaPeriodo, margin + 38, y, 9.5, false, palette.muted)
  doc.setFillColor(estadoColor[0], estadoColor[1], estadoColor[2])
  const estadoW = doc.getTextWidth(data.estadoGeneral.txt) + 10
  doc.roundedRect(W - margin - estadoW, y - 5, estadoW, 8, 3, 3, 'F')
  text(data.estadoGeneral.txt, W - margin - estadoW + 5, y, 8.5, true, [255, 255, 255])
  y += 10

  section('Lectura pedagógica')
  y += wrapped(data.lecturaFamilia, margin, y, maxW, 9.5, palette.ink)
  y += 6

  checkY(28)
  const cardW = (maxW - 6) / 3
  metricCard(margin, y, cardW, 'TASA DE ACIERTO', data.tasaAcierto !== null ? `${data.tasaAcierto}%` : 'N/D', data.tasaAcierto !== null && data.tasaAcierto < 65 ? palette.red : palette.green)
  metricCard(margin + cardW + 3, y, cardW, 'ALERTAS ABIERTAS', String(data.alertasAbiertas), data.alertasAbiertas > 0 ? palette.red : palette.green)
  metricCard(margin + (cardW + 3) * 2, y, cardW, 'MATERIA PRIORITARIA', data.materiaPrioritaria || 'Sin foco urgente', palette.violet)
  y += 30

  section('Mensaje para acompañar', palette.blue)
  y += wrapped(data.fraseMotivacional, margin, y, maxW, 9.8, palette.ink, true)
  y += 6

  section('Ruta adaptativa', palette.teal)
  text(`Dificultad final estimada: nivel ${data.rutaDificultad.nivelFinal}`, margin, y, 9.5, true, palette.teal)
  y += 8
  if (data.rutaDificultad.eventos.length > 0) {
    for (const ev of data.rutaDificultad.eventos) {
      checkY(9)
      const label = ev.tipo === 'sube' ? 'Subió' : ev.tipo === 'baja' ? 'Bajó' : 'Reforzó'
      text(label, margin, y, 8.5, true, ev.tipo === 'sube' ? palette.green : palette.amber)
      y += wrapped(`Nivel ${ev.nivelAnterior} -> ${ev.nivelNuevo}. ${ev.motivo}`, margin + 22, y - 3.2, maxW - 22, 8.8, palette.ink)
      y += 2
    }
  } else {
    y += wrapped('Aún no se detectó un punto de ajuste automático.', margin, y, maxW, 9, palette.muted)
  }
  y += 4

  section('Qué hacer esta semana')
  bulletList(data.recomendaciones, palette.violet)

  section('Fortalezas detectadas', palette.green)
  if (data.fortalezas.length > 0) {
    bulletList(data.fortalezas, palette.green)
  } else {
    y += wrapped('Aún no hay suficiente evidencia para marcar fortalezas.', margin, y, maxW, 9, palette.muted)
    y += 4
  }

  if (data.alertas.length > 0) {
    section('Alertas activas del estudiante', palette.red)
    for (const alerta of data.alertas) {
      checkY(16)
      text(alerta.tipoLabel, margin, y, 9, true, palette.red)
      text(alerta.fechaLabel, W - margin, y, 8, false, palette.muted)
      y += 5
      y += wrapped(alerta.descripcion || 'Alerta sin descripción.', margin, y, maxW, 9, palette.ink)
      if (alerta.contexto) y += wrapped(`Contexto: ${alerta.contexto}`, margin, y, maxW, 8.5, palette.muted)
      y += 4
    }
  }

  section('Resumen general')
  const metricasResumen = [
    ['Interacciones', String(data.metricas.totalSesiones)],
    ['Materias', String(data.metricas.materias)],
    ['Temas únicos', String(data.metricas.temas)],
    ['Logrados', String(data.metricas.correctos)],
    ['En práctica', String(data.metricas.incorrectos)],
    ['Revisión de autoría', String(data.metricas.sospechas)],
  ]
  const metricW = maxW / 3
  metricasResumen.forEach(([label, value], i) => {
    const col = i % 3
    const row = Math.floor(i / 3)
    checkY(row === 0 ? 20 : 4)
    text(value, margin + col * metricW, y + row * 16, 14, true, palette.violet)
    text(label, margin + col * metricW, y + row * 16 + 5, 7.5, false, palette.muted)
  })
  y += Math.ceil(metricasResumen.length / 3) * 16 + 4
  text(`Última actividad: ${data.ultimaActividadLabel}`, margin, y, 8.5, false, palette.muted)
  y += 10

  if (data.resumenMaterias.length > 0) {
    section('Rendimiento por materia')
    for (const m of data.resumenMaterias) {
      checkY(16)
      const color = m.tasa === null ? palette.muted : m.tasa < 65 ? palette.red : m.tasa < 80 ? palette.amber : palette.green
      text(m.nombre, margin, y, 9.5, true, palette.ink)
      text(m.tasa !== null ? `${m.tasa}%` : 'N/D', W - margin, y, 9.5, true, color)
      y += 5
      y += wrapped(`${m.interacciones} interacciones · ${m.temas.slice(0, 3).join(', ') || 'sin temas clasificados'}`, margin, y, maxW, 8.5, palette.muted)
      y += 5
    }
  }

  // Cada turno se dibuja como una caja separada por hablante (mismo criterio
  // que la vista web): etiqueta en mayúsculas + fondo propio, para que quede
  // inequívoco quién escribió qué en una lectura rápida o impresa.
  const speakerBox = (label: string, texto: string, labelColor: number[], bg: number[], border: number[]) => {
    const innerW = maxW - 10
    const lines = doc.splitTextToSize(String(texto || ''), innerW)
    const textH = lines.length * (9 * 0.38 + 1.6)
    const boxH = textH + 11
    checkY(boxH + 3)
    doc.setFillColor(bg[0], bg[1], bg[2]); doc.roundedRect(margin, y - 3, maxW, boxH, 2, 2, 'F')
    doc.setDrawColor(border[0], border[1], border[2]); doc.roundedRect(margin, y - 3, maxW, boxH, 2, 2, 'S')
    text(label, margin + 5, y + 3, 7, true, labelColor)
    wrapped(texto, margin + 5, y + 9, innerW, 9, palette.ink)
    y += boxH + 4
  }

  // Anexo: conversaciones completas por materia
  for (const grupo of data.conversaciones) {
    addPage()
    text(`Anexo — ${grupo.materia}`, margin, y, 12, true, palette.violet)
    y += 4
    doc.setDrawColor(palette.line[0], palette.line[1], palette.line[2])
    doc.line(margin, y, W - margin, y)
    y += 8
    for (const item of grupo.items) {
      checkY(20)
      doc.setFillColor(palette.violet[0], palette.violet[1], palette.violet[2])
      doc.rect(margin, y - 3.5, 1, 5, 'F')
      text(item.tema, margin + 4, y, 9, true, palette.violet)
      text(item.fechaLabel, W - margin, y, 8, false, palette.muted)
      y += 6
      speakerBox('ESTUDIANTE', item.pregunta, [100, 116, 139], [248, 250, 252], [226, 232, 240])
      speakerBox('OWLARIS (TUTOR)', item.respuesta, palette.violet, [238, 242, 255], [219, 234, 254])
      if (item.documentoFuente) { y += wrapped(`Fuente: ${item.documentoFuente}`, margin, y, maxW, 8, palette.teal) }
      y += 4
    }
  }

  // Pie de página con numeración
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); setColor(palette.muted)
    doc.text('Owlaris - Informe pedagógico familiar - owlaris.app', margin, 291)
    doc.text(`Página ${i} de ${totalPages}`, W - margin, 291, { align: 'right' })
  }

  const fecha = new Date().toISOString().split('T')[0]
  doc.save(`Owlaris-Informe-${data.alumno.nombreCompleto.replace(/ /g, '-')}-${fecha}.pdf`)
}
