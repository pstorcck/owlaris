'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const GRADOS = ['Preparatoria','Parvulos','Primero Primaria','Segundo Primaria','Tercero Primaria',
  'Cuarto Primaria','Quinto Primaria','Sexto Primaria','Primero Basico','Segundo Basico',
  'Tercero Basico','Cuarto Bachillerato','Quinto Bachillerato']

const ROLES = ['alumno','maestro','admin','superadmin']

interface Usuario {
  id: string; nombre_completo: string; email: string; rol: string
  grado: string | null; activo: boolean; colegio: { nombre: string; slug: string }
  ultimo_acceso: string | null
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios]         = useState<Usuario[]>([])
  const [cargando, setCargando]         = useState(true)
  const [buscar, setBuscar]             = useState('')
  const [filtroRol, setFiltroRol]       = useState('')
  const [filtroGrado, setFiltroGrado]   = useState('')
  const [modalCrear, setModalCrear]     = useState(false)
  const [modalEditar, setModalEditar]   = useState<Usuario | null>(null)
  const [modalImportar, setModalImportar] = useState(false)
  const [mensaje, setMensaje]           = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    nombre_completo: '', email: '', password: '', rol: 'alumno', grado: '', colegio_id: ''
  })

  async function cargarUsuarios() {
    setCargando(true)
    const params = new URLSearchParams()
    if (buscar)     params.set('buscar', buscar)
    if (filtroRol)  params.set('rol', filtroRol)
    if (filtroGrado) params.set('grado', filtroGrado)
    const res = await fetch(`/api/usuarios?${params}`)
    const data = await res.json()
    setUsuarios(data.usuarios || [])
    setCargando(false)
  }

  useEffect(() => { cargarUsuarios() }, [buscar, filtroRol, filtroGrado])

  async function crearUsuario() {
    const res = await fetch('/api/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (data.ok) {
      setMensaje('✅ Usuario creado')
      setModalCrear(false)
      setForm({ nombre_completo: '', email: '', password: '', rol: 'alumno', grado: '', colegio_id: '' })
      cargarUsuarios()
    } else {
      setMensaje(`❌ ${data.error}`)
    }
  }

  async function actualizarUsuario(campos: Partial<Usuario> & { nueva_password?: string }) {
    const res = await fetch('/api/usuarios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: modalEditar?.id, ...campos }),
    })
    const data = await res.json()
    if (data.ok) {
      setMensaje('✅ Usuario actualizado')
      setModalEditar(null)
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

  function exportarExcel() {
    const headers = ['Nombre', 'Email', 'Rol', 'Grado', 'Activo', 'Último acceso']
    const rows = usuarios.map(u => [
      u.nombre_completo, u.email, u.rol, u.grado || '', u.activo ? 'Sí' : 'No',
      u.ultimo_acceso ? new Date(u.ultimo_acceso).toLocaleDateString('es-GT') : 'Nunca'
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'usuarios-owlaris.csv'; a.click()
  }

  return (
    <div className="min-h-screen bg-owlaris-dark text-white">
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <Link href="/admin" className="text-gray-400 hover:text-white">← Admin</Link>
          <h1 className="font-bold text-lg">👥 Gestión de Usuarios</h1>
          <span className="text-gray-500 text-sm">{usuarios.length} usuarios</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6">
        {mensaje && (
          <div className={`mb-4 px-4 py-3 rounded-xl text-sm ${mensaje.startsWith('✅') ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
            {mensaje} <button onClick={() => setMensaje('')} className="ml-2 opacity-60">×</button>
          </div>
        )}

        {/* Barra de herramientas */}
        <div className="flex flex-wrap gap-3 mb-6">
          <input
            value={buscar} onChange={e => setBuscar(e.target.value)}
            placeholder="🔍 Buscar por nombre o email..."
            className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-sm flex-1 min-w-48
                       focus:outline-none focus:ring-2 focus:ring-owlaris-secondary text-white placeholder-gray-400"
          />
          <select value={filtroRol} onChange={e => setFiltroRol(e.target.value)}
            className="bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white focus:outline-none">
            <option value="">Todos los roles</option>
            {ROLES.map(r => <option key={r} value={r} className="text-gray-900">{r}</option>)}
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
            📤 Importar Excel
          </button>
          <button onClick={exportarExcel}
            className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl text-sm transition-colors">
            📊 Exportar
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
              ) : usuarios.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-500">No se encontraron usuarios</td></tr>
              ) : usuarios.map(u => (
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
                        ${u.activo ? 'bg-green-500/20 text-green-300 hover:bg-red-500/20 hover:text-red-300'
                                   : 'bg-red-500/20 text-red-300 hover:bg-green-500/20 hover:text-green-300'}`}>
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setModalEditar(u)}
                      className="text-gray-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-white/10 transition-colors">
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {/* Modal Crear */}
      {modalCrear && (
        <Modal titulo="Nuevo usuario" onClose={() => setModalCrear(false)}>
          <div className="space-y-3">
            {[
              { label: 'Nombre completo', key: 'nombre_completo', type: 'text' },
              { label: 'Email', key: 'email', type: 'email' },
              { label: 'Contraseña', key: 'password', type: 'password' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs text-gray-400 mb-1 block">{f.label}</label>
                <input type={f.type} value={(form as Record<string, string>)[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-owlaris-secondary"/>
              </div>
            ))}
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Rol</label>
              <select value={form.rol} onChange={e => setForm(p => ({ ...p, rol: e.target.value }))}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
                {ROLES.map(r => <option key={r} value={r} className="text-gray-900">{r}</option>)}
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
            <button onClick={crearUsuario}
              className="w-full bg-owlaris-primary hover:bg-purple-700 py-2 rounded-xl text-sm font-medium transition-colors mt-2">
              Crear usuario
            </button>
          </div>
        </Modal>
      )}

      {/* Modal Editar */}
      {modalEditar && (
        <EditarModal usuario={modalEditar} onClose={() => setModalEditar(null)} onSave={actualizarUsuario} />
      )}

      {/* Modal Importar */}
      {modalImportar && (
        <Modal titulo="Importar usuarios desde Excel" onClose={() => setModalImportar(false)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-400">El archivo Excel debe tener estas columnas en orden:</p>
            <div className="bg-white/5 rounded-lg p-3 text-xs font-mono text-gray-300">
              nombre_completo | email | password | rol | grado
            </div>
            <p className="text-xs text-gray-500">Ejemplo: Ana García | ana@colegio.gt | Pass@2026 | alumno | Primero Basico</p>
            <input ref={fileRef} type="file" accept=".csv,.xlsx"
              className="w-full text-sm text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg
                         file:border-0 file:bg-owlaris-primary file:text-white file:cursor-pointer"/>
            <p className="text-xs text-gray-500">Por ahora soporta CSV. Próximamente Excel directo.</p>
            <button onClick={() => setModalImportar(false)}
              className="w-full bg-white/10 hover:bg-white/20 py-2 rounded-xl text-sm transition-colors">
              Cerrar
            </button>
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

function EditarModal({ usuario, onClose, onSave }: {
  usuario: Usuario; onClose: () => void
  onSave: (campos: Partial<Usuario> & { nueva_password?: string }) => void
}) {
  const [nombre, setNombre]   = useState(usuario.nombre_completo)
  const [rol, setRol]         = useState(usuario.rol)
  const [grado, setGrado]     = useState(usuario.grado || '')
  const [activo, setActivo]   = useState(usuario.activo)
  const [newPw, setNewPw]     = useState('')

  return (
    <Modal titulo={`Editar: ${usuario.nombre_completo}`} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Nombre completo</label>
          <input value={nombre} onChange={e => setNombre(e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-owlaris-secondary"/>
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Rol</label>
          <select value={rol} onChange={e => setRol(e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
            {['alumno','maestro','admin','superadmin'].map(r => <option key={r} value={r} className="text-gray-900">{r}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Grado</label>
          <select value={grado} onChange={e => setGrado(e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
            <option value="">Sin grado</option>
            {GRADOS.map(g => <option key={g} value={g} className="text-gray-900">{g}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Nueva contraseña (dejar vacío para no cambiar)</label>
          <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
            placeholder="••••••••"
            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-owlaris-secondary"/>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-gray-400">Estado:</label>
          <button onClick={() => setActivo(!activo)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors
              ${activo ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
            {activo ? 'Activo' : 'Inactivo'}
          </button>
        </div>
        <button onClick={() => onSave({ nombre_completo: nombre, rol, grado, activo, nueva_password: newPw || undefined })}
          className="w-full bg-owlaris-primary hover:bg-purple-700 py-2 rounded-xl text-sm font-medium transition-colors mt-2">
          Guardar cambios
        </button>
      </div>
    </Modal>
  )
}
