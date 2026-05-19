'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const GRADOS = [
  '4to Primaria',
  '5to Primaria',
  '6to Primaria',
  '1ero Básico',
  '2do Básico',
  '3ero Básico',
  '4to Bachillerato',
  '5to Bachillerato',
]

export default function SignupPage() {
  const [nombre, setNombre]   = useState('')
  const [email, setEmail]     = useState('')
  const [grado, setGrado]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [exito, setExito]     = useState('')
  const router = useRouter()

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setExito('')

    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre_completo: nombre, email, grado, rol: 'alumno' }),
      })

      const data = await res.json()
      setLoading(false)

      if (!res.ok) {
        setError(data.error || 'Error al crear la cuenta')
        return
      }

      setExito(data.mensaje)
      setTimeout(() => router.push('/login'), 4000)
    } catch {
      setLoading(false)
      setError('Error de conexión. Intenta de nuevo.')
    }
  }

  return (
    <div className="min-h-screen bg-owlaris-dark flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-owlaris-primary opacity-10 rounded-full blur-3xl"/>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-owlaris-secondary opacity-10 rounded-full blur-3xl"/>
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-owlaris-primary rounded-2xl mb-4 shadow-lg">
            <span className="text-3xl">🦉</span>
          </div>
          <h1 className="text-3xl font-bold text-white">Owlaris</h1>
          <p className="text-gray-400 mt-1">Tu tutor académico inteligente</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Crear cuenta</h2>
          <p className="text-xs text-gray-400 mb-6">
            Solo para correos <strong>@colegiomontano.edu.gt</strong> y <strong>@escolaris.edu.gt</strong>
          </p>

          {exito ? (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-4 rounded-xl text-sm text-center">
              <p className="font-semibold mb-1">✅ {exito}</p>
              <p className="text-xs text-green-600">Redirigiendo al login en unos segundos...</p>
            </div>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
                <input type="text" value={nombre} onChange={e => setNombre(e.target.value)}
                  placeholder="Juan García López" required className="input-base"/>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Correo institucional</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="juan@colegiomontano.edu.gt" required className="input-base"/>
                <p className="text-xs text-gray-400 mt-1">Debe ser tu correo del colegio</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Grado</label>
                <select value={grado} onChange={e => setGrado(e.target.value)} required className="input-base">
                  <option value="">Selecciona tu grado</option>
                  {GRADOS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">
                  {error}
                </div>
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

        <p className="text-center text-gray-600 text-xs mt-6">
          © {new Date().getFullYear()} Owlaris · Todos los derechos reservados
        </p>
      </div>
    </div>
  )
}
