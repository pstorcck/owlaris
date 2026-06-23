import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: perfil } = await supabase
      .from('usuarios').select('colegio_id, rol').eq('id', user.id).single()
    if (!perfil || !['maestro','admin','superadmin'].includes(perfil.rol)) {
      return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
    }

    const colegioId = perfil.colegio_id
    const hoy = new Date()
    const hace7dias = new Date(hoy.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const hace30dias = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const inicioHoy = new Date(hoy.toISOString().split('T')[0] + 'T00:00:00').toISOString()

    // Verificar asignaciones de guía
    const { data: asignaciones } = await supabase
      .from('guia_asignaciones').select('tipo, grado, alumno_id, colegio_id')
      .eq('guia_id', user.id).eq('activo', true)

    let alumnosIdsAsignados: string[] | null = null
    if (asignaciones && asignaciones.length > 0) {
      const ids = new Set<string>()
      for (const a of asignaciones) {
        if (a.tipo === 'alumno' && a.alumno_id) {
          ids.add(a.alumno_id)
        } else if (a.tipo === 'grado' && a.grado && a.colegio_id) {
          const { data: ag } = await supabase.from('usuarios').select('id')
            .eq('colegio_id', a.colegio_id).eq('grado', a.grado).eq('rol', 'alumno').eq('activo', true)
          for (const al of ag || []) ids.add(al.id)
        }
      }
      if (ids.size > 0) alumnosIdsAsignados = Array.from(ids)
    }

    const { data: alumnos } = await supabase
      .from('usuarios')
      .select('id, nombre_completo, email, grado, activo, ultimo_acceso, colegio:colegios(nombre)')
      .eq('colegio_id', colegioId).eq('rol', 'alumno').order('nombre_completo')

    const alumnosFiltrados = alumnosIdsAsignados
      ? (alumnos || []).filter(a => alumnosIdsAsignados!.includes(a.id))
      : (alumnos || [])

    const { data: interacciones } = await supabase
      .from('interacciones')
      .select('usuario_id, grado, tema_detectado, materia_id, tokens_usados, costo_usd, creado_en, sospecha_copia, documento_fuente')
      .eq('colegio_id', colegioId).gte('creado_en', hace30dias)

    const { count: activosHoy } = await supabase
      .from('interacciones').select('usuario_id', { count: 'exact', head: true })
      .eq('colegio_id', colegioId).gte('creado_en', inicioHoy)

    const { count: activosSemana } = await supabase
      .from('interacciones').select('usuario_id', { count: 'exact', head: true })
      .eq('colegio_id', colegioId).gte('creado_en', hace7dias)

    // Top temas
    const temasCount: Record<string, number> = {}
    interacciones?.forEach(i => {
      if (i.tema_detectado) {
        const tema = i.tema_detectado.substring(0, 60)
        temasCount[tema] = (temasCount[tema] || 0) + 1
      }
    })
    const topTemas = Object.entries(temasCount).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([tema,count])=>({tema,count}))

    // Top materias desde documento_fuente
    const materiasCount: Record<string, number> = {}
    interacciones?.forEach(i => {
      if (i.documento_fuente) {
        const m = i.documento_fuente.replace('.docx','').replace(/-/g,' ').substring(0,40)
        materiasCount[m] = (materiasCount[m] || 0) + 1
      }
    })
    const topMaterias = Object.entries(materiasCount).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([materia,count])=>({materia,count}))

    // Actividad por día
    const actividadPorDia: Record<string, number> = {}
    for (let i = 6; i >= 0; i--) {
      const d = new Date(hoy.getTime() - i * 24 * 60 * 60 * 1000)
      actividadPorDia[d.toISOString().split('T')[0]] = 0
    }
    interacciones?.filter(i=>i.creado_en>=hace7dias).forEach(i=>{
      const key = i.creado_en.split('T')[0]
      if (actividadPorDia[key]!==undefined) actividadPorDia[key]++
    })
    const actividadSemana = Object.entries(actividadPorDia).map(([fecha,count])=>({fecha,count}))

    // Stats por alumno
    const statsPorAlumno: Record<string,{sesiones:number;ultimaSesion:string;temas:Set<string>;sospechas:number}> = {}
    interacciones?.forEach(i=>{
      if (!statsPorAlumno[i.usuario_id]) statsPorAlumno[i.usuario_id]={sesiones:0,ultimaSesion:'',temas:new Set(),sospechas:0}
      statsPorAlumno[i.usuario_id].sesiones++
      if (i.creado_en>statsPorAlumno[i.usuario_id].ultimaSesion) statsPorAlumno[i.usuario_id].ultimaSesion=i.creado_en
      if (i.tema_detectado) statsPorAlumno[i.usuario_id].temas.add(i.tema_detectado.substring(0,30))
      if (i.sospecha_copia) statsPorAlumno[i.usuario_id].sospechas++
    })

    const alumnosConStats = alumnosFiltrados.map((a)=>({
      id: a.id,
      nombre_completo: (a as unknown as {nombre_completo:string}).nombre_completo,
      email: (a as unknown as {email:string}).email,
      grado: (a as unknown as {grado:string|null}).grado,
      activo: (a as unknown as {activo:boolean}).activo,
      ultimo_acceso: (a as unknown as {ultimo_acceso:string|null}).ultimo_acceso,
      colegio_nombre: ((a as unknown as {colegio:{nombre:string}|null}).colegio)?.nombre || '',
      sesiones: statsPorAlumno[a.id]?.sesiones||0,
      ultimaSesion: statsPorAlumno[a.id]?.ultimaSesion||null,
      temasUnicos: statsPorAlumno[a.id]?.temas.size||0,
      sospechasCopia: statsPorAlumno[a.id]?.sospechas||0,
    }))

    // Top 5 alumnos más activos
    const topAlumnos = alumnosConStats
      .filter(a=>a.sesiones>0)
      .sort((a,b)=>b.sesiones-a.sesiones)
      .slice(0,5)
      .map(a=>({nombre:a.nombre_completo,sesiones:a.sesiones}))

    const sinActividad = alumnosConStats.filter(a=>a.sesiones===0).length
    const promedioSesiones = alumnosConStats.length>0
      ? alumnosConStats.reduce((s,a)=>s+a.sesiones,0)/alumnosConStats.length : 0

    return NextResponse.json({
      resumen: { totalAlumnos: alumnos?.length||0, activosHoy: activosHoy||0, activosSemana: activosSemana||0, totalInteracciones: interacciones?.length||0 },
      topTemas, topMaterias, actividadSemana, alumnos: alumnosConStats,
      topAlumnos, sinActividad, promedioSesiones,
    })
  } catch (err) {
    console.error('Dashboard stats error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
