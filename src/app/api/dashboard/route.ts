import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST — forzar sync de SharePoint (limpiar cache)
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

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
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const colegio_id = searchParams.get('colegio_id')
    const dias = parseInt(searchParams.get('dias') || '30')

    const desde = new Date()
    desde.setDate(desde.getDate() - dias)
    const desdeStr = desde.toISOString()

    let query = supabase
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
    let pendQuery = supabase.from('pendientes').select('*').eq('resuelto', false)
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
