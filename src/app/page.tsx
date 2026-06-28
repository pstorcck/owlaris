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
    case 'padre':      redirect('/padres')
    case 'director':   redirect('/director')
    case 'maestro': {
      // Si tiene asignaciones de guía, ir al panel del guía
      const { data: asig } = await supabase.from('guia_asignaciones').select('id').eq('guia_id', user.id).eq('activo', true).limit(1)
      if (asig && asig.length > 0) redirect('/guia')
      else redirect('/docente')
      break
    }
    case 'admin':
    case 'superadmin': redirect('/admin')
    default:           redirect('/login')
  }
}
