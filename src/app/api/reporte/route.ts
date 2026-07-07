import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { withOpenAIRetry } from '@/lib/openaiRetry'
import { registrarAlertaTecnica } from '@/lib/technicalAlerts'
import { contarAlertasSensibles, contarSospechasCopia, resumenSeguridadIntegridad } from '@/lib/reporteSeguridad'
import {
  agruparPorMateria,
  construirEvidenciaActividad,
  esCalificable,
  esDeSeguridad,
  estadoEvidencia,
  fraseEstadoEvidencia,
  resolverNombreMateria,
  type FilaInteraccion,
} from '@/lib/reporteActividad'
import { filtrarRecomendaciones, stripUngroundedEmotionalClaims } from '@/lib/reporteLenguaje'
import { ventanaHoyGuatemala } from '@/lib/fechaGuatemala'

function hashString(value: string) {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0
  return Math.abs(hash)
}

function fraseMotivacionalSesion(seed: string, idiomaIngles = false) {
  const frases = idiomaIngles ? [
    'Today you took a step forward: understanding well matters more than answering fast.',
    'Every well-worked question strengthens your confidence for the next challenge.',
    'Learning takes practice, patience, and consistency; what matters is to keep building.',
    'When you explain in your own words, you turn an answer into real learning.',
    'A small step forward, repeated consistently, becomes a big difference.',
    'Your effort today is a foundation for solving with more confidence tomorrow.',
    'The goal is to understand the path, not just to reach the result.',
    'Keeping at it with guidance is a clear sign of academic growth.',
  ] : [
    'Hoy diste un paso más: entender mejor vale más que responder rápido.',
    'Cada pregunta bien trabajada fortalece tu confianza para el próximo reto.',
    'Aprender toma práctica, calma y constancia; lo importante es seguir construyendo.',
    'Cuando explicas con tus palabras, conviertes una respuesta en aprendizaje real.',
    'Un avance pequeño, repetido con constancia, se vuelve una gran diferencia.',
    'Tu esfuerzo de hoy es una base para resolver con más seguridad mañana.',
    'La meta es comprender el camino, no solo llegar al resultado.',
    'Seguir intentando con guía es una señal clara de crecimiento académico.',
  ]
  return frases[hashString(seed) % frases.length]
}

function asStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback
  const clean = value
    .map(item => String(item || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 6)
  return clean.length > 0 ? clean : fallback
}

// El LLM a veces copia la respuesta cruda del alumno (un numero, "27?") en vez de
// sintetizar un tema real. Se filtra antes de mostrarlo como "tema estudiado".
function esTemaValido(valor: string) {
  return !/^-?\d+([.,]\d+)?[?!.,]*$/.test(valor.trim())
}

function asTemasArray(value: unknown, fallback: string[]) {
  return asStringArray(value, fallback).filter(esTemaValido).length > 0
    ? asStringArray(value, fallback).filter(esTemaValido)
    : fallback
}

type AdaptacionDificultadReporte = {
  tipo?: string
  nivel_anterior?: number
  nivel_nuevo?: number
  aciertos_consecutivos?: number
  fallos_consecutivos?: number
  motivo?: string
}

type FilaInteraccionCruda = FilaInteraccion & {
  materia?: { nombre?: string | null } | { nombre?: string | null }[] | null
}

