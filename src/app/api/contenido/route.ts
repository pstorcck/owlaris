import { NextRequest, NextResponse } from 'next/server'

// Cache simple en memoria para no llamar SharePoint en cada pregunta
const cache = new Map<string, { contenido: string; archivo: string; timestamp: number }>()
const CACHE_TTL = 1000 * 60 * 30 // 30 minutos

export async function POST(req: NextRequest) {
  try {
    const { colegio_slug, grado, materia, pregunta } = await req.json()

    if (!colegio_slug || !grado || !materia) {
      return NextResponse.json({ contenido: '', archivo: null })
    }

    // Construir clave de cache
    const cacheKey = `${colegio_slug}/${grado}/${materia}`
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({ contenido: cached.contenido, archivo: cached.archivo })
    }

    // Obtener token de Microsoft Graph
    const token = await obtenerTokenMicrosoft()
    if (!token) {
      return NextResponse.json({ contenido: '', archivo: null })
    }

    // Buscar archivos en la carpeta correcta de SharePoint
    const carpeta = `Owlaris/${colegio_slug}/${grado}/${materia}`
    const siteId = process.env.SHAREPOINT_SITE_ID

    const resArchivos = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${encodeURIComponent(carpeta)}:/children`,
      { headers: { Authorization: `Bearer ${token}` } }
    )

    if (!resArchivos.ok) {
      // Carpeta no existe — registrar como pendiente
      return NextResponse.json({ contenido: '', archivo: null })
    }

    const dataArchivos = await resArchivos.json()
    const archivos = dataArchivos.value || []

    if (archivos.length === 0) {
      return NextResponse.json({ contenido: '', archivo: null })
    }

    // Encontrar el archivo más relevante según la pregunta
    const archivoElegido = encontrarArchivoRelevante(archivos, pregunta, materia)
    if (!archivoElegido) {
      return NextResponse.json({ contenido: '', archivo: null })
    }

    // Descargar y extraer texto del .docx
    const resContenido = await fetch(archivoElegido['@microsoft.graph.downloadUrl'])
    const buffer = await resContenido.arrayBuffer()

    const mammoth = await import('mammoth')
    const { value: texto } = await mammoth.extractRawText({ buffer: Buffer.from(buffer) })

    // Guardar en cache
    cache.set(cacheKey, {
      contenido: texto,
      archivo: archivoElegido.name,
      timestamp: Date.now(),
    })

    return NextResponse.json({
      contenido: texto,
      archivo: archivoElegido.name,
    })

  } catch (err) {
    console.error('Error en /api/contenido:', err)
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
    return data.access_token || null
  } catch {
    return null
  }
}

function encontrarArchivoRelevante(
  archivos: { name: string; '@microsoft.graph.downloadUrl': string }[],
  pregunta: string,
  materia: string
): { name: string; '@microsoft.graph.downloadUrl': string } | null {
  const docsWord = archivos.filter(a => a.name.endsWith('.docx'))
  if (docsWord.length === 0) return null
  if (docsWord.length === 1) return docsWord[0]

  // Buscar el más relevante según palabras clave en el nombre
  const palabrasPregunta = pregunta.toLowerCase().split(' ').filter(p => p.length > 3)
  let mejorPuntaje = -1
  let mejorArchivo = docsWord[0]

  for (const archivo of docsWord) {
    const nombreLower = archivo.name.toLowerCase()
    let puntaje = 0
    for (const palabra of palabrasPregunta) {
      if (nombreLower.includes(palabra)) puntaje++
    }
    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje
      mejorArchivo = archivo
    }
  }

  return mejorArchivo
}
