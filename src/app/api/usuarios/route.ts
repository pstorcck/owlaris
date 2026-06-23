import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { canAccessColegio, requireRoles } from '@/lib/auth'

const ROLES_PERMITIDOS = ['alumno', 'maestro', 'padre', 'admin', 'superadmin']

// GET — listar usuarios con filtros
export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const admin = createAdminClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: perfil } = await supabase
      .from('usuarios')
      .select('rol, colegio_id')
      .eq('id', user.id)
      .single()

    if (!perfil || !['admin', 'superadmin'].includes(perfil.rol)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const buscar     = searchParams.get('buscar') || ''
    const rol        = searchParams.get('rol') || ''
    const colegio_id = searchParams.get('colegio_id') || ''
    const grado      = searchParams.get('grado') || ''

    let query = admin
      .from('usuarios')
      .select('*, colegio:colegios(nombre, slug)')
      .order('nombre_completo')

    // Superadmin ve todo, admin solo su colegio
    if (perfil.rol === 'admin') {
      query = query.eq('colegio_id', perfil.colegio_id)
    } else if (colegio_id) {
      query = query.eq('colegio_id', colegio_id)
    }

    if (rol)    query = query.eq('rol', rol)
    if (grado)  query = query.eq('grado', grado)
    if (buscar) query = query.or(`nombre_completo.ilike.%${buscar}%,email.ilike.%${buscar}%`)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ usuarios: data })
  } catch (err) {
    console.error('Error GET /api/usuarios:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST — crear usuario
export async function POST(req: NextRequest) {
  try {
    const auth = await requireRoles(['admin', 'superadmin'])
    if (!auth.ok) return auth.response

    const admin = createAdminClient()

    const { nombre_completo, email, password, rol, grado, colegio_id } = await req.json()
    const rolFinal = ROLES_PERMITIDOS.includes(rol) ? rol : 'alumno'
    if (!nombre_completo?.trim() || !email?.trim() || !password?.trim()) {
      return NextResponse.json({ error: 'Nombre, email y password son requeridos' }, { status: 400 })
    }
    if (!colegio_id || !canAccessColegio(auth.perfil, colegio_id)) {
      return NextResponse.json({ error: 'Sin permisos para este colegio' }, { status: 403 })
    }
    if (auth.perfil.rol !== 'superadmin' && rolFinal === 'superadmin') {
      return NextResponse.json({ error: 'Solo superadmin puede crear superadmin' }, { status: 403 })
    }

    // Crear en Supabase Auth
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password,
      email_confirm: true,
    })

    if (authError) throw authError

    // Crear perfil en tabla usuarios
    const { error: perfilError } = await admin.from('usuarios').insert({
      id: authData.user.id,
      colegio_id,
      nombre_completo: nombre_completo.trim(),
      email: email.toLowerCase().trim(),
      rol: rolFinal,
      grado: grado || null,
      activo: true,
    })

    if (perfilError) throw perfilError

    return NextResponse.json({ ok: true, id: authData.user.id })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// PATCH — editar usuario
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireRoles(['admin', 'superadmin'])
    if (!auth.ok) return auth.response

    const admin = createAdminClient()
    const { id, nombre_completo, rol, grado, activo, nueva_password } = await req.json()
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

    const { data: objetivo } = await admin
      .from('usuarios')
      .select('colegio_id, rol')
      .eq('id', id)
      .single()

    if (!objetivo) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    if (!canAccessColegio(auth.perfil, objetivo.colegio_id)) {
      return NextResponse.json({ error: 'Sin permisos para este usuario' }, { status: 403 })
    }

    const rolFinal = ROLES_PERMITIDOS.includes(rol) ? rol : objetivo.rol
    if (auth.perfil.rol !== 'superadmin' && (objetivo.rol === 'superadmin' || rolFinal === 'superadmin')) {
      return NextResponse.json({ error: 'Solo superadmin puede modificar superadmin' }, { status: 403 })
    }

    if (nueva_password) {
      await admin.auth.admin.updateUserById(id, { password: nueva_password })
    }

    const { error } = await admin.from('usuarios').update({
      nombre_completo,
      rol: rolFinal,
      grado: grado || null,
      activo,
    }).eq('id', id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = createClient()
    const admin = createAdminClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: perfil } = await supabase.from('usuarios').select('rol, colegio_id').eq('id', user.id).single()
    if (!perfil || !['admin', 'superadmin'].includes(perfil.rol)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

    const { data: objetivo } = await admin
      .from('usuarios')
      .select('colegio_id, rol')
      .eq('id', id)
      .single()

    if (!objetivo) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    if (!canAccessColegio(perfil, objetivo.colegio_id)) {
      return NextResponse.json({ error: 'Sin permisos para este usuario' }, { status: 403 })
    }
    if (perfil.rol !== 'superadmin' && objetivo.rol === 'superadmin') {
      return NextResponse.json({ error: 'Solo superadmin puede eliminar superadmin' }, { status: 403 })
    }

    // Eliminar de BD primero
    await admin.from('usuarios').delete().eq('id', id)
    // Eliminar de Auth
    const { error } = await admin.auth.admin.deleteUser(id)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error DELETE /api/usuarios:', err)
    return NextResponse.json({ error: 'Error al eliminar usuario' }, { status: 500 })
  }
}
