import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { canAccessColegio, requireRoles } from '@/lib/auth'
import { canStaffAccessStudent, getAssignedStudentIds } from '@/lib/guideAccess'
import { mismaSedePorEmail } from '@/lib/sedes'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: perfil } = await supabase.from('usuarios').select('rol, colegio_id, email').eq('id', user.id).single()
  if (!perfil || !['maestro', 'director', 'admin', 'superadmin'].includes(perfil.rol)) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  let query = admin
    .from('alertas')
    .select('*, alumno:alumno_id(nombre_completo, email, grado), guia:guia_id(nombre_completo)')
    .eq('resuelta', false)
    .order('creado_en', { ascending: false })
    .limit(50)

  if (perfil.rol === 'superadmin') {
    // superadmin ve todas
  } else if (perfil.rol === 'admin') {
    query = query.eq('colegio_id', perfil.colegio_id)
  } else if (perfil.rol === 'director') {
    const { data: alumnosSede } = await admin
      .from('usuarios')
      .select('id, email')
      .eq('colegio_id', perfil.colegio_id)
      .eq('rol', 'alumno')
    const ids = (alumnosSede || [])
      .filter((alumno) => mismaSedePorEmail(perfil.email, alumno.email))
      .map((alumno) => alumno.id)
    if (ids.length === 0) return NextResponse.json({ alertas: [] })
    query = query.eq('colegio_id', perfil.colegio_id).in('alumno_id', ids)
  } else {
    const assignedIds = await getAssignedStudentIds(admin, user.id)
    if (assignedIds.length === 0) return NextResponse.json({ alertas: [] })
    query = query.in('alumno_id', assignedIds)
  }

  const { data: alertas } = await query

  return NextResponse.json({ alertas })
}

