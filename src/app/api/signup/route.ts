import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { canAccessColegio } from '@/lib/auth'

const DOMINIOS_PERMITIDOS: Record<string, { colegio_slug: string; nombre: string }> = {
  'colegiomontano.edu.gt': { colegio_slug: 'colegio-montano', nombre: 'Colegio Montano' },
  'escolaris.edu.gt':      { colegio_slug: 'escolaris',       nombre: 'Colegio Escolaris' },
}

const ROLES_ADMIN_PERMITIDOS = ['alumno', 'maestro', 'padre', 'admin', 'superadmin']

function generarPassword(): string {
  const chars      = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const especiales = '@#$!'
  let pw = ''
  for (let i = 0; i < 8; i++) pw += chars[Math.floor(Math.random() * chars.length)]
  pw += especiales[Math.floor(Math.random() * especiales.length)]
  pw += Math.floor(Math.random() * 9)
  return pw
}

export async function POST(req: NextRequest) {
  try {
    // Usar cliente admin directo sin cookies
    const admin = createSupabaseAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const supabase = createServerClient()

    const body = await req.json()
    const { nombre_completo, email, grado, rol, colegio_id } = body

    console.log('Signup request:', { nombre_completo, email, grado })

    if (!nombre_completo?.trim() || !email?.trim()) {
      return NextResponse.json({ error: 'Nombre y email son requeridos' }, { status: 400 })
    }

    const dominio     = email.split('@')[1]?.toLowerCase()
    const colegioInfo = DOMINIOS_PERMITIDOS[dominio]

    const { data: { user } } = await supabase.auth.getUser()
    const { data: perfilAdmin } = user
      ? await supabase.from('usuarios').select('rol, colegio_id').eq('id', user.id).single()
      : { data: null }
    const esAdmin = !!perfilAdmin && ['admin', 'superadmin'].includes(perfilAdmin.rol)

    let rolFinal = 'alumno'
    let colegio = null as null | { id: string; nombre: string }

    if (esAdmin) {
      rolFinal = ROLES_ADMIN_PERMITIDOS.includes(rol) ? rol : 'alumno'
      if (perfilAdmin.rol !== 'superadmin' && rolFinal === 'superadmin') {
        return NextResponse.json({ error: 'Solo superadmin puede crear superadmin' }, { status: 403 })
      }

      const colegioObjetivo = colegio_id || perfilAdmin.colegio_id
      if (!canAccessColegio(perfilAdmin, colegioObjetivo)) {
        return NextResponse.json({ error: 'Sin permisos para este colegio' }, { status: 403 })
      }

      const { data } = await admin
        .from('colegios')
        .select('id, nombre')
        .eq('id', colegioObjetivo)
        .single()
      colegio = data
    } else if (!colegioInfo) {
      return NextResponse.json({
        error: `El dominio @${dominio} no está autorizado. Solo se permiten correos @colegiomontano.edu.gt y @escolaris.edu.gt`
      }, { status: 403 })
    } else {
      const { data } = await admin
        .from('colegios')
        .select('id, nombre')
        .eq('slug', colegioInfo.colegio_slug)
        .single()
      colegio = data
    }

    if (!colegio) {
      return NextResponse.json({ error: 'Colegio no encontrado' }, { status: 404 })
    }

    const passwordTemporal = generarPassword()
    console.log('Creando usuario:', email)

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email:         email.toLowerCase().trim(),
      password:      passwordTemporal,
      email_confirm: true,
    })

    if (authError) {
      console.error('Auth error:', authError)
      if (authError.message.includes('already registered') || authError.message.includes('already been registered')) {
        return NextResponse.json({ error: 'Este correo ya está registrado' }, { status: 409 })
      }
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    console.log('Usuario creado en Auth:', authData.user.id)

    const { error: perfilError } = await admin.from('usuarios').insert({
      id:              authData.user.id,
      colegio_id:      colegio.id,
      nombre_completo: nombre_completo.trim(),
      email:           email.toLowerCase().trim(),
      rol:             rolFinal,
      grado:           grado || null,
      activo:          true,
    })

    if (perfilError) {
      console.error('Perfil error:', perfilError)
      return NextResponse.json({ error: perfilError.message }, { status: 500 })
    }

    console.log('Perfil creado, enviando email...')

    // Enviar email con Resend
    try {
      const resEmail = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from:    'Owlaris <noreply@owlaris.app>',
          to:      [email.toLowerCase().trim()],
          subject: 'Bienvenido a Owlaris — Tu tutor académico',
          html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #1A1A2E; padding: 30px; border-radius: 16px; text-align: center; margin-bottom: 24px;">
    <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🦉 Owlaris</h1>
    <p style="color: #9CA3AF; margin: 8px 0 0 0;">Tu tutor académico inteligente</p>
  </div>
  <h2 style="color: #1A1A2E;">Hola, ${nombre_completo.trim()}</h2>
  <p style="color: #333333;">Tu cuenta en <strong>${colegio.nombre}</strong> ha sido creada.</p>
  <div style="background-color: #F3F0FF; border-left: 4px solid #6C3FC5; padding: 16px; border-radius: 8px; margin: 24px 0;">
    <p style="margin: 0 0 8px 0;"><strong>URL:</strong> <a href="https://owlaris.app" style="color: #6C3FC5;">owlaris.app</a></p>
    <p style="margin: 0 0 8px 0;"><strong>Email:</strong> ${email}</p>
    <p style="margin: 0;"><strong>Contraseña temporal:</strong> <code style="background: #E9E3FF; padding: 2px 8px; border-radius: 4px;">${passwordTemporal}</code></p>
  </div>
  <div style="text-align: center; margin: 32px 0;">
    <a href="https://owlaris.app/login" style="background-color: #6C3FC5; color: white; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: bold;">
      Entrar a Owlaris
    </a>
  </div>
  <p style="color: #9CA3AF; font-size: 12px; text-align: center;">
    Owlaris · ${colegio.nombre}
  </p>
</div>`,
        }),
      })
      const emailResult = await resEmail.json()
      console.log('Email result:', emailResult)
    } catch (emailErr) {
      console.error('Email error:', emailErr)
      // No falla el signup si el email falla
    }

    return NextResponse.json({
      ok: true,
      mensaje: `Cuenta creada exitosamente. Revisa tu correo ${email} para obtener tu contraseña temporal.`,
    })

  } catch (err: unknown) {
    console.error('Error general signup:', err)
    const msg = err instanceof Error ? err.message : 'Error interno del servidor'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
// Mon May 18 23:43:51 CST 2026
