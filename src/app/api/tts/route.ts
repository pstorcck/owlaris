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

    const mp3 = await withOpenAIRetry(() => openai.audio.speech.create({
      model: 'tts-1',
      voice: modo === 'conversation' ? 'nova' : 'onyx',
      input: limpio,
      // La conversacion en ingles es para practicar pronunciacion con alumnos
      // que estan aprendiendo el idioma: mas lento que el habla normal ayuda
      // a entender, en vez de mas rapido (antes 1.08, mas rapido de lo normal).
      speed: modo === 'conversation' ? 0.88 : 1.0,
    }), { maxRetries: 1, baseDelayMs: 300 })

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