export async function POST(req: NextRequest) {
  const auth = await requireRoles(['maestro', 'director', 'admin', 'superadmin'])
  if (!auth.ok) return auth.response

  const admin = createAdminClient()
  const body = await req.json()
  const { alumno_id, tipo, descripcion, contexto, colegio_id } = body
  if (!alumno_id || !tipo) {
    return NextResponse.json({ error: 'alumno_id y tipo son requeridos' }, { status: 400 })
  }

  // Evitar alertas duplicadas recientes (última hora)
  const unaHoraAtras = new Date(Date.now() - 3600000).toISOString()
  const { data: existente } = await admin
    .from('alertas')
    .select('id')
    .eq('alumno_id', alumno_id)
    .eq('tipo', tipo)
    .eq('resuelta', false)
    .gte('creado_en', unaHoraAtras)
    .single()

  if (existente) return NextResponse.json({ ok: true, duplicada: true })

  // Buscar guía asignado
  const { data: alumno } = await admin
    .from('usuarios')
    .select('id, nombre_completo, grado, colegio_id')
    .eq('id', alumno_id)
    .single()

  const colegioIdFinal = colegio_id || alumno?.colegio_id || auth.perfil.colegio_id
  if (!canAccessColegio(auth.perfil, colegioIdFinal) || (alumno?.colegio_id && alumno.colegio_id !== colegioIdFinal)) {
    return NextResponse.json({ error: 'Sin permisos para este colegio' }, { status: 403 })
  }
  if (auth.perfil.rol === 'maestro' || auth.perfil.rol === 'director') {
    const puedeVerAlumno = await canStaffAccessStudent(admin, auth.perfil, auth.user.id, alumno_id)
    if (!puedeVerAlumno) return NextResponse.json({ error: 'Sin permisos para este alumno' }, { status: 403 })
  }

  let guiaId = null
  let guiaEmail = null
  let guiaNombre = null

  // Buscar por alumno específico primero, luego por grado
  const { data: asignacionAlumno } = await admin
    .from('guia_asignaciones')
    .select('guia_id, guia:guia_id(email, nombre_completo)')
    .eq('alumno_id', alumno_id)
    .eq('tipo', 'alumno')
    .eq('activo', true)
    .single()

  if (asignacionAlumno) {
    guiaId = asignacionAlumno.guia_id
    guiaEmail = (asignacionAlumno.guia as unknown as {email:string, nombre_completo:string}).email
    guiaNombre = (asignacionAlumno.guia as unknown as {email:string, nombre_completo:string}).nombre_completo
  } else if (alumno?.grado) {
    const { data: asignacionGrado } = await admin
      .from('guia_asignaciones')
      .select('guia_id, guia:guia_id(email, nombre_completo)')
      .eq('grado', alumno.grado)
      .eq('colegio_id', colegioIdFinal)
      .eq('tipo', 'grado')
      .eq('activo', true)
      .single()

    if (asignacionGrado) {
      guiaId = asignacionGrado.guia_id
      guiaEmail = (asignacionGrado.guia as unknown as {email:string, nombre_completo:string}).email
      guiaNombre = (asignacionGrado.guia as unknown as {email:string, nombre_completo:string}).nombre_completo
    }
  }

  // Crear alerta
  await admin.from('alertas').insert({
    colegio_id: colegioIdFinal, alumno_id, guia_id: guiaId, tipo, descripcion, contexto
  })

  // Enviar email si hay guía
  if (guiaEmail && process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const tipoLabel: Record<string,string> = {
      baja_comprension: '⚠️ Baja comprensión',
      bloqueo_recurrente: '🔄 Bloqueo recurrente',
      riesgo_copia: '🚨 Riesgo de copia',
      seguridad_contenido: '🚨 Seguridad del estudiante'
    }
    await resend.emails.send({
      from: 'Owlaris <noreply@owlaris.app>',
      to: guiaEmail,
      subject: `${tipoLabel[tipo] || 'Alerta'} — ${alumno?.nombre_completo}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;background:#F8F7FF;padding:32px;border-radius:16px;">
          <div style="background:#7C3AED;padding:20px 24px;border-radius:12px;margin-bottom:24px;">
            <h1 style="color:white;margin:0;font-size:20px;">🦉 Owlaris — Alerta Pedagógica</h1>
          </div>
          <p style="color:#4B5563;margin-bottom:8px;">Hola <strong>${guiaNombre}</strong>,</p>
          <p style="color:#4B5563;margin-bottom:24px;">Se ha detectado una alerta para uno de tus alumnos:</p>
          <div style="background:white;border:1px solid #E5E7EB;border-radius:12px;padding:20px;margin-bottom:24px;">
            <p style="margin:0 0 8px;"><strong>Alumno:</strong> ${alumno?.nombre_completo}</p>
            <p style="margin:0 0 8px;"><strong>Grado:</strong> ${alumno?.grado}</p>
            <p style="margin:0 0 8px;"><strong>Tipo:</strong> ${tipoLabel[tipo]}</p>
            <p style="margin:0 0 8px;"><strong>Descripción:</strong> ${descripcion}</p>
            ${contexto ? `<p style="margin:0;"><strong>Contexto:</strong> ${contexto}</p>` : ''}
          </div>
          <a href="https://owlaris.app/guia" style="background:#7C3AED;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Ver en Owlaris →</a>
          <p style="color:#9CA3AF;font-size:12px;margin-top:24px;">Owlaris · Tu tutor académico inteligente</p>
        </div>
      `
    })
  }

  return NextResponse.json({ ok: true, guia_notificado: !!guiaEmail })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireRoles(['maestro', 'director', 'admin', 'superadmin'])
  if (!auth.ok) return auth.response

  const admin = createAdminClient()
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

  const { data: alerta } = await admin.from('alertas').select('colegio_id, alumno_id').eq('id', id).single()
  if (!alerta) return NextResponse.json({ error: 'Alerta no encontrada' }, { status: 404 })
  if (!canAccessColegio(auth.perfil, alerta.colegio_id)) {
    return NextResponse.json({ error: 'Sin permisos para esta alerta' }, { status: 403 })
  }
  if (auth.perfil.rol === 'maestro' || auth.perfil.rol === 'director') {
    const puedeResolver = await canStaffAccessStudent(admin, auth.perfil, auth.user.id, alerta.alumno_id)
    if (!puedeResolver) return NextResponse.json({ error: 'Sin permisos para este alumno' }, { status: 403 })
  }

  await admin.from('alertas').update({ resuelta: true, resuelta_en: new Date().toISOString() }).eq('id', id)
  return NextResponse.json({ ok: true })
}
