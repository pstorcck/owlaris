import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { texto } = await req.json()
    if (!texto?.trim()) return new Response(JSON.stringify({ error: 'Texto vacío' }), { status: 400 })

    const OpenAI = (await import('openai')).default
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'onyx',
      input: texto.substring(0, 300),
      speed: 1.0,
    })

    // Streaming directo — el audio empieza a sonar mientras llega
    const stream = mp3.body as ReadableStream
    return new Response(stream, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    console.error('TTS error:', err)
    return new Response(JSON.stringify({ error: 'Error TTS' }), { status: 500 })
  }
}
