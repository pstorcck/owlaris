// Consolida TODA la actividad del día (todas las materias/sesiones), no solo
// la sesión o materia activa al momento de descargar el "Reporte de hoy" —
// antes el reporte se reiniciaba cada vez que el alumno cambiaba de materia,
// perdiendo la actividad de la materia anterior en el mismo día.

export type FilaInteraccion = {
  materia_id?: string | null
  materia_nombre?: string | null
  materia_nombre_snapshot?: string | null
  tema_detectado?: string | null
  estado_evaluacion?: string | null
  operacion_canonica?: string | null
  op_respuesta_alumno?: string | null
  op_estado?: string | null
  pregunta?: string | null
  documento_fuente?: string | null
  modelo_usado?: string | null
  creado_en?: string | null
  sospecha_copia?: boolean | null
}

// Hallazgo real (auditoría QA 2026-07-07): el FK materia_id no siempre
// resuelve contra la tabla materias (el selector de materia usa nombres de
// carpetas de SharePoint, no esa tabla), así que muchas filas quedan con
// materia_id null. Antes, esas filas caían al fallback de "materia" = la
// materia ACTIVA al momento de generar el reporte, etiquetando TODA una
// sesión anterior con la última materia usada. materia_nombre_snapshot
// guarda, en cada turno, el nombre real usado en ESE momento (independiente
// del FK) — se prefiere sobre ese fallback engañoso.
export function resolverNombreMateria(
  nombreDesdeFK: string | null,
  fila: FilaInteraccion,
  materiaActualFallback: string | null
): string | null {
  return nombreDesdeFK || fila.materia_nombre_snapshot || (fila.materia_id ? null : materiaActualFallback || null)
}

const ESTADOS_CALIFICABLES = new Set(['correcto', 'incorrecto', 'equivalente', 'paso_correcto'])

// Actividad calificable: ejercicios con veredicto real (correcto/incorrecto/
// paso intermedio). Pedir un resumen, elegir un tema por número, pedir una
// explicación o usar un botón rápido NO es calificable — antes se contaba
// como "Ejercicio académico registrado" y distorsionaba la precisión.
export function esCalificable(fila: FilaInteraccion): boolean {
  return ESTADOS_CALIFICABLES.has(fila.estado_evaluacion || '')
}

export function esDeSeguridad(fila: FilaInteraccion): boolean {
  return fila.estado_evaluacion === 'alerta_seguridad' || fila.estado_evaluacion === 'crisis_emocional'
}

const ETIQUETAS_ACTIVIDAD_NO_CALIFICABLE: Record<string, { es: string; en: string }> = {
  topic_selection_guard: { es: 'Selección de tema', en: 'Topic selection' },
  mistake_review_guard: { es: 'Revisión de errores', en: 'Mistake review' },
  course_index_guard: { es: 'Índice de temas', en: 'Course topic index' },
  context_repair_guard: { es: 'Apoyo sobre ejercicio activo', en: 'Support on active exercise' },
  math_example_guard: { es: 'Ejemplo guiado', en: 'Guided example' },
  lesson_topic_clarifier: { es: 'Aclaración de tema', en: 'Topic clarification' },
  'gpt-4o-mini-conversation-fast': { es: 'Conversación en inglés', en: 'English conversation' },
}

export function describirActividad(fila: FilaInteraccion, idiomaIngles: boolean): string {
  if (fila.operacion_canonica) {
    return idiomaIngles ? `Exercise: ${fila.operacion_canonica}` : `Ejercicio: ${fila.operacion_canonica}`
  }
  if (esCalificable(fila)) {
    return idiomaIngles ? 'Graded activity' : 'Actividad calificada'
  }
  const etiqueta = ETIQUETAS_ACTIVIDAD_NO_CALIFICABLE[fila.modelo_usado || '']
  if (etiqueta) return idiomaIngles ? etiqueta.en : etiqueta.es
  return idiomaIngles ? 'Open question or explanation' : 'Pregunta abierta o explicación'
}

export function etiquetaResultadoActividad(fila: FilaInteraccion, idiomaIngles: boolean): string {
  if (fila.estado_evaluacion === 'correcto' || fila.estado_evaluacion === 'equivalente') return idiomaIngles ? 'Correct' : 'Correcta'
  if (fila.estado_evaluacion === 'incorrecto') return idiomaIngles ? 'To reinforce' : 'Por reforzar'
  if (fila.estado_evaluacion === 'paso_correcto') return idiomaIngles ? 'Correct step' : 'Paso correcto'
  return idiomaIngles ? 'Not graded' : 'No calificable'
}

export type EvidenciaActividad = {
  secuencia: number
  hora: string
  materia: string
  calificable: boolean
  tema: string
  ejercicio: string
  respuesta_estudiante: string
  resultado: string
  fuente: string
}

