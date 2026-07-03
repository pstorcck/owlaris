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

type AlertaReporte = {
  id: string
  tipo: string
  descripcion: string | null
  contexto: string | null
  creado_en: string
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

  const { data: alertasActivas } = await admin
    .from('alertas')
    .select('id, tipo, descripcion, contexto, creado_en')
    .eq('alumno_id', alumnoId)
    .eq('resuelta', false)
    .order('creado_en', { ascending: false })
    .limit(10) as { data: AlertaReporte[] | null }

  const lista = interacciones || []
  const alertas = alertasActivas || []
  const temas = Array.from(new Set(lista.map(i => i.tema_detectado).filter(Boolean)))
  const totalSesiones = lista.length
  const ultimaActividad = lista[0]?.creado_en
  const sospechas = lista.filter(i => i.sospecha_copia).length
  const correctos = lista.filter(i => i.estado_evaluacion === 'correcto' || i.estado_evaluacion === 'equivalente').length
  const incorrectos = lista.filter(i => i.estado_evaluacion === 'incorrecto').length
  const evaluables = correctos + incorrectos
  const tasaAcierto = evaluables > 0 ? Math.round((correctos / evaluables) * 100) : null

  // Agrupar por materia
  const porMateria = new Map<string, Interaccion[]>()
  for (const int of lista) {
    const nombre = int.materia?.nombre || 'Sin materia'
    if (!porMateria.has(nombre)) porMateria.set(nombre, [])
    porMateria.get(nombre)!.push(int)
  }
  const materias = Array.from(porMateria.keys())

  const resumenMaterias = Array.from(porMateria.entries()).map(([nombre, ints]) => {
    const c = ints.filter(i => i.estado_evaluacion === 'correcto' || i.estado_evaluacion === 'equivalente').length
    const e = ints.filter(i => i.estado_evaluacion === 'incorrecto').length
    const total = c + e
    const temasMateria = Array.from(new Set(ints.map(i => i.tema_detectado).filter(Boolean))) as string[]
    return {
      nombre,
      interacciones: ints.length,
      correctos: c,
      incorrectos: e,
      tasa: total > 0 ? Math.round((c / total) * 100) : null,
      temas: temasMateria,
    }
  })
  const materiasConDificultad = resumenMaterias
    .filter(m => m.incorrectos > 0 || (m.tasa !== null && m.tasa < 70))
    .sort((a, b) => b.incorrectos - a.incorrectos || (a.tasa ?? 101) - (b.tasa ?? 101))
  const fortalezas = resumenMaterias
    .filter(m => m.correctos > 0 && m.incorrectos === 0)
    .sort((a, b) => b.correctos - a.correctos)
    .slice(0, 3)
  const hayAlertaSeguridad = alertas.some(a => a.tipo === 'seguridad_contenido')
  const estadoGeneral = hayAlertaSeguridad
    ? { txt: 'Atención inmediata', color: '#B91C1C', bg: '#FEF2F2' }
    : alertas.length > 0 || sospechas > 0 || incorrectos >= 3 || (tasaAcierto !== null && tasaAcierto < 65)
      ? { txt: 'Requiere acompañamiento', color: '#B45309', bg: '#FFFBEB' }
      : totalSesiones === 0
        ? { txt: 'Sin actividad suficiente', color: '#64748B', bg: '#F8FAFC' }
        : { txt: 'Avance estable', color: '#059669', bg: '#ECFDF5' }
  const recomendaciones = [
    hayAlertaSeguridad
      ? 'Revisar hoy las alertas sensibles y dar seguimiento con un adulto responsable del colegio.'
      : null,
    materiasConDificultad.length > 0
      ? `Dedicar 10 a 15 minutos diarios a ${materiasConDificultad[0].nombre}, empezando por ejercicios guiados y cortos.`
      : null,
    sospechas > 0
      ? 'Pedirle al estudiante que explique con sus propias palabras los ejercicios marcados con posible copia.'
      : null,
    tasaAcierto !== null && tasaAcierto >= 80
      ? 'Subir gradualmente la dificultad con problemas de razonamiento y aplicación.'
      : null,
    totalSesiones === 0
      ? 'Iniciar con una sesión diagnóstica corta para conocer materias, dudas y hábitos de estudio.'
      : null,
  ].filter(Boolean) as string[]
  if (recomendaciones.length === 0) {
    recomendaciones.push('Mantener práctica breve y constante, revisando una materia prioritaria por sesión.')
  }

  const fmtFecha = (f: string) => new Date(f).toLocaleString('es-GT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  const badgeEval = (estado: string | null) => {
    if (estado === 'correcto' || estado === 'equivalente') return { txt: 'Logrado', bg: '#DCFCE7', color: '#059669' }
    if (estado === 'incorrecto') return { txt: 'En práctica', bg: '#EDE9FE', color: '#7C3AED' }
    return null
  }
  const tipoLabel: Record<string,string> = {
    baja_comprension: 'Baja comprensión',
    bloqueo_recurrente: 'Bloqueo recurrente',
    riesgo_copia: 'Riesgo de copia',
    seguridad_contenido: 'Seguridad del estudiante',
  }
  const tipoColor: Record<string,string> = {
    baja_comprension: '#B45309',
    bloqueo_recurrente: '#2563EB',
    riesgo_copia: '#DC2626',
    seguridad_contenido: '#B91C1C',
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

        {/* Lectura familiar */}
        <div style={{background:'white',borderRadius:'12px',padding:'24px',marginBottom:'24px',border:'1px solid rgba(15,28,46,.06)'}}>
          <div style={{display:'flex',justifyContent:'space-between',gap:'16px',alignItems:'flex-start',marginBottom:'18px',flexWrap:'wrap'}}>
            <div>
              <p style={{fontSize:'11px',fontWeight:700,color:'#94A3B8',margin:'0 0 6px',textTransform:'uppercase',letterSpacing:'.6px'}}>Lectura rápida para familia</p>
              <h2 style={{fontSize:'20px',fontWeight:750,color:'#0F1C2E',margin:'0 0 6px'}}>Estado académico del estudiante</h2>
              <p style={{fontSize:'13px',color:'#64748B',margin:0,lineHeight:1.5}}>Resumen preparado para entender progreso, riesgos y próximos pasos sin leer toda la conversación.</p>
            </div>
            <span style={{background:estadoGeneral.bg,color:estadoGeneral.color,borderRadius:'999px',padding:'8px 12px',fontSize:'12px',fontWeight:800,whiteSpace:'nowrap'}}>{estadoGeneral.txt}</span>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:'12px',marginBottom:'18px'}}>
            <div style={{background:'#F8FAFC',borderRadius:'10px',padding:'14px'}}>
              <p style={{fontSize:'11px',color:'#94A3B8',fontWeight:700,margin:'0 0 4px'}}>Tasa de acierto</p>
              <p style={{fontSize:'24px',fontWeight:800,color:tasaAcierto !== null && tasaAcierto < 65 ? '#DC2626' : '#059669',margin:0}}>{tasaAcierto !== null ? `${tasaAcierto}%` : 'N/D'}</p>
            </div>
            <div style={{background:'#F8FAFC',borderRadius:'10px',padding:'14px'}}>
              <p style={{fontSize:'11px',color:'#94A3B8',fontWeight:700,margin:'0 0 4px'}}>Alertas abiertas</p>
              <p style={{fontSize:'24px',fontWeight:800,color:alertas.length > 0 ? '#DC2626' : '#059669',margin:0}}>{alertas.length}</p>
            </div>
            <div style={{background:'#F8FAFC',borderRadius:'10px',padding:'14px'}}>
              <p style={{fontSize:'11px',color:'#94A3B8',fontWeight:700,margin:'0 0 4px'}}>Materia prioritaria</p>
              <p style={{fontSize:'15px',fontWeight:800,color:'#2C3E6B',margin:0}}>{materiasConDificultad[0]?.nombre || 'Sin foco crítico'}</p>
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:'16px'}}>
            <div>
              <h3 style={{fontSize:'13px',fontWeight:800,color:'#0F1C2E',margin:'0 0 10px'}}>Qué hacer esta semana</h3>
              <ul style={{margin:0,paddingLeft:'18px',color:'#334155',fontSize:'13px',lineHeight:1.6}}>
                {recomendaciones.slice(0, 4).map((rec, i) => <li key={i}>{rec}</li>)}
              </ul>
            </div>
            <div>
              <h3 style={{fontSize:'13px',fontWeight:800,color:'#0F1C2E',margin:'0 0 10px'}}>Fortalezas detectadas</h3>
              {fortalezas.length > 0 ? (
                <ul style={{margin:0,paddingLeft:'18px',color:'#334155',fontSize:'13px',lineHeight:1.6}}>
                  {fortalezas.map(m => <li key={m.nombre}>{m.nombre}: respuestas correctas sin errores recientes.</li>)}
                </ul>
              ) : (
                <p style={{margin:0,color:'#64748B',fontSize:'13px',lineHeight:1.6}}>Aún no hay suficiente evidencia para marcar fortalezas. Conviene continuar con práctica guiada.</p>
              )}
            </div>
          </div>
        </div>

        {alertas.length > 0 && (
          <div style={{background:'#FEF2F2',borderRadius:'12px',padding:'18px 20px',marginBottom:'24px',border:'1px solid #FECACA'}}>
            <h2 style={{fontSize:'15px',fontWeight:800,color:'#991B1B',margin:'0 0 12px'}}>Alertas activas del estudiante</h2>
            <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
              {alertas.map(alerta => (
                <div key={alerta.id} style={{background:'white',borderRadius:'10px',padding:'12px 14px',border:'1px solid #FEE2E2'}}>
                  <div style={{display:'flex',justifyContent:'space-between',gap:'12px',alignItems:'center',flexWrap:'wrap'}}>
                    <span style={{background:'#FEE2E2',color:tipoColor[alerta.tipo] || '#DC2626',borderRadius:'999px',padding:'4px 9px',fontSize:'11px',fontWeight:800}}>{tipoLabel[alerta.tipo] || 'Alerta'}</span>
                    <span style={{fontSize:'11px',color:'#94A3B8'}}>{fmtFecha(alerta.creado_en)}</span>
                  </div>
                  <p style={{margin:'8px 0 0',fontSize:'13px',color:'#334155',lineHeight:1.5}}>{alerta.descripcion || 'Alerta sin descripción.'}</p>
                  {alerta.contexto && <p style={{margin:'4px 0 0',fontSize:'12px',color:'#64748B',lineHeight:1.5}}>Contexto: {alerta.contexto}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

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

        {/* Materias */}
        {resumenMaterias.length > 0 && (
          <div style={{background:'white',borderRadius:'12px',padding:'20px 24px',marginBottom:'24px',border:'1px solid rgba(15,28,46,.06)'}}>
            <div style={{display:'flex',justifyContent:'space-between',gap:'12px',alignItems:'center',marginBottom:'16px',flexWrap:'wrap'}}>
              <div>
                <p style={{fontSize:'11px',fontWeight:700,color:'#94A3B8',margin:'0 0 4px',textTransform:'uppercase',letterSpacing:'.6px'}}>Mapa académico</p>
                <h2 style={{fontSize:'16px',fontWeight:800,color:'#0F1C2E',margin:0}}>Rendimiento por materia</h2>
              </div>
              <span style={{fontSize:'12px',color:'#64748B'}}>Basado en las últimas {totalSesiones} interacciones</span>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
              {resumenMaterias.sort((a,b) => b.interacciones - a.interacciones).map(m => {
                const color = m.tasa === null ? '#94A3B8' : m.tasa < 65 ? '#DC2626' : m.tasa < 80 ? '#D97706' : '#059669'
                return (
                  <div key={m.nombre} style={{border:'1px solid #E2E8F0',borderRadius:'10px',padding:'14px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',gap:'12px',alignItems:'center',marginBottom:'8px'}}>
                      <div>
                        <p style={{fontSize:'14px',fontWeight:800,color:'#0F1C2E',margin:'0 0 2px'}}>{m.nombre}</p>
                        <p style={{fontSize:'12px',color:'#94A3B8',margin:0}}>{m.interacciones} interacciones · {m.temas.slice(0, 3).join(', ') || 'sin temas clasificados'}</p>
                      </div>
                      <span style={{fontSize:'14px',fontWeight:800,color}}>{m.tasa !== null ? `${m.tasa}%` : 'N/D'}</span>
                    </div>
                    <div style={{height:'8px',background:'#F1F5F9',borderRadius:'999px',overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${m.tasa ?? 0}%`,background:color,borderRadius:'999px'}} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

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
