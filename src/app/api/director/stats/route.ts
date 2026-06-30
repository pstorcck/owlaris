import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { detectarSedePorEmail } from '@/lib/sedes'

export const dynamic = 'force-dynamic'

type StudentRow = {
  id: string
  nombre_completo: string
  email: string
  grado: string | null
  activo: boolean
  ultimo_acceso: string | null
}

type InteractionRow = {
  usuario_id: string
  grado: string | null
  tema_detectado: string | null
  tokens_usados: number | null
  costo_usd: number | null
  creado_en: string
  sospecha_copia: boolean | null
  documento_fuente: string | null
}

type AlertRow = {
  id: string
  alumno_id: string
  tipo: string
  descripcion: string | null
  contexto: string | null
  creado_en: string
  alumno?: { nombre_completo?: string; grado?: string | null; email?: string | null } | null
}

function startOfTodayIso() {
  return new Date(new Date().toISOString().split('T')[0] + 'T00:00:00').toISOString()
}

function dateKey(iso: string) {
  return iso.split('T')[0]
}

function daysSince(iso: string | null) {
  if (!iso) return 999
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

function countBy<T extends string>(items: T[]) {
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item || 'Sin dato'] = (acc[item || 'Sin dato'] || 0) + 1
    return acc
  }, {})
}