// Hallazgo real (auditoría QA 2026-07-07): cuando el alumno responde bien y
// se le presenta un ejercicio siguiente, esa fila guarda en
// operacion_canonica el ejercicio NUEVO (op_estado 'pendiente', aún sin
// responder) — no el que la propia fila.pregunta acaba de responder. Ese
// emparejamiento correcto se completa más tarde con un UPDATE sobre la fila
// ANTERIOR (la que sí tenía pendiente el ejercicio recién resuelto). Si ese
// UPDATE no llega a reflejarse (p. ej. el ejercicio se abandonó por el bug
// de continuidad de tema), el anexo mostraba el operacion_canonica de ESTA
// fila junto a la respuesta que en realidad contestó el ejercicio de la
// fila anterior — un desfase de una posición. La fuente de verdad
// confiable no depende de ese UPDATE: en el momento en que se inserta cada
// fila, operacion_canonica siempre describe "el ejercicio que esta fila le
// presenta al alumno para el próximo turno", así que el ejercicio que
// fila.pregunta realmente responde es el operacion_canonica de la fila
// anterior — se reconstruye desplazando esa referencia una posición.
export function construirEvidenciaActividad(filasCrudas: FilaInteraccion[], idiomaIngles = false, horaFn?: (creadoEn: string) => string): EvidenciaActividad[] {
  const filasAcademicas = filasCrudas.filter(i => !esDeSeguridad(i))
  let operacionPendienteAnterior: string | null = null
  const filasConEjercicioCorrecto = filasAcademicas.map((i) => {
    const ejercicioRespondido = operacionPendienteAnterior
    if (i.operacion_canonica) operacionPendienteAnterior = i.operacion_canonica
    return { ...i, operacion_canonica: ejercicioRespondido ?? i.operacion_canonica }
  })

  return filasConEjercicioCorrecto
    .map((i, idx) => ({
      secuencia: idx + 1,
      hora: i.creado_en
        ? (horaFn ? horaFn(i.creado_en) : new Date(i.creado_en).toLocaleTimeString(idiomaIngles ? 'en-US' : 'es-GT', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Guatemala' }))
        : '',
      materia: (i.materia_nombre || '').trim(),
      calificable: esCalificable(i),
      tema: (i.tema_detectado || (idiomaIngles ? 'Guided practice' : 'Práctica guiada')).replace(/\s+/g, ' ').trim().substring(0, 120),
      ejercicio: describirActividad(i, idiomaIngles),
      respuesta_estudiante: (i.op_respuesta_alumno || i.pregunta || '').replace(/\s+/g, ' ').trim().substring(0, 240),
      resultado: etiquetaResultadoActividad(i, idiomaIngles),
      fuente: i.documento_fuente || '',
    }))
    // Punto 12: TODA la actividad del alumno, no solo ejercicios evaluados.
    // El límite es solo una salvaguarda técnica para PDFs extremadamente largos.
    .slice(0, 150)
}

export type ResumenMateria = {
  materia: string
  temas: string[]
  ejerciciosCalificables: number
  correctas: number
  incorrectas: number
  precision: number | null
}

// Agrupa por materia real (no por la materia activa al momento de generar el
// PDF), para que la primera página resuma TODAS las materias trabajadas hoy.
export function agruparPorMateria(filas: FilaInteraccion[], materiaFallback: string): ResumenMateria[] {
  const grupos = new Map<string, { temas: Set<string>; correctas: number; incorrectas: number }>()
  const orden: string[] = []
  for (const fila of filas) {
    const nombre = (fila.materia_nombre || materiaFallback || '').trim() || 'Sin materia'
    if (!grupos.has(nombre)) {
      grupos.set(nombre, { temas: new Set(), correctas: 0, incorrectas: 0 })
      orden.push(nombre)
    }
    const grupo = grupos.get(nombre)!
    const tema = (fila.tema_detectado || '').trim()
    if (tema) grupo.temas.add(tema)
    if (fila.estado_evaluacion === 'correcto' || fila.estado_evaluacion === 'equivalente') grupo.correctas += 1
    else if (fila.estado_evaluacion === 'incorrecto') grupo.incorrectas += 1
  }
  return orden.map((materia) => {
    const g = grupos.get(materia)!
    const evaluadas = g.correctas + g.incorrectas
    return {
      materia,
      temas: Array.from(g.temas).slice(0, 8),
      ejerciciosCalificables: evaluadas,
      correctas: g.correctas,
      incorrectas: g.incorrectas,
      precision: evaluadas > 0 ? Math.round((g.correctas / evaluadas) * 100) : null,
    }
  })
}

export type EstadoEvidencia = 'suficiente' | 'parcial' | 'insuficiente'

// Cuántos ejercicios calificables hay hoy determina qué tan lejos puede
// llegar el reporte con sus conclusiones — evita presentar una sesión de
// exploración breve como si fuera un diagnóstico completo.
export function estadoEvidencia(totalCalificables: number): EstadoEvidencia {
  if (totalCalificables >= 4) return 'suficiente'
  if (totalCalificables >= 1) return 'parcial'
  return 'insuficiente'
}

export function fraseEstadoEvidencia(estado: EstadoEvidencia, idiomaIngles: boolean): string {
  if (estado === 'suficiente') {
    return idiomaIngles
      ? 'Evidence recorded today is enough to guide conclusions about the session.'
      : 'La evidencia registrada hoy es suficiente para orientar conclusiones sobre la sesión.'
  }
  if (estado === 'parcial') {
    return idiomaIngles
      ? 'Today\'s evidence is partial — only a few graded exercises were recorded. More practice will give a clearer picture.'
      : 'La evidencia de hoy es parcial — se registraron pocos ejercicios calificables. Más práctica dará una lectura más clara.'
  }
  return idiomaIngles
    ? 'Today\'s recorded activity is limited. More practice is recommended before drawing conclusions about understanding.'
    : 'La actividad registrada hoy es limitada. Se recomienda más práctica antes de sacar conclusiones sobre comprensión.'
}
