'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import BurbujaGuia from '@/components/guia/BurbujaGuia'

type DirectorStats = {
  perfil: { nombre: string; colegio: string; sede: string; rol: 'director' | 'guia' }
  resumen: {
    totalAlumnos: number
    activosHoy: number
    activosSemana: number
    interaccionesSemana: number
    interacciones30: number
    alertasActivas: number
    sospechasCopia: number
    sinActividad: number
    tasaUsoSemana: number
  }
  actividad: { fecha: string; count: number }[]
  grados: { grado: string; count: number }[]
  topTemas: { tema: string; count: number }[]
  topMaterias: { materia: string; count: number }[]
  alertasPorTipo: { tipo: string; count: number }[]
  alumnosAtencion: {
    id: string
    nombre_completo: string
    email: string
    sede: string
    grado: string | null
    sesiones30: number
    temasUnicos: number
    ultimaSesion: string | null
    diasInactivo: number
    alertasActivas: number
    sospechasCopia: number
  }[]
  alertas: {
    id: string
    alumno_id: string
    tipo: string
    descripcion: string | null
    contexto: string | null
    creado_en: string
    alumno: { nombre_completo: string; grado: string | null; email: string; sede: string }
  }[]
}

const tipoLabel: Record<string, string> = {
  baja_comprension: 'Baja comprensión',
  seguridad_contenido: 'Seguridad',
  riesgo_copia: 'Riesgo de copia',
  bloqueo_recurrente: 'Bloqueo recurrente',
}

const tipoColor: Record<string, string> = {
  baja_comprension: '#D97706',
  seguridad_contenido: '#B91C1C',
  riesgo_copia: '#7C3AED',
  bloqueo_recurrente: '#2563EB',
}

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-GT', { day: '2-digit', month: 'short' })
}

function tiempoRelativo(iso: string | null) {
  if (!iso) return 'sin registro'
  const diff = Date.now() - new Date(iso).getTime()
  const dias = Math.floor(diff / 86400000)
  if (dias <= 0) return 'hoy'
  if (dias === 1) return 'ayer'
  return `hace ${dias} días`
}

