'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Usuario, Materia, MensajeChat } from '@/types'

interface Props {
  usuario: Usuario
  materias: Materia[]
  materiasDisponibles?: string[]
}

type EstadoChat = 'esperando_nombre' | 'esperando_confirmacion_grado' | 'esperando_grado' | 'esperando_materia' | 'esperando_materia_olimpiadas' | 'esperando_confirmacion_cambio_materia' | 'activo'

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
    let lastIndex = 0; let key = 0; let match
    const mdLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g
    while ((match = mdLinkRegex.exec(linea)) !== null) {
      if (match.index > lastIndex) segmentos.push(...renderSegmento(linea.slice(lastIndex, match.index), key++))
      segmentos.push(<a key={key++} href={match[2]} target="_blank" rel="noopener noreferrer" style={{color:'#6D28D9',textDecoration:'underline'}}>{match[2]}</a>)
      lastIndex = match.index + match[0].length
    }
    if (lastIndex < linea.length) {
      const resto = linea.slice(lastIndex)
      const urlRegex = /(https?:\/\/\S+)/g
      let lastUrl = 0; let urlMatch
      while ((urlMatch = urlRegex.exec(resto)) !== null) {
        if (urlMatch.index > lastUrl) segmentos.push(...renderSegmento(resto.slice(lastUrl, urlMatch.index), key++))
        segmentos.push(<a key={key++} href={urlMatch[1]} target="_blank" rel="noopener noreferrer" style={{color:'#6D28D9',textDecoration:'underline'}}>{urlMatch[1]}</a>)
        lastUrl = urlMatch.index + urlMatch[0].length
      }
      if (lastUrl < resto.length) segmentos.push(...renderSegmento(resto.slice(lastUrl), key++))
    }
    return <span key={lineaIdx}>{segmentos.length > 0 ? segmentos : linea}{lineaIdx < lineas.length - 1 && <br />}</span>
  })
}

