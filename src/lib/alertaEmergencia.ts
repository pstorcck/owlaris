// Hallazgo real (auditoría 2026-07-07): cuando checkContentSafety detecta
// una crisis real (autolesión, abuso, violencia) y el alumno no tiene guía
// asignado (ni por alumno ni por grado), la alerta quedaba SOLO en la tabla
// alertas — cero notificación a un humano. Esta cadena de respaldo asegura
// que, si no hay guía, se notifique al staff del colegio (director/admin),
// y si el colegio no tiene staff activo configurado, a un superadmin global
// — una alerta de seguridad real nunca debe quedar en silencio.
import type { createAdminClient } from '@/lib/supabase/server'

type AdminClient = ReturnType<typeof createAdminClient>

export type DestinatarioAlerta = { email: string; nombre_completo: string }
export type FuenteDestinatariosAlerta = 'guia_asignado' | 'staff_colegio' | 'superadmin' | 'ninguno'

export function elegirFuenteDestinatariosAlerta(input: {
  hayGuiaAsignado: boolean
  hayStaffColegio: boolean
  haySuperadmin: boolean
}): FuenteDestinatariosAlerta {
  if (input.hayGuiaAsignado) return 'guia_asignado'
  if (input.hayStaffColegio) return 'staff_colegio'
  if (input.haySuperadmin) return 'superadmin'
  return 'ninguno'
}

function conEmail(rows: Array<{ email?: string | null; nombre_completo?: string | null }> | null): DestinatarioAlerta[] {
  return (rows || [])
    .filter((r): r is { email: string; nombre_completo?: string | null } => !!r.email)
    .map((r) => ({ email: r.email, nombre_completo: r.nombre_completo || 'Staff de Owlaris' }))
}

export async function buscarStaffColegio(admin: AdminClient, colegioId: string): Promise<DestinatarioAlerta[]> {
  const { data } = await admin
    .from('usuarios')
    .select('email, nombre_completo')
    .eq('colegio_id', colegioId)
    .eq('activo', true)
    .in('rol', ['director', 'admin'])
    .limit(5)
  return conEmail(data)
}

export async function buscarSuperadmins(admin: AdminClient): Promise<DestinatarioAlerta[]> {
  const { data } = await admin
    .from('usuarios')
    .select('email, nombre_completo')
    .eq('rol', 'superadmin')
    .eq('activo', true)
    .limit(3)
  return conEmail(data)
}
