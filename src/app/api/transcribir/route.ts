import { NextRequest, NextResponse } from 'next/server'
import { withOpenAIRetry } from '@/lib/openaiRetry'
import { createClient } from '@/lib/supabase/server'
import { verificarLimiteFrecuencia } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  try {
    const { data: { user } } = await createClient().auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const limite = verificarLimiteFrecuencia(`transcribir:${user.id}`, 20, 60_000)
    if (!limite.permitido) {
      return NextResponse.json({ error: 'Demasiadas grabaciones seguidas. Espera unos segundos.' }, { status: 429 })
    }

    const formData = await req.formData()
    const audio = formData.get('audio') as File
    if (!audio) return NextResponse.json({ error: 'No audio' }, { status: 400 })

    const OpenAI = (await import('openai')).default
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const transcripcion = await withOpenAIRetry(() => openai.audio.transcriptions.create({
      file: audio,
      model: 'whisper-1',
      language: 'en',
      prompt: 'English conversation practice by a student. Transcribe clearly without translating.',
      temperature: 0,
    }))

    return NextResponse.json({ texto: transcripcion.text })
  } catch (err) {
    console.error('Transcripción error:', err)
    return NextResponse.json({ error: 'Error transcripción' }, { status: 500 })
  }
}
