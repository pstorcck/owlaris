import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

const DOMINIOS_PERMITIDOS: Record<string, { colegio_slug: string; nombre: string }> = {
  'colegiomontano.edu.gt': { colegio_slug: 'colegio-montano', nombre: 'Colegio Montano' },
  'escolaris.edu.gt':      { colegio_slug: 'escolaris',       nombre: 'Colegio Escolaris' },
}

function generarPassword(): string {
  const chars     = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const especiales = '@#$!'
  let pw = ''
  for (let i = 0; i < 8; i++) pw += chars[Math.floor(Math.random() * chars.length)]
  pw += especiales[Math.floor(Math.random() * especiales.length)]
  pw += Math.floor(Math.random() * 9)
  return pw
}

async function enviarEmailBienvenida(
  email: string,
  nombre: string,
  password: string,
  colegio: string
): Promise<boolean> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    'Owlaris <noreply@owlaris.app>',
        to:      [email],
        subject: 'Bienvenido a Owlaris — Tu tutor académico',
        html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">

  <div style="background-color: #1A1A2E; padding: 30px; border-radius: 16px; text-align: center; margin-bottom: 24px;">
    <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🦉 Owlaris</h1>
    <p style="color: #9CA3AF; margin: 8px 0 0 0;">Tu tutor académico inteligente</p>
  </div>

  <h2 style="color: #1A1A2E;">Hola, ${nombre}</h2>

  <p style="color: #333333;">Tu cuenta en <strong>${colegio}</strong> ha sido creada exitosamente.</p>

  <p style="color: #333333;">Estos son tus datos de acceso:</p>

  <div style="background-color: #F3F0FF; border-left: 4px solid #6C3FC5; padding: 16px; border-radius: 8px; margin: 24px 0;">
    <p style="margin: 0 0 8px 0; color: #333;"><strong>URL:</strong> <a href="https://owlaris.app" style="color: #6C3FC5;">owlaris.app</a></p>
    <p style="margin: 0 0 8px 0; color: #333;"><strong>Email:</strong> ${email}</p>
    <p style="margin: 0; color: #333;"><strong>Contraseña temporal:</strong> <code style="background: #E9E3FF; padding: 2px 8px; border-radius: 4px;">${password}</code></p>
  </div>

  <div style="text-align: center; margin: 32px 0;">
    <a href="https://owlaris.app/login"
       style="background-color: #6C3FC5; color: white; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 16px;">
      Entrar a Owlaris
    </a>
  </div>

  <p style="color: #6B7280; font-size: 13px;">Te recomendamos cambiar tu contraseña después de tu primer ingreso.</p>

  <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;">

  <p style="color: #9CA3AF; font-size: 12px; text-align: center;">
    Este correo fue enviado automáticamente por Owlaris · ${colegio}<br>
    Si no solicitaste esta cuenta, ignora este mensaje.
  </p>

</div>`,
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      console.error('Error Resend:', err)
      return false
    }

    console.log(`✅ Email enviado a ${email}`)
    return true
  } catch (err) {
    console.error('Error enviando email:', err)
    return false
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = createAdminClient()
    const { nombre_completo, email, grado, rol } = await req.json()

    if (!nombre_completo?.trim() || !email?.trim()) {
      return NextResponse.json({ error: 'Nombre y email son requeridos' }, { status: 400 })
    }

    const dominio    = email.split('@')[1]?.toLowerCase()
    const colegioInfo = DOMINIOS_PERMITIDOS[dominio]

    if (!colegioInfo) {
      return NextResponse.json({
        error: `El dominio @${dominio} no está autorizado. Solo se permiten correos @colegiomontano.edu.gt y @escolaris.edu.gt`
      }, { status: 403 })
    }

    const { data: colegio } = await admin
      .from('colegios')
      .select('id, nombre')
      .eq('slug', colegioInfo.colegio_slug)
      .single()

    if (!colegio) {
      return NextResponse.json({ error: 'Colegio no encontrado' }, { status: 404 })
    }

    const passwordTemporal = generarPassword()

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email:         email.toLowerCase(),
      password:      passwordTemporal,
      email_confirm: true,
    })

    if (authError) {
      if (authError.message.includes('already registered')) {
        return NextResponse.json({ error: 'Este correo ya está registrado' }, { status: 409 })
      }
      throw authError
    }

    const { error: perfilError } = await admin.from('usuarios').insert({
      id:             authData.user.id,
      colegio_id:     colegio.id,
      nombre_completo: nombre_completo.trim(),
      email:          email.toLowerCase(),
      rol:            rol || 'alumno',
      grado:          grado || null,
      activo:         true,
    })

    if (perfilError) throw perfilError

    await enviarEmailBienvenida(email, nombre_completo, passwordTemporal, colegio.nombre)

    return NextResponse.json({
      ok: true,
      mensaje: `Cuenta creada. Te enviamos tu contraseña temporal a ${email}.`,
    })

  } catch (err: unknown) {
    console.error('Error en /api/signup:', err)
    const msg = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
