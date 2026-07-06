'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Users } from 'lucide-react'
import OwlarisOwlHero from '@/components/OwlarisOwlHero'

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
          display: grid;
          grid-template-columns: 1fr 1fr;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif;
        }
        .ow-hero {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 26px;
          padding: 48px;
          overflow: hidden;
          background: linear-gradient(155deg, #7C3AED 0%, #6D28D9 55%, #5B21B6 100%);
        }
        .ow-hero::before, .ow-hero::after {
          content: "";
          position: absolute;
          border-radius: 50%;
          background: rgba(255,255,255,.07);
        }
        .ow-hero::before { width: 340px; height: 340px; top: -120px; left: -100px; }
        .ow-hero::after { width: 260px; height: 260px; bottom: -90px; right: -60px; background: rgba(20,184,166,.16); }
        .ow-owl-3d-wrap {
          position: relative;
          z-index: 1;
          width: 360px;
          height: 360px;
          display: grid;
          place-items: center;
          overflow: hidden;
          animation: ow-bob 3.4s ease-in-out infinite;
        }
        @keyframes ow-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .ow-owl-3d-wrap::after {
          content: "";
          position: absolute;
          bottom: 6px;
          width: 155px;
          height: 30px;
          border-radius: 50%;
          background: radial-gradient(ellipse, rgba(0,0,0,.28) 0%, rgba(0,0,0,0) 70%);
          z-index: -1;
        }
        .ow-hero-text { position: relative; z-index: 1; text-align: center; }
        .ow-hero-name {
          margin: 0;
          color: #FFFFFF;
          font-size: 40px;
          font-weight: 900;
          letter-spacing: -.02em;
        }
        .ow-hero-tagline {
          margin: 10px 0 0;
          color: rgba(255,255,255,.88);
          font-size: 17px;
          font-weight: 600;
          max-width: 320px;
          line-height: 1.5;
        }
        .ow-hero-chips {
          position: relative;
          z-index: 1;
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: center;
          max-width: 340px;
        }
        .ow-chip {
          background: rgba(255,255,255,.14);
          border: 1px solid rgba(255,255,255,.22);
          color: #FFFFFF;
          font-size: 12.5px;
          font-weight: 800;
          padding: 8px 14px;
          border-radius: 999px;
        }
        .ow-formside {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px 24px;
          background: #FAF9FF;
        }
        .ow-card { width: 100%; max-width: 380px; }
        .ow-card-head { margin-bottom: 24px; }
        .ow-card-head h2 {
          margin: 0;
          font-size: 26px;
          font-weight: 900;
          color: #191333;
          letter-spacing: -.01em;
        }
        .ow-card-head p {
          margin: 8px 0 0;
          font-size: 14.5px;
          font-weight: 600;
          color: #726F8A;
        }
        .ow-form { display: grid; gap: 16px; }
        .ow-field { display: grid; gap: 7px; }
        .ow-field label {
          font-size: 12px;
          font-weight: 800;
          color: #726F8A;
          text-transform: uppercase;
          letter-spacing: .04em;
        }
        .ow-input {
          width: 100%;
          height: 52px;
          border-radius: 16px;
          border: 2px solid #E4E1F5;
          background: #FFFFFF;
          color: #191333;
          outline: none;
          padding: 0 16px;
          font-size: 15px;
          font-weight: 600;
          transition: border-color .15s ease, box-shadow .15s ease;
        }
        .ow-input::placeholder { color: #B3AFCB; }
        .ow-input:focus {
          border-color: #7C3AED;
          box-shadow: 0 0 0 4px rgba(124,58,237,.14);
        }
        .ow-error {
          border: 1.5px solid #FFCDD2;
          background: #FFF1F2;
          color: #C0362C;
          border-radius: 12px;
          padding: 10px 13px;
          font-size: 13px;
          font-weight: 700;
        }
        .ow-btn {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 54px;
          border-radius: 16px;
          border: 0;
          font-size: 15.5px;
          font-weight: 900;
          letter-spacing: .01em;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          text-decoration: none;
          transition: transform .12s ease, box-shadow .12s ease, opacity .12s ease;
        }
        .ow-btn-primary {
          margin-top: 4px;
          background: #7C3AED;
          color: #FFFFFF;
          box-shadow: 0 6px 0 #5B21B6;
        }
        .ow-btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 7px 0 #5B21B6; }
        .ow-btn-primary:active:not(:disabled) { transform: translateY(3px); box-shadow: 0 2px 0 #5B21B6; }
        .ow-btn-primary:disabled { opacity: .6; cursor: not-allowed; transform: none; }
        .ow-btn-secondary {
          background: #E6FBF7;
          color: #0F766E;
          box-shadow: 0 6px 0 #B7EDE4;
        }
        .ow-btn-secondary:hover { transform: translateY(-1px); box-shadow: 0 7px 0 #B7EDE4; }
        .ow-btn-secondary:active { transform: translateY(3px); box-shadow: 0 2px 0 #B7EDE4; }
        .ow-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 22px 0 16px;
          color: #B3AFCB;
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .05em;
        }
        .ow-divider::before, .ow-divider::after {
          content: "";
          flex: 1;
          height: 1px;
          background: #E4E1F5;
        }
        .ow-signup-line {
          margin: 20px 0 0;
          text-align: center;
          font-size: 13.5px;
          font-weight: 600;
          color: #8A8697;
        }
        .ow-signup-line a { color: #7C3AED; font-weight: 900; text-decoration: none; }
        .ow-signup-line a:hover { text-decoration: underline; }
        @media (max-width: 860px) {
          .ow-page { grid-template-columns: 1fr; }
          .ow-hero { padding: 32px 24px 30px; gap: 12px; }
          .ow-owl-3d-wrap { width: 180px; height: 180px; }
          .ow-hero-name { font-size: 28px; }
          .ow-hero-tagline { font-size: 14px; }
          .ow-hero-chips { max-width: 300px; }
          .ow-chip { font-size: 11.5px; padding: 6px 12px; }
          .ow-formside { padding: 24px 22px 36px; }
        }
        @media (max-width: 420px) {
          .ow-owl-3d-wrap { width: 150px; height: 150px; }
          .ow-hero { padding: 24px 20px 22px; gap: 10px; }
        }
      `}</style>

      <main className="ow-page">
        <section className="ow-hero">
          <div className="ow-owl-3d-wrap">
            <OwlarisOwlHero />
          </div>
          <div className="ow-hero-text">
            <h1 className="ow-hero-name">Owlaris</h1>
            <p className="ow-hero-tagline">Tu tutor académico inteligente, listo para acompañarte a entender, practicar y avanzar.</p>
          </div>
          <div className="ow-hero-chips">
            <span className="ow-chip">Práctica guiada</span>
            <span className="ow-chip">Reportes para familia</span>
            <span className="ow-chip">Contenido oficial</span>
          </div>
        </section>

        <section className="ow-formside">
          <div className="ow-card">
            <div className="ow-card-head">
              <h2>Bienvenido de nuevo</h2>
              <p>Ingresa con tu cuenta del colegio para continuar.</p>
            </div>

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

              <button type="submit" disabled={loading} className="ow-btn ow-btn-primary">
                {loading ? 'Entrando...' : 'Entrar a Owlaris'}
              </button>
            </form>

            <div className="ow-divider">o</div>

            <Link href="/padres/login" className="ow-btn ow-btn-secondary">
              <Users size={18} /> Portal para padres de familia
            </Link>

            <p className="ow-signup-line">
              ¿No tienes cuenta? <Link href="/signup">Regístrate aquí</Link>
            </p>
          </div>
        </section>
      </main>
    </>
  )
}
