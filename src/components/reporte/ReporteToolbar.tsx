'use client'

import { useState } from 'react'
import type { InformeAlumnoPdfData } from '@/lib/informeAlumnoPdf'

// Barra superior del informe de alumno: volver al panel (dashboard correcto
// según el rol de quien lo ve) y descargar en PDF. Hallazgo real
// (2026-07-25): la primera versión usaba window.print() y el usuario lo
// reportó como "no lo descarga, lo manda a impresión" — no se sintió como
// una descarga real, así que se genera un PDF de verdad con jsPDF en el
// navegador (mismo patrón que el generador de "Reporte de hoy").
export default function ReporteToolbar({ dashboardHref, data }: { dashboardHref: string; data: InformeAlumnoPdfData }) {
  const [generando, setGenerando] = useState(false)

  async function descargarPdf() {
    if (generando) return
    setGenerando(true)
    try {
      const { generarInformeAlumnoPdf } = await import('@/lib/informeAlumnoPdf')
      await generarInformeAlumnoPdf(data)
    } catch {
      alert('No se pudo generar el PDF. Intenta de nuevo.')
    } finally {
      setGenerando(false)
    }
  }

  return (
    <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
      <a href={dashboardHref} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#2C3E6B', fontSize: '13px', textDecoration: 'none', fontWeight: 600 }}>
        ← Volver al panel
      </a>
      <button
        onClick={descargarPdf}
        disabled={generando}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#2C3E6B', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: generando ? 'default' : 'pointer', opacity: generando ? 0.6 : 1 }}
      >
        {generando ? 'Generando...' : '⬇ Descargar PDF'}
      </button>
    </div>
  )
}
