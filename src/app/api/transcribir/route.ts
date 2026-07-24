import { NextRequest, NextResponse } from 'next/server'
import { withOpenAIRetry } from '@/lib/openaiRetry'
import { createClient } from '@/lib/supabase/server'
import { verificarLimiteFrecuencia } from '@/lib/rateLimit'

// Promedio de logprobs por token, convertido de logaritmo natural a
// probabilidad (0-1), como señal de qué tan segura estuvo la transcripción.
// Es el mismo rol que la "confidence" que ya manda la Web Speech API del
// navegador para el reconocimiento en vivo, pero disponible también cuando
// esa API no existe (Firefox) o no reconoció nada y se cae a este endpoint.
function confianzaDesdeLogprobs(logprobs: Array<{ logprob?: number }> | undefined): number | null {
  if (!logprobs || logprobs.length === 0) return null
  const valores = logprobs.map((l) => l.logprob).filter((v): v is number => typeof v === 'number')
  if (valores.length === 0) return null
  const promedio = valores.reduce((a, b) => a + b, 0) / valores.length
  return Math.exp(promedio)
}

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

    // gpt-4o-mini-transcribe en vez de whisper-1: mejor precisión y, con
    // include:['logprobs'], devuelve qué tan segura estuvo de cada token —
    // whisper-1 no ofrece esa señal en absoluto.
    const transcripcion = await withOpenAIRetry(() => openai.audio.transcriptions.create({
      file: audio,
      model: 'gpt-4o-mini-transcribe',
      language: 'en',
      prompt: 'English conversation practice by a student. Transcribe clearly without translating.',
      temperature: 0,
      response_format: 'json',
      include: ['logprobs'],
    }))

    return NextResponse.json({
      texto: transcripcion.text,
      confianza: confianzaDesdeLogprobs(transcripcion.logprobs),
    })
  } catch (err) {
    console.error('Transcripción error:', err)
    return NextResponse.json({ error: 'Error transcripción' }, { status: 500 })
  }
}
