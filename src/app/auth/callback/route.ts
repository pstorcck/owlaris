import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Hallazgo real (funcionalidad solicitada, 2026-07-13): "recuperar
// contraseña" no existía en absoluto — el login de padres ni siquiera tenía
// un enlace, solo el texto "contacta al administrador del colegio". Este
// endpoint recibe el enlace que Supabase envía por correo tras
// auth.resetPasswordForEmail (?code=...), intercambia el código por una
// sesión real (esto es lo que autentica al usuario para poder cambiar su
// propia contraseña) y lo redirige a /reset-password para completarlo.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') || '/reset-password'

  if (code) {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=enlace_invalido`)
}
