'use client'

import { useRouter } from 'next/navigation'

// Filtro "ver por día" del informe de alumno (hallazgo real, 2026-07-26):
// el informe solo mostraba todo el historial acumulado — un padre que
// pregunta "qué hizo hoy" o "qué hizo el martes" tenía que revisar todo el
// anexo para encontrarlo. Navega con ?dia=YYYY-MM-DD (la página ya es
// force-dynamic) en vez de mantener estado de cliente aparte.
export default function SelectorDia({ alumnoId, dias, diaSeleccionado }: {
  alumnoId: string
  dias: { fecha: string; count: number }[]
  diaSeleccionado: string | null
}) {
  const router = useRouter()
  if (dias.length === 0) return null

  return (
    <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
      <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>Ver:</label>
      <select
        value={diaSeleccionado || ''}
        onChange={(e) => {
          const val = e.target.value
          router.push(`/reporte-alumno?id=${alumnoId}${val ? `&dia=${val}` : ''}`)
        }}
        style={{ padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', background: 'white' }}
      >
        <option value="">Todo el historial</option>
        {dias.map(d => (
          <option key={d.fecha} value={d.fecha}>
            {new Date(`${d.fecha}T12:00:00`).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' })} ({d.count})
          </option>
        ))}
      </select>
    </div>
  )
}