function resumenDificultad(
  adaptaciones: AdaptacionDificultadReporte[],
  nivelFinal: number | null,
  idiomaIngles = false
) {
  const eventos = adaptaciones.filter(a => a && a.tipo && a.tipo !== 'mantiene')
  if (eventos.length === 0) {
    if (idiomaIngles) {
      return nivelFinal
        ? `Practice stayed at level ${nivelFinal}; there was not yet enough of a streak to raise or lower difficulty.`
        : 'There was not enough information to determine difficulty changes during this session.'
    }
    return nivelFinal
      ? `La práctica se mantuvo en nivel ${nivelFinal}; aún no hubo un punto de ajuste suficiente para subir o bajar dificultad.`
      : 'No hubo suficiente información para determinar cambios de dificultad durante esta sesión.'
  }
  const subidas = eventos.filter(a => a.tipo === 'sube').length
  const bajadas = eventos.filter(a => a.tipo === 'baja' || a.tipo === 'refuerza').length
  const ultimo = eventos[eventos.length - 1]
  if (idiomaIngles) {
    const partesEn = []
    if (subidas > 0) partesEn.push(`raised the difficulty ${subidas} time${subidas === 1 ? '' : 's'}`)
    if (bajadas > 0) partesEn.push(`reinforced basics or lowered difficulty ${bajadas} time${bajadas === 1 ? '' : 's'}`)
    const cierreEn = ultimo?.nivel_nuevo ? ` Ended the session at level ${ultimo.nivel_nuevo}.` : ''
    return `During the session, Owlaris ${partesEn.join(' and ')} based on the student's streak.${cierreEn}`
  }
  const partes = []
  if (subidas > 0) partes.push(`subió la dificultad ${subidas} vez${subidas === 1 ? '' : 'es'}`)
  if (bajadas > 0) partes.push(`reforzó bases o bajó dificultad ${bajadas} vez${bajadas === 1 ? '' : 'es'}`)
  const cierre = ultimo?.nivel_nuevo ? ` Terminó trabajando en nivel ${ultimo.nivel_nuevo}.` : ''
  return `Durante la sesión, Owlaris ${partes.join(' y ')} según la racha del estudiante.${cierre}`
}

function extraerNombreMateria(row: FilaInteraccionCruda): string | null {
  const materia = row.materia
  if (!materia) return null
  if (Array.isArray(materia)) return materia[0]?.nombre || null
  return materia.nombre || null
}

function calcularMetricasHoy(filas: FilaInteraccion[], materiaFallback: string) {
  // Las alertas de seguridad se cuentan aparte (ver resumenSeguridadIntegridad)
  // pero NUNCA deben aparecer como "tema" trabajado — ni en el resumen por
  // materia de la portada ni en la lista plana de temas.
  const filasAcademicas = filas.filter(i => !esDeSeguridad(i))
  const resumenMaterias = agruparPorMateria(filasAcademicas, materiaFallback)
  const correctas = resumenMaterias.reduce((acc, m) => acc + m.correctas, 0)
  const incorrectas = resumenMaterias.reduce((acc, m) => acc + m.incorrectas, 0)
  const pasosCorrectos = filas.filter(i => i.estado_evaluacion === 'paso_correcto').length
  // "Ejercicios" cuenta solo actividad calificable — pedir un resumen, elegir
  // un tema por número o pedir una explicación no es un ejercicio.
  const ejerciciosCalificables = filas.filter(esCalificable).length
  const evaluadas = correctas + incorrectas
  const precision = evaluadas > 0 ? Math.round((correctas / evaluadas) * 100) : null
  const materias = resumenMaterias.map(m => m.materia)
  const temas = Array.from(new Set(filasAcademicas.map(i => (i.tema_detectado || '').trim()).filter(Boolean))).slice(0, 12)
  const inicio = filas[0]?.creado_en || null
  const fin = filas[filas.length - 1]?.creado_en || null
  const duracionMinutos = inicio && fin
    ? Math.max(1, Math.round((new Date(fin).getTime() - new Date(inicio).getTime()) / 60000))
    : null
  const alertasSensibles = contarAlertasSensibles(filas)
  const sospechasCopia = contarSospechasCopia(filas)
  const estadoEvidenciaHoy = estadoEvidencia(ejerciciosCalificables)

  return {
    interacciones: filas.length,
    ejercicios: ejerciciosCalificables,
    correctas,
    incorrectas,
    pasos_correctos: pasosCorrectos,
    precision,
    materias,
    resumen_materias: resumenMaterias,
    temas,
    inicio,
    fin,
    duracion_minutos: duracionMinutos,
    alertas_sensibles: alertasSensibles,
    sospechas_copia: sospechasCopia,
    estado_evidencia: estadoEvidenciaHoy,
  }
}

function construirEvidenciaHoy(filas: FilaInteraccion[], idiomaIngles = false) {
  return construirEvidenciaActividad(filas, idiomaIngles)
}

