import { createAdminClient, createClient } from '@/lib/supabase/server'
import { canStaffAccessStudent } from '@/lib/guideAccess'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function ReporteAlumnoPage({ searchParams }: { searchParams: { id?: string } }) {
  const supabase = createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const alumnoId = searchParams.id
  if (!alumnoId) redirect('/guia')

  const { data: perfil } = await supabase
    .from('usuarios').select('rol, colegio_id').eq('id', user.id).single()
  if (!perfil) redirect('/login')

  const { data: alumno } = await admin
    .from('usuarios').select('*, colegio:colegios(nombre)').eq('id', alumnoId).single()
  if (!alumno) redirect('/guia')

  const puedeVer = await canStaffAccessStudent(admin, perfil, user.id, alumnoId)

  if (!puedeVer) redirect('/guia')

  const { data: interacciones } = await admin
    .from('interacciones').select('*')
    .eq('usuario_id', alumnoId)
    .order('creado_en', { ascending: false })
    .limit(30)

  const temas = Array.from(new Set((interacciones||[]).map((i:any) => i.tema_detectado).filter(Boolean)))
  const materias = Array.from(new Set((interacciones||[]).map((i:any) => i.materia_id).filter(Boolean)))
  const totalSesiones = interacciones?.length || 0
  const ultimaActividad = interacciones?.[0]?.creado_en
  const sospechas = (interacciones||[]).filter((i:any) => i.sospecha_copia).length

  return (
    <div style={{minHeight:'100vh',background:'#F5F7FA',fontFamily:'system-ui,-apple-system,sans-serif',padding:'32px'}}>
      <div style={{maxWidth:'800px',margin:'0 auto'}}>
        
        {/* Header */}
        <div style={{background:'linear-gradient(135deg,#1E3A5F,#2C3E6B)',borderRadius:'16px',padding:'28px 32px',marginBottom:'24px',color:'white'}}>
          <div style={{display:'flex',alignItems:'center',gap:'16px',marginBottom:'8px'}}>
            <img src="/buho.png" alt="Owlaris" style={{width:'40px',height:'40px',objectFit:'contain'}}/>
            <div>
              <h1 style={{margin:0,fontSize:'20px',fontWeight:700}}>Reporte Académico</h1>
              <p style={{margin:0,fontSize:'12px',color:'rgba(255,255,255,.6)'}}>Owlaris · {(alumno?.colegio as any)?.nombre}</p>
            </div>
          </div>
          <div style={{marginTop:'16px'}}>
            <h2 style={{margin:'0 0 4px',fontSize:'24px',fontWeight:700}}>{alumno?.nombre_completo}</h2>
            <p style={{margin:0,fontSize:'14px',color:'rgba(255,255,255,.7)'}}>{alumno?.grado} · {alumno?.email}</p>
          </div>
        </div>

        {/* Métricas */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px',marginBottom:'24px'}}>
          {[
            { label: 'Total sesiones', value: totalSesiones, color: '#2C3E6B' },
            { label: 'Temas únicos', value: temas.length, color: '#0D9488' },
            { label: 'Materias', value: materias.length, color: '#7C3AED' },
            { label: 'Sospechas copia', value: sospechas, color: sospechas > 0 ? '#DC2626' : '#059669' },
          ].map((m,i) => (
            <div key={i} style={{background:'white',borderRadius:'12px',padding:'16px',border:'1px solid rgba(15,28,46,.06)',textAlign:'center'}}>
              <p style={{fontSize:'24px',fontWeight:700,color:m.color,margin:'0 0 4px'}}>{m.value}</p>
              <p style={{fontSize:'11px',color:'#94A3B8',margin:0}}>{m.label}</p>
            </div>
          ))}
        </div>

        {/* Última actividad */}
        <div style={{background:'white',borderRadius:'12px',padding:'20px 24px',marginBottom:'24px',border:'1px solid rgba(15,28,46,.06)'}}>
          <h3 style={{fontSize:'14px',fontWeight:700,color:'#0F1C2E',margin:'0 0 12px'}}>Información general</h3>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
            <div>
              <p style={{fontSize:'11px',color:'#94A3B8',margin:'0 0 2px',textTransform:'uppercase',letterSpacing:'.5px'}}>Última actividad</p>
              <p style={{fontSize:'14px',color:'#0F1C2E',margin:0,fontWeight:500}}>{ultimaActividad ? new Date(ultimaActividad).toLocaleString('es-GT') : 'Sin actividad'}</p>
            </div>
            <div>
              <p style={{fontSize:'11px',color:'#94A3B8',margin:'0 0 2px',textTransform:'uppercase',letterSpacing:'.5px'}}>Estado</p>
              <p style={{fontSize:'14px',margin:0,fontWeight:600,color: totalSesiones > 0 ? '#059669' : '#94A3B8'}}>{totalSesiones > 0 ? 'Activo en Owlaris' : 'Sin actividad'}</p>
            </div>
          </div>
        </div>

        {/* Temas estudiados */}
        {temas.length > 0 && (
          <div style={{background:'white',borderRadius:'12px',padding:'20px 24px',marginBottom:'24px',border:'1px solid rgba(15,28,46,.06)'}}>
            <h3 style={{fontSize:'14px',fontWeight:700,color:'#0F1C2E',margin:'0 0 12px'}}>Temas consultados</h3>
            <div style={{display:'flex',flexWrap:'wrap',gap:'8px'}}>
              {temas.slice(0,20).map((t:any,i) => (
                <span key={i} style={{background:'#EEF2FF',color:'#2C3E6B',borderRadius:'6px',padding:'4px 12px',fontSize:'12px',fontWeight:500}}>{t}</span>
              ))}
            </div>
          </div>
        )}

        {/* Historial */}
        <div style={{background:'white',borderRadius:'12px',padding:'20px 24px',border:'1px solid rgba(15,28,46,.06)'}}>
          <h3 style={{fontSize:'14px',fontWeight:700,color:'#0F1C2E',margin:'0 0 16px'}}>Historial de sesiones</h3>
          <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
            {(interacciones||[]).slice(0,10).map((int:any,i) => (
              <div key={i} style={{borderLeft:'3px solid #2C3E6B',paddingLeft:'16px',paddingBottom:'12px',borderBottom:'1px solid #F8FAFC'}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:'6px'}}>
                  <span style={{fontSize:'11px',fontWeight:600,color:'#2C3E6B',textTransform:'uppercase',letterSpacing:'.5px'}}>{int.tema_detectado}</span>
                  <span style={{fontSize:'11px',color:'#94A3B8'}}>{new Date(int.creado_en).toLocaleString('es-GT')}</span>
                </div>
                <p style={{fontSize:'13px',color:'#475569',margin:'0 0 4px'}}><strong>P:</strong> {int.pregunta}</p>
                <p style={{fontSize:'12px',color:'#94A3B8',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}><strong>R:</strong> {int.respuesta?.substring(0,120)}...</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{textAlign:'center',marginTop:'24px'}}>
          <a href="/guia" style={{color:'#2C3E6B',fontSize:'13px',textDecoration:'none',fontWeight:500}}>← Volver al panel</a>
        </div>
      </div>
    </div>
  )
}
