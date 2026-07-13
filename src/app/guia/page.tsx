import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DirectorDashboard from '@/components/director/DirectorDashboard'

// Hallazgo real (unificación de paneles, 2026-07-13): director y guía
// compartían dos implementaciones de dashboard completamente distintas y
// desordenadas (esta página tenía su propio layout monolítico, y /docente
// tenía un tercer dashboard aparte para maestros sin alumnos asignados).
// Ahora ambos roles usan el mismo componente compartido — la única
// diferencia real es el alcance de datos (todo el colegio para director,
// solo los alumnos designados para el guía), resuelto en
// /api/director/stats según el rol de la sesión.
export default async function GuiaPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (!perfil || !['maestro', 'admin', 'superadmin'].includes(perfil.rol)) {
    redirect('/chat')
  }

  return <DirectorDashboard />
}
