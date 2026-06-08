'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const router   = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('Correo o contraseña incorrectos.'); setLoading(false); return }
    window.location.replace('/')
  }

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com"/>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Syne:wght@700;800&display=swap" rel="stylesheet"/>
      <style suppressHydrationWarning>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .lr {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          font-family: 'Plus Jakarta Sans', sans-serif;
          background: #F4F3FF;
          background-image:
            radial-gradient(ellipse at 15% 15%, rgba(109,40,217,.1) 0%, transparent 55%),
            radial-gradient(ellipse at 85% 85%, rgba(14,165,233,.07) 0%, transparent 50%);
        }
        .lc {
          width: 100%; max-width: 420px;
          background: white;
          border-radius: 28px;
          padding: 44px 40px;
          border: 1px solid rgba(109,40,217,.1);
          box-shadow: 0 20px 60px rgba(109,40,217,.1), 0 4px 6px rgba(109,40,217,.04);
        }
        .bw {
          width: 80px; height: 80px;
          margin: 0 auto 24px;
          background: linear-gradient(135deg,#F3F0FF,#EDE9FE);
          border-radius: 24px;
          display: flex; align-items: center; justify-content: center;
          border: 1px solid rgba(109,40,217,.12);
          box-shadow: 0 8px 32px rgba(109,40,217,.12);
          animation: bf 4s ease-in-out infinite;
        }
        @keyframes bf { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        .fi {
          width: 100%;
          background: #F8F7FF;
          border: 1.5px solid rgba(109,40,217,.12);
          border-radius: 14px;
          padding: 13px 16px;
          font-size: 14px; font-weight: 400;
          font-family: 'Plus Jakarta Sans', sans-serif;
          color: #1E1B4B; outline: none;
          transition: all .2s;
        }
        .fi::placeholder { color: #C4C0E0; }
        .fi:focus { border-color: #7C3AED; background: white; box-shadow: 0 0 0 4px rgba(109,40,217,.08); }
        .lb {
          width: 100%;
          background: linear-gradient(135deg,#7C3AED,#6D28D9);
          border: none; border-radius: 14px;
          padding: 15px; font-size: 15px; font-weight: 700;
          font-family: 'Plus Jakarta Sans', sans-serif;
          color: white; cursor: pointer;
          transition: all .25s;
          box-shadow: 0 6px 24px rgba(109,40,217,.35);
        }
        .lb:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(109,40,217,.45); }
        .lb:disabled { opacity: .6; cursor: not-allowed; }
        .sp { animation: spin 1s linear infinite; }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .div { height:1px; background:linear-gradient(90deg,transparent,rgba(109,40,217,.1),transparent); margin:24px 0; }
      `}</style>

      <div className="lr">
        <div className="lc">
          <div className="bw">
            <img src="/buho.png" alt="Owlaris" style={{width:'52px',height:'52px',objectFit:'contain'}}/>
          </div>

          <h1 style={{fontFamily:"'Syne',sans-serif",fontSize:'32px',fontWeight:800,color:'#1E1B4B',letterSpacing:'-1px',textAlign:'center',marginBottom:'6px'}}>
            Owlaris
          </h1>
          <p style={{fontSize:'14px',color:'#9490B8',textAlign:'center',marginBottom:'32px'}}>
            Tu tutor académico inteligente
          </p>

          <form onSubmit={handleLogin} style={{display:'flex',flexDirection:'column',gap:'16px'}}>
            <div>
              <label style={{display:'block',fontSize:'11px',fontWeight:700,color:'#6D28D9',letterSpacing:'.8px',textTransform:'uppercase',marginBottom:'8px'}}>
                Correo electrónico
              </label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
                placeholder="tu@colegio.edu.gt" required className="fi"/>
            </div>
            <div>
              <label style={{display:'block',fontSize:'11px',fontWeight:700,color:'#6D28D9',letterSpacing:'.8px',textTransform:'uppercase',marginBottom:'8px'}}>
                Contraseña
              </label>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
                placeholder="••••••••" required className="fi"/>
            </div>

            {error && (
              <div style={{background:'rgba(239,68,68,.05)',border:'1px solid rgba(239,68,68,.15)',borderRadius:'12px',padding:'11px 14px'}}>
                <p style={{fontSize:'13px',color:'#DC2626',fontWeight:500}}>{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading} className="lb" style={{marginTop:'4px'}}>
              {loading ? (
                <span style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}>
                  <svg className="sp" style={{width:'16px',height:'16px'}} fill="none" viewBox="0 0 24 24">
                    <circle style={{opacity:.25}} cx="12" cy="12" r="10" stroke="white" strokeWidth="4"/>
                    <path style={{opacity:.75}} fill="white" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/>
                  </svg>
                  Entrando...
                </span>
              ) : 'Entrar a Owlaris →'}
            </button>
          </form>

          <div className="div"/>

          <div style={{textAlign:'center',display:'flex',flexDirection:'column',gap:'8px'}}>
            <p style={{fontSize:'12px',color:'#C4C0E0'}}>¿Olvidaste tu contraseña? Contacta a tu administrador.</p>
            <p style={{fontSize:'13px',color:'#9490B8'}}>
              ¿No tienes cuenta?{' '}
              <Link href="/signup" style={{color:'#7C3AED',fontWeight:700,textDecoration:'none'}}>
                Regístrate aquí →
              </Link>
            </p>
          </div>

          <p style={{textAlign:'center',fontSize:'11px',color:'#DDD9F5',marginTop:'24px',letterSpacing:'.3px'}}>
            © 2026 Owlaris · Todos los derechos reservados
          </p>
        </div>
      </div>
    </>
  )
}
