'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Usuario, Materia, MensajeChat } from '@/types'

interface Props {
  usuario: Usuario
  materias: Materia[]
}

const GRADOS_GUATEMALA = [
  '4to Primaria', '5to Primaria', '6to Primaria',
  '1ero Básico', '2do Básico', '3ero Básico',
  '4to Bachillerato', '5to Bachillerato',
]

const GRADOS_CON_MINEDUC = ['3ero Básico', '5to Bachillerato']

const SUGERENCIAS_DEFAULT = [
  { icon: '✦', text: 'Explícame con un ejemplo' },
  { icon: '◈', text: 'Quiero practicar' },
  { icon: '◇', text: 'Resume el tema' },
  { icon: '↺', text: 'Propón otro tema' },
]

function renderSegmento(texto: string, key: number): React.ReactNode[] {
  const partes: React.ReactNode[] = []
  const boldRegex = /\*\*([^*]+)\*\*/g
  let last = 0; let k = key; let match
  while ((match = boldRegex.exec(texto)) !== null) {
    if (match.index > last) partes.push(<span key={k++}>{texto.slice(last, match.index)}</span>)
    partes.push(<strong key={k++} style={{fontWeight:700}}>{match[1]}</strong>)
    last = match.index + match[0].length
  }
  if (last < texto.length) partes.push(<span key={k++}>{texto.slice(last)}</span>)
  return partes.length > 0 ? partes : [<span key={k}>{texto}</span>]
}

function renderTexto(texto: string): React.ReactNode[] {
  const lineas = texto.split('\n')
  return lineas.map((linea, lineaIdx) => {
    const segmentos: React.ReactNode[] = []
    let lastIndex = 0
    let key = 0
    const mdLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g
    mdLinkRegex.lastIndex = 0
    let match
    while ((match = mdLinkRegex.exec(linea)) !== null) {
      if (match.index > lastIndex) segmentos.push(...renderSegmento(linea.slice(lastIndex, match.index), key++))
      segmentos.push(<a key={key++} href={match[2]} target="_blank" rel="noopener noreferrer" style={{color:'#6D28D9',textDecoration:'underline',textDecorationColor:'rgba(109,40,217,.3)'}}>{match[2]}</a>)
      lastIndex = match.index + match[0].length
    }
    if (lastIndex < linea.length) {
      const resto = linea.slice(lastIndex)
      const urlRegex = /(https?:\/\/\S+)/g
      let lastUrl = 0; let urlMatch
      while ((urlMatch = urlRegex.exec(resto)) !== null) {
        if (urlMatch.index > lastUrl) segmentos.push(...renderSegmento(resto.slice(lastUrl, urlMatch.index), key++))
        segmentos.push(<a key={key++} href={urlMatch[1]} target="_blank" rel="noopener noreferrer" style={{color:'#6D28D9',textDecoration:'underline',textDecorationColor:'rgba(109,40,217,.3)'}}>{urlMatch[1]}</a>)
        lastUrl = urlMatch.index + urlMatch[0].length
      }
      if (lastUrl < resto.length) segmentos.push(...renderSegmento(resto.slice(lastUrl), key++))
    }
    return <span key={lineaIdx}>{segmentos.length > 0 ? segmentos : linea}{lineaIdx < lineas.length - 1 && <br />}</span>
  })
}

