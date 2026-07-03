import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withOpenAIRetry } from '@/lib/openaiRetry'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: perfil } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()
    if (!perfil || !['maestro', 'director', 'admin', 'superadmin'].includes(perfil.rol)) {
      return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
    }

    const { pregunta, contexto } = await req.json()

    const OpenAI = (await import('openai')).default
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const completion = await withOpenAIRetry(() => openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 300,
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: 'Eres un asistente pedagogico experto para docentes de colegios en Guatemala. Analiza datos de uso de la plataforma Owlaris y da consejos pedagogicos concretos y accionables. Se conciso (maximo 3-4 oraciones). Da recomendaciones especificas y practicas. Usa los datos del dashboard cuando esten disponibles. Habla en espanol guatemalteco, tono profesional pero calido. Usa **negrita** para resaltar datos importantes. Si hay alumnos sin actividad, sugiere estrategias de motivacion. Si hay temas muy consultados, sugiere reforzarlos en clase.\n\n' + (contexto || ''),
        },
        { role: 'user', content: pregunta }
      ],
    }))

    return NextResponse.json({
      respuesta: completion.choices[0].message.content || 'No pude generar una respuesta.'
    })
  } catch (err) {
    console.error('Asistente docente error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
