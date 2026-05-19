import { NextRequest, NextResponse } from 'next/server'

const cache = new Map<string, { contenido: string; archivo: string; timestamp: number }>()
const CACHE_TTL = 1000 * 60 * 30

const GRADOS_CON_MINEDUC = ['3ero Básico', '5to Bachillerato']

const COLEGIOS_SHAREPOINT: Record<string, string> = {
  'escolaris':       'Escolaris',
  'colegio-montano': 'Colegio Montano',
  'Escolaris':       'Escolaris',
  'Colegio Montano': 'Colegio Montano',
}

export async function POST(req: NextRequest) {
  try {
    const { colegio_slug, grado, materia, pregunta } = await req.json()
    if (!colegio_slug || !grado || !materia) return NextResponse.json({ contenido: '', archivo: null })

    const colegioSP = COLEGIOS_SHAREPOINT[colegio_slug] || colegio_slug
    const cacheKey  = `${colegioSP}/${grado}/${materia}`
    const cached    = cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({ contenido: cached.contenido, archivo: cached.archivo })
    }

    const token = await obtenerTokenMicrosoft()
    if (!token) return NextResponse.json({ contenido: '', archivo: null })

    const siteId  = process.env.SHAREPOINT_SITE_ID
    let contenido = ''
    let archivo   = null

    // 1. Contenido del colegio
    const carpeta = `Owlaris/${colegioSP}/01_Contenido_Vigente/${grado}/${materia}`
    console.log(`Buscando: ${carpeta}`)

    const resArchivos = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${encodeURIComponent(carpeta)}:/children`,
      { headers: { Authorization: `Bearer ${token}` } }
    )

    if (resArchivos.ok) {
      const data     = await resArchivos.json()
      const archivos = (data.value || []).filter((a: {name:string}) =>
        a.name.endsWith('.docx') && !a.name.startsWith('~$')
      )
      const elegido = encontrarArchivoRelevante(archivos, pregunta)
      if (elegido) {
        const r   = await fetch(elegido['@microsoft.graph.downloadUrl'])
        const buf = await r.arrayBuffer()
        const mammoth = await import('mammoth')
        const { value } = await mammoth.extractRawText({ buffer: Buffer.from(buf) })
        contenido = value
        archivo   = elegido.name
        console.log(`✅ Encontrado: ${elegido.name}`)
      }
    } else {
      console.log(`❌ No encontrado: ${carpeta}`)
    }

    // 2. Mineduc solo para 3ero Básico y 5to Bachillerato
    if (GRADOS_CON_MINEDUC.includes(grado) && (materia === 'Mineduc - Lenguaje' || materia === 'Mineduc - Matemática')) {
      const rutaM = `Owlaris/${colegioSP}/01_Contenido_Vigente/${grado}/${materia}`
      console.log(`Buscando Mineduc: ${rutaM}`)
      const resM = await fetch(
        `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${encodeURIComponent(rutaM)}:/children`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (resM.ok) {
        const dataM     = await resM.json()
        const archivosM = (dataM.value || []).filter((a: {name:string}) =>
          a.name.endsWith('.docx') && !a.name.startsWith('~$')
        )
        const elegidoM = encontrarArchivoRelevante(archivosM, pregunta)
        if (elegidoM) {
          const r   = await fetch(elegidoM['@microsoft.graph.downloadUrl'])
          const buf = await r.arrayBuffer()
          const mammoth = await import('mammoth')
          const { value } = await mammoth.extractRawText({ buffer: Buffer.from(buf) })
          contenido += `\n\n--- Contenido Mineduc ---\n${value}`
          archivo    = archivo || elegidoM.name
          console.log(`✅ Mineduc: ${elegidoM.name}`)
        }
      }
    }

    if (contenido) cache.set(cacheKey, { contenido, archivo: archivo!, timestamp: Date.now() })
    return NextResponse.json({ contenido, archivo })

  } catch (err) {
    console.error('Error /api/contenido:', err)
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
  } catch { return null }
}

function encontrarArchivoRelevante(
  archivos: { name: string; '@microsoft.graph.downloadUrl': string }[],
  pregunta: string
): { name: string; '@microsoft.graph.downloadUrl': string } | null {
  if (archivos.length === 0) return null
  if (archivos.length === 1) return archivos[0]
  const palabras = pregunta.toLowerCase().split(/\s+/).filter(p => p.length > 3)
  let mejor  = -1
  let elegido = archivos[0]
  for (const a of archivos) {
    let p = 0
    for (const w of palabras) if (a.name.toLowerCase().includes(w)) p++
    if (p > mejor) { mejor = p; elegido = a }
  }
  return elegido
}
