import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ASSISTANT_ID = 'asst_gBx2BctXHrWZavDsrP6s8iWn'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { pregunta, thread_id } = await req.json()
    if (!pregunta?.trim()) return NextResponse.json({ error: 'Pregunta vacía' }, { status: 400 })

    const OpenAI = (await import('openai')).default
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    // Crear o reutilizar thread
    let threadId = thread_id
    if (!threadId) {
      const thread = await openai.beta.threads.create()
      threadId = thread.id
    }

    // Agregar mensaje
    await openai.beta.threads.messages.create(threadId, {
      role: 'user',
      content: pregunta,
    })

    // Ejecutar assistant
    const run = await openai.beta.threads.runs.createAndPoll(threadId, {
      assistant_id: ASSISTANT_ID,
    })

    if (run.status !== 'completed') {
      return NextResponse.json({ error: 'Error al procesar' }, { status: 500 })
    }

    // Obtener respuesta
    const messages = await openai.beta.threads.messages.list(threadId, { limit: 1 })
    const msg = messages.data[0]
    let respuesta = ''
    for (const block of msg.content) {
      if (block.type === 'text') {
        respuesta += block.text.value
      }
    }

    // Guardar interacción en Supabase
    const { data: perfil } = await supabase.from('usuarios').select('colegio_id').eq('id', user.id).single()
    await supabase.from('interacciones').insert({
      usuario_id: user.id,
      colegio_id: perfil?.colegio_id,
      pregunta: pregunta.substring(0, 500),
      respuesta: respuesta.substring(0, 1000),
      modelo_usado: 'asst_padres',
      tokens_usados: 0,
    })

    return NextResponse.json({ respuesta, thread_id: threadId })
  } catch (err) {
    console.error('Error agente padres:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
