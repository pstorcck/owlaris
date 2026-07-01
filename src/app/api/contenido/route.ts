import { NextRequest, NextResponse } from 'next/server'
import { getGradeFolderCandidates, getSharePointFolderCandidates } from '@/lib/sharepointFolders'

const cache = new Map<string, { contenido: string; archivo: string; timestamp: number }>()
const CACHE_TTL = 1000 * 60 * 30

const GRADOS_CON_MINEDUC = ['3ero Básico', '5to Bachillerato']

async function listarArchivos(driveId: string, token: string, ...segmentos: string[]) {
  const ruta = segmentos.map(s => encodeURIComponent(s)).join('/')
  const url  = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${ruta}:/children`
  const res  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    console.log(`❌ No encontrado: ${segmentos.join('/')} — ${err?.error?.code || res.status}`)
    return []
  }
  const data = await res.json()
  return (data.value || []).filter((a: {name:string}) =>
    a.name.endsWith('.docx') && !a.name.startsWith('~$')
  )
}

async function extraerTexto(downloadUrl: string): Promise<string> {
  const r   = await fetch(downloadUrl)
  const buf = await r.arrayBuffer()
  const mammoth = await import('mammoth')
  const { value } = await mammoth.extractRawText({ buffer: Buffer.from(buf) })
  return value
}

export async function POST(req: NextRequest) {
  try {
    const { colegio_slug, grado, materia, pregunta } = await req.json()
    if (!colegio_slug || !grado || !materia) return NextResponse.json({ contenido: '', archivo: null })

    const carpetasColegio = getSharePointFolderCandidates(colegio_slug)
    const cacheKey  = `${carpetasColegio.join('|')}/${grado}/${materia}`
    const cached    = cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({ contenido: cached.contenido, archivo: cached.archivo })
    }

    const token   = await obtenerTokenMicrosoft()
    if (!token) return NextResponse.json({ contenido: '', archivo: null })

    const driveId = process.env.SHAREPOINT_DRIVE_ID!
    let contenido = ''
    let archivo   = null

    // Estructura real: Owlaris/[Colegio]/[Grado]/[Materia]/
    for (const carpetaColegio of carpetasColegio) {
      for (const gradoCarpeta of getGradeFolderCandidates(grado)) {
        console.log(`Buscando: Owlaris/${carpetaColegio}/${gradoCarpeta}/${materia}`)
        const archivos = await listarArchivos(driveId, token, 'Owlaris', carpetaColegio, gradoCarpeta, materia)
        const elegido  = encontrarArchivoRelevante(archivos, pregunta)
        if (elegido) {
          contenido = await extraerTexto(elegido['@microsoft.graph.downloadUrl'])
          archivo   = elegido.name
          console.log(`✅ Encontrado: ${elegido.name}`)
          break
        }
      }
      if (contenido) break
    }

    // Mineduc solo para 3ero Básico y 5to Bachillerato
    if (GRADOS_CON_MINEDUC.includes(grado) && materia.startsWith('Mineduc')) {
      let encontroMineduc = false
      for (const carpetaColegio of carpetasColegio) {
        for (const gradoCarpeta of getGradeFolderCandidates(grado)) {
          console.log(`Buscando Mineduc: ${carpetaColegio}/${gradoCarpeta}/${materia}`)
          const archivosM = await listarArchivos(driveId, token, 'Owlaris', carpetaColegio, gradoCarpeta, materia)
          const elegidoM  = encontrarArchivoRelevante(archivosM, pregunta)
          if (elegidoM) {
            const textoM = await extraerTexto(elegidoM['@microsoft.graph.downloadUrl'])
            contenido   += `\n\n--- Contenido Mineduc ---\n${textoM}`
            archivo      = archivo || elegidoM.name
            console.log(`✅ Mineduc: ${elegidoM.name}`)
            encontroMineduc = true
            break
          }
        }
        if (encontroMineduc) break
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
  let mejor   = -1
  let elegido = archivos[0]
  for (const a of archivos) {
    let p = 0
    for (const w of palabras) if (a.name.toLowerCase().includes(w)) p++
    if (p > mejor) { mejor = p; elegido = a }
  }
  return elegido
}
