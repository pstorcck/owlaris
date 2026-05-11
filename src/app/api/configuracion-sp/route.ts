import { NextRequest, NextResponse } from 'next/server'

const cacheConfig = new Map<string, { contenido: string; timestamp: number }>()
const CACHE_TTL = 1000 * 60 * 30

const DOCS_CONFIGURACION = [
  'Prompt Principal - Agente Alumno.docx',
  'Politica Pedagogica Oficial - Agente Alumno.docx',
  'Documento Maestro - Agente Alumno.docx',
  'Instrucciones SharePoint - Agente Alumno.docx',
  'Exclusiones y Adjuntos Permitidos - Agente Alumno.docx',
]

export async function GET(req: NextRequest) {
  try {
    const cacheKey = '_configuracion'
    const cached = cacheConfig.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({ contenido: cached.contenido })
    }

    const token = await obtenerTokenMicrosoft()
    if (!token) return NextResponse.json({ contenido: '' })

    const siteId = process.env.SHAREPOINT_SITE_ID
    let contenidoTotal = ''

    for (const doc of DOCS_CONFIGURACION) {
      try {
        const ruta = `Owlaris/_Configuracion/${doc}`
        const res = await fetch(
          `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${encodeURIComponent(ruta)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        if (!res.ok) continue
        const data = await res.json()
        const downloadUrl = data['@microsoft.graph.downloadUrl']
        if (!downloadUrl) continue
        const resDoc = await fetch(downloadUrl)
        const buffer = await resDoc.arrayBuffer()
        const mammoth = await import('mammoth')
        const { value: texto } = await mammoth.extractRawText({ buffer: Buffer.from(buffer) })
        contenidoTotal += `\n\n=== ${doc} ===\n${texto.substring(0, 2000)}`
      } catch (e) {
        console.log(`Error leyendo ${doc}:`, e)
      }
    }

    cacheConfig.set(cacheKey, { contenido: contenidoTotal, timestamp: Date.now() })
    return NextResponse.json({ contenido: contenidoTotal })
  } catch (err) {
    console.error('Error leyendo config SharePoint:', err)
    return NextResponse.json({ contenido: '' })
  }
}

async function obtenerTokenMicrosoft(): Promise<string | null> {
  try {
    const res = await fetch(
      `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id:     process.env.AZURE_CLIENT_ID!,
          client_secret: process.env.AZURE_CLIENT_SECRET!,
          scope:         'https://graph.microsoft.com/.default',
          grant_type:    'client_credentials',
        }),
      }
    )
    const data = await res.json()
    return data.access_token || null
  } catch { return null }
}
