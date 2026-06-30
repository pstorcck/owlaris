import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { canStaffAccessStudent } from '@/lib/guideAccess'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const admin = createAdminClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const alumnoId = searchParams.get('id')
    if (!alumnoId) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

    const { data: perfil } = await supabase
      .from('usuarios').select('rol, colegio_id, email').eq('id', user.id).single()
    if (!perfil) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })

    const { data: alumno } = await admin
      .from('usuarios').select('*, colegio:colegios(nombre)').eq('id', alumnoId).single()
    if (!alumno) return NextResponse.json({ error: 'Alumno no encontrado' }, { status: 404 })

    const puedeVer = await canStaffAccessStudent(admin, perfil, user.id, alumnoId)

    if (!puedeVer) return NextResponse.json({ error: 'Sin permisos para este alumno' }, { status: 403 })

    const { data: interacciones } = await admin
      .from('interacciones').select('*')
      .eq('usuario_id', alumnoId)
      .order('creado_en', { ascending: false })
      .limit(50)

    const temasSet = new Set((interacciones||[]).map((i:any) => i.tema_detectado).filter(Boolean))
    const temas = Array.from(temasSet)
    const totalSesiones = interacciones?.length || 0
    const ultimaActividad = interacciones?.[0]?.creado_en || null

    return NextResponse.json({ alumno, totalSesiones, temas, ultimaActividad, interacciones })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
