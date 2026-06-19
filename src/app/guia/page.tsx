import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function GuiaPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('usuarios').select('*, colegio:colegios(*)').eq('id', user.id).single()

  if (!perfil || !['maestro', 'admin', 'superadmin'].includes(perfil.rol)) redirect('/chat')

  const colegioNombre = (perfil.colegio as {nombre:string})?.nombre || ''

  // Asignaciones del guía
  const { data: asignaciones } = await supabase
    .from('guia_asignaciones')
    .select('id, tipo, grado, alumno_id, colegio_id, alumno:alumno_id(id, nombre_completo, grado, ultimo_acceso, email)')
    .eq('guia_id', user.id)
    .eq('activo', true)

  // Construir lista de alumnos respetando colegio
  const alumnosIds = new Set<string>()
  const alumnosList: {id:string; nombre_completo:string; grado:string; ultimo_acceso:string|null; email:string}[] = []

  for (const a of asignaciones || []) {
    if (a.tipo === 'alumno' && a.alumno) {
      const al = a.alumno as unknown as {id:string; nombre_completo:string; grado:string; ultimo_acceso:string|null; email:string}
      if (!alumnosIds.has(al.id)) { alumnosIds.add(al.id); alumnosList.push(al) }
    } else if (a.tipo === 'grado' && a.grado && a.colegio_id) {
      const { data: alumnosGrado } = await supabase
        .from('usuarios')
        .select('id, nombre_completo, grado, ultimo_acceso, email')
        .eq('colegio_id', a.colegio_id)
        .eq('grado', a.grado)
        .eq('rol', 'alumno')
        .eq('activo', true)
        .order('nombre_completo')
      for (const al of alumnosGrado || []) {
        if (!alumnosIds.has(al.id)) {
          alumnosIds.add(al.id)
          alumnosList.push(al as {id:string; nombre_completo:string; grado:string; ultimo_acceso:string|null; email:string})
        }
      }
    }
  }

  // Alertas de sus alumnos
  const { data: alertas } = alumnosList.length > 0 ? await supabase
    .from('alertas')
    .select('*, alumno:alumno_id(nombre_completo, grado)')
    .in('alumno_id', alumnosList.map(a => a.id))
    .eq('resuelta', false)
    .order('creado_en', { ascending: false })
    .limit(20) : { data: [] }

  // Interacciones por alumno
  const interaccionesPorAlumno: Record<string, number> = {}
  if (alumnosList.length > 0) {
    const { data: ints } = await supabase
      .from('interacciones').select('usuario_id')
      .in('usuario_id', alumnosList.map(a => a.id))
    for (const i of ints || []) {
      interaccionesPorAlumno[i.usuario_id] = (interaccionesPorAlumno[i.usuario_id] || 0) + 1
    }
  }

  // Actividad última semana
  const hace7dias = new Date(Date.now() - 7*24*3600000).toISOString()
  const { data: actividadSemana } = alumnosList.length > 0 ? await supabase
    .from('interacciones').select('usuario_id, creado_en')
    .in('usuario_id', alumnosList.map(a => a.id))
    .gte('creado_en', hace7dias) : { data: [] }

  const alumnosActivosHoy = alumnosList.filter(a => {
    if (!a.ultimo_acceso) return false
    const hoy = new Date().toDateString()
    return new Date(a.ultimo_acceso).toDateString() === hoy
  }).length

  const tipoLabel: Record<string,string> = {
    baja_comprension: '⚠️ Baja comprensión',
    bloqueo_recurrente: '🔄 Bloqueo recurrente',
    riesgo_copia: '🚨 Riesgo de copia',
  }
  const tipoColor: Record<string,string> = {
    baja_comprension: '#D97706',
    bloqueo_recurrente: '#2563EB',
    riesgo_copia: '#DC2626',
  }
  const tipoBg: Record<string,string> = {
    baja_comprension: '#FFFBEB',
    bloqueo_recurrente: '#EFF6FF',
    riesgo_copia: '#FEF2F2',
  }

  return (
    <div style={{minHeight:'100vh',background:'#F5F7FA',fontFamily:'system-ui,-apple-system,sans-serif',display:'flex'}}>
      
      {/* Sidebar */}
      <aside style={{width:'256px',background:'linear-gradient(180deg,#1E3A5F 0%,#2C3E6B 100%)',minHeight:'100vh',display:'flex',flexDirection:'column',flexShrink:0,boxShadow:'4px 0 24px rgba(30,58,95,.15)'}}>
        <div style={{padding:'28px 24px 20px',borderBottom:'1px solid rgba(255,255,255,.08)'}}>
          <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'8px'}}>
            <div style={{width:'40px',height:'40px',background:'rgba(255,255,255,.12)',borderRadius:'12px',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <img src="/buho.png" alt="Owlaris" style={{width:'28px',height:'28px',objectFit:'contain'}}/>
            </div>
            <div>
              <p style={{color:'white',fontWeight:700,fontSize:'15px',margin:0}}>Owlaris</p>
              <p style={{color:'rgba(255,255,255,.4)',fontSize:'10px',margin:0,letterSpacing:'.5px',textTransform:'uppercase'}}>Panel del Guía</p>
            </div>
          </div>
        </div>

        <nav style={{padding:'16px 12px',flex:1}}>
          <p style={{color:'rgba(255,255,255,.3)',fontSize:'10px',fontWeight:600,letterSpacing:'1px',textTransform:'uppercase',padding:'8px 12px 6px',margin:0}}>Navegación</p>
          {[
            { href: '/guia', label: 'Panel principal', icon: '🏠', active: true },
            { href: '/chat', label: 'Ir al chat', icon: '🦉' },
          ].map(item => (
            <a key={item.href} href={item.href} style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 12px',borderRadius:'10px',color:item.active?'white':'rgba(255,255,255,.55)',background:item.active?'rgba(255,255,255,.12)':'transparent',textDecoration:'none',fontSize:'13px',fontWeight:item.active?600:400,marginBottom:'2px',transition:'all .15s'}}>
              <span style={{fontSize:'15px'}}>{item.icon}</span>
              {item.label}
            </a>
          ))}
        </nav>

        <div style={{padding:'20px 24px',borderTop:'1px solid rgba(255,255,255,.08)'}}>
          <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'14px'}}>
            <div style={{width:'34px',height:'34px',background:'rgba(255,255,255,.15)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:700,fontSize:'13px',flexShrink:0}}>
              {perfil.nombre_completo.charAt(0)}
            </div>
            <div style={{overflow:'hidden'}}>
              <p style={{color:'white',fontSize:'13px',fontWeight:600,margin:0,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{perfil.nombre_completo}</p>
              <p style={{color:'rgba(255,255,255,.4)',fontSize:'11px',margin:0}}>{colegioNombre}</p>
            </div>
          </div>
          <form action={async () => {
            'use server'
            const { createClient: cc } = await import('@/lib/supabase/server')
            await cc().auth.signOut()
            const { redirect: rd } = await import('next/navigation')
            rd('/login')
          }}>
            <button type="submit" style={{width:'100%',background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.12)',borderRadius:'8px',padding:'9px',color:'rgba(255,255,255,.7)',fontSize:'12px',cursor:'pointer',fontFamily:'system-ui',fontWeight:500,transition:'all .15s'}}>
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      {/* Main */}
      <main style={{flex:1,padding:'36px',overflowY:'auto',maxWidth:'1100px'}}>
        
        {/* Header */}
        <div style={{marginBottom:'32px'}}>
          <h1 style={{fontSize:'24px',fontWeight:700,color:'#0F1C2E',margin:'0 0 6px',letterSpacing:'-.3px'}}>
            Bienvenido, {perfil.nombre_completo.split(' ')[0]} 👋
          </h1>
          <p style={{color:'#64748B',fontSize:'14px',margin:0}}>{colegioNombre} · {new Date().toLocaleDateString('es-GT', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</p>
        </div>

        {/* Métricas */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'16px',marginBottom:'32px'}}>
          {[
            { label: 'Alumnos asignados', value: alumnosList.length, icon: '👥', color: '#2C3E6B', bg: '#EEF2FF' },
            { label: 'Activos hoy', value: alumnosActivosHoy, icon: '✅', color: '#059669', bg: '#ECFDF5' },
            { label: 'Sesiones esta semana', value: actividadSemana?.length || 0, icon: '📚', color: '#0D9488', bg: '#F0FDFA' },
            { label: 'Alertas activas', value: (alertas||[]).length, icon: '🔔', color: (alertas||[]).length > 0 ? '#DC2626' : '#059669', bg: (alertas||[]).length > 0 ? '#FEF2F2' : '#ECFDF5' },
          ].map((m, i) => (
            <div key={i} style={{background:'white',borderRadius:'16px',padding:'20px 24px',border:'1px solid rgba(15,28,46,.06)',boxShadow:'0 2px 12px rgba(15,28,46,.05)'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'12px'}}>
                <div style={{width:'36px',height:'36px',background:m.bg,borderRadius:'10px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px'}}>
                  {m.icon}
                </div>
              </div>
              <p style={{fontSize:'28px',fontWeight:700,color:m.color,margin:'0 0 4px',lineHeight:1}}>{m.value}</p>
              <p style={{fontSize:'12px',color:'#94A3B8',margin:0,fontWeight:500}}>{m.label}</p>
            </div>
          ))}
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'24px',marginBottom:'28px'}}>
          
          {/* Alertas */}
          <div style={{background:'white',borderRadius:'16px',border:'1px solid rgba(15,28,46,.06)',boxShadow:'0 2px 12px rgba(15,28,46,.05)',overflow:'hidden'}}>
            <div style={{padding:'20px 24px',borderBottom:'1px solid #F1F5F9',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <h2 style={{fontSize:'15px',fontWeight:700,color:'#0F1C2E',margin:0}}>Alertas activas</h2>
              {(alertas||[]).length > 0 && (
                <span style={{background:'#FEE2E2',color:'#DC2626',borderRadius:'20px',padding:'3px 10px',fontSize:'11px',fontWeight:700}}>
                  {(alertas||[]).length} pendientes
                </span>
              )}
            </div>
            <div style={{padding:'16px',maxHeight:'320px',overflowY:'auto'}}>
              {!(alertas||[]).length ? (
                <div style={{textAlign:'center',padding:'32px 16px',color:'#94A3B8'}}>
                  <p style={{fontSize:'24px',margin:'0 0 8px'}}>✅</p>
                  <p style={{fontSize:'13px',margin:0}}>Sin alertas activas</p>
                </div>
              ) : (alertas||[]).map((alerta:any) => (
                <div key={alerta.id} style={{background:tipoBg[alerta.tipo]||'#F8FAFC',borderRadius:'12px',padding:'14px 16px',marginBottom:'10px',border:`1px solid ${tipoColor[alerta.tipo]}20`}}>
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'8px'}}>
                    <div style={{flex:1}}>
                      <span style={{background:`${tipoColor[alerta.tipo]}18`,color:tipoColor[alerta.tipo],borderRadius:'6px',padding:'2px 8px',fontSize:'10px',fontWeight:700,display:'inline-block',marginBottom:'6px'}}>
                        {tipoLabel[alerta.tipo]}
                      </span>
                      <p style={{fontWeight:600,color:'#0F1C2E',margin:'0 0 3px',fontSize:'13px'}}>
                        {(alerta.alumno as any)?.nombre_completo}
                      </p>
                      <p style={{color:'#64748B',fontSize:'12px',margin:'0 0 3px'}}>{alerta.descripcion}</p>
                      <p style={{color:'#94A3B8',fontSize:'11px',margin:0}}>{new Date(alerta.creado_en).toLocaleString('es-GT')}</p>
                    </div>
                    <form action={async () => {
                      'use server'
                      const { createClient: cc } = await import('@/lib/supabase/server')
                      await cc().from('alertas').update({ resuelta: true, resuelta_en: new Date().toISOString() }).eq('id', alerta.id)
                    }}>
                      <button type="submit" style={{background:'#059669',color:'white',border:'none',borderRadius:'8px',padding:'6px 12px',fontSize:'11px',fontWeight:600,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0}}>
                        ✓ Resuelta
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actividad reciente */}
          <div style={{background:'white',borderRadius:'16px',border:'1px solid rgba(15,28,46,.06)',boxShadow:'0 2px 12px rgba(15,28,46,.05)',overflow:'hidden'}}>
            <div style={{padding:'20px 24px',borderBottom:'1px solid #F1F5F9'}}>
              <h2 style={{fontSize:'15px',fontWeight:700,color:'#0F1C2E',margin:0}}>Alumnos más activos</h2>
            </div>
            <div style={{padding:'16px'}}>
              {alumnosList.length === 0 ? (
                <div style={{textAlign:'center',padding:'32px 16px',color:'#94A3B8'}}>
                  <p style={{fontSize:'13px',margin:0}}>Sin alumnos asignados</p>
                </div>
              ) : [...alumnosList].sort((a,b) => (interaccionesPorAlumno[b.id]||0) - (interaccionesPorAlumno[a.id]||0)).slice(0,6).map((al, i) => (
                <div key={al.id} style={{display:'flex',alignItems:'center',gap:'12px',padding:'10px 12px',borderRadius:'10px',marginBottom:'4px',background:i===0?'#F0FDF4':'transparent'}}>
                  <div style={{width:'32px',height:'32px',background:i===0?'#DCFCE7':'#F1F5F9',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:'12px',color:i===0?'#059669':'#64748B',flexShrink:0}}>
                    {i+1}
                  </div>
                  <div style={{flex:1,overflow:'hidden'}}>
                    <p style={{fontWeight:500,color:'#0F1C2E',margin:'0 0 1px',fontSize:'13px',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{al.nombre_completo}</p>
                    <p style={{color:'#94A3B8',fontSize:'11px',margin:0}}>{al.grado}</p>
                  </div>
                  <span style={{fontSize:'12px',fontWeight:600,color:'#2C3E6B',background:'#EEF2FF',borderRadius:'6px',padding:'3px 8px'}}>
                    {interaccionesPorAlumno[al.id]||0} sesiones
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Lista de alumnos */}
        <div style={{background:'white',borderRadius:'16px',border:'1px solid rgba(15,28,46,.06)',boxShadow:'0 2px 12px rgba(15,28,46,.05)',overflow:'hidden'}}>
          <div style={{padding:'20px 24px',borderBottom:'1px solid #F1F5F9',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <h2 style={{fontSize:'15px',fontWeight:700,color:'#0F1C2E',margin:0}}>Mis alumnos</h2>
            <span style={{color:'#94A3B8',fontSize:'12px'}}>{alumnosList.length} alumnos</span>
          </div>
          {alumnosList.length === 0 ? (
            <div style={{textAlign:'center',padding:'48px',color:'#94A3B8'}}>
              <p style={{fontSize:'32px',margin:'0 0 12px'}}>🎓</p>
              <p style={{fontSize:'14px',fontWeight:500,margin:'0 0 4px',color:'#475569'}}>Sin alumnos asignados</p>
              <p style={{fontSize:'13px',margin:0}}>Contacta al administrador para que te asigne alumnos</p>
            </div>
          ) : (
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:'13px'}}>
              <thead>
                <tr style={{borderBottom:'1px solid #F1F5F9'}}>
                  {['Alumno','Grado','Sesiones','Último acceso','Estado'].map(h => (
                    <th key={h} style={{textAlign:'left',padding:'12px 20px',color:'#64748B',fontWeight:600,fontSize:'11px',textTransform:'uppercase',letterSpacing:'.5px'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {alumnosList.map(al => {
                  const diasSinAcceso = al.ultimo_acceso ? Math.floor((Date.now() - new Date(al.ultimo_acceso).getTime()) / 86400000) : 999
                  const estado = diasSinAcceso === 0 ? { label: 'Activo hoy', color: '#059669', bg: '#ECFDF5' } :
                    diasSinAcceso <= 3 ? { label: 'Reciente', color: '#D97706', bg: '#FFFBEB' } :
                    { label: 'Inactivo', color: '#94A3B8', bg: '#F8FAFC' }
                  return (
                    <tr key={al.id} style={{borderBottom:'1px solid #F8FAFC'}}>
                      <td style={{padding:'14px 20px'}}>
                        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                          <div style={{width:'32px',height:'32px',background:'#EEF2FF',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:'11px',color:'#2C3E6B',flexShrink:0}}>
                            {al.nombre_completo.charAt(0)}
                          </div>
                          <span style={{fontWeight:500,color:'#0F1C2E'}}>{al.nombre_completo}</span>
                        </div>
                      </td>
                      <td style={{padding:'14px 20px',color:'#64748B'}}>{al.grado}</td>
                      <td style={{padding:'14px 20px'}}>
                        <span style={{fontWeight:600,color:'#2C3E6B'}}>{interaccionesPorAlumno[al.id]||0}</span>
                      </td>
                      <td style={{padding:'14px 20px',color:'#94A3B8',fontSize:'12px'}}>
                        {al.ultimo_acceso ? new Date(al.ultimo_acceso).toLocaleDateString('es-GT') : 'Nunca'}
                      </td>
                      <td style={{padding:'14px 20px'}}>
                        <span style={{background:estado.bg,color:estado.color,borderRadius:'6px',padding:'3px 10px',fontSize:'11px',fontWeight:600}}>
                          {estado.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}
