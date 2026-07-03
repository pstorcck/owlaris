import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { canStaffAccessStudent } from '@/lib/guideAccess'

export const dynamic = 'force-dynamic'

function temaLegible(interaccion: { tema_detectado?: string | null; pregunta?: string | null; respuesta?: string | null; operacion_canonica?: string | null }) {
  const base = `${interaccion.tema_detectado || ''} ${interaccion.pregunta || ''} ${interaccion.respuesta || ''} ${interaccion.operacion_canonica || ''}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  if (/english|pronunciation|speaking|conversacion en ingles/.test(base)) return 'Conversación y pronunciación en inglés'
  if (/ecuaci|despej|x\s*[+\-*/=]/.test(base) || String(interaccion.operacion_canonica || '').includes('=')) return 'Ecuaciones y despeje de variables'
  if (/decimal|porcentaje|percent|0\.\d+|%/.test(base)) return 'Decimales y porcentajes'
  if (/orden de operaciones|[*/].*[+\-]|[+\-].*[*/]/.test(base)) return 'Orden de operaciones'
  if (/lectura|comprension|texto|redaccion|gramatica/.test(base)) return 'Lectura y comunicación escrita'
  if (/biolog|ciencias|quimica|fisica|environmental/.test(base)) return 'Ciencias y comprensión de conceptos'
  if (/practic|repas|ejercicio/.test(base)) return 'Práctica guiada'
  return String(interaccion.tema_detectado || 'Acompañamiento académico').replace(/\s+/g, ' ').trim().slice(0, 80)
}

function calcularRutaDificultad(interacciones: Array<{ estado_evaluacion?: string | null; creado_en?: string | null }>) {
  let nivel = 1
  let aciertos = 0
  let fallos = 0
  let ajustes = 0
  const ordenadas = [...interacciones].sort((a, b) => new Date(a.creado_en || 0).getTime() - new Date(b.creado_en || 0).getTime())
  for (const int of ordenadas) {
    if (int.estado_evaluacion === 'correcto' || int.estado_evaluacion === 'equivalente') {
      aciertos += 1
      fallos = 0
      if (aciertos > 0 && aciertos % 5 === 0) {
        const previo = nivel
        nivel = Math.min(8, nivel + 1)
        if (nivel !== previo) ajustes += 1
      }
    } else if (int.estado_evaluacion === 'incorrecto') {
      fallos += 1
      aciertos = 0
      if (fallos > 0 && fallos % 4 === 0) {
        const previo = nivel
        nivel = Math.max(1, nivel - 1)
        if (nivel !== previo) ajustes += 1
      }
    }
  }
  return { nivelFinal: nivel, ajustes }
}

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
      .from('interacciones').select('*, materia:materias(nombre)')
      .eq('usuario_id', alumnoId)
      .order('creado_en', { ascending: false })
      .limit(50)

    const temasSet = new Set((interacciones||[]).map((i:any) => temaLegible(i)).filter(Boolean))
    const temas = Array.from(temasSet)
    const totalSesiones = interacciones?.length || 0
    const ultimaActividad = interacciones?.[0]?.creado_en || null
    const correctos = (interacciones || []).filter((i:any) => i.estado_evaluacion === 'correcto' || i.estado_evaluacion === 'equivalente').length
    const incorrectos = (interacciones || []).filter((i:any) => i.estado_evaluacion === 'incorrecto').length
    const evaluables = correctos + incorrectos
    const tasaAcierto = evaluables > 0 ? Math.round((correctos / evaluables) * 100) : null
    const materias = Array.from(new Set((interacciones || []).map((i:any) => i.materia?.nombre || 'Materia no clasificada')))
    const rutaDificultad = calcularRutaDificultad(interacciones || [])
    const resumenPedagogico = {
      materias,
      temas,
      correctos,
      enPractica: incorrectos,
      tasaAcierto,
      rutaDificultad,
      lectura: totalSesiones === 0
        ? 'Aún no hay actividad suficiente para emitir una lectura académica.'
        : tasaAcierto !== null && tasaAcierto < 65
          ? 'Conviene reforzar bases con pasos cortos y acompañamiento cercano.'
          : 'El estudiante muestra avance que puede consolidarse con práctica breve y constante.',
    }

    return NextResponse.json({ alumno, totalSesiones, temas, ultimaActividad, interacciones, resumenPedagogico })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
