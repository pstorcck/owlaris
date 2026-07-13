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
    // Hallazgo real (unificación de paneles, 2026-07-13): antes un maestro
    // sin alumnos asignados iba a /docente (un tercer dashboard aparte) y
    // solo iba a /guia si ya tenía asignaciones — /docente se eliminó, y el
    // panel de /guia ya maneja bien el estado "sin alumnos asignados", así
    // que todo maestro va siempre al mismo panel.
    case 'maestro':    redirect('/guia')
    case 'admin':
    case 'superadmin': redirect('/admin')
    default:           redirect('/login')
  }
}
