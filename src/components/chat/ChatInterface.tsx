'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Usuario, Materia, MensajeChat } from '@/types'

interface Props {
  usuario: Usuario
  materias: Materia[]
}

export default function ChatInterface({ usuario, materias }: Props) {
  const [mensajes, setMensajes]         = useState<MensajeChat[]>([])
  const [pregunta, setPregunta]         = useState('')
  const [materiaId, setMateriaId]       = useState(materias[0]?.id || '')
  const [cargando, setCargando]         = useState(false)
  const [error, setError]               = useState('')
  const finalRef  = useRef<HTMLDivElement>(null)
  const router    = useRouter()
  const supabase  = createClient()

  // Scroll automático al último mensaje
  useEffect(() => {
    finalRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  // Mensaje de bienvenida al cargar
  useEffect(() => {
    const nombre = usuario.nombre_completo.split(' ')[0]
    const materiaNombre = materias.find(m => m.id === materiaId)?.nombre || 'tu materia'
    setMensajes([{
      id: 'bienvenida',
      rol: 'asistente',
      contenido: `¡Hola, ${nombre}! 👋 Soy Owlaris, tu tutor académico.\n\nEstoy aquí para ayudarte a **entender**, no solo a darte respuestas. Cuando tienes una duda, aprenderás mucho más si trabajamos juntos en encontrar la solución.\n\n¿Sobre qué tema de **${materiaNombre}** tienes dudas hoy?`,
      timestamp: new Date(),
    }])
  }, [materiaId])

  async function enviarPregunta(e: React.FormEvent) {
    e.preventDefault()
    if (!pregunta.trim() || cargando) return

    const textoPregunta = pregunta.trim()
    setPregunta('')
    setError('')

    // Agregar mensaje del usuario inmediatamente
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
  }

  const materiaNombre = materias.find(m => m.id === materiaId)?.nombre

  return (
    <div className="min-h-screen bg-owlaris-light flex flex-col">
      {/* Header */}
      <header className="bg-owlaris-dark text-white px-4 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🦉</span>
          <div>
            <h1 className="font-bold text-sm">Owlaris</h1>
            <p className="text-xs text-gray-400">{usuario.colegio?.nombre}</p>
          </div>
        </div>

        {/* Selector de materia */}
        <select
          value={materiaId}
          onChange={e => setMateriaId(e.target.value)}
          className="bg-white/10 text-white text-sm rounded-lg px-3 py-1.5 border border-white/20
                     focus:outline-none focus:ring-2 focus:ring-owlaris-secondary"
        >
          {materias.map(m => (
            <option key={m.id} value={m.id} className="text-gray-900">{m.nombre}</option>
          ))}
        </select>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-medium">{usuario.nombre_completo}</p>
            <p className="text-xs text-gray-400">{usuario.grado}</p>
          </div>
          <button
            onClick={cerrarSesion}
            className="text-xs text-gray-400 hover:text-white transition-colors px-2 py-1"
          >
            Salir
          </button>
        </div>
      </header>

      {/* Área de mensajes */}
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

      {/* Input de pregunta */}
      <div className="border-t border-gray-200 bg-white px-4 py-4">
        <form onSubmit={enviarPregunta} className="max-w-3xl mx-auto flex gap-3 items-end">
          <div className="flex-1">
            <p className="text-xs text-gray-400 mb-1">
              Preguntando sobre: <span className="font-medium text-owlaris-primary">{materiaNombre}</span>
            </p>
            <textarea
              value={pregunta}
              onChange={e => setPregunta(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarPregunta(e) } }}
              placeholder="Escribe tu duda aquí... (Enter para enviar)"
              rows={2}
              className="input-base resize-none"
              disabled={cargando}
            />
          </div>
          <button
            type="submit"
            disabled={cargando || !pregunta.trim()}
            className="btn-primary px-4 py-3 flex-shrink-0 mb-0"
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
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm
        ${esAlumno ? 'bg-owlaris-secondary text-white' : 'bg-owlaris-primary text-white'}`}>
        {esAlumno ? '👤' : '🦉'}
      </div>

      {/* Burbuja */}
      <div className={`max-w-[80%] px-4 py-3 rounded-2xl shadow-sm
        ${esAlumno
          ? 'bg-owlaris-primary text-white rounded-tr-none'
          : 'bg-white text-gray-800 rounded-tl-none'}`}>
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{mensaje.contenido}</p>
        {mensaje.documento_fuente && (
          <p className="text-xs mt-2 opacity-60">
            📄 Fuente: {mensaje.documento_fuente}
          </p>
        )}
        <p className={`text-xs mt-1 ${esAlumno ? 'text-purple-200' : 'text-gray-400'}`}>
          {mensaje.timestamp.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}
