import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withOpenAIRetry } from '@/lib/openaiRetry'

function hashString(value: string) {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0
  return Math.abs(hash)
}

function fraseMotivacionalSesion(seed: string) {
  const frases = [
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
  nivelFinal: number | null
) {
  const eventos = adaptaciones.filter(a => a && a.tipo && a.tipo !== 'mantiene')
  if (eventos.length === 0) {
    return nivelFinal
      ? `La práctica se mantuvo en nivel ${nivelFinal}; aún no hubo un punto de ajuste suficiente para subir o bajar dificultad.`
      : 'No hubo suficiente información para determinar cambios de dificultad durante esta sesión.'
  }
  const subidas = eventos.filter(a => a.tipo === 'sube').length
  const bajadas = eventos.filter(a => a.tipo === 'baja' || a.tipo === 'refuerza').length
  const ultimo = eventos[eventos.length - 1]
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

function etiquetaResultado(estado?: string | null, opEstado?: string | null) {
  if (estado === 'correcto' || estado === 'equivalente') return 'Correcta'
  if (estado === 'incorrecto') return 'Por reforzar'
  if (estado === 'paso_correcto') return 'Paso correcto'
  if (opEstado === 'pendiente') return 'Pendiente'
  return 'Registrada'
}

function construirEvidenciaHoy(interacciones: InteraccionReporte[]) {
  return interacciones
    .filter(i => i.operacion_canonica || i.estado_evaluacion)
    .map((i, idx) => ({
      secuencia: idx + 1,
      hora: i.creado_en
        ? new Date(i.creado_en).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })
        : '',
      tema: (i.tema_detectado || 'Práctica guiada').replace(/\s+/g, ' ').trim().substring(0, 120),
      ejercicio: i.operacion_canonica
        ? `Operación / habilidad: ${i.operacion_canonica}`
        : 'Ejercicio académico registrado',
      respuesta_estudiante: (i.op_respuesta_alumno || i.pregunta || '').replace(/\s+/g, ' ').trim().substring(0, 240),
      resultado: etiquetaResultado(i.estado_evaluacion, i.op_estado),
      fuente: i.documento_fuente || '',
    }))
    .slice(0, 80)
}

