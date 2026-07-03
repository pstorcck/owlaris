import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withOpenAIRetry } from '@/lib/openaiRetry'
import { calcularCostoUSD } from '@/lib/openaiCost'

// Cache de documentos — se carga una vez
let docsCache: string | null = null
let docsCacheTime = 0
const CACHE_TTL = 3600000 // 1 hora

async function getDocsPadres(query?: string): Promise<string> {
  const now = Date.now()
  if (docsCache && now - docsCacheTime < CACHE_TTL) return docsCache

  try {
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`,
      { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: process.env.AZURE_CLIENT_ID!, client_secret: process.env.AZURE_CLIENT_SECRET!, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' }) }
    )
    const { access_token } = await tokenRes.json()
    const driveId = process.env.SHAREPOINT_DRIVE_ID!
    const ruta = encodeURIComponent('Owlaris') + '/' + encodeURIComponent('Owlaris padres')
    const listRes = await fetch(`https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${ruta}:/children`, { headers: { Authorization: `Bearer ${access_token}` } })
    const { value: files } = await listRes.json()

    let contenido = ''
    for (const file of (files || []).filter((f: {file?:unknown}) => f.file)) {
      const dlRes = await fetch(`https://graph.microsoft.com/v1.0/drives/${driveId}/items/${file.id}/content`, { headers: { Authorization: `Bearer ${access_token}` } })
      if (dlRes.ok) {
        const texto = await dlRes.text()
        contenido += `\n=== ${file.name} ===\n${texto.substring(0, 8000)}\n`
      }
    }
    docsCache = contenido
    docsCacheTime = now
    console.log('Docs padres cargados:', contenido.length, 'chars')
    return contenido
  } catch (e) {
    console.error('Error cargando docs padres:', e)
    return ''
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { pregunta, historial } = await req.json()
    if (!pregunta?.trim()) return NextResponse.json({ error: 'Pregunta vacía' }, { status: 400 })

    const docs = await getDocsPadres(pregunta)
    const OpenAI = (await import('openai')).default
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const systemPrompt = `Eres Owlaris, consejero educativo familiar de Colegio Montano y Escolaris en Guatemala.

DOCUMENTOS BASE (lee todo y úsalos para responder):
${docs}

REGLAS OBLIGATORIAS:
1. Basa SIEMPRE tus respuestas en los documentos anteriores.
2. SIEMPRE que haya un video relevante en los documentos, inclúyelo exactamente así:
   Video recomendado: TITULO - URL_COMPLETA
3. Tono cálido, empático, como amigo experto. Nunca generes culpa.
4. Responde en español. Usa **negritas** para puntos clave.
5. Estructura SIEMPRE:
   - Reconocer la situación (1 línea empática)
   - 3-4 consejos prácticos de los documentos
   - Video recomendado si aplica (con link completo)
   - Accion concreta para HOY
   - Pregunta de seguimiento
6. Para temas sensibles recomienda apoyo profesional.`

        const messages: {role: 'system'|'user'|'assistant'; content: string}[] = [
      { role: 'system', content: systemPrompt },
      ...(historial || []).slice(-6),
      { role: 'user', content: pregunta },
    ]

    const completion = await withOpenAIRetry(() => openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 600,
      temperature: 0.7,
    }))

    const respuesta = completion.choices[0].message.content || 'No pude generar una respuesta.'

    const { data: perfil } = await supabase.from('usuarios').select('colegio_id').eq('id', user.id).single()
    await supabase.from('interacciones').insert({
      usuario_id: user.id,
      colegio_id: perfil?.colegio_id,
      pregunta: pregunta.substring(0, 500),
      respuesta: respuesta.substring(0, 1000),
      modelo_usado: 'gpt-4o-mini-padres',
      tokens_usados: completion.usage?.total_tokens || 0,
      costo_usd: calcularCostoUSD(completion.usage),
    })

    return NextResponse.json({ respuesta })
  } catch (err) {
    console.error('Error agente padres:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
