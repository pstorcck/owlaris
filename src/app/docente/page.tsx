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

  if (!perfil || !['docente','admin','superadmin'].includes(perfil.rol)) {
    redirect('/chat')
  }

  return <DashboardDocente perfil={perfil} />
}
