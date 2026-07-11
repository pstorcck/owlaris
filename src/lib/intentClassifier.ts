import { detectarMateriaDesdeTexto, isLanguageSwitchRequest, materiaActualEnSistemaCNB, normalizarMateria } from './materiaDetection'
import { isReviewMistakesRequest } from './mistakeReview'
import { isCourseTopicListRequest, matchNumberedListSelection } from './courseTopics'
import { isExerciseRecallRequest, isLikelyMathAnswerText, isPendingContextQuestion, isReporteDeHoyRequest } from './tutorContext'
import { isWorkedExampleRequest } from './mathPractice'
import { isExplicitCourseSwitchRequest } from './courseSwitchDetection'
import { isFormatRequest } from './chatFormatting'

// Categorías de intención del alumno — instructivo de mejoras, punto 2.
// solicitud_idioma, solicitud_reporte y solicitud_formato se agregan en el
// instructivo de mejoras (ronda 2026-07-11), ítem 29: peticiones de idioma
// de respuesta, del "Reporte de hoy" real, o de formato (tabla/lista) no
// son ni un cambio de tema ni una pregunta académica nueva — son acciones
// puntuales sobre la conversación en curso.
export type StudentIntent =
  | 'cambio_materia_grado'
  | 'seleccion_lista'
  | 'recordar_ejercicio'
  | 'aclaracion_mismo_paso'
  | 'solicitud_lista_temas'
  | 'solicitud_revisar_errores'
  | 'solicitud_idioma'
  | 'solicitud_reporte'
  | 'solicitud_formato'
  | 'respuesta_ejercicio'
  | 'pregunta_directa'
  | 'no_evaluable'

export type BloqueEstructurado = 'lista_temas' | 'menu_opciones' | 'explicacion_pasos' | 'ejercicio' | null

// Estado conversacional del alumno — instructivo de mejoras, punto 23 y,
// en su revisión más reciente (ronda 2026-07-11), ítem 30 (auditoría
// completa del estado pedagógico).
//
// AUDITORÍA (ítem 30): este tipo describe la forma completa del estado que
// Owlaris debería mantener por turno, pero preguntar/route.ts NO construye
// ni persiste un único objeto EstadoPedagogico — cada pieza equivalente
// vive hoy en una variable local propia dentro de ese archivo:
//   gradoActivo          -> gradoEfectivo
//   materiaActiva        -> materiaConsultaSharePoint / materia_id
//   fuenteActiva         -> documentoFuente
//   temaActivo           -> tema_detectado (por turno, no persistido)
//   subtemaActivo        -> sin variable dedicada (se infiere del prompt)
//   ejercicioActivo      -> pendingMathOperation / pendingMathId
//   ejercicioAnterior    -> ultimoMensajeAsistente(historial) + inferCanonicalOperationFromText
//   pasoActual           -> pasoIntermedio (evaluacionProtocolo)
//   preguntaPendiente    -> preguntaPendiente (registrarPendiente)
//   ultimoBloqueEstructurado / ultimaListaTemas -> extractCourseTopicIndex sobre el último mensaje, recalculado cada vez (no cacheado)
//   estadoEjercicio      -> sin variable dedicada (se infiere de pendingMathId != null)
//   ultimaIntencionAlumno -> no se persiste entre turnos (clasificarIntencion se llama de nuevo cada vez)
//   aciertosConsecutivos / fallosConsecutivos -> rachaAprendizaje (obtenerRachaAprendizaje)
//   nivelDificultad      -> nivelDificultadActual
//   confianzaFuente      -> sin variable dedicada
//   pidioCambiarNivel    -> isExplicitDifficultyUpRequest(pregunta), calculado por turno
// Consolidar todo esto en un único objeto persistido (en vez de ~15
// variables locales recalculadas por turno) es un refactor de mayor
// alcance que toca casi todo route.ts — se documenta aquí la equivalencia
// real en vez de intentar una reescritura arriesgada tarde en esta sesión.
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
  // Ítem 1/30: si el alumno pidió explícitamente subir o bajar el nivel en
  // este turno — ver isExplicitDifficultyUpRequest en mathPractice.ts.
  pidioCambiarNivel: 'subir' | 'bajar' | null
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
    pidioCambiarNivel: null,
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
    if (materiaDetectada && materiaDetectada !== normalizarMateria(materiaActivaId) && !isLanguageSwitchRequest(pregunta)) {
      return { intencion: 'cambio_materia_grado', detalle: { materiaDetectada } }
    }
  }

  // Mención explícita de curso/grado independiente del set CNB — cubre
  // colegios con cursos granulares en inglés (eScholaris: "Science Grade
  // 8", "Biology Grade 10", "Geometry") que detectarMateriaDesdeTexto no
  // reconoce por nombre de materia. Instructivo de mejoras, punto 12/24.
  const cursoExplicito = isExplicitCourseSwitchRequest(pregunta, materiasDisponibles || [])
  if (cursoExplicito.detectado && !isLanguageSwitchRequest(pregunta)) {
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
  if (isReporteDeHoyRequest(pregunta)) return { intencion: 'solicitud_reporte' }
  if (isLanguageSwitchRequest(pregunta)) return { intencion: 'solicitud_idioma' }
  if (isFormatRequest(pregunta)) return { intencion: 'solicitud_formato' }
  if (isExerciseRecallRequest(pregunta)) return { intencion: 'recordar_ejercicio' }
  if (isPendingContextQuestion(pregunta) && !isLikelyMathAnswerText(pregunta)) return { intencion: 'aclaracion_mismo_paso' }

  if (hayEjercicioActivo && (isLikelyMathAnswerText(pregunta) || isWorkedExampleRequest(pregunta))) {
    return { intencion: 'respuesta_ejercicio' }
  }

  if (pregunta.trim().length === 0) return { intencion: 'no_evaluable' }
  return { intencion: 'pregunta_directa' }
}
