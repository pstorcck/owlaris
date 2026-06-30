import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DirectorDashboard from '@/components/director/DirectorDashboard'

export default async function DirectorPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('usuarios')
    .select('*, colegio:colegios(*)')
    .eq('id', user.id)
    .single()

  if (!perfil || !['director', 'admin', 'superadmin'].includes(perfil.rol)) {
    redirect('/')
  }

  return <DirectorDashboard />
}
