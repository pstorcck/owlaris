'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Props {
  usuario: {
    id: string
    nombre_completo: string
    colegio: { nombre: string; id: string }
    colegio_id: string
  }
}

interface Mensaje {
  id: string
  rol: 'usuario' | 'asistente'
  contenido: string
  timestamp: Date
}

export default function ChatPadres({ usuario }: Props) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([{
    id: 'bienvenida',
    rol: 'asistente',
    contenido: `¡Bienvenido/a, ${usuario.nombre_completo.split(' ')[0]}! 🌿 Soy tu asistente educativo. Estoy aquí para ayudarte a acompañar el proceso de aprendizaje de tus hijos. ¿En qué te puedo ayudar hoy?`,
    timestamp: new Date(),
  }])
  const [pregunta, setPregunta] = useState('')
  const [cargando, setCargando] = useState(false)

  const [menuAbierto, setMenuAbierto] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  async function enviar(texto?: string) {
    const tp = (texto || pregunta).trim()
    if (!tp || cargando) return
    setPregunta('')

    const msgUsuario: Mensaje = {
      id: Date.now().toString(),
      rol: 'usuario',
      contenido: tp,
      timestamp: new Date(),
    }
    setMensajes(prev => [...prev, msgUsuario])
    setCargando(true)

    try {
      const res = await fetch('/api/preguntar-padres', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pregunta: tp,
          historial: mensajes.slice(-6).filter(m => m.contenido?.trim()).map(m => ({
            role: m.rol === 'usuario' ? 'user' : 'assistant',
            content: m.contenido,
          })),
        }),
      })
      const data = await res.json()
      setMensajes(prev => [...prev, {
        id: (Date.now()+1).toString(),
        rol: 'asistente',
        contenido: data.respuesta || 'Lo siento, hubo un error.',
        timestamp: new Date(),
      }])
    } catch {
      setMensajes(prev => [...prev, {
        id: (Date.now()+1).toString(),
        rol: 'asistente',
        contenido: 'Hubo un error de conexión. Intenta de nuevo.',
        timestamp: new Date(),
      }])
    }
    setCargando(false)
  }

  async function cerrarSesion() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const SUGERENCIAS = [
    '¿Cómo puedo apoyar a mi hijo en matemáticas?',
    '¿Qué hábitos de estudio recomiendas?',
    '¿Cómo motivar a mi hijo a leer?',
    'Tips para reducir el estrés en exámenes',
  ]

  return (
    <>
      <style suppressHydrationWarning>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .padres-root { min-height: 100vh; background: #F5F7FA; font-family: system-ui, -apple-system, sans-serif; display: flex; flex-direction: row; }
        .p-main { flex: 1; min-width: 0; display: flex; flex-direction: column; min-height: 100vh; }
        .p-sidebar { width: 260px; flex-shrink: 0; background: white; border-right: 1px solid rgba(44,62,107,.08); padding: 20px 16px; display: flex; flex-direction: column; gap: 4px; min-height: 100vh; position: sticky; top: 0; }
        .p-sidebar-logo { display: flex; align-items: center; gap: 10px; padding: 4px 4px 12px; }
        .p-sidebar-logo img { width: 32px; height: 32px; object-fit: contain; }
        .p-sidebar-logo .p-logo-text { color: #1A2744; }
        .p-sidebar-logo .p-logo-sub { color: #94A3B8; }
        .p-sidebar-divider { height: 1px; background: rgba(44,62,107,.08); margin: 12px 0; }
        .p-perfil-card { display: flex; align-items: center; gap: 10px; padding: 4px; }
        .p-perfil-avatar { width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0; background: linear-gradient(135deg,#2C3E6B,#3D5A9E); color: white; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; }
        .p-perfil-nombre { font-size: 13px; font-weight: 700; color: #1A2744; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .p-perfil-colegio { font-size: 11px; color: #94A3B8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .p-sidebar-titulo { font-size: 11px; font-weight: 600; letter-spacing: .5px; text-transform: uppercase; color: #94A3B8; margin: 0 4px 10px; }
        .p-sidebar-sugerencia { width: 100%; text-align: left; background: #F5F7FA; border: 1px solid rgba(44,62,107,.1); border-radius: 10px; padding: 9px 12px; font-size: 12px; font-weight: 500; color: #2C3E6B; cursor: pointer; font-family: inherit; transition: all .15s; }
        .p-sidebar-sugerencia:hover { background: #EEF2FF; border-color: #5B8DB8; }
        .btn-salir-sidebar { width: 100%; background: #F5F7FA; border: 1px solid rgba(44,62,107,.12); border-radius: 10px; padding: 10px 14px; font-size: 12px; font-weight: 600; color: #2C3E6B; cursor: pointer; font-family: inherit; }
        .btn-salir-sidebar:hover { background: #EEF2FF; }
        @media (max-width: 860px) { .p-sidebar { display: none; } }
        .p-header { background: #2C3E6B; padding: 0 24px; height: 64px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 10; box-shadow: 0 2px 20px rgba(44,62,107,.3); }
        @media (min-width: 861px) { .p-header { display: none; } }
        @media (min-width: 861px) { .p-sugerencias.p-sugerencias-movil { display: none; } }
        .p-logo { display: flex; align-items: center; gap: 12px; }
        .p-logo img { width: 36px; height: 36px; object-fit: contain; }
        .p-logo-text { font-size: 18px; font-weight: 700; color: white; letter-spacing: -0.3px; }
        .p-logo-sub { font-size: 10px; color: rgba(255,255,255,.5); font-weight: 500; letter-spacing: .5px; text-transform: uppercase; }
        .p-badge { background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.2); border-radius: 8px; padding: 5px 12px; font-size: 12px; color: white; font-weight: 500; }
        .p-messages { flex: 1; overflow-y: auto; padding: 28px 20px; display: flex; flex-direction: column; gap: 20px; max-width: 780px; width: 100%; margin: 0 auto; }
        .p-msg-wrap { display: flex; gap: 12px; align-items: flex-end; }
        .p-msg-wrap.usuario { flex-direction: row-reverse; }
        .p-avatar { width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; }
        .p-avatar.asistente { background: linear-gradient(135deg,#2C3E6B,#3D5A9E); box-shadow: 0 4px 12px rgba(44,62,107,.3); }
        .p-avatar.usuario { background: linear-gradient(135deg,#3D5A9E,#2C3E6B); color: white; }
        .p-bubble { max-width: 78%; padding: 14px 18px; border-radius: 18px; font-size: 14px; line-height: 1.7; }
        .p-bubble.asistente { background: white; color: #1A2744; border-radius: 4px 18px 18px 18px; box-shadow: 0 2px 16px rgba(44,62,107,.08); border: 1px solid rgba(44,62,107,.06); }
        .p-bubble.usuario { background: linear-gradient(135deg,#2C3E6B,#3D5A9E); color: white; border-radius: 18px 4px 18px 18px; box-shadow: 0 4px 16px rgba(44,62,107,.25); }
        .p-time { font-size: 10px; color: #94A3B8; margin-top: 4px; }
        .p-typing { display: flex; gap: 5px; padding: 14px 18px; background: white; border-radius: 4px 18px 18px 18px; border: 1px solid rgba(44,62,107,.06); width: fit-content; box-shadow: 0 2px 16px rgba(44,62,107,.08); }
        .p-dot { width: 7px; height: 7px; border-radius: 50%; background: #5B8DB8; animation: pdot 1.2s infinite; }
        .p-dot:nth-child(2) { animation-delay: .2s; }
        .p-dot:nth-child(3) { animation-delay: .4s; }
        @keyframes pdot { 0%,80%,100%{transform:translateY(0);opacity:.4} 40%{transform:translateY(-6px);opacity:1} }
        .p-sugerencias { display: flex; gap: 8px; flex-wrap: wrap; padding: 0 20px 16px; max-width: 780px; width: 100%; margin: 0 auto; }
        .p-chip { background: white; border: 1px solid rgba(44,62,107,.15); border-radius: 20px; padding: 8px 16px; font-size: 12px; font-weight: 500; color: #2C3E6B; cursor: pointer; transition: all .15s; box-shadow: 0 1px 4px rgba(44,62,107,.08); }
        .p-chip:hover { background: #EEF2FF; border-color: #5B8DB8; }
        .p-footer { background: white; border-top: 1px solid rgba(44,62,107,.08); padding: 16px 20px; box-shadow: 0 -4px 20px rgba(44,62,107,.04); }
        .p-input-wrap { display: flex; gap: 10px; align-items: flex-end; max-width: 780px; margin: 0 auto; background: #F5F7FA; border: 1.5px solid rgba(44,62,107,.15); border-radius: 16px; padding: 10px 14px; transition: border-color .2s; }
        .p-input-wrap:focus-within { border-color: #5B8DB8; background: white; }
        .p-input { flex: 1; background: transparent; border: none; outline: none; font-size: 14px; color: #1A2744; resize: none; font-family: system-ui, sans-serif; line-height: 1.5; max-height: 120px; }
        .p-input::placeholder { color: #94A3B8; }
        .p-send { background: linear-gradient(135deg,#2C3E6B,#3D5A9E); border: none; border-radius: 10px; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; transition: all .2s; box-shadow: 0 2px 8px rgba(44,62,107,.3); }
        .p-send:disabled { opacity: .4; cursor: not-allowed; }
        .p-send:hover:not(:disabled) { box-shadow: 0 4px 16px rgba(44,62,107,.4); transform: translateY(-1px); }
        .btn-salir { background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.2); border-radius: 8px; padding: 6px 14px; font-size: 12px; color: rgba(255,255,255,.8); cursor: pointer; font-family: system-ui, sans-serif; transition: all .15s; }
        .btn-salir:hover { background: rgba(255,255,255,0.2); }
      `}</style>

      <div className="padres-root">
        <aside className="p-sidebar">
          <div className="p-sidebar-logo">
            <img src="/buho.png" alt="Owlaris"/>
            <div>
              <div className="p-logo-text">Owlaris</div>
              <div className="p-logo-sub">Para padres de familia</div>
            </div>
          </div>

          <div className="p-sidebar-divider"/>

          <div className="p-perfil-card">
            <div className="p-perfil-avatar">{usuario.nombre_completo[0].toUpperCase()}</div>
            <div style={{minWidth:0}}>
              <p className="p-perfil-nombre">{usuario.nombre_completo}</p>
              <p className="p-perfil-colegio">{usuario.colegio?.nombre}</p>
            </div>
          </div>

          <div className="p-sidebar-divider"/>

          <div>
            <p className="p-sidebar-titulo">Preguntas frecuentes</p>
            <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
              {SUGERENCIAS.map((s,i) => (
                <button key={i} className="p-sidebar-sugerencia" onClick={()=>enviar(s)}>{s}</button>
              ))}
            </div>
          </div>

          <div style={{flex:1}}/>

          <button className="btn-salir-sidebar" onClick={cerrarSesion}>Salir</button>
        </aside>

        <div className="p-main">
        <header className="p-header">
          <div className="p-logo">
            <img src="/buho.png" alt="Owlaris"/>
            <div>
              <div className="p-logo-text">Owlaris</div>
              <div className="p-logo-sub">Para padres de familia</div>
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
            <span className="p-badge">{usuario.nombre_completo.split(' ')[0]}</span>
            <button className="btn-salir" onClick={cerrarSesion}>Salir</button>
          </div>
        </header>

        <div className="p-messages">
          {mensajes.map(m => (
            <div key={m.id} className={`p-msg-wrap ${m.rol}`}>
              <div className={`p-avatar ${m.rol}`}>
                {m.rol === 'asistente'
                  ? <img src="/buho.png" alt="Owlaris" style={{width:'20px',height:'20px',objectFit:'contain'}}/>
                  : usuario.nombre_completo[0].toUpperCase()}
              </div>
              <div>
                <div className={`p-bubble ${m.rol}`}>{(() => {
                  const limpio = m.contenido.replace(/【[^】]*】/g, '').trim()
                  return limpio.split('\n').map((linea, li) => {
                    const linkMatch = linea.match(/(https?:\/\/[^\s]+)/)
                    if (linkMatch) {
                      const url = linkMatch[1]
                      const antes = linea.substring(0, linea.indexOf(url))
                      return <span key={li}>{antes}<a href={url} target="_blank" rel="noopener noreferrer" style={{color:m.rol==='usuario'?'#99f6e4':'#0D9488',textDecoration:'underline',wordBreak:'break-all'}}>{url}</a><br/></span>
                    }
                    const partes = linea.split('**')
                    return <span key={li}>{partes.map((p,pi)=>pi%2===1?<strong key={pi}>{p}</strong>:p)}{li<limpio.split('\n').length-1&&<br/>}</span>
                  })
                })()}</div>
                <div className="p-time" style={{textAlign:m.rol==='usuario'?'right':'left'}}>
                  {m.timestamp.toLocaleTimeString('es-GT',{hour:'2-digit',minute:'2-digit'})}
                </div>
              </div>
            </div>
          ))}
          {cargando && (
            <div className="p-msg-wrap">
              <div className="p-avatar asistente">
                <img src="/buho.png" alt="" style={{width:'20px',height:'20px',objectFit:'contain'}}/>
              </div>
              <div className="p-typing">
                <div className="p-dot"/><div className="p-dot"/><div className="p-dot"/>
              </div>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>

        {mensajes.length <= 1 && (
          <div className="p-sugerencias p-sugerencias-movil">
            {SUGERENCIAS.map((s,i) => (
              <button key={i} className="p-chip" onClick={()=>enviar(s)}>{s}</button>
            ))}
          </div>
        )}

        <footer className="p-footer">
          <div className="p-input-wrap">
            <textarea
              className="p-input"
              value={pregunta}
              onChange={e=>setPregunta(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();enviar()}}}
              placeholder="Escribe tu pregunta..."
              rows={1}
              disabled={cargando}
            />
            <button className="p-send" onClick={()=>enviar()} disabled={cargando||!pregunta.trim()}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
              </svg>
            </button>
          </div>
        </footer>
        </div>
      </div>
    </>
  )
}
