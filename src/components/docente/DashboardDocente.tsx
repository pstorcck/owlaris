'use client'

import { useState, useEffect } from 'react'
import AsistenteDocente from '@/components/docente/AsistenteDocente'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Props { perfil: { nombre_completo: string; colegio: { nombre: string } } }
interface Alumno {
  id: string; nombre_completo: string; email: string; grado: string | null
  activo: boolean; sesiones: number; ultimaSesion: string | null
  temasUnicos: number; sospechasCopia: number; colegio_nombre?: string
}
interface Stats {
  resumen: { totalAlumnos: number; activosHoy: number; activosSemana: number; totalInteracciones: number }
  topTemas: { tema: string; count: number }[]
  topMaterias: { materia: string; count: number }[]
  actividadSemana: { fecha: string; count: number }[]
  alumnos: Alumno[]
  topAlumnos: { nombre: string; sesiones: number }[]
  sinActividad: number
  promedioSesiones: number
}

const SEDES: Record<string, string> = {
  'cortijo': 'Cortijo',
  'pla': 'Portal Los Alamos',
}

function detectarSede(email: string): string {
  const prefijo = email.split('-')[0].toLowerCase()
  return SEDES[prefijo] || 'Sede Principal'
}

function getSedes(alumnos: Alumno[]): string[] {
  const sedes = new Set(alumnos.map(a => detectarSede(a.email)))
  return ['Todas', ...Array.from(sedes).sort()]
}

