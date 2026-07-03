'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowRight, Users } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    // Se crea aqui, no al inicio del componente: Next.js sigue renderizando
    // este componente 'use client' una vez en el servidor durante el build
    // para generar el HTML inicial, y createClient() lanza si faltan las
    // variables de entorno de Supabase en ese momento.
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Correo o contraseña incorrectos.')
      setLoading(false)
      return
    }
    window.location.href = '/'
  }

  return (
    <>
      <style suppressHydrationWarning>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
        .ow-page {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif;
          color: #1E2433;
          background: #FBFAFF;
          background-image:
            radial-gradient(60% 55% at 18% 8%, rgba(124,58,237,.07) 0%, transparent 65%),
            radial-gradient(55% 50% at 88% 92%, rgba(13,148,136,.06) 0%, transparent 65%);
        }
        .ow-main {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px 20px;
        }
        .ow-card {
          width: 100%;
          max-width: 392px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .ow-mark {
          width: 60px;
          height: 60px;
          border-radius: 18px;
          display: grid;
          place-items: center;
          background: #FFFFFF;
          border: 1px solid rgba(109,40,217,.14);
          box-shadow: 0 10px 26px rgba(109,40,217,.14);
          margin-bottom: 20px;
        }
        .ow-name {
          margin: 0;
          font-size: 22px;
          font-weight: 800;
          letter-spacing: -.01em;
          color: #191333;
        }
        .ow-tagline {
          margin: 6px 0 32px;
          font-size: 14px;
          font-weight: 500;
          color: #6B7186;
          text-align: center;
        }
        .ow-panel {
          width: 100%;
          border-radius: 20px;
          padding: 32px 30px;
          background: rgba(255,255,255,.86);
          border: 1px solid rgba(109,40,217,.10);
          box-shadow: 0 24px 60px rgba(30,27,75,.08);
          backdrop-filter: blur(16px);
        }
        .ow-form {
          display: grid;
          gap: 16px;
        }
        .ow-field {
          display: grid;
          gap: 7px;
        }
        .ow-field label {
          font-size: 12px;
          font-weight: 700;
          color: #6B7186;
        }
        .ow-input {
          width: 100%;
          height: 46px;
          border-radius: 12px;
          border: 1.5px solid rgba(148,163,184,.32);
          background: #FFFFFF;
          color: #191333;
          outline: none;
          padding: 0 14px;
          font-size: 14.5px;
          font-weight: 500;
          transition: border-color .15s ease, box-shadow .15s ease;
        }
        .ow-input::placeholder { color: #AAB0C2; }
        .ow-input:focus {
          border-color: rgba(109,40,217,.55);
          box-shadow: 0 0 0 3.5px rgba(109,40,217,.10);
        }
        .ow-error {
          border: 1px solid rgba(239,68,68,.2);
          background: #FEF2F2;
          color: #B91C1C;
          border-radius: 10px;
          padding: 9px 12px;
          font-size: 12.5px;
          font-weight: 600;
        }
        .ow-submit {
          width: 100%;
          height: 46px;
          margin-top: 2px;
          border-radius: 12px;
          border: 0;
          background: #6D28D9;
          color: #FFFFFF;
          font-size: 14.5px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          box-shadow: 0 10px 24px rgba(109,40,217,.24);
          transition: transform .16s ease, box-shadow .16s ease, opacity .16s ease;
        }
        .ow-submit:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 14px 28px rgba(109,40,217,.28); }
        .ow-submit:disabled { opacity: .6; cursor: not-allowed; transform: none; }
        .ow-divider {
          height: 1px;
          background: rgba(148,163,184,.2);
          margin: 24px 0 18px;
        }
        .ow-secondary {
          width: 100%;
          height: 42px;
          border-radius: 12px;
          border: 1px solid rgba(13,148,136,.2);
          background: rgba(13,148,136,.04);
          color: #0F766E;
          font-size: 13.5px;
          font-weight: 700;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: background .16s ease, transform .16s ease;
        }
        .ow-secondary:hover { background: rgba(13,148,136,.09); transform: translateY(-1px); }
        .ow-signup-line {
          margin: 16px 0 0;
          text-align: center;
          font-size: 13px;
          font-weight: 500;
          color: #8A8FA3;
        }
        .ow-signup-line a { color: #6D28D9; font-weight: 700; text-decoration: none; }
        .ow-signup-line a:hover { text-decoration: underline; }
        .ow-footer {
          padding: 22px 20px;
          text-align: center;
          font-size: 12px;
          font-weight: 500;
          color: #A6ABBD;
        }
        @media (max-width: 420px) {
          .ow-panel { padding: 26px 20px; }
        }
      `}</style>

      <main className="ow-page">
        <div className="ow-main">
          <div className="ow-card">
            <div className="ow-mark">
              <Image src="/buho.png" alt="Owlaris" width={34} height={34} priority />
            </div>
            <h1 className="ow-name">Owlaris</h1>
            <p className="ow-tagline">Tu tutor académico inteligente</p>

            <section className="ow-panel" aria-label="Acceso a Owlaris">
              <form onSubmit={handleLogin} className="ow-form">
                <div className="ow-field">
                  <label htmlFor="email">Correo electrónico</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="tu@colegio.edu.gt"
                    required
                    className="ow-input"
                    autoComplete="email"
                  />
                </div>
                <div className="ow-field">
                  <label htmlFor="password">Contraseña</label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="ow-input"
                    autoComplete="current-password"
                  />
                </div>

                {error && <div className="ow-error">{error}</div>}

                <button type="submit" disabled={loading} className="ow-submit">
                  {loading ? 'Entrando...' : 'Entrar'} <ArrowRight size={16} />
                </button>
              </form>

              <div className="ow-divider" />

              <Link href="/padres/login" className="ow-secondary">
                <Users size={16} /> Portal para padres de familia
              </Link>

              <p className="ow-signup-line">
                ¿No tienes cuenta? <Link href="/signup">Regístrate aquí</Link>
              </p>
            </section>
          </div>
        </div>

        <footer className="ow-footer">
          © 2026 Owlaris · Tutor académico para colegios
        </footer>
      </main>
    </>
  )
}
