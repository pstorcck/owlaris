'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { GRADOS_MONTANO_ESCOLARIS, GRADOS_ESCHOLARIS } from '@/lib/sharepointFolders'

export default function SignupPage() {
  const [nombre, setNombre]     = useState('')
  const [email, setEmail]       = useState('')
  const [colegioId, setColegioId] = useState('')
  const [grado, setGrado]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [exito, setExito]       = useState('')
  const router = useRouter()

  const COLEGIOS = [
    { id: '9fe47d21-5ee3-4aa1-a347-a08f95869a96', nombre: 'Colegio Montano Portal Los Álamos', esEscholaris: false },
    { id: '4cd950b5-3385-4aa9-84a7-201eb87406f4', nombre: 'Colegio Montano Cortijo', esEscholaris: false },
    { id: 'be33fb6b-6ba5-449f-876f-0c6ec60a8f58', nombre: 'Colegio Escolaris', esEscholaris: true },
  ]

  const colegioSeleccionado = COLEGIOS.find(c => c.id === colegioId)
  const GRADOS = colegioSeleccionado?.esEscholaris ? GRADOS_ESCHOLARIS : GRADOS_MONTANO_ESCOLARIS

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setExito('')
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre_completo: nombre, email, grado, rol: 'alumno', colegio_id: colegioId }),
      })
      const data = await res.json()
      setLoading(false)
      if (!res.ok) { setError(data.error || 'Error al crear la cuenta'); return }
      setExito(data.mensaje)
      setTimeout(() => router.push('/login'), 4000)
    } catch {
      setLoading(false)
      setError('Error de conexión. Intenta de nuevo.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{background:'linear-gradient(160deg,#F8F7FF 0%,#F5FAFF 52%,#EEF2FF 100%)'}}>
      <div className="absolute inset-0 pointer-events-none opacity-50"
        style={{backgroundImage:'linear-gradient(rgba(109,40,217,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(14,116,144,.045) 1px, transparent 1px)',backgroundSize:'46px 46px'}}/>
      <div className="relative w-full max-w-md">
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center rounded-full mb-4 px-3 py-1.5 bg-slate-50 border border-violet-100 text-[#5B21B6] text-[11px] font-bold tracking-wide">
            Registro institucional
          </div>
          <div className="mx-auto flex items-center justify-center w-24 h-24 rounded-[22px] mb-4 shadow-lg shadow-violet-100/80 overflow-hidden border border-violet-100 bg-white">
            <Image src="/buho.png" alt="Owlaris" width={96} height={96} className="object-contain p-1"/>
          </div>
          <h1 className="text-3xl font-bold text-[#1E1B4B]">Owlaris</h1>
          <p className="text-[#6B658C] mt-1 font-medium">Tu tutor académico inteligente</p>
        </div>
        <div className="bg-white/90 backdrop-blur-xl rounded-[22px] shadow-2xl shadow-violet-100/70 p-8 border border-violet-100">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Crear cuenta</h2>
          <p className="text-xs text-gray-400 mb-6">
            Solo para correos <strong>@colegiomontano.edu.gt</strong> y <strong>@escolaris.edu.gt</strong>
          </p>
          {exito ? (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-4 rounded-xl text-sm text-center">
              <p className="font-semibold mb-1">✅ {exito}</p>
              <p className="text-xs text-green-600">Redirigiendo al login...</p>
            </div>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
                <input type="text" value={nombre} onChange={e => setNombre(e.target.value)}
                  placeholder="Juan García López" required className="input-base"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Colegio / Sede</label>
                <select value={colegioId} onChange={e => { setColegioId(e.target.value); setGrado('') }} required
                  className="input-base">
                  <option value="">Selecciona tu colegio...</option>
                  {COLEGIOS.map(col => (
                    <option key={col.id} value={col.id}>{col.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Grado</label>
                <select value={grado} onChange={e => setGrado(e.target.value)} required
                  disabled={!colegioId} className="input-base">
                  <option value="">{colegioId ? 'Selecciona tu grado...' : 'Primero selecciona tu colegio'}</option>
                  {GRADOS.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Correo institucional</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="juan@colegiomontano.edu.gt" required className="input-base"/>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>
              )}
              <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/>
                    </svg>
                    Creando cuenta...
                  </span>
                ) : 'Crear mi cuenta'}
              </button>
            </form>
          )}
          <p className="text-center text-xs text-gray-400 mt-6">
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" className="text-owlaris-primary font-medium hover:underline">Inicia sesión</Link>
          </p>
        </div>
        <p className="text-center text-[#9490B8] text-xs mt-6">
          © {new Date().getFullYear()} Owlaris · Todos los derechos reservados
        </p>
      </div>
    </div>
  )
}
