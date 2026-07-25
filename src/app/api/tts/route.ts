import { NextRequest } from 'next/server'
import { withOpenAIRetry } from '@/lib/openaiRetry'
import { createClient } from '@/lib/supabase/server'
import { verificarLimiteFrecuencia } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  try {
    const { data: { user } } = await createClient().auth.getUser()
    if (!user) return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 })

    const limite = verificarLimiteFrecuencia(`tts:${user.id}`, 30, 60_000)
    if (!limite.permitido) {
      return new Response(JSON.stringify({ error: 'Demasiadas solicitudes de audio seguidas. Espera unos segundos.' }), { status: 429 })
    }

    const { texto, modo } = await req.json()
    if (!texto?.trim()) return new Response(JSON.stringify({ error: 'Texto vacío' }), { status: 400 })

    const OpenAI = (await import('openai')).default
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const limpio = String(texto)
      .replace(/\[OP:[^\]]+\]/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, modo === 'conversation' ? 240 : 300)

    // La conversacion en ingles usa gpt-4o-mini-tts: voz mas natural y
    // "steerable" por instrucciones en lenguaje natural. Ese modelo no
    // soporta el parametro "speed" (a diferencia de tts-1) — el ritmo mas
    // lento para alumnos que aprenden ingles se pide como instruccion.
    const mp3 = await withOpenAIRetry(() => openai.audio.speech.create(
      modo === 'conversation'
        ? {
            model: 'gpt-4o-mini-tts',
            voice: 'fable',
            input: limpio,
            instructions: 'Speak like a warm, kind male tutor with an academic, articulate tone: enunciate each word clearly, pace it a little slower than normal conversation, and sound genuinely encouraging and approachable, never stiff or cold.',
          }
        : {
            model: 'tts-1',
            voice: 'onyx',
            input: limpio,
            speed: 1.0,
          }
    ), { maxRetries: 1, baseDelayMs: 300 })

    // Streaming directo — el audio empieza a sonar mientras llega
    const stream = mp3.body as ReadableStream
    return new Response(stream, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('TTS error:', err)
    return new Response(JSON.stringify({ error: 'Error TTS' }), { status: 500 })
  }
}
