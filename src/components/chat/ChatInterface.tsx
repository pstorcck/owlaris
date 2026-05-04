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
  'Preparatoria',
  'Parvulos',
  'Primero Primaria',
  'Segundo Primaria',
  'Tercero Primaria',
  'Cuarto Primaria',
  'Quinto Primaria',
  'Sexto Primaria',
  'Primero Basico',
  'Segundo Basico',
  'Tercero Basico',
  'Cuarto Bachillerato',
  'Quinto Bachillerato',
]

export default function ChatInterface({ usuario, materias }: Props) {
  const [mensajes, setMensajes]       = useState<MensajeChat[]>([])
  const [pregunta, setPregunta]       = useState('')
  const [materiaId, setMateriaId]     = useState(materias[0]?.id || '')
  const [grado, setGrado]             = useState(usuario.grado || 'Primero Basico')
  const [cargando, setCargando]       = useState(false)
  const [guardandoGrado, setGuardandoGrado] = useState(false)
  const [error, setError]             = useState('')
  const [menuAbierto, setMenuAbierto] = useState(false)
  const finalRef  = useRef<HTMLDivElement>(null)
  const router    = useRouter()
  const supabase  = createClient()

  useEffect(() => {
    finalRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  useEffect(() => {
    const nombre = usuario.nombre_completo.split(' ')[0]
    const materiaNombre = materias.find(m => m.id === materiaId)?.nombre || 'tu materia'
    setMensajes([{
      id: 'bienvenida',
      rol: 'asistente',
      contenido: `¡Hola, ${nombre}! 👋 Soy Owlaris, tu tutor académico.\n\nEstoy aquí para ayudarte a **entender**, no solo a darte respuestas.\n\n¿Sobre qué tema de **${materiaNombre}** tienes dudas hoy?`,
      timestamp: new Date(),
    }])
  }, [materiaId])

  async function cambiarGrado(nuevoGrado: string) {
    setGrado(nuevoGrado)
    setGuardandoGrado(true)
    await supabase
      .from('usuarios')
      .update({ grado: nuevoGrado })
      .eq('id', usuario.id)
    setGuardandoGrado(false)
    setMenuAbierto(false)
  }

  async function enviarPregunta(e: React.FormEvent) {
    e.preventDefault()
    if (!pregunta.trim() || cargando) return

    const textoPregunta = pregunta.trim()
    setPregunta('')
    setError('')

    const msgUsuario: MensajeChat = {
      id: Date.now().toString(),
      rol: 'usuario',
      contenido: textoPregunta,
      timestamp: new Date(),
    }
    setMensajes(prev => [...prev, msgUsuario])
    setCargando(true)

    try {
      const res = await fetch('/api/preguntar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pregunta: textoPregunta,
          materia_id: materiaId,
          grado_override: grado,
          historial: mensajes.slice(-6).map(m => ({
            rol: m.rol,
            contenido: m.contenido,
          })),
        }),
      })

      if (!res.ok) throw new Error('Error al consultar al tutor')
      const data = await res.json()

      const msgAsistente: MensajeChat = {
        id: (Date.now() + 1).toString(),
        rol: 'asistente',
        contenido: data.respuesta,
        timestamp: new Date(),
        tokens: data.tokens,
        documento_fuente: data.documento_fuente,
      }
      setMensajes(prev => [...prev, msgAsistente])

    } catch {
      setError('Hubo un problema al conectar con el tutor. Intenta de nuevo.')
    } finally {
      setCargando(false)
    }
  }

  async function cerrarSesion() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const materiaNombre = materias.find(m => m.id === materiaId)?.nombre

  return (
    <div className="min-h-screen bg-owlaris-light flex flex-col">

      {/* Header */}
      <header className="bg-owlaris-dark text-white px-4 py-3 shadow-lg">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">

          {/* Logo */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xl">🦉</span>
            <div className="hidden sm:block">
              <p className="font-bold text-xs leading-tight">Owlaris</p>
              <p className="text-gray-400 text-xs">{usuario.colegio?.nombre}</p>
            </div>
          </div>

          {/* Centro: Grado + Materia */}
          <div className="flex items-center gap-2 flex-1 justify-center">

            {/* Dropdown Grado */}
            <div className="relative">
              <select
                value={grado}
                onChange={e => cambiarGrado(e.target.value)}
                disabled={guardandoGrado}
                className="bg-white/10 text-white text-xs rounded-lg px-2 py-1.5 border border-white/20
                           focus:outline-none focus:ring-2 focus:ring-owlaris-secondary appearance-none
                           pr-6 cursor-pointer disabled:opacity-50"
              >
                {GRADOS_GUATEMALA.map(g => (
                  <option key={g} value={g} className="text-gray-900">{g}</option>
                ))}
              </select>
              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-white/60 text-xs pointer-events-none">▾</span>
              {guardandoGrado && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-owlaris-secondary rounded-full animate-pulse"/>
              )}
            </div>

            {/* Dropdown Materia */}
            <div className="relative">
              <select
                value={materiaId}
                onChange={e => setMateriaId(e.target.value)}
                className="bg-owlaris-primary text-white text-xs rounded-lg px-2 py-1.5 border border-purple-400/30
                           focus:outline-none focus:ring-2 focus:ring-owlaris-secondary appearance-none
                           pr-6 cursor-pointer"
              >
                {materias.map(m => (
                  <option key={m.id} value={m.id} className="text-gray-900">{m.nombre}</option>
                ))}
              </select>
              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-white/60 text-xs pointer-events-none">▾</span>
            </div>
          </div>

          {/* Derecha: nombre + cerrar sesión */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <p className="text-xs text-gray-400 hidden sm:block">{usuario.nombre_completo.split(' ')[0]}</p>
            <button
              onClick={cerrarSesion}
              className="bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-1.5 rounded-lg
                         border border-white/20 transition-all duration-200 flex items-center gap-1"
            >
              <span>↩</span>
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      {/* Info de contexto */}
      <div className="bg-owlaris-primary/5 border-b border-purple-100 px-4 py-2">
        <p className="text-xs text-center text-owlaris-primary max-w-3xl mx-auto">
          📚 Tutorando: <strong>{grado}</strong> · <strong>{materiaNombre}</strong>
          {guardandoGrado && <span className="ml-2 text-gray-400">Guardando grado...</span>}
        </p>
      </div>

      {/* Mensajes */}
      <main className="flex-1 overflow-y-auto px-4 py-6 max-w-3xl mx-auto w-full">
        <div className="space-y-4">
          {mensajes.map(msg => (
            <MensajeBurbuja key={msg.id} mensaje={msg} />
          ))}

          {cargando && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-owlaris-primary rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-sm">🦉</span>
              </div>
              <div className="bg-white rounded-2xl rounded-tl-none px-4 py-3 shadow-sm">
                <div className="flex gap-1 items-center h-5">
                  <span className="w-2 h-2 bg-owlaris-primary rounded-full animate-bounce" style={{animationDelay:'0ms'}}/>
                  <span className="w-2 h-2 bg-owlaris-primary rounded-full animate-bounce" style={{animationDelay:'150ms'}}/>
                  <span className="w-2 h-2 bg-owlaris-primary rounded-full animate-bounce" style={{animationDelay:'300ms'}}/>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl text-center">
              {error}
            </div>
          )}
          <div ref={finalRef} />
        </div>
      </main>

      {/* Input */}
      <div className="border-t border-gray-200 bg-white px-4 py-4">
        <form onSubmit={enviarPregunta} className="max-w-3xl mx-auto flex gap-3 items-end">
          <div className="flex-1">
            <textarea
              value={pregunta}
              onChange={e => setPregunta(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarPregunta(e) } }}
              placeholder={`Escribe tu duda de ${materiaNombre}... (Enter para enviar)`}
              rows={2}
              className="input-base resize-none"
              disabled={cargando}
            />
          </div>
          <button
            type="submit"
            disabled={cargando || !pregunta.trim()}
            className="btn-primary px-4 py-3 flex-shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
        <p className="text-center text-xs text-gray-400 mt-2 max-w-3xl mx-auto">
          Owlaris te guía para que aprendas — no hace tu tarea por ti 🦉
        </p>
      </div>
    </div>
  )
}

function MensajeBurbuja({ mensaje }: { mensaje: MensajeChat }) {
  const esAlumno = mensaje.rol === 'usuario'
  return (
    <div className={`flex items-start gap-3 ${esAlumno ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm
        ${esAlumno ? 'bg-owlaris-secondary text-white' : 'bg-owlaris-primary text-white'}`}>
        {esAlumno ? '👤' : '🦉'}
      </div>
      <div className={`max-w-[80%] px-4 py-3 rounded-2xl shadow-sm
        ${esAlumno
          ? 'bg-owlaris-primary text-white rounded-tr-none'
          : 'bg-white text-gray-800 rounded-tl-none'}`}>
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{mensaje.contenido}</p>
        {mensaje.documento_fuente && (
          <p className="text-xs mt-2 opacity-60">📄 {mensaje.documento_fuente}</p>
        )}
        <p className={`text-xs mt-1 ${esAlumno ? 'text-purple-200' : 'text-gray-400'}`}>
          {mensaje.timestamp.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}
