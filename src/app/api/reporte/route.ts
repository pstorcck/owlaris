import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

export async function POST(req: NextRequest) {
  try {
    const OpenAI = (await import('openai')).default
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { historial, grado, materia, colegio } = await req.json()
    if (!historial?.length) return NextResponse.json({ error: 'Sin historial' }, { status: 400 })

    const conversacion = historial.map((m: {rol:string; contenido:string}) =>
      `${m.rol === 'usuario' ? 'Alumno' : 'Owlaris'}: ${m.contenido}`
    ).join('\n\n')

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 800,
      messages: [{
        role: 'system',
        content: `Eres un analizador pedagógico para padres de familia. Analiza la sesión de tutoría y devuelve SOLO un JSON válido sin markdown con esta estructura:
{"nivel":"Excelente|Muy bien|En progreso|Con potencial","materias_estudiadas":["materia estudiada"],"temas":["Materia - Tema concreto"],"temas_por_materia":[{"materia":"Matemática","temas":["Ecuaciones","Orden de operaciones"]}],"logros":["logro concreto observable"],"areas_mejora":["área constructiva con siguiente paso concreto"],"felicitacion":"Frase específica por lo que hizo bien","frase_motivacional":"Frase motivadora breve","avances":"Descripción del avance del alumno en 1-2 oraciones","recomendaciones_alumno":["rec positiva y accionable"],"recomendaciones_maestro":["rec pedagógica"],"recomendaciones_familia":["rec para acompañar en casa"],"resumen":"Resumen en 2-3 oraciones claro para un padre."}

REGLAS ESTRICTAS:
- Explica qué materia estudió y qué temas trabajó de forma clara.
- Las áreas de mejora deben decir qué reforzar y cómo hacerlo, no solo listar debilidades.
- NUNCA uses palabras como: error, incorrecto, falló, se equivocó, mal, fracaso, deficiente.
- Las dificultades se expresan como "oportunidades de práctica" o "temas para reforzar".
- Si el alumno tuvo dificultades, anima y propone un paso pequeño.
- Si el alumno lo hizo bien, la felicitación debe ser específica y genuina.
- El nivel más bajo es "Con potencial", nunca "Necesita refuerzo"
- Tono cálido, profesional y claro para padres.`
      }, {
        role: 'user',
        content: `Materia: ${materia}\nGrado: ${grado}\nColegio: ${colegio}\n\nConversación:\n${conversacion}`
      }]
    })

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
