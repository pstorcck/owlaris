import type { AuthPerfil } from '@/lib/auth'
import type { createAdminClient } from '@/lib/supabase/server'
import { mismaSedePorEmail } from '@/lib/sedes'

type AdminClient = ReturnType<typeof createAdminClient>

export type AssignedStudent = {
  id: string
  nombre_completo: string
  grado: string | null
  ultimo_acceso: string | null
  email: string
  colegio_id?: string | null
}

function normalizeStudent(raw: unknown): AssignedStudent | null {
  const student = raw as Partial<AssignedStudent & { rol: string; activo: boolean }> | null
  if (!student?.id || student.rol !== 'alumno' || student.activo === false) return null
  return {
    id: student.id,
    nombre_completo: student.nombre_completo || '',
    grado: student.grado || null,
    ultimo_acceso: student.ultimo_acceso || null,
    email: student.email || '',
    colegio_id: student.colegio_id || null,
  }
}

export async function getAssignedStudents(admin: AdminClient, guideId: string): Promise<AssignedStudent[]> {
  const { data: guide } = await admin
    .from('usuarios')
    .select('id, rol, colegio_id, activo')
    .eq('id', guideId)
    .single()

  if (!guide || guide.activo === false || !['maestro', 'admin', 'superadmin'].includes(guide.rol)) {
    return []
  }

  const restrictedColegioId = guide.rol === 'superadmin' ? null : guide.colegio_id
  let assignmentsQuery = admin
    .from('guia_asignaciones')
    .select('tipo, grado, alumno_id, colegio_id, alumno:alumno_id(id, nombre_completo, grado, ultimo_acceso, email, colegio_id, rol, activo)')
    .eq('guia_id', guideId)
    .eq('activo', true)

  if (restrictedColegioId) {
    assignmentsQuery = assignmentsQuery.eq('colegio_id', restrictedColegioId)
  }

  const { data: assignments } = await assignmentsQuery
  const students = new Map<string, AssignedStudent>()

  for (const assignment of assignments || []) {
    if (assignment.tipo === 'alumno') {
      const student = normalizeStudent(assignment.alumno)
      if (student && (!restrictedColegioId || student.colegio_id === restrictedColegioId)) {
        students.set(student.id, student)
      }
      continue
    }

    if (assignment.tipo === 'grado' && assignment.grado && assignment.colegio_id) {
      const { data: gradeStudents } = await admin
        .from('usuarios')
        .select('id, nombre_completo, grado, ultimo_acceso, email, colegio_id, rol, activo')
        .eq('colegio_id', assignment.colegio_id)
        .eq('grado', assignment.grado)
        .eq('rol', 'alumno')
        .eq('activo', true)
        .order('nombre_completo')

      for (const raw of gradeStudents || []) {
        const student = normalizeStudent(raw)
        if (student) students.set(student.id, student)
      }
    }
  }

  return Array.from(students.values()).sort((a, b) =>
    a.nombre_completo.localeCompare(b.nombre_completo, 'es')
  )
}

export async function getAssignedStudentIds(admin: AdminClient, guideId: string): Promise<string[]> {
  return (await getAssignedStudents(admin, guideId)).map((student) => student.id)
}

export async function canStaffAccessStudent(
  admin: AdminClient,
  perfil: AuthPerfil,
  viewerId: string,
  alumnoId: string
) {
  const { data: alumno } = await admin
    .from('usuarios')
    .select('id, colegio_id, rol, email')
    .eq('id', alumnoId)
    .single()

  if (!alumno || alumno.rol !== 'alumno') return false
  if (perfil.rol === 'superadmin') return true
  if (perfil.rol === 'alumno') return viewerId === alumnoId
  if (perfil.rol === 'admin') return alumno.colegio_id === perfil.colegio_id
  if (perfil.rol === 'director') {
    return alumno.colegio_id === perfil.colegio_id && mismaSedePorEmail(perfil.email, alumno.email)
  }
  if (perfil.rol !== 'maestro' || alumno.colegio_id !== perfil.colegio_id) return false

  const assignedIds = await getAssignedStudentIds(admin, viewerId)
  return assignedIds.includes(alumnoId)
}
