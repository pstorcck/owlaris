'use client'

// Barra superior del informe de alumno: volver al panel (dashboard correcto
// según el rol de quien lo ve) y descargar en PDF. Se usa window.print() en
// vez de duplicar todo el informe con jsPDF — el informe ya tiene todas sus
// secciones (lectura pedagógica, ruta de dificultad, conversaciones por
// materia) y duplicarlas en un generador aparte se desincroniza cada vez que
// el informe cambie. El CSS @media print (ver <style> en la página) oculta
// esta barra al imprimir/guardar como PDF.
export default function ReporteToolbar({ dashboardHref }: { dashboardHref: string }) {
  return (
    <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
      <a href={dashboardHref} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#2C3E6B', fontSize: '13px', textDecoration: 'none', fontWeight: 600 }}>
        ← Volver al panel
      </a>
      <button
        onClick={() => window.print()}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#2C3E6B', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
      >
        ⬇ Descargar PDF
      </button>
    </div>
  )
}