export default function DirectorDashboard() {
  const [stats, setStats] = useState<DirectorStats | null>(null)
  const [cargando, setCargando] = useState(true)
  const [tab, setTab] = useState<'resumen' | 'alertas' | 'alumnos'>('resumen')
  const [buscar, setBuscar] = useState('')
  const [resolviendo, setResolviendo] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/director/stats')
      .then((res) => res.json())
      .then((data) => setStats(data.error ? null : data))
      .catch(() => setStats(null))
      .finally(() => setCargando(false))
  }, [])

  // Hallazgo real (unificación de paneles, 2026-07-13): la vista de guía
  // tenía un botón para marcar una alerta como resuelta que este panel
  // compartido no tenía — quitarlo sin reemplazo habría sido una pérdida
  // real de funcionalidad, no solo un cambio de alcance de datos. El
  // endpoint PATCH /api/alertas ya existe y valida permisos por rol
  // (director/guía solo pueden resolver alertas de alumnos a los que
  // tienen acceso), así que se reutiliza aquí para ambos roles por igual.
  async function resolverAlerta(id: string) {
    setResolviendo(id)
    try {
      const res = await fetch('/api/alertas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        setStats((prev) => prev ? {
          ...prev,
          alertas: prev.alertas.filter((alerta) => alerta.id !== id),
          resumen: { ...prev.resumen, alertasActivas: Math.max(0, prev.resumen.alertasActivas - 1) },
        } : prev)
      }
    } finally {
      setResolviendo(null)
    }
  }

  const maxActividad = Math.max(...(stats?.actividad.map((d) => d.count) || [1]), 1)
  const maxGrado = Math.max(...(stats?.grados.map((g) => g.count) || [1]), 1)
  const maxTema = Math.max(...(stats?.topTemas.map((t) => t.count) || [1]), 1)

  const alumnosFiltrados = useMemo(() => {
    const q = buscar.trim().toLowerCase()
    if (!q) return stats?.alumnosAtencion || []
    return (stats?.alumnosAtencion || []).filter((alumno) =>
      alumno.nombre_completo.toLowerCase().includes(q) ||
      alumno.email.toLowerCase().includes(q) ||
      (alumno.grado || '').toLowerCase().includes(q)
    )
  }, [buscar, stats])

  async function cerrarSesion() {
    await createClient().auth.signOut()
    router.push('/login')
  }

  return (
    <div className="director-shell">
      <style>{`
        .director-shell{min-height:100vh;background:#F6F7FB;color:#102033;font-family:system-ui,-apple-system,sans-serif}
        .director-sidebar{position:fixed;inset:0 auto 0 0;width:248px;background:#12233A;color:white;padding:22px 16px;display:flex;flex-direction:column}
        .director-brand{display:flex;align-items:center;gap:10px;padding:4px 8px 22px;border-bottom:1px solid rgba(255,255,255,.1);margin-bottom:14px}
        .director-brand img{width:34px;height:34px;object-fit:contain}
        .director-brand strong{font-size:16px}
        .director-brand span{display:block;font-size:11px;color:rgba(255,255,255,.55);margin-top:2px}
        .director-nav{display:flex;flex-direction:column;gap:6px}
        .director-nav button{height:40px;border:none;border-radius:8px;background:transparent;color:rgba(255,255,255,.66);text-align:left;padding:0 12px;font-size:13px;font-weight:600;cursor:pointer}
        .director-nav button.active,.director-nav button:hover{background:rgba(255,255,255,.12);color:white}
        .director-side-foot{margin-top:auto;border-top:1px solid rgba(255,255,255,.1);padding-top:14px}
        .director-side-foot button{width:100%;height:38px;border:1px solid rgba(255,255,255,.15);border-radius:8px;background:rgba(255,255,255,.08);color:rgba(255,255,255,.82);cursor:pointer}
        .director-main{margin-left:248px;padding:28px 32px 40px}
        .director-top{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:22px}
        .director-kicker{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#64748B;font-weight:700}
        .director-top h1{font-size:26px;line-height:1.1;margin:5px 0;color:#0F1C2E}
        .director-top p{font-size:13px;color:#64748B;margin:0}
        .director-badges{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
        .director-badge{background:white;border:1px solid #E2E8F0;border-radius:999px;padding:7px 12px;color:#334155;font-size:12px;font-weight:700}
        .director-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin-bottom:18px}
        .director-card,.director-panel{background:white;border:1px solid #E2E8F0;border-radius:8px;box-shadow:0 1px 6px rgba(15,28,46,.04)}
        .director-card{padding:16px}
        .director-card .label{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#64748B;font-weight:800;margin-bottom:8px}
        .director-card .value{font-size:30px;font-weight:800;color:#0F1C2E;line-height:1}
        .director-card .sub{font-size:12px;color:#94A3B8;margin-top:8px}
        .director-card.red .value{color:#B91C1C}.director-card.green .value{color:#047857}.director-card.blue .value{color:#2563EB}.director-card.orange .value{color:#D97706}
        .director-panels{display:grid;grid-template-columns:1.4fr 1fr;gap:14px;margin-bottom:14px}
        .director-panel{padding:18px}
        .panel-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
        .panel-head h2{font-size:14px;color:#0F1C2E;margin:0}
        .panel-head span{font-size:12px;color:#94A3B8}
        .bars{display:flex;align-items:flex-end;gap:7px;height:150px}
        .bar-col{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;min-width:0}
        .bar{width:100%;border-radius:5px 5px 0 0;background:linear-gradient(180deg,#2563EB,#8CC7FF);min-height:4px}
        .bar-label{font-size:10px;color:#94A3B8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:42px}
        .bar-count{font-size:10px;color:#64748B;height:13px;font-weight:700}
        .h-row{display:grid;grid-template-columns:minmax(90px,1fr) 1.6fr 36px;gap:10px;align-items:center;margin-bottom:12px}
        .h-name{font-size:12px;color:#334155;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .h-track{height:7px;background:#EEF2F7;border-radius:999px;overflow:hidden}
        .h-fill{height:100%;border-radius:999px;background:#2563EB}
        .h-count{font-size:12px;color:#64748B;text-align:right;font-weight:700}
        .alert-list,.student-list{display:flex;flex-direction:column;gap:10px}
        .alert-item,.student-item{border:1px solid #E2E8F0;border-radius:8px;padding:13px;background:#FBFCFE}
        .alert-top,.student-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
        .alert-title,.student-title{font-size:13px;color:#0F1C2E;font-weight:800;margin-bottom:4px}
        .alert-meta,.student-meta{font-size:12px;color:#64748B;line-height:1.45}
        .pill{display:inline-flex;align-items:center;border-radius:999px;padding:4px 9px;font-size:11px;font-weight:800;white-space:nowrap}
        .pill-red{background:#FEF2F2;color:#B91C1C}.pill-orange{background:#FFF7ED;color:#C2410C}.pill-blue{background:#EFF6FF;color:#1D4ED8}.pill-gray{background:#F1F5F9;color:#475569}.pill-green{background:#ECFDF5;color:#047857}
        .toolbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;gap:10px}
        .search{height:38px;border:1px solid #CBD5E1;border-radius:8px;padding:0 12px;font-size:13px;min-width:260px;background:white}
        .empty{border:1px dashed #CBD5E1;border-radius:8px;padding:28px;text-align:center;color:#64748B;background:#FBFCFE;font-size:13px}
        @media(max-width:980px){.director-sidebar{position:static;width:auto}.director-main{margin-left:0;padding:18px}.director-grid{grid-template-columns:repeat(2,1fr)}.director-panels{grid-template-columns:1fr}.director-top{flex-direction:column}.director-badges{justify-content:flex-start}}
      `}</style>

      <aside className="director-sidebar">
        <div className="director-brand">
          <img src="/buho.png" alt="Owlaris" />
          <div>
            <strong>Owlaris</strong>
            <span>{stats?.perfil.rol === 'guia' ? 'Panel del guía' : 'Panel de dirección'}</span>
          </div>
        </div>
        <nav className="director-nav">
          <button className={tab === 'resumen' ? 'active' : ''} onClick={() => setTab('resumen')}>Resumen ejecutivo</button>
          <button className={tab === 'alertas' ? 'active' : ''} onClick={() => setTab('alertas')}>Alertas activas</button>
          <button className={tab === 'alumnos' ? 'active' : ''} onClick={() => setTab('alumnos')}>Seguimiento</button>
        </nav>
        <div className="director-side-foot">
          <button onClick={cerrarSesion}>Cerrar sesión</button>
        </div>
      </aside>

      <main className="director-main">
        {cargando ? (
          <div className="empty">Cargando panel...</div>
        ) : !stats ? (
          <div className="empty">No se pudo cargar el panel.</div>
        ) : (
          <>
            <header className="director-top">
              <div>
                <div className="director-kicker">{stats.perfil.rol === 'guia' ? 'Panel del guía' : 'Dirección académica'}</div>
                <h1>{stats.perfil.colegio}</h1>
                <p>{stats.perfil.nombre} · {new Date().toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
              </div>
              <div className="director-badges">
                <span className="director-badge">{stats.perfil.rol === 'guia' ? 'Alcance' : 'Sede'}: {stats.perfil.sede}</span>
                <span className="director-badge">Uso semanal: {stats.resumen.tasaUsoSemana}%</span>
              </div>
            </header>

            {tab === 'resumen' && (
              <>
                <section className="director-grid">
                  <div className="director-card blue">
                    <div className="label">{stats.perfil.rol === 'guia' ? 'Mis alumnos' : 'Alumnos sede'}</div>
                    <div className="value">{stats.resumen.totalAlumnos}</div>
                    <div className="sub">{stats.perfil.rol === 'guia' ? 'asignados a mí' : 'visibles para dirección'}</div>
                  </div>
                  <div className="director-card green">
                    <div className="label">Activos hoy</div>
                    <div className="value">{stats.resumen.activosHoy}</div>
                    <div className="sub">alumnos con sesión</div>
                  </div>
                  <div className="director-card blue">
                    <div className="label">Semana</div>
                    <div className="value">{stats.resumen.interaccionesSemana}</div>
                    <div className="sub">interacciones</div>
                  </div>
                  <div className="director-card red">
                    <div className="label">Alertas</div>
                    <div className="value">{stats.resumen.alertasActivas}</div>
                    <div className="sub">pendientes</div>
                  </div>
                  <div className="director-card orange">
                    <div className="label">Sin actividad</div>
                    <div className="value">{stats.resumen.sinActividad}</div>
                    <div className="sub">últimos 30 días</div>
                  </div>
                </section>

                <section className="director-panels">
                  <div className="director-panel">
                    <div className="panel-head"><h2>Actividad diaria</h2><span>14 días</span></div>
                    <div className="bars">
                      {stats.actividad.map((dia) => (
                        <div className="bar-col" key={dia.fecha}>
                          <div className="bar-count">{dia.count || ''}</div>
                          <div className="bar" style={{ height: `${Math.max((dia.count / maxActividad) * 118, 4)}px` }} />
                          <div className="bar-label">{fmtFecha(dia.fecha)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="director-panel">
                    <div className="panel-head"><h2>Alumnos por grado</h2><span>{stats.perfil.sede}</span></div>
                    {stats.grados.map((grado) => (
                      <div className="h-row" key={grado.grado}>
                        <div className="h-name">{grado.grado}</div>
                        <div className="h-track"><div className="h-fill" style={{ width: `${(grado.count / maxGrado) * 100}%`, background: '#0F766E' }} /></div>
                        <div className="h-count">{grado.count}</div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="director-panels">
                  <div className="director-panel">
                    <div className="panel-head"><h2>Temas más consultados</h2><span>30 días</span></div>
                    {stats.topTemas.length ? stats.topTemas.map((tema) => (
                      <div className="h-row" key={tema.tema}>
                        <div className="h-name" title={tema.tema}>{tema.tema}</div>
                        <div className="h-track"><div className="h-fill" style={{ width: `${(tema.count / maxTema) * 100}%` }} /></div>
                        <div className="h-count">{tema.count}</div>
                      </div>
                    )) : <div className="empty">Sin temas registrados.</div>}
                  </div>
                  <div className="director-panel">
                    <div className="panel-head"><h2>Alertas por tipo</h2><span>activas</span></div>
                    {stats.alertasPorTipo.length ? stats.alertasPorTipo.map((alerta) => (
                      <div className="h-row" key={alerta.tipo}>
                        <div className="h-name">{tipoLabel[alerta.tipo] || alerta.tipo}</div>
                        <div className="h-track"><div className="h-fill" style={{ width: `${(alerta.count / Math.max(stats.resumen.alertasActivas, 1)) * 100}%`, background: tipoColor[alerta.tipo] || '#64748B' }} /></div>
                        <div className="h-count">{alerta.count}</div>
                      </div>
                    )) : <div className="empty">No hay alertas activas.</div>}
                  </div>
                </section>
              </>
            )}

            {tab === 'alertas' && (
              <section className="director-panel">
                <div className="panel-head"><h2>Alertas activas</h2><span>{stats.alertas.length} pendientes</span></div>
                <div className="alert-list">
                  {stats.alertas.length ? stats.alertas.map((alerta) => (
                    <div className="alert-item" key={alerta.id}>
                      <div className="alert-top">
                        <div>
                          <div className="alert-title">{alerta.alumno.nombre_completo}</div>
                          <div className="alert-meta">{alerta.alumno.grado || 'Sin grado'} · {alerta.alumno.sede} · {tiempoRelativo(alerta.creado_en)}</div>
                          {alerta.descripcion && <div className="alert-meta" style={{ marginTop: 6 }}>{alerta.descripcion}</div>}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                          <span className="pill" style={{ background: `${tipoColor[alerta.tipo] || '#64748B'}18`, color: tipoColor[alerta.tipo] || '#64748B' }}>
                            {tipoLabel[alerta.tipo] || alerta.tipo}
                          </span>
                          {alerta.alumno_id && (
                            <a href={`/reporte-alumno?id=${alerta.alumno_id}`} className="pill pill-blue" style={{ textDecoration: 'none' }}>
                              Ver informe →
                            </a>
                          )}
                          <button
                            onClick={() => resolverAlerta(alerta.id)}
                            disabled={resolviendo === alerta.id}
                            style={{ background: '#059669', color: 'white', border: 'none', borderRadius: 999, padding: '5px 11px', fontSize: 11, fontWeight: 700, cursor: resolviendo === alerta.id ? 'default' : 'pointer', opacity: resolviendo === alerta.id ? 0.6 : 1, whiteSpace: 'nowrap' }}
                          >
                            {resolviendo === alerta.id ? 'Resolviendo…' : '✓ Resuelta'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )) : <div className="empty">No hay alertas activas.</div>}
                </div>
              </section>
            )}

            {tab === 'alumnos' && (
              <section className="director-panel">
                <div className="toolbar">
                  <div className="panel-head" style={{ margin: 0 }}><h2>Alumnos que necesitan seguimiento</h2><span>{alumnosFiltrados.length}</span></div>
                  <input className="search" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar alumno o grado" />
                </div>
                <div className="student-list">
                  {alumnosFiltrados.length ? alumnosFiltrados.map((alumno) => {
                    const estado = alumno.alertasActivas > 0 ? ['pill-red', `${alumno.alertasActivas} alerta${alumno.alertasActivas > 1 ? 's' : ''}`] :
                      alumno.sospechasCopia > 0 ? ['pill-orange', 'riesgo copia'] :
                      alumno.sesiones30 === 0 ? ['pill-gray', 'sin sesiones'] :
                      ['pill-blue', `${alumno.diasInactivo} días sin actividad`]
                    return (
                      <div className="student-item" key={alumno.id}>
                        <div className="student-top">
                          <div>
                            <div className="student-title">{alumno.nombre_completo}</div>
                            <div className="student-meta">{alumno.grado || 'Sin grado'} · {alumno.email}</div>
                            <div className="student-meta">Sesiones 30d: {alumno.sesiones30} · Temas: {alumno.temasUnicos} · Última sesión: {tiempoRelativo(alumno.ultimaSesion)}</div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                            <span className={`pill ${estado[0]}`}>{estado[1]}</span>
                            <a href={`/reporte-alumno?id=${alumno.id}`} className="pill pill-blue" style={{ textDecoration: 'none' }}>
                              Ver informe →
                            </a>
                          </div>
                        </div>
                      </div>
                    )
                  }) : <div className="empty">No hay alumnos en seguimiento con esos filtros.</div>}
                </div>
              </section>
            )}
          </>
        )}
      </main>
      {stats?.perfil.rol === 'guia' && <BurbujaGuia colegio={stats.perfil.colegio} />}
    </div>
  )
}