export default function ChatInterface({ usuario, materiasDisponibles: materiasIniciales = [] }: Props) {
  const [mensajes, setMensajes]         = useState<MensajeChat[]>([])
  const [pregunta, setPregunta]         = useState('')
  const [cargando, setCargando]         = useState(false)
  const [error, setError]               = useState('')
  const [sugerencias, setSugerencias]   = useState<{icon:string;text:string}[]>([])
  const [expandido, setExpandido]       = useState<string | null>(null)
  const [generandoPDF, setGenerandoPDF]       = useState(false)
  const [nivelDificultad, setNivelDificultad] = useState(1)
  const [aciertosConsec, setAciertosConsec]   = useState(0)
  const [materiaSugerida, setMateriaSugerida] = useState('')
  const TRAD_MATERIAS: Record<string,string> = {
    'Matemática':'Mathematics','Física':'Physics','Química':'Chemistry',
    'Biología':'Biology','Historia':'History','Español':'Spanish',
    'Inglés':'English','Ciencias Naturales':'Natural Sciences',
    'Mineduc - Lenguaje':'Mineduc - Language','Mineduc - Matemática':'Mineduc - Mathematics',
    'Olimpiadas de Ciencias':'Science Olympiad',
    '» Conversar en Inglés':'» English Conversation',
  }
  const traducirChips = (chips: string[], enIngles: boolean) =>
    chips.map(m => enIngles ? (TRAD_MATERIAS[m] || m) : m)
  const [chipsMateria, setChipsMateria] = useState<string[]>(materiasIniciales)
  const [mostrandoSubOlimpiadas, setMostrandoSubOlimpiadas] = useState(false)
  const [idiomaIngles, setIdiomaIngles]       = useState(false)
  const [modoConversacion, setModoConversacion] = useState(false)
  const [grabando, setGrabando]               = useState(false)
  const [reproduciendo, setReproduciendo]     = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef   = useRef<Blob[]>([])
  const audioRef         = useRef<HTMLAudioElement | null>(null)

  // Estado onboarding
  const gradoGuardado = usuario.grado || ''
  const estadoInicial: EstadoChat = gradoGuardado ? 'esperando_materia' : 'esperando_nombre'
  const [estadoChat, setEstadoChat]       = useState<EstadoChat>(estadoInicial)
  const [nombreAlumno, setNombreAlumno]   = useState('')
  const [gradoAlumno, setGradoAlumno]     = useState('')
  const [materiaAlumno, setMateriaAlumno] = useState('')

  const finalRef = useRef<HTMLDivElement>(null)
  const materiasDisponiblesRef = useRef<string[]>([])
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const router   = useRouter()
  const supabase = createClient()

  const iniciales = usuario.nombre_completo.split(' ').map((n:string) => n[0]).join('').substring(0,2).toUpperCase()

  useEffect(() => { finalRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [mensajes, cargando])

  // Cargar materias desde API al iniciar si hay grado guardado
  useEffect(() => {
    if (!gradoGuardado) return
    fetch('/api/preguntar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pregunta: '__CARGAR_MATERIAS__',
        estado: 'esperando_materia',
        grado_override: gradoGuardado,
        user_id: usuario.id,
        idioma_ingles: idiomaIngles,
        nombre_alumno: usuario.nombre_completo.split(' ')[0],
      })
    }).then(r => r.json()).then(data => {
      if (data.materias_disponibles) {
        materiasDisponiblesRef.current = data.materias_disponibles
        setChipsMateria(data.materias_disponibles)
      }
    }).catch(() => {})
  }, [gradoGuardado, idiomaIngles])

  useEffect(() => {
    const nombre = usuario.nombre_completo.split(' ')[0]
    const msg = gradoGuardado
      ? (idiomaIngles
          ? `Hi, ${nombre}! What do you want to study today?`
          : `¡Hola, ${nombre}! ¿Qué quieres estudiar hoy?`)
      : (idiomaIngles
          ? "Hi! I'm Owlaris, your intelligent academic tutor. What's your name?"
          : '¡Hola! Soy Owlaris, tu tutor académico inteligente. ¿Cómo te llamas?')
    setMensajes([{
      id: 'bienvenida',
      rol: 'asistente',
      contenido: msg,
      timestamp: new Date(),
    }])
    if (gradoGuardado) setNombreAlumno(nombre)
  }, [idiomaIngles])

  // Traducir chips cuando cambia idioma
  useEffect(() => {
    if (materiasIniciales.length > 0) {
      setChipsMateria(traducirChips(materiasIniciales, idiomaIngles))
    }
  }, [idiomaIngles])

  async function enviarPregunta(texto?: string) {
    const tp = (texto || pregunta).trim()
    if (!tp || cargando) return
    setPregunta(''); setError(''); setSugerencias([])

    const msgU: MensajeChat = { id: Date.now().toString(), rol: 'usuario', contenido: tp, timestamp: new Date() }
    setMensajes(prev => [...prev, msgU])
    setCargando(true)

    try {
      const res = await fetch('/api/preguntar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pregunta: tp,
          estado: estadoChat,
          nombre_alumno: nombreAlumno,
          grado_override: gradoAlumno || gradoGuardado,
          materia_id: materiaAlumno,
          historial: mensajes.slice(-6).map(m => ({ rol: m.rol, contenido: m.contenido })),
          user_id: usuario.id,
          materia_sugerida: materiaSugerida,
          materias_disponibles: materiasDisponiblesRef.current,
          idioma_ingles: idiomaIngles,
          modo_conversacion: modoConversacion,
          nivel_dificultad: nivelDificultad,
          aciertos_consecutivos: aciertosConsec,
        })
      })
      if (!res.ok) throw new Error()
      const data = await res.json()

      // Actualizar estado onboarding
      if (data.nuevo_estado) setEstadoChat(data.nuevo_estado)
      if (data.nombre_alumno) setNombreAlumno(data.nombre_alumno)
      if (data.grado_detectado) {
        setGradoAlumno(data.grado_detectado)
        // Guardar grado desde el frontend donde sí hay sesión activa
        supabase.from('usuarios').update({ grado: data.grado_detectado }).eq('id', usuario.id)
      }
      if (data.materia_detectada) setMateriaAlumno(data.materia_detectada)
      if (data.activar_conversacion) { setModoConversacion(true); setIdiomaIngles(true) }
      if (data.nivel_dificultad) setNivelDificultad(data.nivel_dificultad)
      if (data.materias_disponibles) {
        materiasDisponiblesRef.current = data.materias_disponibles
        setChipsMateria(traducirChips(data.materias_disponibles, idiomaIngles))
        setMostrandoSubOlimpiadas(false)
      }
      if (data.aciertos_consecutivos !== undefined) setAciertosConsec(data.aciertos_consecutivos)
      if (data.materia_sugerida) setMateriaSugerida(data.materia_sugerida)
      if (data.nuevo_estado && data.nuevo_estado !== 'esperando_confirmacion_cambio_materia') setMateriaSugerida('')

      setMensajes(prev => [...prev, {
        id: (Date.now()+1).toString(),
        rol: 'asistente',
        contenido: data.respuesta,
        timestamp: new Date(),
        documento_fuente: data.documento_fuente,
      }])
      // TTS en modo conversación
      if (modoConversacion && data.respuesta) {
        reproducirTTS(data.respuesta)
      }

      // Sugerencias solo cuando está activo
      if (data.nuevo_estado === 'activo' || estadoChat === 'activo') {
        const mat = data.materia_detectada || materiaAlumno
        setSugerencias(idiomaIngles ? [
          { icon: '✦', text: 'Explain with an example' },
          { icon: '◈', text: 'I want to practice' },
          { icon: '◇', text: 'Summarize the topic' },
          { icon: '↺', text: 'Suggest another topic in ' + (mat || 'the subject') },
        ] : [
          { icon: '✦', text: 'Explícame con un ejemplo' },
          { icon: '◈', text: 'Quiero practicar' },
          { icon: '◇', text: 'Resume el tema' },
          { icon: '↺', text: 'Propón otro tema de ' + (mat || 'la materia') },
        ])
      }
    } catch { setError('Hubo un problema. Intenta de nuevo.') }
    finally { setCargando(false); inputRef.current?.focus() }
  }

  async function reproducirTTS(texto: string) {
    if (!modoConversacion) return
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto }),
      })
      if (!res.ok) return
      const arrayBuffer = await res.arrayBuffer()
      
      // Usar AudioContext para compatibilidad con Safari
      const AudioCtx = window.AudioContext || (window as unknown as {webkitAudioContext: typeof AudioContext}).webkitAudioContext
      const ctx = new AudioCtx()
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
      const source = ctx.createBufferSource()
      source.buffer = audioBuffer
      source.connect(ctx.destination)
      source.onended = () => { setReproduciendo(false); ctx.close() }
      setReproduciendo(true)
      source.start(0)
    } catch { setReproduciendo(false) }
  }

  async function toggleGrabacion() {
    if (grabando) {
      // Detener grabación
      mediaRecorderRef.current?.stop()
      setGrabando(false)
    } else {
      // Iniciar grabación
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
        audioChunksRef.current = []
        mr.ondataavailable = e => audioChunksRef.current.push(e.data)
        mr.onstop = async () => {
          stream.getTracks().forEach(t => t.stop())
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
          const fd   = new FormData()
          fd.append('audio', blob, 'audio.webm')
          try {
            const res  = await fetch('/api/transcribir', { method: 'POST', body: fd })
            const data = await res.json()
            if (data.texto?.trim()) enviarPregunta(data.texto)
          } catch { setError('No se pudo transcribir el audio.') }
        }
        mr.start()
        mediaRecorderRef.current = mr
        setGrabando(true)
      } catch { setError('No se pudo acceder al micrófono.') }
    }
  }

  async function cerrarSesion() {
    await supabase.auth.signOut(); router.push('/login'); router.refresh()
  }

  async function generarReporte() {
    if (mensajes.length < 3) return
    setGenerandoPDF(true)
    try {
      const res = await fetch('/api/reporte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          historial: mensajes.map(m => ({ rol: m.rol, contenido: m.contenido })),
          grado: gradoAlumno, materia: materiaAlumno, colegio: usuario.colegio?.nombre
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
        doc.setFontSize(size); doc.setFont('helvetica', bold ? 'bold' : 'normal')
        doc.setTextColor(color[0], color[1], color[2]); doc.text(text, x, y)
      }
      const wrappedTxt = (text: string, x: number, size: number, bold = false, color = [80,80,100]) => {
        doc.setFontSize(size); doc.setFont('helvetica', bold ? 'bold' : 'normal')
        doc.setTextColor(color[0], color[1], color[2])
        const lines = doc.splitTextToSize(text, maxW - (x - margin))
        checkY(lines.length * (size * 0.4 + 1))
        doc.text(lines, x, y); y += lines.length * (size * 0.4 + 1) + 2
      }
      doc.setFillColor(109, 40, 217); doc.rect(0, 0, W, 60, 'F')
      doc.setFillColor(124, 58, 237); doc.rect(0, 55, W, 8, 'F')
      doc.setFontSize(28); doc.setFont('helvetica', 'bold'); doc.setTextColor(255,255,255)
      doc.text('Owlaris', margin, 28)
      doc.setFontSize(13); doc.setFont('helvetica', 'normal'); doc.text('Reporte de Sesión Académica', margin, 38)
      doc.setFontSize(10); doc.text(usuario.colegio?.nombre || '', margin, 48)
      y = 80
      const nivelColor: Record<string,number[]> = { 'Excelente':[22,163,74],'Bueno':[37,99,235],'En proceso':[234,88,12],'Necesita refuerzo':[220,38,38] }
      const nc = nivelColor[data.analisis.nivel] || [109,40,217]
      doc.setFillColor(248,247,255); doc.roundedRect(margin, y-5, maxW, 42, 4, 4, 'F')
      doc.setDrawColor(109,40,217); doc.setLineWidth(0.5); doc.roundedRect(margin, y-5, maxW, 42, 4, 4, 'S')
      txt('Alumno:', margin+6, 10, true, [109,40,217]); y += 7
      txt(nombreAlumno || usuario.nombre_completo, margin+6, 12, false, [30,27,75]); y += 7
      const msgsConFecha = mensajes.filter((m: MensajeChat) => m.timestamp)
      let durStr = ''
      if (msgsConFecha.length >= 2) {
        const ini = new Date(msgsConFecha[0].timestamp).getTime()
        const fin = new Date(msgsConFecha[msgsConFecha.length-1].timestamp).getTime()
        const mins = Math.round((fin - ini) / 60000)
        durStr = mins <= 1 ? '1 min' : mins + ' minutos'
      }
      txt(`Grado: ${gradoAlumno}   |   Materia: ${materiaAlumno}   |   Fecha: ${new Date().toLocaleDateString('es-GT')}${durStr ? '   |   Duración: ' + durStr : ''}`, margin+6, 9, false, [120,110,160]); y += 7
      doc.setFillColor(nc[0],nc[1],nc[2]); doc.roundedRect(margin+6, y-4, 60, 10, 3, 3, 'F')
      doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255)
      doc.text(`Nivel: ${data.analisis.nivel}`, margin+10, y+2); y += 16
      y += 6
      doc.setFillColor(237,233,254); doc.roundedRect(margin, y-4, maxW, 6, 2, 2, 'F')
      txt('RESUMEN DE LA SESIÓN', margin+4, 9, true, [109,40,217]); y += 10
      wrappedTxt(data.analisis.resumen, margin+4, 10, false, [60,50,100]); y += 4
      const secciones = [
        { titulo: 'TEMAS TRABAJADOS', items: data.analisis.temas, bg:[237,233,254], c:[109,40,217], tc:[60,50,100] },
        { titulo: 'FORTALEZAS DETECTADAS', items: data.analisis.fortalezas, bg:[220,252,231], c:[22,163,74], tc:[20,80,40] },
        { titulo: 'ÁREAS DE REFUERZO', items: data.analisis.areas_refuerzo, bg:[255,237,213], c:[234,88,12], tc:[120,60,20] },
        { titulo: 'RECOMENDACIONES PARA EL ALUMNO', items: data.analisis.recomendaciones_alumno, bg:[219,234,254], c:[37,99,235], tc:[20,50,120] },
        { titulo: 'RECOMENDACIONES PARA EL MAESTRO', items: data.analisis.recomendaciones_maestro, bg:[243,232,255], c:[109,40,217], tc:[60,20,120] },
      ]
      for (const s of secciones) {
        checkY(20)
        doc.setFillColor(s.bg[0],s.bg[1],s.bg[2]); doc.roundedRect(margin, y-4, maxW, 6, 2, 2, 'F')
        txt(s.titulo, margin+4, 9, true, s.c); y += 10
        for (const item of s.items) {
          checkY(8); doc.setFillColor(s.c[0],s.c[1],s.c[2]); doc.circle(margin+7, y-2, 1.5, 'F')
          wrappedTxt(item, margin+12, 10, false, s.tc)
        }
        y += 4
      }
      addPage()
      doc.setFillColor(109,40,217); doc.rect(0, 0, W, 16, 'F')
      doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255)
      doc.text('HISTORIAL DE LA SESIÓN', margin, 11); y = 26
      for (const m of mensajes) {
        if (m.id === 'bienvenida') continue
        const esAlumno = m.rol === 'usuario'
        const textLines = doc.splitTextToSize(m.contenido, maxW - 16)
        const boxH = textLines.length * 4.5 + 10
        checkY(boxH)
        doc.setFillColor(esAlumno ? 237 : 255, esAlumno ? 233 : 255, esAlumno ? 254 : 255)
        doc.roundedRect(margin, y-5, maxW, boxH, 3, 3, 'F')
        doc.setFontSize(8); doc.setFont('helvetica','bold')
        doc.setTextColor(esAlumno ? 109 : 100, esAlumno ? 40 : 90, esAlumno ? 217 : 160)
        doc.text(esAlumno ? (nombreAlumno || usuario.nombre_completo.split(' ')[0]) : 'Owlaris Tutor', margin+4, y+1)
        doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(50,40,90)
        doc.text(textLines, margin+4, y+7); y += boxH + 4
      }
      const totalPages = doc.getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i); doc.setFillColor(248,247,255); doc.rect(0, 285, W, 12, 'F')
        doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(160,150,200)
        doc.text('Owlaris — Tu tutor académico inteligente · owlaris.app', margin, 291)
        doc.text(`Página ${i} de ${totalPages}`, W-margin, 291, { align:'right' })
      }
      const fecha = new Date().toISOString().split('T')[0]
      doc.save(`Owlaris-Reporte-${(nombreAlumno||usuario.nombre_completo).replace(/ /g,'-')}-${fecha}.pdf`)
    } catch(e) { console.error(e) }
    finally { setGenerandoPDF(false) }
  }

  const placeholder = idiomaIngles
    ? (estadoChat === 'esperando_nombre' ? 'Write your name...' :
       estadoChat === 'esperando_confirmacion_grado' ? 'Write yes or no...' :
       estadoChat === 'esperando_grado' ? 'Write your grade...' :
       estadoChat === 'esperando_materia' || estadoChat === 'esperando_materia_olimpiadas' ? 'What subject do you want to study?' :
       `Write your question about ${materiaAlumno || 'the subject'}...`)
    : (estadoChat === 'esperando_nombre' ? 'Escribe tu nombre...' :
       estadoChat === 'esperando_confirmacion_grado' ? 'Escribe si o no...' :
       estadoChat === 'esperando_grado'  ? 'Escribe tu grado...' :
       estadoChat === 'esperando_materia' || estadoChat === 'esperando_materia_olimpiadas' ? '¿Qué materia quieres estudiar?' :
       `Escribe tu duda sobre ${materiaAlumno || 'la materia'}...`)

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=Syne:wght@700;800&display=swap');
        .owlaris-root { min-height:100vh; display:flex; flex-direction:column; background:#F8F7FF; background-image:radial-gradient(ellipse at 15% 0%,rgba(109,40,217,.06) 0%,transparent 55%),radial-gradient(ellipse at 85% 100%,rgba(14,165,233,.05) 0%,transparent 50%); font-family:'Plus Jakarta Sans',sans-serif; }
        .o-header { background:rgba(255,255,255,.88); backdrop-filter:blur(24px); border-bottom:1px solid rgba(109,40,217,.08); box-shadow:0 1px 24px rgba(109,40,217,.06); position:sticky; top:0; z-index:50; padding:14px 24px; }
        .bbl-tutor { background:white; border:1px solid rgba(109,40,217,.1); border-radius:4px 20px 20px 20px; box-shadow:0 2px 20px rgba(109,40,217,.08); position:relative; }
        .bbl-tutor::before { content:''; position:absolute; top:0; left:0; width:3px; height:100%; background:linear-gradient(180deg,#7C3AED,#0EA5E9); }
        .bbl-user { background:linear-gradient(135deg,#6D28D9,#5B21B6); border-radius:20px 4px 20px 20px; box-shadow:0 4px 20px rgba(109,40,217,.3); }
        .o-chip { background:white; border:1px solid rgba(109,40,217,.12); border-radius:20px; padding:8px 14px; font-size:12px; font-weight:500; color:#6D28D9; cursor:pointer; transition:all .2s; display:flex; align-items:center; gap:5px; white-space:nowrap; font-family:'Plus Jakarta Sans',sans-serif; box-shadow:0 1px 8px rgba(109,40,217,.06); }
        .o-chip:hover { background:#F3F0FF; border-color:rgba(109,40,217,.3); transform:translateY(-2px); box-shadow:0 4px 16px rgba(109,40,217,.15); }
        .o-input-wrap { background:white; border:1.5px solid rgba(109,40,217,.15); border-radius:18px; transition:all .2s; box-shadow:0 2px 20px rgba(109,40,217,.06); }
        .o-input-wrap:focus-within { border-color:#7C3AED; box-shadow:0 0 0 4px rgba(109,40,217,.08),0 2px 20px rgba(109,40,217,.1); }
        .o-send { background:linear-gradient(135deg,#7C3AED,#6D28D9); border-radius:14px; border:none; cursor:pointer; transition:all .2s; width:46px; height:46px; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 16px rgba(109,40,217,.3); flex-shrink:0; }
        .o-send:hover { transform:scale(1.06); box-shadow:0 6px 24px rgba(109,40,217,.45); }
        .o-send:disabled { opacity:.4; cursor:not-allowed; transform:none; box-shadow:none; }
        .o-dot { width:7px; height:7px; background:#7C3AED; border-radius:50%; animation:oDot 1.4s infinite; }
        .o-dot:nth-child(2){animation-delay:.2s;background:#9333EA} .o-dot:nth-child(3){animation-delay:.4s;background:#0EA5E9}
        @keyframes oDot { 0%,60%,100%{transform:translateY(0);opacity:.4} 30%{transform:translateY(-7px);opacity:1} }
        .o-float { animation:oFloat 4s ease-in-out infinite; }
        @keyframes oFloat { 0%,100%{transform:translateY(0) rotate(-2deg)} 50%{transform:translateY(-8px) rotate(2deg)} }
        .o-fade { animation:oFadeUp .35s ease forwards; }
        @keyframes oFadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        .scrollbar-hide::-webkit-scrollbar{display:none} .scrollbar-hide{-ms-overflow-style:none;scrollbar-width:none}
        .o-ver-mas { background:rgba(109,40,217,.06); border:1px solid rgba(109,40,217,.15); border-radius:8px; padding:4px 12px; font-size:11px; font-weight:600; color:#7C3AED; cursor:pointer; transition:all .2s; margin-top:10px; display:inline-flex; align-items:center; gap:4px; }
        .o-ver-mas:hover{background:rgba(109,40,217,.12)}
        .o-fuente { display:inline-flex; align-items:center; gap:4px; background:rgba(14,165,233,.06); border:1px solid rgba(14,165,233,.15); border-radius:6px; padding:3px 9px; font-size:10px; font-weight:600; color:#0EA5E9; margin-top:10px; letter-spacing:.3px; }
        .o-avatar-ring { background:linear-gradient(135deg,#7C3AED,#0EA5E9); padding:2px; border-radius:50%; }
        .estado-badge { display:inline-flex; align-items:center; gap:6px; background:rgba(109,40,217,.08); border:1px solid rgba(109,40,217,.15); border-radius:20px; padding:4px 12px; font-size:11px; font-weight:600; color:#7C3AED; }
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      `}</style>

      <div className="owlaris-root">
        {/* Header */}
        <header className="o-header">
          <div style={{maxWidth:'900px',margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'16px'}}>
            <div style={{display:'flex',alignItems:'center',gap:'10px',flexShrink:0}}>
              <div className="o-avatar-ring" style={{width:'42px',height:'42px'}}>
                <div style={{background:'white',borderRadius:'50%',width:'38px',height:'38px',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <img src="/buho.png" alt="Owlaris" style={{width:'28px',height:'28px',objectFit:'contain'}}/>
                </div>
              </div>
              <div className="hidden sm:block">
                <p style={{fontFamily:"'Syne',sans-serif",fontSize:'16px',fontWeight:700,color:'#1E1B4B',letterSpacing:'-0.4px'}}>Owlaris</p>
                <p style={{fontSize:'11px',color:'#9490B8',fontWeight:500}}>{idiomaIngles ? 'Your academic tutor' : 'Tu tutor académico'}</p>
              </div>
              <button onClick={()=>{setIdiomaIngles(!idiomaIngles); if(modoConversacion) setModoConversacion(false)}}
                style={{background:idiomaIngles?'linear-gradient(135deg,#1d4ed8,#1e40af)':'#F3F0FF',border:idiomaIngles?'none':'1px solid rgba(109,40,217,.2)',borderRadius:'10px',padding:'6px 12px',fontSize:'12px',fontWeight:700,color:idiomaIngles?'white':'#7C3AED',cursor:'pointer',display:'flex',alignItems:'center',gap:'5px',transition:'all .2s',flexShrink:0}}>
                {idiomaIngles ? '🇬🇧 EN' : '🇬🇧 EN'}
              </button>
            </div>

            {/* Estado actual */}
            <div style={{display:'flex',alignItems:'center',gap:'8px',flex:1,justifyContent:'center',flexWrap:'wrap'}}>
              {nombreAlumno && <span className="estado-badge">👤 {nombreAlumno}</span>}
              {gradoAlumno  && <span className="estado-badge">🎓 {gradoAlumno}</span>}
              {materiaAlumno && <span className="estado-badge">📚 {materiaAlumno}</span>}
            </div>

            <div style={{display:'flex',alignItems:'center',gap:'10px',flexShrink:0}}>
              <div className="hidden sm:block" style={{textAlign:'right'}}>
                <p style={{fontSize:'13px',fontWeight:600,color:'#1E1B4B'}}>{usuario.nombre_completo.split(' ')[0]}</p>
                <p style={{fontSize:'10px',color:'#9490B8'}}>{usuario.colegio?.nombre}</p>
              </div>
              <div style={{width:'36px',height:'36px',borderRadius:'50%',background:'linear-gradient(135deg,#7C3AED,#0EA5E9)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 12px rgba(109,40,217,.3)'}}>
                <span style={{fontSize:'13px',fontWeight:700,color:'white'}}>{iniciales}</span>
              </div>
              <button onClick={cerrarSesion} style={{background:'#F3F0FF',border:'1px solid rgba(109,40,217,.15)',borderRadius:'10px',padding:'7px 13px',fontSize:'12px',fontWeight:500,color:'#7C3AED',cursor:'pointer',display:'flex',alignItems:'center',gap:'5px',fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
                <span>↩</span><span className="hidden sm:inline">Salir</span>
              </button>
            </div>
          </div>
        </header>

        {/* Mensajes */}
        <main style={{flex:1,overflowY:'auto',padding:'28px 16px'}} className="scrollbar-hide">
          <div style={{maxWidth:'800px',margin:'0 auto',display:'flex',flexDirection:'column',gap:'20px'}}>
            {mensajes.map((msg,idx) => {
              const esU = msg.rol === 'usuario'
              const largo = msg.contenido.length > 350
              const abierto = expandido === msg.id
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
                      {esU ? (nombreAlumno || usuario.nombre_completo.split(' ')[0]) : 'Owlaris Tutor'}
                    </p>
                    <div className={esU?'bbl-user':'bbl-tutor'} style={{padding:'14px 18px'}}>
                      <p style={{fontSize:'14px',lineHeight:'1.8',color:esU?'#EDE9FE':'#2D2B55',whiteSpace:'pre-wrap',fontWeight:400}}>
                        {largo&&!abierto?<>{renderTexto(msg.contenido.substring(0,300))}...</>:renderTexto(msg.contenido)}
                      </p>
                      {largo&&<button className="o-ver-mas" onClick={()=>setExpandido(abierto?null:msg.id)}>{abierto ? (idiomaIngles ? '↑ Show less' : '↑ Ver menos') : (idiomaIngles ? '↓ Show full explanation' : '↓ Ver explicación completa')}</button>}
                      {msg.documento_fuente&&<div className="o-fuente"><span>◈</span><span>{msg.documento_fuente}</span></div>}
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
                  <div style={{display:'flex',gap:'5px',alignItems:'center'}}><div className="o-dot"/><div className="o-dot"/><div className="o-dot"/></div>
                </div>
              </div>
            )}

            {error&&<div style={{background:'rgba(239,68,68,.05)',border:'1px solid rgba(239,68,68,.15)',borderRadius:'14px',padding:'12px 16px',textAlign:'center'}}><p style={{fontSize:'13px',color:'#EF4444',fontWeight:500}}>{error}</p></div>}
            <div ref={finalRef}/>
          </div>
        </main>

        {/* Footer */}
        <div style={{background:'rgba(248,247,255,.95)',backdropFilter:'blur(20px)',borderTop:'1px solid rgba(109,40,217,.08)',padding:'12px 16px 20px',boxShadow:'0 -4px 24px rgba(109,40,217,.06)'}}>
          <div style={{maxWidth:'800px',margin:'0 auto'}}>
            {/* CHIPS DE MATERIAS */}
            {(estadoChat === 'esperando_materia' || estadoChat === 'esperando_materia_olimpiadas') && chipsMateria.length > 0 && (
              <div style={{marginBottom:'12px'}}>
                <p style={{fontSize:'11px',color:'#9490B8',fontWeight:600,marginBottom:'8px',letterSpacing:'.3px',textTransform:'uppercase'}}>
                  {idiomaIngles ? 'Choose a subject:' : 'Elige una materia:'}
                </p>
                {!mostrandoSubOlimpiadas ? (
                  <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                    {chipsMateria.map((mat, i) => {
                      const esOlimpiadas = mat.toLowerCase().includes('olimpiadas') || mat.toLowerCase().includes('olympiad')
                      const esIngles = mat.includes('Conversar') || mat.includes('Conversation') || mat.includes('»')
                      const colores: Record<string,string> = {
                        'Matemática':'linear-gradient(135deg,#7C3AED,#5B21B6)',
                        'Matematica':'linear-gradient(135deg,#7C3AED,#5B21B6)',
                        'Mathematics':'linear-gradient(135deg,#7C3AED,#5B21B6)',
                        'Física':'linear-gradient(135deg,#0EA5E9,#0284C7)',
                        'Physics':'linear-gradient(135deg,#0EA5E9,#0284C7)',
                        'Química':'linear-gradient(135deg,#10B981,#059669)',
                        'Chemistry':'linear-gradient(135deg,#10B981,#059669)',
                        'Biología':'linear-gradient(135deg,#22C55E,#16A34A)',
                        'Biology':'linear-gradient(135deg,#22C55E,#16A34A)',
                        'Historia':'linear-gradient(135deg,#F59E0B,#D97706)',
                        'History':'linear-gradient(135deg,#F59E0B,#D97706)',
                        'Español':'linear-gradient(135deg,#EF4444,#DC2626)',
                        'Spanish':'linear-gradient(135deg,#EF4444,#DC2626)',
                        'Ciencias Naturales':'linear-gradient(135deg,#14B8A6,#0D9488)',
                        'Natural Sciences':'linear-gradient(135deg,#14B8A6,#0D9488)',
                        'Mineduc - Lenguaje':'linear-gradient(135deg,#8B5CF6,#7C3AED)',
                        'Mineduc - Matemática':'linear-gradient(135deg,#6366F1,#4F46E5)',
                        'Mineduc - Language':'linear-gradient(135deg,#8B5CF6,#7C3AED)',
                        'Mineduc - Mathematics':'linear-gradient(135deg,#6366F1,#4F46E5)',
                      }
                      const bg = esIngles ? 'linear-gradient(135deg,#1d4ed8,#1e40af)' : esOlimpiadas ? 'linear-gradient(135deg,#d97706,#b45309)' : (colores[mat] || 'linear-gradient(135deg,#7C3AED,#5B21B6)')
                      return (
                        <button key={i} className="o-chip"
                          style={{
                            background: bg,
                            color: 'white',
                            border: 'none',
                            fontWeight: 600,
                            boxShadow: '0 4px 12px rgba(0,0,0,.15)',
                          }}
                          onClick={() => {
                            if (esOlimpiadas) {
                              setMostrandoSubOlimpiadas(true)
                            } else if (esIngles) {
                              setModoConversacion(true)
                              setIdiomaIngles(true)
                              setMateriaAlumno('Inglés')
                              setEstadoChat('activo')
                              enviarPregunta('Quiero practicar conversación en inglés')
                            } else {
                              enviarPregunta(mat)
                            }
                          }}>
                          {esIngles ? '🎙️ ' : esOlimpiadas ? '🏆 ' : ''}{mat}
                        </button>
                      )
                    })}
                    <button className="o-chip"
                      style={{background:'#F3F0FF',color:'#9490B8',border:'1px solid rgba(109,40,217,.08)',fontWeight:500}}
                      onClick={() => { 
                        setEstadoChat('esperando_grado')
                        setChipsMateria([])
                        setMateriaAlumno('')
                        setSugerencias([])
                      }}>
                      {idiomaIngles ? '✏️ Change grade' : '✏️ Cambiar grado'}
                    </button>
                  </div>
                ) : (
                  <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                    <p style={{width:'100%',fontSize:'11px',color:'#b45309',fontWeight:600,marginBottom:'4px'}}>
                      {idiomaIngles ? '🏆 Science Olympiad — choose subject:' : '🏆 Olimpiadas de Ciencias — elige materia:'}
                    </p>
                    {['Matemática','Biología','Física','Química','Ciencias Naturales'].map(sub => (
                      <button key={sub} className="o-chip"
                        style={{background:'linear-gradient(135deg,#d97706,#b45309)',color:'white',border:'none',fontWeight:600}}
                        onClick={() => { setMostrandoSubOlimpiadas(false); enviarPregunta('Olimpiadas - ' + sub) }}>
                        {sub}
                      </button>
                    ))}
                    <button className="o-chip"
                      style={{background:'#F3F0FF',color:'#6D28D9',border:'1px solid rgba(109,40,217,.12)'}}
                      onClick={() => setMostrandoSubOlimpiadas(false)}>
                      {idiomaIngles ? '← Back' : '← Regresar'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {sugerencias.length>0&&estadoChat==='activo'&&(
              <div style={{display:'flex',gap:'8px',marginBottom:'10px',overflowX:'auto'}} className="scrollbar-hide">
                {sugerencias.map((s,i)=>(
                  <button key={i} className="o-chip" onClick={()=>enviarPregunta(s.text)}>
                    <span style={{color:'#7C3AED',fontSize:'14px'}}>{s.icon}</span><span>{s.text}</span>
                  </button>
                ))}
                <button className="o-chip"
                  style={{background:'#F3F0FF',color:'#9490B8',border:'1px solid rgba(109,40,217,.08)',fontWeight:500}}
                  onClick={() => { 
                    setEstadoChat('esperando_materia')
                    setSugerencias([])
                    setMateriaAlumno('')
                  }}>
                  {idiomaIngles ? '← Menu' : '← Menú'}
                </button>
              </div>
            )}
            <div className="o-input-wrap" style={{display:'flex',gap:'10px',alignItems:'flex-end',padding:'10px 14px'}}>
              <textarea ref={inputRef} value={pregunta}
                onChange={e=>setPregunta(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();enviarPregunta()}}}
                placeholder={placeholder} rows={2} disabled={cargando}
                style={{flex:1,background:'transparent',border:'none',outline:'none',resize:'none',fontSize:'14px',color:'#1E1B4B',lineHeight:'1.6',fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:400}}
              />
              <button onClick={()=>enviarPregunta()} disabled={cargando||!pregunta.trim()} className="o-send">
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                </svg>
              </button>
            </div>
            <p style={{fontSize:'10px',color:'#D4D0EE',textAlign:'center',marginTop:'8px',letterSpacing:'.4px',fontWeight:500}}>
              Owlaris te guía para que aprendas — no hace tu tarea por ti
            </p>
          </div>
        </div>

        {/* MODO CONVERSACIÓN — pantalla completa tipo asistente de voz */}
        {modoConversacion ? (
          <div style={{position:'fixed',inset:0,zIndex:50,background:'linear-gradient(160deg,#F0EBFF 0%,#F8F7FF 50%,#EBF5FF 100%)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'space-between',padding:'24px 20px 40px'}}>

            {/* Header — botón salir */}
            <div style={{width:'100%',display:'flex',justifyContent:'flex-end'}}>
              <button onClick={()=>{setModoConversacion(false);setEstadoChat('esperando_materia');setSugerencias([]);if(grabando){mediaRecorderRef.current?.stop();setGrabando(false)}}}
                style={{background:'rgba(220,38,38,.08)',border:'1px solid rgba(220,38,38,.2)',borderRadius:'12px',padding:'8px 16px',fontSize:'12px',fontWeight:600,color:'#DC2626',cursor:'pointer',display:'flex',alignItems:'center',gap:'6px'}}>
                <span>✕</span><span>End</span>
              </button>
            </div>

            {/* Centro — búho */}
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'16px',flex:1,justifyContent:'center'}}>
              
              {/* Estado label */}
              <div style={{background:'white',borderRadius:'20px',padding:'10px 20px',boxShadow:'0 4px 20px rgba(109,40,217,.12)',border:'1px solid rgba(109,40,217,.08)',fontSize:'14px',fontWeight:600,color:grabando?'#DC2626':cargando?'#D97706':reproduciendo?'#6D28D9':'#10B981',display:'flex',alignItems:'center',gap:'8px',transition:'all .3s'}}>
                <span style={{width:'8px',height:'8px',borderRadius:'50%',background:grabando?'#DC2626':cargando?'#D97706':reproduciendo?'#6D28D9':'#10B981',display:'inline-block',animation:'dotBlink 1s infinite'}}/>
                {grabando ? 'Listening...' : cargando ? 'Thinking...' : reproduciendo ? 'Speaking...' : 'Tap to speak'}
              </div>

              {/* Búho con rings */}
              <div style={{position:'relative',width:'280px',height:'280px',display:'flex',alignItems:'center',justifyContent:'center'}}>
                {/* Ring externo — activo cuando graba o habla */}
                <div style={{position:'absolute',width:'280px',height:'280px',borderRadius:'50%',border:`2px solid ${grabando?'rgba(220,38,38,.4)':reproduciendo?'rgba(109,40,217,.4)':'rgba(109,40,217,.15)'}`,animation:`ringPulse ${grabando?'0.5s':reproduciendo?'0.8s':'2s'} ease-in-out infinite`,transition:'all .3s'}}/>
                <div style={{position:'absolute',width:'240px',height:'240px',borderRadius:'50%',border:`2px solid ${grabando?'rgba(220,38,38,.2)':reproduciendo?'rgba(109,40,217,.2)':'rgba(109,40,217,.08)'}`,animation:`ringPulse ${grabando?'0.5s':reproduciendo?'0.8s':'2s'} ease-in-out infinite 0.2s`}}/>
                
                {/* Búho PNG con CSS animation */}
                <img src="/buho.png" alt="Owlaris"
                  style={{
                    width:'240px', height:'240px', objectFit:'contain',
                    filter:'drop-shadow(0 12px 40px rgba(109,40,217,.25))',
                    animation: reproduciendo ? 'buhoHabla 0.4s ease-in-out infinite alternate' :
                               grabando ? 'buhoEscucha 1.5s ease-in-out infinite' :
                               cargando ? 'buhoPensando 1s ease-in-out infinite' :
                               'buhoIdle 3s ease-in-out infinite',
                    transformOrigin: 'center bottom',
                  }}
                />
              </div>

              {/* Último mensaje de Owlaris */}
              {mensajes.filter(m=>m.rol==='asistente').slice(-1).map(m=>(
                <div key={m.id} style={{background:'white',borderRadius:'16px',padding:'12px 18px',maxWidth:'320px',textAlign:'center',boxShadow:'0 2px 16px rgba(109,40,217,.08)',border:'1px solid rgba(109,40,217,.06)',fontSize:'13px',color:'#4B4570',lineHeight:'1.6'}}>
                  {m.contenido.substring(0,100)}{m.contenido.length>100?'...':''}
                </div>
              ))}
            </div>

            {/* Botón micrófono grande */}
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'12px'}}>
              <button
                onClick={toggleGrabacion}
                disabled={cargando||reproduciendo}
                style={{
                  width:'80px',height:'80px',borderRadius:'50%',border:'none',cursor:(cargando||reproduciendo)?'not-allowed':'pointer',
                  background:grabando?'linear-gradient(135deg,#DC2626,#B91C1C)':'linear-gradient(135deg,#7C3AED,#5B21B6)',
                  boxShadow:grabando?'0 0 0 8px rgba(220,38,38,.2),0 8px 32px rgba(220,38,38,.4)':'0 0 0 8px rgba(109,40,217,.1),0 8px 32px rgba(109,40,217,.3)',
                  display:'flex',alignItems:'center',justifyContent:'center',
                  transform:(cargando||reproduciendo)?'scale(0.9)':'scale(1)',
                  transition:'all .2s',
                  opacity:(cargando||reproduciendo)?0.5:1,
                  animation:grabando?'micPulse 1s ease-in-out infinite':'none',
                }}>
                {grabando ? (
                  <svg width="28" height="28" fill="white" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="2"/>
                  </svg>
                ) : (
                  <svg width="28" height="28" fill="white" viewBox="0 0 24 24">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round"/>
                  </svg>
                )}
              </button>
              <p style={{fontSize:'11px',color:'#9490B8',fontWeight:500}}>
                {grabando ? 'Tap to send' : 'Tap to speak'}
              </p>
            </div>

            <style>{`
              @keyframes ringPulse { 0%,100%{transform:scale(1);opacity:.4} 50%{transform:scale(1.06);opacity:1} }
              @keyframes dotBlink { 0%,100%{opacity:1} 50%{opacity:.3} }
              @keyframes micPulse { 0%,100%{box-shadow:0 0 0 8px rgba(220,38,38,.2),0 8px 32px rgba(220,38,38,.4)} 50%{box-shadow:0 0 0 16px rgba(220,38,38,.1),0 8px 32px rgba(220,38,38,.5)} }
              @keyframes buhoHabla { from{transform:translateY(0) scale(1) rotate(-2deg)} to{transform:translateY(-10px) scale(1.05) rotate(2deg)} }
              @keyframes buhoEscucha { 0%,100%{transform:rotate(-3deg) scale(1)} 50%{transform:rotate(3deg) scale(1.02)} }
              @keyframes buhoPensando { 0%,100%{transform:translateY(0) rotate(-1deg)} 50%{transform:translateY(-8px) rotate(1deg)} }
              @keyframes buhoIdle { 0%,100%{transform:translateY(0) rotate(-1deg)} 50%{transform:translateY(-6px) rotate(1deg)} }
            `}</style>
          </div>
        ) : (
          <div className="o-float" style={{position:'fixed',bottom:'24px',left:'24px',zIndex:40,pointerEvents:'none'}}>
            <img src="/buho.png" alt="" style={{width:'60px',height:'60px',objectFit:'contain',filter:'drop-shadow(0 8px 24px rgba(109,40,217,.35))'}}/>
          </div>
        )}

        {/* Botón reporte flotante */}
        {mensajes.length >= 3 && estadoChat === 'activo' && (
          <button onClick={generarReporte} disabled={generandoPDF}
            style={{position:'fixed',bottom:'28px',right:'28px',zIndex:50,background:generandoPDF?'rgba(109,40,217,.6)':'linear-gradient(135deg,#7C3AED,#6D28D9)',border:'none',borderRadius:'16px',padding:'12px 20px',cursor:generandoPDF?'not-allowed':'pointer',display:'flex',alignItems:'center',gap:'8px',boxShadow:'0 8px 28px rgba(109,40,217,.35)',transition:'all .25s',fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
            {generandoPDF?(
              <svg style={{animation:'spin 1s linear infinite',width:'16px',height:'16px',flexShrink:0}} fill="none" viewBox="0 0 24 24">
                <circle style={{opacity:.25}} cx="12" cy="12" r="10" stroke="white" strokeWidth="3"/>
                <path style={{opacity:.75}} fill="white" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/>
              </svg>
            ):(
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2" style={{flexShrink:0}}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
            )}
            <span style={{fontSize:'13px',fontWeight:600,color:'white',letterSpacing:'.2px'}}>{generandoPDF?'Generando...':'Reporte Académico'}</span>
          </button>
        )}
      </div>
    </>
  )
}
