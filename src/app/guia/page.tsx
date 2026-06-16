import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LogoutButton from '@/components/ui/LogoutButton'

export default async function GuiaPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('usuarios')
    .select('*, colegio:colegios(*)')
    .eq('id', user.id)
    .single()

  if (!perfil || !['maestro', 'admin', 'superadmin'].includes(perfil.rol)) redirect('/chat')

  // Alertas sin resolver
  const { data: alertas } = await supabase
    .from('alertas')
    .select('*, alumno:alumno_id(nombre_completo, email, grado)')
    .eq('colegio_id', perfil.colegio_id)
    .eq('resuelta', false)
    .order('creado_en', { ascending: false })
    .limit(50)

  // Alumnos asignados
  const { data: asignaciones } = await supabase
    .from('guia_asignaciones')
    .select('*, alumno:alumno_id(id, nombre_completo, grado, ultimo_acceso)')
    .eq('guia_id', user.id)
    .eq('activo', true)

  const tipoLabel: Record<string,string> = {
    baja_comprension: '⚠️ Baja comprensión',
    bloqueo_recurrente: '🔄 Bloqueo recurrente',
    riesgo_copia: '🚨 Riesgo de copia'
  }

  const tipoColor: Record<string,string> = {
    baja_comprension: '#D97706',
    bloqueo_recurrente: '#2563EB',
    riesgo_copia: '#DC2626'
  }

  return (
    <div style={{minHeight:'100vh',background:'#F8F7FF',fontFamily:'system-ui,sans-serif'}}>
      <header style={{background:'#7C3AED',padding:'16px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',boxShadow:'0 2px 20px rgba(124,58,237,.3)'}}>
        <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
          <img src="/buho.png" alt="Owlaris" style={{width:'32px',height:'32px',objectFit:'contain'}}/>
          <div>
            <h1 style={{color:'white',fontWeight:700,fontSize:'16px',margin:0}}>Panel del Guía</h1>
            <p style={{color:'rgba(255,255,255,.6)',fontSize:'12px',margin:0}}>{perfil.nombre_completo} · {perfil.colegio?.nombre}</p>
          </div>
        </div>
        <LogoutButton/>
      </header>

      <main style={{maxWidth:'900px',margin:'0 auto',padding:'32px 24px'}}>
        
        {/* Alertas */}
        <section style={{marginBottom:'32px'}}>
          <h2 style={{fontSize:'18px',fontWeight:700,color:'#1E1B4B',marginBottom:'16px',display:'flex',alignItems:'center',gap:'8px'}}>
            Alertas activas
            {alertas && alertas.length > 0 && (
              <span style={{background:'#DC2626',color:'white',borderRadius:'20px',padding:'2px 10px',fontSize:'12px',fontWeight:700}}>
                {alertas.length}
              </span>
            )}
          </h2>
          {!alertas || alertas.length === 0 ? (
            <div style={{background:'white',borderRadius:'12px',padding:'24px',textAlign:'center',color:'#9490B8',border:'1px solid rgba(109,40,217,.08)'}}>
              Sin alertas activas ✅
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
              {alertas.map((alerta: any) => (
                <div key={alerta.id} style={{background:'white',borderRadius:'12px',padding:'16px 20px',border:'1px solid rgba(109,40,217,.08)',boxShadow:'0 2px 12px rgba(109,40,217,.06)',display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'16px'}}>
                  <div>
                    <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'6px'}}>
                      <span style={{background:`${tipoColor[alerta.tipo]}20`,color:tipoColor[alerta.tipo],borderRadius:'6px',padding:'2px 10px',fontSize:'12px',fontWeight:600}}>
                        {tipoLabel[alerta.tipo]}
                      </span>
                      <span style={{fontSize:'11px',color:'#9490B8'}}>
                        {new Date(alerta.creado_en).toLocaleString('es-GT')}
                      </span>
                    </div>
                    <p style={{fontWeight:600,color:'#1E1B4B',margin:'0 0 4px',fontSize:'14px'}}>
                      {(alerta.alumno as any)?.nombre_completo} — {(alerta.alumno as any)?.grado}
                    </p>
                    <p style={{color:'#6B7280',fontSize:'13px',margin:'0 0 4px'}}>{alerta.descripcion}</p>
                    {alerta.contexto && <p style={{color:'#9490B8',fontSize:'12px',margin:0,fontStyle:'italic'}}>"{alerta.contexto}"</p>}
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

        {/* Alumnos asignados */}
        <section>
          <h2 style={{fontSize:'18px',fontWeight:700,color:'#1E1B4B',marginBottom:'16px'}}>Mis alumnos</h2>
          {!asignaciones || asignaciones.length === 0 ? (
            <div style={{background:'white',borderRadius:'12px',padding:'24px',textAlign:'center',color:'#9490B8',border:'1px solid rgba(109,40,217,.08)'}}>
              No tienes alumnos asignados aún. Contacta al administrador.
            </div>
          ) : (
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:'12px'}}>
              {asignaciones.map((a: any) => (
                <div key={a.id} style={{background:'white',borderRadius:'12px',padding:'16px',border:'1px solid rgba(109,40,217,.08)',boxShadow:'0 2px 12px rgba(109,40,217,.06)'}}>
                  <p style={{fontWeight:600,color:'#1E1B4B',margin:'0 0 4px',fontSize:'14px'}}>{(a.alumno as any)?.nombre_completo}</p>
                  <p style={{color:'#7C3AED',fontSize:'12px',margin:'0 0 8px'}}>{(a.alumno as any)?.grado}</p>
                  <p style={{color:'#9490B8',fontSize:'11px',margin:0}}>
                    Último acceso: {(a.alumno as any)?.ultimo_acceso ? new Date((a.alumno as any).ultimo_acceso).toLocaleDateString('es-GT') : 'Nunca'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
