import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardDocente from '@/components/docente/DashboardDocente'

export default async function DocentePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('usuarios')
    .select('*, colegio:colegios(*)')
    .eq('id', user.id)
    .single()

  // Verificar si tiene asignaciones de guía
  const { data: asignaciones } = await supabase
    .from('guia_asignaciones')
    .select('id')
    .eq('guia_id', user.id)
    .eq('activo', true)
    .limit(1)

  const esGuia = (asignaciones || []).length > 0

  if (!perfil || !['maestro','admin','superadmin'].includes(perfil.rol)) {
    redirect('/chat')
  }

  return <DashboardDocente perfil={perfil} esGuia={esGuia} />
}
