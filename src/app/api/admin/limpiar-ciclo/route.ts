import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { canAccessColegio, requireRoles } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRoles(['admin', 'superadmin'])
    if (!auth.ok) return auth.response

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { colegio_id } = await req.json()
    if (!colegio_id) return NextResponse.json({ error: 'colegio_id requerido' }, { status: 400 })
    if (!canAccessColegio(auth.perfil, colegio_id)) {
      return NextResponse.json({ error: 'Sin permisos para este colegio' }, { status: 403 })
    }

    // 1. Obtener todos los alumnos del colegio
    const { data: alumnos } = await admin
      .from('usuarios')
      .select('id')
      .eq('colegio_id', colegio_id)
      .eq('rol', 'alumno')

    if (!alumnos || alumnos.length === 0) {
      return NextResponse.json({ ok: true, eliminados: 0 })
    }

    const ids = alumnos.map(a => a.id)

    // 2. Borrar interacciones
    await admin.from('interacciones').delete().in('usuario_id', ids)

    // 3. Borrar pendientes del colegio
    await admin.from('pendientes').delete().eq('colegio_id', colegio_id)

    // 4. Borrar métricas del colegio
    await admin.from('metricas_diarias').delete().eq('colegio_id', colegio_id)

    // 5. Borrar perfiles
    await admin.from('usuarios').delete().in('id', ids)

    // 6. Borrar de Supabase Auth
    for (const id of ids) {
      await admin.auth.admin.deleteUser(id)
    }

    return NextResponse.json({ ok: true, eliminados: ids.length })

  } catch (err: unknown) {
    console.error('Error limpiar ciclo:', err)
    const msg = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
