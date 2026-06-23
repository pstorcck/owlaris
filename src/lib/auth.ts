import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export type AuthPerfil = {
  rol: string
  colegio_id: string | null
}

export async function requireRoles(roles: string[]): Promise<
  | { ok: true; supabase: ReturnType<typeof createClient>; user: User; perfil: AuthPerfil }
  | { ok: false; response: NextResponse }
> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  }

  const { data: perfil } = await supabase
    .from('usuarios')
    .select('rol, colegio_id')
    .eq('id', user.id)
    .single()

  if (!perfil || !roles.includes(perfil.rol)) {
    return { ok: false, response: NextResponse.json({ error: 'Sin permisos' }, { status: 403 }) }
  }

  return { ok: true, supabase, user, perfil }
}

export function canAccessColegio(perfil: AuthPerfil, colegioId?: string | null) {
  return perfil.rol === 'superadmin' || (!!colegioId && colegioId === perfil.colegio_id)
}
