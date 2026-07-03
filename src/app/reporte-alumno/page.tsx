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
  documento_fuente: string | null
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

type ResumenMateria = {
  nombre: string
  interacciones: number
  correctos: number
  incorrectos: number
  tasa: number | null
  temas: string[]
  documentos: string[]
  ultimaActividad: string | null
}

function normalizarTexto(texto: string) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function limpiarTema(texto: string | null | undefined) {
  return String(texto || '')
    .replace(/\[OP:[^\]]+\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function acortar(texto: string, max = 76) {
  const clean = limpiarTema(texto)
  return clean.length > max ? clean.slice(0, max - 1).trimEnd() + '…' : clean
}

function inferirTemaLegible(interaccion: Interaccion) {
  const base = normalizarTexto(`${interaccion.tema_detectado || ''} ${interaccion.pregunta || ''} ${interaccion.respuesta || ''} ${interaccion.operacion_canonica || ''}`)
  const temaOriginal = limpiarTema(interaccion.tema_detectado)

  if (/conversaci[oó]n en ingl[eé]s|english conversation|pronunciation|speak|speaking/.test(base)) return 'Conversación y pronunciación en inglés'
  if (/ecuaci|despej|isolate|solve.*x|[a-z]?\s*x\s*[+\-*/=]/.test(base) || (interaccion.operacion_canonica || '').includes('=')) return 'Ecuaciones y despeje de variables'
  if (/decimal|porcentaje|percent|0\.\d+|%/.test(base)) return 'Decimales y porcentajes'
  if (/orden de operaciones|multiplic|division|divisi[oó]n|[*/].*[+\-]|[+\-].*[*/]/.test(base)) return 'Orden de operaciones'
  if (/fracci[oó]n|fraction/.test(base)) return 'Fracciones'
  if (/lectura|comprensi[oó]n|texto|paragraph|read/.test(base)) return 'Comprensión lectora'
  if (/gram[aá]tica|ortograf|redacci[oó]n|writing|sentence/.test(base)) return 'Comunicación escrita'
  if (/historia|sociales|revoluci[oó]n|gobierno/.test(base)) return 'Análisis histórico y social'
  if (/biolog|ciencias naturales|ecosistema|environmental|quimica|qu[ií]mica|fisica|f[ií]sica/.test(base)) return 'Ciencias y comprensión de conceptos'
  if (/practic|repas|ejercicio|quiero practicar|vamos con/.test(base)) return 'Práctica guiada'
  if (temaOriginal && temaOriginal.length <= 80) return acortar(temaOriginal)
  return 'Acompañamiento académico'
}

function hashString(value: string) {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0
  return Math.abs(hash)
}

function fraseMotivacionalVariable(seed: string, nombre: string) {
  const primero = nombre.split(' ')[0] || 'tu hijo'
  const frases = [
    `${primero} está construyendo aprendizaje paso a paso; la constancia diaria será su mejor aliada.`,
    `Cada intento deja una pista de aprendizaje. Con guía y práctica breve, ${primero} puede avanzar con seguridad.`,
    `El progreso no siempre se ve en una sola respuesta; se ve en la disposición de volver a intentarlo y entender mejor.`,
    `${primero} no está solo en el proceso: con acompañamiento, práctica y calma, puede fortalecer sus bases.`,
    `Aprender también es ganar confianza. Lo importante es sostener el hábito y celebrar cada avance real.`,
    `Cuando una duda se trabaja con paciencia, se convierte en una oportunidad para crecer.`,
    `${primero} tiene una ruta clara: practicar, explicar con sus palabras y volver gradualmente a retos más altos.`,
    `La meta no es responder rápido, sino comprender mejor. Esa base hará que los próximos temas sean más fáciles.`,
  ]
  return frases[hashString(seed) % frases.length]
}

function lecturaPedagogica(input: {
  total: number
  tasa: number | null
  incorrectos: number
  alertas: number
  materiaPrioritaria?: string
}) {
  if (input.total === 0) return 'Aún no hay actividad suficiente para emitir una lectura académica. Conviene iniciar con una sesión corta de diagnóstico.'
  if (input.alertas > 0) return 'Hay señales que requieren seguimiento adulto. El foco principal debe ser acompañar al estudiante con calma y revisar el contexto antes de exigir más práctica.'
  if (input.tasa !== null && input.tasa >= 85 && input.incorrectos <= 1) return 'El desempeño reciente muestra avance sólido. Puede beneficiarse de retos graduales que pidan explicar el procedimiento, no solo responder.'
  if (input.tasa !== null && input.tasa < 65) return `El estudiante está en una etapa de refuerzo. Conviene trabajar ${input.materiaPrioritaria || 'la materia prioritaria'} con pasos cortos, ejemplos análogos y comprobación frecuente.`
  if (input.incorrectos >= 3) return `Hay oportunidades de práctica acumuladas. Lo recomendable es bajar temporalmente la dificultad y confirmar bases antes de continuar.`
  return 'El avance es estable. Mantener sesiones breves y constantes ayudará a consolidar lo aprendido.'
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
    .select('id, pregunta, respuesta, tema_detectado, creado_en, sospecha_copia, estado_evaluacion, operacion_canonica, documento_fuente, materia_id, materia:materias(nombre)')
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
  const temas = Array.from(new Set(lista.map(i => inferirTemaLegible(i)).filter(Boolean)))
  const totalSesiones = lista.length
  const ultimaActividad = lista[0]?.creado_en
  const sospechas = lista.filter(i => i.sospecha_copia).length
  const correctos = lista.filter(i => i.estado_evaluacion === 'correcto' || i.estado_evaluacion === 'equivalente').length
  const incorrectos = lista.filter(i => i.estado_evaluacion === 'incorrecto').length
  const evaluables = correctos + incorrectos
  const tasaAcierto = evaluables > 0 ? Math.round((correctos / evaluables) * 100) : null
  const fechaReporte = new Date()
  const etiquetaPeriodo = lista.length > 0
    ? `${new Date(lista[lista.length - 1].creado_en).toLocaleDateString('es-GT', { day: '2-digit', month: 'short' })} - ${fechaReporte.toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' })}`
    : fechaReporte.toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' })

  // Agrupar por materia
  const porMateria = new Map<string, Interaccion[]>()
  for (const int of lista) {
    const nombre = int.materia?.nombre || (normalizarTexto(int.respuesta).includes('english conversation') ? 'Inglés' : 'Materia no clasificada')
    if (!porMateria.has(nombre)) porMateria.set(nombre, [])
    porMateria.get(nombre)!.push(int)
  }
  const materias = Array.from(porMateria.keys())

  const resumenMaterias: ResumenMateria[] = Array.from(porMateria.entries()).map(([nombre, ints]) => {
    const c = ints.filter(i => i.estado_evaluacion === 'correcto' || i.estado_evaluacion === 'equivalente').length
    const e = ints.filter(i => i.estado_evaluacion === 'incorrecto').length
    const total = c + e
    const temasMateria = Array.from(new Set(ints.map(i => inferirTemaLegible(i)).filter(Boolean))).slice(0, 6)
    const documentos = Array.from(new Set(ints.map(i => i.documento_fuente).filter(Boolean))) as string[]
    return {
      nombre,
      interacciones: ints.length,
      correctos: c,
      incorrectos: e,
      tasa: total > 0 ? Math.round((c / total) * 100) : null,
      temas: temasMateria,
      documentos: documentos.slice(0, 4),
      ultimaActividad: ints[0]?.creado_en || null,
    }
  })
  const materiasConDificultad = resumenMaterias
    .filter(m => m.incorrectos > 0 || (m.tasa !== null && m.tasa < 70))
    .sort((a, b) => b.incorrectos - a.incorrectos || (a.tasa ?? 101) - (b.tasa ?? 101))
  const fortalezas = resumenMaterias
    .filter(m => m.correctos > 0 && m.incorrectos === 0)
    .sort((a, b) => b.correctos - a.correctos)
    .slice(0, 3)
  const materiaPrioritaria = materiasConDificultad[0]
  const temasPrioritarios = materiaPrioritaria?.temas.slice(0, 3) || []
  const fraseMotivacional = fraseMotivacionalVariable(
    `${alumnoId}-${fechaReporte.toLocaleDateString('es-GT')}-${totalSesiones}-${correctos}-${incorrectos}-${alertas.length}`,
    alumno?.nombre_completo || 'el estudiante'
  )
  const hayAlertaSeguridad = alertas.some(a => a.tipo === 'seguridad_contenido')
  const estadoGeneral = hayAlertaSeguridad
    ? { txt: 'Atención inmediata', color: '#B91C1C', bg: '#FEF2F2' }
    : alertas.length > 0 || sospechas > 0 || incorrectos >= 3 || (tasaAcierto !== null && tasaAcierto < 65)
      ? { txt: 'Requiere acompañamiento', color: '#B45309', bg: '#FFFBEB' }
      : totalSesiones === 0
        ? { txt: 'Sin actividad suficiente', color: '#64748B', bg: '#F8FAFC' }
        : { txt: 'Avance estable', color: '#059669', bg: '#ECFDF5' }
  const lecturaFamilia = lecturaPedagogica({
    total: totalSesiones,
    tasa: tasaAcierto,
    incorrectos,
    alertas: alertas.length,
    materiaPrioritaria: materiaPrioritaria?.nombre,
  })
  const recomendaciones = [
    hayAlertaSeguridad
      ? 'Revisar hoy las alertas sensibles y dar seguimiento con un adulto responsable del colegio.'
      : null,
    materiaPrioritaria
      ? `Dedicar 10 a 15 minutos diarios a ${materiaPrioritaria.nombre}, empezando por ${temasPrioritarios[0] || 'ejercicios guiados y cortos'}.`
      : null,
    sospechas > 0
      ? 'Pedirle al estudiante que explique con sus propias palabras los ejercicios marcados para confirmar comprensión real.'
      : null,
    tasaAcierto !== null && tasaAcierto >= 80
      ? 'Subir gradualmente la dificultad con problemas de razonamiento y aplicación.'
      : null,
    temasPrioritarios.length > 1
      ? `Reforzar esta semana: ${temasPrioritarios.join(', ')}.`
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
              <h1 style={{margin:0,fontSize:'20px',fontWeight:700}}>Informe Pedagógico Familiar</h1>
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
              <p style={{margin:'6px 0 0',fontSize:'11px',color:'rgba(255,255,255,.58)'}}>Generado: {fechaReporte.toLocaleString('es-GT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
        </div>

        {/* Lectura familiar */}
        <div style={{background:'white',borderRadius:'12px',padding:'24px',marginBottom:'24px',border:'1px solid rgba(15,28,46,.06)'}}>
          <div style={{display:'flex',justifyContent:'space-between',gap:'16px',alignItems:'flex-start',marginBottom:'18px',flexWrap:'wrap'}}>
            <div>
              <p style={{fontSize:'11px',fontWeight:700,color:'#94A3B8',margin:'0 0 6px',textTransform:'uppercase',letterSpacing:'.6px'}}>Lectura rápida para familia</p>
              <h2 style={{fontSize:'20px',fontWeight:750,color:'#0F1C2E',margin:'0 0 6px'}}>Estado académico del estudiante</h2>
              <p style={{fontSize:'13px',color:'#64748B',margin:0,lineHeight:1.5}}>Período analizado: {etiquetaPeriodo}. Resumen preparado para entender progreso, temas trabajados y próximos pasos sin leer toda la conversación.</p>
            </div>
            <span style={{background:estadoGeneral.bg,color:estadoGeneral.color,borderRadius:'999px',padding:'8px 12px',fontSize:'12px',fontWeight:800,whiteSpace:'nowrap'}}>{estadoGeneral.txt}</span>
          </div>
          <div style={{background:'#F8FAFC',border:'1px solid #E2E8F0',borderRadius:'12px',padding:'14px 16px',marginBottom:'18px'}}>
            <p style={{fontSize:'12px',fontWeight:800,color:'#2C3E6B',margin:'0 0 6px'}}>Lectura pedagógica</p>
            <p style={{fontSize:'13px',color:'#334155',margin:0,lineHeight:1.6}}>{lecturaFamilia}</p>
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
              <p style={{fontSize:'15px',fontWeight:800,color:'#2C3E6B',margin:0}}>{materiaPrioritaria?.nombre || 'Sin foco urgente'}</p>
            </div>
          </div>
          <div style={{background:'linear-gradient(135deg,#EEF2FF,#ECFEFF)',border:'1px solid #DBEAFE',borderRadius:'12px',padding:'16px',marginBottom:'18px'}}>
            <p style={{fontSize:'11px',fontWeight:800,color:'#2563EB',margin:'0 0 6px',textTransform:'uppercase',letterSpacing:'.5px'}}>Mensaje para acompañar</p>
            <p style={{fontSize:'14px',fontWeight:650,color:'#1E3A5F',margin:0,lineHeight:1.55}}>{fraseMotivacional}</p>
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
                  {fortalezas.map(m => <li key={m.nombre}>{m.nombre}: respuestas correctas con avance sostenido en las últimas interacciones.</li>)}
                </ul>
              ) : (
                <p style={{margin:0,color:'#64748B',fontSize:'13px',lineHeight:1.6}}>Aún no hay suficiente evidencia para marcar fortalezas. Conviene continuar con práctica guiada.</p>
              )}
            </div>
          </div>
        </div>

        {resumenMaterias.length > 0 && (
          <div style={{background:'white',borderRadius:'12px',padding:'22px 24px',marginBottom:'24px',border:'1px solid rgba(15,28,46,.06)'}}>
            <div style={{display:'flex',justifyContent:'space-between',gap:'12px',alignItems:'flex-start',marginBottom:'16px',flexWrap:'wrap'}}>
              <div>
                <p style={{fontSize:'11px',fontWeight:800,color:'#94A3B8',margin:'0 0 4px',textTransform:'uppercase',letterSpacing:'.6px'}}>Qué estudió</p>
                <h2 style={{fontSize:'17px',fontWeight:800,color:'#0F1C2E',margin:'0 0 4px'}}>Materias, temas y fuentes consultadas</h2>
                <p style={{fontSize:'13px',color:'#64748B',margin:0,lineHeight:1.5}}>Vista resumida para saber en qué trabajó el estudiante y con qué material de apoyo.</p>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))',gap:'14px'}}>
              {resumenMaterias.slice(0, 6).map(m => (
                <div key={m.nombre} style={{border:'1px solid #E2E8F0',borderRadius:'12px',padding:'14px',background:'#FCFCFD'}}>
                  <div style={{display:'flex',justifyContent:'space-between',gap:'10px',alignItems:'center',marginBottom:'10px'}}>
                    <h3 style={{fontSize:'14px',fontWeight:850,color:'#1E3A5F',margin:0}}>{m.nombre}</h3>
                    <span style={{fontSize:'11px',fontWeight:800,color:'#64748B',background:'#F1F5F9',borderRadius:'999px',padding:'4px 8px'}}>{m.interacciones}</span>
                  </div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:'6px',marginBottom:'10px'}}>
                    {m.temas.length > 0 ? m.temas.slice(0, 5).map(t => (
                      <span key={t} style={{fontSize:'11px',fontWeight:700,color:'#2C3E6B',background:'#EEF2FF',borderRadius:'999px',padding:'5px 8px'}}>{t}</span>
                    )) : <span style={{fontSize:'12px',color:'#94A3B8'}}>Sin temas clasificados.</span>}
                  </div>
                  {m.documentos.length > 0 ? (
                    <div style={{borderTop:'1px solid #E2E8F0',paddingTop:'9px'}}>
                      <p style={{fontSize:'10px',fontWeight:800,color:'#94A3B8',margin:'0 0 5px',textTransform:'uppercase',letterSpacing:'.4px'}}>Material consultado</p>
                      {m.documentos.slice(0, 2).map(doc => (
                        <p key={doc} style={{fontSize:'11px',color:'#0E7490',fontWeight:700,margin:'0 0 3px',lineHeight:1.4}}>◈ {doc}</p>
                      ))}
                    </div>
                  ) : (
                    <p style={{fontSize:'11px',color:'#94A3B8',margin:'8px 0 0'}}>Sin documento asociado en estas interacciones.</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{background:'white',borderRadius:'12px',padding:'22px 24px',marginBottom:'24px',border:'1px solid rgba(15,28,46,.06)'}}>
          <div style={{display:'flex',justifyContent:'space-between',gap:'12px',alignItems:'flex-start',marginBottom:'16px',flexWrap:'wrap'}}>
            <div>
              <p style={{fontSize:'11px',fontWeight:800,color:'#94A3B8',margin:'0 0 4px',textTransform:'uppercase',letterSpacing:'.6px'}}>Áreas de mejora</p>
              <h2 style={{fontSize:'17px',fontWeight:800,color:'#0F1C2E',margin:'0 0 4px'}}>Prioridades para acompañar mejor</h2>
              <p style={{fontSize:'13px',color:'#64748B',margin:0,lineHeight:1.5}}>Estas recomendaciones buscan apoyar al estudiante con pasos concretos, sin etiquetarlo ni presionarlo.</p>
            </div>
          </div>
          {materiaPrioritaria ? (
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:'14px'}}>
              <div style={{background:'#FFFBEB',border:'1px solid #FDE68A',borderRadius:'12px',padding:'14px'}}>
                <p style={{fontSize:'12px',fontWeight:850,color:'#92400E',margin:'0 0 6px'}}>Foco académico</p>
                <p style={{fontSize:'14px',fontWeight:800,color:'#0F1C2E',margin:'0 0 6px'}}>{materiaPrioritaria.nombre}</p>
                <p style={{fontSize:'12px',color:'#64748B',lineHeight:1.5,margin:0}}>{temasPrioritarios.length ? temasPrioritarios.join(', ') : 'Reforzar bases y procedimientos paso a paso.'}</p>
              </div>
              <div style={{background:'#F8FAFC',border:'1px solid #E2E8F0',borderRadius:'12px',padding:'14px'}}>
                <p style={{fontSize:'12px',fontWeight:850,color:'#2C3E6B',margin:'0 0 6px'}}>Cómo ayudar en casa</p>
                <p style={{fontSize:'12px',color:'#334155',lineHeight:1.55,margin:0}}>Pedirle que explique el procedimiento con sus propias palabras antes de avanzar a otro ejercicio. Si se bloquea, volver a un ejemplo más simple.</p>
              </div>
              <div style={{background:'#F0FDF4',border:'1px solid #BBF7D0',borderRadius:'12px',padding:'14px'}}>
                <p style={{fontSize:'12px',fontWeight:850,color:'#047857',margin:'0 0 6px'}}>Meta corta</p>
                <p style={{fontSize:'12px',color:'#334155',lineHeight:1.55,margin:0}}>Practicar 10 minutos, revisar un solo tipo de ejercicio y cerrar con una explicación breve del estudiante.</p>
              </div>
            </div>
          ) : (
            <div style={{background:'#F8FAFC',border:'1px solid #E2E8F0',borderRadius:'12px',padding:'14px'}}>
              <p style={{fontSize:'13px',color:'#334155',lineHeight:1.6,margin:0}}>No hay un foco urgente detectado en las interacciones recientes. La mejor estrategia es mantener constancia, pedir explicación del proceso y subir dificultad gradualmente.</p>
            </div>
          )}
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
            { label: 'Revisión de autoría', value: sospechas, color: sospechas > 0 ? '#DC2626' : '#059669' },
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
                        <div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'}}>
                          <span style={{fontSize:'11px',fontWeight:650,color:'#2C3E6B'}}>{inferirTemaLegible(int)}</span>
                          {badge && <span style={{background:badge.bg,color:badge.color,borderRadius:'6px',padding:'2px 8px',fontSize:'10px',fontWeight:700}}>{badge.txt}</span>}
                          {int.sospecha_copia && <span style={{background:'#FEF3C7',color:'#B45309',borderRadius:'6px',padding:'2px 8px',fontSize:'10px',fontWeight:700}}>Revisar autoría</span>}
                        </div>
                        <span style={{fontSize:'11px',color:'#94A3B8'}}>{fmtFecha(int.creado_en)}</span>
                      </div>
                      <p style={{fontSize:'13px',color:'#334155',margin:'0 0 6px',lineHeight:1.5}}><strong>Alumno:</strong> {int.pregunta}</p>
                      <p style={{fontSize:'13px',color:'#64748B',margin:0,lineHeight:1.5,whiteSpace:'pre-wrap'}}><strong>Owlaris:</strong> {int.respuesta}</p>
                      {int.documento_fuente && <p style={{fontSize:'11px',fontWeight:700,color:'#0E7490',margin:'8px 0 0'}}>◈ {int.documento_fuente}</p>}
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
