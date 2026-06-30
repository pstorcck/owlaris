import { createAdminClient, createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import LogoutButton from '@/components/ui/LogoutButton'

export default async function PendientesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('usuarios').select('*, colegio:colegios(*)')
    .eq('id', user.id).single()

  if (!perfil || !['admin', 'superadmin'].includes(perfil.rol)) redirect('/login')

  const esSuperAdmin = perfil.rol === 'superadmin'

  let query = supabase
    .from('pendientes')
    .select('*, colegio:colegios(nombre)')
    .eq('resuelto', false)
    .order('veces_solicitado', { ascending: false })

  if (!esSuperAdmin && perfil.colegio_id) {
    query = query.eq('colegio_id', perfil.colegio_id)
  }

  const { data: pendientes } = await query

  async function marcarResuelto(id: string) {
    'use server'
    const supabase = createClient()
    const admin = createAdminClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: perfilAccion } = await supabase
      .from('usuarios')
      .select('rol, colegio_id')
      .eq('id', user.id)
      .single()
    if (!perfilAccion || !['admin', 'superadmin'].includes(perfilAccion.rol)) redirect('/login')

    const { data: pendiente } = await admin
      .from('pendientes')
      .select('colegio_id')
      .eq('id', id)
      .single()
    if (!pendiente) redirect('/admin/pendientes')
    if (perfilAccion.rol !== 'superadmin' && pendiente.colegio_id !== perfilAccion.colegio_id) {
      redirect('/admin/pendientes')
    }

    await admin.from('pendientes').update({ resuelto: true }).eq('id', id)
    redirect('/admin/pendientes')
  }

  return (
    <div className="min-h-screen bg-owlaris-dark text-white">
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-gray-400 hover:text-white">← Admin</Link>
            <h1 className="font-bold text-lg">📋 Temas pendientes</h1>
            <span className="text-gray-500 text-sm">{pendientes?.length || 0} temas</span>
          </div>
          <LogoutButton />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6">
        {(!pendientes || pendientes.length === 0) ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">✅</p>
            <p className="text-xl font-semibold text-green-400">Todo el contenido está cubierto</p>
            <p className="text-gray-400 mt-2">Los alumnos no han preguntado temas sin contenido en SharePoint.</p>
          </div>
        ) : (
          <>
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3 mb-6">
              <p className="text-yellow-300 text-sm">
                Temas que los alumnos preguntaron sin contenido en SharePoint — ordenados por frecuencia.
                Cuando subas el documento, márcalo como resuelto.
              </p>
            </div>

            <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-white/5 border-b border-white/10">
                  <tr>
                    {['Tema solicitado', 'Materia', 'Grado', ...(esSuperAdmin ? ['Colegio'] : []), 'Frecuencia', 'Acción'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-gray-400 font-medium text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pendientes.map(p => (
                    <tr key={p.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 font-medium max-w-xs">
                        <p className="truncate">{p.tema_solicitado}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-400">{p.materia}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{p.grado}</td>
                      {esSuperAdmin && (
                        <td className="px-4 py-3 text-gray-500 text-xs">{(p.colegio as {nombre:string})?.nombre}</td>
                      )}
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold
                          ${p.veces_solicitado >= 5 ? 'bg-red-500/20 text-red-300' :
                            p.veces_solicitado >= 3 ? 'bg-yellow-500/20 text-yellow-300' :
                            'bg-white/10 text-gray-400'}`}>
                          {p.veces_solicitado}x
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <form action={marcarResuelto.bind(null, p.id)}>
                          <button type="submit"
                            className="text-xs px-3 py-1 bg-green-500/20 text-green-300 rounded-lg hover:bg-green-500/30 transition-colors">
                            ✓ Resuelto
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
