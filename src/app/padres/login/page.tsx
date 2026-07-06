'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import OwlarisOwlHero from '@/components/OwlarisOwlHero'

export default function PadresLoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    // Se crea aqui, no al inicio del componente: Next.js sigue renderizando
    // este componente 'use client' una vez en el servidor durante el build
    // para generar el HTML inicial, y createClient() lanza si faltan las
    // variables de entorno de Supabase en ese momento.
    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('Correo o contraseña incorrectos.'); setLoading(false); return }
    if (data.user) setTimeout(() => { window.location.href = '/padres' }, 500)
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
          background: linear-gradient(155deg, #0F9C8C 0%, #0F766E 55%, #0B5A54 100%);
        }
        .ow-hero::before, .ow-hero::after {
          content: "";
          position: absolute;
          border-radius: 50%;
          background: rgba(255,255,255,.07);
        }
        .ow-hero::before { width: 340px; height: 340px; top: -120px; left: -100px; }
        .ow-hero::after { width: 260px; height: 260px; bottom: -90px; right: -60px; background: rgba(124,58,237,.16); }
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
          background: #F8FBFA;
        }
        .ow-card { width: 100%; max-width: 380px; }
        .ow-card-head { margin-bottom: 24px; }
        .ow-card-head h2 {
          margin: 0;
          font-size: 26px;
          font-weight: 900;
          color: #0F2E2A;
          letter-spacing: -.01em;
        }
        .ow-card-head p {
          margin: 8px 0 0;
          font-size: 14.5px;
          font-weight: 600;
          color: #5E756F;
        }
        .ow-form { display: grid; gap: 16px; }
        .ow-field { display: grid; gap: 7px; }
        .ow-field label {
          font-size: 12px;
          font-weight: 800;
          color: #5E756F;
          text-transform: uppercase;
          letter-spacing: .04em;
        }
        .ow-input {
          width: 100%;
          height: 52px;
          border-radius: 16px;
          border: 2px solid #DCEDE9;
          background: #FFFFFF;
          color: #0F2E2A;
          outline: none;
          padding: 0 16px;
          font-size: 15px;
          font-weight: 600;
          transition: border-color .15s ease, box-shadow .15s ease;
        }
        .ow-input::placeholder { color: #9FB8B3; }
        .ow-input:focus {
          border-color: #0F9C8C;
          box-shadow: 0 0 0 4px rgba(15,156,140,.14);
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
          background: #0F9C8C;
          color: #FFFFFF;
          box-shadow: 0 6px 0 #0B5A54;
        }
        .ow-btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 7px 0 #0B5A54; }
        .ow-btn-primary:active:not(:disabled) { transform: translateY(3px); box-shadow: 0 2px 0 #0B5A54; }
        .ow-btn-primary:disabled { opacity: .6; cursor: not-allowed; transform: none; }
        .ow-help-line {
          margin: 18px 0 0;
          text-align: center;
          font-size: 13px;
          font-weight: 600;
          color: #8A9793;
        }
        .ow-signup-line {
          margin: 10px 0 0;
          text-align: center;
          font-size: 13.5px;
          font-weight: 600;
          color: #8A9793;
        }
        .ow-signup-line a { color: #0F9C8C; font-weight: 900; text-decoration: none; }
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
            <OwlarisOwlHero progressBarColor="#0F9C8C" />
          </div>
          <div className="ow-hero-text">
            <h1 className="ow-hero-name">Owlaris</h1>
            <p className="ow-hero-tagline">Reportes claros y acompañamiento para el aprendizaje de tu hijo o hija.</p>
          </div>
          <div className="ow-hero-chips">
            <span className="ow-chip">Reportes pedagógicos</span>
            <span className="ow-chip">Logros y áreas de mejora</span>
            <span className="ow-chip">Acompañamiento en casa</span>
          </div>
        </section>

        <section className="ow-formside">
          <div className="ow-card">
            <div className="ow-card-head">
              <h2>Portal para padres</h2>
              <p>Ingresa con tu cuenta para ver el progreso de tu hijo o hija.</p>
            </div>

            <form onSubmit={handleLogin} className="ow-form">
              <div className="ow-field">
                <label htmlFor="email">Correo electrónico</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
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
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>

            <p className="ow-help-line">¿Olvidaste tu contraseña? Contacta al administrador de tu colegio.</p>
            <p className="ow-signup-line">
              <Link href="/login">← Volver al login principal</Link>
            </p>
          </div>
        </section>
      </main>
    </>
  )
}
