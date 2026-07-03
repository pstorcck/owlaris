'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('Correo o contraseña incorrectos.'); setLoading(false); return }
    window.location.href = '/'
  }

  return (
    <>
      <style suppressHydrationWarning>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .lr {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          font-family: system-ui, -apple-system, sans-serif;
          position: relative;
          overflow: hidden;
          background: linear-gradient(160deg,#F8F7FF 0%,#F5FAFF 52%,#EEF2FF 100%);
        }
        .lr::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(109,40,217,.055) 1px, transparent 1px),
            linear-gradient(90deg, rgba(14,116,144,.045) 1px, transparent 1px);
          background-size: 46px 46px;
          opacity: .55;
          pointer-events: none;
        }
        .lc {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 440px;
          background: rgba(255,255,255,.88);
          backdrop-filter: blur(22px);
          border-radius: 22px;
          padding: 36px 38px;
          border: 1px solid rgba(109,40,217,.14);
          box-shadow: 0 28px 80px rgba(30,27,75,.14), 0 2px 22px rgba(14,116,144,.08);
        }
        .access-badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          margin: 0 auto 18px;
          padding: 7px 12px;
          border-radius: 999px;
          background: #F8FAFC;
          border: 1px solid rgba(109,40,217,.12);
          color: #5B21B6;
          font-size: 11px;
          font-weight: 750;
          letter-spacing: .3px;
        }
        .logo-wrap {
          width: 76px; height: 76px;
          margin: 0 auto 16px;
          background: linear-gradient(135deg,#FFFFFF,#F3F0FF);
          border-radius: 22px;
          display: flex; align-items: center; justify-content: center;
          border: 1px solid rgba(124,58,237,.18);
          box-shadow: 0 12px 32px rgba(124,58,237,.14);
          animation: glow 3s ease-in-out infinite;
        }
        @keyframes glow {
          0%,100% { box-shadow: 0 12px 32px rgba(124,58,237,.14); }
          50% { box-shadow: 0 16px 42px rgba(124,58,237,.22); }
        }
        .fi {
          width: 100%;
          background: #FFFFFF;
          border: 1.5px solid rgba(109,40,217,.13);
          border-radius: 14px;
          padding: 13px 16px;
          font-size: 14px;
          color: #1E1B4B;
          outline: none;
          transition: all .2s;
          font-family: system-ui, sans-serif;
        }
        .fi::placeholder { color: #9CA3AF; }
        .fi:focus { border-color: rgba(124,58,237,.55); background: #FFFFFF; box-shadow: 0 0 0 4px rgba(124,58,237,.1); }
        .lb {
          width: 100%;
          background: linear-gradient(135deg,#7C3AED,#6D28D9);
          border: none;
          border-radius: 14px;
          padding: 14px;
          font-size: 15px;
          font-weight: 700;
          font-family: system-ui, sans-serif;
          color: white;
          cursor: pointer;
          transition: all .25s;
          box-shadow: 0 4px 24px rgba(124,58,237,.4);
        }
        .lb:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 32px rgba(124,58,237,.5); }
        .lb:disabled { opacity: .5; cursor: not-allowed; }
        .div { height:1px; background:linear-gradient(90deg,transparent,rgba(109,40,217,.16),transparent); margin:24px 0; }
        .btn-padres {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: #F8FAFC;
          border: 1px solid rgba(37,99,235,.12);
          border-radius: 14px;
          padding: 13px;
          text-decoration: none;
          transition: all .2s;
          color: #2563EB;
          font-size: 13px;
          font-weight: 600;
        }
        .btn-padres:hover { background: #EFF6FF; border-color: rgba(37,99,235,.24); color: #1D4ED8; }
      `}</style>

      <div className="lr">
        <div className="lc">
          <div style={{display:'flex',justifyContent:'center'}}>
            <div className="access-badge">Acceso institucional</div>
          </div>
          <div className="logo-wrap">
            <img src="/buho.png" alt="Owlaris" style={{width:'44px',height:'44px',objectFit:'contain'}}/>
          </div>

          <h1 style={{fontFamily:'system-ui',fontSize:'28px',fontWeight:800,color:'#1E1B4B',letterSpacing:'-0.5px',textAlign:'center',marginBottom:'6px'}}>
            Owlaris
          </h1>
          <p style={{fontSize:'13px',color:'#6B658C',textAlign:'center',marginBottom:'28px',fontWeight:500}}>
            Tu tutor académico inteligente
          </p>

          <form onSubmit={handleLogin} style={{display:'flex',flexDirection:'column',gap:'14px'}}>
            <div>
              <label style={{display:'block',fontSize:'11px',fontWeight:600,color:'#6B658C',letterSpacing:'.8px',textTransform:'uppercase',marginBottom:'8px'}}>
                Correo electrónico
              </label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
                placeholder="tu@colegio.edu.gt" required className="fi"/>
            </div>
            <div>
              <label style={{display:'block',fontSize:'11px',fontWeight:600,color:'#6B658C',letterSpacing:'.8px',textTransform:'uppercase',marginBottom:'8px'}}>
                Contraseña
              </label>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
                placeholder="••••••••" required className="fi"/>
            </div>

            {error && (
              <div style={{background:'rgba(239,68,68,.08)',border:'1px solid rgba(239,68,68,.2)',borderRadius:'10px',padding:'11px 14px'}}>
                <p style={{fontSize:'13px',color:'#F87171',fontWeight:500}}>{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading} className="lb" style={{marginTop:'4px'}}>
              {loading ? 'Entrando...' : 'Entrar a Owlaris →'}
            </button>
          </form>

          <div className="div"/>

          <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
            <a href="/padres/login" className="btn-padres">
              Portal para padres de familia →
            </a>
            <div style={{textAlign:'center'}}>
              <p style={{fontSize:'12px',color:'#9490B8',marginBottom:'6px'}}>¿No tienes cuenta?</p>
              <Link href="/signup" style={{fontSize:'13px',color:'#6D28D9',fontWeight:600,textDecoration:'none'}}>
                Regístrate aquí →
              </Link>
            </div>
          </div>

          <p style={{textAlign:'center',fontSize:'11px',color:'#9490B8',marginTop:'24px'}}>
            © 2026 Owlaris · Todos los derechos reservados
          </p>
        </div>
      </div>
    </>
  )
}
