'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// Hallazgo real (funcionalidad solicitada, 2026-07-13): "recuperar
// contraseña" no existía para padres ni para alumnos — el login de padres
// solo decía "contacta al administrador del colegio". Esta página completa
// el flujo: llega aquí después de que /auth/callback intercambió el código
// del enlace del correo por una sesión real, y el alumno o padre puede
// establecer su nueva contraseña directamente.
export default function ResetPasswordPage() {
  const [sesionValida, setSesionValida] = useState<boolean | null>(null)
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [listo, setListo] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setSesionValida(!!data.user))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (password !== confirmar) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      setError('No se pudo actualizar la contraseña. Intenta solicitar un nuevo enlace.')
      return
    }

    setListo(true)
    setTimeout(() => { window.location.href = '/' }, 1800)
  }

  return (
    <>
      <style suppressHydrationWarning>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
        .rp-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #FAF9FF; font-family: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif; padding: 24px; }
        .rp-card { width: 100%; max-width: 380px; background: #FFFFFF; border-radius: 24px; border: 1px solid rgba(228,225,245,.7); box-shadow: 0 24px 56px -16px rgba(25,19,51,.18); padding: 40px 34px; }
        .rp-title { margin: 0; font-size: 24px; font-weight: 900; color: #191333; }
        .rp-subtitle { margin: 8px 0 24px; font-size: 14px; font-weight: 600; color: #726F8A; }
        .rp-field { display: grid; gap: 7px; margin-bottom: 16px; }
        .rp-field label { font-size: 12px; font-weight: 800; color: #726F8A; text-transform: uppercase; letter-spacing: .04em; }
        .rp-input { width: 100%; height: 52px; border-radius: 16px; border: 2px solid #E4E1F5; background: #FFFFFF; color: #191333; outline: none; padding: 0 16px; font-size: 15px; font-weight: 600; }
        .rp-input:focus { border-color: #7C3AED; box-shadow: 0 0 0 4px rgba(124,58,237,.14); }
        .rp-error { border: 1.5px solid #FFCDD2; background: #FFF1F2; color: #C0362C; border-radius: 12px; padding: 10px 13px; font-size: 13px; font-weight: 700; margin-bottom: 16px; }
        .rp-success { border: 1.5px solid #BBF7D0; background: #F0FDF4; color: #166534; border-radius: 12px; padding: 14px 16px; font-size: 14px; font-weight: 700; text-align: center; }
        .rp-btn { width: 100%; height: 54px; border-radius: 16px; border: 0; font-size: 15.5px; font-weight: 900; cursor: pointer; background: #7C3AED; color: #FFFFFF; box-shadow: 0 6px 0 #5B21B6; }
        .rp-btn:disabled { opacity: .6; cursor: not-allowed; }
        .rp-link { display: block; text-align: center; margin-top: 18px; font-size: 13.5px; font-weight: 700; color: #7C3AED; text-decoration: none; }
        .rp-link:hover { text-decoration: underline; }
      `}</style>
      <main className="rp-page">
        <div className="rp-card">
          {sesionValida === null && <p style={{ textAlign: 'center', color: '#726F8A' }}>Verificando enlace...</p>}

          {sesionValida === false && (
            <>
              <h1 className="rp-title">Enlace no válido</h1>
              <p className="rp-subtitle">Este enlace para restablecer tu contraseña no es válido o ya expiró. Solicita uno nuevo desde el login.</p>
              <Link href="/login" className="rp-link">← Volver al login</Link>
            </>
          )}

          {sesionValida === true && !listo && (
            <>
              <h1 className="rp-title">Nueva contraseña</h1>
              <p className="rp-subtitle">Escribe tu nueva contraseña para continuar.</p>
              <form onSubmit={handleSubmit}>
                <div className="rp-field">
                  <label htmlFor="password">Nueva contraseña</label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="rp-input"
                    autoComplete="new-password"
                  />
                </div>
                <div className="rp-field">
                  <label htmlFor="confirmar">Confirmar contraseña</label>
                  <input
                    id="confirmar"
                    type="password"
                    value={confirmar}
                    onChange={(e) => setConfirmar(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="rp-input"
                    autoComplete="new-password"
                  />
                </div>
                {error && <div className="rp-error">{error}</div>}
                <button type="submit" disabled={loading} className="rp-btn">
                  {loading ? 'Guardando...' : 'Guardar nueva contraseña'}
                </button>
              </form>
            </>
          )}

          {listo && (
            <div className="rp-success">✓ Contraseña actualizada. Entrando a Owlaris...</div>
          )}
        </div>
      </main>
    </>
  )
}
