import { createClient } from '@/lib/supabase/server'
import ChatInterface from '@/components/chat/ChatInterface'
import { redirect } from 'next/navigation'

export default async function ChatPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('usuarios')
    .select('*, colegio:colegios(*)')
    .eq('id', user.id)
    .single()

  const { data: materias } = await supabase
    .from('materias')
    .select('*')
    .eq('colegio_id', perfil?.colegio_id)
    .eq('activa', true)
    .order('nombre')

  return (
    <ChatInterface
      usuario={perfil}
      materias={materias || []}
    />
  )
}
