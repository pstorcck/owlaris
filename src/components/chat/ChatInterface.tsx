'use client'

import React, { useState, useRef, useEffect } from 'react'
import OwlarisOwl3D from '@/components/chat/OwlarisOwl3D'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Usuario, Materia, MensajeChat } from '@/types'
import { sanitizarTextoPdf } from '@/lib/pdfText'
import { buildWelcomeMessage } from '@/lib/pedagogicalGuard'
import {
  ArrowLeft,
  BookOpen,
  Calculator,
  CheckCircle2,
  Copy,
  Dumbbell,
  Feather,
  FileText,
  FlaskConical,
  Flame,
  Footprints,
  Globe,
  GraduationCap,
  Landmark,
  Leaf,
  Lightbulb,
  ListChecks,
  LogOut,
  Menu,
  Mic,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  RotateCcw,
  Send,
  Sparkles,
  Star,
  Trophy,
  User,
  type LucideIcon,
} from 'lucide-react'

interface Props {
  usuario: Usuario
  materias: Materia[]
  materiasDisponibles?: string[]
}

type EstadoChat = 'esperando_nombre' | 'esperando_confirmacion_grado' | 'esperando_grado' | 'esperando_materia' | 'esperando_materia_olimpiadas' | 'esperando_confirmacion_cambio_materia' | 'activo'

type EnviarPreguntaOpciones = {
  forceConversation?: boolean
  forceEnglish?: boolean
  forceEstado?: EstadoChat
  forceMateria?: string
  fromVoice?: boolean
  speechConfidence?: number | null
}

type AdaptacionDificultad = {
  tipo: 'sube' | 'baja' | 'refuerza' | 'mantiene'
  nivel_anterior: number
  nivel_nuevo: number
  aciertos_consecutivos: number
  fallos_consecutivos: number
  motivo: string
  creado_en?: string
}

type SpeechRecognitionAlternativeLike = { transcript?: string; confidence?: number }
type SpeechRecognitionResultLike = {
  isFinal?: boolean
  length: number
  [index: number]: SpeechRecognitionAlternativeLike
}
type SpeechRecognitionEventLike = {
  resultIndex: number
  results: {
    length: number
    [index: number]: SpeechRecognitionResultLike
  }
}
type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}
type SpeechRecognitionConstructorLike = new () => SpeechRecognitionLike
type WindowWithSpeechTools = Window & {
  SpeechRecognition?: SpeechRecognitionConstructorLike
  webkitSpeechRecognition?: SpeechRecognitionConstructorLike
  webkitAudioContext?: typeof AudioContext
}

// Instrucciones del 13 de julio — "Opciones de ayuda" nuevas conviven con
// las acciones rápidas ya existentes (no las reemplazan). Se centralizan
// aquí en vez de repetirlas en los dos lugares donde se setea sugerencias.
const SUGERENCIAS_ES: { icon: LucideIcon; text: string }[] = [
  { icon: ListChecks, text: 'Temas de esta materia' },
  { icon: Sparkles, text: 'Explícame con un ejemplo' },
  { icon: Dumbbell, text: 'Quiero practicar' },
  { icon: FileText, text: 'Resume el tema' },
  { icon: RotateCcw, text: 'Revisemos mis errores' },
  { icon: Lightbulb, text: 'Dame una pista' },
  { icon: Footprints, text: 'Explícame el primer paso' },
  { icon: Copy, text: 'Ponme un ejemplo parecido' },
  { icon: Feather, text: 'Explícamelo más fácil' },
  { icon: CheckCircle2, text: 'Revisa lo que hice' },
  { icon: RefreshCw, text: 'Empieza desde cero' },
]

