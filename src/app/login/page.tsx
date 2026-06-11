'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
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
          background: #0F0E17;
          background-image:
            radial-gradient(ellipse at 20% 20%, rgba(124,58,237,.15) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 80%, rgba(109,40,217,.1) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 0%, rgba(139,92,246,.08) 0%, transparent 40%);
        }
        .lc {
          width: 100%;
          max-width: 420px;
          background: #17151F;
          border-radius: 24px;
          padding: 44px 40px;
          border: 1px solid rgba(124,58,237,.2);
          box-shadow: 0 0 0 1px rgba(124,58,237,.05), 0 32px 80px rgba(0,0,0,.5), 0 0 60px rgba(124,58,237,.08);
        }
        .logo-wrap {
          width: 72px; height: 72px;
          margin: 0 auto 20px;
          background: linear-gradient(135deg,rgba(124,58,237,.2),rgba(109,40,217,.1));
          border-radius: 20px;
          display: flex; align-items: center; justify-content: center;
          border: 1px solid rgba(124,58,237,.3);
          box-shadow: 0 0 32px rgba(124,58,237,.2);
          animation: glow 3s ease-in-out infinite;
        }
        @keyframes glow {
          0%,100% { box-shadow: 0 0 32px rgba(124,58,237,.2); }
          50% { box-shadow: 0 0 48px rgba(124,58,237,.35); }
        }
        .fi {
          width: 100%;
          background: rgba(255,255,255,.04);
          border: 1.5px solid rgba(124,58,237,.15);
          border-radius: 12px;
          padding: 13px 16px;
          font-size: 14px;
          color: white;
          outline: none;
          transition: all .2s;
          font-family: system-ui, sans-serif;
        }
        .fi::placeholder { color: rgba(255,255,255,.25); }
        .fi:focus { border-color: rgba(124,58,237,.6); background: rgba(124,58,237,.06); box-shadow: 0 0 0 4px rgba(124,58,237,.1); }
        .lb {
          width: 100%;
          background: linear-gradient(135deg,#7C3AED,#6D28D9);
          border: none;
          border-radius: 12px;
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
        .div { height:1px; background:linear-gradient(90deg,transparent,rgba(124,58,237,.2),transparent); margin:24px 0; }
        .btn-padres {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: rgba(44,62,107,.3);
          border: 1px solid rgba(91,141,184,.2);
          border-radius: 12px;
          padding: 13px;
          text-decoration: none;
          transition: all .2s;
          color: #93B4D4;
          font-size: 13px;
          font-weight: 600;
        }
        .btn-padres:hover { background: rgba(44,62,107,.5); border-color: rgba(91,141,184,.4); color: #BAD4EC; }
      `}</style>

      <div className="lr">
        <div className="lc">
          <div className="logo-wrap">
            <img src="/buho.png" alt="Owlaris" style={{width:'44px',height:'44px',objectFit:'contain'}}/>
          </div>

          <h1 style={{fontFamily:'system-ui',fontSize:'28px',fontWeight:800,color:'white',letterSpacing:'-0.5px',textAlign:'center',marginBottom:'6px'}}>
            Owlaris
          </h1>
          <p style={{fontSize:'13px',color:'rgba(255,255,255,.4)',textAlign:'center',marginBottom:'32px',fontWeight:400}}>
            Tu tutor académico inteligente
          </p>

          <form onSubmit={handleLogin} style={{display:'flex',flexDirection:'column',gap:'14px'}}>
            <div>
              <label style={{display:'block',fontSize:'11px',fontWeight:600,color:'rgba(255,255,255,.4)',letterSpacing:'.8px',textTransform:'uppercase',marginBottom:'8px'}}>
                Correo electrónico
              </label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
                placeholder="tu@colegio.edu.gt" required className="fi"/>
            </div>
            <div>
              <label style={{display:'block',fontSize:'11px',fontWeight:600,color:'rgba(255,255,255,.4)',letterSpacing:'.8px',textTransform:'uppercase',marginBottom:'8px'}}>
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
              <p style={{fontSize:'12px',color:'rgba(255,255,255,.2)',marginBottom:'6px'}}>¿No tienes cuenta?</p>
              <Link href="/signup" style={{fontSize:'13px',color:'#A78BFA',fontWeight:600,textDecoration:'none'}}>
                Regístrate aquí →
              </Link>
            </div>
          </div>

          <p style={{textAlign:'center',fontSize:'11px',color:'rgba(255,255,255,.1)',marginTop:'28px'}}>
            © 2026 Owlaris · Todos los derechos reservados
          </p>
        </div>
      </div>
    </>
  )
}
