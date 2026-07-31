import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verificarLimiteFrecuencia } from '@/lib/rateLimit'

// Hallazgo real (reporte en vivo, 2026-07-30): "el mail de recuperación no
// llega, la función no sirve". Dos causas distintas, ambas reales:
//
// 1. supabase.auth.resetPasswordForEmail() delega el envío al SMTP
//    INTEGRADO de Supabase, que sin SMTP propio configurado está limitado a
//    un puñado de correos por hora para todo el proyecto y en varias
//    configuraciones solo entrega a miembros del equipo. Mientras tanto,
//    esta app ya envía correos de forma confiable por Resend (alta de
//    usuario en /api/signup, alertas de seguridad en /api/preguntar). Se
//    genera el enlace con la API admin y se envía por Resend, el canal que
//    sí funciona.
// 2. El `error` que devolvía resetPasswordForEmail se descartaba por
//    completo en ambas pantallas de login, así que la UI mostraba "revisa
//    tu correo" aunque Supabase hubiera rechazado el envío — por eso el
//    fallo era invisible.
//
// Nota de seguridad: la respuesta es siempre la misma exista o no el correo
// (no se filtra qué cuentas están registradas). Los fallos reales se
// registran en el log del servidor, no se exponen al cliente.

export async function POST(req: NextRequest) {
  try {
    const { email, origin: origenBody } = await req.json()
    const correo = String(email || '').toLowerCase().trim()

    if (!correo || !correo.includes('@')) {
      return NextResponse.json({ error: 'Correo inválido' }, { status: 400 })
    }

    // Freno de abuso: 3 intentos por correo cada 15 minutos. Sin esto, este
    // endpoint permite disparar correos ilimitados a cualquier dirección.
    const limite = verificarLimiteFrecuencia(`recuperar:${correo}`, 3, 15 * 60 * 1000)
    if (!limite.permitido) {
      return NextResponse.json({ ok: true, enviado: false })
    }

    const admin = createAdminClient()
    const origen = String(origenBody || '').startsWith('http')
      ? String(origenBody).replace(/\/+$/, '')
      : 'https://owlaris.app'

    const { data, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: correo,
    })

    // Correo no registrado: se responde igual que en el caso exitoso para no
    // revelar qué cuentas existen.
    if (error || !data?.properties?.hashed_token) {
      if (error) console.error('generateLink recovery:', error.message)
      return NextResponse.json({ ok: true })
    }

    // Se arma el enlace contra NUESTRO callback en vez de usar
    // properties.action_link: así el flujo no depende de la configuración de
    // "Redirect URLs" del proyecto ni del tipo de flow (PKCE/implícito), y
    // el callback verifica el token con verifyOtp del lado del servidor.
    const enlace = `${origen}/auth/callback?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=recovery&next=/reset-password`

    if (!process.env.RESEND_API_KEY) {
      console.error('recuperar-password: falta RESEND_API_KEY, no se puede enviar el correo')
      return NextResponse.json({ ok: true })
    }

    const resEmail = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Owlaris <noreply@owlaris.app>',
        to: [correo],
        subject: 'Restablece tu contraseña de Owlaris',
        html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #1A1A2E; padding: 30px; border-radius: 16px; text-align: center; margin-bottom: 24px;">
    <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Owlaris</h1>
    <p style="color: #9CA3AF; margin: 8px 0 0 0;">Tu tutor académico inteligente</p>
  </div>
  <h2 style="color: #1A1A2E;">Restablece tu contraseña</h2>
  <p style="color: #333333;">Recibimos una solicitud para cambiar la contraseña de <strong>${correo}</strong>. Haz clic en el botón para crear una nueva.</p>
  <div style="text-align: center; margin: 32px 0;">
    <a href="${enlace}" style="background-color: #6C3FC5; color: white; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: bold;">
      Crear nueva contraseña
    </a>
  </div>
  <p style="color: #6B7280; font-size: 13px;">Este enlace es de un solo uso y vence en una hora. Si no pediste este cambio, puedes ignorar este correo: tu contraseña actual sigue funcionando.</p>
  <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin-top: 32px;">
    Owlaris · owlaris.app
  </p>
</div>`,
      }),
    })

    if (!resEmail.ok) {
      // Se registra el motivo real (dominio no verificado, clave inválida,
      // cuota agotada) para poder diagnosticarlo sin exponerlo al cliente.
      console.error('recuperar-password Resend:', resEmail.status, await resEmail.text())
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error POST /api/recuperar-password:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
