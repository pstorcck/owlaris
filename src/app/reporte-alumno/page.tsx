import { createAdminClient, createClient } from '@/lib/supabase/server'
import { canStaffAccessStudent } from '@/lib/guideAccess'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

type Interaccion = {
  id: string
  pregunta: string
  respuesta: string
  tema_detectado: string | null
  creado_en: string
  sospecha_copia: boolean
  estado_evaluacion: string | null
  operacion_canonica: string | null
  materia_id: string | null
  materia?: { nombre: string } | null
}

export default async function ReporteAlumnoPage({ searchParams }: { searchParams: { id?: string } }) {
  const supabase = createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const alumnoId = searchParams.id
  if (!alumnoId) redirect('/guia')

  const { data: perfil } = await supabase
    .from('usuarios').select('rol, colegio_id, email').eq('id', user.id).single()
  if (!perfil) redirect('/login')

  const { data: alumno } = await admin
    .from('usuarios').select('*, colegio:colegios(nombre)').eq('id', alumnoId).single()
  if (!alumno) redirect('/guia')

  const puedeVer = await canStaffAccessStudent(admin, perfil, user.id, alumnoId)
  if (!puedeVer) redirect('/guia')

  const { data: interacciones } = await admin
    .from('interacciones')
    .select('id, pregunta, respuesta, tema_detectado, creado_en, sospecha_copia, estado_evaluacion, operacion_canonica, materia_id, materia:materias(nombre)')
    .eq('usuario_id', alumnoId)
    .order('creado_en', { ascending: false })
    .limit(200) as { data: Interaccion[] | null }

  const lista = interacciones || []
  const temas = Array.from(new Set(lista.map(i => i.tema_detectado).filter(Boolean)))
  const totalSesiones = lista.length
  const ultimaActividad = lista[0]?.creado_en
  const sospechas = lista.filter(i => i.sospecha_copia).length
  const correctos = lista.filter(i => i.estado_evaluacion === 'correcto' || i.estado_evaluacion === 'equivalente').length
  const incorrectos = lista.filter(i => i.estado_evaluacion === 'incorrecto').length

  // Agrupar por materia
  const porMateria = new Map<string, Interaccion[]>()
  for (const int of lista) {
    const nombre = int.materia?.nombre || 'Sin materia'
    if (!porMateria.has(nombre)) porMateria.set(nombre, [])
    porMateria.get(nombre)!.push(int)
  }
  const materias = Array.from(porMateria.keys())

  const fmtFecha = (f: string) => new Date(f).toLocaleString('es-GT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  const badgeEval = (estado: string | null) => {
    if (estado === 'correcto' || estado === 'equivalente') return { txt: 'Logrado', bg: '#DCFCE7', color: '#059669' }
    if (estado === 'incorrecto') return { txt: 'En práctica', bg: '#EDE9FE', color: '#7C3AED' }
    return null
  }

  return (
    <div style={{minHeight:'100vh',background:'#F5F7FA',fontFamily:'system-ui,-apple-system,sans-serif',padding:'32px 20px'}}>
      <div style={{maxWidth:'860px',margin:'0 auto'}}>

        {/* Header */}
        <div style={{background:'linear-gradient(135deg,#1E3A5F,#2C3E6B)',borderRadius:'16px',padding:'28px 32px',marginBottom:'24px',color:'white'}}>
          <div style={{display:'flex',alignItems:'center',gap:'16px',marginBottom:'8px'}}>
            <img src="/buho.png" alt="Owlaris" style={{width:'40px',height:'40px',objectFit:'contain'}}/>
            <div>
              <h1 style={{margin:0,fontSize:'20px',fontWeight:700}}>Reporte Académico Completo</h1>
              <p style={{margin:0,fontSize:'12px',color:'rgba(255,255,255,.6)'}}>Owlaris · {(alumno?.colegio as {nombre?:string})?.nombre || 'Sin colegio'}</p>
            </div>
          </div>
          <div style={{marginTop:'16px',display:'flex',justifyContent:'space-between',alignItems:'flex-end',flexWrap:'wrap',gap:'12px'}}>
            <div>
              <h2 style={{margin:'0 0 4px',fontSize:'24px',fontWeight:700}}>{alumno?.nombre_completo}</h2>
              <p style={{margin:0,fontSize:'14px',color:'rgba(255,255,255,.7)'}}>{alumno?.email}</p>
            </div>
            <div style={{textAlign:'right'}}>
              <p style={{margin:'0 0 2px',fontSize:'11px',color:'rgba(255,255,255,.5)',textTransform:'uppercase',letterSpacing:'.5px'}}>Grado</p>
              <p style={{margin:0,fontSize:'18px',fontWeight:700}}>{alumno?.grado || 'No asignado'}</p>
            </div>
          </div>
        </div>

        {/* Métricas */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:'12px',marginBottom:'24px'}}>
          {[
            { label: 'Interacciones', value: totalSesiones, color: '#2C3E6B' },
            { label: 'Materias', value: materias.length, color: '#7C3AED' },
            { label: 'Temas únicos', value: temas.length, color: '#0D9488' },
            { label: 'Logrados', value: correctos, color: '#059669' },
            { label: 'En práctica', value: incorrectos, color: '#7C3AED' },
            { label: 'Sospechas copia', value: sospechas, color: sospechas > 0 ? '#DC2626' : '#059669' },
          ].map((m,i) => (
            <div key={i} style={{background:'white',borderRadius:'12px',padding:'16px',border:'1px solid rgba(15,28,46,.06)',textAlign:'center'}}>
              <p style={{fontSize:'24px',fontWeight:700,color:m.color,margin:'0 0 4px'}}>{m.value}</p>
              <p style={{fontSize:'11px',color:'#94A3B8',margin:0}}>{m.label}</p>
            </div>
          ))}
        </div>

        {/* Info general */}
        <div style={{background:'white',borderRadius:'12px',padding:'20px 24px',marginBottom:'24px',border:'1px solid rgba(15,28,46,.06)'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
            <div>
              <p style={{fontSize:'11px',color:'#94A3B8',margin:'0 0 2px',textTransform:'uppercase',letterSpacing:'.5px'}}>Última actividad</p>
              <p style={{fontSize:'14px',color:'#0F1C2E',margin:0,fontWeight:500}}>{ultimaActividad ? fmtFecha(ultimaActividad) : 'Sin actividad'}</p>
            </div>
            <div>
              <p style={{fontSize:'11px',color:'#94A3B8',margin:'0 0 2px',textTransform:'uppercase',letterSpacing:'.5px'}}>Mostrando</p>
              <p style={{fontSize:'14px',color:'#0F1C2E',margin:0,fontWeight:500}}>Últimas {totalSesiones} interacciones (máx. 200)</p>
            </div>
          </div>
        </div>

        {/* Conversaciones por materia */}
        {materias.map(nombreMateria => {
          const ints = porMateria.get(nombreMateria)!
          const errsMateria = ints.filter(i => i.estado_evaluacion === 'incorrecto').length
          return (
            <div key={nombreMateria} style={{background:'white',borderRadius:'12px',padding:'20px 24px',marginBottom:'20px',border:'1px solid rgba(15,28,46,.06)'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px',borderBottom:'2px solid #F1F5F9',paddingBottom:'12px'}}>
                <h3 style={{fontSize:'16px',fontWeight:700,color:'#2C3E6B',margin:0}}>{nombreMateria}</h3>
                <span style={{fontSize:'12px',color:'#94A3B8'}}>{ints.length} interacciones{errsMateria > 0 ? ` · ${errsMateria} en práctica` : ''}</span>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
                {ints.map(int => {
                  const badge = badgeEval(int.estado_evaluacion)
                  return (
                    <div key={int.id} style={{borderLeft:'3px solid #E2E8F0',paddingLeft:'16px'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'6px',flexWrap:'wrap',gap:'6px'}}>
                        <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
                          {int.tema_detectado && <span style={{fontSize:'11px',fontWeight:600,color:'#2C3E6B'}}>{int.tema_detectado}</span>}
                          {badge && <span style={{background:badge.bg,color:badge.color,borderRadius:'6px',padding:'2px 8px',fontSize:'10px',fontWeight:700}}>{badge.txt}</span>}
                          {int.sospecha_copia && <span style={{background:'#FEF3C7',color:'#B45309',borderRadius:'6px',padding:'2px 8px',fontSize:'10px',fontWeight:700}}>Sospecha copia</span>}
                        </div>
                        <span style={{fontSize:'11px',color:'#94A3B8'}}>{fmtFecha(int.creado_en)}</span>
                      </div>
                      <p style={{fontSize:'13px',color:'#334155',margin:'0 0 6px',lineHeight:1.5}}><strong>Alumno:</strong> {int.pregunta}</p>
                      <p style={{fontSize:'13px',color:'#64748B',margin:0,lineHeight:1.5,whiteSpace:'pre-wrap'}}><strong>Owlaris:</strong> {int.respuesta}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {lista.length === 0 && (
          <div style={{background:'white',borderRadius:'12px',padding:'40px',textAlign:'center',border:'1px solid rgba(15,28,46,.06)'}}>
            <p style={{color:'#94A3B8',margin:0}}>Este alumno aún no tiene interacciones registradas.</p>
          </div>
        )}

        <div style={{textAlign:'center',marginTop:'24px'}}>
          <a href="/guia" style={{color:'#2C3E6B',fontSize:'13px',textDecoration:'none',fontWeight:500}}>← Volver al panel</a>
        </div>
      </div>
    </div>
  )
}