export async function POST(req: NextRequest) {
  try {
    const OpenAI = (await import('openai')).default
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const {
      historial,
      grado,
      materia,
      colegio,
      adaptaciones_dificultad = [],
      nivel_dificultad_final = null,
      aciertos_consecutivos = 0,
    } = await req.json()
    if (!historial?.length) return NextResponse.json({ error: 'Sin historial' }, { status: 400 })
    const adaptaciones = Array.isArray(adaptaciones_dificultad)
      ? adaptaciones_dificultad.slice(-8) as AdaptacionDificultadReporte[]
      : []
    const nivelFinal = Number.isFinite(Number(nivel_dificultad_final)) ? Number(nivel_dificultad_final) : null
    const lecturaDificultad = resumenDificultad(adaptaciones, nivelFinal)
    const ventana = ventanaHoyGuatemala()
    const { data: interaccionesHoy } = await supabase
      .from('interacciones')
      .select('pregunta,respuesta,tema_detectado,estado_evaluacion,documento_fuente,operacion_canonica,op_respuesta_alumno,op_estado,creado_en')
      .eq('usuario_id', user.id)
      .gte('creado_en', ventana.start.toISOString())
      .lt('creado_en', ventana.end.toISOString())
      .order('creado_en', { ascending: true })
    const metricasHoy = calcularMetricasHoy((interaccionesHoy || []) as InteraccionReporte[])
    const evidenciaHoy = construirEvidenciaHoy((interaccionesHoy || []) as InteraccionReporte[])

    const conversacion = historial.map((m: {rol:string; contenido:string}) =>
      `${m.rol === 'usuario' ? 'Alumno' : 'Owlaris'}: ${m.contenido}`
    ).join('\n\n')

    const completion = await withOpenAIRetry(() => openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 800,
      messages: [{
        role: 'system',
        content: `Eres un analizador pedagógico para padres de familia. Analiza la sesión de tutoría y devuelve SOLO un JSON válido sin markdown con esta estructura:
{"nivel":"Excelente|Muy bien|En progreso|Con potencial","materias_estudiadas":["materia estudiada"],"temas":["Materia - Tema concreto"],"temas_por_materia":[{"materia":"Matemática","temas":["Ecuaciones","Orden de operaciones"]}],"logros":["logro concreto observable"],"areas_mejora":["área constructiva con siguiente paso concreto"],"felicitacion":"Frase específica por lo que hizo bien","frase_motivacional":"Frase motivadora breve","avances":"Descripción del avance del alumno en 1-2 oraciones","resumen_dificultad":"Cómo se ajustó la dificultad durante la sesión","recomendaciones_alumno":["rec positiva y accionable"],"recomendaciones_maestro":["rec pedagógica"],"recomendaciones_familia":["rec para acompañar en casa"],"resumen":"Resumen en 2-3 oraciones claro para un padre."}

REGLAS ESTRICTAS:
- Explica qué materia estudió y qué temas trabajó de forma clara.
- Las áreas de mejora deben decir qué reforzar y cómo hacerlo, no solo listar debilidades.
- NUNCA uses palabras como: error, incorrecto, falló, se equivocó, mal, fracaso, deficiente.
- Las dificultades se expresan como "oportunidades de práctica" o "temas para reforzar".
- Si el alumno tuvo dificultades, anima y propone un paso pequeño.
- Si el alumno lo hizo bien, la felicitación debe ser específica y genuina.
- Si hubo cambios de dificultad, explícalos como adaptación pedagógica, no como premio o castigo.
- El nivel más bajo es "Con potencial", nunca "Necesita refuerzo"
- Tono cálido, profesional y claro para padres.`
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
      analisis = {
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
    analisis.nivel = ['Excelente', 'Muy bien', 'En progreso', 'Con potencial'].includes(analisis.nivel) ? analisis.nivel : 'Muy bien'
    analisis.materias_estudiadas = asStringArray(analisis.materias_estudiadas, [materia || 'Materia trabajada'])
    analisis.temas = asStringArray(analisis.temas, [materia ? `${materia} - Práctica guiada` : 'Práctica guiada'])
    analisis.logros = asStringArray(analisis.logros, ['Participación activa durante la sesión'])
    analisis.areas_mejora = asStringArray(analisis.areas_mejora, ['Reforzar el procedimiento paso a paso y explicar la respuesta con sus propias palabras'])
    analisis.recomendaciones_alumno = asStringArray(analisis.recomendaciones_alumno, ['Practicar una idea a la vez y explicar el proceso antes de pasar al siguiente ejercicio'])
    analisis.recomendaciones_maestro = asStringArray(analisis.recomendaciones_maestro, ['Revisar el tema trabajado y confirmar comprensión con una pregunta breve'])
    analisis.recomendaciones_familia = asStringArray(analisis.recomendaciones_familia, ['Acompañar con una práctica corta y pedir una explicación en palabras del estudiante'])
    analisis.resumen_dificultad = String(analisis.resumen_dificultad || lecturaDificultad).replace(/\s+/g, ' ').trim()
    if (!analisis.resumen_dificultad) analisis.resumen_dificultad = lecturaDificultad
    analisis.adaptaciones_dificultad = adaptaciones
    analisis.nivel_dificultad_final = nivelFinal
    analisis.metricas_hoy = metricasHoy
    analisis.evidencia_hoy = evidenciaHoy
    analisis.frase_motivacional = fraseMotivacionalSesion(seed)
    analisis.fecha_generacion = new Date().toISOString()
    analisis.grado = grado
    analisis.materia_principal = materia

    return NextResponse.json({ analisis })

  } catch (err) {
    console.error('Error reporte:', err)
    return NextResponse.json({ error: 'Error generando reporte' }, { status: 500 })
  }
}
