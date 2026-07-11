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

// Hallazgo real (revisión 2026-07-11): la cascada de respaldo (guía →
// staff del colegio → superadmin) solo estaba implementada para alertas de
// seguridad de contenido (registrarAlertaContenido en preguntar/route.ts).
// Las alertas académicas automáticas (baja comprensión) y las alertas
// manuales creadas desde /api/alertas solo buscaban un guía asignado — si
// el colegio no tenía guías configurados todavía, esas alertas quedaban
// SOLO en la base de datos, sin ningún correo a nadie. Se centraliza la
// resolución de destinatarios aquí para que las tres rutas de creación de
// alertas usen la misma cascada.
export async function resolverDestinatariosAlerta(admin: AdminClient, input: {
  colegioId: string
  alumnoId: string
  grado?: string | null
}): Promise<{ destinatarios: DestinatarioAlerta[]; fuente: FuenteDestinatariosAlerta; guiaId: string | null }> {
  const { data: asigAlumno } = await admin
    .from('guia_asignaciones')
    .select('guia_id, guia:guia_id(email, nombre_completo)')
    .eq('colegio_id', input.colegioId)
    .eq('activo', true)
    .eq('tipo', 'alumno')
    .eq('alumno_id', input.alumnoId)
    .limit(1)
    .maybeSingle()

  let asig = asigAlumno
  if (!asig && input.grado) {
    const { data: asigGrado } = await admin
      .from('guia_asignaciones')
      .select('guia_id, guia:guia_id(email, nombre_completo)')
      .eq('colegio_id', input.colegioId)
      .eq('activo', true)
      .eq('tipo', 'grado')
      .eq('grado', input.grado)
      .limit(1)
      .maybeSingle()
    asig = asigGrado
  }

  const guiaAsignado = asig?.guia ? [asig.guia as unknown as DestinatarioAlerta] : []
  let staffColegio: DestinatarioAlerta[] = []
  let superadmins: DestinatarioAlerta[] = []
  if (guiaAsignado.length === 0) {
    staffColegio = await buscarStaffColegio(admin, input.colegioId)
    if (staffColegio.length === 0) {
      superadmins = await buscarSuperadmins(admin)
    }
  }
  const fuente = elegirFuenteDestinatariosAlerta({
    hayGuiaAsignado: guiaAsignado.length > 0,
    hayStaffColegio: staffColegio.length > 0,
    haySuperadmin: superadmins.length > 0,
  })
  const destinatarios = fuente === 'guia_asignado' ? guiaAsignado
    : fuente === 'staff_colegio' ? staffColegio
    : fuente === 'superadmin' ? superadmins
    : []

  return { destinatarios, fuente, guiaId: asig?.guia_id || null }
}
