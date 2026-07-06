'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Heart, TrendingUp, Check, Calendar, BookOpen, Star, MessageCircle, LineChart } from 'lucide-react'
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
          background: radial-gradient(circle, rgba(255,255,255,.32) 0%, rgba(15,156,140,0) 68%);
          z-index: -1;
        }
        .ow-owl-3d-outer::after {
          content: "";
          position: absolute;
          bottom: 4px;
          width: 190px;
          height: 32px;
          border-radius: 50%;
          background: radial-gradient(ellipse, rgba(6,36,33,.34) 0%, rgba(6,36,33,0) 72%);
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
          background: #F8FBFA;
        }
        .ow-card { width: 100%; max-width: 380px; }
        .ow-card-panel {
          background: #FFFFFF;
          border-radius: 24px;
          border: 1px solid rgba(220,237,233,.8);
          box-shadow: 0 24px 56px -16px rgba(6,36,33,.16), 0 2px 8px rgba(6,36,33,.05);
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
          .ow-owl-3d-outer { width: 200px; height: 200px; }
          .ow-owl-3d-outer::after { width: 120px; height: 22px; }
          .ow-hero-name { font-size: 28px; }
          .ow-hero-tagline { font-size: 15px; }
          .ow-hero-subtext { font-size: 12.5px; }
          .ow-hero-chips { max-width: 300px; }
          .ow-chip { font-size: 11.5px; padding: 6px 12px; }
          .ow-formside { padding: 24px 22px 36px; }
          .ow-card-panel { padding: 30px 24px; box-shadow: 0 14px 34px -14px rgba(6,36,33,.14); }
          .ow-decor-item:nth-child(n+9) { display: none; }
        }
        @media (max-width: 420px) {
          .ow-owl-3d-outer { width: 165px; height: 165px; }
          .ow-hero { padding: 24px 20px 22px; gap: 10px; }
        }
      `}</style>

      <main className="ow-page">
        <section className="ow-hero">
          <div className="ow-decor-layer">
            <span className="ow-decor-item" style={{ top: '7%', left: '4%', fontSize: 34, opacity: .13, transform: 'rotate(-8deg)' }}>progreso</span>
            <span className="ow-decor-item ow-decor-icon" style={{ top: '5%', right: '6%', opacity: .15, transform: 'rotate(10deg)' }}><Heart size={50} strokeWidth={2.2} /></span>
            <span className="ow-decor-item ow-decor-icon" style={{ bottom: '7%', left: '6%', opacity: .15, transform: 'rotate(-6deg)' }}><TrendingUp size={50} strokeWidth={2.2} /></span>
            <span className="ow-decor-item" style={{ bottom: '8%', right: '4%', fontSize: 32, opacity: .13, transform: 'rotate(9deg)' }}>confianza</span>
            <span className="ow-decor-item ow-decor-icon" style={{ top: '21%', left: '4%', opacity: .15, transform: 'rotate(-10deg)' }}><Check size={56} strokeWidth={2.4} /></span>
            <span className="ow-decor-item ow-decor-icon" style={{ top: '17%', right: '6%', opacity: .14, transform: 'rotate(14deg)' }}><Calendar size={50} strokeWidth={2.2} /></span>
            <span className="ow-decor-item" style={{ top: '37%', left: '0%', fontSize: 70, opacity: .10, transform: 'rotate(6deg)' }}>guía</span>
            <span className="ow-decor-item ow-decor-icon" style={{ top: '33%', right: '0%', opacity: .14, transform: 'rotate(-5deg)' }}><BookOpen size={56} strokeWidth={2.2} /></span>
            <span className="ow-decor-item ow-decor-icon" style={{ top: '55%', left: '3%', opacity: .15, transform: 'rotate(8deg)' }}><Star size={48} strokeWidth={2.2} /></span>
            <span className="ow-decor-item" style={{ top: '51%', right: '2%', fontSize: 36, opacity: .13, transform: 'rotate(-12deg)' }}>hábito</span>
            <span className="ow-decor-item ow-decor-icon" style={{ top: '70%', left: '1%', opacity: .14, transform: 'rotate(-6deg)' }}><MessageCircle size={48} strokeWidth={2.2} /></span>
            <span className="ow-decor-item ow-decor-icon" style={{ top: '68%', right: '4%', opacity: .14, transform: 'rotate(9deg)' }}><LineChart size={50} strokeWidth={2.2} /></span>

            <span className="ow-decor-item ow-decor-icon" style={{ top: '13%', left: '40%', opacity: .10, transform: 'rotate(8deg)' }}><Heart size={28} strokeWidth={2.2} /></span>
            <span className="ow-decor-item" style={{ top: '27%', left: '62%', fontSize: 22, opacity: .09, transform: 'rotate(-10deg)' }}>progreso</span>
            <span className="ow-decor-item ow-decor-icon" style={{ top: '15%', left: '62%', opacity: .10, transform: 'rotate(9deg)' }}><Star size={24} strokeWidth={2.2} /></span>
            <span className="ow-decor-item ow-decor-icon" style={{ top: '49%', left: '32%', opacity: .10, transform: 'rotate(14deg)' }}><Check size={30} strokeWidth={2.4} /></span>
            <span className="ow-decor-item ow-decor-icon" style={{ top: '30%', left: '35%', opacity: .10, transform: 'rotate(-12deg)' }}><Calendar size={26} strokeWidth={2.2} /></span>
            <span className="ow-decor-item ow-decor-icon" style={{ top: '62%', left: '64%', opacity: .10, transform: 'rotate(-8deg)' }}><Star size={26} strokeWidth={2.2} /></span>
            <span className="ow-decor-item" style={{ top: '58%', left: '38%', fontSize: 22, opacity: .09, transform: 'rotate(5deg)' }}>hábito</span>
            <span className="ow-decor-item" style={{ top: '79%', left: '40%', fontSize: 24, opacity: .09, transform: 'rotate(10deg)' }}>guía</span>
            <span className="ow-decor-item ow-decor-icon" style={{ top: '87%', left: '62%', opacity: .10, transform: 'rotate(-12deg)' }}><BookOpen size={26} strokeWidth={2.2} /></span>
            <span className="ow-decor-item" style={{ top: '84%', left: '30%', fontSize: 20, opacity: .09, transform: 'rotate(-7deg)' }}>confianza</span>

            <span className="ow-decor-item" style={{ top: '4%', left: '46%', fontSize: 20, opacity: .10, transform: 'rotate(-6deg)' }}>hábito</span>
            <span className="ow-decor-item ow-decor-icon" style={{ top: '9%', left: '30%', opacity: .11, transform: 'rotate(10deg)' }}><MessageCircle size={22} strokeWidth={2.2} /></span>
            <span className="ow-decor-item" style={{ top: '10%', right: '28%', fontSize: 20, opacity: .10, transform: 'rotate(7deg)' }}>guía</span>
            <span className="ow-decor-item ow-decor-icon" style={{ top: '45%', left: '20%', opacity: .12, transform: 'rotate(9deg)' }}><Check size={24} strokeWidth={2.4} /></span>
            <span className="ow-decor-item ow-decor-icon" style={{ top: '45%', right: '20%', opacity: .12, transform: 'rotate(-9deg)' }}><TrendingUp size={24} strokeWidth={2.2} /></span>
            <span className="ow-decor-item" style={{ top: '65%', left: '22%', fontSize: 20, opacity: .10, transform: 'rotate(6deg)' }}>progreso</span>
            <span className="ow-decor-item" style={{ top: '65%', right: '24%', fontSize: 18, opacity: .10, transform: 'rotate(-6deg)' }}>confianza</span>
            <span className="ow-decor-item ow-decor-icon" style={{ top: '92%', left: '46%', opacity: .11, transform: 'rotate(8deg)' }}><Heart size={22} strokeWidth={2.2} /></span>
            <span className="ow-decor-item" style={{ top: '80%', left: '18%', fontSize: 18, opacity: .10, transform: 'rotate(-8deg)' }}>guía</span>
            <span className="ow-decor-item" style={{ top: '80%', right: '16%', fontSize: 18, opacity: .10, transform: 'rotate(8deg)' }}>hábito</span>
            <span className="ow-decor-item ow-decor-icon" style={{ top: '25%', left: '20%', opacity: .11, transform: 'rotate(-8deg)' }}><Check size={20} strokeWidth={2.4} /></span>
            <span className="ow-decor-item ow-decor-icon" style={{ top: '25%', right: '20%', opacity: .11, transform: 'rotate(8deg)' }}><Calendar size={22} strokeWidth={2.2} /></span>
          </div>

          <div className="ow-owl-3d-outer">
            <div className="ow-owl-3d-anim">
              <OwlarisOwlHero progressBarColor="#0F9C8C" />
            </div>
          </div>
          <div className="ow-hero-text">
            <h1 className="ow-hero-name">Owlaris Familias</h1>
            <p className="ow-hero-tagline">Entiende cómo aprende tu hijo, paso a paso.</p>
            <p className="ow-hero-subtext">Recibe orientación, consejos prácticos y reportes claros para acompañar mejor su progreso académico.</p>
          </div>
          <div className="ow-hero-chips">
            <span className="ow-chip">Guía pedagógica</span>
            <span className="ow-chip">Consejos prácticos</span>
            <span className="ow-chip">Progreso académico</span>
            <span className="ow-chip">Disponible cuando lo necesites</span>
          </div>
        </section>

        <section className="ow-formside">
          <div className="ow-card">
            <div className="ow-card-panel">
              <div className="ow-card-head">
                <h2>Portal para padres</h2>
                <p>Ingresa para revisar el progreso académico de tu hijo o hija.</p>
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
                  {loading ? 'Entrando...' : 'Entrar al portal'}
                </button>
              </form>

              <p className="ow-signup-line">
                <Link href="/login">← Volver al login principal</Link>
              </p>
              <p className="ow-help-line">¿Olvidaste tu contraseña? Contacta al administrador del colegio.</p>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
