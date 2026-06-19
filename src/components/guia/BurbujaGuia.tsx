'use client'

import { useState, useRef } from 'react'

export default function BurbujaGuia({ colegio }: { colegio: string }) {
  const [abierto, setAbierto] = useState(false)
  const [mensajes, setMensajes] = useState<{rol:'user'|'assistant'; texto:string}[]>([
    { rol: 'assistant', texto: 'Hola, soy tu asistente pedagógico. Puedo ayudarte a analizar el desempeño de tus alumnos y darte recomendaciones. ¿En qué te puedo ayudar?' }
  ])
  const [pregunta, setPregunta] = useState('')
  const [cargando, setCargando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function enviar() {
    if (!pregunta.trim() || cargando) return
    const txt = pregunta.trim()
    setPregunta('')
    setMensajes(p => [...p, { rol: 'user', texto: txt }])
    setCargando(true)
    try {
      const res = await fetch('/api/asistente-docente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pregunta: txt, contexto: `Guía del colegio ${colegio}` })
      })
      const data = await res.json()
      setMensajes(p => [...p, { rol: 'assistant', texto: data.respuesta || 'Error al responder.' }])
    } catch {
      setMensajes(p => [...p, { rol: 'assistant', texto: 'Error de conexión.' }])
    }
    setCargando(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  return (
    <>
      <button onClick={() => setAbierto(!abierto)}
        style={{position:'fixed',bottom:'28px',right:'28px',zIndex:100,display:'flex',alignItems:'center',gap:'10px',background:'linear-gradient(135deg,#2C3E6B,#1E3A5F)',color:'white',borderRadius:'20px',padding:'12px 20px',border:'none',cursor:'pointer',boxShadow:'0 8px 32px rgba(44,62,107,.4)',fontSize:'13px',fontWeight:600,fontFamily:'system-ui'}}>
        <img src="/buho.png" alt="" style={{width:'22px',height:'22px',objectFit:'contain'}}/>
        Guía Pedagógico
      </button>

      {abierto && (
        <div style={{position:'fixed',bottom:'90px',right:'28px',zIndex:99,width:'360px',height:'480px',background:'white',borderRadius:'16px',boxShadow:'0 20px 60px rgba(44,62,107,.2)',border:'1px solid rgba(44,62,107,.1)',display:'flex',flexDirection:'column',overflow:'hidden'}}>
          <div style={{background:'#2C3E6B',padding:'14px 18px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
            <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
              <img src="/buho.png" alt="" style={{width:'20px',height:'20px',objectFit:'contain'}}/>
              <span style={{color:'white',fontWeight:600,fontSize:'13px'}}>Guía Pedagógico</span>
            </div>
            <button onClick={() => setAbierto(false)} style={{background:'none',border:'none',color:'rgba(255,255,255,.7)',fontSize:'20px',cursor:'pointer',lineHeight:1,padding:'0 4px'}}>×</button>
          </div>

          <div style={{flex:1,overflow:'auto',padding:'16px',display:'flex',flexDirection:'column',gap:'10px'}}>
            {mensajes.map((m, i) => (
              <div key={i} style={{display:'flex',justifyContent:m.rol==='user'?'flex-end':'flex-start'}}>
                <div style={{maxWidth:'85%',padding:'10px 14px',borderRadius:m.rol==='user'?'16px 4px 16px 16px':'4px 16px 16px 16px',background:m.rol==='user'?'#2C3E6B':'#F5F7FA',color:m.rol==='user'?'white':'#1A2744',fontSize:'13px',lineHeight:1.5}}>
                  {m.texto.split('**').map((p,j) => j%2===1 ? <strong key={j}>{p}</strong> : p)}
                </div>
              </div>
            ))}
            {cargando && (
              <div style={{display:'flex',gap:'4px',padding:'10px 14px',background:'#F5F7FA',borderRadius:'4px 16px 16px 16px',width:'fit-content'}}>
                {[0,1,2].map(i => <div key={i} style={{width:'6px',height:'6px',borderRadius:'50%',background:'#2C3E6B',animation:`bounce 1.2s infinite ${i*0.2}s`}}/>)}
              </div>
            )}
          </div>

          <div style={{padding:'12px',borderTop:'1px solid #F1F5F9',display:'flex',gap:'8px',flexShrink:0}}>
            <input ref={inputRef} value={pregunta} onChange={e=>setPregunta(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();enviar()}}}
              placeholder="Escribe tu pregunta..."
              style={{flex:1,padding:'9px 14px',border:'1px solid #E2E8F0',borderRadius:'10px',fontSize:'13px',outline:'none',fontFamily:'system-ui'}}/>
            <button onClick={enviar} disabled={cargando||!pregunta.trim()}
              style={{background:'#2C3E6B',color:'white',border:'none',borderRadius:'10px',padding:'9px 14px',cursor:'pointer',fontSize:'13px',fontWeight:600,opacity:cargando||!pregunta.trim()?0.5:1}}>
              →
            </button>
          </div>
          <style>{`@keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}`}</style>
        </div>
      )}
    </>
  )
}
