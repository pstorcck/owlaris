'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Props { perfil: { nombre_completo: string; colegio: { nombre: string } } }
interface Stats {
  resumen: { totalAlumnos: number; activosHoy: number; activosSemana: number; totalInteracciones: number }
  topTemas: { tema: string; count: number }[]
  actividadSemana: { fecha: string; count: number }[]
  alumnos: { id: string; nombre_completo: string; email: string; grado: string | null; activo: boolean; sesiones: number; ultimaSesion: string | null; temasUnicos: number; sospechasCopia: number }[]
}

export default function DashboardDocente({ perfil }: Props) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [cargando, setCargando] = useState(true)
  const [buscar, setBuscar] = useState('')
  const [tab, setTab] = useState<'general'|'alumnos'|'temas'>('general')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetch('/api/docente/stats').then(r => r.json()).then(data => { setStats(data); setCargando(false) }).catch(() => setCargando(false))
  }, [])

  const alumnosFiltrados = stats?.alumnos.filter(a =>
    a.nombre_completo.toLowerCase().includes(buscar.toLowerCase()) ||
    (a.grado || '').toLowerCase().includes(buscar.toLowerCase())
  ) || []

  const maxActividad = Math.max(...(stats?.actividadSemana.map(d => d.count) || [1]), 1)
  const diasSemana = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

  function tiempoRelativo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `hace ${mins}m`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `hace ${hrs}h`
    return `hace ${Math.floor(hrs/24)}d`
  }

  async function cerrarSesion() { await supabase.auth.signOut(); router.push('/login') }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .dash{min-height:100vh;background:#F5F4FA;font-family:'DM Sans',sans-serif;color:#1E1B4B}
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
        .search{background:#F5F4FA;border:1px solid rgba(109,40,217,.1);border-radius:10px;padding:9px 14px;font-size:13px;color:#1E1B4B;font-family:'DM Sans',sans-serif;width:260px;outline:none}
        .search::placeholder{color:#C4C0E0}
        table{width:100%;border-collapse:collapse}
        th{font-size:11px;font-weight:600;color:#9490B8;letter-spacing:.8px;text-transform:uppercase;padding:10px 14px;text-align:left;border-bottom:1px solid rgba(109,40,217,.06)}
        td{padding:13px 14px;font-size:13px;color:#2D2B55;border-bottom:1px solid rgba(109,40,217,.06)}
        tr:hover td{background:#F8F7FF;color:#1E1B4B}
        .pill{display:inline-flex;align-items:center;border-radius:6px;padding:3px 8px;font-size:11px;font-weight:600}
        .pill-green{background:rgba(34,197,94,.08);color:#16A34A}
        .pill-gray{background:#F3F0FF;color:#9490B8}
        .pill-red{background:rgba(239,68,68,.08);color:#DC2626}
        .loading{display:flex;align-items:center;justify-content:center;height:60vh}
        .spinner{width:32px;height:32px;border:2px solid rgba(109,40,217,.1);border-top-color:#7C3AED;border-radius:50%;animation:spin 1s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .tabs{display:flex;gap:4px;background:#F3F0FF;border-radius:10px;padding:4px;margin-bottom:24px;width:fit-content}
        .tab{padding:8px 16px;border-radius:7px;font-size:13px;font-weight:500;cursor:pointer;border:none;font-family:'DM Sans',sans-serif;transition:all .15s;color:#9490B8;background:transparent}
        .tab.active{background:white;color:#6D28D9;font-weight:600;box-shadow:0 2px 8px rgba(109,40,217,.1)}
        @media(max-width:768px){.sidebar{display:none}.main{margin-left:0;padding:16px}.cards{grid-template-columns:1fr 1fr}.grid2{grid-template-columns:1fr}}
      `}</style>

      <div className="dash">
        <aside className="sidebar">
          <div className="logo">
            <img src="/buho.png" alt="Owlaris"/>
            <div><div className="logo-text">Owlaris</div><div className="logo-sub">Dashboard</div></div>
          </div>
          <button className="nav-item active">📊 Dashboard</button>
          <button className="nav-item" onClick={()=>setTab('alumnos')}>👥 Mis alumnos</button>
          <button className="nav-item" onClick={()=>setTab('temas')}>📚 Temas populares</button>
          <div style={{marginTop:'auto'}}>
            <button className="nav-item" onClick={cerrarSesion}>↩ Cerrar sesión</button>
          </div>
        </aside>

        <main className="main">
          <div className="header">
            <div>
              <h1>Dashboard docente</h1>
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
              <div className="cards">
                <div className="card">
                  <div className="card-icon" style={{background:'rgba(139,92,246,.1)'}}>
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#8B5CF6" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                  </div>
                  <div className="card-label">Total alumnos</div>
                  <div className="card-value">{stats?.resumen.totalAlumnos}</div>
                  <div className="card-sub">registrados</div>
                </div>
                <div className="card">
                  <div className="card-icon" style={{background:'rgba(34,197,94,.1)'}}>
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#22C55E" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  </div>
                  <div className="card-label">Activos hoy</div>
                  <div className="card-value" style={{color:'#4ADE80'}}>{stats?.resumen.activosHoy}</div>
                  <div className="card-sub">sesiones hoy</div>
                </div>
                <div className="card">
                  <div className="card-icon" style={{background:'rgba(6,182,212,.1)'}}>
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#06B6D4" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                  </div>
                  <div className="card-label">Esta semana</div>
                  <div className="card-value" style={{color:'#0284C7'}}>{stats?.resumen.activosSemana}</div>
                  <div className="card-sub">interacciones</div>
                </div>
                <div className="card">
                  <div className="card-icon" style={{background:'rgba(251,191,36,.1)'}}>
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#FBBF24" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                  </div>
                  <div className="card-label">30 días</div>
                  <div className="card-value" style={{color:'#D97706'}}>{stats?.resumen.totalInteracciones}</div>
                  <div className="card-sub">total interacciones</div>
                </div>
              </div>

              <div className="grid2">
                <div className="panel">
                  <div className="panel-title">Actividad últimos 7 días</div>
                  <div className="bar-wrap">
                    {stats?.actividadSemana.map((d,i)=>(
                      <div key={i} className="bar-col">
                        <div className="bar-count">{d.count>0?d.count:''}</div>
                        <div className="bar" style={{height:`${Math.max((d.count/maxActividad)*70,4)}px`,background:d.count>0?'linear-gradient(180deg,#8B5CF6,rgba(139,92,246,.3))':'rgba(255,255,255,.05)'}}/>
                        <div className="bar-label">{diasSemana[new Date(d.fecha+'T12:00:00').getDay()]}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="panel">
                  <div className="panel-title">Top 5 temas</div>
                  {stats?.topTemas.slice(0,5).map((t,i)=>(
                    <div key={i} className="tema-row">
                      <span className="tema-rank">{i+1}</span>
                      <div className="tema-bar-bg"><div className="tema-bar-fill" style={{width:`${(t.count/stats.topTemas[0].count)*100}%`}}/></div>
                      <span className="tema-text" title={t.tema}>{t.tema}</span>
                      <span className="tema-count">{t.count}</span>
                    </div>
                  ))}
                  {!stats?.topTemas.length && <p style={{fontSize:'12px',color:'rgba(255,255,255,.2)'}}>Sin datos aún</p>}
                </div>
              </div>
            </>}

            {tab==='alumnos' && <div className="panel">
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'20px'}}>
                <div className="panel-title" style={{margin:0}}>Alumnos ({alumnosFiltrados.length})</div>
                <input className="search" placeholder="Buscar nombre o grado..." value={buscar} onChange={e=>setBuscar(e.target.value)}/>
              </div>
              <table>
                <thead><tr><th>Alumno</th><th>Grado</th><th>Sesiones</th><th>Temas únicos</th><th>Última sesión</th><th>Estado</th></tr></thead>
                <tbody>
                  {alumnosFiltrados.map(a=>(
                    <tr key={a.id}>
                      <td><div style={{fontWeight:600,color:'#1E1B4B'}}>{a.nombre_completo}</div><div style={{fontSize:'11px',color:'#9490B8',marginTop:'2px'}}>{a.email}</div></td>
                      <td>{a.grado||<span style={{color:'rgba(255,255,255,.2)'}}>—</span>}</td>
                      <td><span style={{fontFamily:'DM Mono',color:a.sesiones>0?'#A78BFA':'rgba(255,255,255,.2)'}}>{a.sesiones}</span></td>
                      <td><span style={{fontFamily:'DM Mono',color:'rgba(255,255,255,.4)'}}>{a.temasUnicos}</span></td>
                      <td style={{fontSize:'12px',color:'rgba(255,255,255,.3)'}}>{a.ultimaSesion?tiempoRelativo(a.ultimaSesion):'—'}</td>
                      <td>
                        {a.sesiones>0?<span className="pill pill-green">Activo</span>:<span className="pill pill-gray">Sin sesiones</span>}
                        {a.sospechasCopia>0&&<span className="pill pill-red" style={{marginLeft:'4px'}}>⚠ copia</span>}
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
                  <div className="tema-bar-bg" style={{height:'6px'}}><div className="tema-bar-fill" style={{width:`${(t.count/stats.topTemas[0].count)*100}%`,height:'6px'}}/></div>
                  <span className="tema-text" style={{width:'auto',flex:1}} title={t.tema}>{t.tema}</span>
                  <span className="tema-count" style={{fontSize:'12px'}}>{t.count} consultas</span>
                </div>
              ))}
              {!stats?.topTemas.length&&<p style={{fontSize:'13px',color:'rgba(255,255,255,.2)'}}>Sin datos aún.</p>}
            </div>}
          </>}
        </main>
      </div>
    </>
  )
}
