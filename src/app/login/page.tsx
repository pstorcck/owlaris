'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Users, BookOpen, Pencil, Lightbulb, Check, TrendingUp, MessageCircle, ShieldCheck } from 'lucide-react'
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

        .ow-decor-layer {
          position: absolute;
          inset: 0;
          z-index: 0;
          overflow: hidden;
          pointer-events: none;
          animation: ow-decor-fade 1.8s ease-out both;
        }
        .ow-decor-item {
          position: absolute;
          color: #FFFFFF;
          font-weight: 800;
          font-family: Georgia, ui-serif, serif;
          line-height: 1;
          white-space: nowrap;
        }
        .ow-decor-item.ow-decor-icon { display: flex; font-family: inherit; }
        @keyframes ow-decor-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .ow-owl-3d-outer {
          position: relative;
          z-index: 1;
          width: 400px;
          height: 400px;
          display: grid;
          place-items: center;
        }
        .ow-owl-3d-outer::before {
          content: "";
          position: absolute;
          inset: 6%;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255,255,255,.32) 0%, rgba(124,58,237,0) 68%);
          z-index: -1;
        }
        .ow-owl-3d-outer::after {
          content: "";
          position: absolute;
          bottom: 4px;
          width: 190px;
          height: 32px;
          border-radius: 50%;
          background: radial-gradient(ellipse, rgba(11,10,26,.34) 0%, rgba(11,10,26,0) 72%);
          z-index: -1;
        }
        .ow-owl-3d-anim {
          width: 100%;
          height: 100%;
          animation: ow-float 6s ease-in-out infinite;
        }
        @keyframes ow-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ow-owl-3d-anim { animation: none; }
          .ow-decor-layer { animation: none; }
        }

        .ow-hero-text { position: relative; z-index: 1; text-align: center; }
        .ow-hero-name {
          margin: 0;
          color: #FFFFFF;
          font-size: 42px;
          font-weight: 900;
          letter-spacing: -.02em;
        }
        .ow-hero-tagline {
          margin: 14px 0 0;
          color: #FFFFFF;
          font-size: 19px;
          font-weight: 800;
          max-width: 340px;
          line-height: 1.45;
          letter-spacing: -.01em;
        }
        .ow-hero-subtext {
          margin: 10px 0 0;
          color: rgba(255,255,255,.74);
          font-size: 14px;
          font-weight: 500;
          max-width: 300px;
          line-height: 1.55;
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
        .ow-card-panel {
          background: #FFFFFF;
          border-radius: 24px;
          border: 1px solid rgba(228,225,245,.7);
          box-shadow: 0 24px 56px -16px rgba(25,19,51,.18), 0 2px 8px rgba(25,19,51,.05);
          padding: 40px 34px;
          animation: ow-card-in .55s ease-out both;
        }
        @keyframes ow-card-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .ow-card-head { margin-bottom: 24px; }
        .ow-card-head h2 {
          margin: 0;
          font-size: 26px;
          font-weight: 900;
          color: #191333;
          letter-spacing: -.01em;
        }
        .ow-card-head h2 .ow-accent { color: #7C3AED; }
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
        .ow-trust-line {
          margin: 18px 0 0;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          text-align: center;
          font-size: 12px;
          font-weight: 700;
          color: #9490A6;
        }
        .ow-signup-line {
          margin: 14px 0 0;
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
          .ow-owl-3d-outer { width: 200px; height: 200px; }
          .ow-owl-3d-outer::after { width: 120px; height: 22px; }
          .ow-hero-name { font-size: 28px; }
          .ow-hero-tagline { font-size: 15px; }
          .ow-hero-subtext { font-size: 12.5px; }
          .ow-hero-chips { max-width: 300px; }
          .ow-chip { font-size: 11.5px; padding: 6px 12px; }
          .ow-formside { padding: 24px 22px 36px; }
          .ow-card-panel { padding: 30px 24px; box-shadow: 0 14px 34px -14px rgba(25,19,51,.16); }
          .ow-decor-item:nth-child(n+5) { display: none; }
          .ow-decor-item { transform: scale(.85) rotate(var(--r, 0deg)); }
        }
        @media (max-width: 420px) {
          .ow-owl-3d-outer { width: 165px; height: 165px; }
          .ow-hero { padding: 24px 20px 22px; gap: 10px; }
        }
      `}</style>

      <main className="ow-page">
        <section className="ow-hero">
          <div className="ow-decor-layer">
            <span className="ow-decor-item" style={{ top: '8%', left: '6%', fontSize: 16, opacity: .10, transform: 'rotate(-8deg)' }}>2x + 4 = 12</span>
            <span className="ow-decor-item" style={{ top: '9%', right: '8%', fontSize: 42, opacity: .08, transform: 'rotate(12deg)' }}>π</span>
            <span className="ow-decor-item ow-decor-icon" style={{ bottom: '10%', left: '9%', opacity: .12, transform: 'rotate(-6deg)' }}><TrendingUp size={24} strokeWidth={2.2} /></span>
            <span className="ow-decor-item ow-decor-icon" style={{ bottom: '12%', right: '7%', opacity: .12, transform: 'rotate(9deg)' }}><MessageCircle size={22} strokeWidth={2.2} /></span>
            <span className="ow-decor-item ow-decor-icon" style={{ top: '24%', left: '9%', opacity: .12, transform: 'rotate(-10deg)' }}><BookOpen size={28} strokeWidth={2.2} /></span>
            <span className="ow-decor-item ow-decor-icon" style={{ top: '20%', right: '12%', opacity: .12, transform: 'rotate(16deg)' }}><Pencil size={24} strokeWidth={2.2} /></span>
            <span className="ow-decor-item" style={{ top: '40%', left: '4%', fontSize: 15, opacity: .10, transform: 'rotate(6deg)' }}>√49 = 7</span>
            <span className="ow-decor-item" style={{ top: '36%', right: '5%', fontSize: 14, opacity: .10, transform: 'rotate(-5deg)' }}>A² + B² = C²</span>
            <span className="ow-decor-item ow-decor-icon" style={{ top: '58%', left: '10%', opacity: .12, transform: 'rotate(8deg)' }}><Lightbulb size={26} strokeWidth={2.2} /></span>
            <span className="ow-decor-item" style={{ top: '54%', right: '9%', fontSize: 38, opacity: .08, transform: 'rotate(-14deg)' }}>∑</span>
            <span className="ow-decor-item ow-decor-icon" style={{ top: '72%', left: '6%', opacity: .13, transform: 'rotate(-6deg)' }}><Check size={22} strokeWidth={2.4} /></span>
            <span className="ow-decor-item" style={{ top: '70%', right: '11%', fontSize: 16, opacity: .11, transform: 'rotate(9deg)' }}>f(x)</span>
          </div>

          <div className="ow-owl-3d-outer">
            <div className="ow-owl-3d-anim">
              <OwlarisOwlHero />
            </div>
          </div>
          <div className="ow-hero-text">
            <h1 className="ow-hero-name">Owlaris</h1>
            <p className="ow-hero-tagline">La IA que enseña a pensar, no a copiar.</p>
            <p className="ow-hero-subtext">Practica, entiende y avanza paso a paso con acompañamiento académico inteligente.</p>
          </div>
          <div className="ow-hero-chips">
            <span className="ow-chip">Práctica guiada</span>
            <span className="ow-chip">Pensamiento crítico</span>
            <span className="ow-chip">Reportes para familia</span>
            <span className="ow-chip">Contenido del colegio</span>
          </div>
        </section>

        <section className="ow-formside">
          <div className="ow-card">
            <div className="ow-card-panel">
              <div className="ow-card-head">
                <h2>Bienvenido a <span className="ow-accent">Owlaris</span></h2>
                <p>Continúa tu aprendizaje donde lo dejaste.</p>
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

              <p className="ow-trust-line">
                <ShieldCheck size={14} /> Plataforma segura para colegios, alumnos y familias.
              </p>

              <p className="ow-signup-line">
                ¿No tienes cuenta? <Link href="/signup">Regístrate aquí</Link>
              </p>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
