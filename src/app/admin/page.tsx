import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
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

  if (!perfil || !['admin', 'superadmin'].includes(perfil.rol)) redirect('/login')

  const esSuperAdmin = perfil.rol === 'superadmin'

  let qAlumnos   = supabase.from('usuarios').select('*', { count: 'exact', head: true }).eq('rol', 'alumno')
  let qPreguntas = supabase.from('interacciones').select('*', { count: 'exact', head: true })
  let qAlertas   = supabase.from('alertas').select('*', { count: 'exact', head: true }).eq('resuelta', false)

  if (!esSuperAdmin && perfil.colegio_id) {
    qAlumnos   = qAlumnos.eq('colegio_id', perfil.colegio_id)
    qPreguntas = qPreguntas.eq('colegio_id', perfil.colegio_id)
    qAlertas   = qAlertas.eq('colegio_id', perfil.colegio_id)
  }

  const [{ count: totalAlumnos }, { count: totalPreguntas }, { count: totalAlertas }] =
    await Promise.all([qAlumnos, qPreguntas, qAlertas])

  const menus = [
    { href: '/admin/usuarios', icon: '👥', titulo: 'Usuarios y Guías', desc: 'Crear, importar, asignar guías' },
    { href: '/admin/configuracion', icon: '⚙️', titulo: 'Configuración', desc: 'Límites, prompt, mantenimiento' },
    { href: '/guia', icon: '🎓', titulo: 'Panel del Guía', desc: 'Alertas y seguimiento de alumnos' },
  ]

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
            { href: '/admin', label: '🏠 Inicio', active: true },
            { href: '/admin/usuarios', label: '👥 Usuarios y Guías' },
            { href: '/guia', label: '🎓 Panel del Guía' },
            { href: '/docente', label: '📊 Dashboard Docente' },
          ].map(item => (
            <a key={item.href} href={item.href} style={{display:'block',padding:'10px 12px',borderRadius:'8px',color: item.active ? 'white' : 'rgba(255,255,255,.6)',background: item.active ? 'rgba(255,255,255,.15)' : 'transparent',textDecoration:'none',fontSize:'13px',fontWeight: item.active ? 600 : 400,marginBottom:'2px',transition:'all .15s'}}>
              {item.label}
            </a>
          ))}
        </nav>
        <div style={{padding:'16px 20px',borderTop:'1px solid rgba(255,255,255,.1)'}}>
          <a href="/admin/configuracion" style={{display:'block',padding:'10px 12px',borderRadius:'8px',color:'rgba(255,255,255,.6)',textDecoration:'none',fontSize:'13px',marginBottom:'8px',transition:'all .15s'}}>⚙️ Configuración</a>
          <p style={{color:'rgba(255,255,255,.6)',fontSize:'12px',margin:'0 0 4px'}}>{perfil.nombre_completo}</p>
          <p style={{color:'rgba(255,255,255,.4)',fontSize:'11px',margin:'0 0 12px'}}>{esSuperAdmin ? 'Super Admin' : perfil.colegio?.nombre}</p>
          <LogoutButton/>
        </div>
      </aside>

      {/* Main */}
      <main style={{flex:1,padding:'32px'}}>
        <h1 style={{fontSize:'24px',fontWeight:700,color:'#1A2744',marginBottom:'8px'}}>Bienvenido, {perfil.nombre_completo.split(' ')[0]}</h1>
        <p style={{color:'#64748B',marginBottom:'32px',fontSize:'14px'}}>{esSuperAdmin ? 'Todos los colegios' : perfil.colegio?.nombre}</p>

        {/* Métricas */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'16px',marginBottom:'32px'}}>
          {[
            { label: 'Alumnos registrados', value: totalAlumnos ?? 0, color: '#2C3E6B', icon: '👥' },
            { label: 'Consultas totales', value: totalPreguntas ?? 0, color: '#0D9488', icon: '💬' },
            { label: 'Alertas activas', value: totalAlertas ?? 0, color: totalAlertas ? '#DC2626' : '#10B981', icon: '🔔' },
          ].map((m, i) => (
            <div key={i} style={{background:'white',borderRadius:'16px',padding:'24px',border:'1px solid rgba(44,62,107,.08)',boxShadow:'0 2px 12px rgba(44,62,107,.06)'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'12px'}}>
                <span style={{fontSize:'24px'}}>{m.icon}</span>
              </div>
              <p style={{fontSize:'32px',fontWeight:700,color:m.color,margin:'0 0 4px'}}>{m.value}</p>
              <p style={{fontSize:'13px',color:'#94A3B8',margin:0}}>{m.label}</p>
            </div>
          ))}
        </div>

        {/* Módulos */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:'16px'}}>
          {menus.map((m, i) => (
            <a key={i} href={m.href} style={{background:'white',borderRadius:'16px',padding:'24px',border:'1px solid rgba(44,62,107,.08)',boxShadow:'0 2px 12px rgba(44,62,107,.06)',textDecoration:'none',transition:'all .2s',display:'block'}}>
              <span style={{fontSize:'28px',display:'block',marginBottom:'12px'}}>{m.icon}</span>
              <h3 style={{color:'#1A2744',fontWeight:600,margin:'0 0 6px',fontSize:'15px'}}>{m.titulo}</h3>
              <p style={{color:'#94A3B8',fontSize:'13px',margin:0}}>{m.desc}</p>
            </a>
          ))}
        </div>
      </main>
    </div>
  )
}
