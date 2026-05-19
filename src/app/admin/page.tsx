import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LogoutButton from '@/components/ui/LogoutButton'
import Link from 'next/link'

export default async function AdminPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('usuarios')
    .select('*, colegio:colegios(*)')
    .eq('id', user.id)
    .single()

  if (!perfil || !['admin', 'superadmin'].includes(perfil.rol)) redirect('/login')

  const esSuperAdmin = perfil.rol === 'superadmin'

  let qAlumnos    = supabase.from('usuarios').select('*', { count: 'exact', head: true }).eq('rol', 'alumno')
  let qPreguntas  = supabase.from('interacciones').select('*', { count: 'exact', head: true })
  let qPendientes = supabase.from('pendientes').select('*', { count: 'exact', head: true }).eq('resuelto', false)

  if (!esSuperAdmin && perfil.colegio_id) {
    qAlumnos    = qAlumnos.eq('colegio_id', perfil.colegio_id)
    qPreguntas  = qPreguntas.eq('colegio_id', perfil.colegio_id)
    qPendientes = qPendientes.eq('colegio_id', perfil.colegio_id)
  }

  const [
    { count: totalAlumnos },
    { count: totalPreguntas },
    { count: pendientesCount },
  ] = await Promise.all([qAlumnos, qPreguntas, qPendientes])

  const menus = [
    { href: '/admin/usuarios',      icon: '👥', titulo: 'Usuarios',         desc: 'Crear, importar, gestionar alumnos' },
    { href: '/admin/pendientes',    icon: '📋', titulo: 'Temas pendientes', desc: 'Lo que piden sin contenido en SharePoint' },
    { href: '/admin/configuracion', icon: '⚙️', titulo: 'Configuración',    desc: 'Prompt, límites, mantenimiento, sync' },
  ]

  return (
    <div className="min-h-screen bg-owlaris-dark text-white">
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/buho.png" alt="Owlaris" className="w-8 h-8 object-contain"/>
            <div>
              <h1 className="font-bold">Owlaris Admin</h1>
              <p className="text-xs text-gray-400">
                {esSuperAdmin ? 'Super Admin — Todos los colegios' : perfil.colegio?.nombre}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400 hidden sm:block">{perfil.nombre_completo}</span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">

        {/* Métricas rápidas */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white/5 rounded-xl p-5 border border-white/10 text-center">
            <p className="text-xs text-gray-400 mb-1">Alumnos registrados</p>
            <p className="text-3xl font-bold text-purple-400">{totalAlumnos ?? 0}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-5 border border-white/10 text-center">
            <p className="text-xs text-gray-400 mb-1">Preguntas totales</p>
            <p className="text-3xl font-bold text-blue-400">{totalPreguntas ?? 0}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-5 border border-white/10 text-center">
            <p className="text-xs text-gray-400 mb-1">Temas sin contenido</p>
            <p className={`text-3xl font-bold ${(pendientesCount ?? 0) > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
              {pendientesCount ?? 0}
            </p>
          </div>
        </div>

        {/* 3 módulos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {menus.map((m, i) => (
            <Link key={i} href={m.href}
              className="bg-white/5 hover:bg-white/10 rounded-2xl p-6 border border-white/10
                         transition-all duration-200 flex flex-col gap-3 group">
              <span className="text-3xl">{m.icon}</span>
              <div>
                <h3 className="font-semibold group-hover:text-owlaris-secondary transition-colors">{m.titulo}</h3>
                <p className="text-sm text-gray-400">{m.desc}</p>
              </div>
              <span className="text-gray-600 group-hover:text-white transition-colors text-sm">Entrar →</span>
            </Link>
          ))}
        </div>

        {/* Estado */}
        <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
          <h2 className="font-semibold mb-4">Estado del sistema</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {['Base de datos', 'Login activo', 'IA conectada', 'SharePoint', 'owlaris.app', 'Email Resend'].map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full flex-shrink-0 bg-green-400"/>
                <span className="text-sm text-white">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
