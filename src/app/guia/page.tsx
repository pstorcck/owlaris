import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LogoutButton from '@/components/ui/LogoutButton'

export default async function GuiaPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('usuarios').select('*, colegio:colegios(*)').eq('id', user.id).single()

  if (!perfil || !['maestro', 'admin', 'superadmin'].includes(perfil.rol)) redirect('/chat')

  // Asignaciones del guía
  const { data: asignaciones } = await supabase
    .from('guia_asignaciones')
    .select('id, tipo, grado, alumno_id, alumno:alumno_id(id, nombre_completo, grado, ultimo_acceso, email)')
    .eq('guia_id', user.id)
    .eq('activo', true)

  // Construir lista de alumnos — individuales + por grado
  const alumnosIds = new Set<string>()
  const alumnosList: {id:string; nombre_completo:string; grado:string; ultimo_acceso:string|null; email:string}[] = []

  for (const a of asignaciones || []) {
    if (a.tipo === 'alumno' && a.alumno) {
      const al = a.alumno as unknown as {id:string; nombre_completo:string; grado:string; ultimo_acceso:string|null; email:string}
      if (!alumnosIds.has(al.id)) { alumnosIds.add(al.id); alumnosList.push(al) }
    } else if (a.tipo === 'grado' && a.grado) {
      // Buscar todos los alumnos de ese grado en el mismo colegio
      const { data: alumnosGrado } = await supabase
        .from('usuarios')
        .select('id, nombre_completo, grado, ultimo_acceso, email')
        .eq('colegio_id', perfil.colegio_id)
        .eq('grado', a.grado)
        .eq('rol', 'alumno')
        .eq('activo', true)
      for (const al of alumnosGrado || []) {
        if (!alumnosIds.has(al.id)) { alumnosIds.add(al.id); alumnosList.push(al as typeof alumnosList[0]) }
      }
    }
  }

  // Alertas sin resolver de los alumnos asignados
  const { data: alertas } = alumnosList.length > 0 ? await supabase
    .from('alertas')
    .select('*, alumno:alumno_id(nombre_completo, grado)')
    .in('alumno_id', alumnosList.map(a => a.id))
    .eq('resuelta', false)
    .order('creado_en', { ascending: false }) : { data: [] }

  // Últimas interacciones por alumno
  const interaccionesPorAlumno: Record<string, number> = {}
  if (alumnosList.length > 0) {
    const { data: ints } = await supabase
      .from('interacciones')
      .select('usuario_id')
      .in('usuario_id', alumnosList.map(a => a.id))
    for (const i of ints || []) {
      interaccionesPorAlumno[i.usuario_id] = (interaccionesPorAlumno[i.usuario_id] || 0) + 1
    }
  }

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

  return (
    <div style={{minHeight:'100vh',background:'#F5F7FA',fontFamily:'system-ui,-apple-system,sans-serif',display:'flex'}}>
      {/* Sidebar */}
      <aside style={{width:'240px',background:'#2C3E6B',minHeight:'100vh',display:'flex',flexDirection:'column',flexShrink:0}}>
        <div style={{padding:'24px 20px',borderBottom:'1px solid rgba(255,255,255,.1)'}}>
          <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'4px'}}>
            <img src="/buho.png" alt="Owlaris" style={{width:'32px',height:'32px',objectFit:'contain'}}/>
            <span style={{color:'white',fontWeight:700,fontSize:'16px'}}>Owlaris</span>
          </div>
          <p style={{color:'rgba(255,255,255,.5)',fontSize:'11px',margin:0}}>Panel del Guía</p>
        </div>
        <nav style={{padding:'16px 12px',flex:1}}>
          {[
            { href: '/guia', label: '🏠 Mi panel', active: true },
            { href: '/chat', label: '🦉 Ir al chat' },
          ].map(item => (
            <a key={item.href} href={item.href} style={{display:'block',padding:'10px 12px',borderRadius:'8px',color:item.active?'white':'rgba(255,255,255,.6)',background:item.active?'rgba(255,255,255,.15)':'transparent',textDecoration:'none',fontSize:'13px',fontWeight:item.active?600:400,marginBottom:'2px'}}>
              {item.label}
            </a>
          ))}
        </nav>
        <div style={{padding:'16px 20px',borderTop:'1px solid rgba(255,255,255,.1)'}}>
          <p style={{color:'rgba(255,255,255,.7)',fontSize:'13px',margin:'0 0 2px',fontWeight:500}}>{perfil.nombre_completo}</p>
          <p style={{color:'rgba(255,255,255,.4)',fontSize:'11px',margin:'0 0 12px'}}>{(perfil.colegio as {nombre:string})?.nombre}</p>
          <LogoutButton/>
        </div>
      </aside>

      {/* Main */}
      <main style={{flex:1,padding:'32px',overflowY:'auto'}}>
        <div style={{marginBottom:'28px'}}>
          <h1 style={{fontSize:'22px',fontWeight:700,color:'#1A2744',margin:'0 0 4px'}}>Mi Panel de Guía</h1>
          <p style={{color:'#64748B',fontSize:'13px',margin:0}}>{alumnosList.length} alumnos asignados · {(alertas||[]).length} alertas activas</p>
        </div>

        {/* Métricas rápidas */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'16px',marginBottom:'28px'}}>
          {[
            { label: 'Alumnos asignados', value: alumnosList.length, color: '#2C3E6B' },
            { label: 'Alertas activas', value: (alertas||[]).length, color: (alertas||[]).length > 0 ? '#DC2626' : '#10B981' },
            { label: 'Total sesiones', value: Object.values(interaccionesPorAlumno).reduce((a,b)=>a+b,0), color: '#0D9488' },
          ].map((m,i) => (
            <div key={i} style={{background:'white',borderRadius:'12px',padding:'20px',border:'1px solid rgba(44,62,107,.08)',boxShadow:'0 2px 8px rgba(44,62,107,.06)'}}>
              <p style={{fontSize:'28px',fontWeight:700,color:m.color,margin:'0 0 4px'}}>{m.value}</p>
              <p style={{fontSize:'12px',color:'#94A3B8',margin:0}}>{m.label}</p>
            </div>
          ))}
        </div>

        {/* Alertas */}
        <section style={{marginBottom:'28px'}}>
          <h2 style={{fontSize:'16px',fontWeight:700,color:'#1A2744',marginBottom:'12px',display:'flex',alignItems:'center',gap:'8px'}}>
            Alertas activas
            {(alertas||[]).length > 0 && <span style={{background:'#DC2626',color:'white',borderRadius:'20px',padding:'2px 8px',fontSize:'11px',fontWeight:700}}>{(alertas||[]).length}</span>}
          </h2>
          {!(alertas||[]).length ? (
            <div style={{background:'white',borderRadius:'12px',padding:'24px',textAlign:'center',color:'#94A3B8',border:'1px solid rgba(44,62,107,.06)'}}>
              Sin alertas activas ✅
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
              {(alertas||[]).map((alerta:any) => (
                <div key={alerta.id} style={{background:'white',borderRadius:'12px',padding:'16px 20px',border:'1px solid rgba(44,62,107,.06)',boxShadow:'0 2px 8px rgba(44,62,107,.04)',display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'16px'}}>
                  <div>
                    <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'6px'}}>
                      <span style={{background:`${tipoColor[alerta.tipo]}15`,color:tipoColor[alerta.tipo],borderRadius:'6px',padding:'3px 10px',fontSize:'11px',fontWeight:600}}>
                        {tipoLabel[alerta.tipo]}
                      </span>
                      <span style={{fontSize:'11px',color:'#94A3B8'}}>{new Date(alerta.creado_en).toLocaleString('es-GT')}</span>
                    </div>
                    <p style={{fontWeight:600,color:'#1A2744',margin:'0 0 4px',fontSize:'14px'}}>
                      {(alerta.alumno as any)?.nombre_completo} — {(alerta.alumno as any)?.grado}
                    </p>
                    <p style={{color:'#64748B',fontSize:'13px',margin:'0 0 4px'}}>{alerta.descripcion}</p>
                    {alerta.contexto && <p style={{color:'#94A3B8',fontSize:'12px',margin:0,fontStyle:'italic'}}>"{alerta.contexto}"</p>}
                  </div>
                  <form action={async () => {
                    'use server'
                    const sb = createClient()
                    await sb.from('alertas').update({ resuelta: true, resuelta_en: new Date().toISOString() }).eq('id', alerta.id)
                  }}>
                    <button type="submit" style={{background:'#10B981',color:'white',border:'none',borderRadius:'8px',padding:'8px 14px',fontSize:'12px',fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>
                      ✓ Resuelta
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Mis alumnos */}
        <section>
          <h2 style={{fontSize:'16px',fontWeight:700,color:'#1A2744',marginBottom:'12px'}}>Mis alumnos</h2>
          {alumnosList.length === 0 ? (
            <div style={{background:'white',borderRadius:'12px',padding:'24px',textAlign:'center',color:'#94A3B8',border:'1px solid rgba(44,62,107,.06)'}}>
              No tienes alumnos asignados aún. Contacta al administrador.
            </div>
          ) : (
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:'12px'}}>
              {alumnosList.map(al => (
                <div key={al.id} style={{background:'white',borderRadius:'12px',padding:'16px 20px',border:'1px solid rgba(44,62,107,.06)',boxShadow:'0 2px 8px rgba(44,62,107,.04)'}}>
                  <p style={{fontWeight:600,color:'#1A2744',margin:'0 0 4px',fontSize:'14px'}}>{al.nombre_completo}</p>
                  <p style={{color:'#5B8DB8',fontSize:'12px',margin:'0 0 8px'}}>{al.grado}</p>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span style={{fontSize:'11px',color:'#94A3B8'}}>
                      {al.ultimo_acceso ? `Último acceso: ${new Date(al.ultimo_acceso).toLocaleDateString('es-GT')}` : 'Sin acceso aún'}
                    </span>
                    <span style={{fontSize:'11px',color:'#2C3E6B',fontWeight:600}}>
                      {interaccionesPorAlumno[al.id] || 0} sesiones
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
