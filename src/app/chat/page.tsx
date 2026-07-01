import { createClient } from '@/lib/supabase/server'
import ChatInterface from '@/components/chat/ChatInterface'
import { redirect } from 'next/navigation'
import {
  getGradeFolderCandidates,
  getSharePointFolderCandidates,
  includeSharedPrograms,
  inferSubjectFromSharePointName,
  isSharePointDocx,
  pushUniqueSharePointName,
} from '@/lib/sharepointFolders'

async function getToken(): Promise<string | null> {
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

async function leerCarpetasGrado(grado: string, carpetasColegio: string[], incluirOlimpiadas: boolean): Promise<string[]> {
  if (!grado || carpetasColegio.length === 0) return []
  const token = await getToken()
  if (!token) return []
  const driveId = process.env.SHAREPOINT_DRIVE_ID!
  const carpetas: string[] = []
  for (const carpetaColegio of carpetasColegio) {
    for (const gradoCarpeta of getGradeFolderCandidates(grado)) {
      try {
        const ruta = encodeURIComponent('Owlaris') + '/' + encodeURIComponent(carpetaColegio) + '/' + encodeURIComponent(gradoCarpeta)
        const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${ruta}:/children`
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, next: { revalidate: 300 } })
        if (res.ok) {
          const data = await res.json()
          const value = data.value || []
          const carpetasMateria: string[] = value
            .filter((i: {folder?:unknown}) => i.folder)
            .map((i: {name:string}) => i.name)
          const materiasDesdeDocumentos: string[] = value
            .filter((i: {file?:unknown; name:string}) => i.file && isSharePointDocx(i.name))
            .map((i: {name:string}) => inferSubjectFromSharePointName(i.name))
            .filter((materia: string | null): materia is string => Boolean(materia))
          ;[...carpetasMateria, ...materiasDesdeDocumentos].forEach(materia => {
            pushUniqueSharePointName(carpetas, materia)
          })
          if (carpetasMateria.length > 0 || materiasDesdeDocumentos.length > 0) break
        }
      } catch { /* silencioso */ }
    }
    if (carpetas.length > 0) break
  }
  if (incluirOlimpiadas && !carpetas.includes('Olimpiadas de Ciencias')) carpetas.push('Olimpiadas de Ciencias')
  carpetas.push('» Conversar en Inglés')
  return carpetas
}

function tieneMateriasCurriculares(materias: string[]) {
  return materias.some(m => !m.includes('Olimpiadas') && !m.includes('Conversar') && !m.includes('Conversation'))
}

function combinarConAccesosEspeciales(materias: string[], incluirOlimpiadas: boolean) {
  const out = Array.from(new Set(materias.filter(Boolean)))
  if (incluirOlimpiadas && !out.includes('Olimpiadas de Ciencias')) out.push('Olimpiadas de Ciencias')
  if (!out.includes('» Conversar en Inglés')) out.push('» Conversar en Inglés')
  return out
}

export default async function ChatPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfil, error: perfilError } = await supabase
    .from('usuarios')
    .select('*, colegio:colegios(*)')
    .eq('id', user.id)
    .single()
  

  // Si no hay perfil redirigir al login
  if (perfil?.rol === 'maestro') redirect('/docente')
  if (perfil?.rol === 'admin') redirect('/admin')

  const { data: materias } = await supabase
    .from('materias')
    .select('*')
    .eq('colegio_id', perfil?.colegio_id)
    .eq('activa', true)
    .order('nombre')

  // Cargar materias disponibles desde SharePoint
  const grado = perfil?.grado || ''
  const carpetasColegio = getSharePointFolderCandidates(perfil?.colegio)
  const incluirOlimpiadas = includeSharedPrograms(perfil?.colegio)
  const materiasSharePoint = perfil?.rol === 'maestro' ? [] : await leerCarpetasGrado(grado, carpetasColegio, incluirOlimpiadas)
  const materiasDisponibles = tieneMateriasCurriculares(materiasSharePoint)
    ? materiasSharePoint
    : combinarConAccesosEspeciales((materias || []).map(m => m.nombre), incluirOlimpiadas)

  return (
    <ChatInterface
      usuario={perfil}
      materias={materias || []}
      materiasDisponibles={materiasDisponibles}
    />
  )
}
