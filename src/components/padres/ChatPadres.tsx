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
  const [threadId, setThreadId] = useState<string | null>(null)
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
        body: JSON.stringify({ pregunta: tp, thread_id: threadId }),
      })
      const data = await res.json()
      if (data.thread_id) setThreadId(data.thread_id)
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
        .padres-root { min-height: 100vh; background: #F0FDFA; font-family: system-ui, -apple-system, sans-serif; display: flex; flex-direction: column; }
        .p-header { background: white; border-bottom: 1px solid rgba(13,148,136,.1); padding: 0 20px; height: 60px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 10; box-shadow: 0 2px 12px rgba(13,148,136,.06); }
        .p-logo { display: flex; align-items: center; gap: 10px; }
        .p-logo img { width: 32px; height: 32px; object-fit: contain; }
        .p-logo-text { font-size: 16px; font-weight: 700; color: #0D9488; letter-spacing: -0.3px; }
        .p-logo-sub { font-size: 10px; color: #14B8A6; font-weight: 500; }
        .p-badge { background: #F0FDFA; border: 1px solid rgba(13,148,136,.2); border-radius: 8px; padding: 5px 12px; font-size: 12px; color: #0D9488; font-weight: 600; }
        .p-messages { flex: 1; overflow-y: auto; padding: 24px 16px; display: flex; flex-direction: column; gap: 16px; max-width: 760px; width: 100%; margin: 0 auto; }
        .p-msg-wrap { display: flex; gap: 10px; align-items: flex-end; }
        .p-msg-wrap.usuario { flex-direction: row-reverse; }
        .p-avatar { width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; }
        .p-avatar.asistente { background: linear-gradient(135deg,#0D9488,#14B8A6); }
        .p-avatar.usuario { background: linear-gradient(135deg,#0D9488,#065F46); color: white; }
        .p-bubble { max-width: 75%; padding: 12px 16px; border-radius: 16px; font-size: 14px; line-height: 1.65; }
        .p-bubble.asistente { background: white; color: #134E4A; border: 1px solid rgba(13,148,136,.1); border-radius: 4px 16px 16px 16px; box-shadow: 0 2px 8px rgba(13,148,136,.06); }
        .p-bubble.usuario { background: linear-gradient(135deg,#0D9488,#0F766E); color: white; border-radius: 16px 4px 16px 16px; }
        .p-time { font-size: 10px; color: #94A3B8; margin-top: 4px; }
        .p-typing { display: flex; gap: 4px; padding: 12px 16px; background: white; border-radius: 4px 16px 16px 16px; border: 1px solid rgba(13,148,136,.1); width: fit-content; }
        .p-dot { width: 7px; height: 7px; border-radius: 50%; background: #14B8A6; animation: pdot 1.2s infinite; }
        .p-dot:nth-child(2) { animation-delay: .2s; }
        .p-dot:nth-child(3) { animation-delay: .4s; }
        @keyframes pdot { 0%,80%,100%{transform:translateY(0);opacity:.4} 40%{transform:translateY(-6px);opacity:1} }
        .p-sugerencias { display: flex; gap: 8px; flex-wrap: wrap; padding: 0 16px 12px; max-width: 760px; width: 100%; margin: 0 auto; }
        .p-chip { background: white; border: 1px solid rgba(13,148,136,.2); border-radius: 20px; padding: 8px 14px; font-size: 12px; font-weight: 500; color: #0D9488; cursor: pointer; transition: all .15s; }
        .p-chip:hover { background: #F0FDFA; border-color: #14B8A6; }
        .p-footer { background: white; border-top: 1px solid rgba(13,148,136,.08); padding: 12px 16px; }
        .p-input-wrap { display: flex; gap: 10px; align-items: flex-end; max-width: 760px; margin: 0 auto; background: #F0FDFA; border: 1.5px solid rgba(13,148,136,.2); border-radius: 16px; padding: 10px 14px; }
        .p-input { flex: 1; background: transparent; border: none; outline: none; font-size: 14px; color: #134E4A; resize: none; font-family: system-ui, sans-serif; line-height: 1.5; max-height: 120px; }
        .p-input::placeholder { color: #94A3B8; }
        .p-send { background: linear-gradient(135deg,#0D9488,#0F766E); border: none; border-radius: 10px; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; transition: all .2s; }
        .p-send:disabled { opacity: .4; cursor: not-allowed; }
        .p-send:hover:not(:disabled) { box-shadow: 0 4px 12px rgba(13,148,136,.4); }
        .btn-salir { background: transparent; border: 1px solid rgba(13,148,136,.2); border-radius: 8px; padding: 6px 12px; font-size: 12px; color: #64748B; cursor: pointer; font-family: system-ui, sans-serif; }
      `}</style>

      <div className="padres-root">
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
                <div className={`p-bubble ${m.rol}`}>{m.contenido}</div>
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
          <div className="p-sugerencias">
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
    </>
  )
}