export async function POST(req: NextRequest) {
  let colegioIdParaAlerta: string | null = null
  try {
    const OpenAI = (await import('openai')).default
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { data: perfilAlerta } = await supabase.from('usuarios').select('colegio_id').eq('id', user.id).single()
    colegioIdParaAlerta = perfilAlerta?.colegio_id || null

    const {
      historial,
      grado,
      materia,
      colegio,
      adaptaciones_dificultad = [],
      nivel_dificultad_final = null,
      aciertos_consecutivos = 0,
      idioma_ingles = false,
    } = await req.json()
    if (!historial?.length) return NextResponse.json({ error: 'Sin historial' }, { status: 400 })
    const idiomaIngles = !!idioma_ingles
    const adaptaciones = Array.isArray(adaptaciones_dificultad)
      ? adaptaciones_dificultad.slice(-8) as AdaptacionDificultadReporte[]
      : []
    const nivelFinal = Number.isFinite(Number(nivel_dificultad_final)) ? Number(nivel_dificultad_final) : null
    const lecturaDificultad = resumenDificultad(adaptaciones, nivelFinal, idiomaIngles)
    const { start: inicioDia, end: finDia } = ventanaHoyGuatemala()
    const { data: interaccionesCrudas } = await supabase
      .from('interacciones')
      .select('pregunta,respuesta,tema_detectado,estado_evaluacion,documento_fuente,operacion_canonica,op_respuesta_alumno,op_estado,modelo_usado,materia_id,materia_nombre_snapshot,creado_en,sospecha_copia,materia:materias(nombre)')
      .eq('usuario_id', user.id)
      .gte('creado_en', inicioDia.toISOString())
      .lte('creado_en', finDia.toISOString())
      .order('creado_en', { ascending: true })
    const interaccionesHoy: FilaInteraccion[] = ((interaccionesCrudas || []) as FilaInteraccionCruda[]).map(row => ({
      ...row,
      materia_nombre: resolverNombreMateria(extraerNombreMateria(row), row, materia || null),
    }))
    const metricasHoy = calcularMetricasHoy(interaccionesHoy, materia)
    const evidenciaHoy = construirEvidenciaHoy(interaccionesHoy, idiomaIngles)

    const conversacion = historial.map((m: {rol:string; contenido:string}) =>
      `${m.rol === 'usuario' ? (idiomaIngles ? 'Student' : 'Alumno') : 'Owlaris'}: ${m.contenido}`
    ).join('\n\n')

    const nivelesValidos = idiomaIngles
      ? ['Excellent', 'Very good', 'In progress', 'With potential']
      : ['Excelente', 'Muy bien', 'En progreso', 'Con potencial']

    const systemPrompt = idiomaIngles
      ? `You are a pedagogical analyst for parents. Analyze the tutoring session and return ONLY a valid JSON without markdown with this structure:
{"nivel":"Excellent|Very good|In progress|With potential","materias_estudiadas":["subject studied"],"temas":["Subject - Specific topic"],"temas_por_materia":[{"materia":"Math","temas":["Equations","Order of operations"]}],"logros":["concrete observable achievement"],"areas_mejora":["constructive area with a concrete next step"],"felicitacion":"Specific phrase about what they did well","frase_motivacional":"Short motivating phrase","avances":"Description of the student's progress in 1-2 sentences","resumen_dificultad":"How difficulty was adjusted during the session","recomendaciones_alumno":["concrete next-session plan: subject + topic + how many exercises + what to do if they struggle again"],"recomendaciones_maestro":["pedagogical rec"],"recomendaciones_familia":["rec for supporting at home, using only Owlaris"],"resumen":"Clear 2-3 sentence summary for a parent."}

STRICT RULES:
- A backend-computed "Per-subject breakdown" will be provided below. Use ONLY those subjects and topics — never invent a subject or topic that is not in that breakdown.
- "temas" and "temas_por_materia" must be topic or skill names (e.g. "Equations with one variable", "Fractions to decimal"). NEVER copy a loose number, the student's raw answer, or verbatim student text (e.g. "4", "22", "27?", "convariable" are not valid topics).
- Areas for improvement must say what to reinforce and how, not just list weaknesses.
- NEVER use words like: error, incorrect, failed, mistake, wrong, poor, deficient.
- Difficulties are expressed as "practice opportunities" or "topics to reinforce".
- NEVER make emotional or motivational claims that are not directly observable from the data (e.g. "showed interest", "was motivated", "participated with enthusiasm", "was engaged"). Describe only what was actually done (subjects consulted, topics worked, exercises attempted), not how the student seemed to feel.
- NEVER recommend external resources: no videos, no YouTube, no articles, no external links, no third-party websites. Recommendations must only involve practicing again in Owlaris, reviewing the evidence annex, or using the "Let's review my mistakes" feature.
- If the student struggled, encourage them and propose one small, concrete next step.
- If the student did well, the congratulation must be specific and genuine.
- If there were difficulty changes, explain them as pedagogical adaptation, not as a reward or punishment.
- The lowest level is "With potential", never "Needs reinforcement".
- Write everything in English, in a warm, professional, clear tone for parents.`
      : `Eres un analizador pedagógico para padres de familia. Analiza la sesión de tutoría y devuelve SOLO un JSON válido sin markdown con esta estructura:
{"nivel":"Excelente|Muy bien|En progreso|Con potencial","materias_estudiadas":["materia estudiada"],"temas":["Materia - Tema concreto"],"temas_por_materia":[{"materia":"Matemática","temas":["Ecuaciones","Orden de operaciones"]}],"logros":["logro concreto observable"],"areas_mejora":["área constructiva con siguiente paso concreto"],"felicitacion":"Frase específica por lo que hizo bien","frase_motivacional":"Frase motivadora breve","avances":"Descripción del avance del alumno en 1-2 oraciones","resumen_dificultad":"Cómo se ajustó la dificultad durante la sesión","recomendaciones_alumno":["plan concreto para la próxima sesión: materia + tema + cuántos ejercicios + qué hacer si vuelve a fallar"],"recomendaciones_maestro":["rec pedagógica"],"recomendaciones_familia":["rec para acompañar en casa, usando solo Owlaris"],"resumen":"Resumen en 2-3 oraciones claro para un padre."}

REGLAS ESTRICTAS:
- Abajo se te da un "Resumen por materia calculado por backend". Usa SOLO esas materias y temas — nunca inventes una materia o tema que no esté en ese resumen.
- "temas" y "temas_por_materia" deben ser nombres de temas o habilidades (ej. "Ecuaciones con una variable", "Fracciones a decimal"). NUNCA copies ahí un numero suelto, una respuesta del alumno o texto tal cual lo escribio el alumno (ej. "4", "22", "27?", "convariable" no son temas validos).
- Las áreas de mejora deben decir qué reforzar y cómo hacerlo, no solo listar debilidades.
- NUNCA uses palabras como: error, incorrecto, falló, se equivocó, mal, fracaso, deficiente.
- Las dificultades se expresan como "oportunidades de práctica" o "temas para reforzar".
- NUNCA hagas afirmaciones emocionales o motivacionales que no sean observables directamente en los datos (ej. "mostró interés", "estuvo motivado", "participó con entusiasmo", "se mostró comprometido"). Describe solo lo que realmente hizo (materias consultadas, temas trabajados, ejercicios intentados), no cómo crees que se sintió.
- NUNCA recomiendes recursos externos: nada de videos, YouTube, artículos, enlaces externos o páginas de terceros. Las recomendaciones solo pueden ser practicar de nuevo en Owlaris, revisar el anexo de evidencia, o usar la opción "Revisemos mis errores".
- Si el alumno tuvo dificultades, anima y propone un paso pequeño y concreto.
- Si el alumno lo hizo bien, la felicitación debe ser específica y genuina.
- Si hubo cambios de dificultad, explícalos como adaptación pedagógica, no como premio o castigo.
- El nivel más bajo es "Con potencial", nunca "Necesita refuerzo"
- Tono cálido, profesional y claro para padres.`

    const completion = await withOpenAIRetry(() => openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 800,
      messages: [{
        role: 'system',
        content: systemPrompt
      }, {
        role: 'user',
        content: `Materia activa al generar el reporte: ${materia}\nGrado: ${grado}\nColegio: ${colegio}\nResumen por materia calculado por backend (TODAS las materias trabajadas hoy): ${JSON.stringify(metricasHoy.resumen_materias)}\nMetricas de hoy calculadas por backend: ${JSON.stringify(metricasHoy)}\nNivel adaptativo final: ${nivelFinal || 'no registrado'}\nAciertos consecutivos actuales: ${aciertos_consecutivos || 0}\nResumen de dificultad calculado por backend: ${lecturaDificultad}\nEventos de dificultad: ${JSON.stringify(adaptaciones)}\n\nConversación (sesión actual, para contexto de tono y detalle):\n${conversacion}`
      }]
    }))

    const texto = completion.choices[0].message.content || '{}'
    let analisis
    try {
      analisis = JSON.parse(texto.replace(/```json|```/g, '').trim())
    } catch {
      analisis = idiomaIngles ? {
        nivel: 'Very good',
        materias_estudiadas: [materia],
        temas: [materia],
        temas_por_materia: [{ materia, temas: ['Guided practice'] }],
        logros: ['Active and consistent participation in the session'],
        areas_mejora: ['Keep exploring new topics to grow even more'],
        felicitacion: 'Great work today, thanks to your steady effort.',
        frase_motivacional: '',
        avances: 'The student worked through the session with guided support.',
        resumen_dificultad: lecturaDificultad,
        recomendaciones_alumno: ['Practice more with Owlaris', 'Review class notes'],
        recomendaciones_maestro: ['Review the session topics with the student'],
        recomendaciones_familia: ['Ask the student to explain in their own words what they learned today.'],
        resumen: 'The student participated in a tutoring session with Owlaris.'
      } : {
        nivel: 'Muy bien',
        materias_estudiadas: [materia],
        temas: [materia],
        temas_por_materia: [{ materia, temas: ['Práctica guiada'] }],
        logros: ['Participación activa y constante en la sesión'],
        areas_mejora: ['Seguir explorando nuevos temas para crecer aún más'],
        felicitacion: '¡Buen trabajo hoy, gracias a tu esfuerzo constante!',
        frase_motivacional: '',
        avances: 'El alumno trabajó la sesión con acompañamiento guiado.',
        resumen_dificultad: lecturaDificultad,
        recomendaciones_alumno: ['Practica más con Owlaris', 'Repasa los apuntes de clase'],
        recomendaciones_maestro: ['Revisar los temas de la sesión con el alumno'],
        recomendaciones_familia: ['Pedirle al estudiante que explique con sus propias palabras qué aprendió hoy.'],
        resumen: 'El alumno participó en una sesión de tutoría con Owlaris.'
      }
    }

    const seed = `${user.id}-${new Date().toISOString().split('T')[0]}-${historial.length}-${materia}-${grado}`
    analisis.nivel = nivelesValidos.includes(analisis.nivel) ? analisis.nivel : nivelesValidos[1]

    // Punto 9: la primera página debe resumir TODAS las materias trabajadas
    // hoy, no solo la materia activa al descargar el PDF. Se sobreescribe lo
    // que devuelva el LLM con el cálculo determinístico del backend — la
    // fuente de verdad para "qué materias y temas" es la base de datos, no
    // la interpretación libre del modelo.
    const practicaGuiada = idiomaIngles ? 'Guided practice' : 'Práctica guiada'
    const resumenMaterias = metricasHoy.resumen_materias
    if (resumenMaterias.length > 0) {
      analisis.materias_estudiadas = resumenMaterias.map(m => m.materia)
      analisis.temas_por_materia = resumenMaterias.map(m => ({
        materia: m.materia,
        temas: m.temas.length > 0 ? m.temas : [practicaGuiada],
      }))
      analisis.temas = resumenMaterias.flatMap(m => (m.temas.length > 0 ? m.temas : [practicaGuiada]))
    } else {
      analisis.materias_estudiadas = asStringArray(analisis.materias_estudiadas, [materia || (idiomaIngles ? 'Subject studied' : 'Materia trabajada')])
      analisis.temas = asTemasArray(analisis.temas, [materia ? `${materia} - ${practicaGuiada}` : practicaGuiada])
      analisis.temas_por_materia = Array.isArray(analisis.temas_por_materia)
        ? analisis.temas_por_materia.map((tm: { materia?: string; temas?: unknown }) => ({
            materia: String(tm?.materia || materia || '').trim() || materia,
            temas: asTemasArray(tm?.temas, [practicaGuiada]),
          }))
        : []
    }

    analisis.logros = asStringArray(analisis.logros, [idiomaIngles ? 'Active participation during the session' : 'Participación activa durante la sesión'])
    analisis.areas_mejora = asStringArray(analisis.areas_mejora, [idiomaIngles ? 'Reinforce the step-by-step procedure and explain the answer in their own words' : 'Reforzar el procedimiento paso a paso y explicar la respuesta con sus propias palabras'])

    // Puntos 13 y 14: sin inferencias emocionales no observables y sin
    // recomendar recursos externos — como red de seguridad determinística
    // además de la instrucción en el prompt.
    analisis.resumen = stripUngroundedEmotionalClaims(String(analisis.resumen || ''), idiomaIngles).text
    analisis.avances = stripUngroundedEmotionalClaims(String(analisis.avances || ''), idiomaIngles).text
    analisis.felicitacion = stripUngroundedEmotionalClaims(String(analisis.felicitacion || ''), idiomaIngles).text
    analisis.logros = analisis.logros.map((item: string) => stripUngroundedEmotionalClaims(item, idiomaIngles).text)

    analisis.recomendaciones_alumno = filtrarRecomendaciones(
      asStringArray(analisis.recomendaciones_alumno, [idiomaIngles ? 'Practice one idea at a time and explain the process before moving to the next exercise' : 'Practicar una idea a la vez y explicar el proceso antes de pasar al siguiente ejercicio']),
      [idiomaIngles ? 'Practice one idea at a time in Owlaris and explain the process before moving on' : 'Practicar una idea a la vez en Owlaris y explicar el proceso antes de avanzar']
    )
    analisis.recomendaciones_maestro = filtrarRecomendaciones(
      asStringArray(analisis.recomendaciones_maestro, [idiomaIngles ? 'Review the topic covered and confirm understanding with a brief question' : 'Revisar el tema trabajado y confirmar comprensión con una pregunta breve']),
      [idiomaIngles ? 'Review the topic covered and confirm understanding with a brief question' : 'Revisar el tema trabajado y confirmar comprensión con una pregunta breve']
    )
    analisis.recomendaciones_familia = filtrarRecomendaciones(
      asStringArray(analisis.recomendaciones_familia, [idiomaIngles ? 'Support with a short practice session in Owlaris and ask for an explanation in the student\'s own words' : 'Acompañar con una práctica corta en Owlaris y pedir una explicación en palabras del estudiante']),
      [idiomaIngles ? 'Use the "Let\'s review my mistakes" option in Owlaris together' : 'Usar juntos la opción "Revisemos mis errores" en Owlaris']
    )

    analisis.resumen_dificultad = String(analisis.resumen_dificultad || lecturaDificultad).replace(/\s+/g, ' ').trim()
    if (!analisis.resumen_dificultad) analisis.resumen_dificultad = lecturaDificultad
    analisis.adaptaciones_dificultad = adaptaciones
    analisis.nivel_dificultad_final = nivelFinal
    analisis.metricas_hoy = metricasHoy
    analisis.evidencia_hoy = evidenciaHoy
    analisis.seguridad_integridad = resumenSeguridadIntegridad(metricasHoy.alertas_sensibles, metricasHoy.sospechas_copia, idiomaIngles)
    // Punto 15: estado de evidencia del día, para no presentar una
    // exploración breve como si fuera un diagnóstico completo.
    analisis.estado_evidencia = metricasHoy.estado_evidencia
    analisis.frase_evidencia = fraseEstadoEvidencia(metricasHoy.estado_evidencia, idiomaIngles)
    analisis.frase_motivacional = fraseMotivacionalSesion(seed, idiomaIngles)
    analisis.fecha_generacion = new Date().toISOString()
    analisis.grado = grado
    analisis.materia_principal = materia

    return NextResponse.json({ analisis })

  } catch (err) {
    console.error('Error reporte:', err)
    const status = (err as { status?: number } | null)?.status
    const tipoError = status === 429 || (typeof status === 'number' && status >= 500) ? 'openai_agotado' : 'error_interno'
    await registrarAlertaTecnica(createAdminClient(), colegioIdParaAlerta, tipoError, `Ruta:/api/reporte | ${err instanceof Error ? err.message : String(err)}`.substring(0, 280))
    return NextResponse.json({ error: 'Error generando reporte' }, { status: 500 })
  }
}
