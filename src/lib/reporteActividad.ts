// Consolida TODA la actividad del día (todas las materias/sesiones), no solo
// la sesión o materia activa al momento de descargar el "Reporte de hoy" —
// antes el reporte se reiniciaba cada vez que el alumno cambiaba de materia,
// perdiendo la actividad de la materia anterior en el mismo día.

export type FilaInteraccion = {
  materia_id?: string | null
  materia_nombre?: string | null
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
