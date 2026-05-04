'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LogoutButton() {
  const supabase = createClient()
  const router = useRouter()

  async function cerrarSesion() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      onClick={cerrarSesion}
      className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white
                 px-4 py-2 rounded-xl border border-white/20 transition-all duration-200 text-sm"
    >
      <span>↩</span> Cerrar sesión
    </button>
  )
}
