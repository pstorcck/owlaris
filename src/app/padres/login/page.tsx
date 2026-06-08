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
    if (data.user) {
      // Verificar que el usuario tiene rol padre
      const { createClient: createBrowserClient } = await import('@/lib/supabase/client')
      const sb = createBrowserClient()
      const { data: perfil } = await sb.from('usuarios').select('rol').eq('id', data.user.id).single()
      if (perfil?.rol === 'padre') {
        window.location.href = '/padres'
      } else {
        setError('Esta cuenta no tiene acceso al portal de padres.')
        await supabase.auth.signOut()
        setLoading(false)
      }
    }
  }

  return (
    <>
      <style suppressHydrationWarning>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .pl { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; font-family: system-ui, sans-serif; background: #F0FDFA; background-image: radial-gradient(ellipse at 15% 15%, rgba(13,148,136,.08) 0%, transparent 55%), radial-gradient(ellipse at 85% 85%, rgba(20,184,166,.06) 0%, transparent 50%); }
        .pc { width: 100%; max-width: 420px; background: white; border-radius: 28px; padding: 44px 40px; border: 1px solid rgba(13,148,136,.12); box-shadow: 0 20px 60px rgba(13,148,136,.1); }
        .fi { width: 100%; background: #F0FDFA; border: 1.5px solid rgba(13,148,136,.15); border-radius: 14px; padding: 13px 16px; font-size: 14px; color: #134E4A; outline: none; transition: all .2s; font-family: system-ui, sans-serif; }
        .fi::placeholder { color: #94A3B8; }
        .fi:focus { border-color: #0D9488; background: white; box-shadow: 0 0 0 4px rgba(13,148,136,.08); }
        .lb { width: 100%; background: linear-gradient(135deg,#0D9488,#0F766E); border: none; border-radius: 14px; padding: 15px; font-size: 15px; font-weight: 700; font-family: system-ui, sans-serif; color: white; cursor: pointer; transition: all .25s; box-shadow: 0 6px 24px rgba(13,148,136,.35); }
        .lb:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(13,148,136,.45); }
        .lb:disabled { opacity: .6; cursor: not-allowed; }
      `}</style>
      <div className="pl">
        <div className="pc">
          <div style={{textAlign:'center',marginBottom:'32px'}}>
            <div style={{width:'72px',height:'72px',margin:'0 auto 16px',background:'linear-gradient(135deg,#F0FDFA,#CCFBF1)',borderRadius:'20px',display:'flex',alignItems:'center',justifyContent:'center',border:'1px solid rgba(13,148,136,.15)',boxShadow:'0 8px 32px rgba(13,148,136,.12)'}}>
              <img src="/buho.png" alt="Owlaris" style={{width:'44px',height:'44px',objectFit:'contain'}}/>
            </div>
            <h1 style={{fontSize:'26px',fontWeight:800,color:'#134E4A',letterSpacing:'-0.5px',marginBottom:'6px'}}>Owlaris</h1>
            <p style={{fontSize:'13px',color:'#5EEAD4',fontWeight:500}}>Portal para padres de familia</p>
          </div>

          <form onSubmit={handleLogin} style={{display:'flex',flexDirection:'column',gap:'16px'}}>
            <div>
              <label style={{display:'block',fontSize:'11px',fontWeight:700,color:'#0D9488',letterSpacing:'.8px',textTransform:'uppercase',marginBottom:'8px'}}>Correo electrónico</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@correo.com" required className="fi"/>
            </div>
            <div>
              <label style={{display:'block',fontSize:'11px',fontWeight:700,color:'#0D9488',letterSpacing:'.8px',textTransform:'uppercase',marginBottom:'8px'}}>Contraseña</label>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required className="fi"/>
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

          <div style={{textAlign:'center',marginTop:'24px'}}>
            <Link href="/login" style={{fontSize:'12px',color:'#94A3B8',textDecoration:'none'}}>
              ← Volver al login principal
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
