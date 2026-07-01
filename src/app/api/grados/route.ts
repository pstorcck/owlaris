import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getExpectedGradeFallbacks,
  getSharePointFolderCandidates,
  isLikelyGradeFolder,
  sortGradesForSchool,
} from '@/lib/sharepointFolders'

const NO_GRADOS = ['Olimpiadas de Ciencias', 'Preparación pruebas nacionales']

async function getToken(): Promise<string | null> {
  try {
    const res = await fetch(
      `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.AZURE_CLIENT_ID!,
          client_secret: process.env.AZURE_CLIENT_SECRET!,
          scope: 'https://graph.microsoft.com/.default',
          grant_type: 'client_credentials',
        }),
      }
    )
    const data = await res.json()
    return data.access_token || null
  } catch { return null }
}

export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // Obtener colegio del usuario para usar su carpeta de SharePoint correcta
    const { data: perfil } = await supabase
      .from('usuarios')
      .select('colegio:colegios(nombre, sharepoint_folder, slug)')
      .eq('id', user.id)
      .maybeSingle()

    const colegio = perfil?.colegio as {nombre?: string; sharepoint_folder?: string; slug?: string} | null
    const carpetasColegio = getSharePointFolderCandidates(colegio)
    if (carpetasColegio.length === 0) return NextResponse.json({ grados: [] })
    const fallback = getExpectedGradeFallbacks(colegio)

    const token = await getToken()
    if (!token) return NextResponse.json({ grados: fallback })

    const driveId = process.env.SHAREPOINT_DRIVE_ID!
    let grados: string[] = []
    for (const carpetaColegio of carpetasColegio) {
      const ruta = encodeURIComponent('Owlaris') + '/' + encodeURIComponent(carpetaColegio)
      const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${ruta}:/children`
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) continue

      const data = await res.json()
      grados = (data.value || [])
        .filter((i: {folder?: unknown; name: string}) =>
          i.folder && !NO_GRADOS.includes(i.name) && isLikelyGradeFolder(i.name, colegio)
        )
        .map((i: {name: string}) => i.name)
      grados = sortGradesForSchool(grados, colegio)
      if (grados.length > 0) break
    }

    return NextResponse.json({ grados: grados.length > 0 ? grados : fallback })
  } catch {
    return NextResponse.json({ grados: [] })
  }
}
