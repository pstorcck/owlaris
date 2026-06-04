import { createClient } from '@/lib/supabase/server'
import ChatInterface from '@/components/chat/ChatInterface'
import { redirect } from 'next/navigation'

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

async function leerCarpetasGrado(grado: string): Promise<string[]> {
  if (!grado) return []
  const token = await getToken()
  if (!token) return []
  const driveId = process.env.SHAREPOINT_DRIVE_ID!
  const carpetas: string[] = []
  try {
    const ruta = encodeURIComponent('Owlaris') + '/' + encodeURIComponent('Colegio Montano y Escolaris') + '/' + encodeURIComponent(grado)
    const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${ruta}:/children`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, next: { revalidate: 300 } })
    if (res.ok) {
      const data = await res.json()
      const items: string[] = (data.value || [])
        .filter((i: {folder?:unknown}) => i.folder)
        .map((i: {name:string}) => i.name)
      carpetas.push(...items)
    }
  } catch { /* silencioso */ }
  if (!carpetas.includes('Olimpiadas de Ciencias')) carpetas.push('Olimpiadas de Ciencias')
  carpetas.push('» Conversar en Inglés')
  return carpetas
}

export default async function ChatPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('usuarios')
    .select('*, colegio:colegios(*)')
    .eq('id', user.id)
    .single()

  // Maestros y admins van al dashboard
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
  console.log('Cargando materias para grado:', grado)
  const materiasDisponibles = await leerCarpetasGrado(grado)
  console.log('Materias cargadas:', materiasDisponibles)

  return (
    <ChatInterface
      usuario={perfil}
      materias={materias || []}
      materiasDisponibles={materiasDisponibles}
    />
  )
}
