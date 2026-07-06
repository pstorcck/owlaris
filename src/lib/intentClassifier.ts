import { detectarMateriaDesdeTexto, materiaActualEnSistemaCNB, normalizarMateria } from './materiaDetection'
import { isReviewMistakesRequest } from './mistakeReview'
import { isCourseTopicListRequest, matchNumberedListSelection } from './courseTopics'
import { isExerciseRecallRequest, isLikelyMathAnswerText, isPendingContextQuestion } from './tutorContext'
import { isWorkedExampleRequest } from './mathPractice'
import { isExplicitCourseSwitchRequest } from './courseSwitchDetection'

// Categorías de intención del alumno — instructivo de mejoras, punto 2.
export type StudentIntent =
  | 'cambio_materia_grado'
  | 'seleccion_lista'
  | 'recordar_ejercicio'
  | 'aclaracion_mismo_paso'
  | 'solicitud_lista_temas'
  | 'solicitud_revisar_errores'
  | 'respuesta_ejercicio'
  | 'pregunta_directa'
  | 'no_evaluable'

export type BloqueEstructurado = 'lista_temas' | 'menu_opciones' | 'explicacion_pasos' | 'ejercicio' | null

// Estado conversacional del alumno — instructivo de mejoras, punto 23.
// Se construye y actualiza en el flujo principal (preguntar/route.ts); este
// módulo solo define su forma y la lógica de clasificación que lo consulta.
export type EstadoPedagogico = {
  gradoActivo: string | null
  materiaActiva: string | null
  fuenteActiva: string | null
  temaActivo: string | null
  subtemaActivo: string | null
  ejercicioActivo: string | null
  ejercicioAnterior: string | null
  pasoActual: string | null
  preguntaPendiente: string | null
  ultimoBloqueEstructurado: BloqueEstructurado
  ultimaListaTemas: string[] | null
  ultimasOpcionesMenu: string[] | null
  estadoEjercicio: 'abierto' | 'completado' | 'abandonado' | null
  ultimaIntencionAlumno: StudentIntent | null
  aciertosConsecutivos: number
  fallosConsecutivos: number
  nivelDificultad: number
  confianzaFuente: number | null
}

export function estadoPedagogicoInicial(): EstadoPedagogico {
  return {
    gradoActivo: null,
    materiaActiva: null,
    fuenteActiva: null,
    temaActivo: null,
    subtemaActivo: null,
    ejercicioActivo: null,
    ejercicioAnterior: null,
    pasoActual: null,
    preguntaPendiente: null,
    ultimoBloqueEstructurado: null,
    ultimaListaTemas: null,
    ultimasOpcionesMenu: null,
    estadoEjercicio: null,
    ultimaIntencionAlumno: null,
    aciertosConsecutivos: 0,
    fallosConsecutivos: 0,
    nivelDificultad: 1,
    confianzaFuente: null,
  }
}

export type ClasificacionInput = {
  pregunta: string
  ultimoMensajeAsistente: string
  hayEjercicioActivo: boolean
  materiaActivaId: string | null
  materiasDisponibles?: string[]
}

export type Clasificacion = {
  intencion: StudentIntent
  detalle?: {
    materiaDetectada?: string | null
    seleccionLista?: { indice: number; tema: string } | null
    cursoMencionado?: string | null
    coincideDisponible?: string | null
  }
}

// Clasificador formal de intención — instructivo de mejoras, puntos 2-3 y
// 25. Debe ejecutarse ANTES de evaluar el mensaje como respuesta a un
// ejercicio. El orden de los checks implementa la prioridad exigida:
// (1) seguridad — se resuelve antes de llegar aquí, en checkContentSafety;
// (2) cambio explícito de materia/grado; (3) selección sobre la última
// lista/menú mostrado; (4) preguntas directas específicas (recordar
// ejercicio, aclarar el mismo paso, revisar errores, pedir el índice de
// temas); (5) ejercicio activo pendiente; (6)-(7) sin contexto claro, se
// trata como pregunta directa o comentario no evaluable.
export function clasificarIntencion(input: ClasificacionInput): Clasificacion {
  const { pregunta, ultimoMensajeAsistente, hayEjercicioActivo, materiaActivaId, materiasDisponibles } = input

  if (materiaActivaId && materiaActualEnSistemaCNB(materiaActivaId)) {
    const materiaDetectada = detectarMateriaDesdeTexto(pregunta)
    if (materiaDetectada && materiaDetectada !== normalizarMateria(materiaActivaId)) {
      return { intencion: 'cambio_materia_grado', detalle: { materiaDetectada } }
    }
  }

  // Mención explícita de curso/grado independiente del set CNB — cubre
  // colegios con cursos granulares en inglés (eScholaris: "Science Grade
  // 8", "Biology Grade 10", "Geometry") que detectarMateriaDesdeTexto no
  // reconoce por nombre de materia. Instructivo de mejoras, punto 12/24.
  const cursoExplicito = isExplicitCourseSwitchRequest(pregunta, materiasDisponibles || [])
  if (cursoExplicito.detectado) {
    return {
      intencion: 'cambio_materia_grado',
      detalle: {
        cursoMencionado: cursoExplicito.cursoMencionado,
        coincideDisponible: cursoExplicito.coincideDisponible,
      },
    }
  }

  const seleccionLista = matchNumberedListSelection(pregunta, ultimoMensajeAsistente)
  if (seleccionLista) return { intencion: 'seleccion_lista', detalle: { seleccionLista } }

  if (isReviewMistakesRequest(pregunta)) return { intencion: 'solicitud_revisar_errores' }
  if (isCourseTopicListRequest(pregunta)) return { intencion: 'solicitud_lista_temas' }
  if (isExerciseRecallRequest(pregunta)) return { intencion: 'recordar_ejercicio' }
  if (isPendingContextQuestion(pregunta) && !isLikelyMathAnswerText(pregunta)) return { intencion: 'aclaracion_mismo_paso' }

  if (hayEjercicioActivo && (isLikelyMathAnswerText(pregunta) || isWorkedExampleRequest(pregunta))) {
    return { intencion: 'respuesta_ejercicio' }
  }

  if (pregunta.trim().length === 0) return { intencion: 'no_evaluable' }
  return { intencion: 'pregunta_directa' }
}
