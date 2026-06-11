'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function PadresLoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('Correo o contraseña incorrectos.'); setLoading(false); return }
    if (data.user) setTimeout(() => { window.location.href = '/padres' }, 500)
  }

  return (
    <>
      <style suppressHydrationWarning>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .pl {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          font-family: system-ui, -apple-system, sans-serif;
          background: #F5F7FA;
          background-image:
            radial-gradient(ellipse at 15% 15%, rgba(44,62,107,.08) 0%, transparent 55%),
            radial-gradient(ellipse at 85% 85%, rgba(91,141,184,.06) 0%, transparent 50%);
        }
        .pc {
          width: 100%;
          max-width: 420px;
          background: white;
          border-radius: 28px;
          padding: 44px 40px;
          border: 1px solid rgba(44,62,107,.1);
          box-shadow: 0 20px 60px rgba(44,62,107,.1), 0 4px 6px rgba(44,62,107,.04);
        }
        .fi {
          width: 100%;
          background: #F5F7FA;
          border: 1.5px solid rgba(44,62,107,.12);
          border-radius: 14px;
          padding: 13px 16px;
          font-size: 14px;
          color: #1A2744;
          outline: none;
          transition: all .2s;
          font-family: system-ui, sans-serif;
        }
        .fi::placeholder { color: #94A3B8; }
        .fi:focus { border-color: #2C3E6B; background: white; box-shadow: 0 0 0 4px rgba(44,62,107,.08); }
        .lb {
          width: 100%;
          background: linear-gradient(135deg,#2C3E6B,#3D5A9E);
          border: none;
          border-radius: 14px;
          padding: 15px;
          font-size: 15px;
          font-weight: 700;
          font-family: system-ui, sans-serif;
          color: white;
          cursor: pointer;
          transition: all .25s;
          box-shadow: 0 6px 24px rgba(44,62,107,.35);
        }
        .lb:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(44,62,107,.45); }
        .lb:disabled { opacity: .6; cursor: not-allowed; }
      `}</style>

      <div className="pl">
        <div className="pc">
          <div style={{textAlign:'center',marginBottom:'32px'}}>
            <div style={{width:'72px',height:'72px',margin:'0 auto 16px',background:'linear-gradient(135deg,#2C3E6B,#3D5A9E)',borderRadius:'20px',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 8px 32px rgba(44,62,107,.3)'}}>
              <img src="/buho.png" alt="Owlaris" style={{width:'44px',height:'44px',objectFit:'contain'}}/>
            </div>
            <h1 style={{fontSize:'28px',fontWeight:800,color:'#1A2744',letterSpacing:'-0.5px',marginBottom:'6px'}}>Owlaris</h1>
            <p style={{fontSize:'13px',color:'#5B8DB8',fontWeight:500}}>Portal para padres de familia</p>
          </div>

          <form onSubmit={handleLogin} style={{display:'flex',flexDirection:'column',gap:'16px'}}>
            <div>
              <label style={{display:'block',fontSize:'11px',fontWeight:700,color:'#2C3E6B',letterSpacing:'.8px',textTransform:'uppercase',marginBottom:'8px'}}>
                Correo electrónico
              </label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
                placeholder="tu@correo.com" required className="fi"/>
            </div>
            <div>
              <label style={{display:'block',fontSize:'11px',fontWeight:700,color:'#2C3E6B',letterSpacing:'.8px',textTransform:'uppercase',marginBottom:'8px'}}>
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
              {loading ? 'Entrando...' : 'Entrar →'}
            </button>
          </form>

          <div style={{height:'1px',background:'linear-gradient(90deg,transparent,rgba(44,62,107,.1),transparent)',margin:'24px 0'}}/>

          <div style={{textAlign:'center',display:'flex',flexDirection:'column',gap:'8px'}}>
            <p style={{fontSize:'12px',color:'#94A3B8'}}>¿Olvidaste tu contraseña? Contacta al administrador.</p>
            <Link href="/login" style={{fontSize:'13px',color:'#5B8DB8',textDecoration:'none',fontWeight:500}}>
              ← Volver al login principal
            </Link>
          </div>

          <p style={{textAlign:'center',fontSize:'11px',color:'#CBD5E1',marginTop:'24px'}}>
            © 2026 Owlaris · Todos los derechos reservados
          </p>
        </div>
      </div>
    </>
  )
}
