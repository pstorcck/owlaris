import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LogoutButton from '@/components/ui/LogoutButton'

export default async function AdminPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('usuarios')
    .select('*, colegio:colegios(*)')
    .eq('id', user.id)
    .single()

  if (!perfil) redirect('/login')

  return (
    <div className="min-h-screen bg-owlaris-dark text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4">
            <span className="text-4xl">🦉</span>
            <div>
              <h1 className="text-2xl font-bold">Owlaris Admin</h1>
              <p className="text-gray-400">Bienvenido, {perfil.nombre_completo}</p>
            </div>
          </div>
          <LogoutButton />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-white/10 rounded-2xl p-6 border border-white/10">
            <p className="text-gray-400 text-sm mb-1">Colegio activo</p>
            <p className="text-xl font-bold">{perfil.colegio?.nombre || '—'}</p>
          </div>
          <div className="bg-white/10 rounded-2xl p-6 border border-white/10">
            <p className="text-gray-400 text-sm mb-1">Tu rol</p>
            <p className="text-xl font-bold capitalize">{perfil.rol}</p>
          </div>
          <div className="bg-white/10 rounded-2xl p-6 border border-white/10">
            <p className="text-gray-400 text-sm mb-1">Estado</p>
            <p className="text-xl font-bold text-green-400">✓ Activo</p>
          </div>
        </div>

        <div className="bg-white/5 rounded-2xl p-8 border border-white/10">
          <h2 className="text-lg font-semibold mb-6">Próximos pasos para completar el MVP</h2>
          <div className="space-y-4">
            {[
              { done: true,  texto: 'Proyecto creado en GitHub' },
              { done: true,  texto: 'Base de datos configurada en Supabase' },
              { done: true,  texto: 'Login funcionando' },
              { done: true,  texto: 'Chat del alumno con IA funcionando' },
              { done: false, texto: 'Conectar SharePoint via Azure AD' },
              { done: false, texto: 'Deploy en Vercel' },
              { done: false, texto: 'Panel del maestro' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                  ${item.done ? 'bg-green-500 text-white' : 'bg-white/10 text-gray-400'}`}>
                  {item.done ? '✓' : '○'}
                </span>
                <span className={item.done ? 'text-white' : 'text-gray-400'}>{item.texto}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
