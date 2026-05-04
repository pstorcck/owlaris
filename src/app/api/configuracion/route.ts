import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const colegio_id = searchParams.get('colegio_id')

    const { data } = await supabase
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
    const admin = createAdminClient()
    const { colegio_id, clave, valor } = await req.json()

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
