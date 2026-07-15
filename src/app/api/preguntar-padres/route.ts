import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { withOpenAIRetry } from '@/lib/openaiRetry'
import { calcularCostoUSD } from '@/lib/openaiCost'
import { registrarAlertaTecnica } from '@/lib/technicalAlerts'
import {
  construirIndiceVideos,
  parseCatalogoVideos,
  parseSeccionesPorEncabezado,
  seleccionarRelevantes,
} from '@/lib/padresContenido'

type ArchivoPadres = { nombre: string; contenido: string }

// Cache de documentos CRUDOS (sin recortar) — se carga una vez por hora.
// Hallazgo real CRÍTICO (QA en vivo, 2026-07-15): antes se guardaba un solo
// string ya recortado a 8000 caracteres POR ARCHIVO antes de cachear, así
// que el consejero solo veía el primer ~4-9% de cada documento real
// ("Libro Foro Familiar.md": 185,163 caracteres; "Videos Español.md":
// 260,336 caracteres; "Libro EXTRA ORDINARIOS.md": 85,196 caracteres) sin
// importar la pregunta del padre. Ahora se cachea el contenido COMPLETO de
// cada archivo, y la selección relevante a la pregunta se arma en cada
// solicitud (ver construirContextoPadres), igual que buscarContenido ya
// hace para el contenido curricular de los alumnos.
let docsCache: ArchivoPadres[] | null = null
let docsCacheTime = 0
const CACHE_TTL = 3600000 // 1 hora

async function getArchivosPadres(): Promise<ArchivoPadres[]> {
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

    const archivos: ArchivoPadres[] = []
    for (const file of (files || []).filter((f: {file?:unknown}) => f.file)) {
      const dlRes = await fetch(`https://graph.microsoft.com/v1.0/drives/${driveId}/items/${file.id}/content`, { headers: { Authorization: `Bearer ${access_token}` } })
      if (dlRes.ok) {
        const texto = await dlRes.text()
        archivos.push({ nombre: file.name, contenido: texto })
      }
    }
    docsCache = archivos
    docsCacheTime = now
    console.log('Docs padres cargados:', archivos.map(a => `${a.nombre} (${a.contenido.length} chars)`).join(', '))
    return archivos
  } catch (e) {
    console.error('Error cargando docs padres:', e)
    return []
  }
}

// Presupuesto de caracteres por documento para el contenido seleccionado —
// deliberadamente generoso (los documentos reales llegan a 260,000
// caracteres) pero acotado para no disparar costo/latencia sin límite.
const PRESUPUESTO_POR_DOCUMENTO = 12000

function construirContextoPadres(archivos: ArchivoPadres[], pregunta: string): string {
  let contexto = ''
  for (const archivo of archivos) {
    const esCatalogoDeVideos = /videos/i.test(archivo.nombre)
    if (esCatalogoDeVideos) {
      const entradas = parseCatalogoVideos(archivo.contenido)
      if (entradas.length === 0) {
        // Respaldo: si el formato del catálogo cambia y el parser no
        // reconoce ninguna entrada, no perder el documento por completo.
        contexto += `\n=== ${archivo.nombre} ===\n${archivo.contenido.slice(0, PRESUPUESTO_POR_DOCUMENTO)}\n`
        continue
      }
      const indiceCompleto = construirIndiceVideos(entradas)
      const relevantes = seleccionarRelevantes(entradas, pregunta, PRESUPUESTO_POR_DOCUMENTO)
      const transcripcionesRelevantes = relevantes.map((e) => `${e.titulo}\n${e.url}\n${e.texto}`).join('\n\n')
      contexto += `\n=== ${archivo.nombre} — índice completo de videos disponibles ===\n${indiceCompleto}\n\n=== ${archivo.nombre} — contenido de los videos más relevantes a esta pregunta ===\n${transcripcionesRelevantes}\n`
    } else {
      const secciones = parseSeccionesPorEncabezado(archivo.contenido)
      if (secciones.length === 0) {
        contexto += `\n=== ${archivo.nombre} ===\n${archivo.contenido.slice(0, PRESUPUESTO_POR_DOCUMENTO)}\n`
        continue
      }
      const relevantes = seleccionarRelevantes(secciones, pregunta, PRESUPUESTO_POR_DOCUMENTO)
      const texto = relevantes.map((s) => `## ${s.titulo}\n${s.texto}`).join('\n\n')
      contexto += `\n=== ${archivo.nombre} — secciones más relevantes a esta pregunta ===\n${texto}\n`
    }
  }
  return contexto
}

export async function POST(req: NextRequest) {
  let colegioIdParaAlerta: string | null = null
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { pregunta, historial } = await req.json()
    if (!pregunta?.trim()) return NextResponse.json({ error: 'Pregunta vacía' }, { status: 400 })

    const { data: perfil } = await supabase.from('usuarios').select('colegio_id').eq('id', user.id).single()
    colegioIdParaAlerta = perfil?.colegio_id || null

    const archivos = await getArchivosPadres()
    const docs = construirContextoPadres(archivos, pregunta)
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
    const status = (err as { status?: number } | null)?.status
    const tipoError = status === 429 || (typeof status === 'number' && status >= 500) ? 'openai_agotado' : 'error_interno'
    await registrarAlertaTecnica(createAdminClient(), colegioIdParaAlerta, tipoError, `Ruta:/api/preguntar-padres | ${err instanceof Error ? err.message : String(err)}`.substring(0, 280))
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
