'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ConfiguracionPage() {
  const [colegioId, setColegioId]         = useState('')
  const [prompt, setPrompt]               = useState('')
  const [limite, setLimite]               = useState('999')
  const [mantenimiento, setMantenimiento] = useState(false)
  const [gradoLibre, setGradoLibre]       = useState(true)
  const [cargando, setCargando]           = useState(true)
  const [guardando, setGuardando]         = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  const [mensaje, setMensaje]             = useState('')

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: perfil } = await supabase
        .from('usuarios').select('colegio_id').eq('id', user.id).single()
      if (!perfil) return

      setColegioId(perfil.colegio_id)

      const res = await fetch(`/api/configuracion?colegio_id=${perfil.colegio_id}`)
      const data = await res.json()
      const cfg = data.config || {}

      setPrompt(cfg.prompt_personalizado || '')
      setLimite(cfg.limite_preguntas_diarias || '999')
      setMantenimiento(cfg.modo_mantenimiento === 'true')
      setGradoLibre(cfg.grado_edicion_libre !== 'false')
      setCargando(false)
    }
    cargar()
  }, [])

  async function guardar(clave: string, valor: string) {
    setGuardando(true)
    await fetch('/api/configuracion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ colegio_id: colegioId, clave, valor }),
    })
    setGuardando(false)
    setMensaje('✅ Guardado correctamente')
    setTimeout(() => setMensaje(''), 3000)
  }

  async function syncSharePoint() {
    setSincronizando(true)
    await fetch('/api/dashboard', { method: 'POST' })
    setSincronizando(false)
    setMensaje('✅ Cache de SharePoint limpiado — próximas preguntas cargarán contenido fresco')
    setTimeout(() => setMensaje(''), 5000)
  }

  if (cargando) return (
    <div className="min-h-screen bg-owlaris-dark text-white flex items-center justify-center">
      <p className="text-gray-400">Cargando configuración...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-owlaris-dark text-white">
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link href="/admin" className="text-gray-400 hover:text-white">← Admin</Link>
          <h1 className="font-bold text-lg">⚙️ Configuración</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {mensaje && (
          <div className="bg-green-500/20 text-green-300 px-4 py-3 rounded-xl text-sm">
            {mensaje}
          </div>
        )}

        {/* Modo mantenimiento */}
        <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold mb-1">🔧 Modo mantenimiento</h2>
              <p className="text-sm text-gray-400">Cuando está activo, el chat está desactivado para todos los alumnos.</p>
              <p className="text-xs text-gray-500 mt-1">Útil durante exámenes o mantenimiento del sistema.</p>
            </div>
            <button
              onClick={() => {
                const nuevo = !mantenimiento
                setMantenimiento(nuevo)
                guardar('modo_mantenimiento', nuevo.toString())
              }}
              className={`relative w-14 h-7 rounded-full transition-colors duration-200 flex-shrink-0
                ${mantenimiento ? 'bg-red-500' : 'bg-gray-600'}`}>
              <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200
                ${mantenimiento ? 'translate-x-8' : 'translate-x-1'}`}/>
            </button>
          </div>
          {mantenimiento && (
            <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
              <p className="text-red-300 text-sm">⚠️ El chat está desactivado para todos los alumnos ahora mismo.</p>
            </div>
          )}
        </div>

        {/* Cambio de grado libre */}
        <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold mb-1">🎓 Cambio de grado libre</h2>
              <p className="text-sm text-gray-400">Cuando está activo, el alumno puede cambiar su propio grado en cualquier momento escribiéndolo en el chat.</p>
              <p className="text-xs text-gray-500 mt-1">Al desactivarlo, el grado queda fijo y solo un administrador puede cambiarlo.</p>
            </div>
            <button
              onClick={() => {
                const nuevo = !gradoLibre
                setGradoLibre(nuevo)
                guardar('grado_edicion_libre', nuevo.toString())
              }}
              className={`relative w-14 h-7 rounded-full transition-colors duration-200 flex-shrink-0
                ${gradoLibre ? 'bg-green-500' : 'bg-gray-600'}`}>
              <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200
                ${gradoLibre ? 'translate-x-8' : 'translate-x-1'}`}/>
            </button>
          </div>
          {!gradoLibre && (
            <div className="mt-3 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2">
              <p className="text-amber-300 text-sm">🔒 El grado de los alumnos está fijo ahora mismo. No pueden cambiarlo desde el chat.</p>
            </div>
          )}
        </div>

        {/* Límite de preguntas */}
        <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
          <h2 className="font-semibold mb-1">⏱️ Límite de preguntas por alumno/día</h2>
          <p className="text-sm text-gray-400 mb-4">Escribe 999 para sin límite. Recomendado: 50 para controlar costos.</p>
          <div className="flex gap-3 items-center">
            <input
              type="number" value={limite} onChange={e => setLimite(e.target.value)}
              min="1" max="999"
              className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white text-sm w-32
                         focus:outline-none focus:ring-2 focus:ring-owlaris-secondary"
            />
            <span className="text-gray-400 text-sm">preguntas por día</span>
            {limite === '999' && <span className="text-green-400 text-xs">Sin límite</span>}
            <button onClick={() => guardar('limite_preguntas_diarias', limite)}
              disabled={guardando}
              className="bg-owlaris-primary hover:bg-purple-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>

        {/* Editor de prompt */}
        <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
          <h2 className="font-semibold mb-1">🤖 Prompt del agente</h2>
          <p className="text-sm text-gray-400 mb-4">
            Instrucciones personalizadas para el tutor. Si está vacío, usa el prompt socrático por defecto.
            Puedes pegar aquí las instrucciones que te dé Eduardo.
          </p>
          <textarea
            value={prompt} onChange={e => setPrompt(e.target.value)}
            rows={10}
            placeholder="Eres un tutor académico de [Colegio]. Tu misión es...&#10;&#10;Deja vacío para usar el prompt socrático por defecto."
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-sm text-white
                       focus:outline-none focus:ring-2 focus:ring-owlaris-secondary resize-none
                       placeholder-gray-500 font-mono"
          />
          <div className="flex justify-between items-center mt-3">
            <span className="text-xs text-gray-500">{prompt.length} caracteres</span>
            <div className="flex gap-2">
              {prompt && (
                <button onClick={() => { setPrompt(''); guardar('prompt_personalizado', '') }}
                  className="px-4 py-2 rounded-xl text-sm bg-white/10 hover:bg-white/20 transition-colors">
                  Limpiar (usar default)
                </button>
              )}
              <button onClick={() => guardar('prompt_personalizado', prompt)}
                disabled={guardando}
                className="bg-owlaris-primary hover:bg-purple-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
                {guardando ? 'Guardando...' : 'Guardar prompt'}
              </button>
            </div>
          </div>
        </div>

        {/* Sync SharePoint */}
        <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
          <h2 className="font-semibold mb-1">🔄 Sincronizar SharePoint</h2>
          <p className="text-sm text-gray-400 mb-4">
            Limpia el cache de documentos. Úsalo cuando subas documentos nuevos a SharePoint
            y quieras que el tutor los use de inmediato (sin esperar 30 minutos).
          </p>
          <button onClick={syncSharePoint} disabled={sincronizando}
            className="bg-owlaris-secondary/20 hover:bg-owlaris-secondary/30 text-owlaris-secondary
                       border border-owlaris-secondary/30 px-6 py-2 rounded-xl text-sm font-medium
                       transition-colors disabled:opacity-50 flex items-center gap-2">
            {sincronizando ? (
              <><span className="animate-spin">⟳</span> Sincronizando...</>
            ) : (
              <><span>🔄</span> Sincronizar ahora</>
            )}
          </button>
        </div>
      </main>
    </div>
  )
}
