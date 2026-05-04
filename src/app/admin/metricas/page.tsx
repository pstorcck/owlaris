'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Metricas {
  total_preguntas: number; costo_total_usd: string
  alumnos_activos: number; intentos_copia: number
  temas_pendientes: number
  pendientes: { materia: string; grado: string; tema_solicitado: string; veces_solicitado: number }[]
}

export default function MetricasPage() {
  const [metricas, setMetricas] = useState<Metricas | null>(null)
  const [colegioId, setColegioId] = useState('')
  const [dias, setDias] = useState(30)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function cargar() {
      setCargando(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: perfil } = await supabase.from('usuarios').select('colegio_id').eq('id', user.id).single()
      if (!perfil) return
      setColegioId(perfil.colegio_id)
      const res = await fetch(`/api/dashboard?colegio_id=${perfil.colegio_id}&dias=${dias}`)
      const data = await res.json()
      setMetricas(data)
      setCargando(false)
    }
    cargar()
  }, [dias])

  return (
    <div className="min-h-screen bg-owlaris-dark text-white">
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <Link href="/admin" className="text-gray-400 hover:text-white">← Admin</Link>
          <h1 className="font-bold text-lg">📈 Métricas</h1>
          <select value={dias} onChange={e => setDias(parseInt(e.target.value))}
            className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none ml-auto">
            <option value={7}>Últimos 7 días</option>
            <option value={30}>Últimos 30 días</option>
            <option value={90}>Últimos 90 días</option>
          </select>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {cargando ? (
          <p className="text-gray-400 text-center py-12">Cargando métricas...</p>
        ) : metricas ? (
          <div className="space-y-6">
            {/* Cards métricas */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: 'Total preguntas',    valor: metricas.total_preguntas,  icon: '💬', color: 'text-blue-400' },
                { label: 'Costo USD',          valor: `$${metricas.costo_total_usd}`, icon: '💰', color: 'text-green-400' },
                { label: 'Alumnos activos',    valor: metricas.alumnos_activos,  icon: '👥', color: 'text-purple-400' },
                { label: 'Intentos copia',     valor: metricas.intentos_copia,   icon: '🚨', color: 'text-red-400' },
                { label: 'Temas pendientes',   valor: metricas.temas_pendientes, icon: '📋', color: 'text-yellow-400' },
              ].map((m, i) => (
                <div key={i} className="bg-white/5 rounded-xl p-5 border border-white/10 text-center">
                  <p className="text-2xl mb-1">{m.icon}</p>
                  <p className={`text-2xl font-bold ${m.color}`}>{m.valor}</p>
                  <p className="text-xs text-gray-400 mt-1">{m.label}</p>
                </div>
              ))}
            </div>

            {/* Proyección de costos */}
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
              <h2 className="font-semibold mb-4">💰 Proyección de costos</h2>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Costo en {dias} días</p>
                  <p className="text-xl font-bold text-green-400">${metricas.costo_total_usd}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Proyección mensual</p>
                  <p className="text-xl font-bold text-yellow-400">
                    ${(parseFloat(metricas.costo_total_usd) * 30 / dias).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Costo por pregunta</p>
                  <p className="text-xl font-bold text-blue-400">
                    ${metricas.total_preguntas > 0
                      ? (parseFloat(metricas.costo_total_usd) / metricas.total_preguntas).toFixed(4)
                      : '0.0000'}
                  </p>
                </div>
              </div>
            </div>

            {/* Temas pendientes */}
            {metricas.pendientes.length > 0 && (
              <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                <h2 className="font-semibold mb-4">📋 Temas sin contenido en SharePoint</h2>
                <p className="text-xs text-gray-400 mb-4">Alumnos preguntaron sobre estos temas pero no había documento disponible.</p>
                <div className="space-y-2">
                  {metricas.pendientes.map((p, i) => (
                    <div key={i} className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-2">
                      <div>
                        <p className="text-sm">{p.tema_solicitado}</p>
                        <p className="text-xs text-gray-400">{p.materia} · {p.grado}</p>
                      </div>
                      <span className="bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded-full text-xs">
                        {p.veces_solicitado}x
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-gray-400 text-center py-12">No hay datos disponibles</p>
        )}
      </main>
    </div>
  )
}
