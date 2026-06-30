import { NextRequest, NextResponse } from 'next/server'
import { canAccessColegio, requireRoles } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/server'

const GUIDE_ROLES = ['maestro', 'admin', 'superadmin']

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRoles(['admin', 'superadmin'])
    if (!auth.ok) return auth.response

    const admin = createAdminClient()
    const { searchParams } = new URL(req.url)
    const colegioId = searchParams.get('colegio_id') || ''

    if (colegioId && !canAccessColegio(auth.perfil, colegioId)) {
      return jsonError('Sin permisos para este colegio', 403)
    }

    let guiasQuery = admin
      .from('usuarios')
      .select('id, nombre_completo, email, rol, grado, activo, ultimo_acceso, colegio_id, colegio:colegios(id, nombre)')
      .in('rol', GUIDE_ROLES)
      .eq('activo', true)
      .order('nombre_completo')

    let asignacionesQuery = admin
      .from('guia_asignaciones')
      .select('id, guia_id, tipo, alumno_id, grado, colegio_id, activo, creado_en, guia:guia_id(nombre_completo), alumno:alumno_id(nombre_completo)')
      .eq('activo', true)
      .order('creado_en', { ascending: false })

    if (auth.perfil.rol === 'admin') {
      guiasQuery = guiasQuery.eq('colegio_id', auth.perfil.colegio_id)
      asignacionesQuery = asignacionesQuery.eq('colegio_id', auth.perfil.colegio_id)
    } else if (colegioId) {
      guiasQuery = guiasQuery.eq('colegio_id', colegioId)
      asignacionesQuery = asignacionesQuery.eq('colegio_id', colegioId)
    }

    const [{ data: guias, error: guiasError }, { data: asignaciones, error: asignacionesError }] = await Promise.all([
      guiasQuery,
      asignacionesQuery,
    ])

    if (guiasError) throw guiasError
    if (asignacionesError) throw asignacionesError

    return NextResponse.json({ guias: guias || [], asignaciones: asignaciones || [] })
  } catch (err) {
    console.error('GET /api/guia-asignaciones:', err)
    return jsonError('Error interno', 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRoles(['admin', 'superadmin'])
    if (!auth.ok) return auth.response

    const admin = createAdminClient()
    const body = await req.json()
    const guiaId = String(body.guia_id || '')
    const tipo = String(body.tipo || '')
    const grado = String(body.grado || '')
    const alumnoId = String(body.alumno_id || '')
    const colegioIdBody = String(body.colegio_id || '')

    if (!guiaId || !['grado', 'alumno'].includes(tipo)) {
      return jsonError('Guía y tipo son requeridos', 400)
    }

    const { data: guia } = await admin
      .from('usuarios')
      .select('id, rol, colegio_id, activo')
      .eq('id', guiaId)
      .single()

    if (!guia || !GUIDE_ROLES.includes(guia.rol) || guia.activo === false) {
      return jsonError('El guía seleccionado no es válido', 400)
    }
    if (!canAccessColegio(auth.perfil, guia.colegio_id)) {
      return jsonError('Sin permisos para asignar este guía', 403)
    }

    let colegioIdFinal = colegioIdBody || guia.colegio_id
    let alumnoIdFinal: string | null = null
    let gradoFinal: string | null = null

    if (tipo === 'alumno') {
      if (!alumnoId) return jsonError('Selecciona un alumno', 400)
      const { data: alumno } = await admin
        .from('usuarios')
        .select('id, rol, colegio_id, activo')
        .eq('id', alumnoId)
        .single()

      if (!alumno || alumno.rol !== 'alumno' || alumno.activo === false) {
        return jsonError('El alumno seleccionado no es válido', 400)
      }
      if (!canAccessColegio(auth.perfil, alumno.colegio_id)) {
        return jsonError('Sin permisos para este alumno', 403)
      }
      colegioIdFinal = alumno.colegio_id
      alumnoIdFinal = alumno.id
    } else {
      if (!grado || !colegioIdFinal) return jsonError('Selecciona colegio y grado', 400)
      if (!canAccessColegio(auth.perfil, colegioIdFinal)) {
        return jsonError('Sin permisos para este colegio', 403)
      }
      gradoFinal = grado
    }

    if (guia.rol !== 'superadmin' && colegioIdFinal !== guia.colegio_id) {
      return jsonError('El guía solo puede asignarse dentro de su colegio', 400)
    }

    let duplicadaQuery = admin
      .from('guia_asignaciones')
      .select('id')
      .eq('guia_id', guiaId)
      .eq('tipo', tipo)
      .eq('colegio_id', colegioIdFinal)
      .eq('activo', true)
      .limit(1)

    duplicadaQuery = tipo === 'alumno'
      ? duplicadaQuery.eq('alumno_id', alumnoIdFinal || '')
      : duplicadaQuery.eq('grado', gradoFinal || '')

    const { data: duplicada } = await duplicadaQuery.maybeSingle()
    if (duplicada) return NextResponse.json({ ok: true, duplicada: true })

    const { error } = await admin.from('guia_asignaciones').insert({
      guia_id: guiaId,
      colegio_id: colegioIdFinal,
      tipo,
      grado: gradoFinal,
      alumno_id: alumnoIdFinal,
      activo: true,
    })

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('POST /api/guia-asignaciones:', err)
    return jsonError('Error interno', 500)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireRoles(['admin', 'superadmin'])
    if (!auth.ok) return auth.response

    const admin = createAdminClient()
    const { id, activo = false } = await req.json()
    if (!id) return jsonError('ID requerido', 400)

    const { data: asignacion } = await admin
      .from('guia_asignaciones')
      .select('id, colegio_id')
      .eq('id', id)
      .single()

    if (!asignacion) return jsonError('Asignación no encontrada', 404)
    if (!canAccessColegio(auth.perfil, asignacion.colegio_id)) {
      return jsonError('Sin permisos para esta asignación', 403)
    }

    const { error } = await admin
      .from('guia_asignaciones')
      .update({ activo: !!activo })
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('PATCH /api/guia-asignaciones:', err)
    return jsonError('Error interno', 500)
  }
}
