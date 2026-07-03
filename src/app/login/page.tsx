'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  GraduationCap,
  LineChart,
  LockKeyhole,
  School,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'

type Audience = 'alumno' | 'familia' | 'colegio'

const AUDIENCE_COPY: Record<Audience, {
  title: string
  body: string
  points: string[]
}> = {
  alumno: {
    title: 'Aprende con guía, no con respuestas para copiar.',
    body: 'Owlaris acompaña paso a paso, ajusta la dificultad y conserva el contexto de la materia para que cada práctica se sienta clara.',
    points: ['Práctica adaptativa', 'Explicaciones paso a paso', 'Inglés conversacional'],
  },
  familia: {
    title: 'Un reporte que sí se entiende en casa.',
    body: 'Cada sesión puede convertirse en un informe claro para padres: materia, temas, logros, oportunidades y próximos pasos.',
    points: ['Resumen pedagógico', 'Áreas de mejora claras', 'Evidencia de trabajo'],
  },
  colegio: {
    title: 'Una plataforma pensada para colegios reales.',
    body: 'Directores, docentes y guías pueden dar seguimiento por sede, grado, materia y alertas importantes sin perder la trazabilidad.',
    points: ['Paneles por rol', 'Alertas académicas', 'Contenido oficial'],
  },
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [audience, setAudience] = useState<Audience>('alumno')
  const supabase = createClient()

  const selected = useMemo(() => AUDIENCE_COPY[audience], [audience])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
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
        .ow-home {
          min-height: 100vh;
          color: #172033;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif;
          background:
            linear-gradient(180deg, rgba(255,255,255,.92) 0%, rgba(255,255,255,.78) 42%, rgba(241,250,255,.9) 100%),
            linear-gradient(135deg, #F8FBFF 0%, #F6F2FF 48%, #ECFEFF 100%);
          overflow-x: hidden;
        }
        .ow-shell {
          width: min(1180px, calc(100% - 36px));
          margin: 0 auto;
        }
        .ow-nav {
          min-height: 74px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
        }
        .ow-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
          color: #1E1B4B;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif;
          font-weight: 900;
          letter-spacing: 0;
        }
        .ow-brand-mark {
          width: 48px;
          height: 48px;
          border-radius: 16px;
          display: grid;
          place-items: center;
          background: #FFFFFF;
          border: 1px solid rgba(109,40,217,.16);
          box-shadow: 0 12px 28px rgba(37,99,235,.12);
        }
        .ow-nav-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .ow-pill {
          border: 1px solid rgba(109,40,217,.14);
          background: rgba(255,255,255,.76);
          color: #4C1D95;
          border-radius: 999px;
          padding: 10px 14px;
          text-decoration: none;
          font-size: 13px;
          font-weight: 800;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: transform .18s ease, border-color .18s ease, background .18s ease;
        }
        .ow-pill:hover { transform: translateY(-1px); border-color: rgba(20,184,166,.45); background: #FFFFFF; }
        .ow-hero {
          min-height: calc(100vh - 74px);
          display: grid;
          grid-template-columns: minmax(0, 1.06fr) minmax(360px, .74fr);
          gap: 44px;
          align-items: center;
          padding: 28px 0 70px;
        }
        .ow-copy {
          display: grid;
          gap: 24px;
          align-content: center;
        }
        .ow-kicker {
          width: fit-content;
          display: inline-flex;
          align-items: center;
          gap: 9px;
          border-radius: 999px;
          padding: 10px 14px;
          background: rgba(236,253,245,.92);
          color: #047857;
          border: 1px solid rgba(20,184,166,.25);
          font-size: 13px;
          font-weight: 900;
        }
        .ow-title {
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif;
          max-width: 680px;
          margin: 0;
          color: #111827;
          font-size: clamp(42px, 6vw, 76px);
          line-height: .98;
          letter-spacing: 0;
          font-weight: 950;
        }
        .ow-title span { color: #6D28D9; }
        .ow-lead {
          max-width: 610px;
          margin: 0;
          color: #526075;
          font-size: 19px;
          line-height: 1.65;
          font-weight: 600;
        }
        .ow-cta-row {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: center;
        }
        .ow-primary, .ow-secondary, .ow-login-button {
          min-height: 52px;
          border-radius: 16px;
          border: 0;
          padding: 0 18px;
          font-size: 15px;
          font-weight: 900;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          cursor: pointer;
          transition: transform .18s ease, box-shadow .18s ease, background .18s ease;
          letter-spacing: 0;
        }
        .ow-primary {
          background: #6D28D9;
          color: #FFFFFF;
          box-shadow: 0 12px 0 #4C1D95, 0 24px 38px rgba(109,40,217,.22);
        }
        .ow-primary:hover { transform: translateY(-2px); box-shadow: 0 14px 0 #4C1D95, 0 26px 42px rgba(109,40,217,.24); }
        .ow-secondary {
          background: #FFFFFF;
          color: #0F766E;
          border: 1px solid rgba(15,118,110,.22);
          box-shadow: 0 10px 24px rgba(15,118,110,.09);
        }
        .ow-secondary:hover { transform: translateY(-2px); background: #F0FDFA; }
        .ow-proof {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          max-width: 650px;
        }
        .ow-proof-item {
          min-height: 92px;
          border-radius: 8px;
          padding: 15px;
          background: rgba(255,255,255,.72);
          border: 1px solid rgba(148,163,184,.24);
          display: grid;
          gap: 7px;
        }
        .ow-proof-item strong {
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif;
          color: #111827;
          font-size: 22px;
          line-height: 1;
        }
        .ow-proof-item span {
          color: #64748B;
          font-size: 12px;
          font-weight: 800;
          line-height: 1.35;
        }
        .ow-stage {
          position: relative;
          min-height: 620px;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          justify-content: center;
          gap: 16px;
        }
        .ow-owl-wrap {
          position: relative;
          width: 212px;
          height: 212px;
          margin-right: 116px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: linear-gradient(180deg, #FFFFFF 0%, #ECFEFF 100%);
          border: 1px solid rgba(20,184,166,.18);
          box-shadow: 0 28px 70px rgba(20,184,166,.18);
          animation: ow-float 4.5s ease-in-out infinite;
          z-index: 2;
        }
        @keyframes ow-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .ow-login-panel {
          width: 100%;
          max-width: 440px;
          margin-left: auto;
          border-radius: 8px;
          padding: 26px;
          background: rgba(255,255,255,.93);
          border: 1px solid rgba(109,40,217,.16);
          box-shadow: 0 28px 70px rgba(30,41,59,.16);
          backdrop-filter: blur(18px);
        }
        .ow-login-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 18px;
        }
        .ow-login-head h2 {
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif;
          margin: 0;
          color: #111827;
          font-size: 22px;
          line-height: 1.15;
          font-weight: 950;
        }
        .ow-login-head p {
          margin: 5px 0 0;
          color: #64748B;
          font-size: 13px;
          font-weight: 700;
        }
        .ow-field {
          display: grid;
          gap: 8px;
        }
        .ow-field label {
          color: #536179;
          font-size: 11px;
          font-weight: 950;
          letter-spacing: .08em;
          text-transform: uppercase;
        }
        .ow-input {
          width: 100%;
          height: 52px;
          border-radius: 8px;
          border: 1.5px solid rgba(148,163,184,.38);
          background: #FFFFFF;
          color: #111827;
          outline: none;
          padding: 0 15px;
          font-size: 15px;
          font-weight: 650;
          transition: border-color .16s ease, box-shadow .16s ease;
        }
        .ow-input::placeholder { color: #A7B0C0; }
        .ow-input:focus {
          border-color: rgba(109,40,217,.62);
          box-shadow: 0 0 0 4px rgba(109,40,217,.1);
        }
        .ow-login-button {
          width: 100%;
          background: #14B8A6;
          color: #FFFFFF;
          box-shadow: 0 8px 0 #0F766E, 0 20px 32px rgba(20,184,166,.2);
        }
        .ow-login-button:hover:not(:disabled) { transform: translateY(-2px); }
        .ow-login-button:disabled { opacity: .62; cursor: not-allowed; transform: none; }
        .ow-error {
          border: 1px solid rgba(239,68,68,.22);
          background: #FEF2F2;
          color: #B91C1C;
          border-radius: 8px;
          padding: 11px 13px;
          font-size: 13px;
          font-weight: 750;
        }
        .ow-form {
          display: grid;
          gap: 14px;
        }
        .ow-panel-links {
          display: grid;
          gap: 10px;
          margin-top: 18px;
          padding-top: 18px;
          border-top: 1px solid rgba(148,163,184,.22);
        }
        .ow-link-line {
          color: #64748B;
          font-size: 13px;
          font-weight: 750;
          text-align: center;
        }
        .ow-link-line a { color: #6D28D9; text-decoration: none; font-weight: 950; }
        .ow-audience {
          padding: 52px 0 74px;
          background: #FFFFFF;
          border-top: 1px solid rgba(148,163,184,.18);
        }
        .ow-audience-grid {
          display: grid;
          grid-template-columns: .82fr 1.18fr;
          gap: 32px;
          align-items: start;
        }
        .ow-tabs {
          display: grid;
          gap: 10px;
        }
        .ow-tab {
          width: 100%;
          min-height: 64px;
          border-radius: 8px;
          border: 1px solid rgba(148,163,184,.24);
          background: #FFFFFF;
          color: #334155;
          padding: 14px;
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          text-align: left;
          font-size: 15px;
          font-weight: 900;
        }
        .ow-tab[data-active=true] {
          border-color: rgba(109,40,217,.28);
          background: #F5F3FF;
          color: #5B21B6;
        }
        .ow-info {
          border-radius: 8px;
          min-height: 260px;
          padding: 30px;
          border: 1px solid rgba(148,163,184,.22);
          background: linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%);
        }
        .ow-info h2 {
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif;
          margin: 0 0 12px;
          color: #111827;
          font-size: clamp(26px, 4vw, 42px);
          line-height: 1.08;
          letter-spacing: 0;
          font-weight: 950;
        }
        .ow-info p {
          margin: 0 0 22px;
          color: #526075;
          font-size: 17px;
          line-height: 1.65;
          font-weight: 650;
        }
        .ow-point-list {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }
        .ow-point {
          display: flex;
          align-items: center;
          gap: 8px;
          min-height: 52px;
          border-radius: 8px;
          background: #FFFFFF;
          border: 1px solid rgba(20,184,166,.18);
          padding: 10px 12px;
          color: #0F766E;
          font-size: 13px;
          font-weight: 900;
        }
        .ow-band {
          padding: 56px 0 68px;
          background: #F8FAFC;
        }
        .ow-section-title {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 22px;
        }
        .ow-section-title h2 {
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif;
          margin: 0;
          color: #111827;
          font-size: clamp(28px, 4vw, 44px);
          line-height: 1.08;
          letter-spacing: 0;
          font-weight: 950;
        }
        .ow-section-title p {
          max-width: 470px;
          margin: 0;
          color: #64748B;
          line-height: 1.55;
          font-weight: 650;
        }
        .ow-feature-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }
        .ow-feature {
          border-radius: 8px;
          background: #FFFFFF;
          border: 1px solid rgba(148,163,184,.22);
          min-height: 170px;
          padding: 20px;
          display: grid;
          align-content: start;
          gap: 14px;
        }
        .ow-feature-icon {
          width: 44px;
          height: 44px;
          display: grid;
          place-items: center;
          border-radius: 8px;
          background: #EEF2FF;
          color: #6D28D9;
        }
        .ow-feature h3 {
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif;
          margin: 0;
          color: #111827;
          font-size: 17px;
          font-weight: 950;
          letter-spacing: 0;
        }
        .ow-feature p {
          margin: 0;
          color: #64748B;
          font-size: 14px;
          line-height: 1.55;
          font-weight: 650;
        }
        .ow-footer {
          padding: 28px 0 36px;
          background: #FFFFFF;
          color: #64748B;
          border-top: 1px solid rgba(148,163,184,.18);
        }
        .ow-footer-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          font-size: 13px;
          font-weight: 750;
        }
        .ow-footer a { color: #6D28D9; text-decoration: none; font-weight: 900; }
        @media (max-width: 980px) {
          .ow-hero { grid-template-columns: 1fr; gap: 28px; padding-top: 14px; }
          .ow-stage { min-height: auto; display: block; }
          .ow-owl-wrap { position: relative; left: auto; top: auto; margin: 0 auto 18px; width: 190px; height: 190px; }
          .ow-login-panel { margin: 0 auto; }
          .ow-audience-grid, .ow-feature-grid { grid-template-columns: 1fr; }
          .ow-proof, .ow-point-list { grid-template-columns: 1fr; }
          .ow-section-title { display: grid; }
        }
        @media (max-width: 640px) {
          .ow-shell { width: min(100% - 24px, 1180px); }
          .ow-nav { min-height: 66px; }
          .ow-nav-actions .ow-pill:first-child { display: none; }
          .ow-title { font-size: 42px; }
          .ow-lead { font-size: 16px; line-height: 1.55; }
          .ow-primary, .ow-secondary { width: 100%; }
          .ow-login-panel { padding: 20px; }
          .ow-info { padding: 22px; }
          .ow-footer-inner { display: grid; justify-items: start; }
        }
      `}</style>

      <main className="ow-home">
        <nav className="ow-shell ow-nav" aria-label="Principal">
          <Link href="/login" className="ow-brand">
            <span className="ow-brand-mark">
              <Image src="/buho.png" alt="Owlaris" width={34} height={34} priority />
            </span>
            <span style={{ display: 'grid', lineHeight: 1.05 }}>
              <span style={{ fontSize: 24 }}>Owlaris</span>
              <span style={{ fontSize: 11, color: '#7C6EA8', fontWeight: 850 }}>Tutor académico</span>
            </span>
          </Link>

          <div className="ow-nav-actions">
            <Link href="/padres/login" className="ow-pill">
              <Users size={16} /> Padres
            </Link>
            <Link href="/signup" className="ow-pill">
              <GraduationCap size={16} /> Registro
            </Link>
          </div>
        </nav>

        <section className="ow-shell ow-hero">
          <div className="ow-copy">
            <div className="ow-kicker">
              <Sparkles size={16} /> Aprender puede sentirse claro desde el primer minuto
            </div>
            <h1 className="ow-title">
              Tu tutor académico <span>inteligente</span> para practicar, entender y avanzar.
            </h1>
            <p className="ow-lead">
              Owlaris conecta el contenido oficial del colegio con un tutor adaptativo, reportes para familia y seguimiento para el equipo educativo.
            </p>
            <div className="ow-cta-row">
              <a href="#acceso" className="ow-primary">
                Entrar a Owlaris <ArrowRight size={19} />
              </a>
              <Link href="/signup" className="ow-secondary">
                Crear cuenta <GraduationCap size={18} />
              </Link>
            </div>
            <div className="ow-proof" aria-label="Beneficios principales">
              <div className="ow-proof-item">
                <strong>24/7</strong>
                <span>Práctica guiada para dudas y repasos</span>
              </div>
              <div className="ow-proof-item">
                <strong>3</strong>
                <span>Vistas: alumno, familia y colegio</span>
              </div>
              <div className="ow-proof-item">
                <strong>100%</strong>
                <span>Enfoque en comprensión, no copia</span>
              </div>
            </div>
          </div>

          <div className="ow-stage" id="acceso">
            <div className="ow-owl-wrap" aria-hidden="true">
              <Image src="/buho.png" alt="" width={198} height={198} priority style={{ objectFit: 'contain' }} />
            </div>
            <section className="ow-login-panel" aria-label="Acceso a Owlaris">
              <div className="ow-login-head">
                <div>
                  <h2>Acceso institucional</h2>
                  <p>Ingresa con tu cuenta del colegio.</p>
                </div>
                <LockKeyhole size={26} color="#6D28D9" />
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

                <button type="submit" disabled={loading} className="ow-login-button">
                  {loading ? 'Entrando...' : 'Entrar ahora'} <ArrowRight size={18} />
                </button>
              </form>

              <div className="ow-panel-links">
                <Link href="/padres/login" className="ow-secondary" style={{ minHeight: 48 }}>
                  Portal para padres <Users size={17} />
                </Link>
                <p className="ow-link-line">
                  ¿No tienes cuenta? <Link href="/signup">Regístrate aquí</Link>
                </p>
              </div>
            </section>
          </div>
        </section>

        <section className="ow-audience">
          <div className="ow-shell ow-audience-grid">
            <div className="ow-tabs" role="tablist" aria-label="Experiencia por usuario">
              <button className="ow-tab" data-active={audience === 'alumno'} onClick={() => setAudience('alumno')} type="button">
                <BookOpenCheck size={22} /> Alumno
              </button>
              <button className="ow-tab" data-active={audience === 'familia'} onClick={() => setAudience('familia')} type="button">
                <Users size={22} /> Familia
              </button>
              <button className="ow-tab" data-active={audience === 'colegio'} onClick={() => setAudience('colegio')} type="button">
                <School size={22} /> Colegio
              </button>
            </div>

            <div className="ow-info">
              <h2>{selected.title}</h2>
              <p>{selected.body}</p>
              <div className="ow-point-list">
                {selected.points.map(point => (
                  <div className="ow-point" key={point}>
                    <CheckCircle2 size={17} /> {point}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="ow-band">
          <div className="ow-shell">
            <div className="ow-section-title">
              <h2>Una entrada simple a un ecosistema académico completo.</h2>
              <p>
                Desde la primera pantalla, Owlaris orienta al usuario correcto: estudiante, familia o equipo del colegio.
              </p>
            </div>
            <div className="ow-feature-grid">
              <article className="ow-feature">
                <div className="ow-feature-icon"><BookOpenCheck size={22} /></div>
                <h3>Tutor adaptativo</h3>
                <p>Guía paso a paso, mantiene contexto y ajusta dificultad durante la práctica.</p>
              </article>
              <article className="ow-feature">
                <div className="ow-feature-icon"><ShieldCheck size={22} /></div>
                <h3>Contenido oficial</h3>
                <p>Responde con base en los documentos académicos conectados al colegio.</p>
              </article>
              <article className="ow-feature">
                <div className="ow-feature-icon"><LineChart size={22} /></div>
                <h3>Reportes claros</h3>
                <p>Convierte cada sesión en una lectura útil para padres y maestros.</p>
              </article>
              <article className="ow-feature">
                <div className="ow-feature-icon"><School size={22} /></div>
                <h3>Seguimiento escolar</h3>
                <p>Dashboards por rol para observar avance, alertas y participación.</p>
              </article>
            </div>
          </div>
        </section>

        <footer className="ow-footer">
          <div className="ow-shell ow-footer-inner">
            <span>© 2026 Owlaris · Tutor académico para colegios</span>
            <span><Link href="/signup">Crear cuenta</Link> · <Link href="/padres/login">Portal padres</Link></span>
          </div>
        </footer>
      </main>
    </>
  )
}
