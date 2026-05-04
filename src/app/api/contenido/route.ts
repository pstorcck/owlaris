import { NextRequest, NextResponse } from 'next/server'

const cache = new Map<string, { contenido: string; archivo: string; timestamp: number }>()
const CACHE_TTL = 1000 * 60 * 30

const COLEGIOS_SHAREPOINT: Record<string, string> = {
  'escolaris':       'Escolaris',
  'colegio-montano': 'Colegio Montano',
  'Escolaris':       'Escolaris',
  'Colegio Montano': 'Colegio Montano',
}

export async function POST(req: NextRequest) {
  try {
    const { colegio_slug, grado, materia, pregunta } = await req.json()
    if (!colegio_slug || !grado || !materia) {
      return NextResponse.json({ contenido: '', archivo: null })
    }

    const colegioSP = COLEGIOS_SHAREPOINT[colegio_slug] || colegio_slug
    // Usar grado y materia EXACTAMENTE como vienen — sin transformar
    const gradoSP   = grado
    const materiaSP = materia

    const cacheKey = `${colegioSP}/${gradoSP}/${materiaSP}`
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({ contenido: cached.contenido, archivo: cached.archivo })
    }

    const token = await obtenerTokenMicrosoft()
    if (!token) {
      console.log('❌ No se pudo obtener token de Microsoft')
      return NextResponse.json({ contenido: '', archivo: null })
    }

    const carpeta = `Owlaris/${colegioSP}/01_Contenido_Vigente/${gradoSP}/${materiaSP}`
    const siteId  = process.env.SHAREPOINT_SITE_ID
    console.log(`🔍 Buscando en SharePoint: ${carpeta}`)

    const resArchivos = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${encodeURIComponent(carpeta)}:/children`,
      { headers: { Authorization: `Bearer ${token}` } }
    )

    if (!resArchivos.ok) {
      const err = await resArchivos.json()
      console.log(`❌ Carpeta no encontrada: ${carpeta}`, JSON.stringify(err))
      return NextResponse.json({ contenido: '', archivo: null })
    }

    const dataArchivos = await resArchivos.json()
    const archivos = dataArchivos.value || []
    console.log(`📁 Archivos encontrados: ${archivos.length}`)

    if (archivos.length === 0) {
      return NextResponse.json({ contenido: '', archivo: null })
    }

    const archivoElegido = encontrarArchivoRelevante(archivos, pregunta)
    if (!archivoElegido) {
      return NextResponse.json({ contenido: '', archivo: null })
    }

    console.log(`✅ Archivo elegido: ${archivoElegido.name}`)
    const resContenido = await fetch(archivoElegido['@microsoft.graph.downloadUrl'])
    const buffer = await resContenido.arrayBuffer()
    const mammoth = await import('mammoth')
    const { value: texto } = await mammoth.extractRawText({ buffer: Buffer.from(buffer) })

    cache.set(cacheKey, { contenido: texto, archivo: archivoElegido.name, timestamp: Date.now() })
    return NextResponse.json({ contenido: texto, archivo: archivoElegido.name })

  } catch (err) {
    console.error('❌ Error en /api/contenido:', err)
    return NextResponse.json({ contenido: '', archivo: null })
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
    if (!data.access_token) console.log('❌ Token error:', JSON.stringify(data))
    return data.access_token || null
  } catch (e) {
    console.error('❌ Error obteniendo token:', e)
    return null
  }
}

function encontrarArchivoRelevante(
  archivos: { name: string; '@microsoft.graph.downloadUrl': string }[],
  pregunta: string
): { name: string; '@microsoft.graph.downloadUrl': string } | null {
  const docsWord = archivos.filter(a => a.name.endsWith('.docx') && !a.name.startsWith('~$'))
  if (docsWord.length === 0) return null
  if (docsWord.length === 1) return docsWord[0]

  const palabras = pregunta.toLowerCase().split(/\s+/).filter(p => p.length > 3)
  let mejorPuntaje = -1
  let mejorArchivo = docsWord[0]

  for (const archivo of docsWord) {
    const nombreLower = archivo.name.toLowerCase()
    let puntaje = 0
    for (const palabra of palabras) {
      if (nombreLower.includes(palabra)) puntaje++
    }
    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje
      mejorArchivo = archivo
    }
  }
  return mejorArchivo
}
