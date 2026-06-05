'use client'

import { useState, useEffect, useRef } from 'react'

interface Props {
  stats: {
    resumen: { totalAlumnos: number; activosHoy: number; activosSemana: number; totalInteracciones: number }
    topTemas: { tema: string; count: number }[]
    topMaterias: { materia: string; count: number }[]
    alumnos: { nombre_completo: string; sesiones: number; grado: string | null }[]
    topAlumnos: { nombre: string; sesiones: number }[]
    sinActividad: number
    promedioSesiones: number
  } | null
  colegio: string
}

interface Mensaje { rol: 'asistente' | 'usuario'; texto: string }

const SUGERENCIAS = [
  '¿Qué alumnos necesitan más atención?',
  '¿Qué temas debo reforzar esta semana?',
  'Dame un consejo pedagógico',
  '¿Cómo está el rendimiento del grupo?',
]

export default function AsistenteDocente({ stats, colegio }: Props) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [pregunta, setPregunta] = useState('')
  const [cargando, setCargando] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const saludo = stats
      ? `¡Hola! Soy tu asistente pedagógico de ${colegio}. Tienes **${stats.resumen.totalAlumnos} alumnos** registrados, **${stats.resumen.activosHoy} activos hoy** y **${stats.sinActividad} sin actividad**. ¿En qué te puedo ayudar?`
      : `¡Hola! Soy tu asistente pedagógico. ¿En qué te puedo ayudar hoy?`
    setMensajes([{ rol: 'asistente', texto: saludo }])
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  async function enviar(texto?: string) {
    const tp = (texto || pregunta).trim()
    if (!tp || cargando) return
    setPregunta('')
    setMensajes(prev => [...prev, { rol: 'usuario', texto: tp }])
    setCargando(true)

    const contexto = stats ? `
Datos del dashboard de ${colegio}:
- Total alumnos: ${stats.resumen.totalAlumnos}
- Activos hoy: ${stats.resumen.activosHoy}
- Activos esta semana: ${stats.resumen.activosSemana}
- Sin actividad: ${stats.sinActividad}
- Promedio sesiones/alumno: ${stats.promedioSesiones?.toFixed(1)}
- Top temas consultados: ${stats.topTemas.slice(0,5).map(t=>t.tema).join(', ')}
- Materias mas estudiadas: ${stats.topMaterias.slice(0,5).map(m=>m.materia).join(', ')}
- Alumnos mas activos: ${stats.topAlumnos.map(a=>a.nombre+'('+a.sesiones+')').join(', ')}
` : ''

    try {
      const res = await fetch('/api/asistente-docente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pregunta: tp, contexto }),
      })
      const data = await res.json()
      setMensajes(prev => [...prev, { rol: 'asistente', texto: data.respuesta || 'Error al responder.' }])
    } catch {
      setMensajes(prev => [...prev, { rol: 'asistente', texto: 'Hubo un error. Intenta de nuevo.' }])
    }
    setCargando(false)
  }

  return (
    <div style={{display:'flex',flexDirection:'column',flex:1,overflow:'hidden'}}>
      <div style={{flex:1,overflowY:'auto',padding:'16px',display:'flex',flexDirection:'column',gap:'10px'}}>
        {mensajes.map((m, i) => (
          <div key={i} style={{display:'flex',justifyContent:m.rol==='usuario'?'flex-end':'flex-start'}}>
            <div style={{
              maxWidth:'85%',padding:'10px 14px',
              borderRadius:m.rol==='usuario'?'16px 4px 16px 16px':'4px 16px 16px 16px',
              background:m.rol==='usuario'?'linear-gradient(135deg,#7C3AED,#5B21B6)':'#F8F7FF',
              color:m.rol==='usuario'?'white':'#1E1B4B',
              fontSize:'13px',lineHeight:'1.6',
              border:m.rol==='asistente'?'1px solid rgba(109,40,217,.08)':'none',
            }}>
              {m.texto.split('**').map((part, j) =>
                j % 2 === 1 ? <strong key={j}>{part}</strong> : part
              )}
            </div>
          </div>
        ))}
        {cargando && (
          <div style={{display:'flex',justifyContent:'flex-start'}}>
            <div style={{background:'#F8F7FF',border:'1px solid rgba(109,40,217,.08)',borderRadius:'4px 16px 16px 16px',padding:'12px 16px',display:'flex',gap:'4px',alignItems:'center'}}>
              {[0,1,2].map(i=>(
                <div key={i} style={{width:'6px',height:'6px',borderRadius:'50%',background:'#7C3AED',animation:`bounce 1s infinite ${i*0.2}s`}}/>
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {mensajes.length <= 1 && (
        <div style={{padding:'0 12px 8px',display:'flex',flexWrap:'wrap',gap:'6px'}}>
          {SUGERENCIAS.map((s,i) => (
            <button key={i} onClick={()=>enviar(s)}
              style={{background:'#F3F0FF',border:'1px solid rgba(109,40,217,.12)',borderRadius:'8px',padding:'6px 10px',fontSize:'11px',fontWeight:500,color:'#6D28D9',cursor:'pointer',fontFamily:'system-ui,sans-serif'}}>
              {s}
            </button>
          ))}
        </div>
      )}

      <div style={{padding:'12px',borderTop:'1px solid rgba(109,40,217,.06)',display:'flex',gap:'8px'}}>
        <input value={pregunta} onChange={e=>setPregunta(e.target.value)}
          onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();enviar()}}}
          placeholder="Pregunta sobre tus alumnos..."
          disabled={cargando}
          style={{flex:1,background:'#F8F7FF',border:'1px solid rgba(109,40,217,.1)',borderRadius:'10px',padding:'9px 12px',fontSize:'13px',color:'#1E1B4B',outline:'none',fontFamily:'system-ui,sans-serif'}}/>
        <button onClick={()=>enviar()} disabled={cargando||!pregunta.trim()}
          style={{background:'linear-gradient(135deg,#7C3AED,#5B21B6)',border:'none',borderRadius:'10px',width:'36px',height:'36px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',opacity:(!pregunta.trim()||cargando)?0.4:1,flexShrink:0}}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
          </svg>
        </button>
      </div>
      <style>{\`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}\`}</style>
    </div>
  )
}
