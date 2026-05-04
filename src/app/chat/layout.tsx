import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('usuarios')
    .select('*, colegio:colegios(*)')
    .eq('id', user.id)
    .single()

  if (!perfil || perfil.rol !== 'alumno') redirect('/login')

  return <>{children}</>
}
