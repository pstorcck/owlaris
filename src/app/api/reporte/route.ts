import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
        content: `Eres un analizador pedagógico POSITIVO y MOTIVACIONAL. Analiza la sesión de tutoría y devuelve SOLO un JSON válido sin markdown con esta estructura:
{"nivel":"Excelente|Muy bien|En progreso|Con potencial","temas":["Materia - Tema (ej: Matemática - Ecuaciones)"],"logros":["logro concreto de la sesión"],"areas_mejora":["área expresada de forma constructiva y motivadora, NUNCA como error o fallo"],"felicitacion":"Frase de felicitación personalizada por lo que hizo bien","frase_motivacional":"Frase motivadora para seguir practicando","avances":"Descripción del avance del alumno en 1-2 oraciones","recomendaciones_alumno":["rec positiva"],"recomendaciones_maestro":["rec pedagógica"],"resumen":"Resumen en 2-3 oraciones con tono positivo."}

REGLAS ESTRICTAS:
- NUNCA uses palabras como: error, incorrecto, falló, se equivocó, mal, fracaso, deficiente
- Los errores se expresan como "oportunidades de práctica" o "temas para reforzar"
- Si el alumno tuvo dificultades, la frase_motivacional debe animarlo sin evidenciar el fallo
- Si el alumno lo hizo bien, la felicitacion debe ser específica y genuina
- El nivel más bajo es "Con potencial", nunca "Necesita refuerzo"
- Tono cálido, cercano, como un mentor que cree en el alumno`
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
        temas: [materia],
        logros: ['Participación activa y constante en la sesión'],
        areas_mejora: ['Seguir explorando nuevos temas para crecer aún más'],
        felicitacion: '¡Excelente trabajo hoy! Tu dedicación se nota en cada respuesta.',
        frase_motivacional: 'Cada sesión de práctica te acerca más a dominar el tema. ¡Sigue así!',
        avances: 'El alumno mostró compromiso y avance constante durante la sesión.',
        recomendaciones_alumno: ['Practica más con Owlaris', 'Repasa los apuntes de clase'],
        recomendaciones_maestro: ['Revisar los temas de la sesión con el alumno'],
        resumen: 'El alumno participó activamente en una sesión de tutoría con Owlaris.'
      }
    }

    return NextResponse.json({ analisis })

  } catch (err) {
    console.error('Error reporte:', err)
    return NextResponse.json({ error: 'Error generando reporte' }, { status: 500 })
  }
}
