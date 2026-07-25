import { createAdminClient, createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ChatPadres from '@/components/padres/ChatPadres'
import { getLinkedChildren } from '@/lib/guideAccess'

export default async function PadresPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('usuarios')
    .select('*, colegio:colegios(*)')
    .eq('id', user.id)
    .single()

  if (!perfil || perfil.rol !== 'padre') redirect('/chat')

  const hijos = await getLinkedChildren(createAdminClient(), user.id)

  return <ChatPadres usuario={perfil} hijos={hijos} />
}
