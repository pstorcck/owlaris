import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Hallazgo real (funcionalidad solicitada, 2026-07-13): "recuperar
// contraseña" no existía en absoluto — el login de padres ni siquiera tenía
// un enlace, solo el texto "contacta al administrador del colegio". Este
// endpoint recibe el enlace del correo de recuperación, autentica al usuario
// (esto es lo que le permite cambiar su propia contraseña) y lo redirige a
// /reset-password para completarlo.
//
// Hallazgo real (reporte en vivo, 2026-07-30): el correo nunca llegaba
// porque el envío dependía del SMTP integrado de Supabase. Ahora
// /api/recuperar-password genera el enlace con la API admin y lo manda por
// Resend, apuntando aquí con ?token_hash=&type=recovery. Se soportan los dos
// formatos: el nuevo (token_hash + verifyOtp) y el anterior (?code=), para
// que cualquier correo ya enviado con el flujo viejo siga funcionando.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const tipo = searchParams.get('type')
  const next = searchParams.get('next') || '/reset-password'

  const supabase = createClient()

  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: tipo === 'recovery' ? 'recovery' : 'email',
    })
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
    console.error('auth/callback verifyOtp:', error.message)
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
    console.error('auth/callback exchangeCodeForSession:', error.message)
  }

  return NextResponse.redirect(`${origin}/login?error=enlace_invalido`)
}
