import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

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
    const supabase = createClient()
    const admin = createAdminClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { nombre_completo, email, password, rol, grado, colegio_id } = await req.json()

    // Crear en Supabase Auth
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) throw authError

    // Crear perfil en tabla usuarios
    const { error: perfilError } = await admin.from('usuarios').insert({
      id: authData.user.id,
      colegio_id,
      nombre_completo,
      email,
      rol,
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
    const admin = createAdminClient()
    const { id, nombre_completo, rol, grado, activo, nueva_password } = await req.json()

    if (nueva_password) {
      await admin.auth.admin.updateUserById(id, { password: nueva_password })
    }

    const { error } = await admin.from('usuarios').update({
      nombre_completo,
      rol,
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
