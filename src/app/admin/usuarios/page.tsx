'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const GRADOS = [
  '4to Primaria', '5to Primaria', '6to Primaria',
  '1ero Básico', '2do Básico', '3ero Básico',
  '4to Bachillerato', '5to Bachillerato',
]

interface Usuario {
  id: string; nombre_completo: string; email: string; rol: string
  grado: string | null; activo: boolean; ultimo_acceso: string | null
  colegio: { nombre: string; id: string }
  colegio_id?: string
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios]         = useState<Usuario[]>([])
  const [cargando, setCargando]         = useState(true)
  const [buscar, setBuscar]             = useState('')
  const [filtroRol, setFiltroRol]       = useState('alumno')
  const [filtroGrado, setFiltroGrado]   = useState('')
  const [modalCrear, setModalCrear]     = useState(false)
  const [modalEditar, setModalEditar]   = useState<Usuario | null>(null)
  const [modalImportar, setModalImportar] = useState(false)
  const [modalBorrar, setModalBorrar]   = useState(false)
  const [mensaje, setMensaje]           = useState('')
  const [procesando, setProcesando]     = useState(false)
  const [colegioId, setColegioId]       = useState('')
  const [esSuperAdmin, setEsSuperAdmin] = useState(false)
  const [colegios, setColegios]         = useState<{id:string;nombre:string}[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    nombre_completo: '', email: '', rol: 'alumno', grado: ''
  })
  const [tabActivo, setTabActivo]           = useState<'usuarios'|'guias'>('usuarios')
  const [guias, setGuias]                   = useState<Usuario[]>([])
  const [asignaciones, setAsignaciones]     = useState<{id:string;guia_id:string;tipo:string;alumno_id?:string;grado?:string;guia?:{nombre_completo:string}}[]>([])
  const [modalGuia, setModalGuia]           = useState(false)
  const [formGuia, setFormGuia]             = useState({ guia_id: '', tipo: 'grado', grado: '', alumno_id: '' })
  const [procesandoGuia, setProcesandoGuia] = useState(false)

  useEffect(() => {
    async function cargarColegios() {
      const supabase = createClient()
      const { data } = await supabase.from('colegios').select('id, nombre').order('nombre')
      if (data) setColegios(data)
    }
    cargarColegios()

    async function cargarPerfil() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: perfil } = await supabase
        .from('usuarios').select('colegio_id, rol').eq('id', user.id).single()
      if (perfil) {
        setColegioId(perfil.colegio_id)
        setEsSuperAdmin(perfil.rol === 'superadmin')
      }
    }
    cargarPerfil()
  }, [])

  useEffect(() => {
    if (colegioId) {
      cargarUsuarios()
      cargarGuias()
      cargarAsignaciones()
    }
  }, [buscar, filtroRol, filtroGrado, colegioId])

  async function cargarGuias() {
    const supabase = createClient()
    const { data } = await supabase
      .from('usuarios')
      .select('id, nombre_completo, email, rol, grado, activo, ultimo_acceso, colegio:colegios(nombre, id)')
      .eq('colegio_id', colegioId)
      .in('rol', ['maestro', 'admin'])
      .eq('activo', true)
      .order('nombre_completo')
    setGuias((data as unknown as Usuario[]) || [])
  }

  async function cargarAsignaciones() {
    const supabase = createClient()
    const { data } = await supabase
      .from('guia_asignaciones')
      .select('id, guia_id, tipo, alumno_id, grado, guia:guia_id(nombre_completo)')
      .eq('colegio_id', colegioId)
      .eq('activo', true)
      .order('creado_en', { ascending: false })
    setAsignaciones((data as unknown as typeof asignaciones) || [])
  }

  async function crearAsignacion() {
    setProcesandoGuia(true)
    const supabase = createClient()
    await supabase.from('guia_asignaciones').insert({
      guia_id: formGuia.guia_id,
      colegio_id: colegioId,
      tipo: formGuia.tipo,
      grado: formGuia.tipo === 'grado' ? formGuia.grado : null,
      alumno_id: formGuia.tipo === 'alumno' ? formGuia.alumno_id : null,
    })
    setProcesandoGuia(false)
    setModalGuia(false)
    setFormGuia({ guia_id: '', tipo: 'grado', grado: '', alumno_id: '' })
    cargarAsignaciones()
    setMensaje('✅ Guía asignado correctamente')
  }

  async function eliminarAsignacion(id: string) {
    const supabase = createClient()
    await supabase.from('guia_asignaciones').update({ activo: false }).eq('id', id)
    cargarAsignaciones()
    setMensaje('✅ Asignación eliminada')
  }

  async function cargarUsuarios() {
    setCargando(true)
    const params = new URLSearchParams()
    if (buscar)     params.set('buscar', buscar)
    if (filtroRol)  params.set('rol', filtroRol)
    if (filtroGrado) params.set('grado', filtroGrado)
    if (!esSuperAdmin) params.set('colegio_id', colegioId)
    const res  = await fetch(`/api/usuarios?${params}`)
    const data = await res.json()
    setUsuarios(data.usuarios || [])
    setCargando(false)
  }

  async function crearUsuario() {
    setProcesando(true)
    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, colegio_id: colegioId }),
    })
    const data = await res.json()
    setProcesando(false)
    if (data.ok) {
      setMensaje('✅ Usuario creado y email enviado')
      setModalCrear(false)
      setForm({ nombre_completo: '', email: '', rol: 'alumno', grado: '' })
      cargarUsuarios()
    } else {
      setMensaje(`❌ ${data.error}`)
    }
  }

  async function toggleActivo(u: Usuario) {
    await fetch('/api/usuarios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: u.id, nombre_completo: u.nombre_completo, rol: u.rol, grado: u.grado, activo: !u.activo }),
    })
    cargarUsuarios()
  }

  async function resetPassword(u: Usuario) {
    const nueva = prompt(`Nueva contraseña para ${u.nombre_completo}:`)
    if (!nueva) return
    const res = await fetch('/api/usuarios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: u.id, nombre_completo: u.nombre_completo, rol: u.rol, grado: u.grado, activo: u.activo, nueva_password: nueva }),
    })
    const data = await res.json()
    setMensaje(data.ok ? '✅ Contraseña actualizada' : `❌ ${data.error}`)
  }

  async function limpiarCiclo() {
    setProcesando(true)
    const res = await fetch('/api/admin/limpiar-ciclo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ colegio_id: colegioId }),
    })
    const data = await res.json()
    setProcesando(false)
    setModalBorrar(false)
    if (data.ok) {
      setMensaje(`✅ Ciclo limpiado — ${data.eliminados} alumnos removidos`)
      cargarUsuarios()
    } else {
      setMensaje(`❌ ${data.error}`)
    }
  }

  async function importarCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const texto = await file.text()
    const lineas = texto.split('\n').filter(l => l.trim())
    const encabezado = lineas[0].toLowerCase()

    if (!encabezado.includes('email')) {
      setMensaje('❌ El archivo debe tener columnas: nombre_completo, email, rol, grado')
      return
    }

    const cols = lineas[0].split(',').map(c => c.trim().toLowerCase())
    let ok = 0, errores = 0

    for (let i = 1; i < lineas.length; i++) {
      const vals = lineas[i].split(',').map(v => v.trim())
      const row: Record<string, string> = {}
      cols.forEach((col, idx) => { row[col] = vals[idx] || '' })

      if (!row.email) continue

      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre_completo: row.nombre_completo || row.nombre || 'Sin nombre',
          email: row.email,
          grado: row.grado || '',
          rol:   row.rol   || 'alumno',
          colegio_id: colegioId,
        }),
      })
      const data = await res.json()
      if (data.ok) ok++; else errores++
    }

    setMensaje(`✅ Importación completa: ${ok} creados, ${errores} errores`)
    setModalImportar(false)
    cargarUsuarios()
  }

  async function eliminarUsuario(u: Usuario) {
    if (!confirm(`¿Eliminar permanentemente a ${u.nombre_completo}? Esta acción no se puede deshacer.`)) return
    setProcesando(true)
    const res = await fetch('/api/usuarios', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: u.id }),
    })
    const data = await res.json()
    setProcesando(false)
    setMensaje(data.ok ? `✅ Usuario ${u.nombre_completo} eliminado` : `❌ ${data.error}`)
    cargarUsuarios()
  }

  async function guardarEdicion() {
    if (!modalEditar) return
    setProcesando(true)
    const supabase = createClient()
    await supabase.from('usuarios').update({
      rol: modalEditar.rol,
      colegio_id: modalEditar.colegio_id || colegioId,
      grado: modalEditar.grado,
    }).eq('id', modalEditar.id)
    setMensaje('✅ Usuario actualizado')
    setModalEditar(null)
    setProcesando(false)
    cargarUsuarios()
  }

  function exportarCSV() {
    const headers = ['Nombre', 'Email', 'Rol', 'Grado', 'Activo', 'Último acceso']
    const rows    = usuarios.map(u => [
      u.nombre_completo, u.email, u.rol, u.grado || '', u.activo ? 'Sí' : 'No',
      u.ultimo_acceso ? new Date(u.ultimo_acceso).toLocaleDateString('es-GT') : 'Nunca'
    ])
    const csv  = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url; a.download = 'usuarios-owlaris.csv'; a.click()
  }

  const filtrados = usuarios.filter(u =>
    buscar === '' ||
    u.nombre_completo.toLowerCase().includes(buscar.toLowerCase()) ||
    u.email.toLowerCase().includes(buscar.toLowerCase())
  )

  return (
    <div style={{minHeight:'100vh',background:'#F5F7FA',fontFamily:'system-ui,-apple-system,sans-serif',display:'flex'}}>
      {/* Sidebar */}
      <aside style={{width:'240px',background:'#2C3E6B',minHeight:'100vh',display:'flex',flexDirection:'column',flexShrink:0}}>
        <div style={{padding:'24px 20px',borderBottom:'1px solid rgba(255,255,255,.1)'}}>
          <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'4px'}}>
            <img src="/buho.png" alt="Owlaris" style={{width:'32px',height:'32px',objectFit:'contain'}}/>
            <span style={{color:'white',fontWeight:700,fontSize:'16px'}}>Owlaris</span>
          </div>
          <p style={{color:'rgba(255,255,255,.5)',fontSize:'11px',margin:0}}>Panel de administración</p>
        </div>
        <nav style={{padding:'16px 12px',flex:1}}>
          {[
            { href: '/admin', label: '🏠 Inicio' },
            { href: '/admin/usuarios', label: '👥 Usuarios y Guías', active: true },
            { href: '/guia', label: '🎓 Panel del Guía' },
            { href: '/docente', label: '📊 Dashboard Docente' },
          ].map(item => (
            <a key={item.href} href={item.href} style={{display:'block',padding:'10px 12px',borderRadius:'8px',color: item.active ? 'white' : 'rgba(255,255,255,.6)',background: item.active ? 'rgba(255,255,255,.15)' : 'transparent',textDecoration:'none',fontSize:'13px',fontWeight: item.active ? 600 : 400,marginBottom:'2px',transition:'all .15s'}}>
              {item.label}
            </a>
          ))}
        </nav>
        <div style={{padding:'16px 20px',borderTop:'1px solid rgba(255,255,255,.1)'}}>
          <a href="/admin/configuracion" style={{display:'block',padding:'10px 12px',borderRadius:'8px',color:'rgba(255,255,255,.6)',textDecoration:'none',fontSize:'13px',marginBottom:'8px'}}>⚙️ Configuración</a>
          <p style={{color:'rgba(255,255,255,.4)',fontSize:'11px',margin:'0 0 12px'}}>© 2026 Owlaris</p>
        </div>
      </aside>

      <main style={{flex:1,padding:'32px',overflowX:'auto'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px'}}>
          <div>
            <h1 style={{fontSize:'22px',fontWeight:700,color:'#1A2744',margin:'0 0 4px'}}>👥 Usuarios y Guías</h1>
            <p style={{color:'#64748B',fontSize:'13px',margin:0}}>{filtrados.length} usuarios encontrados</p>
          </div>
        </div>
        {mensaje && (
          <div className={`mb-4 px-4 py-3 rounded-xl text-sm ${mensaje.startsWith('✅') ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
            {mensaje} <button onClick={() => setMensaje('')} className="ml-2 opacity-60">×</button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-white/10 pb-0">
          <button onClick={() => setTabActivo('usuarios')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${tabActivo === 'usuarios' ? 'bg-white/10 text-white border-b-2 border-owlaris-primary' : 'text-gray-400 hover:text-white'}`}>
            👥 Usuarios
          </button>
          <button onClick={() => setTabActivo('guias')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${tabActivo === 'guias' ? 'bg-white/10 text-white border-b-2 border-owlaris-primary' : 'text-gray-400 hover:text-white'}`}>
            🎓 Guías
          </button>
        </div>

        {tabActivo === 'guias' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Asignaciones de Guías</h2>
              <button onClick={() => setModalGuia(true)}
                className="bg-owlaris-primary hover:bg-purple-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors">
                + Nueva asignación
              </button>
            </div>
            <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-white/5 border-b border-white/10">
                  <tr>
                    {['Guía', 'Tipo', 'Asignado a', 'Acciones'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-gray-400 font-medium text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {asignaciones.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-12 text-gray-500">Sin asignaciones aún</td></tr>
                  ) : asignaciones.map(a => (
                    <tr key={a.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-4 py-3 font-medium">{(a.guia as {nombre_completo:string})?.nombre_completo}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${a.tipo === 'grado' ? 'bg-blue-500/20 text-blue-300' : 'bg-purple-500/20 text-purple-300'}`}>
                          {a.tipo === 'grado' ? '📚 Por grado' : '👤 Individual'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{a.grado || a.alumno_id || '—'}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => eliminarAsignacion(a.id)}
                          className="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded hover:bg-white/10">
                          🗑️ Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tabActivo === 'usuarios' && (
          <>
        {/* Barra herramientas */}
        <div className="flex flex-wrap gap-3 mb-6">
          <input value={buscar} onChange={e => setBuscar(e.target.value)}
            placeholder="🔍 Buscar por nombre o email..."
            className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-sm flex-1 min-w-48
                       text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-owlaris-secondary"/>
          <select value={filtroRol} onChange={e => setFiltroRol(e.target.value)}
            className="bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white focus:outline-none">
            <option value="">Todos los roles</option>
            <option value="alumno">Alumnos</option>
            <option value="maestro">Maestros</option>
            <option value="admin">Admins</option>
          </select>
          <select value={filtroGrado} onChange={e => setFiltroGrado(e.target.value)}
            className="bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white focus:outline-none">
            <option value="">Todos los grados</option>
            {GRADOS.map(g => <option key={g} value={g} className="text-gray-900">{g}</option>)}
          </select>
          <button onClick={() => setModalCrear(true)}
            className="bg-owlaris-primary hover:bg-purple-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors">
            + Nuevo usuario
          </button>
          <button onClick={() => setModalImportar(true)}
            className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl text-sm transition-colors">
            📤 Importar CSV
          </button>
          <button onClick={exportarCSV}
            className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl text-sm transition-colors">
            📊 Exportar
          </button>
          <button onClick={() => setModalBorrar(true)}
            className="bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 px-4 py-2 rounded-xl text-sm transition-colors">
            🗑️ Limpiar ciclo
          </button>
        </div>

        {/* Tabla */}
        <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                {['Nombre', 'Email', 'Rol', 'Grado', 'Último acceso', 'Estado', 'Acciones'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-gray-400 font-medium text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-500">Cargando...</td></tr>
              ) : filtrados.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-500">No se encontraron usuarios</td></tr>
              ) : filtrados.map(u => (
                <tr key={u.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 font-medium">{u.nombre_completo}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium
                      ${u.rol === 'superadmin' ? 'bg-red-500/20 text-red-300' :
                        u.rol === 'admin' ? 'bg-orange-500/20 text-orange-300' :
                        u.rol === 'maestro' ? 'bg-blue-500/20 text-blue-300' :
                        'bg-purple-500/20 text-purple-300'}`}>
                      {u.rol}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{u.grado || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {u.ultimo_acceso ? new Date(u.ultimo_acceso).toLocaleDateString('es-GT') : 'Nunca'}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActivo(u)}
                      className={`px-2 py-1 rounded-full text-xs font-medium transition-colors
                        ${u.activo ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td className="px-4 py-3 flex gap-2">
                    <button onClick={() => resetPassword(u)}
                      className="text-gray-400 hover:text-yellow-300 text-xs px-2 py-1 rounded hover:bg-white/10 transition-colors">
                      🔑
                    </button>
                    <button onClick={() => setModalEditar({...u, colegio_id: u.colegio?.id || colegioId})}
                      className="text-gray-400 hover:text-blue-300 text-xs px-2 py-1 rounded hover:bg-white/10 transition-colors">
                      ✏️
                    </button>
                    <button onClick={() => eliminarUsuario(u)}
                      className="text-gray-400 hover:text-red-300 text-xs px-2 py-1 rounded hover:bg-white/10 transition-colors">
                      🗑️
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

      {/* Modal Asignar Guía */}
      {modalGuia && (
        <Modal titulo="Nueva asignación de guía" onClose={() => setModalGuia(false)}>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Guía (Maestro o Admin)</label>
              <select value={formGuia.guia_id} onChange={e => setFormGuia(p => ({...p, guia_id: e.target.value}))}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white">
                <option value="">Seleccionar guía...</option>
                {guias.map(g => <option key={g.id} value={g.id} className="text-gray-900">{g.nombre_completo} ({g.rol})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Tipo de asignación</label>
              <select value={formGuia.tipo} onChange={e => setFormGuia(p => ({...p, tipo: e.target.value}))}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white">
                <option value="grado" className="text-gray-900">📚 Por grado (lote)</option>
                <option value="alumno" className="text-gray-900">👤 Alumno individual</option>
              </select>
            </div>
            {formGuia.tipo === 'grado' && (
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Grado</label>
                <select value={formGuia.grado} onChange={e => setFormGuia(p => ({...p, grado: e.target.value}))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white">
                  <option value="">Seleccionar grado...</option>
                  {GRADOS.map(g => <option key={g} value={g} className="text-gray-900">{g}</option>)}
                </select>
              </div>
            )}
            {formGuia.tipo === 'alumno' && (
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Alumno</label>
                <select value={formGuia.alumno_id} onChange={e => setFormGuia(p => ({...p, alumno_id: e.target.value}))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white">
                  <option value="">Seleccionar alumno...</option>
                  {usuarios.filter(u => u.rol === 'alumno').map(u => (
                    <option key={u.id} value={u.id} className="text-gray-900">{u.nombre_completo} — {u.grado}</option>
                  ))}
                </select>
              </div>
            )}
            <button onClick={crearAsignacion} disabled={procesandoGuia || !formGuia.guia_id}
              className="w-full bg-owlaris-primary hover:bg-purple-700 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 mt-2">
              {procesandoGuia ? 'Asignando...' : 'Crear asignación'}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal Editar */}
      {modalEditar && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Editar usuario</h3>
            <p className="text-sm text-gray-400 mb-4">{modalEditar.nombre_completo}</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Rol</label>
                <select value={modalEditar.rol}
                  onChange={e => setModalEditar({...modalEditar, rol: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
                  <option value="alumno">Alumno</option>
                  <option value="maestro">Maestro</option>
                  <option value="admin">Admin</option>
                  <option value="superadmin">Superadmin</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Colegio / Sede</label>
                <select value={modalEditar.colegio_id || colegioId}
                  onChange={e => setModalEditar({...modalEditar, colegio_id: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
                  {colegios.map(col => (
                    <option key={col.id} value={col.id}>{col.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Grado</label>
                <input value={modalEditar.grado || ''} onChange={e => setModalEditar({...modalEditar, grado: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                  placeholder="Ej: 3ero Básico"/>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setModalEditar(null)}
                className="flex-1 px-4 py-2 rounded-lg text-sm text-gray-400 hover:bg-white/5 border border-white/10">
                Cancelar
              </button>
              <button onClick={guardarEdicion} disabled={procesando}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50">
                {procesando ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Crear */}
      {modalCrear && (
        <Modal titulo="Nuevo usuario" onClose={() => setModalCrear(false)}>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Nombre completo</label>
              <input value={form.nombre_completo} onChange={e => setForm(p => ({ ...p, nombre_completo: e.target.value }))}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-owlaris-secondary"/>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Email institucional</label>
              <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="alumno@colegiomontano.edu.gt"
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-owlaris-secondary"/>
              <p className="text-xs text-gray-500 mt-1">Se generará contraseña automática y se enviará por email</p>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Rol</label>
              <select value={form.rol} onChange={e => setForm(p => ({ ...p, rol: e.target.value }))}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
                <option value="alumno" className="text-gray-900">Alumno</option>
                <option value="maestro" className="text-gray-900">Maestro</option>
                <option value="admin" className="text-gray-900">Admin</option>
              </select>
            </div>
            {form.rol === 'alumno' && (
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Grado</label>
                <select value={form.grado} onChange={e => setForm(p => ({ ...p, grado: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
                  <option value="">Seleccionar grado</option>
                  {GRADOS.map(g => <option key={g} value={g} className="text-gray-900">{g}</option>)}
                </select>
              </div>
            )}
            <button onClick={crearUsuario} disabled={procesando}
              className="w-full bg-owlaris-primary hover:bg-purple-700 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 mt-2">
              {procesando ? 'Creando...' : 'Crear usuario y enviar email'}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal Importar */}
      {modalImportar && (
        <Modal titulo="Importar usuarios desde CSV" onClose={() => setModalImportar(false)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-400">El archivo CSV debe tener estas columnas:</p>
            <div className="bg-white/5 rounded-lg p-3 text-xs font-mono text-gray-300">
              nombre_completo,email,rol,grado
            </div>
            <p className="text-xs text-gray-500">Ejemplo:<br/>Ana García,ana@colegiomontano.edu.gt,alumno,3ero Básico</p>
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
              <p className="text-yellow-300 text-xs">Se generará contraseña automática para cada usuario y se enviará por email.</p>
            </div>
            <input ref={fileRef} type="file" accept=".csv"
              onChange={importarCSV}
              className="w-full text-sm text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg
                         file:border-0 file:bg-owlaris-primary file:text-white file:cursor-pointer"/>
          </div>
        </Modal>
      )}

      {/* Modal Limpiar ciclo */}
      {modalBorrar && (
        <Modal titulo="⚠️ Limpiar ciclo escolar" onClose={() => setModalBorrar(false)}>
          <div className="space-y-4">
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              <p className="text-red-300 text-sm font-semibold mb-2">Esta acción es irreversible</p>
              <p className="text-red-200 text-sm">Se eliminarán permanentemente:</p>
              <ul className="text-red-200 text-sm mt-2 space-y-1">
                <li>• Todos los alumnos del colegio</li>
                <li>• Todo el historial de conversaciones</li>
                <li>• Todas las métricas e interacciones</li>
              </ul>
            </div>
            <p className="text-gray-400 text-sm">Los alumnos deberán registrarse nuevamente en el próximo ciclo escolar.</p>
            <div className="flex gap-3">
              <button onClick={() => setModalBorrar(false)}
                className="flex-1 bg-white/10 hover:bg-white/20 py-2 rounded-xl text-sm transition-colors">
                Cancelar
              </button>
              <button onClick={limpiarCiclo} disabled={procesando}
                className="flex-1 bg-red-500 hover:bg-red-600 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
                {procesando ? 'Eliminando...' : 'Sí, limpiar ciclo'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Modal({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-white/20 rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">{titulo}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">×</button>
        </div>
        {children}
      </div>
    </div>
  )
}
