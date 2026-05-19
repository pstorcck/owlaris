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

  // Superadmin ve todos los colegios, admin solo el suyo
  const esSuperAdmin = perfil.rol === 'superadmin'

  // Métricas del colegio
  let queryUsuarios = supabase.from('usuarios').select('*', { count: 'exact', head: true }).eq('rol', 'alumno')
  let queryPreguntas = supabase.from('interacciones').select('*', { count: 'exact', head: true })
  let queryPendientes = supabase.from('pendientes').select('*', { count: 'exact', head: true }).eq('resuelto', false)

  if (!esSuperAdmin) {
    queryUsuarios  = queryUsuarios.eq('colegio_id', perfil.colegio_id)
    queryPreguntas = queryPreguntas.eq('colegio_id', perfil.colegio_id)
    queryPendientes = queryPendientes.eq('colegio_id', perfil.colegio_id)
  }

  const { count: totalAlumnos }   = await queryUsuarios
  const { count: totalPreguntas } = await queryPreguntas
  const { count: pendientesCount } = await queryPendientes

  const menus = [
    { href: '/admin/usuarios',      icon: '👥', titulo: 'Usuarios',           desc: 'Crear, importar, gestionar alumnos' },
    { href: '/admin/metricas',      icon: '📈', titulo: 'Métricas',           desc: 'Uso y actividad' },
    { href: '/admin/chats',         icon: '💬', titulo: 'Historial de chats', desc: 'Ver conversaciones' },
    { href: '/admin/configuracion', icon: '⚙️', titulo: 'Configuración',      desc: 'Prompt, límites, mantenimiento' },
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

        {/* Métricas — sin costos */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white/5 rounded-xl p-5 border border-white/10 text-center">
            <p className="text-xs text-gray-400 mb-1">Alumnos</p>
            <p className="text-3xl font-bold text-purple-400">{totalAlumnos || 0}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-5 border border-white/10 text-center">
            <p className="text-xs text-gray-400 mb-1">Preguntas totales</p>
            <p className="text-3xl font-bold text-blue-400">{totalPreguntas || 0}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-5 border border-white/10 text-center">
            <p className="text-xs text-gray-400 mb-1">Temas pendientes</p>
            <p className="text-3xl font-bold text-yellow-400">{pendientesCount || 0}</p>
          </div>
        </div>

        {/* Menú */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {menus.map((m, i) => (
            <Link key={i} href={m.href}
              className="bg-white/5 hover:bg-white/10 rounded-2xl p-6 border border-white/10
                         transition-all duration-200 flex items-center gap-4 group">
              <span className="text-3xl">{m.icon}</span>
              <div>
                <h3 className="font-semibold group-hover:text-owlaris-secondary transition-colors">{m.titulo}</h3>
                <p className="text-sm text-gray-400">{m.desc}</p>
              </div>
              <span className="ml-auto text-gray-600 group-hover:text-white transition-colors">→</span>
            </Link>
          ))}
        </div>

        {/* Estado */}
        <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
          <h2 className="font-semibold mb-4">Estado del sistema</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { ok: true,  texto: 'Base de datos' },
              { ok: true,  texto: 'Login activo' },
              { ok: true,  texto: 'IA conectada' },
              { ok: true,  texto: 'SharePoint' },
              { ok: true,  texto: 'owlaris.app' },
              { ok: true,  texto: 'Email Resend' },
              { ok: false, texto: 'Panel maestro' },
              { ok: false, texto: 'Dashboard financiero' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.ok ? 'bg-green-400' : 'bg-gray-600'}`}/>
                <span className={`text-sm ${item.ok ? 'text-white' : 'text-gray-500'}`}>{item.texto}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
