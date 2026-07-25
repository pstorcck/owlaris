import { NextRequest, NextResponse } from 'next/server'
import { canAccessColegio, requireRoles } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/server'

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

// GET — lista padres del colegio + sus vínculos activos con alumnos, para
// poblar el selector de "vincular padre con alumno" en el admin. Mismo
// patrón que /api/guia-asignaciones (guía-alumno), pero sin la variante
// "por grado" — un padre siempre se vincula a alumno(s) puntuales.
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

    let padresQuery = admin
      .from('usuarios')
      .select('id, nombre_completo, email, rol, activo, colegio_id')
      .eq('rol', 'padre')
      .eq('activo', true)
      .order('nombre_completo')

    let vinculosQuery = admin
      .from('padre_alumno')
      .select('id, padre_id, alumno_id, activo, creado_en, padre:padre_id(nombre_completo, email), alumno:alumno_id(nombre_completo, grado, email)')
      .eq('activo', true)
      .order('creado_en', { ascending: false })

    if (auth.perfil.rol === 'admin') {
      padresQuery = padresQuery.eq('colegio_id', auth.perfil.colegio_id)
    } else if (colegioId) {
      padresQuery = padresQuery.eq('colegio_id', colegioId)
    }

    const [{ data: padres, error: padresError }, { data: vinculos, error: vinculosError }] = await Promise.all([
      padresQuery,
      vinculosQuery,
    ])

    if (padresError) throw padresError
    if (vinculosError) throw vinculosError

    // Filtrar vínculos a los padres visibles en este alcance (la tabla
    // padre_alumno no tiene colegio_id propio — se deriva del padre).
    const padreIds = new Set((padres || []).map((p) => p.id))
    const vinculosFiltrados = (vinculos || []).filter((v) => padreIds.has(v.padre_id))

    return NextResponse.json({ padres: padres || [], vinculos: vinculosFiltrados })
  } catch (err) {
    console.error('GET /api/padre-asignaciones:', err)
    return jsonError('Error interno', 500)
  }
}

// POST — crea el vínculo { padre_id, alumno_id }.
export async function POST(req: NextRequest) {
  try {
    const auth = await requireRoles(['admin', 'superadmin'])
    if (!auth.ok) return auth.response

    const admin = createAdminClient()
    const body = await req.json()
    const padreId = String(body.padre_id || '')
    const alumnoId = String(body.alumno_id || '')

    if (!padreId || !alumnoId) {
      return jsonError('Padre y alumno son requeridos', 400)
    }

    const { data: padre } = await admin
      .from('usuarios')
      .select('id, rol, colegio_id, activo')
      .eq('id', padreId)
      .single()

    if (!padre || padre.rol !== 'padre' || padre.activo === false) {
      return jsonError('El padre seleccionado no es válido', 400)
    }
    if (!canAccessColegio(auth.perfil, padre.colegio_id)) {
      return jsonError('Sin permisos para asignar este padre', 403)
    }

    const { data: alumno } = await admin
      .from('usuarios')
      .select('id, rol, colegio_id, activo')
      .eq('id', alumnoId)
      .single()

    if (!alumno || alumno.rol !== 'alumno' || alumno.activo === false) {
      return jsonError('El alumno seleccionado no es válido', 400)
    }
    if (alumno.colegio_id !== padre.colegio_id) {
      return jsonError('El padre y el alumno deben pertenecer al mismo colegio', 400)
    }
    if (!canAccessColegio(auth.perfil, alumno.colegio_id)) {
      return jsonError('Sin permisos para este alumno', 403)
    }

    const { data: existente } = await admin
      .from('padre_alumno')
      .select('id, activo')
      .eq('padre_id', padreId)
      .eq('alumno_id', alumnoId)
      .maybeSingle()

    if (existente) {
      if (existente.activo) return NextResponse.json({ ok: true, duplicada: true })
      const { error: reactivarError } = await admin
        .from('padre_alumno')
        .update({ activo: true })
        .eq('id', existente.id)
      if (reactivarError) throw reactivarError
      return NextResponse.json({ ok: true })
    }

    const { error } = await admin.from('padre_alumno').insert({
      padre_id: padreId,
      alumno_id: alumnoId,
      activo: true,
    })

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('POST /api/padre-asignaciones:', err)
    return jsonError('Error interno', 500)
  }
}

// PATCH — desvincula { id, activo: false }.
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireRoles(['admin', 'superadmin'])
    if (!auth.ok) return auth.response

    const admin = createAdminClient()
    const { id, activo = false } = await req.json()
    if (!id) return jsonError('ID requerido', 400)

    const { data: vinculo } = await admin
      .from('padre_alumno')
      .select('id, padre:padre_id(colegio_id)')
      .eq('id', id)
      .single()

    if (!vinculo) return jsonError('Vínculo no encontrado', 404)
    const colegioIdVinculo = (vinculo.padre as unknown as { colegio_id?: string } | null)?.colegio_id
    if (!canAccessColegio(auth.perfil, colegioIdVinculo)) {
      return jsonError('Sin permisos para este vínculo', 403)
    }

    const { error } = await admin
      .from('padre_alumno')
      .update({ activo: !!activo })
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('PATCH /api/padre-asignaciones:', err)
    return jsonError('Error interno', 500)
  }
}
