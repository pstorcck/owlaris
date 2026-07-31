import { NextRequest, NextResponse } from 'next/server'
import { createEphemeralClient, createAdminClient } from '@/lib/supabase/server'
import { verificarLimiteFrecuencia } from '@/lib/rateLimit'

// Hallazgo real (logs de producción, 2026-07-31): "el correo sí llega, pero
// al hacer clic me manda al login". El enlace apuntaba a /auth/callback, que
// canjeaba el token al ABRIRSE. Los logs muestran el token quemado por un
// prefetch automático un segundo antes del clic humano:
//
//   18:28:57 HEAD /auth/callback  307   (sin error)
//   18:28:58 HEAD /reset-password 200   (canje exitoso — token consumido)
//   18:28:58 GET  /auth/callback  307   auth/callback verifyOtp:
//                                       Email link is invalid or has expired
//
// El HEAD viene de un escáner de seguridad/vista previa del correo, no del
// usuario. Como el token de recuperación es de UN SOLO USO, para cuando la
// persona hace clic ya está gastado y termina en /login?error=enlace_invalido.
//
// La solución es que ABRIR el enlace no consuma nada: el correo lleva ahora a
// /reset-password?token_hash=..., una pantalla que solo muestra el formulario.
// El token se canjea aquí, al ENVIAR la nueva contraseña — algo que un
// prefetch nunca hace. Se verifica con un cliente efímero (sin cookies) y el
// cambio se aplica con la API admin, así que no depende de que el navegador
// tenga sesión.

export async function POST(req: NextRequest) {
  try {
    const { token_hash: tokenHash, password } = await req.json()
    const token = String(tokenHash || '')
    const nueva = String(password || '')

    if (!token) {
      return NextResponse.json({ error: 'Falta el token del enlace.' }, { status: 400 })
    }
    if (nueva.length < 6) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 6 caracteres.' },
        { status: 400 }
      )
    }

    // Freno de fuerza bruta sobre el token: 5 intentos cada 15 minutos.
    const limite = verificarLimiteFrecuencia(`reset:${token.slice(0, 32)}`, 5, 15 * 60 * 1000)
    if (!limite.permitido) {
      return NextResponse.json(
        { error: 'Demasiados intentos. Espera unos minutos y solicita un enlace nuevo.' },
        { status: 429 }
      )
    }

    const efimero = createEphemeralClient()
    const { data, error } = await efimero.auth.verifyOtp({
      token_hash: token,
      type: 'recovery',
    })

    if (error || !data?.user) {
      if (error) console.error('reset-password verifyOtp:', error.message)
      return NextResponse.json(
        { error: 'Este enlace ya no es válido o venció. Solicita uno nuevo desde el login.' },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    const { error: errorUpdate } = await admin.auth.admin.updateUserById(data.user.id, {
      password: nueva,
    })

    if (errorUpdate) {
      console.error('reset-password updateUserById:', errorUpdate.message)
      return NextResponse.json(
        { error: 'No se pudo actualizar la contraseña. Intenta de nuevo.' },
        { status: 500 }
      )
    }

    // Se devuelve el correo para que la pantalla pueda iniciar sesión con la
    // contraseña recién creada y el usuario entre directo, sin volver a
    // escribirla en el login.
    return NextResponse.json({ ok: true, email: data.user.email })
  } catch (err) {
    console.error('Error POST /api/reset-password:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