export default function DashboardDocente({ perfil }: Props) {
  const [stats, setStats]         = useState<Stats | null>(null)
  const [cargando, setCargando]   = useState(true)
  const [buscar, setBuscar]       = useState('')
  const [filtroSede, setFiltroSede] = useState('Todas')
  const [tab, setTab]             = useState<'general'|'alumnos'|'temas'|'reportes'>('general')
  const [alumnoReporte, setAlumnoReporte] = useState<Alumno | null>(null)
  const [sesionesAlumno, setSesionesAlumno] = useState<{pregunta:string;respuesta:string;creado_en:string;documento_fuente:string|null}[]>([])
  const [cargandoReporte, setCargandoReporte] = useState(false)
  const [chatAbierto, setChatAbierto]           = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetch('/api/docente/stats').then(r => r.json()).then(data => { setStats(data); setCargando(false) }).catch(() => setCargando(false))
  }, [])

  const sedes = stats ? getSedes(stats.alumnos) : ['Todas']
  const alumnosFiltrados = stats?.alumnos.filter(a => {
    const matchBuscar = a.nombre_completo.toLowerCase().includes(buscar.toLowerCase()) || (a.grado||'').toLowerCase().includes(buscar.toLowerCase())
    const matchSede = filtroSede === 'Todas' || detectarSede(a.email) === filtroSede
    return matchBuscar && matchSede
  }) || []

  const maxActividad = Math.max(...(stats?.actividadSemana.map(d => d.count) || [1]), 1)
  const maxMateria = Math.max(...(stats?.topMaterias?.map(m => m.count) || [1]), 1)
  const diasSemana = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

  function tiempoRelativo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `hace ${mins}m`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `hace ${hrs}h`
    return `hace ${Math.floor(hrs/24)}d`
  }

  async function verReporte(alumno: Alumno) {
    setAlumnoReporte(alumno)
    setTab('reportes')
    setCargandoReporte(true)
    const { data } = await supabase
      .from('interacciones')
      .select('pregunta, respuesta, creado_en, documento_fuente')
      .eq('usuario_id', alumno.id)
      .order('creado_en', { ascending: false })
      .limit(20)
    setSesionesAlumno(data || [])
    setCargandoReporte(false)
  }

  async function descargarPDF() {
    if (!alumnoReporte || sesionesAlumno.length === 0) return
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const W = 210, margin = 20
    let y = 0
    doc.setFillColor(109, 40, 217); doc.rect(0, 0, W, 50, 'F')
    doc.setFontSize(22); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255)
    doc.text('Owlaris — Reporte del Alumno', margin, 22)
    doc.setFontSize(11); doc.setFont('helvetica','normal')
    doc.text(`${alumnoReporte.nombre_completo} · ${alumnoReporte.grado || 'Sin grado'}`, margin, 33)
    doc.text(`Sede: ${detectarSede(alumnoReporte.email)} · ${new Date().toLocaleDateString('es-GT')}`, margin, 42)
    y = 62
    doc.setFontSize(10); doc.setTextColor(60,40,120)
    doc.text(`Sesiones: ${alumnoReporte.sesiones}  |  Temas únicos: ${alumnoReporte.temasUnicos}`, margin, y)
    y += 12
    for (const s of sesionesAlumno.slice(0, 15)) {
      if (y > 260) { doc.addPage(); y = 20 }
      doc.setFillColor(248,247,255); doc.roundedRect(margin, y-4, W-margin*2, 6, 2, 2, 'F')
      doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(109,40,217)
      doc.text(new Date(s.creado_en).toLocaleString('es-GT'), margin+2, y+1)
      y += 8
      doc.setFont('helvetica','bold'); doc.setTextColor(30,27,75)
      const pregLines = doc.splitTextToSize(`P: ${s.pregunta}`, W-margin*2-4)
      doc.text(pregLines, margin+2, y); y += pregLines.length * 4 + 2
      doc.setFont('helvetica','normal'); doc.setTextColor(80,70,120)
      const respLines = doc.splitTextToSize(`R: ${s.respuesta.substring(0,200)}...`, W-margin*2-4)
      if (y + respLines.length*4 > 265) { doc.addPage(); y = 20 }
      doc.text(respLines, margin+2, y); y += respLines.length * 4 + 6
    }
    doc.save(`Reporte-${alumnoReporte.nombre_completo.replace(/ /g,'-')}-${new Date().toISOString().split('T')[0]}.pdf`)
  }

  async function cerrarSesion() { await supabase.auth.signOut(); router.push('/login') }

  return (
    <>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        .dash{min-height:100vh;background:#F5F4FA;font-family:system-ui,-apple-system,sans-serif;color:#1E1B4B}
        .sidebar{position:fixed;left:0;top:0;bottom:0;width:220px;background:white;border-right:1px solid rgba(109,40,217,.08);padding:24px 16px;display:flex;flex-direction:column;gap:4px;z-index:10;box-shadow:4px 0 24px rgba(109,40,217,.04)}
        .logo{display:flex;align-items:center;gap:10px;padding:8px 12px;margin-bottom:24px}
        .logo img{width:32px;height:32px;object-fit:contain}
        .logo-text{font-size:18px;font-weight:700;color:#1E1B4B;letter-spacing:-0.5px}
        .logo-sub{font-size:10px;color:#9490B8;font-weight:500;letter-spacing:.5px;text-transform:uppercase}
        .nav-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;font-size:13px;font-weight:500;color:#9490B8;cursor:pointer;transition:all .15s;text-decoration:none;border:none;background:none;width:100%;text-align:left}
        .nav-item:hover{background:#F3F0FF;color:#6D28D9}
        .nav-item.active{background:#F3F0FF;color:#6D28D9;font-weight:600}
        .main{margin-left:220px;padding:32px}
        .header{display:flex;align-items:center;justify-content:space-between;margin-bottom:32px}
        .header h1{font-size:24px;font-weight:700;color:#1E1B4B;letter-spacing:-0.5px}
        .header p{font-size:13px;color:#9490B8;margin-top:2px}
        .badge{background:#F3F0FF;border:1px solid rgba(109,40,217,.15);border-radius:8px;padding:6px 12px;font-size:12px;color:#6D28D9;font-weight:600}
        .btn-salir{background:white;border:1px solid rgba(109,40,217,.1);border-radius:8px;padding:7px 14px;font-size:12px;color:#9490B8;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .15s}
        .btn-salir:hover{border-color:rgba(220,38,38,.3);color:#DC2626}
        .btn-primary{background:linear-gradient(135deg,#7C3AED,#6D28D9);border:none;border-radius:10px;padding:9px 18px;font-size:13px;font-weight:600;color:white;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .2s}
        .btn-primary:hover{box-shadow:0 4px 16px rgba(109,40,217,.3)}
        .cards{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px}
        .card{background:white;border:1px solid rgba(109,40,217,.06);border-radius:16px;padding:20px;box-shadow:0 2px 12px rgba(109,40,217,.04)}
        .card-icon{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;margin-bottom:12px}
        .card-label{font-size:11px;font-weight:600;color:#9490B8;letter-spacing:.8px;text-transform:uppercase;margin-bottom:8px}
        .card-value{font-size:32px;font-weight:700;color:#1E1B4B;letter-spacing:-1px;line-height:1}
        .card-sub{font-size:11px;color:#C4C0E0;margin-top:6px}
        .grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px}
        .panel{background:white;border:1px solid rgba(109,40,217,.06);border-radius:16px;padding:24px;box-shadow:0 2px 12px rgba(109,40,217,.04)}
        .panel-title{font-size:11px;font-weight:600;color:#9490B8;letter-spacing:.8px;text-transform:uppercase;margin-bottom:20px}
        .bar-wrap{display:flex;align-items:flex-end;gap:8px;height:80px}
        .bar-col{display:flex;flex-direction:column;align-items:center;gap:4px;flex:1}
        .bar{border-radius:4px 4px 0 0;width:100%;min-height:4px;transition:height .3s}
        .bar-label{font-size:10px;color:#C4C0E0;font-family:'DM Mono',monospace}
        .bar-count{font-size:10px;color:#9490B8;font-family:'DM Mono',monospace;min-height:14px}
        .tema-row{display:flex;align-items:center;gap:10px;margin-bottom:12px}
        .tema-rank{font-family:'DM Mono',monospace;font-size:11px;color:#C4C0E0;width:20px;flex-shrink:0}
        .tema-bar-bg{flex:1;height:4px;background:#F3F0FF;border-radius:2px;overflow:hidden}
        .tema-bar-fill{height:100%;background:linear-gradient(90deg,#7C3AED,#0EA5E9);border-radius:2px}
        .tema-text{font-size:12px;color:#4B4570;width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0}
        .tema-count{font-family:'DM Mono',monospace;font-size:11px;color:#9490B8;flex-shrink:0}
        .search{background:#F5F4FA;border:1px solid rgba(109,40,217,.1);border-radius:10px;padding:9px 14px;font-size:13px;color:#1E1B4B;font-family:'DM Sans',sans-serif;outline:none}
        .search::placeholder{color:#C4C0E0}
        .select{background:#F5F4FA;border:1px solid rgba(109,40,217,.1);border-radius:10px;padding:9px 14px;font-size:13px;color:#1E1B4B;font-family:'DM Sans',sans-serif;outline:none;cursor:pointer}
        table{width:100%;border-collapse:collapse}
        th{font-size:11px;font-weight:600;color:#9490B8;letter-spacing:.8px;text-transform:uppercase;padding:10px 14px;text-align:left;border-bottom:1px solid rgba(109,40,217,.06)}
        td{padding:13px 14px;font-size:13px;color:#2D2B55;border-bottom:1px solid rgba(109,40,217,.04)}
        tr:hover td{background:#F8F7FF;color:#1E1B4B}
        .pill{display:inline-flex;align-items:center;border-radius:6px;padding:3px 8px;font-size:11px;font-weight:600}
        .pill-green{background:rgba(34,197,94,.08);color:#16A34A}
        .pill-gray{background:#F3F0FF;color:#9490B8}
        .pill-red{background:rgba(239,68,68,.08);color:#DC2626}
        .pill-blue{background:rgba(14,165,233,.08);color:#0284C7}
        .pill-orange{background:rgba(234,88,12,.08);color:#EA580C}
        .loading{display:flex;align-items:center;justify-content:center;height:60vh}
        .spinner{width:32px;height:32px;border:2px solid rgba(109,40,217,.1);border-top-color:#7C3AED;border-radius:50%;animation:spin 1s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .tabs{display:flex;gap:4px;background:#F3F0FF;border-radius:10px;padding:4px;margin-bottom:24px;width:fit-content}
        .tab{padding:8px 16px;border-radius:7px;font-size:13px;font-weight:500;cursor:pointer;border:none;font-family:'DM Sans',sans-serif;transition:all .15s;color:#9490B8;background:transparent}
        .tab.active{background:white;color:#6D28D9;font-weight:600;box-shadow:0 2px 8px rgba(109,40,217,.1)}
        .alerta{background:rgba(234,88,12,.04);border:1px solid rgba(234,88,12,.15);border-radius:12px;padding:16px 20px;display:flex;align-items:center;gap:12px;margin-bottom:24px}
        @media(max-width:768px){.sidebar{display:none}.main{margin-left:0;padding:16px}.cards{grid-template-columns:1fr 1fr}.grid2{grid-template-columns:1fr}}
      `}</style>

      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap"/>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap"/>
      <div className="dash">
        <aside className="sidebar">
          <div className="logo">
            <img src="/buho.png" alt="Owlaris"/>
            <div><div className="logo-text">Owlaris</div><div className="logo-sub">Docente</div></div>
          </div>
          <button className={`nav-item ${tab==='general'?'active':''}`} onClick={()=>setTab('general')}>📊 General</button>
          <button className={`nav-item ${tab==='alumnos'?'active':''}`} onClick={()=>setTab('alumnos')}>👥 Mis alumnos</button>
          <button className={`nav-item ${tab==='temas'?'active':''}`} onClick={()=>setTab('temas')}>📚 Temas populares</button>

          <div style={{marginTop:'auto',borderTop:'1px solid rgba(109,40,217,.06)',paddingTop:'16px',display:'flex',flexDirection:'column',gap:'4px'}}>
            <button className="nav-item" onClick={()=>setChatAbierto(true)}>💬 Hablar con Owlaris</button>
            <button className="nav-item" onClick={cerrarSesion}>↩ Cerrar sesión</button>
          </div>
        </aside>

        <main className="main">
          <div className="header">
            <div>
              <h1>Dashboard</h1>
              <p>{perfil.nombre_completo.split(' ')[0]} · {new Date().toLocaleDateString('es-GT',{weekday:'long',day:'numeric',month:'long'})}</p>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
              <span className="badge">{perfil.colegio.nombre}</span>
              <button className="btn-salir" onClick={cerrarSesion}>Salir</button>
            </div>
          </div>

          {cargando ? <div className="loading"><div className="spinner"/></div> : <>
            <div className="tabs">
              <button className={`tab ${tab==='general'?'active':''}`} onClick={()=>setTab('general')}>General</button>
              <button className={`tab ${tab==='alumnos'?'active':''}`} onClick={()=>setTab('alumnos')}>Alumnos</button>
              <button className={`tab ${tab==='temas'?'active':''}`} onClick={()=>setTab('temas')}>Temas</button>
            </div>

            {tab==='general' && <>
              {stats && stats.sinActividad > 0 && (
                <div className="alerta">
                  <span style={{fontSize:'20px'}}>⚠️</span>
                  <div>
                    <div style={{fontWeight:600,color:'#EA580C',fontSize:'14px'}}>{stats.sinActividad} alumnos sin actividad</div>
                    <div style={{fontSize:'12px',color:'#9490B8',marginTop:'2px'}}>No han iniciado sesión en Owlaris todavía</div>
                  </div>
                </div>
              )}
              <div className="cards">
                <div className="card">
                  <div className="card-icon" style={{background:'rgba(109,40,217,.08)'}}>
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#7C3AED" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                  </div>
                  <div className="card-label">Total alumnos</div>
                  <div className="card-value">{stats?.resumen.totalAlumnos}</div>
                  <div className="card-sub">en el colegio</div>
                </div>
                <div className="card">
                  <div className="card-icon" style={{background:'rgba(34,197,94,.08)'}}>
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#16A34A" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  </div>
                  <div className="card-label">Activos hoy</div>
                  <div className="card-value" style={{color:'#16A34A'}}>{stats?.resumen.activosHoy}</div>
                  <div className="card-sub">sesiones hoy</div>
                </div>
                <div className="card">
                  <div className="card-icon" style={{background:'rgba(14,165,233,.08)'}}>
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#0284C7" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                  </div>
                  <div className="card-label">Esta semana</div>
                  <div className="card-value" style={{color:'#0284C7'}}>{stats?.resumen.activosSemana}</div>
                  <div className="card-sub">interacciones</div>
                </div>
                <div className="card">
                  <div className="card-icon" style={{background:'rgba(234,88,12,.08)'}}>
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#EA580C" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/></svg>
                  </div>
                  <div className="card-label">Promedio sesiones</div>
                  <div className="card-value" style={{color:'#EA580C'}}>{stats?.promedioSesiones?.toFixed(1)}</div>
                  <div className="card-sub">por alumno / 30 días</div>
                </div>
              </div>
              <div className="grid2">
                <div className="panel">
                  <div className="panel-title">Actividad últimos 7 días</div>
                  <div className="bar-wrap">
                    {stats?.actividadSemana.map((d,i)=>(
                      <div key={i} className="bar-col">
                        <div className="bar-count">{d.count>0?d.count:''}</div>
                        <div className="bar" style={{height:`${Math.max((d.count/maxActividad)*70,4)}px`,background:d.count>0?'linear-gradient(180deg,#7C3AED,rgba(124,58,237,.2))':'rgba(109,40,217,.05)'}}/>
                        <div className="bar-label">{diasSemana[new Date(d.fecha+'T12:00:00').getDay()]}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="panel">
                  <div className="panel-title">Top 5 alumnos más activos</div>
                  {stats?.topAlumnos?.map((a,i)=>(
                    <div key={i} className="tema-row">
                      <span className="tema-rank">{i+1}</span>
                      <div className="tema-bar-bg"><div className="tema-bar-fill" style={{width:`${(a.sesiones/(stats.topAlumnos[0]?.sesiones||1))*100}%`}}/></div>
                      <span className="tema-text">{a.nombre.split(' ').slice(0,2).join(' ')}</span>
                      <span className="tema-count">{a.sesiones}</span>
                    </div>
                  ))}
                  {!stats?.topAlumnos?.length && <p style={{fontSize:'12px',color:'#C4C0E0'}}>Sin actividad aún</p>}
                </div>
              </div>
              <div className="grid2">
                <div className="panel">
                  <div className="panel-title">Materias más estudiadas</div>
                  {stats?.topMaterias?.map((m,i)=>(
                    <div key={i} className="tema-row">
                      <span className="tema-rank">{i+1}</span>
                      <div className="tema-bar-bg"><div className="tema-bar-fill" style={{width:`${(m.count/maxMateria)*100}%`,background:'linear-gradient(90deg,#0EA5E9,#7C3AED)'}}/></div>
                      <span className="tema-text">{m.materia||'General'}</span>
                      <span className="tema-count">{m.count}</span>
                    </div>
                  ))}
                  {!stats?.topMaterias?.length && <p style={{fontSize:'12px',color:'#C4C0E0'}}>Sin datos aún</p>}
                </div>
                <div className="panel">
                  <div className="panel-title">Top 5 temas consultados</div>
                  {stats?.topTemas.slice(0,5).map((t,i)=>(
                    <div key={i} className="tema-row">
                      <span className="tema-rank">{i+1}</span>
                      <div className="tema-bar-bg"><div className="tema-bar-fill" style={{width:`${(t.count/(stats.topTemas[0]?.count||1))*100}%`}}/></div>
                      <span className="tema-text" title={t.tema}>{t.tema}</span>
                      <span className="tema-count">{t.count}</span>
                    </div>
                  ))}
                  {!stats?.topTemas.length && <p style={{fontSize:'12px',color:'#C4C0E0'}}>Sin datos aún</p>}
                </div>
              </div>
            </>}

            {tab==='alumnos' && <div className="panel">
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'20px',flexWrap:'wrap',gap:'10px'}}>
                <div className="panel-title" style={{margin:0}}>Alumnos ({alumnosFiltrados.length})</div>
                <div style={{display:'flex',gap:'10px',flexWrap:'wrap'}}>
                  <select className="select" value={filtroSede} onChange={e=>setFiltroSede(e.target.value)}>
                    {sedes.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                  <input className="search" style={{width:'220px'}} placeholder="Buscar nombre o grado..." value={buscar} onChange={e=>setBuscar(e.target.value)}/>
                </div>
              </div>
              <table>
                <thead><tr>
                  <th>Alumno</th><th>Sede</th><th>Grado</th>
                  <th>Sesiones</th><th>Temas</th><th>Última sesión</th>
                  <th>Estado</th><th></th>
                </tr></thead>
                <tbody>
                  {alumnosFiltrados.map(a=>(
                    <tr key={a.id}>
                      <td>
                        <div style={{fontWeight:600,color:'#1E1B4B'}}>{a.nombre_completo}</div>
                        <div style={{fontSize:'11px',color:'#9490B8',marginTop:'2px'}}>{a.email}</div>
                      </td>
                      <td>
                        <span className={`pill ${detectarSede(a.email)==='Cortijo'?'pill-orange':detectarSede(a.email)==='Portal Los Alamos'?'pill-blue':'pill-gray'}`}>
                          {detectarSede(a.email)}
                        </span>
                      </td>
                      <td>{a.grado||'—'}</td>
                      <td><span style={{fontFamily:'DM Mono',color:a.sesiones>0?'#7C3AED':'#C4C0E0'}}>{a.sesiones}</span></td>
                      <td><span style={{fontFamily:'DM Mono',color:'#9490B8'}}>{a.temasUnicos}</span></td>
                      <td style={{fontSize:'12px',color:'#9490B8'}}>{a.ultimaSesion?tiempoRelativo(a.ultimaSesion):'—'}</td>
                      <td>
                        {a.sesiones>0?<span className="pill pill-green">Activo</span>:<span className="pill pill-gray">Sin sesiones</span>}
                        {a.sospechasCopia>0&&<span className="pill pill-red" style={{marginLeft:'4px'}}>⚠</span>}
                      </td>
                      <td>
                        {a.sesiones>0&&(
                          <button onClick={()=>verReporte(a)} style={{background:'#F3F0FF',border:'1px solid rgba(109,40,217,.15)',borderRadius:'8px',padding:'5px 12px',fontSize:'11px',fontWeight:600,color:'#6D28D9',cursor:'pointer',fontFamily:'DM Sans,sans-serif'}}>
                            Ver reporte
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}

            {tab==='temas' && <div className="panel">
              <div className="panel-title">Top 10 temas más consultados (30 días)</div>
              {stats?.topTemas.map((t,i)=>(
                <div key={i} className="tema-row" style={{marginBottom:'14px'}}>
                  <span className="tema-rank" style={{fontSize:'13px',width:'24px'}}>{i+1}</span>
                  <div className="tema-bar-bg" style={{height:'6px'}}><div className="tema-bar-fill" style={{width:`${(t.count/(stats.topTemas[0]?.count||1))*100}%`,height:'6px'}}/></div>
                  <span className="tema-text" style={{width:'auto',flex:1}}>{t.tema}</span>
                  <span className="tema-count" style={{fontSize:'12px'}}>{t.count} consultas</span>
                </div>
              ))}
              {!stats?.topTemas.length&&<p style={{fontSize:'13px',color:'#C4C0E0'}}>Sin datos aún.</p>}
            </div>}

            {tab==='reportes' && <div className="panel">
              {!alumnoReporte ? (
                <div style={{textAlign:'center',padding:'60px 20px'}}>
                  <div style={{fontSize:'48px',marginBottom:'16px'}}>📄</div>
                  <p style={{color:'#1E1B4B',fontSize:'16px',fontWeight:600,marginBottom:'8px'}}>Reportes de alumnos</p>
                  <p style={{color:'#9490B8',fontSize:'13px'}}>Ve a la pestaña <strong>Alumnos</strong> y presiona <strong>Ver reporte</strong> en cualquier alumno activo</p>
                </div>
              ) : (
                <>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px'}}>
                    <div>
                      <h2 style={{fontSize:'18px',fontWeight:700,color:'#1E1B4B'}}>{alumnoReporte.nombre_completo}</h2>
                      <p style={{fontSize:'12px',color:'#9490B8',marginTop:'4px'}}>{alumnoReporte.grado||'Sin grado'} · {detectarSede(alumnoReporte.email)} · {alumnoReporte.sesiones} sesiones</p>
                    </div>
                    <div style={{display:'flex',gap:'10px'}}>
                      <button onClick={()=>setAlumnoReporte(null)} style={{background:'#F3F0FF',border:'1px solid rgba(109,40,217,.15)',borderRadius:'10px',padding:'9px 16px',fontSize:'13px',fontWeight:500,color:'#6D28D9',cursor:'pointer',fontFamily:'DM Sans,sans-serif'}}>← Volver</button>
                      <button onClick={descargarPDF} className="btn-primary">⬇ Descargar PDF</button>
                    </div>
                  </div>
                  {cargandoReporte ? <div className="loading"><div className="spinner"/></div> : (
                    <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                      {sesionesAlumno.map((s,i)=>(
                        <div key={i} style={{background:'#F8F7FF',borderRadius:'12px',padding:'16px',border:'1px solid rgba(109,40,217,.06)'}}>
                          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'10px'}}>
                            <span style={{fontSize:'11px',color:'#9490B8',fontFamily:'DM Mono,monospace'}}>{new Date(s.creado_en).toLocaleString('es-GT')}</span>
                            {s.documento_fuente&&<span style={{fontSize:'11px',color:'#0EA5E9',fontWeight:600}}>◈ {s.documento_fuente}</span>}
                          </div>
                          <p style={{fontSize:'13px',fontWeight:600,color:'#1E1B4B',marginBottom:'6px'}}>{s.pregunta}</p>
                          <p style={{fontSize:'12px',color:'#4B4570',lineHeight:'1.6'}}>{s.respuesta.substring(0,200)}{s.respuesta.length>200?'...':''}</p>
                        </div>
                      ))}
                      {sesionesAlumno.length===0&&<p style={{color:'#C4C0E0',textAlign:'center',padding:'20px'}}>Sin sesiones registradas</p>}
                    </div>
                  )}
                </>
              )}
            </div>}
          </>}
        </main>
      </div>
      {/* Botón flotante asistente */}
      {!chatAbierto && (
        <button onClick={()=>setChatAbierto(true)}
          style={{position:'fixed',bottom:'28px',right:'28px',zIndex:100,width:'56px',height:'56px',borderRadius:'50%',background:'linear-gradient(135deg,#7C3AED,#5B21B6)',border:'none',cursor:'pointer',boxShadow:'0 8px 32px rgba(109,40,217,.4)',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .2s'}}
          title="Asistente docente">
          <img src="/buho.png" alt="Owlaris" style={{width:'32px',height:'32px',objectFit:'contain'}}/>
        </button>
      )}

      {/* Panel asistente docente */}
      {chatAbierto && (
        <>
          <div onClick={()=>setChatAbierto(false)}
            style={{position:'fixed',inset:0,background:'rgba(30,27,75,.2)',backdropFilter:'blur(4px)',zIndex:200}}/>
          <div style={{position:'fixed',bottom:'24px',right:'24px',width:'380px',height:'560px',background:'white',zIndex:201,borderRadius:'24px',boxShadow:'0 24px 80px rgba(30,27,75,.2)',display:'flex',flexDirection:'column',overflow:'hidden'}}>
            {/* Header */}
            <div style={{background:'linear-gradient(135deg,#7C3AED,#5B21B6)',padding:'16px 20px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                <img src="/buho.png" alt="Owlaris" style={{width:'32px',height:'32px',objectFit:'contain'}}/>
                <div>
                  <div style={{fontWeight:700,color:'white',fontSize:'14px'}}>Asistente Docente</div>
                  <div style={{fontSize:'11px',color:'rgba(255,255,255,.6)'}}>Powered by Owlaris AI</div>
                </div>
              </div>
              <button onClick={()=>setChatAbierto(false)}
                style={{background:'rgba(255,255,255,.15)',border:'none',borderRadius:'8px',width:'28px',height:'28px',cursor:'pointer',color:'white',fontSize:'14px',display:'flex',alignItems:'center',justifyContent:'center'}}>
                ✕
              </button>
            </div>
            <AsistenteDocente stats={stats} colegio={perfil.colegio.nombre}/>
          </div>
        </>
      )}
    </>
  )
}
