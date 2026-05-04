'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Interaccion {
  id: string; pregunta: string; respuesta: string; grado: string
  tema_detectado: string; modelo_usado: string; costo_usd: number
  sospecha_copia: boolean; documento_fuente: string; creado_en: string
  usuario: { nombre_completo: string; email: string }
  materia: { nombre: string } | null
}

export default function ChatsPage() {
  const [interacciones, setInteracciones] = useState<Interaccion[]>([])
  const [cargando, setCargando]           = useState(true)
  const [seleccionada, setSeleccionada]   = useState<Interaccion | null>(null)
  const [soloSospechas, setSoloSospechas] = useState(false)
  const [buscar, setBuscar]               = useState('')

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: perfil } = await supabase
        .from('usuarios').select('colegio_id, rol').eq('id', user.id).single()
      if (!perfil) return

      let query = supabase
        .from('interacciones')
        .select('*, usuario:usuarios(nombre_completo, email), materia:materias(nombre)')
        .order('creado_en', { ascending: false })
        .limit(200)

      if (perfil.rol !== 'superadmin') {
        query = query.eq('colegio_id', perfil.colegio_id)
      }

      if (soloSospechas) query = query.eq('sospecha_copia', true)

      const { data } = await query
      setInteracciones((data || []) as unknown as Interaccion[])
      setCargando(false)
    }
    cargar()
  }, [soloSospechas])

  const filtradas = interacciones.filter(i =>
    buscar === '' ||
    i.usuario?.nombre_completo?.toLowerCase().includes(buscar.toLowerCase()) ||
    i.pregunta?.toLowerCase().includes(buscar.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-owlaris-dark text-white">
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <Link href="/admin" className="text-gray-400 hover:text-white">← Admin</Link>
          <h1 className="font-bold text-lg">💬 Historial de Chats</h1>
          <span className="text-gray-500 text-sm">{filtradas.length} conversaciones</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6">
        {/* Filtros */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <input value={buscar} onChange={e => setBuscar(e.target.value)}
            placeholder="🔍 Buscar por alumno o pregunta..."
            className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-sm flex-1 min-w-48
                       text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-owlaris-secondary"/>
          <button onClick={() => setSoloSospechas(!soloSospechas)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors
              ${soloSospechas ? 'bg-red-500/30 text-red-300 border border-red-500/30'
                              : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}>
            🚨 {soloSospechas ? 'Ver todas' : 'Solo sospechas de copia'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Lista */}
          <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
            {cargando ? (
              <p className="text-gray-500 text-center py-8">Cargando...</p>
            ) : filtradas.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No hay conversaciones</p>
            ) : filtradas.map(i => (
              <button key={i.id} onClick={() => setSeleccionada(i)}
                className={`w-full text-left bg-white/5 hover:bg-white/10 rounded-xl p-4 border transition-colors
                  ${seleccionada?.id === i.id ? 'border-owlaris-secondary' : 'border-white/10'}
                  ${i.sospecha_copia ? 'border-l-2 border-l-red-500' : ''}`}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="font-medium text-sm">{i.usuario?.nombre_completo || 'Usuario'}</span>
                  {i.sospecha_copia && <span className="text-red-400 text-xs flex-shrink-0">🚨 Sospecha</span>}
                </div>
                <p className="text-gray-400 text-xs truncate mb-1">{i.pregunta}</p>
                <div className="flex gap-2 text-xs text-gray-500">
                  <span>{i.materia?.nombre || '—'}</span>
                  <span>·</span>
                  <span>{i.grado || '—'}</span>
                  <span>·</span>
                  <span>{new Date(i.creado_en).toLocaleDateString('es-GT')}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Detalle */}
          <div className="bg-white/5 rounded-2xl border border-white/10 p-6 max-h-[70vh] overflow-y-auto">
            {!seleccionada ? (
              <p className="text-gray-500 text-center py-8">Selecciona una conversación para ver el detalle</p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{seleccionada.usuario?.nombre_completo}</h3>
                  {seleccionada.sospecha_copia && (
                    <span className="bg-red-500/20 text-red-300 px-2 py-1 rounded-full text-xs">🚨 Posible copia</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                  <span>📚 {seleccionada.materia?.nombre || '—'}</span>
                  <span>🎓 {seleccionada.grado || '—'}</span>
                  <span>🤖 {seleccionada.modelo_usado}</span>
                  <span>💰 ${seleccionada.costo_usd?.toFixed(4)}</span>
                  {seleccionada.documento_fuente && (
                    <span className="col-span-2">📄 {seleccionada.documento_fuente}</span>
                  )}
                </div>
                <div className="bg-owlaris-primary/20 rounded-xl p-3">
                  <p className="text-xs text-purple-300 mb-1 font-medium">Pregunta del alumno:</p>
                  <p className="text-sm">{seleccionada.pregunta}</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1 font-medium">Respuesta de Owlaris:</p>
                  <p className="text-sm text-gray-300 whitespace-pre-wrap">{seleccionada.respuesta}</p>
                </div>
                <p className="text-xs text-gray-500 text-right">
                  {new Date(seleccionada.creado_en).toLocaleString('es-GT')}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
