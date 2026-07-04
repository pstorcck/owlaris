import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { withOpenAIRetry } from '@/lib/openaiRetry'
import { registrarAlertaTecnica } from '@/lib/technicalAlerts'

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

type InteraccionReporte = {
  pregunta?: string | null
  respuesta?: string | null
  tema_detectado?: string | null
  estado_evaluacion?: string | null
  documento_fuente?: string | null
  operacion_canonica?: string | null
  op_respuesta_alumno?: string | null
  op_estado?: string | null
  creado_en?: string | null
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

function ventanaHoyGuatemala() {
  const now = new Date()
  const guatemalaOffsetMs = 6 * 60 * 60 * 1000
  const gtNow = new Date(now.getTime() - guatemalaOffsetMs)
  const startUtc = new Date(Date.UTC(gtNow.getUTCFullYear(), gtNow.getUTCMonth(), gtNow.getUTCDate(), 6, 0, 0, 0))
  return {
    start: startUtc,
    end: new Date(startUtc.getTime() + 24 * 60 * 60 * 1000),
  }
}

function inicioReporte(sessionStartedAt?: unknown) {
  if (typeof sessionStartedAt === 'string') {
    const parsed = new Date(sessionStartedAt)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  return ventanaHoyGuatemala().start
}

function calcularMetricasHoy(interacciones: InteraccionReporte[]) {
  const correctas = interacciones.filter(i => i.estado_evaluacion === 'correcto' || i.estado_evaluacion === 'equivalente').length
  const incorrectas = interacciones.filter(i => i.estado_evaluacion === 'incorrecto').length
  const pasosCorrectos = interacciones.filter(i => i.estado_evaluacion === 'paso_correcto').length
  const ejercicios = interacciones.filter(i => i.operacion_canonica || i.estado_evaluacion).length
  const evaluadas = correctas + incorrectas
  const precision = evaluadas > 0 ? Math.round((correctas / evaluadas) * 100) : null
  const fuentes = Array.from(new Set(interacciones.map(i => i.documento_fuente).filter(Boolean))) as string[]
  const temas = Array.from(new Set(interacciones.map(i => (i.tema_detectado || '').trim()).filter(Boolean))).slice(0, 8)
  const inicio = interacciones[0]?.creado_en || null
  const fin = interacciones[interacciones.length - 1]?.creado_en || null
  const duracionMinutos = inicio && fin
    ? Math.max(1, Math.round((new Date(fin).getTime() - new Date(inicio).getTime()) / 60000))
    : null

  return {
    interacciones: interacciones.length,
    ejercicios,
    correctas,
    incorrectas,
    pasos_correctos: pasosCorrectos,
    precision,
    fuentes,
    temas,
    inicio,
    fin,
    duracion_minutos: duracionMinutos,
  }
}

function etiquetaResultado(estado?: string | null, opEstado?: string | null, idiomaIngles = false) {
  if (estado === 'correcto' || estado === 'equivalente') return idiomaIngles ? 'Correct' : 'Correcta'
  if (estado === 'incorrecto') return idiomaIngles ? 'To reinforce' : 'Por reforzar'
  if (estado === 'paso_correcto') return idiomaIngles ? 'Correct step' : 'Paso correcto'
  if (opEstado === 'pendiente') return idiomaIngles ? 'Pending' : 'Pendiente'
  return idiomaIngles ? 'Recorded' : 'Registrada'
}

function construirEvidenciaHoy(interacciones: InteraccionReporte[], idiomaIngles = false) {
  return interacciones
    .filter(i => i.operacion_canonica || i.estado_evaluacion)
    .map((i, idx) => ({
      secuencia: idx + 1,
      hora: i.creado_en
        ? new Date(i.creado_en).toLocaleTimeString(idiomaIngles ? 'en-US' : 'es-GT', { hour: '2-digit', minute: '2-digit' })
        : '',
      tema: (i.tema_detectado || (idiomaIngles ? 'Guided practice' : 'Práctica guiada')).replace(/\s+/g, ' ').trim().substring(0, 120),
      ejercicio: i.operacion_canonica
        ? `${idiomaIngles ? 'Operation / skill' : 'Operación / habilidad'}: ${i.operacion_canonica}`
        : (idiomaIngles ? 'Academic exercise recorded' : 'Ejercicio académico registrado'),
      respuesta_estudiante: (i.op_respuesta_alumno || i.pregunta || '').replace(/\s+/g, ' ').trim().substring(0, 240),
      resultado: etiquetaResultado(i.estado_evaluacion, i.op_estado, idiomaIngles),
      fuente: i.documento_fuente || '',
    }))
    .slice(0, 80)
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
      session_started_at,
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
    const inicioSesion = inicioReporte(session_started_at)
    const finSesion = new Date()
    const { data: interaccionesHoy } = await supabase
      .from('interacciones')
      .select('pregunta,respuesta,tema_detectado,estado_evaluacion,documento_fuente,operacion_canonica,op_respuesta_alumno,op_estado,creado_en')
      .eq('usuario_id', user.id)
      .gte('creado_en', inicioSesion.toISOString())
      .lte('creado_en', finSesion.toISOString())
      .order('creado_en', { ascending: true })
    const metricasHoy = calcularMetricasHoy((interaccionesHoy || []) as InteraccionReporte[])
    const evidenciaHoy = construirEvidenciaHoy((interaccionesHoy || []) as InteraccionReporte[], idiomaIngles)

    const conversacion = historial.map((m: {rol:string; contenido:string}) =>
      `${m.rol === 'usuario' ? (idiomaIngles ? 'Student' : 'Alumno') : 'Owlaris'}: ${m.contenido}`
    ).join('\n\n')

    const nivelesValidos = idiomaIngles
      ? ['Excellent', 'Very good', 'In progress', 'With potential']
      : ['Excelente', 'Muy bien', 'En progreso', 'Con potencial']

    const systemPrompt = idiomaIngles
      ? `You are a pedagogical analyst for parents. Analyze the tutoring session and return ONLY a valid JSON without markdown with this structure:
{"nivel":"Excellent|Very good|In progress|With potential","materias_estudiadas":["subject studied"],"temas":["Subject - Specific topic"],"temas_por_materia":[{"materia":"Math","temas":["Equations","Order of operations"]}],"logros":["concrete observable achievement"],"areas_mejora":["constructive area with a concrete next step"],"felicitacion":"Specific phrase about what they did well","frase_motivacional":"Short motivating phrase","avances":"Description of the student's progress in 1-2 sentences","resumen_dificultad":"How difficulty was adjusted during the session","recomendaciones_alumno":["positive and actionable rec"],"recomendaciones_maestro":["pedagogical rec"],"recomendaciones_familia":["rec for supporting at home"],"resumen":"Clear 2-3 sentence summary for a parent."}

STRICT RULES:
- Explain clearly which subject and topics were covered.
- "temas" and "temas_por_materia" must be topic or skill names (e.g. "Equations with one variable", "Fractions to decimal"). NEVER copy a loose number, the student's raw answer, or verbatim student text (e.g. "4", "22", "27?", "convariable" are not valid topics).
- Areas for improvement must say what to reinforce and how, not just list weaknesses.
- NEVER use words like: error, incorrect, failed, mistake, wrong, poor, deficient.
- Difficulties are expressed as "practice opportunities" or "topics to reinforce".
- If the student struggled, encourage them and propose one small next step.
- If the student did well, the congratulation must be specific and genuine.
- If there were difficulty changes, explain them as pedagogical adaptation, not as a reward or punishment.
- The lowest level is "With potential", never "Needs reinforcement".
- Write everything in English, in a warm, professional, clear tone for parents.`
      : `Eres un analizador pedagógico para padres de familia. Analiza la sesión de tutoría y devuelve SOLO un JSON válido sin markdown con esta estructura:
{"nivel":"Excelente|Muy bien|En progreso|Con potencial","materias_estudiadas":["materia estudiada"],"temas":["Materia - Tema concreto"],"temas_por_materia":[{"materia":"Matemática","temas":["Ecuaciones","Orden de operaciones"]}],"logros":["logro concreto observable"],"areas_mejora":["área constructiva con siguiente paso concreto"],"felicitacion":"Frase específica por lo que hizo bien","frase_motivacional":"Frase motivadora breve","avances":"Descripción del avance del alumno en 1-2 oraciones","resumen_dificultad":"Cómo se ajustó la dificultad durante la sesión","recomendaciones_alumno":["rec positiva y accionable"],"recomendaciones_maestro":["rec pedagógica"],"recomendaciones_familia":["rec para acompañar en casa"],"resumen":"Resumen en 2-3 oraciones claro para un padre."}

REGLAS ESTRICTAS:
- Explica qué materia estudió y qué temas trabajó de forma clara.
- "temas" y "temas_por_materia" deben ser nombres de temas o habilidades (ej. "Ecuaciones con una variable", "Fracciones a decimal"). NUNCA copies ahí un numero suelto, una respuesta del alumno o texto tal cual lo escribio el alumno (ej. "4", "22", "27?", "convariable" no son temas validos).
- Las áreas de mejora deben decir qué reforzar y cómo hacerlo, no solo listar debilidades.
- NUNCA uses palabras como: error, incorrecto, falló, se equivocó, mal, fracaso, deficiente.
- Las dificultades se expresan como "oportunidades de práctica" o "temas para reforzar".
- Si el alumno tuvo dificultades, anima y propone un paso pequeño.
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
        content: `Materia: ${materia}\nGrado: ${grado}\nColegio: ${colegio}\nMetricas de hoy calculadas por backend: ${JSON.stringify(metricasHoy)}\nNivel adaptativo final: ${nivelFinal || 'no registrado'}\nAciertos consecutivos actuales: ${aciertos_consecutivos || 0}\nResumen de dificultad calculado por backend: ${lecturaDificultad}\nEventos de dificultad: ${JSON.stringify(adaptaciones)}\n\nConversación:\n${conversacion}`
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
        felicitacion: 'Excellent work today! Your dedication shows in every answer.',
        frase_motivacional: '',
        avances: 'The student showed commitment and steady progress during the session.',
        resumen_dificultad: lecturaDificultad,
        recomendaciones_alumno: ['Practice more with Owlaris', 'Review class notes'],
        recomendaciones_maestro: ['Review the session topics with the student'],
        recomendaciones_familia: ['Ask the student to explain in their own words what they learned today.'],
        resumen: 'The student participated actively in a tutoring session with Owlaris.'
      } : {
        nivel: 'Muy bien',
        materias_estudiadas: [materia],
        temas: [materia],
        temas_por_materia: [{ materia, temas: ['Práctica guiada'] }],
        logros: ['Participación activa y constante en la sesión'],
        areas_mejora: ['Seguir explorando nuevos temas para crecer aún más'],
        felicitacion: '¡Excelente trabajo hoy! Tu dedicación se nota en cada respuesta.',
        frase_motivacional: '',
        avances: 'El alumno mostró compromiso y avance constante durante la sesión.',
        resumen_dificultad: lecturaDificultad,
        recomendaciones_alumno: ['Practica más con Owlaris', 'Repasa los apuntes de clase'],
        recomendaciones_maestro: ['Revisar los temas de la sesión con el alumno'],
        recomendaciones_familia: ['Pedirle al estudiante que explique con sus propias palabras qué aprendió hoy.'],
        resumen: 'El alumno participó activamente en una sesión de tutoría con Owlaris.'
      }
    }

    const seed = `${user.id}-${new Date().toISOString().split('T')[0]}-${historial.length}-${materia}-${grado}`
    analisis.nivel = nivelesValidos.includes(analisis.nivel) ? analisis.nivel : nivelesValidos[1]
    analisis.materias_estudiadas = asStringArray(analisis.materias_estudiadas, [materia || (idiomaIngles ? 'Subject studied' : 'Materia trabajada')])
    const practicaGuiada = idiomaIngles ? 'Guided practice' : 'Práctica guiada'
    analisis.temas = asTemasArray(analisis.temas, [materia ? `${materia} - ${practicaGuiada}` : practicaGuiada])
    if (Array.isArray(analisis.temas_por_materia)) {
      analisis.temas_por_materia = analisis.temas_por_materia.map((tm: { materia?: string; temas?: unknown }) => ({
        materia: String(tm?.materia || materia || '').trim() || materia,
        temas: asTemasArray(tm?.temas, [practicaGuiada]),
      }))
    }
    analisis.logros = asStringArray(analisis.logros, [idiomaIngles ? 'Active participation during the session' : 'Participación activa durante la sesión'])
    analisis.areas_mejora = asStringArray(analisis.areas_mejora, [idiomaIngles ? 'Reinforce the step-by-step procedure and explain the answer in their own words' : 'Reforzar el procedimiento paso a paso y explicar la respuesta con sus propias palabras'])
    analisis.recomendaciones_alumno = asStringArray(analisis.recomendaciones_alumno, [idiomaIngles ? 'Practice one idea at a time and explain the process before moving to the next exercise' : 'Practicar una idea a la vez y explicar el proceso antes de pasar al siguiente ejercicio'])
    analisis.recomendaciones_maestro = asStringArray(analisis.recomendaciones_maestro, [idiomaIngles ? 'Review the topic covered and confirm understanding with a brief question' : 'Revisar el tema trabajado y confirmar comprensión con una pregunta breve'])
    analisis.recomendaciones_familia = asStringArray(analisis.recomendaciones_familia, [idiomaIngles ? 'Support with a short practice session and ask for an explanation in the student\'s own words' : 'Acompañar con una práctica corta y pedir una explicación en palabras del estudiante'])
    analisis.resumen_dificultad = String(analisis.resumen_dificultad || lecturaDificultad).replace(/\s+/g, ' ').trim()
    if (!analisis.resumen_dificultad) analisis.resumen_dificultad = lecturaDificultad
    analisis.adaptaciones_dificultad = adaptaciones
    analisis.nivel_dificultad_final = nivelFinal
    analisis.metricas_hoy = metricasHoy
    analisis.evidencia_hoy = evidenciaHoy
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
