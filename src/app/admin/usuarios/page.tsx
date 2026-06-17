'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

const GRADOS = [
  '4to Primaria','5to Primaria','6to Primaria',
  '1ero Básico','2do Básico','3ero Básico',
  '4to Bachillerato','5to Bachillerato',
]

const ROL_COLOR: Record<string,string> = {
  superadmin: '#DC2626', admin: '#D97706', maestro: '#2563EB',
  alumno: '#7C3AED', padre: '#0D9488', guia: '#059669'
}

interface Usuario {
  id: string; nombre_completo: string; email: string; rol: string
  grado: string | null; activo: boolean; ultimo_acceso: string | null
  colegio: { nombre: string; id: string }; colegio_id?: string
}

interface Asignacion {
  id: string; guia_id: string; tipo: string
  alumno_id?: string; grado?: string
  guia?: { nombre_completo: string }
  alumno?: { nombre_completo: string }
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios]     = useState<Usuario[]>([])
  const [cargando, setCargando]     = useState(true)
  const [buscar, setBuscar]         = useState('')
  const [filtroRol, setFiltroRol]   = useState('')
  const [filtroGrado, setFiltroGrado] = useState('')
  const [modalCrear, setModalCrear] = useState(false)
  const [modalEditar, setModalEditar] = useState<Usuario | null>(null)
  const [modalImportar, setModalImportar] = useState(false)
  const [modalBorrar, setModalBorrar] = useState(false)
  const [mensaje, setMensaje]       = useState('')
  const [procesando, setProcesando] = useState(false)
  const [colegioId, setColegioId]   = useState('')
  const [esSuperAdmin, setEsSuperAdmin] = useState(false)
  const [colegios, setColegios]     = useState<{id:string;nombre:string}[]>([])
  const [tabActivo, setTabActivo]   = useState<'usuarios'|'guias'>('usuarios')
  const [guias, setGuias]           = useState<Usuario[]>([])
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([])
  const [modalGuia, setModalGuia]   = useState(false)
  const [formGuia, setFormGuia]     = useState({ guia_id: '', tipo: 'grado', grado: '', alumno_id: '' })
  const [procesandoGuia, setProcesandoGuia] = useState(false)
  const [form, setForm]             = useState({ nombre_completo: '', email: '', rol: 'alumno', grado: '', colegio_id: '' })
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('colegios').select('id, nombre').order('nombre').then(({ data }) => { if (data) setColegios(data) })
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('usuarios').select('colegio_id, rol').eq('id', user.id).single().then(({ data }) => {
        if (data) { setColegioId(data.colegio_id); setEsSuperAdmin(data.rol === 'superadmin') }
      })
    })
  }, [])

  useEffect(() => { if (colegioId) { cargarUsuarios(); cargarGuias(); cargarAsignaciones() } }, [buscar, filtroRol, filtroGrado, colegioId])

  async function cargarUsuarios() {
    setCargando(true)
    const params = new URLSearchParams()
    if (buscar) params.set('buscar', buscar)
    if (filtroRol) params.set('rol', filtroRol)
    if (filtroGrado) params.set('grado', filtroGrado)
    if (!esSuperAdmin) params.set('colegio_id', colegioId)
    const res = await fetch(`/api/usuarios?${params}`)
    const data = await res.json()
    setUsuarios(data.usuarios || [])
    setCargando(false)
  }

  async function cargarGuias() {
    const supabase = createClient()
    const { data } = await supabase.from('usuarios')
      .select('id, nombre_completo, email, rol, grado, activo, ultimo_acceso, colegio:colegios(nombre, id)')
      .eq('colegio_id', colegioId).in('rol', ['maestro', 'admin', 'superadmin']).eq('activo', true).order('nombre_completo')
    setGuias((data as unknown as Usuario[]) || [])
  }

  async function cargarAsignaciones() {
    const supabase = createClient()
    const { data } = await supabase.from('guia_asignaciones')
      .select('id, guia_id, tipo, alumno_id, grado, guia:guia_id(nombre_completo), alumno:alumno_id(nombre_completo)')
      .eq('colegio_id', colegioId).eq('activo', true).order('creado_en', { ascending: false })
    setAsignaciones((data as unknown as Asignacion[]) || [])
  }

  async function crearAsignacion() {
    setProcesandoGuia(true)
    const supabase = createClient()
    const { error } = await supabase.from('guia_asignaciones').insert({
      guia_id: formGuia.guia_id, colegio_id: colegioId, tipo: formGuia.tipo,
      grado: formGuia.tipo === 'grado' ? formGuia.grado : null,
      alumno_id: formGuia.tipo === 'alumno' ? formGuia.alumno_id : null,
    })
    setProcesandoGuia(false)
    if (error) { setMensaje('❌ Error: ' + error.message); return }
    setModalGuia(false)
    setFormGuia({ guia_id: '', tipo: 'grado', grado: '', alumno_id: '' })
    cargarAsignaciones(); setMensaje('✅ Guía asignado correctamente')
  }

  async function eliminarAsignacion(id: string) {
    const supabase = createClient()
    await supabase.from('guia_asignaciones').update({ activo: false }).eq('id', id)
    cargarAsignaciones(); setMensaje('✅ Asignación eliminada')
  }

  async function toggleActivo(u: Usuario) {
    await fetch('/api/usuarios', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: u.id, nombre_completo: u.nombre_completo, rol: u.rol, grado: u.grado, activo: !u.activo }) })
    cargarUsuarios()
  }

  async function eliminarUsuario(u: Usuario) {
    if (!confirm(`¿Eliminar permanentemente a ${u.nombre_completo}?`)) return
    setProcesando(true)
    const res = await fetch('/api/usuarios', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: u.id }) })
    const data = await res.json()
    setProcesando(false)
    setMensaje(data.ok ? `✅ ${u.nombre_completo} eliminado` : `❌ ${data.error}`)
    cargarUsuarios()
  }

  async function resetPassword(u: Usuario) {
    const nueva = prompt(`Nueva contraseña para ${u.nombre_completo}:`)
    if (!nueva) return
    const res = await fetch('/api/usuarios', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: u.id, nombre_completo: u.nombre_completo, rol: u.rol, grado: u.grado, activo: u.activo, nueva_password: nueva }) })
    const data = await res.json()
    setMensaje(data.ok ? '✅ Contraseña actualizada' : `❌ ${data.error}`)
  }

  async function guardarEdicion() {
    if (!modalEditar) return
    setProcesando(true)
    const supabase = createClient()
    await supabase.from('usuarios').update({ rol: modalEditar.rol, colegio_id: modalEditar.colegio_id || colegioId, grado: modalEditar.grado }).eq('id', modalEditar.id)
    setMensaje('✅ Usuario actualizado'); setModalEditar(null); setProcesando(false); cargarUsuarios()
  }

  async function crearUsuario() {
    setProcesando(true)
    const res = await fetch('/api/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, colegio_id: form.colegio_id || colegioId }) })
    const data = await res.json()
    setProcesando(false)
    if (data.ok) { setMensaje('✅ Usuario creado y email enviado'); setModalCrear(false); setForm({ nombre_completo: '', email: '', rol: 'alumno', grado: '', colegio_id: '' }); cargarUsuarios() }
    else setMensaje(`❌ ${data.error}`)
  }

  async function importarCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    const texto = await file.text()
    const lineas = texto.split('\n').filter(l => l.trim())
    if (!lineas[0].toLowerCase().includes('email')) { setMensaje('❌ CSV debe tener: nombre_completo,email,rol,grado'); return }
    const cols = lineas[0].split(',').map(c => c.trim().toLowerCase())
    let ok = 0, errores = 0
    for (let i = 1; i < lineas.length; i++) {
      const vals = lineas[i].split(',').map(v => v.trim())
      const row: Record<string,string> = {}
      cols.forEach((col, idx) => { row[col] = vals[idx] || '' })
      if (!row.email) continue
      const res = await fetch('/api/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre_completo: row.nombre_completo || 'Sin nombre', email: row.email, grado: row.grado || '', rol: row.rol || 'alumno', colegio_id: colegioId }) })
      const data = await res.json()
      if (data.ok) ok++; else errores++
    }
    setMensaje(`✅ ${ok} creados, ${errores} errores`); setModalImportar(false); cargarUsuarios()
  }

  async function limpiarCiclo() {
    setProcesando(true)
    const res = await fetch('/api/admin/limpiar-ciclo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ colegio_id: colegioId }) })
    const data = await res.json()
    setProcesando(false); setModalBorrar(false)
    if (data.ok) { setMensaje(`✅ ${data.eliminados} alumnos removidos`); cargarUsuarios() }
    else setMensaje(`❌ ${data.error}`)
  }

  function exportarCSV() {
    const rows = usuarios.map(u => [u.nombre_completo, u.email, u.rol, u.grado || '', u.activo ? 'Sí' : 'No'])
    const csv = [['Nombre','Email','Rol','Grado','Activo'], ...rows].map(r => r.join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'usuarios.csv'; a.click()
  }

  const filtrados = usuarios.filter(u => buscar === '' || u.nombre_completo.toLowerCase().includes(buscar.toLowerCase()) || u.email.toLowerCase().includes(buscar.toLowerCase()))

  const S = {
    sidebar: { width: '240px', background: '#2C3E6B', minHeight: '100vh', display: 'flex', flexDirection: 'column' as const, flexShrink: 0 },
    nav: { padding: '16px 12px', flex: 1 },
    navItem: (active?: boolean) => ({ display: 'block', padding: '10px 12px', borderRadius: '8px', color: active ? 'white' : 'rgba(255,255,255,.6)', background: active ? 'rgba(255,255,255,.15)' : 'transparent', textDecoration: 'none', fontSize: '13px', fontWeight: active ? 600 : 400, marginBottom: '2px' } as React.CSSProperties),
    main: { flex: 1, padding: '32px', background: '#F5F7FA', overflowX: 'auto' as const },
    card: { background: 'white', borderRadius: '12px', border: '1px solid rgba(44,62,107,.08)', boxShadow: '0 2px 12px rgba(44,62,107,.06)' },
    btn: (color = '#2C3E6B') => ({ background: color, color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' } as React.CSSProperties),
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
      {/* Sidebar */}
      <aside style={S.sidebar}>
        <div style={{ padding: '24px 20px', borderBottom: '1px solid rgba(255,255,255,.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <img src="/buho.png" alt="Owlaris" style={{ width: '32px', height: '32px', objectFit: 'contain' }}/>
            <span style={{ color: 'white', fontWeight: 700, fontSize: '16px' }}>Owlaris</span>
          </div>
          <p style={{ color: 'rgba(255,255,255,.5)', fontSize: '11px', margin: 0 }}>Panel de administración</p>
        </div>
        <nav style={S.nav}>
          {[
            { href: '/admin', label: '🏠 Inicio' },
            { href: '/admin/usuarios', label: '👥 Usuarios y Guías', active: true },
            { href: '/guia', label: '🎓 Panel del Guía' },
            { href: '/docente', label: '📊 Dashboard' },
          ].map(item => <a key={item.href} href={item.href} style={S.navItem(item.active)}>{item.label}</a>)}
        </nav>
        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,.1)' }}>
          <a href="/admin/configuracion" style={S.navItem()}>⚙️ Configuración</a>
          <p style={{ color: 'rgba(255,255,255,.4)', fontSize: '11px', margin: '8px 0 0' }}>© 2026 Owlaris</p>
        </div>
      </aside>

      {/* Main */}
      <main style={S.main}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#1A2744', margin: 0 }}>👥 Usuarios y Guías</h1>
          <span style={{ color: '#64748B', fontSize: '13px' }}>{filtrados.length} usuarios</span>
        </div>

        {mensaje && (
          <div style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '10px', fontSize: '13px', background: mensaje.startsWith('✅') ? '#F0FDF4' : '#FEF2F2', color: mensaje.startsWith('✅') ? '#16A34A' : '#DC2626', border: `1px solid ${mensaje.startsWith('✅') ? '#BBF7D0' : '#FECACA'}` }}>
            {mensaje} <button onClick={() => setMensaje('')} style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: '8px', opacity: 0.6 }}>×</button>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '2px solid #E2E8F0', paddingBottom: '0' }}>
          {(['usuarios', 'guias'] as const).map(tab => (
            <button key={tab} onClick={() => setTabActivo(tab)}
              style={{ padding: '10px 20px', fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer', borderBottom: tabActivo === tab ? '2px solid #2C3E6B' : '2px solid transparent', color: tabActivo === tab ? '#2C3E6B' : '#94A3B8', background: 'transparent', marginBottom: '-2px' }}>
              {tab === 'usuarios' ? '👥 Usuarios' : '🎓 Guías y Asignaciones'}
            </button>
          ))}
        </div>

        {/* TAB USUARIOS */}
        {tabActivo === 'usuarios' && (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
              <input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="🔍 Buscar..."
                style={{ flex: 1, minWidth: '200px', padding: '8px 14px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', outline: 'none' }}/>
              {esSuperAdmin && (
                <select value={colegioId} onChange={e => setColegioId(e.target.value)}
                  style={{ padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', background: 'white' }}>
                  <option value="">Todos los colegios</option>
                  {colegios.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              )}
              <select value={filtroRol} onChange={e => setFiltroRol(e.target.value)}
                style={{ padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', background: 'white' }}>
                <option value="">Todos los roles</option>
                <option value="alumno">Alumnos</option>
                <option value="maestro">Maestros</option>
                <option value="admin">Admins</option>
                <option value="padre">Padres</option>
              </select>
              <select value={filtroGrado} onChange={e => setFiltroGrado(e.target.value)}
                style={{ padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', background: 'white' }}>
                <option value="">Todos los grados</option>
                {GRADOS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <button onClick={() => setModalCrear(true)} style={S.btn()}>+ Nuevo</button>
              <button onClick={() => setModalImportar(true)} style={S.btn('#475569')}>📤 CSV</button>
              <button onClick={exportarCSV} style={S.btn('#475569')}>📊 Exportar</button>
              <button onClick={() => setModalBorrar(true)} style={S.btn('#DC2626')}>🗑️ Limpiar ciclo</button>
            </div>

            <div style={S.card}>
              <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                    {['Nombre', 'Email', 'Rol', 'Grado', 'Último acceso', 'Estado', 'Acciones'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '12px 16px', color: '#64748B', fontWeight: 600, fontSize: '12px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cargando ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#94A3B8' }}>Cargando...</td></tr>
                  ) : filtrados.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#94A3B8' }}>No se encontraron usuarios</td></tr>
                  ) : filtrados.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid #F8FAFC' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 500, color: '#1A2744' }}>{u.nombre_completo}</td>
                      <td style={{ padding: '12px 16px', color: '#64748B', fontSize: '12px' }}>{u.email}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ background: `${ROL_COLOR[u.rol]}18`, color: ROL_COLOR[u.rol] || '#64748B', borderRadius: '6px', padding: '3px 10px', fontSize: '11px', fontWeight: 600 }}>
                          {u.rol}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#64748B', fontSize: '12px' }}>{u.grado || '—'}</td>
                      <td style={{ padding: '12px 16px', color: '#94A3B8', fontSize: '12px' }}>
                        {u.ultimo_acceso ? new Date(u.ultimo_acceso).toLocaleDateString('es-GT') : 'Nunca'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <button onClick={() => toggleActivo(u)} style={{ background: u.activo ? '#F0FDF4' : '#FEF2F2', color: u.activo ? '#16A34A' : '#DC2626', border: 'none', borderRadius: '6px', padding: '3px 10px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                          {u.activo ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button onClick={() => resetPassword(u)} title="Cambiar contraseña"
                            style={{ background: 'none', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px' }}>🔑</button>
                          <button onClick={() => setModalEditar({ ...u, colegio_id: u.colegio?.id || colegioId })} title="Editar"
                            style={{ background: 'none', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px' }}>✏️</button>
                          <button onClick={() => eliminarUsuario(u)} title="Eliminar"
                            style={{ background: 'none', border: '1px solid #FECACA', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px' }}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* TAB GUÍAS */}
        {tabActivo === 'guias' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <p style={{ color: '#64748B', fontSize: '13px', margin: 0 }}>Asigna guías a alumnos individuales o por grado completo</p>
              <button onClick={() => setModalGuia(true)} style={S.btn()}>+ Nueva asignación</button>
            </div>

            <div style={S.card}>
              <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                    {['Guía', 'Tipo', 'Asignado a', 'Acciones'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '12px 16px', color: '#64748B', fontWeight: 600, fontSize: '12px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {asignaciones.length === 0 ? (
                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: '#94A3B8' }}>Sin asignaciones aún. Crea la primera.</td></tr>
                  ) : asignaciones.map(a => (
                    <tr key={a.id} style={{ borderBottom: '1px solid #F8FAFC' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 500, color: '#1A2744' }}>{(a.guia as {nombre_completo:string})?.nombre_completo || '—'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ background: a.tipo === 'grado' ? '#EFF6FF' : '#F5F3FF', color: a.tipo === 'grado' ? '#2563EB' : '#7C3AED', borderRadius: '6px', padding: '3px 10px', fontSize: '11px', fontWeight: 600 }}>
                          {a.tipo === 'grado' ? '📚 Por grado' : '👤 Individual'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#64748B', fontSize: '12px' }}>
                        {a.tipo === 'grado' 
                          ? `${a.grado} — ${colegios.find(c => c.id === colegioId)?.nombre || 'Colegio'}`
                          : (a.alumno as {nombre_completo:string})?.nombre_completo || '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <button onClick={() => eliminarAsignacion(a.id)}
                          style={{ background: 'none', border: '1px solid #FECACA', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '12px', color: '#DC2626' }}>
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>

      {/* Modal Crear */}
      {modalCrear && (
        <Modal titulo="Nuevo usuario" onClose={() => setModalCrear(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { label: 'Nombre completo', key: 'nombre_completo', type: 'text', placeholder: 'Ana García' },
              { label: 'Email', key: 'email', type: 'email', placeholder: 'ana@colegio.edu.gt' },
            ].map(f => (
              <div key={f.key}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.5px' }}>{f.label}</label>
                <input type={f.type} value={(form as Record<string,string>)[f.key]} placeholder={f.placeholder}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' as const }}/>
              </div>
            ))}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.5px' }}>Rol</label>
              <select value={form.rol} onChange={e => setForm(p => ({ ...p, rol: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px' }}>
                <option value="alumno">Alumno</option>
                <option value="maestro">Maestro / Guía</option>
                <option value="padre">Padre de familia</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {form.rol === 'alumno' && (
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.5px' }}>Grado</label>
                <select value={form.grado} onChange={e => setForm(p => ({ ...p, grado: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px' }}>
                  <option value="">Seleccionar grado</option>
                  {GRADOS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            )}
            {esSuperAdmin && (
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.5px' }}>Colegio</label>
                <select value={form.colegio_id || colegioId} onChange={e => setForm(p => ({ ...p, colegio_id: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px' }}>
                  {colegios.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
            )}
            <button onClick={crearUsuario} disabled={procesando}
              style={{ ...S.btn(), width: '100%', padding: '11px', marginTop: '4px', opacity: procesando ? 0.6 : 1 }}>
              {procesando ? 'Creando...' : 'Crear usuario'}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal Editar */}
      {modalEditar && (
        <Modal titulo="Editar usuario" onClose={() => setModalEditar(null)}>
          <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '16px' }}>{modalEditar.nombre_completo}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.5px' }}>Rol</label>
              <select value={modalEditar.rol} onChange={e => setModalEditar({ ...modalEditar, rol: e.target.value })}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px' }}>
                <option value="alumno">Alumno</option>
                <option value="maestro">Maestro / Guía</option>
                <option value="padre">Padre de familia</option>
                <option value="admin">Admin</option>
                <option value="superadmin">Superadmin</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.5px' }}>Colegio</label>
              <select value={modalEditar.colegio_id || colegioId} onChange={e => setModalEditar({ ...modalEditar, colegio_id: e.target.value })}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px' }}>
                {colegios.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.5px' }}>Grado</label>
              <input value={modalEditar.grado || ''} onChange={e => setModalEditar({ ...modalEditar, grado: e.target.value })}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px' }} placeholder="Ej: 3ero Básico"/>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button onClick={() => setModalEditar(null)} style={{ flex: 1, padding: '9px', border: '1px solid #E2E8F0', borderRadius: '8px', background: 'white', cursor: 'pointer', fontSize: '13px' }}>Cancelar</button>
              <button onClick={guardarEdicion} disabled={procesando} style={{ ...S.btn(), flex: 1, padding: '9px', opacity: procesando ? 0.6 : 1 }}>{procesando ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Asignar Guía */}
      {modalGuia && (
        <Modal titulo="Nueva asignación de guía" onClose={() => setModalGuia(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.5px' }}>Guía (Maestro o Admin)</label>
              <select value={formGuia.guia_id} onChange={e => setFormGuia(p => ({ ...p, guia_id: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px' }}>
                <option value="">Seleccionar guía...</option>
                {guias.map(g => <option key={g.id} value={g.id}>{g.nombre_completo} ({g.rol})</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.5px' }}>Tipo de asignación</label>
              <select value={formGuia.tipo} onChange={e => setFormGuia(p => ({ ...p, tipo: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px' }}>
                <option value="grado">📚 Grado completo (lote)</option>
                <option value="alumno">👤 Alumno individual</option>
              </select>
            </div>
            {formGuia.tipo === 'grado' && (
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.5px' }}>Grado</label>
                <select value={formGuia.grado} onChange={e => setFormGuia(p => ({ ...p, grado: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px' }}>
                  <option value="">Seleccionar grado...</option>
                  {GRADOS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            )}
            {formGuia.tipo === 'alumno' && (
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.5px' }}>Alumno</label>
                <select value={formGuia.alumno_id} onChange={e => setFormGuia(p => ({ ...p, alumno_id: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px' }}>
                  <option value="">Seleccionar alumno...</option>
                  {usuarios.filter(u => u.rol === 'alumno').map(u => (
                    <option key={u.id} value={u.id}>{u.nombre_completo} — {u.grado}</option>
                  ))}
                </select>
              </div>
            )}
            <button onClick={crearAsignacion} disabled={procesandoGuia || !formGuia.guia_id}
              style={{ ...S.btn(), width: '100%', padding: '11px', marginTop: '4px', opacity: (procesandoGuia || !formGuia.guia_id) ? 0.5 : 1 }}>
              {procesandoGuia ? 'Asignando...' : 'Crear asignación'}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal Importar */}
      {modalImportar && (
        <Modal titulo="Importar CSV" onClose={() => setModalImportar(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ background: '#F8FAFC', borderRadius: '8px', padding: '12px', fontSize: '12px', fontFamily: 'monospace', color: '#475569' }}>
              nombre_completo,email,rol,grado
            </div>
            <p style={{ fontSize: '12px', color: '#94A3B8' }}>Se generará contraseña automática y se enviará por email.</p>
            <input ref={fileRef} type="file" accept=".csv" onChange={importarCSV}
              style={{ fontSize: '13px', color: '#475569' }}/>
          </div>
        </Modal>
      )}

      {/* Modal Limpiar ciclo */}
      {modalBorrar && (
        <Modal titulo="⚠️ Limpiar ciclo escolar" onClose={() => setModalBorrar(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '16px' }}>
              <p style={{ color: '#DC2626', fontWeight: 600, fontSize: '13px', margin: '0 0 8px' }}>Esta acción es irreversible</p>
              <p style={{ color: '#991B1B', fontSize: '13px', margin: 0 }}>Se eliminarán todos los alumnos, historial e interacciones.</p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setModalBorrar(false)} style={{ flex: 1, padding: '9px', border: '1px solid #E2E8F0', borderRadius: '8px', background: 'white', cursor: 'pointer', fontSize: '13px' }}>Cancelar</button>
              <button onClick={limpiarCiclo} disabled={procesando} style={{ ...S.btn('#DC2626'), flex: 1, padding: '9px', opacity: procesando ? 0.6 : 1 }}>{procesando ? 'Eliminando...' : 'Limpiar ciclo'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Modal({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '20px' }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '440px', boxShadow: '0 20px 60px rgba(0,0,0,.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1A2744' }}>{titulo}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94A3B8', lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}