export default function ChatInterface({ usuario, materias }: Props) {
  const [mensajes, setMensajes]             = useState<MensajeChat[]>([])
  const [pregunta, setPregunta]             = useState('')
  const [materiaId, setMateriaId]           = useState('')
  const [grado, setGrado]                   = useState(usuario.grado || '4to Primaria')
  const [cargando, setCargando]             = useState(false)
  const [guardandoGrado, setGuardandoGrado] = useState(false)
  const [error, setError]                   = useState('')
  const [sugerencias, setSugerencias]       = useState(SUGERENCIAS_DEFAULT)
  const [expandido, setExpandido]           = useState<string | null>(null)
  const finalRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const router   = useRouter()
  const supabase = createClient()

  const materiasVisibles = materias.filter(m => {
    if (m.nombre.startsWith('Mineduc')) return GRADOS_CON_MINEDUC.includes(grado)
    return true
  })

  useEffect(() => { setMateriaId(materiasVisibles[0]?.id || '') }, [grado])
  useEffect(() => { finalRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [mensajes, cargando])

  useEffect(() => {
    if (!materiaId) return
    const nombre = usuario.nombre_completo.split(' ')[0]
    const mat = materiasVisibles.find(m => m.id === materiaId)?.nombre || 'tu materia'
    setMensajes([{
      id: 'bienvenida', rol: 'asistente', timestamp: new Date(),
      contenido: `¡Hola, ${nombre}! Soy Owlaris, tu tutor académico.\n\nEstoy aquí para ayudarte a comprender ${mat} de ${grado} usando el contenido oficial de tu colegio.\n\n¿Tienes una duda específica o quieres que te proponga un tema para estudiar hoy?`,
    }])
  }, [materiaId])

  async function cambiarGrado(g: string) {
    setGrado(g); setGuardandoGrado(true)
    await supabase.from('usuarios').update({ grado: g }).eq('id', usuario.id)
    setGuardandoGrado(false)
  }

  async function enviarPregunta(texto?: string) {
    const tp = (texto || pregunta).trim()
    if (!tp || cargando) return
    setPregunta(''); setError(''); setSugerencias([])
    setMensajes(prev => [...prev, { id: Date.now().toString(), rol: 'usuario', contenido: tp, timestamp: new Date() }])
    setCargando(true)
    try {
      const res = await fetch('/api/preguntar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pregunta: tp, materia_id: materiaId, grado_override: grado, historial: mensajes.slice(-6).map(m => ({ rol: m.rol, contenido: m.contenido })) })
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setMensajes(prev => [...prev, { id: (Date.now()+1).toString(), rol: 'asistente', contenido: data.respuesta, timestamp: new Date(), tokens: data.tokens, documento_fuente: data.documento_fuente }])
      const mat = materiasVisibles.find(m => m.id === materiaId)?.nombre || 'el tema'
      setSugerencias([
        { icon: '✦', text: `¿Qué partes tiene ${tp.split(' ').slice(0,4).join(' ')}?` },
        { icon: '◈', text: 'Quiero practicar' },
        { icon: '◇', text: 'Explícame con un ejemplo' },
        { icon: '↺', text: `Propón otro tema de ${mat}` },
      ])
    } catch { setError('Hubo un problema. Intenta de nuevo.') }
    finally { setCargando(false); inputRef.current?.focus() }
  }

  async function cerrarSesion() {
    await supabase.auth.signOut(); router.push('/login'); router.refresh()
  }

  const [generandoPDF, setGenerandoPDF] = useState(false)

  async function generarReporte() {
    if (mensajes.length < 3) return
    setGenerandoPDF(true)
    try {
      const res = await fetch('/api/reporte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          historial: mensajes.map(m => ({ rol: m.rol, contenido: m.contenido })),
          grado, materia: mat, colegio: usuario.colegio?.nombre
        })
      })
      const data = await res.json()
      if (!data.analisis) return

      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const W = 210, margin = 20, maxW = W - margin * 2
      let y = 0

      const addPage = () => { doc.addPage(); y = 20 }
      const checkY = (needed = 10) => { if (y + needed > 270) addPage() }

      const txt = (text: string, x: number, size: number, bold = false, color = [30,27,75]) => {
        doc.setFontSize(size)
        doc.setFont('helvetica', bold ? 'bold' : 'normal')
        doc.setTextColor(color[0], color[1], color[2])
        doc.text(text, x, y)
      }

      const wrappedTxt = (text: string, x: number, size: number, bold = false, color = [80,80,100]) => {
        doc.setFontSize(size); doc.setFont('helvetica', bold ? 'bold' : 'normal')
        doc.setTextColor(color[0], color[1], color[2])
        const lines = doc.splitTextToSize(text, maxW - (x - margin))
        checkY(lines.length * (size * 0.4 + 1))
        doc.text(lines, x, y)
        y += lines.length * (size * 0.4 + 1) + 2
      }

      // PORTADA
      doc.setFillColor(109, 40, 217)
      doc.rect(0, 0, W, 60, 'F')
      doc.setFillColor(124, 58, 237)
      doc.rect(0, 55, W, 8, 'F')

      doc.setFontSize(28); doc.setFont('helvetica', 'bold')
      doc.setTextColor(255, 255, 255)
      doc.text('Owlaris', margin, 28)
      doc.setFontSize(13); doc.setFont('helvetica', 'normal')
      doc.text('Reporte de Sesión Académica', margin, 38)
      doc.setFontSize(10)
      doc.text(usuario.colegio?.nombre || '', margin, 48)

      y = 80
      const nivelColor: Record<string,number[]> = {
        'Excelente': [22,163,74], 'Bueno': [37,99,235],
        'En proceso': [234,88,12], 'Necesita refuerzo': [220,38,38]
      }
      const nc = nivelColor[data.analisis.nivel] || [109,40,217]

      // Info alumno
      doc.setFillColor(248, 247, 255)
      doc.roundedRect(margin, y-5, maxW, 42, 4, 4, 'F')
      doc.setDrawColor(109,40,217); doc.setLineWidth(0.5)
      doc.roundedRect(margin, y-5, maxW, 42, 4, 4, 'S')

      txt('Alumno:', margin+6, 10, true, [109,40,217]); y += 7
      txt(usuario.nombre_completo, margin+6, 12, false, [30,27,75]); y += 7
            const msgsConFecha = mensajes.filter((m: MensajeChat) => m.timestamp)
      let durStr = ''
      if (msgsConFecha.length >= 2) {
        const ini = new Date(msgsConFecha[0].timestamp).getTime()
        const fin = new Date(msgsConFecha[msgsConFecha.length-1].timestamp).getTime()
        const mins = Math.round((fin - ini) / 60000)
        durStr = mins <= 1 ? '1 min' : mins + ' minutos'
      }
      txt(`Grado: ${grado}   |   Materia: ${mat || ''}   |   Fecha: ${new Date().toLocaleDateString('es-GT')}${durStr ? '   |   Duración: ' + durStr : ''}`, margin+6, 9, false, [120,110,160]); y += 7

      // Nivel
      doc.setFillColor(nc[0], nc[1], nc[2])
      doc.roundedRect(margin+6, y-4, 60, 10, 3, 3, 'F')
      doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255)
      doc.text(`Nivel: ${data.analisis.nivel}`, margin+10, y+2)
      y += 16

      // Resumen
      y += 6
      doc.setFillColor(237,233,254)
      doc.roundedRect(margin, y-4, maxW, 6, 2, 2, 'F')
      txt('RESUMEN DE LA SESIÓN', margin+4, 9, true, [109,40,217]); y += 10
      wrappedTxt(data.analisis.resumen, margin+4, 10, false, [60,50,100])
      y += 4

      // Temas
      checkY(20)
      doc.setFillColor(237,233,254)
      doc.roundedRect(margin, y-4, maxW, 6, 2, 2, 'F')
      txt('TEMAS TRABAJADOS', margin+4, 9, true, [109,40,217]); y += 10
      data.analisis.temas.forEach((t: string) => {
        checkY(8)
        doc.setFillColor(109,40,217); doc.circle(margin+7, y-2, 1.5, 'F')
        wrappedTxt(t, margin+12, 10, false, [60,50,100])
      })
      y += 4

      // Fortalezas
      checkY(20)
      doc.setFillColor(220,252,231)
      doc.roundedRect(margin, y-4, maxW, 6, 2, 2, 'F')
      txt('FORTALEZAS DETECTADAS', margin+4, 9, true, [22,163,74]); y += 10
      data.analisis.fortalezas.forEach((f: string) => {
        checkY(8)
        doc.setFillColor(22,163,74); doc.circle(margin+7, y-2, 1.5, 'F')
        wrappedTxt(f, margin+12, 10, false, [20,80,40])
      })
      y += 4

      // Áreas de refuerzo
      checkY(20)
      doc.setFillColor(255,237,213)
      doc.roundedRect(margin, y-4, maxW, 6, 2, 2, 'F')
      txt('ÁREAS DE REFUERZO', margin+4, 9, true, [234,88,12]); y += 10
      data.analisis.areas_refuerzo.forEach((a: string) => {
        checkY(8)
        doc.setFillColor(234,88,12); doc.circle(margin+7, y-2, 1.5, 'F')
        wrappedTxt(a, margin+12, 10, false, [120,60,20])
      })
      y += 4

      // Recomendaciones alumno
      checkY(20)
      doc.setFillColor(219,234,254)
      doc.roundedRect(margin, y-4, maxW, 6, 2, 2, 'F')
      txt('RECOMENDACIONES PARA EL ALUMNO', margin+4, 9, true, [37,99,235]); y += 10
      data.analisis.recomendaciones_alumno.forEach((r: string) => {
        checkY(8)
        doc.setFillColor(37,99,235); doc.circle(margin+7, y-2, 1.5, 'F')
        wrappedTxt(r, margin+12, 10, false, [20,50,120])
      })
      y += 4

      // Recomendaciones maestro
      checkY(20)
      doc.setFillColor(243,232,255)
      doc.roundedRect(margin, y-4, maxW, 6, 2, 2, 'F')
      txt('RECOMENDACIONES PARA EL MAESTRO', margin+4, 9, true, [109,40,217]); y += 10
      data.analisis.recomendaciones_maestro.forEach((r: string) => {
        checkY(8)
        doc.setFillColor(109,40,217); doc.circle(margin+7, y-2, 1.5, 'F')
        wrappedTxt(r, margin+12, 10, false, [60,20,120])
      })

      // HISTORIAL — última hoja
      addPage()
      doc.setFillColor(109,40,217)
      doc.rect(0, 0, W, 16, 'F')
      doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255)
      doc.text('HISTORIAL DE LA SESIÓN', margin, 11)
      y = 26

      mensajes.forEach((m: MensajeChat) => {
        if (m.id === 'bienvenida') return
        checkY(12)
        const esAlumno = m.rol === 'usuario'
        doc.setFillColor(esAlumno ? 237 : 255, esAlumno ? 233 : 255, esAlumno ? 254 : 255)
        const textLines = doc.splitTextToSize(m.contenido, maxW - 16)
        const boxH = textLines.length * 4.5 + 10
        checkY(boxH)
        doc.roundedRect(margin, y-5, maxW, boxH, 3, 3, 'F')
        doc.setFontSize(8); doc.setFont('helvetica','bold')
        doc.setTextColor(esAlumno ? 109 : 100, esAlumno ? 40 : 90, esAlumno ? 217 : 160)
        doc.text(esAlumno ? usuario.nombre_completo.split(' ')[0] : 'Owlaris Tutor', margin+4, y+1)
        doc.setFontSize(9); doc.setFont('helvetica','normal')
        doc.setTextColor(50,40,90)
        doc.text(textLines, margin+4, y+7)
        y += boxH + 4
      })

      // Footer en todas las páginas
      const totalPages = doc.getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)
        doc.setFillColor(248,247,255)
        doc.rect(0, 285, W, 12, 'F')
        doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(160,150,200)
        doc.text('Owlaris — Tu tutor académico inteligente · owlaris.app', margin, 291)
        doc.text(`Página ${i} de ${totalPages}`, W-margin, 291, { align:'right' })
      }

      const fecha = new Date().toISOString().split('T')[0]
      doc.save(`Owlaris-Reporte-${usuario.nombre_completo.replace(/ /g,'-')}-${fecha}.pdf`)

    } catch(e) { console.error(e) }
    finally { setGenerandoPDF(false) }
  }

  const mat      = materiasVisibles.find(m => m.id === materiaId)?.nombre
  const nombre   = usuario.nombre_completo.split(' ')[0]
  const iniciales = usuario.nombre_completo.split(' ').map((n: string) => n[0]).join('').substring(0,2).toUpperCase()

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=Syne:wght@600;700&display=swap');

        .owlaris-root {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: #F8F7FF;
          background-image:
            radial-gradient(ellipse at 0% 0%, rgba(109,40,217,.06) 0%, transparent 50%),
            radial-gradient(ellipse at 100% 100%, rgba(14,165,233,.05) 0%, transparent 50%);
          font-family: 'Plus Jakarta Sans', sans-serif;
        }

        .o-header {
          background: rgba(255,255,255,.85);
          backdrop-filter: blur(24px);
          border-bottom: 1px solid rgba(109,40,217,.08);
          box-shadow: 0 1px 24px rgba(109,40,217,.06);
          position: sticky; top: 0; z-index: 50;
          padding: 14px 24px;
        }

        .o-sel {
          background: #F3F0FF;
          border: 1px solid rgba(109,40,217,.15);
          color: #4C1D95;
          border-radius: 12px;
          padding: 8px 30px 8px 14px;
          font-size: 13px; font-weight: 600;
          appearance: none; cursor: pointer;
          transition: all .2s;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .o-sel:hover { border-color: rgba(109,40,217,.4); background: #EDE9FE; }
        .o-sel:focus { outline: none; border-color: #7C3AED; box-shadow: 0 0 0 3px rgba(109,40,217,.1); }
        .o-sel option { background: white; color: #1E1B4B; }

        .o-sel-mat {
          background: linear-gradient(135deg, #6D28D9, #7C3AED);
          border: none;
          color: white;
          border-radius: 12px;
          padding: 8px 30px 8px 14px;
          font-size: 13px; font-weight: 600;
          appearance: none; cursor: pointer;
          transition: all .2s;
          font-family: 'Plus Jakarta Sans', sans-serif;
          box-shadow: 0 4px 16px rgba(109,40,217,.25);
        }
        .o-sel-mat:hover { box-shadow: 0 6px 20px rgba(109,40,217,.35); }
        .o-sel-mat:focus { outline: none; }
        .o-sel-mat option { background: #4C1D95; color: white; }

        .bbl-tutor {
          background: white;
          border: 1px solid rgba(109,40,217,.1);
          border-radius: 4px 20px 20px 20px;
          box-shadow: 0 2px 20px rgba(109,40,217,.08);
          position: relative;
        }
        .bbl-tutor::before {
          content: '';
          position: absolute;
          top: 0; left: 0;
          width: 3px; height: 100%;
          background: linear-gradient(180deg, #7C3AED, #0EA5E9);
        }

        .bbl-user {
          background: linear-gradient(135deg, #6D28D9, #5B21B6);
          border-radius: 20px 4px 20px 20px;
          box-shadow: 0 4px 20px rgba(109,40,217,.3);
        }

        .o-chip {
          background: white;
          border: 1px solid rgba(109,40,217,.12);
          border-radius: 20px;
          padding: 8px 14px;
          font-size: 12px; font-weight: 500;
          color: #6D28D9;
          cursor: pointer;
          transition: all .2s;
          display: flex; align-items: center; gap: 5px;
          white-space: nowrap;
          font-family: 'Plus Jakarta Sans', sans-serif;
          box-shadow: 0 1px 8px rgba(109,40,217,.06);
        }
        .o-chip:hover {
          background: #F3F0FF;
          border-color: rgba(109,40,217,.3);
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(109,40,217,.15);
        }

        .o-input-wrap {
          background: white;
          border: 1.5px solid rgba(109,40,217,.15);
          border-radius: 18px;
          transition: all .2s;
          box-shadow: 0 2px 20px rgba(109,40,217,.06);
        }
        .o-input-wrap:focus-within {
          border-color: #7C3AED;
          box-shadow: 0 0 0 4px rgba(109,40,217,.08), 0 2px 20px rgba(109,40,217,.1);
        }

        .o-send {
          background: linear-gradient(135deg, #7C3AED, #6D28D9);
          border-radius: 14px; border: none; cursor: pointer;
          transition: all .2s;
          width: 46px; height: 46px;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 16px rgba(109,40,217,.3);
          flex-shrink: 0;
        }
        .o-send:hover { transform: scale(1.06); box-shadow: 0 6px 24px rgba(109,40,217,.45); }
        .o-send:disabled { opacity: .4; cursor: not-allowed; transform: none; box-shadow: none; }

        .o-dot {
          width: 7px; height: 7px;
          background: #7C3AED; border-radius: 50%;
          animation: oDot 1.4s infinite;
        }
        .o-dot:nth-child(2) { animation-delay: .2s; background: #9333EA; }
        .o-dot:nth-child(3) { animation-delay: .4s; background: #0EA5E9; }
        @keyframes oDot {
          0%,60%,100% { transform: translateY(0); opacity: .4; }
          30% { transform: translateY(-7px); opacity: 1; }
        }

        .o-float { animation: oFloat 4s ease-in-out infinite; }
        @keyframes oFloat {
          0%,100% { transform: translateY(0) rotate(-2deg); }
          50% { transform: translateY(-8px) rotate(2deg); }
        }

        .o-fade { animation: oFadeUp .35s ease forwards; }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes oFadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }

        .o-ver-mas {
          background: rgba(109,40,217,.06);
          border: 1px solid rgba(109,40,217,.15);
          border-radius: 8px; padding: 4px 12px;
          font-size: 11px; font-weight: 600;
          color: #7C3AED; cursor: pointer;
          transition: all .2s; margin-top: 10px;
          display: inline-flex; align-items: center; gap: 4px;
        }
        .o-ver-mas:hover { background: rgba(109,40,217,.12); }

        .o-fuente {
          display: inline-flex; align-items: center; gap: 4px;
          background: rgba(14,165,233,.06);
          border: 1px solid rgba(14,165,233,.15);
          border-radius: 6px; padding: 3px 9px;
          font-size: 10px; font-weight: 600;
          color: #0EA5E9; margin-top: 10px;
          letter-spacing: .3px;
        }

        .o-avatar-ring {
          background: linear-gradient(135deg, #7C3AED, #0EA5E9);
          padding: 2px; border-radius: 50%;
        }
      `}</style>

      <div className="owlaris-root">

        {/* Header */}
        <header className="o-header">
          <div style={{maxWidth:'900px',margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'16px'}}>

            {/* Logo */}
            <div style={{display:'flex',alignItems:'center',gap:'10px',flexShrink:0}}>
              <div className="o-avatar-ring" style={{width:'42px',height:'42px'}}>
                <div style={{background:'white',borderRadius:'50%',width:'38px',height:'38px',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <img src="/buho.png" alt="Owlaris" style={{width:'28px',height:'28px',objectFit:'contain'}}/>
                </div>
              </div>
              <div className="hidden sm:block">
                <p style={{fontFamily:"'Syne',sans-serif",fontSize:'16px',fontWeight:700,color:'#1E1B4B',letterSpacing:'-0.4px'}}>Owlaris</p>
                <p style={{fontSize:'11px',color:'#9490B8',fontWeight:500}}>Tu tutor académico</p>
              </div>
            </div>

            {/* Selectores */}
            <div style={{display:'flex',alignItems:'center',gap:'8px',flex:1,justifyContent:'center'}}>
              <div style={{position:'relative'}}>
                <select value={grado} onChange={e=>cambiarGrado(e.target.value)} disabled={guardandoGrado} className="o-sel">
                  {GRADOS_GUATEMALA.map(g=><option key={g} value={g}>{g}</option>)}
                </select>
                <span style={{position:'absolute',right:'9px',top:'50%',transform:'translateY(-50%)',color:'#7C3AED',pointerEvents:'none',fontSize:'9px'}}>▾</span>
              </div>
              <div style={{position:'relative'}}>
                <select value={materiaId} onChange={e=>setMateriaId(e.target.value)} className="o-sel-mat">
                  {materiasVisibles.map(m=><option key={m.id} value={m.id}>{m.nombre}</option>)}
                </select>
                <span style={{position:'absolute',right:'9px',top:'50%',transform:'translateY(-50%)',color:'rgba(255,255,255,.7)',pointerEvents:'none',fontSize:'9px'}}>▾</span>
              </div>
            </div>

            {/* Usuario */}
            <div style={{display:'flex',alignItems:'center',gap:'10px',flexShrink:0}}>
              <div className="hidden sm:block" style={{textAlign:'right'}}>
                <p style={{fontSize:'13px',fontWeight:600,color:'#1E1B4B'}}>{nombre}</p>
                <p style={{fontSize:'10px',color:'#9490B8'}}>{usuario.colegio?.nombre}</p>
              </div>
              <div style={{width:'36px',height:'36px',borderRadius:'50%',background:'linear-gradient(135deg,#7C3AED,#0EA5E9)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 12px rgba(109,40,217,.3)'}}>
                <span style={{fontSize:'13px',fontWeight:700,color:'white'}}>{iniciales}</span>
              </div>
              <button onClick={cerrarSesion} style={{background:'#F3F0FF',border:'1px solid rgba(109,40,217,.15)',borderRadius:'10px',padding:'7px 13px',fontSize:'12px',fontWeight:500,color:'#7C3AED',cursor:'pointer',display:'flex',alignItems:'center',gap:'5px',transition:'all .2s',fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
                <span>↩</span><span className="hidden sm:inline">Salir</span>
              </button>
            </div>
          </div>

          {/* Contexto */}
          <div style={{maxWidth:'900px',margin:'8px auto 0',textAlign:'center'}}>
            <p style={{fontSize:'11px',color:'#C4C0E0',letterSpacing:'.4px',fontWeight:500}}>
              Tutorando: <span style={{color:'#7C3AED',fontWeight:700}}>{nombre}</span>
              <span style={{margin:'0 8px',color:'#E0DCFF'}}>·</span>
              <span style={{color:'#B0ACCC'}}>{usuario.colegio?.nombre}</span>
              {guardandoGrado&&<span style={{marginLeft:'8px',color:'#C4C0E0'}}>Guardando...</span>}
            </p>
          </div>
        </header>

        {/* Mensajes */}
        <main style={{flex:1,overflowY:'auto',padding:'28px 16px'}} className="scrollbar-hide">
          <div style={{maxWidth:'800px',margin:'0 auto',display:'flex',flexDirection:'column',gap:'20px'}}>

            {mensajes.map((msg,idx)=>{
              const esU   = msg.rol==='usuario'
              const largo = msg.contenido.length > 350
              const abierto = expandido===msg.id
              return (
                <div key={msg.id} className="o-fade" style={{display:'flex',alignItems:'flex-start',gap:'10px',flexDirection:esU?'row-reverse':'row',animationDelay:`${idx*.05}s`}}>

                  {esU ? (
                    <div style={{width:'36px',height:'36px',borderRadius:'50%',background:'linear-gradient(135deg,#7C3AED,#5B21B6)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,boxShadow:'0 4px 12px rgba(109,40,217,.3)'}}>
                      <span style={{fontSize:'13px',fontWeight:700,color:'white'}}>{iniciales}</span>
                    </div>
                  ) : (
                    <div className="o-avatar-ring" style={{width:'36px',height:'36px',flexShrink:0}}>
                      <div style={{background:'white',borderRadius:'50%',width:'32px',height:'32px',display:'flex',alignItems:'center',justifyContent:'center'}}>
                        <img src="/buho.png" alt="" style={{width:'22px',height:'22px',objectFit:'contain'}}/>
                      </div>
                    </div>
                  )}

                  <div style={{maxWidth:'78%'}}>
                    <p style={{fontSize:'11px',fontWeight:600,color:esU?'#9490B8':'#B0ACCC',marginBottom:'5px',textAlign:esU?'right':'left',letterSpacing:'.3px',textTransform:'uppercase'}}>
                      {esU ? nombre : 'Owlaris Tutor'}
                    </p>

                    <div className={esU?'bbl-user':'bbl-tutor'} style={{padding:'14px 18px'}}>
                      <p style={{fontSize:'14px',lineHeight:'1.8',color:esU?'#EDE9FE':'#2D2B55',whiteSpace:'pre-wrap',fontWeight:400}}>
                        {largo&&!abierto?<>{renderTexto(msg.contenido.substring(0,300))}...</>:renderTexto(msg.contenido)}
                      </p>
                      {largo&&(
                        <button className="o-ver-mas" onClick={()=>setExpandido(abierto?null:msg.id)}>
                          {abierto?'↑ Ver menos':'↓ Ver explicación completa'}
                        </button>
                      )}
                      {msg.documento_fuente&&(
                        <div className="o-fuente">
                          <span>◈</span><span>{msg.documento_fuente}</span>
                        </div>
                      )}
                    </div>

                    <p style={{fontSize:'10px',color:'#C4C0E0',marginTop:'4px',textAlign:esU?'right':'left',fontWeight:500}}>
                      {msg.timestamp.toLocaleTimeString('es-GT',{hour:'2-digit',minute:'2-digit'})}
                    </p>
                  </div>
                </div>
              )
            })}

            {cargando&&(
              <div className="o-fade" style={{display:'flex',alignItems:'flex-start',gap:'10px'}}>
                <div className="o-avatar-ring" style={{width:'36px',height:'36px',flexShrink:0}}>
                  <div style={{background:'white',borderRadius:'50%',width:'32px',height:'32px',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <img src="/buho.png" alt="" style={{width:'22px',height:'22px',objectFit:'contain'}}/>
                  </div>
                </div>
                <div className="bbl-tutor" style={{padding:'16px 22px'}}>
                  <div style={{display:'flex',gap:'5px',alignItems:'center'}}>
                    <div className="o-dot"/><div className="o-dot"/><div className="o-dot"/>
                  </div>
                </div>
              </div>
            )}

            {error&&(
              <div style={{background:'rgba(239,68,68,.05)',border:'1px solid rgba(239,68,68,.15)',borderRadius:'14px',padding:'12px 16px',textAlign:'center'}}>
                <p style={{fontSize:'13px',color:'#EF4444',fontWeight:500}}>{error}</p>
              </div>
            )}
            <div ref={finalRef}/>
          </div>
        </main>

        {/* Footer */}
        <div style={{background:'rgba(248,247,255,.95)',backdropFilter:'blur(20px)',borderTop:'1px solid rgba(109,40,217,.08)',padding:'12px 16px 20px',boxShadow:'0 -4px 24px rgba(109,40,217,.06)'}}>
          <div style={{maxWidth:'800px',margin:'0 auto'}}>

            {sugerencias.length>0&&(
              <div style={{display:'flex',gap:'8px',marginBottom:'10px',overflowX:'auto'}} className="scrollbar-hide">
                {sugerencias.map((s,i)=>(
                  <button key={i} className="o-chip" onClick={()=>enviarPregunta(s.text)}>
                    <span style={{color:'#7C3AED',fontSize:'14px'}}>{s.icon}</span>
                    <span>{s.text}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="o-input-wrap" style={{display:'flex',gap:'10px',alignItems:'flex-end',padding:'10px 14px'}}>
              <textarea ref={inputRef} value={pregunta}
                onChange={e=>setPregunta(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();enviarPregunta()}}}
                placeholder={`Escribe tu duda sobre ${mat||'la materia'}...`}
                rows={2} disabled={cargando}
                style={{flex:1,background:'transparent',border:'none',outline:'none',resize:'none',fontSize:'14px',color:'#1E1B4B',lineHeight:'1.6',fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:400}}
              />
              <button onClick={()=>enviarPregunta()} disabled={cargando||!pregunta.trim()} className="o-send">
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                </svg>
              </button>
            </div>

            <p style={{fontSize:'10px',color:'#D4D0EE',textAlign:'center',letterSpacing:'.4px',fontWeight:500}}>
              Owlaris te guía para que aprendas — no hace tu tarea por ti
            </p>
          </div>
        </div>

        {/* Búho flotante */}
        <div className="o-float" style={{position:'fixed',bottom:'24px',left:'24px',zIndex:40,pointerEvents:'none'}}>
          <img src="/buho.png" alt="" style={{width:'64px',height:'64px',objectFit:'contain',filter:'drop-shadow(0 8px 24px rgba(109,40,217,.25))'}}/>
        </div>

      </div>
    </>
  )
}

// Este comentario marca el fin del componente — no ejecutar
