import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (!perfil) redirect('/login')

  switch (perfil.rol) {
    case 'alumno':     redirect('/chat')
    case 'maestro':    redirect('/docente')
    case 'admin':
    case 'superadmin': redirect('/admin')
    default:           redirect('/login')
  }
}
