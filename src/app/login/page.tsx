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
    router.push('/'); router.refresh()
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=Syne:wght@600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Plus Jakarta Sans', sans-serif; }
        .login-root {
          min-height: 100vh;
          display: flex;
          background: #F8F7FF;
          background-image:
            radial-gradient(ellipse at 0% 0%, rgba(109,40,217,.08) 0%, transparent 55%),
            radial-gradient(ellipse at 100% 100%, rgba(14,165,233,.06) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 50%, rgba(109,40,217,.03) 0%, transparent 70%);
        }
        .login-left {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px;
          position: relative;
          overflow: hidden;
        }
        .login-left::before {
          content: '';
          position: absolute;
          width: 500px; height: 500px;
          background: radial-gradient(circle, rgba(109,40,217,.06) 0%, transparent 70%);
          top: -100px; left: -100px;
          border-radius: 50%;
        }
        .login-right {
          width: 480px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px;
          background: white;
          border-left: 1px solid rgba(109,40,217,.08);
          box-shadow: -8px 0 40px rgba(109,40,217,.06);
        }
        .login-card { width: 100%; max-width: 380px; }
        .inp {
          width: 100%;
          background: #F8F7FF;
          border: 1.5px solid rgba(109,40,217,.15);
          border-radius: 14px;
          padding: 13px 16px;
          font-size: 14px;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-weight: 400;
          color: #1E1B4B;
          transition: all .2s;
          outline: none;
        }
        .inp::placeholder { color: #B0ACCC; }
        .inp:focus { border-color: #7C3AED; background: white; box-shadow: 0 0 0 4px rgba(109,40,217,.08); }
        .btn-login {
          width: 100%;
          background: linear-gradient(135deg, #7C3AED, #6D28D9);
          border: none; border-radius: 14px;
          padding: 14px;
          font-size: 15px; font-weight: 700;
          font-family: 'Plus Jakarta Sans', sans-serif;
          color: white; cursor: pointer;
          transition: all .2s;
          box-shadow: 0 6px 24px rgba(109,40,217,.35);
          letter-spacing: .3px;
        }
        .btn-login:hover { transform: translateY(-2px); box-shadow: 0 10px 32px rgba(109,40,217,.45); }
        .btn-login:disabled { opacity: .6; cursor: not-allowed; transform: none; }
        .buho-float { animation: bFloat 4s ease-in-out infinite; }
        @keyframes bFloat { 0%,100%{transform:translateY(0) rotate(-2deg)} 50%{transform:translateY(-10px) rotate(2deg)} }
        .orb { position: absolute; border-radius: 50%; filter: blur(60px); pointer-events: none; }
        @media (max-width: 768px) {
          .login-left { display: none; }
          .login-right { width: 100%; border-left: none; box-shadow: none; }
        }
      `}</style>

      <div className="login-root">

        {/* Panel izquierdo — branding */}
        <div className="login-left">
          <div className="orb" style={{width:'300px',height:'300px',background:'rgba(109,40,217,.08)',top:'-50px',left:'-50px'}}/>
          <div className="orb" style={{width:'200px',height:'200px',background:'rgba(14,165,233,.06)',bottom:'50px',right:'50px'}}/>

          <div style={{position:'relative',zIndex:1,textAlign:'center',maxWidth:'420px'}}>
            {/* Búho grande */}
            <div className="buho-float" style={{marginBottom:'32px'}}>
              <div style={{width:'120px',height:'120px',margin:'0 auto',background:'linear-gradient(135deg,rgba(109,40,217,.12),rgba(14,165,233,.08))',borderRadius:'32px',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 20px 60px rgba(109,40,217,.15)',border:'1px solid rgba(109,40,217,.1)'}}>
                <img src="/buho.png" alt="Owlaris" style={{width:'80px',height:'80px',objectFit:'contain'}}/>
              </div>
            </div>

            <h1 style={{fontFamily:"'Syne',sans-serif",fontSize:'52px',fontWeight:800,color:'#1E1B4B',letterSpacing:'-2px',lineHeight:1,marginBottom:'16px'}}>
              Owlaris
            </h1>
            <p style={{fontSize:'18px',color:'#7C3AED',fontWeight:600,marginBottom:'12px',letterSpacing:'-0.3px'}}>
              Tu tutor académico inteligente
            </p>
            <p style={{fontSize:'15px',color:'#9490B8',lineHeight:'1.7',fontWeight:400}}>
              Aprende a tu ritmo con contenido oficial de tu colegio, guiado por inteligencia artificial.
            </p>

            {/* Features */}
            <div style={{display:'flex',flexDirection:'column',gap:'12px',marginTop:'36px',textAlign:'left'}}>
              {[
                { icon:'✦', text:'Contenido oficial de tu colegio' },
                { icon:'◈', text:'Tutor que te guía sin hacer tu tarea' },
                { icon:'◇', text:'Disponible cuando lo necesites' },
              ].map((f,i) => (
                <div key={i} style={{display:'flex',alignItems:'center',gap:'12px',background:'white',borderRadius:'14px',padding:'12px 16px',border:'1px solid rgba(109,40,217,.08)',boxShadow:'0 2px 12px rgba(109,40,217,.06)'}}>
                  <span style={{color:'#7C3AED',fontSize:'18px',flexShrink:0}}>{f.icon}</span>
                  <p style={{fontSize:'14px',color:'#4C1D95',fontWeight:500}}>{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Panel derecho — formulario */}
        <div className="login-right">
          <div className="login-card">

            {/* Header móvil */}
            <div style={{textAlign:'center',marginBottom:'36px'}}>
              <div style={{width:'64px',height:'64px',margin:'0 auto 16px',background:'linear-gradient(135deg,rgba(109,40,217,.1),rgba(14,165,233,.06))',borderRadius:'20px',display:'flex',alignItems:'center',justifyContent:'center',border:'1px solid rgba(109,40,217,.1)',boxShadow:'0 8px 24px rgba(109,40,217,.1)'}}>
                <img src="/buho.png" alt="Owlaris" style={{width:'42px',height:'42px',objectFit:'contain'}}/>
              </div>
              <h2 style={{fontFamily:"'Syne',sans-serif",fontSize:'26px',fontWeight:700,color:'#1E1B4B',letterSpacing:'-0.5px',marginBottom:'6px'}}>
                Bienvenido de vuelta
              </h2>
              <p style={{fontSize:'14px',color:'#9490B8',fontWeight:400}}>
                Ingresa con tu correo institucional
              </p>
            </div>

            <form onSubmit={handleLogin} style={{display:'flex',flexDirection:'column',gap:'16px'}}>
              <div>
                <label style={{display:'block',fontSize:'12px',fontWeight:600,color:'#4C1D95',marginBottom:'6px',letterSpacing:'.4px',textTransform:'uppercase'}}>
                  Correo electrónico
                </label>
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
                  placeholder="tu@colegio.edu.gt" required className="inp"/>
              </div>

              <div>
                <label style={{display:'block',fontSize:'12px',fontWeight:600,color:'#4C1D95',marginBottom:'6px',letterSpacing:'.4px',textTransform:'uppercase'}}>
                  Contraseña
                </label>
                <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
                  placeholder="••••••••" required className="inp"/>
              </div>

              {error && (
                <div style={{background:'rgba(239,68,68,.06)',border:'1px solid rgba(239,68,68,.15)',borderRadius:'12px',padding:'12px 14px'}}>
                  <p style={{fontSize:'13px',color:'#EF4444',fontWeight:500}}>{error}</p>
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-login" style={{marginTop:'4px'}}>
                {loading ? (
                  <span style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}>
                    <svg style={{animation:'spin 1s linear infinite',width:'16px',height:'16px'}} fill="none" viewBox="0 0 24 24">
                      <circle style={{opacity:.25}} cx="12" cy="12" r="10" stroke="white" strokeWidth="4"/>
                      <path style={{opacity:.75}} fill="white" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/>
                    </svg>
                    Entrando...
                  </span>
                ) : 'Entrar a Owlaris →'}
              </button>
            </form>

            <div style={{marginTop:'24px',textAlign:'center',display:'flex',flexDirection:'column',gap:'8px'}}>
              <p style={{fontSize:'12px',color:'#B0ACCC',fontWeight:400}}>
                ¿Olvidaste tu contraseña? Contacta a tu administrador.
              </p>
              <p style={{fontSize:'13px',color:'#9490B8'}}>
                ¿No tienes cuenta?{' '}
                <Link href="/signup" style={{color:'#7C3AED',fontWeight:600,textDecoration:'none'}}>
                  Regístrate aquí →
                </Link>
              </p>
            </div>

            <p style={{marginTop:'32px',textAlign:'center',fontSize:'11px',color:'#D4D0EE',letterSpacing:'.3px'}}>
              © 2026 Owlaris · Todos los derechos reservados
            </p>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </>
  )
}
