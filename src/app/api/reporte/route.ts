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
        content: `Eres un analizador pedagógico. Analiza la sesión de tutoría y devuelve SOLO un JSON válido sin markdown con esta estructura:
{"nivel":"Excelente|Bueno|En proceso|Necesita refuerzo","temas":["tema1"],"fortalezas":["fortaleza1"],"areas_refuerzo":["area1"],"recomendaciones_alumno":["rec1"],"recomendaciones_maestro":["rec1"],"resumen":"Resumen en 2-3 oraciones."}`
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
        nivel: 'Bueno',
        temas: [materia],
        fortalezas: ['Participación activa en la sesión'],
        areas_refuerzo: ['Continuar practicando los temas vistos'],
        recomendaciones_alumno: ['Practica más con Owlaris', 'Repasa los apuntes de clase'],
        recomendaciones_maestro: ['Revisar los temas de la sesión con el alumno'],
        resumen: 'El alumno participó en una sesión de tutoría con Owlaris.'
      }
    }

    return NextResponse.json({ analisis })

  } catch (err) {
    console.error('Error reporte:', err)
    return NextResponse.json({ error: 'Error generando reporte' }, { status: 500 })
  }
}