export async function GET() {
  try {
    const supabase = createClient()
    const admin = createAdminClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: perfil } = await supabase
      .from('usuarios')
      .select('id, colegio_id, nombre_completo, email, rol, colegio:colegios(nombre)')
      .eq('id', user.id)
      .single()

    if (!perfil || !['director', 'admin', 'superadmin'].includes(perfil.rol)) {
      return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
    }
    if (!perfil.colegio_id) {
      return NextResponse.json({ error: 'Director sin colegio asignado' }, { status: 400 })
    }

    const sedeDirector = detectarSedePorEmail(perfil.email)
    const filtrarPorSede = perfil.rol === 'director'

    const { data: alumnosRaw } = await admin
      .from('usuarios')
      .select('id, nombre_completo, email, grado, activo, ultimo_acceso')
      .eq('colegio_id', perfil.colegio_id)
      .eq('rol', 'alumno')
      .order('nombre_completo')

    const alumnos = ((alumnosRaw || []) as StudentRow[])
      .filter((alumno) => !filtrarPorSede || detectarSedePorEmail(alumno.email) === sedeDirector)
    const alumnoIds = alumnos.map((alumno) => alumno.id)

    const hoy = new Date()
    const hace7dias = new Date(hoy.getTime() - 7 * 86400000).toISOString()
    const hace14dias = new Date(hoy.getTime() - 14 * 86400000).toISOString()
    const hace30dias = new Date(hoy.getTime() - 30 * 86400000).toISOString()
    const inicioHoy = startOfTodayIso()
    const emptyId = '00000000-0000-0000-0000-000000000000'
    const idsFiltro = alumnoIds.length > 0 ? alumnoIds : [emptyId]

    const [{ data: interaccionesRaw }, { data: alertasRaw }] = await Promise.all([
      admin
        .from('interacciones')
        .select('usuario_id, grado, tema_detectado, tokens_usados, costo_usd, creado_en, sospecha_copia, documento_fuente')
        .eq('colegio_id', perfil.colegio_id)
        .in('usuario_id', idsFiltro)
        .gte('creado_en', hace30dias),
      admin
        .from('alertas')
        .select('id, alumno_id, tipo, descripcion, contexto, creado_en, alumno:alumno_id(nombre_completo, grado, email)')
        .eq('colegio_id', perfil.colegio_id)
        .in('alumno_id', idsFiltro)
        .eq('resuelta', false)
        .order('creado_en', { ascending: false })
        .limit(50),
    ])

    const interacciones = (interaccionesRaw || []) as InteractionRow[]
    const alertas = (alertasRaw || []) as AlertRow[]

    const activosHoy = new Set(interacciones.filter((i) => i.creado_en >= inicioHoy).map((i) => i.usuario_id)).size
    const activosSemana = new Set(interacciones.filter((i) => i.creado_en >= hace7dias).map((i) => i.usuario_id)).size
    const interaccionesSemana = interacciones.filter((i) => i.creado_en >= hace7dias).length
    const sospechasCopia = interacciones.filter((i) => i.sospecha_copia).length

    const actividadPorDia: Record<string, number> = {}
    for (let i = 13; i >= 0; i--) {
      const d = new Date(hoy.getTime() - i * 86400000)
      actividadPorDia[d.toISOString().split('T')[0]] = 0
    }
    interacciones.filter((i) => i.creado_en >= hace14dias).forEach((i) => {
      const key = dateKey(i.creado_en)
      if (actividadPorDia[key] !== undefined) actividadPorDia[key]++
    })

    const interaccionesPorAlumno: Record<string, InteractionRow[]> = {}
    interacciones.forEach((i) => {
      if (!interaccionesPorAlumno[i.usuario_id]) interaccionesPorAlumno[i.usuario_id] = []
      interaccionesPorAlumno[i.usuario_id].push(i)
    })

    const alertasPorAlumno = alertas.reduce<Record<string, number>>((acc, alerta) => {
      acc[alerta.alumno_id] = (acc[alerta.alumno_id] || 0) + 1
      return acc
    }, {})

    const alumnosConStats = alumnos.map((alumno) => {
      const ints = interaccionesPorAlumno[alumno.id] || []
      const ultimaSesion = ints.reduce<string | null>((ultima, item) => {
        if (!ultima || item.creado_en > ultima) return item.creado_en
        return ultima
      }, null)
      const diasInactivo = daysSince(ultimaSesion || alumno.ultimo_acceso)
      const temas = new Set(ints.map((i) => i.tema_detectado).filter(Boolean))
      return {
        id: alumno.id,
        nombre_completo: alumno.nombre_completo,
        email: alumno.email,
        sede: detectarSedePorEmail(alumno.email),
        grado: alumno.grado,
        activo: alumno.activo,
        sesiones30: ints.length,
        temasUnicos: temas.size,
        ultimaSesion,
        diasInactivo,
        alertasActivas: alertasPorAlumno[alumno.id] || 0,
        sospechasCopia: ints.filter((i) => i.sospecha_copia).length,
      }
    })

    const alumnosAtencion = alumnosConStats
      .filter((alumno) => alumno.alertasActivas > 0 || alumno.sospechasCopia > 0 || alumno.sesiones30 === 0 || alumno.diasInactivo >= 7)
      .sort((a, b) =>
        b.alertasActivas - a.alertasActivas ||
        b.sospechasCopia - a.sospechasCopia ||
        b.diasInactivo - a.diasInactivo ||
        a.sesiones30 - b.sesiones30
      )
      .slice(0, 12)

    const temasCount = countBy(interacciones.map((i) => (i.tema_detectado || 'General').substring(0, 60)))
    const topTemas = Object.entries(temasCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tema, count]) => ({ tema, count }))

    const materiasCount = countBy(interacciones.map((i) =>
      i.documento_fuente ? i.documento_fuente.replace('.docx', '').replace(/-/g, ' ').substring(0, 45) : 'General'
    ))
    const topMaterias = Object.entries(materiasCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([materia, count]) => ({ materia, count }))

    const grados = Object.entries(countBy(alumnos.map((alumno) => alumno.grado || 'Sin grado')))
      .sort((a, b) => b[1] - a[1])
      .map(([grado, count]) => ({ grado, count }))

    const alertasPorTipo = Object.entries(countBy(alertas.map((alerta) => alerta.tipo)))
      .sort((a, b) => b[1] - a[1])
      .map(([tipo, count]) => ({ tipo, count }))

    return NextResponse.json({
      perfil: {
        nombre: perfil.nombre_completo,
        colegio: (perfil.colegio as { nombre?: string } | null)?.nombre || '',
        sede: filtrarPorSede ? sedeDirector : 'Todas las sedes',
      },
      resumen: {
        totalAlumnos: alumnos.length,
        activosHoy,
        activosSemana,
        interaccionesSemana,
        interacciones30: interacciones.length,
        alertasActivas: alertas.length,
        sospechasCopia,
        sinActividad: alumnosConStats.filter((alumno) => alumno.sesiones30 === 0).length,
        tasaUsoSemana: alumnos.length > 0 ? Math.round((activosSemana / alumnos.length) * 100) : 0,
      },
      actividad: Object.entries(actividadPorDia).map(([fecha, count]) => ({ fecha, count })),
      grados,
      topTemas,
      topMaterias,
      alertasPorTipo,
      alumnosAtencion,
      alumnos: alumnosConStats,
      alertas: alertas.map((alerta) => ({
        id: alerta.id,
        tipo: alerta.tipo,
        descripcion: alerta.descripcion,
        contexto: alerta.contexto,
        creado_en: alerta.creado_en,
        alumno: {
          nombre_completo: alerta.alumno?.nombre_completo || 'Alumno',
          grado: alerta.alumno?.grado || null,
          email: alerta.alumno?.email || '',
          sede: detectarSedePorEmail(alerta.alumno?.email || ''),
        },
      })),
    })
  } catch (err) {
    console.error('Director stats error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
