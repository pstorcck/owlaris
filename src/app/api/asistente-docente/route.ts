import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { withOpenAIRetry } from '@/lib/openaiRetry'
import { registrarAlertaTecnica } from '@/lib/technicalAlerts'

export async function POST(req: NextRequest) {
  let colegioIdParaAlerta: string | null = null
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: perfil } = await supabase
      .from('usuarios')
      .select('rol, colegio_id')
      .eq('id', user.id)
      .single()
    if (!perfil || !['maestro', 'director', 'admin', 'superadmin'].includes(perfil.rol)) {
      return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
    }
    colegioIdParaAlerta = perfil.colegio_id

    const { pregunta, contexto } = await req.json()

    const OpenAI = (await import('openai')).default
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const completion = await withOpenAIRetry(() => openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 400,
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: 'Eres un asistente pedagogico experto para docentes de colegios en Guatemala. Recibes un resumen real de los informes de los alumnos del guia o director que te consulta (resumen general, alertas activas, temas mas consultados y alumnos que necesitan seguimiento). Usa esos datos concretos para responder: cita alumnos y temas por nombre cuando esten en el contexto, en vez de dar consejos genericos. Si preguntan por un alumno que no aparece en el contexto, dilo claramente y no inventes datos sobre el. Se conciso (maximo 4-5 oraciones). Da recomendaciones especificas y accionables. Habla en espanol guatemalteco, tono profesional pero calido. Usa **negrita** para resaltar datos importantes. Si hay alumnos sin actividad, sugiere estrategias de motivacion. Si hay temas muy consultados, sugiere reforzarlos en clase.\n\nDatos del panel:\n' + (contexto || 'Sin datos disponibles.'),
        },
        { role: 'user', content: pregunta }
      ],
    }))

    return NextResponse.json({
      respuesta: completion.choices[0].message.content || 'No pude generar una respuesta.'
    })
  } catch (err) {
    console.error('Asistente docente error:', err)
    const status = (err as { status?: number } | null)?.status
    const tipoError = status === 429 || (typeof status === 'number' && status >= 500) ? 'openai_agotado' : 'error_interno'
    await registrarAlertaTecnica(createAdminClient(), colegioIdParaAlerta, tipoError, `Ruta:/api/asistente-docente | ${err instanceof Error ? err.message : String(err)}`.substring(0, 280))
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
