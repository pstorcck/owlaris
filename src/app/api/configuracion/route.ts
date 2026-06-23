import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { canAccessColegio, requireRoles } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRoles(['admin', 'superadmin'])
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(req.url)
    const colegio_id = searchParams.get('colegio_id')
    if (!canAccessColegio(auth.perfil, colegio_id)) {
      return NextResponse.json({ error: 'Sin permisos para este colegio' }, { status: 403 })
    }

    const { data } = await auth.supabase
      .from('configuracion')
      .select('*')
      .eq('colegio_id', colegio_id)

    const config: Record<string, string> = {}
    data?.forEach(c => { config[c.clave] = c.valor })
    return NextResponse.json({ config })
  } catch (err) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRoles(['admin', 'superadmin'])
    if (!auth.ok) return auth.response

    const admin = createAdminClient()
    const { colegio_id, clave, valor } = await req.json()
    if (!colegio_id || !clave) {
      return NextResponse.json({ error: 'colegio_id y clave son requeridos' }, { status: 400 })
    }
    if (!canAccessColegio(auth.perfil, colegio_id)) {
      return NextResponse.json({ error: 'Sin permisos para este colegio' }, { status: 403 })
    }

    const { error } = await admin
      .from('configuracion')
      .upsert({ colegio_id, clave, valor, actualizado_en: new Date().toISOString() },
        { onConflict: 'colegio_id,clave' })

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
