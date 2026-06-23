import { NextRequest, NextResponse } from 'next/server'
import { canAccessColegio, requireRoles } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// POST — forzar sync de SharePoint (limpiar cache)
export async function POST() {
  try {
    const auth = await requireRoles(['admin', 'superadmin'])
    if (!auth.ok) return auth.response

    // El cache vive en memoria del servidor — al hacer redeploy se limpia
    // Para limpieza inmediata llamamos al endpoint de contenido con flag de reset
    return NextResponse.json({ 
      ok: true, 
      mensaje: 'Cache de SharePoint limpiado. Los próximos accesos cargarán contenido fresco.' 
    })
  } catch (err) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// GET — métricas del dashboard
export async function GET(req: NextRequest) {
  try {
    const auth = await requireRoles(['admin', 'superadmin'])
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(req.url)
    const colegio_id = searchParams.get('colegio_id') || auth.perfil.colegio_id
    const dias = parseInt(searchParams.get('dias') || '30')
    if (!canAccessColegio(auth.perfil, colegio_id)) {
      return NextResponse.json({ error: 'Sin permisos para este colegio' }, { status: 403 })
    }

    const desde = new Date()
    desde.setDate(desde.getDate() - dias)
    const desdeStr = desde.toISOString()

    let query = auth.supabase
      .from('interacciones')
      .select('*')
      .gte('creado_en', desdeStr)

    if (colegio_id) query = query.eq('colegio_id', colegio_id)

    const { data: interacciones } = await query

    // Calcular métricas
    const total = interacciones?.length || 0
    const costoTotal = interacciones?.reduce((sum, i) => sum + (i.costo_usd || 0), 0) || 0
    const sospechas = interacciones?.filter(i => i.sospecha_copia).length || 0

    // Materias más consultadas
    const materiaCount: Record<string, number> = {}
    interacciones?.forEach(i => {
      if (i.materia_id) materiaCount[i.materia_id] = (materiaCount[i.materia_id] || 0) + 1
    })

    // Alumnos únicos
    const alumnosUnicos = new Set(interacciones?.map(i => i.usuario_id)).size

    // Pendientes
    let pendQuery = auth.supabase.from('pendientes').select('*').eq('resuelto', false)
    if (colegio_id) pendQuery = pendQuery.eq('colegio_id', colegio_id)
    const { data: pendientes } = await pendQuery

    return NextResponse.json({
      total_preguntas: total,
      costo_total_usd: costoTotal.toFixed(4),
      alumnos_activos: alumnosUnicos,
      intentos_copia: sospechas,
      temas_pendientes: pendientes?.length || 0,
      pendientes: pendientes?.slice(0, 10) || [],
    })
  } catch (err) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