const SUGERENCIAS_EN: { icon: LucideIcon; text: string }[] = [
  { icon: ListChecks, text: 'Class topics' },
  { icon: Sparkles, text: 'Explain with an example' },
  { icon: Dumbbell, text: 'I want to practice' },
  { icon: FileText, text: 'Summarize the topic' },
  { icon: RotateCcw, text: "Let's review my mistakes" },
  { icon: Lightbulb, text: 'Give me a hint' },
  { icon: Footprints, text: 'Explain the first step' },
  { icon: Copy, text: 'Give me a similar example' },
  { icon: Feather, text: 'Explain it more simply' },
  { icon: CheckCircle2, text: 'Review what I did' },
  { icon: RefreshCw, text: 'Start from scratch' },
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

// Hallazgo real (tercera verificación, 2026-07-13): cuando el alumno pide
// explícitamente una tabla, preguntar/route.ts ya deja de convertirla a
// "Etiqueta: valor" en línea y entrega la sintaxis real de tabla markdown
// (fila de encabezado con pipes + fila separadora de guiones) — pero esta
// interfaz nunca sabía interpretar esa sintaxis: renderTexto solo separa
// por líneas, así que el alumno veía los pipes y guiones como texto plano
// en vez de una cuadrícula legible. Se detecta el mismo patrón que ya
// reconoce sanitizeChatFormatting en el backend (una línea con pipes
// seguida de una fila separadora) y se renderiza como una tabla HTML real.
const SEPARATOR_ROW_TABLA = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/

function splitTableRowTabla(linea: string): string[] {
  return linea.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((celda) => celda.trim())
}

function renderTablaMarkdown(headerLine: string, bodyLines: string[], key: number): React.ReactNode {
  const encabezados = splitTableRowTabla(headerLine)
  return (
    <table key={key} style={{borderCollapse:'collapse',width:'100%',margin:'6px 0',fontSize:'13px'}}>
      <thead>
        <tr>
          {encabezados.map((h, i) => (
            <th key={i} style={{border:'1px solid rgba(109,40,217,.25)',padding:'6px 10px',textAlign:'left',background:'rgba(109,40,217,.08)',color:'inherit',fontWeight:700}}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {bodyLines.map((linea, filaIdx) => (
          <tr key={filaIdx}>
            {splitTableRowTabla(linea).map((celda, celdaIdx) => (
              <td key={celdaIdx} style={{border:'1px solid rgba(109,40,217,.15)',padding:'6px 10px',color:'inherit'}}>{celda}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function renderTextoConTablas(texto: string): React.ReactNode[] {
  const lineas = texto.split('\n')
  const bloques: React.ReactNode[] = []
  let buffer: string[] = []
  let key = 0

  const flushBuffer = () => {
    if (buffer.length === 0) return
    bloques.push(<React.Fragment key={key++}>{renderTexto(buffer.join('\n'))}</React.Fragment>)
    buffer = []
  }

  let i = 0
  while (i < lineas.length) {
    const linea = lineas[i]
    const siguienteEsSeparador = i + 1 < lineas.length && /\|/.test(linea) && SEPARATOR_ROW_TABLA.test(lineas[i + 1] || '')
    if (siguienteEsSeparador) {
      flushBuffer()
      const headerLine = linea
      i += 2
      const bodyLines: string[] = []
      while (i < lineas.length && lineas[i].includes('|') && lineas[i].trim() !== '') {
        bodyLines.push(lineas[i])
        i += 1
      }
      bloques.push(renderTablaMarkdown(headerLine, bodyLines, key++))
      continue
    }
    buffer.push(linea)
    i += 1
  }
  flushBuffer()
  return bloques
}

export default function ChatInterface({ usuario, materiasDisponibles: materiasIniciales = [] }: Props) {
  const [mensajes, setMensajes]         = useState<MensajeChat[]>([])
  const [pregunta, setPregunta]         = useState('')
  const [cargando, setCargando]         = useState(false)
  const [error, setError]               = useState('')
  const [sugerencias, setSugerencias]   = useState<{icon:LucideIcon;text:string}[]>([])
  const [progresoEstudiante, setProgresoEstudiante] = useState<{racha:number;puntos:number}>({racha:0,puntos:0})
  const [expandido, setExpandido]       = useState<string | null>(null)
  const [generandoPDF, setGenerandoPDF]       = useState(false)
  const [reportePdfListo, setReportePdfListo] = useState(false)
  const [nivelDificultad, setNivelDificultad] = useState(1)
  const [practicaEnfoque, setPracticaEnfoque] = useState('general')
  const [aciertosConsec, setAciertosConsec]   = useState(0)
  const [adaptacionesDificultad, setAdaptacionesDificultad] = useState<AdaptacionDificultad[]>([])
  const sessionStartedAtRef = useRef<string>(new Date().toISOString())
  const reportePdfListoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
  const materiasBaseRef = React.useRef<string[]>(materiasIniciales)
  const [chipsMateria, setChipsMateria] = useState<string[]>(
    materiasIniciales  // se traducirán via useEffect si idiomaIngles
  )
  const [mostrandoSubOlimpiadas, setMostrandoSubOlimpiadas] = useState(false)
  const [mostrandoGrados, setMostrandoGrados]               = useState(false)
  const [gradoTemp, setGradoTemp]                           = useState('')
  const [gradosDisponibles, setGradosDisponibles]           = useState<string[]>([])

  // Cargar grados al iniciar
  useEffect(() => {
    fetch('/api/grados')
      .then(r => r.json())
      .then(data => { if (data.grados) setGradosDisponibles(data.grados) })
      .catch(() => {})
  }, [])
  const [idiomaIngles, setIdiomaIngles]       = useState(false)
  const [sidebarAbierto, setSidebarAbierto]   = useState(false)
  const [sidebarColapsado, setSidebarColapsado] = useState(false)
  const [pendingMathId, setPendingMathId]     = useState<string | null>(null)
  const [modoConversacion, setModoConversacion] = useState(false)
  const [grabando, setGrabando]               = useState(false)
  const [reproduciendo, setReproduciendo]     = useState(false)
  const [pausado, setPausado]                 = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef   = useRef<Blob[]>([])
  const audioRef         = useRef<HTMLAudioElement | null>(null)
  const recognitionRef   = useRef<SpeechRecognitionLike | null>(null)
  const transcriptRef    = useRef('')
  const confidenceValuesRef = useRef<number[]>([])
  const audioUnlockedRef = useRef(false)
  const [transcribiendo, setTranscribiendo] = useState(false)
  const [transcripcionVoz, setTranscripcionVoz] = useState('')
  const [vozNavegadorActiva, setVozNavegadorActiva] = useState(false)
  const [audioPendiente, setAudioPendiente] = useState('')
  // Refs espejo de estado para leer el valor vigente dentro de callbacks
  // async/temporizadores (onended de <audio>, setInterval del VAD) sin
  // depender de closures de useState que pueden quedar obsoletas.
  const pausadoRef          = useRef(false)
  const modoConversacionRef = useRef(false)
  const reproduciendoRef    = useRef(false)
  const grabandoRef         = useRef(false)
  useEffect(() => { pausadoRef.current = pausado }, [pausado])
  useEffect(() => { modoConversacionRef.current = modoConversacion }, [modoConversacion])
  useEffect(() => { reproduciendoRef.current = reproduciendo }, [reproduciendo])
  useEffect(() => { grabandoRef.current = grabando }, [grabando])
  // Detección de silencio (VAD) para conversación continua: analiza el
  // volumen del micrófono mientras se graba y corta sola cuando el
  // alumno deja de hablar, sin que tenga que presionar un botón.
  const vadAudioCtxRef   = useRef<AudioContext | null>(null)
  const vadIntervalRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const vadMaxTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const vadHasSpokenRef  = useRef(false)
  const vadSilenceStartRef = useRef<number | null>(null)
  const autoEscuchaTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Cuando se pausa o se termina la conversación mientras se está
  // grabando, la grabación se corta pero NO debe transcribirse ni
  // enviarse — este flag le avisa al onstop del MediaRecorder que la
  // descarte en silencio.
  const grabacionCanceladaRef = useRef(false)

  // Estado onboarding
  const gradoGuardado = usuario.grado || ''
  const nombreInicial = usuario.nombre_completo.split(' ')[0]
  const estadoInicial: EstadoChat = gradoGuardado ? 'esperando_materia' : 'esperando_grado'
  const [estadoChat, setEstadoChat]       = useState<EstadoChat>(estadoInicial)
  const [nombreAlumno, setNombreAlumno]   = useState(gradoGuardado ? nombreInicial : '')
  const [gradoAlumno, setGradoAlumno]     = useState(gradoGuardado)
  const [materiaAlumno, setMateriaAlumno] = useState('')

  const finalRef = useRef<HTMLDivElement>(null)
  const materiasDisponiblesRef = useRef<string[]>(materiasIniciales)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const bienvenidaInicializadaRef = useRef(false)

  // Hallazgo real (reporte de un maestro, 2026-07-08): el búho flotante y el
  // botón "Reporte de hoy" usaban un bottom fijo en px, calculado para
  // cuando el footer (input + chips de acción rápida) es corto. En móvil,
  // cuando aparecen chips de materia o de acciones rápidas, el footer crece
  // y esos botones fijos terminan superpuestos sobre el área de escribir.
  // Se mide la altura real del footer para que el offset se adapte siempre.
  const footerRef = useRef<HTMLDivElement>(null)
  const [alturaFooter, setAlturaFooter] = useState(96)
  useEffect(() => {
    const el = footerRef.current
    if (!el) return
    const actualizar = () => setAlturaFooter(el.offsetHeight)
    actualizar()
    const observer = new ResizeObserver(actualizar)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const router   = useRouter()
  const supabase = createClient()

  const iniciales = usuario.nombre_completo.split(' ').map((n:string) => n[0]).join('').substring(0,2).toUpperCase()

  useEffect(() => { finalRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [mensajes, cargando])

  // Al desmontar (el alumno navega fuera del chat), corta cualquier
  // grabación/temporizador de voz activo para no dejar el micrófono
  // abierto ni el ciclo de reescucha automática corriendo en segundo plano.
  useEffect(() => {
    return () => {
      if (autoEscuchaTimeoutRef.current) clearTimeout(autoEscuchaTimeoutRef.current)
      if (vadIntervalRef.current) clearInterval(vadIntervalRef.current)
      if (vadMaxTimeoutRef.current) clearTimeout(vadMaxTimeoutRef.current)
      if (vadAudioCtxRef.current) { try { vadAudioCtxRef.current.close() } catch { /* */ } }
      try { recognitionRef.current?.stop() } catch { /* */ }
      try { mediaRecorderRef.current?.stop() } catch { /* */ }
      if (reportePdfListoTimeoutRef.current) clearTimeout(reportePdfListoTimeoutRef.current)
    }
  }, [])

  function reiniciarVentanaReporte() {
    sessionStartedAtRef.current = new Date().toISOString()
    setAdaptacionesDificultad([])
    setNivelDificultad(1)
    setAciertosConsec(0)
    setPendingMathId(null)
    setPracticaEnfoque('general')
  }

  useEffect(() => {
    if (estadoChat === 'esperando_grado' && !gradoGuardado && !gradoAlumno && gradosDisponibles.length > 0) {
      setMostrandoGrados(true)
    }
  }, [estadoChat, gradoAlumno, gradoGuardado, gradosDisponibles.length])

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    window.speechSynthesis.getVoices()
    const cargarVoces = () => window.speechSynthesis.getVoices()
    window.speechSynthesis.addEventListener?.('voiceschanged', cargarVoces)
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', cargarVoces)
  }, [])

  // Cargar materias desde API al iniciar si hay grado guardado
  useEffect(() => {
    if (!gradoGuardado) return
    setNombreAlumno(nombreInicial)
    setGradoAlumno(gradoGuardado)
    setMostrandoGrados(false)
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
        materiasBaseRef.current = data.materias_disponibles
        setChipsMateria(traducirChips(data.materias_disponibles, idiomaIngles))
        setGradoAlumno(gradoGuardado)
        setNombreAlumno(nombreInicial)
      }
    }).catch(() => {})
  }, [gradoGuardado, idiomaIngles, nombreInicial, usuario.id])

  useEffect(() => {
    if (bienvenidaInicializadaRef.current) return
    bienvenidaInicializadaRef.current = true
    const nombre = usuario.nombre_completo.split(' ')[0]
    // Hallazgo real (QA Ronda 3, 2026-07-10): tras cerrar sesión y volver a
    // entrar el mismo día, el chat se reinicia visualmente sin ningún
    // rastro de la actividad anterior, aunque el backend sí la conserva
    // (el "Reporte de hoy" incluye todas las interacciones previas y un
    // ejercicio pendiente se recupera igual si el alumno menciona la
    // materia). Se le avisa explícitamente de esto en vez de simular una
    // continuidad que la interfaz de chat no tiene.
    //
    // Hallazgo real (QA 2026-07-14): el mensaje de bienvenida exacto del
    // instructivo del 13 de julio se había implementado como un corte
    // determinístico en el backend (esBienvenida en preguntar/route.ts),
    // pero ese código nunca se alcanza — este mensaje local, mostrado al
    // montar el chat, es lo primero que ve el alumno y nunca pasa por el
    // API. Se antepone aquí, una sola vez por sesión/chat (mismo guard de
    // bienvenidaInicializadaRef de siempre).
    const continuacion = gradoGuardado
      ? (idiomaIngles
          ? `Hi, ${nombre}! What subject are we studying today? If you already worked with me earlier today, this chat won't show that history, but I can pick up right where you left off if you tell me the subject and topic — or check "Today's report" for the full record.`
          : `¡Hola, ${nombre}! ¿Qué materia vamos a estudiar hoy? Si ya trabajaste conmigo antes hoy, este chat no muestra ese historial, pero puedo retomarlo si me dices la materia y el tema — o revisa "Reporte de hoy" para ver el registro completo.`)
      : (idiomaIngles
          ? `Hi, ${nombre}! I'm Owlaris, your academic tutor. First, select your grade.`
          : `¡Hola, ${nombre}! Soy Owlaris, tu tutor académico. Primero, selecciona tu grado.`)
    const msg = `${buildWelcomeMessage(idiomaIngles)}\n\n${continuacion}`
    setMensajes([{
      id: 'bienvenida',
      rol: 'asistente',
      contenido: msg,
      timestamp: new Date(),
    }])
    setNombreAlumno(nombre)
    // Sin grado guardado: abrir modal de grados automáticamente
    if (!gradoGuardado) setMostrandoGrados(true)
  }, [gradoGuardado, idiomaIngles, usuario.nombre_completo])

  // Rediseño premium (instructivo 2026-07-14): racha de días activos y
  // puntos para el header del chat — se piden una vez al activarse la
  // materia, con datos reales (ver /api/progreso-estudiante).
  useEffect(() => {
    if (estadoChat !== 'activo') return
    fetch('/api/progreso-estudiante')
      .then(res => res.json())
      .then(data => {
        if (typeof data.racha_dias_activos === 'number' && typeof data.puntos === 'number') {
          setProgresoEstudiante({ racha: data.racha_dias_activos, puntos: data.puntos })
        }
      })
      .catch(() => {})
  }, [estadoChat])

  // Traducir chips cuando cambia idioma
  useEffect(() => {
    const base = materiasBaseRef.current
    if (base.length > 0) {
      setChipsMateria(traducirChips(base, idiomaIngles))
    }
  }, [idiomaIngles])

  // Hallazgo real (auditoría QA 2026-07-07): las acciones rápidas ("Explícame
  // con un ejemplo", "Quiero practicar", etc.) solo se traducían cuando
  // llegaba la SIGUIENTE respuesta del tutor, así que al cambiar el toggle
  // EN/ES quedaban mezclando idiomas hasta ese momento. Se retraducen aquí
  // de inmediato, igual que ya se hacía con chipsMateria arriba.
  useEffect(() => {
    setSugerencias(prev => {
      if (prev.length === 0) return prev
      return idiomaIngles ? SUGERENCIAS_EN : SUGERENCIAS_ES
    })
  }, [idiomaIngles])

  function limpiarTextoParaVoz(texto: string) {
    return texto
      .replace(/\[OP:[^\]]+\]/gi, '')
      .replace(/◈.*$/gm, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 240)
  }

  async function asegurarAudioDesbloqueado() {
    if (audioUnlockedRef.current || typeof window === 'undefined') return
    try {
      const win = window as WindowWithSpeechTools
      const AudioContextCtor = window.AudioContext || win.webkitAudioContext
      if (!AudioContextCtor) return
      const ctx = new AudioContextCtor()
      const buffer = ctx.createBuffer(1, 1, 22050)
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(ctx.destination)
      source.start(0)
      await ctx.resume()
      audioUnlockedRef.current = true
      setTimeout(() => ctx.close().catch(() => {}), 300)
    } catch {
      audioUnlockedRef.current = true
    }
  }

  function hablarConVozDelNavegador(texto: string) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false
    const frase = limpiarTextoParaVoz(texto)
    if (!frase) return false
    try {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(frase)
      utterance.lang = 'en-US'
      utterance.rate = 0.96
      utterance.pitch = 1.02
      const voices = window.speechSynthesis.getVoices()
      const preferred = voices.find(v => /aria|samantha|google us english|natural|jenny/i.test(v.name) && /^en/i.test(v.lang))
        || voices.find(v => /^en-US/i.test(v.lang))
        || voices.find(v => /^en/i.test(v.lang))
      if (preferred) utterance.voice = preferred
      utterance.onstart = () => { setVozNavegadorActiva(true); setReproduciendo(true); setAudioPendiente('') }
      utterance.onend = () => { setVozNavegadorActiva(false); finalizarReproduccion() }
      utterance.onerror = () => { setVozNavegadorActiva(false); finalizarReproduccion(); setAudioPendiente(frase) }
      window.speechSynthesis.speak(utterance)
      return true
    } catch {
      return false
    }
  }

  function iniciarReconocimientoVoz() {
    if (typeof window === 'undefined') return null
    const win = window as WindowWithSpeechTools
    const SpeechRecognitionCtor = win.SpeechRecognition || win.webkitSpeechRecognition
    if (!SpeechRecognitionCtor) return null

    try {
      const recognition = new SpeechRecognitionCtor()
      recognition.lang = 'en-US'
      recognition.continuous = true
      recognition.interimResults = true
      recognition.onresult = event => {
        let interim = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          const transcript = result[0]?.transcript || ''
          const confidence = result[0]?.confidence
          if (typeof confidence === 'number' && confidence > 0) confidenceValuesRef.current.push(confidence)
          if (result.isFinal) {
            transcriptRef.current = `${transcriptRef.current} ${transcript}`.trim()
          } else {
            interim += transcript
          }
        }
        setTranscripcionVoz(`${transcriptRef.current} ${interim}`.trim())
      }
      recognition.onerror = () => {}
      recognition.onend = () => {}
      recognition.start()
      recognitionRef.current = recognition
      return recognition
    } catch {
      return null
    }
  }

  function detenerReconocimientoVoz() {
    try { recognitionRef.current?.stop() } catch { /* silencioso */ }
    recognitionRef.current = null
  }

  function promedioConfianzaVoz() {
    const vals = confidenceValuesRef.current.filter(v => Number.isFinite(v) && v > 0)
    if (vals.length === 0) return null
    return vals.reduce((a, b) => a + b, 0) / vals.length
  }

  function iniciarConversacionIngles() {
    asegurarAudioDesbloqueado()
    reiniciarVentanaReporte()
    modoConversacionRef.current = true
    setModoConversacion(true)
    pausadoRef.current = false
    setPausado(false)
    setIdiomaIngles(true)
    setMateriaAlumno('Inglés')
    setEstadoChat('activo')
    setSugerencias([])
    setTranscripcionVoz('')
    enviarPregunta('I want to practice English conversation.', {
      forceConversation: true,
      forceEnglish: true,
      forceEstado: 'activo',
      forceMateria: 'Inglés',
    })
  }

  async function enviarPregunta(texto?: string, opciones: EnviarPreguntaOpciones = {}) {
    const tp = (texto || pregunta).trim()
    if (!tp || cargando) return
    const idiomaActivo = opciones.forceEnglish ?? idiomaIngles
    const modoConversacionActivo = opciones.forceConversation ?? modoConversacion
    const estadoActivo = opciones.forceEstado ?? estadoChat
    const materiaActiva = opciones.forceMateria ?? materiaAlumno
    if (estadoActivo === 'esperando_materia' || estadoActivo === 'esperando_materia_olimpiadas') {
      reiniciarVentanaReporte()
    }
    setPregunta(''); setError(''); setSugerencias([])

    const msgU: MensajeChat = { id: Date.now().toString(), rol: 'usuario', contenido: tp, timestamp: new Date() }
    setMensajes(prev => [...prev, msgU])
    setCargando(true)

    // Hallazgo real (QA Ronda 4, backlog): sin límite de tiempo en el
    // fetch, una solicitud lenta o colgada del backend dejaba al alumno
    // viendo el spinner "Coaching..." indefinidamente, sin respuesta NI
    // error visible (~40s reportados). Un timeout de cliente asegura que
    // siempre aparezca un mensaje accionable si la respuesta tarda demasiado.
    const timeoutController = new AbortController()
    const timeoutId = setTimeout(() => timeoutController.abort(), 45000)

    try {
      const res: Response = await fetch('/api/preguntar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: timeoutController.signal,
        body: JSON.stringify({
          pregunta: tp,

          estado: estadoActivo,
          nombre_alumno: nombreAlumno,
          grado_override: gradoAlumno || gradoGuardado,
          materia_id: materiaActiva,
          historial: mensajes.slice(-6).map(m => ({ rol: m.rol, contenido: m.contenido })),
          user_id: usuario.id,
          materia_sugerida: materiaSugerida,
          materias_disponibles: materiasDisponiblesRef.current,
          idioma_ingles: idiomaActivo,
          modo_conversacion: modoConversacionActivo,
          modo_conversacion_explicito: modoConversacionActivo,
          nivel_dificultad: nivelDificultad,
          practica_enfoque: practicaEnfoque,
          aciertos_consecutivos: aciertosConsec,
          pending_math_interaction_id: pendingMathId,
          entrada_voz: opciones.fromVoice || false,
          speech_confidence: opciones.speechConfidence ?? null,
        })
      })
      if (!res.ok) {
        // El backend distingue el tipo de error técnico (fuente no
        // disponible, materia no disponible, servicio saturado) y manda un
        // mensaje específico en "respuesta" — antes se descartaba el
        // cuerpo entero y siempre se mostraba el mismo mensaje genérico.
        let mensajeTecnico = 'Hubo un problema. Intenta de nuevo.'
        try {
          const dataError = await res.json()
          if (typeof dataError?.respuesta === 'string' && dataError.respuesta.trim()) mensajeTecnico = dataError.respuesta
        } catch { /* cuerpo no es JSON o está vacío, se usa el mensaje genérico */ }
        throw new Error(mensajeTecnico)
      }
      const data = await res.json()

      // Actualizar estado onboarding
      if (data.nuevo_estado) setEstadoChat(data.nuevo_estado)
      if (data.nombre_alumno) setNombreAlumno(data.nombre_alumno)
      if (data.nuevo_estado === 'esperando_grado' && !gradoGuardado && !gradoAlumno && gradosDisponibles.length > 0) {
        setMostrandoGrados(true)
      }
      if (data.grado_detectado) {
        setGradoAlumno(data.grado_detectado)
        // Guardar grado desde el frontend donde sí hay sesión activa
        await supabase.from('usuarios').update({ grado: data.grado_detectado }).eq('id', usuario.id)
      }
      if (data.materia_detectada) setMateriaAlumno(data.materia_detectada)
      if (data.activar_conversacion) { setModoConversacion(true); setIdiomaIngles(true) }
      if (data.nivel_dificultad) setNivelDificultad(data.nivel_dificultad)
      if (data.practica_enfoque) setPracticaEnfoque(data.practica_enfoque)


      if (data.materias_disponibles) {
        materiasDisponiblesRef.current = data.materias_disponibles
        materiasBaseRef.current = data.materias_disponibles  // guardar base en español
        setChipsMateria(traducirChips(data.materias_disponibles, idiomaActivo))
        setMostrandoSubOlimpiadas(false)
      }
      if (data.aciertos_consecutivos !== undefined) setAciertosConsec(data.aciertos_consecutivos)
      if (data.adaptacion_dificultad && data.adaptacion_dificultad.tipo && data.adaptacion_dificultad.tipo !== 'mantiene') {
        setAdaptacionesDificultad(prev => [...prev, {
          ...data.adaptacion_dificultad,
          creado_en: new Date().toISOString(),
        }])
      }
      if (data.materia_sugerida) setMateriaSugerida(data.materia_sugerida)
      // Punto 2 asesor: conservar pendingMathId si incorrecto, limpiar si correcto o null
      if ('pending_math_interaction_id' in data) setPendingMathId(data.pending_math_interaction_id)
      if (data.nuevo_estado && data.nuevo_estado !== 'esperando_confirmacion_cambio_materia') setMateriaSugerida('')

      setMensajes(prev => [...prev, {
        id: (Date.now()+1).toString(),
        rol: 'asistente',
        contenido: data.respuesta,
        timestamp: new Date(),
        documento_fuente: data.documento_fuente,
      }])
      // TTS en modo conversación
      if (modoConversacionActivo && data.respuesta) {
        reproducirTTS(data.respuesta, modoConversacionActivo)
      }

      // Sugerencias solo cuando está activo
      if (data.nuevo_estado === 'activo' || estadoChat === 'activo') {
        setSugerencias(idiomaActivo ? SUGERENCIAS_EN : SUGERENCIAS_ES)
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        setError(idiomaActivo
          ? 'The response is taking longer than usual. Please try again.'
          : 'La respuesta está tardando más de lo normal. Intenta de nuevo.')
      } else {
        setError(e instanceof Error && e.message ? e.message : 'Hubo un problema. Intenta de nuevo.')
      }
    }
    finally { clearTimeout(timeoutId); setCargando(false); inputRef.current?.focus() }
  }

  // Conversación continua: cuando el búho termina de hablar, reactiva el
  // micrófono solo (sin que el alumno tenga que presionar nada), a menos
  // que la conversación esté pausada o ya se haya salido de ese modo.
  function programarReanudarEscucha() {
    if (autoEscuchaTimeoutRef.current) clearTimeout(autoEscuchaTimeoutRef.current)
    autoEscuchaTimeoutRef.current = setTimeout(() => {
      if (modoConversacionRef.current && !pausadoRef.current && !grabandoRef.current && !reproduciendoRef.current) {
        iniciarGrabacion()
      }
    }, 450)
  }

  function finalizarReproduccion() {
    setReproduciendo(false)
    programarReanudarEscucha()
  }

  // Divide la respuesta en oraciones para reproducirlas una por una con
  // una pausa breve entre cada una, en vez de un solo bloque de audio
  // continuo que suena apurado y de un solo golpe.
  function dividirEnOraciones(texto: string): string[] {
    return texto.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean)
  }

  // Pide y reproduce el audio de UNA oración. Devuelve true si sonó bien
  // completa, false si falló (fetch, decodificación o autoplay bloqueado).
  async function reproducirUnaOracionOpenAI(oracion: string): Promise<boolean> {
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: oracion, modo: 'conversation' }),
      })
      if (!res.ok) return false
      const blob = await res.blob()
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
      let audio: HTMLAudioElement
      let url: string | null = null
      if (isSafari) {
        // Safari: usar FileReader para convertir a base64
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })
        audio = new Audio(base64)
      } else {
        url = URL.createObjectURL(blob)
        audio = new Audio(url)
      }
      audioRef.current = audio
      audio.playbackRate = 1.0
      return await new Promise<boolean>(resolve => {
        let resuelto = false
        const terminar = (ok: boolean) => {
          if (resuelto) return
          resuelto = true
          if (url) { try { URL.revokeObjectURL(url as string) } catch { /* */ } }
          resolve(ok)
        }
        audio.onended = () => terminar(true)
        audio.onerror = () => terminar(false)
        // Si se pausa a la mitad (el alumno presionó Pausa o End), no
        // cuenta como error: simplemente se corta la secuencia.
        audio.onpause = () => terminar(false)
        const playPromise = audio.play()
        if (playPromise !== undefined) playPromise.catch(() => terminar(false))
      })
    } catch {
      return false
    }
  }

  async function reproducirTTS(texto: string, force = false) {
    if (!force && !modoConversacion) return
    const textoVoz = limpiarTextoParaVoz(texto)
    if (!textoVoz) return
    setAudioPendiente('')
    await asegurarAudioDesbloqueado()
    // Detener audio/voz anterior
    if (audioRef.current) { try { audioRef.current.pause() } catch { /* */ } audioRef.current = null }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()

    const oraciones = dividirEnOraciones(textoVoz)
    if (oraciones.length === 0) return
    setReproduciendo(true)
    reproduciendoRef.current = true

    for (let i = 0; i < oraciones.length; i++) {
      if (!reproduciendoRef.current) return // se pausó/terminó antes de empezar esta oración
      const ok = await reproducirUnaOracionOpenAI(oraciones[i])
      if (!reproduciendoRef.current) return // se pausó/terminó mientras sonaba esta oración
      if (!ok) {
        // Si falla el TTS de OpenAI a media conversación, se lee el resto
        // completo con la voz del navegador en vez de dejarla a medias.
        const resto = oraciones.slice(i).join(' ')
        const pudoHablar = hablarConVozDelNavegador(resto)
        if (!pudoHablar) { setAudioPendiente(resto); finalizarReproduccion() }
        return
      }
      if (i < oraciones.length - 1) await new Promise(resolve => setTimeout(resolve, 220))
    }
    finalizarReproduccion()
  }

  function limpiarVAD() {
    if (vadIntervalRef.current) { clearInterval(vadIntervalRef.current); vadIntervalRef.current = null }
    if (vadMaxTimeoutRef.current) { clearTimeout(vadMaxTimeoutRef.current); vadMaxTimeoutRef.current = null }
    if (vadAudioCtxRef.current) { try { vadAudioCtxRef.current.close() } catch { /* */ } vadAudioCtxRef.current = null }
    vadHasSpokenRef.current = false
    vadSilenceStartRef.current = null
  }

  // Analiza el volumen del micrófono mientras se graba para detectar
  // sola cuándo el alumno dejó de hablar (conversación continua sin
  // botón). Si el navegador no soporta AudioContext, no pasa nada: el
  // alumno igual puede presionar el botón para cortar manualmente.
  function iniciarVAD(stream: MediaStream) {
    if (typeof window === 'undefined') return
    const win = window as WindowWithSpeechTools
    const AudioContextCtor = window.AudioContext || win.webkitAudioContext
    if (!AudioContextCtor) return
    try {
      const ctx = new AudioContextCtor()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      source.connect(analyser)
      const datos = new Uint8Array(analyser.frequencyBinCount)
      vadAudioCtxRef.current = ctx
      vadHasSpokenRef.current = false
      vadSilenceStartRef.current = null
      const UMBRAL_VOZ = 14
      const SILENCIO_MS = 1100
      const DURACION_MAX_MS = 20000
      vadIntervalRef.current = setInterval(() => {
        analyser.getByteTimeDomainData(datos)
        let suma = 0
        for (let i = 0; i < datos.length; i++) {
          const v = datos[i] - 128
          suma += v * v
        }
        const rms = Math.sqrt(suma / datos.length)
        if (rms > UMBRAL_VOZ) {
          vadHasSpokenRef.current = true
          vadSilenceStartRef.current = null
        } else if (vadHasSpokenRef.current) {
          if (vadSilenceStartRef.current === null) vadSilenceStartRef.current = Date.now()
          else if (Date.now() - vadSilenceStartRef.current > SILENCIO_MS) detenerGrabacion()
        }
      }, 120)
      vadMaxTimeoutRef.current = setTimeout(() => detenerGrabacion(), DURACION_MAX_MS)
    } catch { /* sin VAD disponible: queda el corte manual */ }
  }

  async function iniciarGrabacion() {
    // Anti-eco: nunca se graba mientras el búho está hablando.
    if (reproduciendoRef.current || grabandoRef.current || pausadoRef.current) return
    await asegurarAudioDesbloqueado()
    setReproduciendo(false)
    setTranscribiendo(false)
    setTranscripcionVoz('')
    transcriptRef.current = ''
    confidenceValuesRef.current = []
    if (audioRef.current) { try { audioRef.current.pause() } catch { /* */ } }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (reproduciendoRef.current || pausadoRef.current) { stream.getTracks().forEach(t => t.stop()); return }
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/webm'
      const mr = new MediaRecorder(stream, { mimeType })
      iniciarReconocimientoVoz()
      iniciarVAD(stream)
      audioChunksRef.current = []
      mr.ondataavailable = e => audioChunksRef.current.push(e.data)
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        limpiarVAD()
        if (grabacionCanceladaRef.current) { grabacionCanceladaRef.current = false; setTranscribiendo(false); return }
        setTranscribiendo(true)
        await new Promise(resolve => setTimeout(resolve, 180))
        const textoReconocido = transcriptRef.current.trim()
        if (textoReconocido) {
          setTranscripcionVoz(textoReconocido)
          setTranscribiendo(false)
          enviarPregunta(textoReconocido, {
            forceConversation: true,
            forceEnglish: true,
            forceEstado: 'activo',
            forceMateria: 'Inglés',
            fromVoice: true,
            speechConfidence: promedioConfianzaVoz(),
          })
          return
        }
        const blob = new Blob(audioChunksRef.current, { type: mimeType })
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm'
        const fd   = new FormData()
        fd.append('audio', blob, `audio.${ext}`)
        try {
          const res  = await fetch('/api/transcribir', { method: 'POST', body: fd })
          const data = await res.json()
          if (data.texto?.trim()) {
            setTranscripcionVoz(data.texto.trim())
            enviarPregunta(data.texto, {
              forceConversation: true,
              forceEnglish: true,
              forceEstado: 'activo',
              forceMateria: 'Inglés',
              fromVoice: true,
              speechConfidence: null,
            })
          } else {
            // Silencio total (nada que transcribir): reanuda la escucha
            // en vez de dejar la conversación colgada.
            programarReanudarEscucha()
          }
        } catch { setError('No se pudo transcribir el audio.') }
        finally { setTranscribiendo(false) }
      }
      mr.start(250)
      mediaRecorderRef.current = mr
      setGrabando(true)
    } catch { setError('No se pudo acceder al micrófono.') }
  }

  function detenerGrabacion() {
    if (!grabandoRef.current) return
    detenerReconocimientoVoz()
    limpiarVAD()
    try { mediaRecorderRef.current?.stop() } catch { /* ya estaba detenida */ }
    setGrabando(false)
  }

  async function toggleGrabacion() {
    if (grabando) {
      detenerGrabacion()
    } else if (pausado) {
      // pausadoRef se actualiza aquí también de forma síncrona: el
      // useEffect que lo espeja corre después del render, y iniciarGrabacion
      // se llama en el mismo tick, así que si solo dependiera del efecto
      // se cortaría sola por su propia guarda de "está pausado".
      pausadoRef.current = false
      setPausado(false)
      await iniciarGrabacion()
    } else {
      await iniciarGrabacion()
    }
  }

  // Pausa/reanuda la conversación continua. Al pausar, si había una
  // grabación en curso se descarta (no se transcribe ni se envía) y se
  // detiene cualquier audio del búho; al reanudar, vuelve a escuchar sola.
  function alternarPausa() {
    if (pausado) {
      pausadoRef.current = false
      setPausado(false)
      if (!reproduciendoRef.current && !grabandoRef.current && !cargando && !transcribiendo) {
        iniciarGrabacion()
      }
    } else {
      pausadoRef.current = true
      setPausado(true)
      if (autoEscuchaTimeoutRef.current) { clearTimeout(autoEscuchaTimeoutRef.current); autoEscuchaTimeoutRef.current = null }
      if (grabandoRef.current) {
        grabacionCanceladaRef.current = true
        detenerReconocimientoVoz()
        limpiarVAD()
        try { mediaRecorderRef.current?.stop() } catch { /* ya estaba detenida */ }
        setGrabando(false)
      }
      if (audioRef.current) { try { audioRef.current.pause() } catch { /* */ } }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
      reproduciendoRef.current = false
      setReproduciendo(false)
    }
  }

  async function cerrarSesion() {
    await supabase.auth.signOut(); router.push('/login'); router.refresh()
  }

  async function generarReporte() {
    const sessionStartedAt = sessionStartedAtRef.current
    const sessionStartedAtMs = new Date(sessionStartedAt).getTime()
    const mensajesDeReporte = mensajes.filter((m: MensajeChat) => {
      if (!m.timestamp || !Number.isFinite(sessionStartedAtMs)) return true
      return new Date(m.timestamp).getTime() >= sessionStartedAtMs - 1000
    })

    // El reporte de hoy consolida TODA la actividad del día en el backend
    // (no solo la materia/sesión activa), así que este mínimo se valida
    // contra toda la conversación acumulada, no solo la ventana reiniciada
    // por el último cambio de materia.
    if (mensajes.length < 3) {
      setError(idiomaIngles ? 'There is not enough activity yet to generate today\'s report.' : 'Todavía no hay suficiente actividad para generar el reporte de hoy.')
      return
    }
    setGenerandoPDF(true)
    try {
      const adaptacionesParaReporte = adaptacionesDificultad.slice(-8).filter((adaptacion, index, all) => {
        const key = `${adaptacion.tipo}-${adaptacion.nivel_anterior}-${adaptacion.nivel_nuevo}-${adaptacion.motivo}`
        return all.findIndex((item) => `${item.tipo}-${item.nivel_anterior}-${item.nivel_nuevo}-${item.motivo}` === key) === index
      })
      const res = await fetch('/api/reporte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          historial: mensajesDeReporte.map(m => ({ rol: m.rol, contenido: m.contenido })),
          session_started_at: sessionStartedAt,
          grado: gradoAlumno,
          materia: materiaAlumno,
          colegio: usuario.colegio?.nombre,
          adaptaciones_dificultad: adaptacionesParaReporte,
          nivel_dificultad_final: nivelDificultad,
          aciertos_consecutivos: aciertosConsec,
          idioma_ingles: idiomaIngles,
        })
      })
      const data = await res.json()
      if (!data.analisis) return

      const L = idiomaIngles ? {
        reportSubtitle: 'Today\'s report for family',
        defaultSchool: 'School',
        student: 'Student',
        gradeSubject: (g: string, m: string) => `Grade: ${g}  |  Subject: ${m}`,
        duration: (d: string) => `Duration: ${d}`,
        interactions: 'Interactions',
        exercises: 'Graded exercises',
        accuracy: 'Accuracy',
        accuracyInsufficient: 'Not enough to evaluate',
        difficulty: 'Difficulty',
        inProgress: 'In progress',
        level: (n: number) => `Level ${n}`,
        pedagogicalInsight: 'Pedagogical insight',
        defaultSummary: 'Session recorded with academic support.',
        wellbeingSafety: 'Wellbeing and emotional safety',
        safetyIntegrity: 'Safety and academic integrity',
        difficultyPath: 'Adaptive difficulty path',
        wentUp: (a: number, b: number) => `Went up from level ${a} to ${b}`,
        wentDown: (a: number, b: number) => `Went down from level ${a} to ${b}`,
        reinforced: (n: number) => `Reinforced basics at level ${n}`,
        whatTheyStudied: 'What they studied today (all subjects)',
        evidenceStatus: 'Evidence status',
        achievementsNextSteps: 'Achievements and next steps',
        achievementsObserved: 'Achievements observed',
        defaultAchievement: 'Participated in practice and progressed with guidance.',
        areasToReinforce: 'Areas to reinforce',
        defaultArea: 'Practice the step-by-step procedure and explain how they reached each answer.',
        homeSupport: 'Support at home',
        defaultHomeSupport: 'Ask them to explain an exercise in their own words and close with a short practice.',
        nextSessionPlan: 'Suggested plan for the next session',
        defaultPlan: 'Practice one idea at a time and explain the process before moving on.',
        materialConsulted: 'Classes worked on today',
        annexTitle: 'ANNEX: ACTIVITY EVIDENCE',
        noEvidence: 'There is not yet any recorded activity today to show as evidence.',
        recorded: 'Recorded',
        subject: (t: string) => `Subject: ${t}`,
        topic: (t: string) => `Topic: ${t}`,
        exercise: (t: string) => `Activity: ${t}`,
        studentAnswer: (t: string) => `Student wrote: ${t}`,
        source: (t: string) => `Source: ${t}`,
        footer: 'Owlaris - Family pedagogical report - owlaris.app',
        page: (i: number, total: number) => `Page ${i} of ${total}`,
        sessionShort: (m: number) => (m <= 1 ? '1 min' : m + ' minutes'),
        shortSession: 'short session',
        timezoneLabel: 'Guatemala time (GMT-6)',
      } : {
        reportSubtitle: 'Reporte de hoy para familia',
        defaultSchool: 'Centro educativo',
        student: 'Alumno',
        gradeSubject: (g: string, m: string) => `Grado: ${g}  |  Materia: ${m}`,
        duration: (d: string) => `Duración: ${d}`,
        interactions: 'Interacciones',
        exercises: 'Ejercicios calificables',
        accuracy: 'Precisión',
        accuracyInsufficient: 'Insuficiente para evaluar',
        difficulty: 'Dificultad',
        inProgress: 'En curso',
        level: (n: number) => `Nivel ${n}`,
        pedagogicalInsight: 'Lectura pedagógica',
        defaultSummary: 'Sesión registrada con acompañamiento académico.',
        wellbeingSafety: 'Bienestar y seguridad emocional',
        safetyIntegrity: 'Seguridad y honestidad académica',
        difficultyPath: 'Ruta de dificultad adaptativa',
        wentUp: (a: number, b: number) => `Subió de nivel ${a} a ${b}`,
        wentDown: (a: number, b: number) => `Bajó de nivel ${a} a ${b}`,
        reinforced: (n: number) => `Reforzó bases en nivel ${n}`,
        whatTheyStudied: 'Qué estudió hoy (todas las materias)',
        evidenceStatus: 'Estado de la evidencia',
        achievementsNextSteps: 'Logros y próximos pasos',
        achievementsObserved: 'Logros observados',
        defaultAchievement: 'Participó en la práctica y avanzó con guía.',
        areasToReinforce: 'Áreas para reforzar',
        defaultArea: 'Practicar el procedimiento paso a paso y explicar cómo llegó a cada respuesta.',
        homeSupport: 'Acompañamiento en casa',
        defaultHomeSupport: 'Pedirle que explique un ejercicio con sus propias palabras y cerrar con una práctica corta.',
        nextSessionPlan: 'Plan sugerido para la próxima sesión',
        defaultPlan: 'Practicar una idea a la vez y explicar el proceso antes de avanzar.',
        materialConsulted: 'Clases trabajadas hoy',
        annexTitle: 'ANEXO: EVIDENCIA DE ACTIVIDAD',
        noEvidence: 'Todavía no hay actividad registrada hoy para mostrar como evidencia.',
        recorded: 'Registrada',
        subject: (t: string) => `Materia: ${t}`,
        topic: (t: string) => `Tema: ${t}`,
        exercise: (t: string) => `Actividad: ${t}`,
        studentAnswer: (t: string) => `El estudiante escribió: ${t}`,
        source: (t: string) => `Fuente: ${t}`,
        footer: 'Owlaris - Informe pedagogico familiar - owlaris.app',
        page: (i: number, total: number) => `Página ${i} de ${total}`,
        sessionShort: (m: number) => (m <= 1 ? '1 min' : m + ' minutos'),
        shortSession: 'sesión corta',
        timezoneLabel: 'Hora de Guatemala (GMT-6)',
      }

      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      // Hallazgo real (QA Ronda 3, 2026-07-10, confirmado reproducible en
      // Anexo B): las fuentes estándar de jsPDF (helvetica) solo soportan
      // el rango Latin-1. Cuando el anexo de evidencia incluye texto crudo
      // del alumno con emojis (fuera de ese rango), jsPDF los codifica mal
      // y el PDF muestra texto corrupto (mojibake), aunque el chat en vivo
      // los muestre bien. Se sanea (sanitizarTextoPdf) cualquier texto antes
      // de dibujarlo en el PDF.
      const _docTextOriginal = doc.text.bind(doc)
      doc.text = ((texto: unknown, ...rest: unknown[]) =>
        (_docTextOriginal as (...args: unknown[]) => typeof doc)(sanitizarTextoPdf(texto), ...rest)) as typeof doc.text
      const _docSplitOriginal = doc.splitTextToSize.bind(doc)
      doc.splitTextToSize = ((texto: unknown, ...rest: unknown[]) =>
        (_docSplitOriginal as (...args: unknown[]) => string[])(sanitizarTextoPdf(texto), ...rest)) as typeof doc.splitTextToSize
      const W = 210
      const H = 297
      const margin = 16
      const maxW = W - margin * 2
      let y = 0
      const palette = {
        ink: [20, 28, 45],
        muted: [96, 110, 130],
        violet: [109, 40, 217],
        blue: [37, 99, 235],
        teal: [14, 116, 144],
        green: [22, 163, 74],
        amber: [180, 83, 9],
        line: [226, 232, 240],
      }
      const setColor = (color: number[]) => doc.setTextColor(color[0], color[1], color[2])
      const addPage = () => { doc.addPage(); y = 20 }
      const checkY = (needed = 10) => { if (y + needed > 276) addPage() }
      const text = (value: string, x: number, yy: number, size: number, bold = false, color = palette.ink) => {
        doc.setFontSize(size); doc.setFont('helvetica', bold ? 'bold' : 'normal'); setColor(color)
        doc.text(String(value || ''), x, yy)
      }
      const wrapped = (value: string, x: number, yy: number, width: number, size = 9.5, color = palette.muted, bold = false) => {
        doc.setFontSize(size); doc.setFont('helvetica', bold ? 'bold' : 'normal'); setColor(color)
        const lines = doc.splitTextToSize(String(value || ''), width)
        doc.text(lines, x, yy)
        return lines.length * (size * 0.38 + 1.6)
      }
      const section = (title: string, color = palette.violet) => {
        checkY(14)
        doc.setFillColor(color[0], color[1], color[2]); doc.roundedRect(margin, y, 3, 7, 1, 1, 'F')
        text(title, margin + 7, y + 5.2, 10, true, color)
        y += 13
      }
      const metricCard = (x: number, yy: number, w: number, title: string, value: string, color: number[]) => {
        doc.setFillColor(255, 255, 255); doc.roundedRect(x, yy, w, 23, 3, 3, 'F')
        doc.setDrawColor(palette.line[0], palette.line[1], palette.line[2]); doc.roundedRect(x, yy, w, 23, 3, 3, 'S')
        text(title, x + 5, yy + 7, 7.5, true, palette.muted)
        // Encoge el tamaño del valor si no cabe en la tarjeta (ej. "Insuficiente
        // para evaluar" es mucho más largo que "85%" o "Nivel 1") en vez de
        // dejar que el texto se salga de la caja hacia la siguiente tarjeta.
        const maxValueWidth = w - 10
        let valueSize = 12
        doc.setFont('helvetica', 'bold'); doc.setFontSize(valueSize)
        while (valueSize > 7 && doc.getTextWidth(String(value || '')) > maxValueWidth) {
          valueSize -= 0.5
          doc.setFontSize(valueSize)
        }
        text(value, x + 5, yy + 16, valueSize, true, color)
      }
      const bulletList = (items: string[], color: number[], width = maxW - 8) => {
        for (const item of items.filter(Boolean).slice(0, 5)) {
          checkY(9)
          doc.setFillColor(color[0], color[1], color[2]); doc.circle(margin + 2, y - 1.5, 1.3, 'F')
          y += wrapped(item, margin + 7, y, width, 9.2, palette.ink)
        }
        y += 2
      }

      const msgsConFecha = mensajesDeReporte.filter((m: MensajeChat) => m.timestamp)
      let durStr = ''
      if (msgsConFecha.length >= 2) {
        const ini = new Date(msgsConFecha[0].timestamp).getTime()
        const fin = new Date(msgsConFecha[msgsConFecha.length - 1].timestamp).getTime()
        const mins = Math.round((fin - ini) / 60000)
        durStr = L.sessionShort(mins)
      }
      const alumnoNombre = nombreAlumno || usuario.nombre_completo
      const estudianteMsgs = mensajesDeReporte.filter(m => m.rol === 'usuario').length
      const metricasHoy = data.analisis.metricas_hoy || {}
      const evidenciaHoy = Array.isArray(data.analisis.evidencia_hoy) ? data.analisis.evidencia_hoy : []
      // Clases trabajadas hoy: nombres de materia legibles (ej. "Biology"),
      // nunca el nombre técnico del archivo fuente (ej. "Owlaris - Biology.md").
      const clasesTrabajadas = Array.isArray(metricasHoy.materias) && metricasHoy.materias.length
        ? metricasHoy.materias
        : [materiaAlumno].filter(Boolean)
      const temasPorMateria = Array.isArray(data.analisis.temas_por_materia) ? data.analisis.temas_por_materia : []
      const temas = Array.isArray(data.analisis.temas) ? data.analisis.temas : []
      const logros = Array.isArray(data.analisis.logros) ? data.analisis.logros : []
      const mejoras = Array.isArray(data.analisis.areas_mejora) ? data.analisis.areas_mejora : []
      const familia = Array.isArray(data.analisis.recomendaciones_familia) ? data.analisis.recomendaciones_familia : []
      const alumnoRecs = Array.isArray(data.analisis.recomendaciones_alumno) ? data.analisis.recomendaciones_alumno : []
      const duracionSesion = metricasHoy.duracion_minutos ? L.sessionShort(metricasHoy.duracion_minutos) : durStr || L.shortSession
      const resumenDificultad = data.analisis.resumen_dificultad || (
        adaptacionesParaReporte.length
          ? adaptacionesParaReporte.map(a => a.motivo).join(' ')
          : `${L.level(nivelDificultad)}.`
      )

      doc.setFillColor(247, 250, 252); doc.rect(0, 0, W, H, 'F')
      doc.setFillColor(20, 28, 45); doc.roundedRect(10, 10, W - 20, 45, 5, 5, 'F')
      doc.setFillColor(14, 116, 144); doc.roundedRect(10, 50, W - 20, 5, 2, 2, 'F')
      text('Owlaris', margin, 28, 23, true, [255, 255, 255])
      text(L.reportSubtitle, margin, 39, 12, false, [226, 232, 240])
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(226, 232, 240)
      doc.text(usuario.colegio?.nombre || L.defaultSchool, W - margin, 29, { align: 'right' })
      // timeZone explícito: sin esto, la fecha/hora se muestra en el huso
      // horario del dispositivo donde se genera el PDF (que puede no ser
      // Guatemala), no en la hora real del colegio.
      doc.text(new Date().toLocaleString(idiomaIngles ? 'en-US' : 'es-GT', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', timeZone: 'America/Guatemala' }), W - margin, 39, { align: 'right' })
      doc.setFontSize(7.5); doc.setTextColor(148, 163, 184)
      doc.text(L.timezoneLabel, W - margin, 44, { align: 'right' })

      y = 68
      doc.setFillColor(255, 255, 255); doc.roundedRect(margin, y, maxW, 42, 4, 4, 'F')
      doc.setDrawColor(palette.line[0], palette.line[1], palette.line[2]); doc.roundedRect(margin, y, maxW, 42, 4, 4, 'S')
      text(L.student, margin + 6, y + 9, 8, true, palette.muted)
      text(alumnoNombre, margin + 6, y + 19, 14, true, palette.ink)
      text(L.gradeSubject(gradoAlumno || (idiomaIngles ? 'Not assigned' : 'No asignado'), materiaAlumno || (idiomaIngles ? 'Not selected' : 'No seleccionada')), margin + 6, y + 28, 8.5, false, palette.muted)
      text(L.duration(duracionSesion), margin + 6, y + 36, 8.3, false, palette.muted)
      y += 53

      const cardW = (maxW - 9) / 4
      metricCard(margin, y, cardW, L.interactions, String(metricasHoy.interacciones ?? mensajesDeReporte.length), palette.blue)
      metricCard(margin + cardW + 3, y, cardW, L.exercises, String(metricasHoy.ejercicios ?? estudianteMsgs), palette.teal)
      metricCard(margin + (cardW + 3) * 2, y, cardW, L.accuracy, metricasHoy.precision !== null && metricasHoy.precision !== undefined ? `${metricasHoy.precision}%` : L.accuracyInsufficient, palette.green)
      metricCard(margin + (cardW + 3) * 3, y, cardW, L.difficulty, L.level(nivelDificultad), palette.violet)
      y += 35

      section(L.pedagogicalInsight, palette.violet)
      doc.setFillColor(255, 255, 255); doc.roundedRect(margin, y - 3, maxW, 30, 4, 4, 'F')
      doc.setDrawColor(palette.line[0], palette.line[1], palette.line[2]); doc.roundedRect(margin, y - 3, maxW, 30, 4, 4, 'S')
      wrapped(data.analisis.resumen || L.defaultSummary, margin + 6, y + 6, maxW - 12, 9.5, palette.ink)
      y += 40

      // Hallazgo real (QA Ronda 3, 2026-07-10): las revelaciones de
      // bienestar (trastorno alimenticio, violencia familiar, oferta de
      // sustancias) quedaban invisibles para la familia, mezcladas con el
      // texto de honestidad académica. Se muestra como su propia sección,
      // primero — un padre necesita ver esto antes que una sospecha de
      // copia académica.
      const bienestarSeguridad: string[] = Array.isArray(data.analisis.bienestar_seguridad) ? data.analisis.bienestar_seguridad : []
      if (bienestarSeguridad.length > 0) {
        section(L.wellbeingSafety, [185, 28, 28])
        const boxH = bienestarSeguridad.reduce((acc, item) => acc + (doc.splitTextToSize(item, maxW - 12).length * (8.8 * 0.38 + 1.6)), 8)
        checkY(boxH + 6)
        doc.setFillColor(254, 242, 242); doc.roundedRect(margin, y - 3, maxW, boxH + 6, 4, 4, 'F')
        doc.setDrawColor(220, 38, 38); doc.roundedRect(margin, y - 3, maxW, boxH + 6, 4, 4, 'S')
        let yBienestar = y + 5
        for (const item of bienestarSeguridad) {
          yBienestar += wrapped(item, margin + 6, yBienestar, maxW - 12, 8.8, [127, 29, 29])
        }
        y = yBienestar + 10
      }

      const seguridadIntegridad: string[] = Array.isArray(data.analisis.seguridad_integridad) ? data.analisis.seguridad_integridad : []
      if (seguridadIntegridad.length > 0) {
        section(L.safetyIntegrity, [185, 28, 28])
        const boxH = seguridadIntegridad.reduce((acc, item) => acc + (doc.splitTextToSize(item, maxW - 12).length * (8.8 * 0.38 + 1.6)), 8)
        checkY(boxH + 6)
        doc.setFillColor(254, 242, 242); doc.roundedRect(margin, y - 3, maxW, boxH + 6, 4, 4, 'F')
        doc.setDrawColor(220, 38, 38); doc.roundedRect(margin, y - 3, maxW, boxH + 6, 4, 4, 'S')
        let yAlerta = y + 5
        for (const item of seguridadIntegridad) {
          yAlerta += wrapped(item, margin + 6, yAlerta, maxW - 12, 8.8, [127, 29, 29])
        }
        y = yAlerta + 10
      }

      section(L.difficultyPath, palette.teal)
      const rutaH = adaptacionesParaReporte.length ? 44 : 26
      doc.setFillColor(236, 253, 245); doc.roundedRect(margin, y - 3, maxW, rutaH, 4, 4, 'F')
      wrapped(resumenDificultad, margin + 6, y + 5, maxW - 12, 8.8, [22, 101, 52])
      y += 22
      for (const a of adaptacionesParaReporte.slice(-3)) {
        const label = a.tipo === 'sube'
          ? L.wentUp(a.nivel_anterior, a.nivel_nuevo)
          : a.tipo === 'baja'
            ? L.wentDown(a.nivel_anterior, a.nivel_nuevo)
            : L.reinforced(a.nivel_nuevo)
        text(label, margin + 8, y, 8.3, true, a.tipo === 'sube' ? palette.green : palette.amber)
        y += 5
      }
      y += 10

      section(L.whatTheyStudied, palette.blue)
      if (temasPorMateria.length > 0) {
        // Punto 9: un bloque por materia (ej. "Biology: Genética, Ecosistemas"),
        // para que el resumen no se limite a la materia activa al descargar.
        bulletList(
          temasPorMateria.slice(0, 6).map((tm: { materia?: string; temas?: string[] }) =>
            `${tm.materia || ''}: ${(tm.temas || []).slice(0, 4).join(', ') || '—'}`
          ),
          palette.teal
        )
      } else {
        bulletList((data.analisis.materias_estudiadas || [materiaAlumno].filter(Boolean)).slice(0, 4), palette.teal)
        const temasHoy = Array.isArray(metricasHoy.temas) && metricasHoy.temas.length ? metricasHoy.temas : temas
        if (temasHoy.length > 0) bulletList(temasHoy.slice(0, 5), palette.violet)
      }

      if (metricasHoy.estado_evidencia && data.analisis.frase_evidencia) {
        section(L.evidenceStatus, palette.amber)
        doc.setFillColor(255, 251, 235); doc.roundedRect(margin, y - 3, maxW, 20, 4, 4, 'F')
        wrapped(data.analisis.frase_evidencia, margin + 6, y + 5, maxW - 12, 8.8, [146, 64, 14])
        y += 28
      }

      section(L.achievementsNextSteps, palette.green)
      const colW = (maxW - 6) / 2
      const colY = y
      doc.setFillColor(240, 253, 244); doc.roundedRect(margin, colY, colW, 50, 4, 4, 'F')
      doc.setFillColor(255, 251, 235); doc.roundedRect(margin + colW + 6, colY, colW, 50, 4, 4, 'F')
      text(L.achievementsObserved, margin + 5, colY + 8, 8.5, true, palette.green)
      wrapped((logros[0] || data.analisis.avances || L.defaultAchievement).toString(), margin + 5, colY + 16, colW - 10, 8.4, palette.ink)
      text(L.areasToReinforce, margin + colW + 11, colY + 8, 8.5, true, palette.amber)
      wrapped((mejoras[0] || L.defaultArea).toString(), margin + colW + 11, colY + 16, colW - 10, 8.4, palette.ink)
      y = colY + 62

      section(L.homeSupport, palette.amber)
      bulletList(familia.length ? familia : [L.defaultHomeSupport], palette.amber)

      if (data.analisis.frase_motivacional) {
        checkY(24)
        doc.setFillColor(238, 242, 255); doc.roundedRect(margin, y, maxW, 22, 4, 4, 'F')
        doc.setFontSize(10); doc.setFont('helvetica','italic'); doc.setTextColor(palette.violet[0], palette.violet[1], palette.violet[2])
        const fmLines = doc.splitTextToSize('"' + data.analisis.frase_motivacional + '"', maxW - 14)
        doc.text(fmLines, W / 2, y + 8, { align: 'center' }); y += 30
      }

      addPage()
      section(L.nextSessionPlan, palette.violet)
      bulletList(alumnoRecs.length ? alumnoRecs : [L.defaultPlan], palette.blue)
      if (clasesTrabajadas.length > 0) {
        section(L.materialConsulted, palette.teal)
        bulletList(clasesTrabajadas.slice(0, 6), palette.teal)
      }

      addPage()
      doc.setFillColor(20,28,45); doc.rect(0, 0, W, 16, 'F')
      doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255)
      doc.text(L.annexTitle, margin, 11); y = 20
      doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(palette.muted[0], palette.muted[1], palette.muted[2])
      doc.text(L.timezoneLabel, margin, y); y = 30
      if (evidenciaHoy.length === 0) {
        wrapped(L.noEvidence, margin, y, maxW, 9.2, palette.muted)
        y += 12
      }
      for (const item of evidenciaHoy) {
        // item.resultado ya distingue calificable de no calificable (una
        // nota concreta, o literalmente "No calificable") — agregar una
        // segunda etiqueta aparte producía un duplicado visible como
        // "No calificable · No calificable" en filas no calificables.
        const header = `#${item.secuencia || ''} ${item.hora ? '· ' + item.hora : ''} · ${item.resultado || L.recorded}`
        const detail = [
          item.materia ? L.subject(item.materia) : null,
          item.tema ? L.topic(item.tema) : null,
          item.ejercicio ? L.exercise(item.ejercicio) : null,
          item.respuesta_estudiante ? L.studentAnswer(item.respuesta_estudiante) : null,
          item.fuente ? L.source(item.fuente) : null,
        ].filter(Boolean).join('\n')
        const detailLines = doc.splitTextToSize(detail, maxW - 16)
        const boxH = detailLines.length * 4.4 + 14
        checkY(boxH)
        doc.setFillColor(255, 255, 255)
        doc.roundedRect(margin, y - 5, maxW, boxH, 3, 3, 'F')
        doc.setDrawColor(palette.line[0], palette.line[1], palette.line[2]); doc.roundedRect(margin, y - 5, maxW, boxH, 3, 3, 'S')
        doc.setFontSize(8); doc.setFont('helvetica','bold')
        doc.setTextColor(palette.violet[0], palette.violet[1], palette.violet[2])
        doc.text(header, margin + 4, y + 1)
        doc.setFontSize(8.7); doc.setFont('helvetica','normal'); doc.setTextColor(30,41,59)
        doc.text(detailLines, margin + 4, y + 8); y += boxH + 4
      }
      const totalPages = doc.getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i); doc.setFillColor(248,250,252); doc.rect(0, 285, W, 12, 'F')
        doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(100,116,139)
        doc.text(L.footer, margin, 291)
        doc.text(L.page(i, totalPages), W - margin, 291, { align:'right' })
      }
      const fecha = new Date().toISOString().split('T')[0]
      doc.save(`Owlaris-Reporte-${(nombreAlumno || usuario.nombre_completo).replace(/ /g,'-')}-${fecha}.pdf`)
      // Hallazgo real (auditoría QA 2026-07-07): el botón solo mostraba
      // "Generando..." y volvía a su estado normal sin ninguna confirmación
      // visible, así que un alumno/familia no sabía si ya se había
      // descargado el PDF y volvía a hacer clic, generando duplicados.
      setReportePdfListo(true)
      if (reportePdfListoTimeoutRef.current) clearTimeout(reportePdfListoTimeoutRef.current)
      reportePdfListoTimeoutRef.current = setTimeout(() => setReportePdfListo(false), 8000)
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
      <style suppressHydrationWarning>{`
        .owlaris-root { min-height:100vh; display:flex; flex-direction:row; background:#F8F7FF; background-image:radial-gradient(ellipse at 15% 0%,rgba(109,40,217,.06) 0%,transparent 55%),radial-gradient(ellipse at 85% 100%,rgba(14,165,233,.05) 0%,transparent 50%); font-family:"Plus Jakarta Sans",sans-serif; }
        .o-main-col { flex:1; min-width:0; display:flex; flex-direction:column; min-height:100vh; }
        .o-header { background:rgba(255,255,255,.88); backdrop-filter:blur(24px); border-bottom:1px solid rgba(109,40,217,.08); box-shadow:0 1px 24px rgba(109,40,217,.06); position:sticky; top:0; z-index:50; padding:14px 24px; }
        .o-sidebar { width:268px; background:rgba(255,255,255,.94); backdrop-filter:blur(24px); border-right:1px solid rgba(109,40,217,.08); box-shadow:0 0 40px rgba(109,40,217,.05); display:flex; flex-direction:column; padding:22px 16px 18px; gap:16px; position:fixed; top:0; left:0; bottom:0; z-index:70; transform:translateX(-100%); transition:transform .28s cubic-bezier(.4,0,.2,1); overflow-y:auto; }
        .o-sidebar.abierto { transform:translateX(0); box-shadow:0 0 60px rgba(20,10,60,.28); }
        .o-sidebar-overlay { position:fixed; inset:0; background:rgba(15,10,40,.4); backdrop-filter:blur(2px); z-index:65; animation:oFadeIn .2s ease; }
        @keyframes oFadeIn { from{opacity:0} to{opacity:1} }
        .o-topbar-mobile { display:flex; align-items:center; gap:12px; padding:12px 18px; background:rgba(255,255,255,.9); backdrop-filter:blur(20px); border-bottom:1px solid rgba(109,40,217,.08); position:sticky; top:0; z-index:40; }
        .o-chat-header { display:flex; align-items:center; gap:16px; flex-wrap:wrap; padding:14px 20px; background:rgba(255,255,255,.85); backdrop-filter:blur(20px); border-bottom:1px solid rgba(109,40,217,.08); }
        .o-chat-header-materia { font-family:'Syne',sans-serif; font-size:17px; font-weight:700; color:#1E1B4B; letter-spacing:-.3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .o-chat-header-sub { font-size:12px; color:#9490B8; font-weight:500; margin-top:1px; }
        .o-chat-stat { display:flex; align-items:center; gap:5px; background:rgba(109,40,217,.05); border:1px solid rgba(109,40,217,.08); border-radius:10px; padding:6px 10px; }
        .o-chat-stat span { font-size:13px; font-weight:700; color:#1E1B4B; }
        .o-chat-stat small { font-size:10px; color:#9490B8; font-weight:600; white-space:nowrap; }
        .o-hamburger { width:38px; height:38px; border-radius:11px; border:1px solid rgba(109,40,217,.15); background:#F3F0FF; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; transition:all .2s; }
        .o-hamburger:hover { background:#EAE3FF; }
        .o-sidebar-reopen { position:fixed; top:18px; left:18px; width:38px; height:38px; border-radius:11px; border:1px solid rgba(109,40,217,.15); background:white; align-items:center; justify-content:center; cursor:pointer; z-index:60; box-shadow:0 2px 12px rgba(109,40,217,.12); transition:all .2s; }
        .o-sidebar-reopen:hover { background:#F3F0FF; }
        .o-sidebar-section-title { font-size:10px; font-weight:700; letter-spacing:1.1px; text-transform:uppercase; color:#B0A8D9; margin:2px 0 2px 4px; }
        .o-sidebar-status { display:flex; align-items:center; gap:8px; background:rgba(109,40,217,.06); border:1px solid rgba(109,40,217,.1); border-radius:12px; padding:9px 12px; font-size:12px; font-weight:600; color:#5B21B6; }
        .o-sidebar-divider { height:1px; background:rgba(109,40,217,.08); margin:2px 0; flex-shrink:0; }
        .o-sidebar-idioma { width:100%; justify-content:center; }
        .o-sidebar-reopen { display:none; }
        @media (min-width:960px) {
          .o-sidebar { position:sticky; top:0; height:100vh; transform:none; box-shadow:none; }
          .o-sidebar.colapsado { width:0; padding:0; border:none; overflow:hidden; }
          .o-sidebar-overlay { display:none; }
          .o-sidebar-reopen { display:flex; }
          .o-topbar-mobile { display:none; }
        }
        .bbl-tutor { background:white; border:1px solid rgba(109,40,217,.1); border-radius:4px 20px 20px 20px; box-shadow:0 2px 20px rgba(109,40,217,.08); position:relative; }
        .bbl-tutor::before { content:""; position:absolute; top:0; left:0; width:3px; height:100%; background:linear-gradient(180deg,#7C3AED,#0EA5E9); }
        .bbl-user { background:linear-gradient(135deg,#6D28D9,#5B21B6); border-radius:20px 4px 20px 20px; box-shadow:0 4px 20px rgba(109,40,217,.3); }
        .o-chip { background:white; border:1px solid rgba(109,40,217,.12); border-radius:20px; padding:8px 14px; font-size:12px; font-weight:500; color:#6D28D9; cursor:pointer; transition:all .2s; display:flex; align-items:center; gap:5px; white-space:nowrap; font-family:"Plus Jakarta Sans",sans-serif; box-shadow:0 1px 8px rgba(109,40,217,.06); }
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
        .o-fuente { display:inline-flex; align-items:center; gap:4px; background:rgba(100,116,139,.06); border:1px solid rgba(100,116,139,.15); border-radius:6px; padding:3px 9px; font-size:10px; font-weight:600; color:#64748B; margin-top:10px; letter-spacing:.3px; cursor:default; }
        .o-avatar-ring { background:linear-gradient(135deg,#7C3AED,#0EA5E9); padding:2px; border-radius:50%; }
        .estado-badge { display:inline-flex; align-items:center; gap:6px; background:rgba(109,40,217,.08); border:1px solid rgba(109,40,217,.15); border-radius:20px; padding:4px 12px; font-size:11px; font-weight:600; color:#7C3AED; }
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      `}</style>

      <div className="owlaris-root">
        {/* PANEL DE GRADOS */}
        {mostrandoGrados && (() => {
          const esUS = gradosDisponibles.length > 0 && gradosDisponibles.every(g => /^Grado \d+$/.test(g))
          const grupos: { titulo: string; grados: string[] }[] = []
          if (esUS) {
            const middle = gradosDisponibles.filter(g => ['Grado 6','Grado 7','Grado 8','Grado 9'].includes(g))
            const high = gradosDisponibles.filter(g => ['Grado 10','Grado 11','Grado 12'].includes(g))
            const otros = gradosDisponibles.filter(g => !middle.includes(g) && !high.includes(g))
            if (middle.length) grupos.push({ titulo: 'Middle School', grados: middle })
            if (high.length) grupos.push({ titulo: 'High School', grados: high })
            if (otros.length) grupos.push({ titulo: idiomaIngles ? 'Other' : 'Otros', grados: otros })
          } else {
            const prim = gradosDisponibles.filter(g => /prim/i.test(g))
            const bas = gradosDisponibles.filter(g => /b[aá]sico/i.test(g))
            const bach = gradosDisponibles.filter(g => /bach/i.test(g))
            const otros = gradosDisponibles.filter(g => !prim.includes(g) && !bas.includes(g) && !bach.includes(g))
            if (prim.length) grupos.push({ titulo: 'Primaria', grados: prim })
            if (bas.length) grupos.push({ titulo: 'Básico', grados: bas })
            if (bach.length) grupos.push({ titulo: 'Bachillerato', grados: bach })
            if (otros.length) grupos.push({ titulo: idiomaIngles ? 'Other' : 'Otros', grados: otros })
          }
          const numeroDe = (g: string) => g.startsWith('Grado ') ? g.replace('Grado ','') : g.split(' ')[0]
          const etiquetaDe = (g: string) => g.startsWith('Grado ') ? 'Grade' : g.split(' ').slice(1).join(' ')
          const confirmar = async () => {
            if (!gradoTemp) return
            const grado = gradoTemp
            setMostrandoGrados(false)
            setGradoTemp('')
            setGradoAlumno(grado)
            setMateriaAlumno('')
            setSugerencias([])
            setEstadoChat('esperando_materia')
            reiniciarVentanaReporte()
            await supabase.from('usuarios').update({ grado }).eq('id', usuario.id)
            const res: Response = await fetch('/api/preguntar', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                pregunta: '__CARGAR_MATERIAS__',
                estado: 'esperando_materia',
                grado_override: grado,
                user_id: usuario.id,
                idioma_ingles: idiomaIngles,
                nombre_alumno: nombreAlumno,
              })
            })
            const data = await res.json()
            if (data.materias_disponibles) {
              materiasDisponiblesRef.current = data.materias_disponibles
              materiasBaseRef.current = data.materias_disponibles
              setChipsMateria(traducirChips(data.materias_disponibles, idiomaIngles))
              setEstadoChat('esperando_materia')
            }
          }
          return (
            <div style={{position:'fixed',inset:0,zIndex:100,background:'linear-gradient(135deg,rgba(26,16,64,.97) 0%,rgba(13,8,38,.97) 100%)',backdropFilter:'blur(16px)',display:'flex',alignItems:'center',justifyContent:'center',padding:'20px',overflowY:'auto'}}
              onClick={e => { if(e.target===e.currentTarget) { setMostrandoGrados(false); setGradoTemp('') } }}>
              <div style={{width:'100%',maxWidth:'480px'}}>
                <div style={{textAlign:'center',marginBottom:'28px'}}>
                  <div style={{width:'56px',height:'56px',borderRadius:'16px',background:'rgba(124,58,237,.2)',border:'1px solid rgba(124,58,237,.4)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                  </div>
                  <p style={{fontSize:'24px',fontWeight:800,color:'white',margin:'0 0 6px',letterSpacing:'-0.5px',fontFamily:"'Syne',sans-serif"}}>
                    {idiomaIngles ? 'What grade are you in?' : '¿En qué grado estás?'}
                  </p>
                  <p style={{fontSize:'14px',color:'rgba(255,255,255,.45)',margin:0}}>
                    {idiomaIngles ? 'Select your grade to see your subjects' : 'Selecciona tu grado para ver tus materias'}
                  </p>
                </div>
                {grupos.map(grupo => (
                  <div key={grupo.titulo} style={{marginBottom:'20px'}}>
                    <p style={{fontSize:'11px',fontWeight:600,letterSpacing:'1.5px',color:'rgba(167,139,250,.7)',textTransform:'uppercase',margin:'0 0 12px 2px'}}>{grupo.titulo}</p>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(100px,1fr))',gap:'10px'}}>
                      {grupo.grados.map(grado => {
                        const sel = grado === gradoTemp
                        return (
                          <button key={grado} onClick={() => setGradoTemp(grado)}
                            style={{
                              display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'5px',
                              padding:'18px 12px',borderRadius:'14px',
                              border: sel ? '1px solid transparent' : '1px solid rgba(124,58,237,.25)',
                              background: sel ? 'linear-gradient(135deg,#7C3AED,#5B21B6)' : 'rgba(255,255,255,.05)',
                              cursor:'pointer',transition:'all .18s ease',
                              transform: sel ? 'translateY(-2px)' : 'none',
                              boxShadow: sel ? '0 8px 32px rgba(124,58,237,.4)' : 'none',
                            }}>
                            <span style={{fontSize:'26px',fontWeight:800,lineHeight:1,letterSpacing:'-0.5px',color: sel ? 'white' : 'rgba(255,255,255,.6)',fontFamily:"'Syne',sans-serif"}}>{numeroDe(grado)}</span>
                            <span style={{fontSize:'10px',fontWeight:600,letterSpacing:'.8px',textTransform:'uppercase',color: sel ? 'rgba(255,255,255,.75)' : 'rgba(255,255,255,.35)'}}>{etiquetaDe(grado)}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
                <button onClick={confirmar} disabled={!gradoTemp}
                  style={{width:'100%',padding:'15px',borderRadius:'14px',border:'none',
                    background:'linear-gradient(135deg,#7C3AED,#5B21B6)',color:'white',fontSize:'15px',fontWeight:700,
                    cursor: gradoTemp ? 'pointer' : 'not-allowed',
                    opacity: gradoTemp ? 1 : .35,
                    transition:'all .2s',letterSpacing:'-0.2px',marginTop:'8px'}}>
                  {gradoTemp
                    ? (idiomaIngles ? 'Continue with ' : 'Continuar con ') + gradoTemp
                    : (idiomaIngles ? 'Confirm grade' : 'Confirmar grado')}
                </button>
                <p style={{textAlign:'center',fontSize:'12px',color:'rgba(255,255,255,.25)',margin:'16px 0 0'}}>
                  {idiomaIngles ? 'You can change this later' : 'Puedes cambiarlo después'}
                </p>
              </div>
            </div>
          )
        })()}
        {/* Sidebar — sustituye la barra de botones que antes iba sobre el chat */}
        {sidebarAbierto && <div className="o-sidebar-overlay" onClick={()=>setSidebarAbierto(false)} />}
        {/* Hallazgo real (QA 2026-07-14): la "X" del header del sidebar solo
            cerraba el drawer móvil (sidebarAbierto) — en desktop el sidebar
            es sticky con transform:none siempre, así que el botón no hacía
            nada visible. Se agrega sidebarColapsado, real para desktop, con
            este botón flotante para volver a mostrarlo. */}
        {sidebarColapsado && (
          <button className="o-sidebar-reopen" onClick={()=>setSidebarColapsado(false)} aria-label={idiomaIngles ? 'Show sidebar' : 'Mostrar menú'}>
            <PanelLeftOpen size={16} color="#6D28D9"/>
          </button>
        )}
        <aside className={`o-sidebar${sidebarAbierto ? ' abierto' : ''}${sidebarColapsado ? ' colapsado' : ''}`}>
          <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
            <div className="o-avatar-ring" style={{width:'40px',height:'40px',flexShrink:0}}>
              <div style={{background:'white',borderRadius:'50%',width:'36px',height:'36px',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <img src="/buho.png" alt="Owlaris" style={{width:'25px',height:'25px',objectFit:'contain'}}/>
              </div>
            </div>
            <div style={{minWidth:0}}>
              <p style={{fontFamily:"'Syne',sans-serif",fontSize:'16px',fontWeight:700,color:'#1E1B4B',letterSpacing:'-0.4px'}}>Owlaris</p>
              <p style={{fontSize:'10px',color:'#9490B8',fontWeight:500}}>{idiomaIngles ? 'Your academic tutor' : 'Tu tutor académico'}</p>
            </div>
            <button className="o-hamburger" style={{marginLeft:'auto'}}
              onClick={()=>{ setSidebarAbierto(false); setSidebarColapsado(true) }}
              aria-label={idiomaIngles ? 'Hide sidebar' : 'Ocultar menú'}>
              <PanelLeftClose size={16} color="#6D28D9"/>
            </button>
          </div>

          <div className="o-sidebar-divider" />
          <div>
            <p className="o-sidebar-section-title">{idiomaIngles ? 'Language' : 'Idioma'}</p>
            <button onClick={()=>{
              setIdiomaIngles(!idiomaIngles)
              if(modoConversacion) {
                modoConversacionRef.current = false
                setModoConversacion(false)
                if (autoEscuchaTimeoutRef.current) { clearTimeout(autoEscuchaTimeoutRef.current); autoEscuchaTimeoutRef.current = null }
                detenerReconocimientoVoz()
                limpiarVAD()
                if (grabando) { grabacionCanceladaRef.current = true; try { mediaRecorderRef.current?.stop() } catch { /* ya estaba detenida */ } setGrabando(false) }
                reproduciendoRef.current = false
                if (audioRef.current) { try { audioRef.current.pause() } catch { /* */ } }
                if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
                setReproduciendo(false)
              }
            }}
              className="o-sidebar-idioma"
              style={{background:idiomaIngles?'linear-gradient(135deg,#1d4ed8,#1e40af)':'#F3F0FF',border:idiomaIngles?'none':'1px solid rgba(109,40,217,.2)',borderRadius:'10px',padding:'9px 12px',fontSize:'12px',fontWeight:700,color:idiomaIngles?'white':'#7C3AED',cursor:'pointer',display:'flex',alignItems:'center',gap:'6px',transition:'all .2s'}}>
              {idiomaIngles ? '🇪🇸 Español' : '🇬🇧 English'}
            </button>
          </div>

          {(nombreAlumno || gradoAlumno || materiaAlumno) && (
            <>
              <div className="o-sidebar-divider" />
              <div>
                <p className="o-sidebar-section-title">{idiomaIngles ? 'Current session' : 'Sesión actual'}</p>
                <div style={{display:'flex',flexDirection:'column',gap:'7px'}}>
                  {nombreAlumno && <div className="o-sidebar-status"><User size={13} style={{flexShrink:0}}/><span>{nombreAlumno}</span></div>}
                  {gradoAlumno  && <div className="o-sidebar-status"><GraduationCap size={13} style={{flexShrink:0}}/><span>{gradoAlumno}</span></div>}
                  {materiaAlumno && <div className="o-sidebar-status"><BookOpen size={13} style={{flexShrink:0}}/><span>{materiaAlumno}</span></div>}
                </div>
              </div>
            </>
          )}

          {/* Selector de materia — pedido explícito del usuario (QA
              2026-07-14): debe vivir en el sidebar desde el inicio, debajo
              de la sesión actual, no en el footer sobre el input. */}
          {(estadoChat === 'esperando_materia' || estadoChat === 'esperando_materia_olimpiadas') && chipsMateria.length > 0 && (
            <>
              <div className="o-sidebar-divider" />
              <div>
                <p className="o-sidebar-section-title">{idiomaIngles ? 'Choose a subject' : 'Elige una materia'}</p>
                {!mostrandoSubOlimpiadas ? (
                  <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
                    {chipsMateria
                      // El modo "Conversar en Inglés" (voz continua) se
                      // esconde temporalmente: el alumno reportó que quedó
                      // peor que antes. La función sigue en el código para
                      // poder arreglarla sin rehacer todo, pero no debe
                      // poder alcanzarse desde la UI mientras tanto.
                      .filter(mat => !(mat.includes('Conversar') || mat.includes('Conversation') || mat.includes('»')))
                      .map((mat, i) => {
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
                      const iconos: Record<string,LucideIcon> = {
                        'Matemática':Calculator, 'Matematica':Calculator, 'Mathematics':Calculator,
                        'Física':FlaskConical, 'Physics':FlaskConical,
                        'Química':FlaskConical, 'Chemistry':FlaskConical,
                        'Biología':Leaf, 'Biology':Leaf,
                        'Historia':Landmark, 'History':Landmark,
                        'Español':BookOpen, 'Spanish':BookOpen,
                        'Ciencias Naturales':Leaf, 'Natural Sciences':Leaf,
                        'Mineduc - Lenguaje':BookOpen, 'Mineduc - Matemática':Calculator,
                        'Mineduc - Language':BookOpen, 'Mineduc - Mathematics':Calculator,
                      }
                      const bg = esIngles ? 'linear-gradient(135deg,#1d4ed8,#1e40af)' : esOlimpiadas ? 'linear-gradient(135deg,#d97706,#b45309)' : (colores[mat] || 'linear-gradient(135deg,#7C3AED,#5B21B6)')
                      const IconMateria = esIngles ? Mic : esOlimpiadas ? Trophy : (iconos[mat] || GraduationCap)
                      return (
                        <button key={i} className="o-chip"
                          style={{
                            width: '100%',
                            justifyContent: 'flex-start',
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
                              iniciarConversacionIngles()
                              setSidebarAbierto(false)
                            } else {
                              enviarPregunta(mat)
                              setSidebarAbierto(false)
                            }
                          }}>
                          <IconMateria size={15} style={{flexShrink:0}}/><span>{mat}</span>
                        </button>
                      )
                    })}
                    <button className="o-chip"
                      style={{width:'100%',justifyContent:'flex-start',background:'#F3F0FF',color:'#9490B8',border:'1px solid rgba(109,40,217,.08)',fontWeight:500}}
                      onClick={() => setMostrandoGrados(true)}>
                      <GraduationCap size={15} style={{flexShrink:0}}/><span>{idiomaIngles ? 'Change grade' : 'Cambiar grado'}</span>
                    </button>
                  </div>
                ) : (
                  <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
                    <p style={{fontSize:'11px',color:'#b45309',fontWeight:600,marginBottom:'4px',display:'flex',alignItems:'center',gap:'6px'}}>
                      <Trophy size={13}/><span>{idiomaIngles ? 'Science Olympiad — choose subject:' : 'Olimpiadas de Ciencias — elige materia:'}</span>
                    </p>
                    {['Matemática','Biología','Física','Química','Ciencias Naturales'].map(sub => (
                      <button key={sub} className="o-chip"
                        style={{width:'100%',justifyContent:'flex-start',background:'linear-gradient(135deg,#d97706,#b45309)',color:'white',border:'none',fontWeight:600}}
                        onClick={() => { setMostrandoSubOlimpiadas(false); enviarPregunta('Olimpiadas - ' + sub); setSidebarAbierto(false) }}>
                        {sub}
                      </button>
                    ))}
                    <button className="o-chip"
                      style={{width:'100%',justifyContent:'flex-start',background:'#F3F0FF',color:'#6D28D9',border:'1px solid rgba(109,40,217,.12)'}}
                      onClick={() => setMostrandoSubOlimpiadas(false)}>
                      <ArrowLeft size={15} style={{flexShrink:0}}/><span>{idiomaIngles ? 'Back' : 'Regresar'}</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Acciones rápidas — antes vivían en una fila horizontal sobre el
              input; pedido explícito del usuario (QA 2026-07-14): deben ir
              en el sidebar, debajo de la materia activa. */}
          {sugerencias.length>0 && estadoChat==='activo' && (
            <>
              <div className="o-sidebar-divider" />
              <div>
                <p className="o-sidebar-section-title">{idiomaIngles ? 'Quick actions' : 'Acciones rápidas'}</p>
                <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
                  {sugerencias.map((s,i)=>(
                    <button key={i} className="o-chip" style={{width:'100%',justifyContent:'flex-start',whiteSpace:'normal',textAlign:'left'}}
                      onClick={()=>{ enviarPregunta(s.text); setSidebarAbierto(false) }}>
                      <s.icon size={15} color="#7C3AED" style={{flexShrink:0}}/><span>{s.text}</span>
                    </button>
                  ))}
                  <button className="o-chip"
                    style={{width:'100%',justifyContent:'flex-start',background:'#F3F0FF',color:'#9490B8',border:'1px solid rgba(109,40,217,.08)',fontWeight:500}}
                    onClick={() => {
                      setEstadoChat('esperando_materia')
                      setSugerencias([])
                      setMateriaAlumno('')
                      setSidebarAbierto(false)
                    }}>
                    <ArrowLeft size={15} style={{flexShrink:0}}/><span>{idiomaIngles ? 'Menu' : 'Menú'}</span>
                  </button>
                </div>
              </div>
            </>
          )}

          <div style={{flex:1}} />

          <div className="o-sidebar-divider" />
          <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
            <div style={{width:'34px',height:'34px',borderRadius:'50%',background:'linear-gradient(135deg,#7C3AED,#0EA5E9)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 12px rgba(109,40,217,.3)',flexShrink:0}}>
              <span style={{fontSize:'12px',fontWeight:700,color:'white'}}>{iniciales}</span>
            </div>
            <div style={{minWidth:0}}>
              <p style={{fontSize:'13px',fontWeight:600,color:'#1E1B4B',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{usuario.nombre_completo.split(' ')[0]}</p>
              <p style={{fontSize:'10px',color:'#9490B8',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{usuario.colegio?.nombre}</p>
            </div>
          </div>
          <button onClick={cerrarSesion} style={{width:'100%',background:'#F3F0FF',border:'1px solid rgba(109,40,217,.15)',borderRadius:'10px',padding:'9px 13px',fontSize:'12px',fontWeight:500,color:'#7C3AED',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px',fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
            <LogOut size={14}/><span>{idiomaIngles ? 'Log out' : 'Salir'}</span>
          </button>
        </aside>

        <div className="o-main-col">
          {/* Barra superior solo en mobile — el sidebar reemplaza la barra de botones en desktop */}
          <div className="o-topbar-mobile">
            <button className="o-hamburger" onClick={()=>setSidebarAbierto(true)} aria-label="Menu">
              <Menu size={17} color="#6D28D9"/>
            </button>
            <div className="o-avatar-ring" style={{width:'28px',height:'28px'}}>
              <div style={{background:'white',borderRadius:'50%',width:'24px',height:'24px',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <img src="/buho.png" alt="Owlaris" style={{width:'17px',height:'17px',objectFit:'contain'}}/>
              </div>
            </div>
            <p style={{fontFamily:"'Syne',sans-serif",fontSize:'15px',fontWeight:700,color:'#1E1B4B'}}>Owlaris</p>
            {materiaAlumno && <span className="estado-badge" style={{marginLeft:'auto',display:'inline-flex',alignItems:'center',gap:'5px'}}><BookOpen size={12}/>{materiaAlumno}</span>}
          </div>

          {/* Rediseño premium (instructivo 2026-07-14): racha de días
              activos y puntos, calculados con datos reales de
              interacciones (ver /api/progreso-estudiante) — no valores
              decorativos inventados. */}
          {estadoChat === 'activo' && materiaAlumno && (
            <div className="o-chat-header">
              <div style={{minWidth:0}}>
                <p className="o-chat-header-materia">{materiaAlumno}</p>
                <p className="o-chat-header-sub">{gradoAlumno}{gradoAlumno ? ' • ' : ''}{idiomaIngles ? 'Learning session' : 'Sesión de aprendizaje'}</p>
              </div>
              <div style={{marginLeft:'auto',display:'flex',gap:'16px',alignItems:'center',flexShrink:0}}>
                <div className="o-chat-stat">
                  <Flame size={15} color="#F97316"/>
                  <span>{progresoEstudiante.racha}</span>
                  <small>{idiomaIngles ? 'day streak' : 'días activos'}</small>
                </div>
                <div className="o-chat-stat">
                  <Star size={15} color="#EAB308"/>
                  <span>{progresoEstudiante.puntos}</span>
                  <small>{idiomaIngles ? 'points' : 'puntos'}</small>
                </div>
              </div>
            </div>
          )}

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
                      <div style={{fontSize:'14px',lineHeight:'1.8',color:esU?'#EDE9FE':'#2D2B55',whiteSpace:'pre-wrap',fontWeight:400}}>
                        {largo&&!abierto?<>{renderTexto(msg.contenido.substring(0,300))}...</>:renderTextoConTablas(msg.contenido)}
                      </div>
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
        <div ref={footerRef} style={{background:'rgba(248,247,255,.95)',backdropFilter:'blur(20px)',borderTop:'1px solid rgba(109,40,217,.08)',padding:'12px 16px 20px',boxShadow:'0 -4px 24px rgba(109,40,217,.06)'}}>
          <div style={{maxWidth:'800px',margin:'0 auto'}}>
            {/* El selector de materia y las acciones rápidas viven en el
                sidebar (debajo de la sesión actual), no aquí sobre el
                input — pedido explícito del usuario (QA 2026-07-14). */}
            <div className="o-input-wrap" style={{display:'flex',gap:'10px',alignItems:'flex-end',padding:'10px 14px'}}>
              <textarea ref={inputRef} value={pregunta}
                onChange={e=>setPregunta(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();enviarPregunta()}}}
                placeholder={placeholder} rows={2} disabled={cargando}
                style={{flex:1,background:'transparent',border:'none',outline:'none',resize:'none',fontSize:'14px',color:'#1E1B4B',lineHeight:'1.6',fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:400}}
              />
              <button onClick={()=>enviarPregunta()} disabled={cargando||!pregunta.trim()} className="o-send">
                <Send size={18} color="white"/>
              </button>
            </div>
            <p style={{fontSize:'10px',color:'#D4D0EE',textAlign:'center',marginTop:'8px',letterSpacing:'.4px',fontWeight:500}}>
              {idiomaIngles ? 'Owlaris helps you understand, practice, and solve it yourself' : 'Owlaris te ayuda a entender, practicar y resolver por ti mismo'}
            </p>
          </div>
        </div>
        </div>

        {/* MODO CONVERSACIÓN — pantalla completa tipo asistente de voz */}
        {modoConversacion ? (
          <div style={{position:'fixed',inset:0,zIndex:50,background:'linear-gradient(160deg,#F0EBFF 0%,#F8F7FF 50%,#EBF5FF 100%)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'space-between',padding:'24px 20px 40px'}}>

            {/* Header — botón salir */}
            <div style={{width:'100%',display:'flex',justifyContent:'space-between',alignItems:'center',gap:'12px'}}>
              <div style={{background:'rgba(255,255,255,.82)',border:'1px solid rgba(109,40,217,.1)',borderRadius:'14px',padding:'8px 14px',boxShadow:'0 4px 18px rgba(109,40,217,.08)',fontSize:'12px',fontWeight:800,color:'#1E1B4B',letterSpacing:'.2px'}}>
                English Speaking
              </div>
              <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                <button onClick={alternarPausa}
                  style={{background:pausado?'rgba(16,185,129,.1)':'rgba(109,40,217,.08)',border:`1px solid ${pausado?'rgba(16,185,129,.25)':'rgba(109,40,217,.2)'}`,borderRadius:'12px',padding:'8px 16px',fontSize:'12px',fontWeight:600,color:pausado?'#059669':'#6D28D9',cursor:'pointer',display:'flex',alignItems:'center',gap:'6px'}}>
                  <span>{pausado ? '▶' : '⏸'}</span><span>{pausado ? 'Resume' : 'Pause'}</span>
                </button>
                <button onClick={()=>{
                  modoConversacionRef.current = false
                  setModoConversacion(false)
                  pausadoRef.current = false
                  setPausado(false)
                  setEstadoChat('esperando_materia')
                  setSugerencias([])
                  setAudioPendiente('')
                  if (autoEscuchaTimeoutRef.current) { clearTimeout(autoEscuchaTimeoutRef.current); autoEscuchaTimeoutRef.current = null }
                  detenerReconocimientoVoz()
                  limpiarVAD()
                  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
                  reproduciendoRef.current = false
                  setReproduciendo(false)
                  if (audioRef.current) { try { audioRef.current.pause() } catch { /* */ } }
                  if (grabando) { grabacionCanceladaRef.current = true; try { mediaRecorderRef.current?.stop() } catch { /* ya estaba detenida */ } setGrabando(false) }
                }}
                  style={{background:'rgba(220,38,38,.08)',border:'1px solid rgba(220,38,38,.2)',borderRadius:'12px',padding:'8px 16px',fontSize:'12px',fontWeight:600,color:'#DC2626',cursor:'pointer',display:'flex',alignItems:'center',gap:'6px'}}>
                  <span>✕</span><span>End</span>
                </button>
              </div>
            </div>

            {/* Centro — búho */}
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'16px',flex:1,justifyContent:'center'}}>
              
              {/* Estado label — Escuchando / Pensando / Hablando / Pausado */}
              <div style={{background:'white',borderRadius:'20px',padding:'10px 20px',boxShadow:'0 4px 20px rgba(109,40,217,.12)',border:'1px solid rgba(109,40,217,.08)',fontSize:'14px',fontWeight:600,color:pausado?'#9490B8':grabando?'#DC2626':transcribiendo?'#0EA5E9':cargando?'#D97706':reproduciendo?'#6D28D9':'#10B981',display:'flex',alignItems:'center',gap:'8px',transition:'all .3s'}}>
                <span style={{width:'8px',height:'8px',borderRadius:'50%',background:pausado?'#9490B8':grabando?'#DC2626':transcribiendo?'#0EA5E9':cargando?'#D97706':reproduciendo?'#6D28D9':'#10B981',display:'inline-block',animation:pausado?'none':'dotBlink 1s infinite'}}/>
                {pausado ? 'Paused' : grabando ? 'Listening...' : transcribiendo ? 'Transcribing...' : cargando ? 'Coaching...' : reproduciendo ? (vozNavegadorActiva ? 'Speaking fast...' : 'Speaking...') : 'Getting ready...'}
              </div>

              {/* Búho con rings */}
              <div style={{position:'relative',width:reproduciendo?'min(86vw,620px)':'min(82vw,430px)',height:reproduciendo?'min(52vh,620px)':'min(46vh,430px)',minHeight:grabando||cargando?'360px':'320px',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .3s ease',opacity:pausado?0.5:1,filter:pausado?'grayscale(0.4)':'none'}}>
                {/* Ring externo — activo cuando graba o habla */}
                <div style={{position:'absolute',width:'min(74vw,430px)',height:'min(74vw,430px)',borderRadius:'50%',border:`2px solid ${grabando?'rgba(220,38,38,.4)':reproduciendo?'rgba(109,40,217,.4)':'rgba(109,40,217,.15)'}`,animation:`ringPulse ${grabando?'0.5s':reproduciendo?'0.8s':'2s'} ease-in-out infinite`,transition:'all .3s'}}/>
                <div style={{position:'absolute',width:'min(64vw,360px)',height:'min(64vw,360px)',borderRadius:'50%',border:`2px solid ${grabando?'rgba(220,38,38,.2)':reproduciendo?'rgba(109,40,217,.2)':'rgba(109,40,217,.08)'}`,animation:`ringPulse ${grabando?'0.5s':reproduciendo?'0.8s':'2s'} ease-in-out infinite 0.2s`}}/>

                {/* Búho 3D — hablando/pensando tienen pose propia; escuchando
                    usa 'waving' (no existe una pose "listening" dedicada) para
                    diferenciarla visualmente de "pensando" */}
                <OwlarisOwl3D
                  pose={reproduciendo ? 'talking' : (cargando || transcribiendo) ? 'thinking' : 'waving'}
                  size={reproduciendo ? 600 : cargando || transcribiendo || grabando ? 470 : 420}
                />
              </div>

              {(transcripcionVoz || grabando) && (
                <div style={{background:'rgba(255,255,255,.9)',borderRadius:'14px',padding:'10px 14px',width:'min(92vw,420px)',textAlign:'center',boxShadow:'0 2px 16px rgba(14,165,233,.08)',border:'1px solid rgba(14,165,233,.14)',fontSize:'12px',color:'#236184',lineHeight:'1.5',minHeight:'40px'}}>
                  {transcripcionVoz || '...'}
                </div>
              )}

              {/* Último mensaje de Owlaris */}
              {mensajes.filter(m=>m.rol==='asistente').slice(-1).map(m=>(
                <div key={m.id} style={{background:'white',borderRadius:'16px',padding:'14px 18px',maxWidth:'420px',textAlign:'center',boxShadow:'0 2px 16px rgba(109,40,217,.08)',border:'1px solid rgba(109,40,217,.06)',fontSize:'13px',color:'#4B4570',lineHeight:'1.6'}}>
                  {m.contenido.substring(0,180)}{m.contenido.length>180?'...':''}
                </div>
              ))}
            </div>

            {/* Botón micrófono grande */}
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'12px'}}>
              <div style={{display:'flex',gap:'8px',flexWrap:'wrap',justifyContent:'center',maxWidth:'520px'}}>
                <button className="o-chip" onClick={() => {
                  const ultimo = mensajes.filter(m => m.rol === 'asistente').slice(-1)[0]?.contenido
                  if (ultimo) reproducirTTS(ultimo)
                  else if (audioPendiente) hablarConVozDelNavegador(audioPendiente)
                }} disabled={cargando || grabando} style={{opacity:cargando || grabando ? 0.45 : 1}}>
                  ↻ Repeat
                </button>
                <button className="o-chip" onClick={() => enviarPregunta('Give me one short pronunciation drill.', { forceConversation:true, forceEnglish:true, forceEstado:'activo', forceMateria:'Inglés' })} disabled={cargando || grabando}>
                  Pronunciation
                </button>
                <button className="o-chip" onClick={() => enviarPregunta('Start a new friendly conversation topic.', { forceConversation:true, forceEnglish:true, forceEstado:'activo', forceMateria:'Inglés' })} disabled={cargando || grabando}>
                  New topic
                </button>
              </div>
              <button
                onClick={toggleGrabacion}
                disabled={cargando || transcribiendo || reproduciendo}
                style={{
                  width:'86px',height:'86px',borderRadius:'50%',border:'none',cursor:(cargando||transcribiendo||reproduciendo)?'not-allowed':'pointer',
                  background:grabando?'linear-gradient(135deg,#DC2626,#B91C1C)':'linear-gradient(135deg,#7C3AED,#5B21B6)',
                  boxShadow:grabando?'0 0 0 8px rgba(220,38,38,.2),0 8px 32px rgba(220,38,38,.4)':'0 0 0 8px rgba(109,40,217,.1),0 8px 32px rgba(109,40,217,.3)',
                  display:'flex',alignItems:'center',justifyContent:'center',
                  transform:(cargando||transcribiendo||reproduciendo)?'scale(0.9)':'scale(1)',
                  transition:'all .2s',
                  opacity:(cargando||transcribiendo||reproduciendo)?0.5:1,
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
                {pausado ? 'Tap Resume to keep talking' : grabando ? 'Listening — pauses itself when you stop talking' : transcribiendo ? 'Preparing your answer...' : reproduciendo ? 'Listening resumes automatically' : cargando ? 'Coaching...' : 'Go ahead, just start talking'}
              </p>
              {audioPendiente && (
                <button onClick={() => hablarConVozDelNavegador(audioPendiente)}
                  style={{background:'rgba(14,165,233,.08)',border:'1px solid rgba(14,165,233,.18)',borderRadius:'12px',padding:'8px 14px',fontSize:'12px',fontWeight:700,color:'#0369A1',cursor:'pointer'}}>
                  Play audio
                </button>
              )}
            </div>

            <style suppressHydrationWarning>{`
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
            style={{position:'fixed',bottom:`${Math.min(alturaFooter,220)+16}px`,right:'28px',zIndex:50,background:generandoPDF?'rgba(109,40,217,.6)':'linear-gradient(135deg,#7C3AED,#6D28D9)',border:'none',borderRadius:'16px',padding:'12px 20px',cursor:generandoPDF?'not-allowed':'pointer',display:'flex',alignItems:'center',gap:'8px',boxShadow:'0 8px 28px rgba(109,40,217,.35)',transition:'all .25s',fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
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
            <span style={{fontSize:'13px',fontWeight:600,color:'white',letterSpacing:'.2px'}}>{generandoPDF?'Generando...':'Reporte de hoy'}</span>
          </button>
        )}

        {/* Confirmación visible tras descargar el PDF (hallazgo real de
            auditoría QA: sin esto, un alumno/familia no sabía si ya se
            había generado el reporte y volvía a hacer clic, duplicando
            la descarga). */}
        {reportePdfListo && (
          <div style={{position:'fixed',bottom:`${Math.min(alturaFooter,220)+72}px`,right:'28px',zIndex:50,background:'#0F172A',color:'white',borderRadius:'12px',padding:'10px 16px',display:'flex',alignItems:'center',gap:'8px',boxShadow:'0 8px 28px rgba(15,23,42,.35)',fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:'13px',fontWeight:600}}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#4ADE80" strokeWidth="2.5" style={{flexShrink:0}}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
            </svg>
            {idiomaIngles ? 'Report downloaded' : 'Reporte descargado'}
          </div>
        )}
      </div>
    </>
  )
}
