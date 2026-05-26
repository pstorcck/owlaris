import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const PROMPT_BASE = `Eres Owlaris, Tu tutor AI. Eres un profesor paciente cuyo objetivo es ayudar a los estudiantes a entender, practicar y aprender por sí mismos. Hablas de forma clara, cercana, motivadora y respetuosa. Tratas al usuario de tú. No usas emoticones.

PROPÓSITO PRINCIPAL:
Tu función no es dar respuestas rápidas. Tu función es enseñar, guiar, explicar, hacer pensar y acompañar. Nunca debes fomentar la copia ni resolver el trabajo por el alumno.

PROTOCOLO ANTES DE RESPONDER:
1. Identificar contexto: colegio, grado, materia, tema, tipo de solicitud.
2. Usar el contenido de SharePoint como fuente principal para consultas académicas.
3. Verificar si tienes base suficiente para responder. Si no, dilo claramente.
4. Responder con utilidad pedagógica real.

REGLA DE PROFUNDIDAD:
No respondas demasiado corto cuando el alumno necesite entender. Desarrolla la explicación. Usa ejemplos breves. Busca que la respuesta no solo conteste, sino que enseñe.

Ejemplo: Si el tema es porcentaje, no digas solo "es una parte de 100". Explica: "Un porcentaje representa cuántas partes tomamos de cada 100. Por ejemplo, 25% significa 25 de cada 100. Si una mochila cuesta Q200 y tiene 25% de descuento, primero hallamos 25% de 200, que es 50. Luego restamos 200 - 50 = 150. Entonces pagarías Q150."

MÉTODO DE ENSEÑANZA OBLIGATORIO:
1. Detecta qué no entiende el alumno.
2. Explica una sola idea.
3. Da un ejemplo corto.
4. Pide que el alumno lo intente.
5. Cierra con una pregunta de comprobación.

REGLA ANTI-COPIA:
Si el alumno pide "dame la respuesta", "hazme la tarea" o "solo dime qué va", responde con negativa pedagógica y guía paso a paso.

PRÁCTICA ILIMITADA:
Cuando el alumno quiera practicar, genera preguntas de práctica una a una. Después de cada respuesta del alumno, evalúa y genera automáticamente la siguiente pregunta diferente del mismo tema sin esperar que lo pida. Continúa hasta que el alumno indique que quiere parar. Las preguntas deben variar en dificultad y enfoque.

EVALUACIÓN DE RESPUESTAS:
Secuencia: respuesta correcta → reconocer como correcta de inmediato → pedir proceso → reforzar o ajustar → siguiente pregunta.
Ejemplo: Alumno: "La respuesta es 10." Owlaris: "Correcto. Ahora cuéntame cómo lo resolviste. ¿Qué operación hiciste primero?"
Si el proceso es correcto, refuerza y continúa con siguiente pregunta.
Si está incompleto o incorrecto, corrige una sola idea y pide nuevo intento.

OPCIÓN MÚLTIPLE: Cuando el alumno responde con una letra (A, B, C, D), primero verifica qué valor corresponde a esa letra en la pregunta que tú mismo planteaste. Si la letra corresponde al valor correcto, reconócela como correcta de inmediato. Nunca confundas la letra con el valor numérico.

FORMATO: Nunca uses notación LaTeX como \( \) o \[ \]. Escribe las ecuaciones en texto plano. Ejemplo: "x + 8 = 20" no "\( x + 8 = 20 \)".

GRADOS: 4to Primaria, 5to Primaria, 6to Primaria, 1ero Básico, 2do Básico, 3ero Básico, 4to Bachillerato, 5to Bachillerato.
Para 3ero Básico y 5to Bachillerato también existe: Mineduc - Lenguaje y Mineduc - Matemática.

ALCANCE FORMATIVO:
Puedes apoyar en hábitos de estudio, disciplina, familia, valores y convivencia usando los documentos de configuración oficiales. Recomienda videos de Eduardo Montano con link directo cuando aplique.
Si el tema toca salud mental, crisis emocional, violencia, abuso, autolesión u otro riesgo personal, recomienda hablar con un adulto responsable.

Cada interacción debe lograr al menos una de estas cosas: el alumno entiende mejor, practica, avanza o sabe qué hacer después.`

const cacheContenido = new Map<string, { contenido: string; archivo: string; timestamp: number }>()
const cacheConfig    = new Map<string, { contenido: string; timestamp: number }>()
const CACHE_TTL      = 1000 * 60 * 1

const COLEGIOS_SP: Record<string, string> = {
  'escolaris':       'Escolaris',
  'colegio-montano': 'Colegio Montano',
}

const DOCS_CONFIG = [
  'Prompt Principal - Agente Alumno.docx',
  'Politica Pedagogica Oficial - Agente Alumno.docx',
  'Documento Maestro - Agente Alumno.docx',
  'Instrucciones SharePoint - Agente Alumno.docx',
  'Especificacion Tecnica - Agente Alumno.docx',
  'Videos Español.docx',
  'Videos Inglés.docx',
]

// Palabras clave para detectar temas formativos vs crisis
const PALABRAS_CRISIS = [
  'me quiero matar', 'suicidar', 'quitarme la vida', 'hacerme daño',
  'autolesion', 'no quiero vivir', 'me voy a matar', 'quiero morir',
  'abuso sexual', 'me violaron', 'me toca inapropiadamente'
]

const PALABRAS_FORMATIVAS = [
  'mi papá', 'mi mamá', 'mis padres', 'mi familia', 'pelea', 'problema en casa',
  'me siento mal', 'triste', 'solo', 'amigos', 'bullying', 'me molestan',
  'valores', 'convivencia', 'disciplina', 'hábitos', 'motivación',
  'me pega', 'me golpea', 'me grita', 'me insulta', 'violencia en casa',
  'mis padres pelean', 'me siento solo', 'no tengo amigos', 'me hacen menos',
  'me discriminan', 'me ignoran', 'no me entienden', 'estoy deprimido',
  'me preocupa', 'tengo miedo', 'no sé qué hacer', 'necesito ayuda',
  'me siento triste', 'estoy triste', 'muy triste', 'problema familiar',
  'no me quieren', 'me castigan', 'me regañan', 'mis papás'
]

function detectarTipoPregunta(pregunta: string): 'crisis' | 'formativa' | 'academica' {
  const p = pregunta.toLowerCase()
  if (PALABRAS_CRISIS.some(w => p.includes(w))) return 'crisis'
  if (PALABRAS_FORMATIVAS.some(w => p.includes(w))) return 'formativa'
  return 'academica'
}

function esSaludo(pregunta: string): boolean {
  const saludos = ['hola', 'buenos días', 'buenas tardes', 'buenas noches', 'hi', 'hello', 'buenas', 'hey']
  const p = pregunta.toLowerCase().trim()
  return saludos.some(s => p === s || p.startsWith(s + ' ') || p.startsWith(s + ','))
}

async function getToken(): Promise<string | null> {
  try {
    const res = await fetch(
      `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id:     process.env.AZURE_CLIENT_ID!,
          client_secret: process.env.AZURE_CLIENT_SECRET!,
          scope:         'https://graph.microsoft.com/.default',
          grant_type:    'client_credentials',
        }),
      }
    )
    const data = await res.json()
    return data.access_token || null
  } catch { return null }
}

async function listarArchivos(driveId: string, token: string, ...segs: string[]) {
  const ruta = segs.map(s => encodeURIComponent(s)).join('/')
  const url  = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${ruta}:/children`
  const res  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return []
  const data = await res.json()
  return (data.value || []).filter((a: {name:string}) => a.name.endsWith('.docx') && !a.name.startsWith('~$'))
}

async function extraerTexto(url: string): Promise<string> {
  const r   = await fetch(url)
  const buf = await r.arrayBuffer()
  const m   = await import('mammoth')
  const { value } = await m.extractRawText({ buffer: Buffer.from(buf) })
  return value
}

// Índice de documentos: cacheKey -> [{nombre, tema, downloadUrl}]
const indiceDocumentos = new Map<string, { nombre: string; tema: string; downloadUrl: string }[]>()

async function construirIndice(driveId: string, token: string, colegioSP: string, grado: string, materia: string) {
  const idxKey  = `idx/${colegioSP}/${grado}/${materia}`
  const cached  = indiceDocumentos.get(idxKey)
  if (cached) return cached

  console.log(`Construyendo índice: ${colegioSP}/${grado}/${materia}`)
  const archivos = await listarArchivos(driveId, token, 'Owlaris', colegioSP, grado, materia)
  if (archivos.length === 0) return []

  const indice: { nombre: string; tema: string; downloadUrl: string }[] = []

  // Leer primeros 300 chars de cada doc para extraer el tema
  await Promise.all(archivos.map(async (archivo: { name: string; '@microsoft.graph.downloadUrl': string }) => {
    try {
      const r   = await fetch(archivo['@microsoft.graph.downloadUrl'])
      const buf = await r.arrayBuffer()
      const m   = await import('mammoth')
      const { value } = await m.extractRawText({ buffer: Buffer.from(buf) })
      const tema = value.substring(0, 300).trim()
      indice.push({ nombre: archivo.name, tema, downloadUrl: archivo['@microsoft.graph.downloadUrl'] })
    } catch { 
      indice.push({ nombre: archivo.name, tema: archivo.name, downloadUrl: archivo['@microsoft.graph.downloadUrl'] })
    }
  }))

  indiceDocumentos.set(idxKey, indice)
  console.log(`✅ Índice construido: ${indice.length} documentos`)
  
  // Limpiar índice después de 30 min
  setTimeout(() => indiceDocumentos.delete(idxKey), CACHE_TTL)
  
  return indice
}

async function buscarContenido(colegio_slug: string, grado: string, materia: string, pregunta: string) {
  const token    = await getToken()
  if (!token) return { contenido: '', archivo: null }

  const driveId   = process.env.SHAREPOINT_DRIVE_ID!
  const colegioSP = COLEGIOS_SP[colegio_slug] || colegio_slug

  // Construir índice con temas reales de cada documento
  const indice = await construirIndice(driveId, token, colegioSP, grado, materia)
  if (indice.length === 0) {
    console.log(`❌ No encontrado: ${colegioSP}/${grado}/${materia}`)
    return { contenido: '', archivo: null }
  }

  // Elegir el documento más relevante comparando con el tema extraído
  const preguntaLower = pregunta.toLowerCase()
  const palabras = preguntaLower.split(/\s+/).filter(p => p.length > 3)

  let mejorPuntaje = -1
  let mejorDoc = indice[0]

  for (const doc of indice) {
    const temaLower = doc.tema.toLowerCase()
    let puntaje = 0
    for (const palabra of palabras) {
      if (temaLower.includes(palabra)) puntaje += 2
      if (doc.nombre.toLowerCase().includes(palabra)) puntaje += 1
    }
    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje
      mejorDoc = doc
    }
  }

  console.log(`✅ Elegido: ${mejorDoc.nombre} (puntaje: ${mejorPuntaje})`)

  // Leer contenido completo del documento elegido
  const cacheKey = `${colegioSP}/${grado}/${materia}/${mejorDoc.nombre}`
  const cached   = cacheContenido.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return { contenido: cached.contenido, archivo: cached.archivo }
  }

  const contenido = await extraerTexto(mejorDoc.downloadUrl)
  cacheContenido.set(cacheKey, { contenido, archivo: mejorDoc.nombre, timestamp: Date.now() })
  return { contenido, archivo: mejorDoc.nombre }
}

async function leerConfig(): Promise<string> {
  const cached = cacheConfig.get('config')
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.contenido

  const token = await getToken()
  if (!token) return ''

  const driveId = process.env.SHAREPOINT_DRIVE_ID!
  let contenido = ''

  for (const doc of DOCS_CONFIG) {
    try {
      const rutaDoc = `Owlaris/_Configuracion/${doc}`
      const urlEncoded = rutaDoc.split('/').map((s: string) => encodeURIComponent(s)).join('/')
      const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${urlEncoded}`
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) { console.log(`Config no encontrada: ${doc}`); continue }
      const data = await res.json()
      if (!data['@microsoft.graph.downloadUrl']) continue
      const texto = await extraerTexto(data['@microsoft.graph.downloadUrl'])
      contenido  += `\n\n=== ${doc} ===\n${texto.substring(0, 2000)}`
      console.log(`✅ Config: ${doc}`)
    } catch (e) { console.log(`Error config ${doc}:`, e) }
  }

  cacheConfig.set('config', { contenido, timestamp: Date.now() })
  return contenido
}

function elegirArchivo(
  archivos: { name: string; '@microsoft.graph.downloadUrl': string }[],
  pregunta: string
) {
  if (archivos.length === 0) return null
  if (archivos.length === 1) return archivos[0]
  const palabras = pregunta.toLowerCase().split(/\s+/).filter(p => p.length > 3)
  let mejor = -1, elegido = archivos[0]
  for (const a of archivos) {
    let p = 0
    for (const w of palabras) if (a.name.toLowerCase().includes(w)) p++
    if (p > mejor) { mejor = p; elegido = a }
  }
  return elegido
}

function detectarCopia(pregunta: string): boolean {
  return ['hazme la tarea','dame las respuestas','dame la respuesta','solo dime qué va','resuelve todo']
    .some(p => pregunta.toLowerCase().includes(p))
}

async function registrarPendiente(
  supabase: ReturnType<typeof import('@/lib/supabase/server').createClient>,
  perfil: { colegio_id: string; grado: string | null },
  materia: { nombre: string },
  pregunta: string
) {
  const tema = pregunta.substring(0, 150)
  const { data: existente } = await supabase.from('pendientes')
    .select('id, veces_solicitado')
    .eq('colegio_id', perfil.colegio_id)
    .eq('materia', materia.nombre)
    .eq('tema_solicitado', tema)
    .single()

  if (existente) {
    await supabase.from('pendientes').update({ veces_solicitado: existente.veces_solicitado + 1 }).eq('id', existente.id)
  } else {
    await supabase.from('pendientes').insert({
      colegio_id: perfil.colegio_id, grado: perfil.grado || '',
      materia: materia.nombre, tema_solicitado: tema, veces_solicitado: 1, resuelto: false,
    })
  }
}

export async function POST(req: NextRequest) {
  try {
    const OpenAI = (await import('openai')).default
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { pregunta, materia_id, grado_override, historial } = await req.json()
    if (!pregunta?.trim()) return NextResponse.json({ error: 'Pregunta vacía' }, { status: 400 })

    const { data: perfil } = await supabase
      .from('usuarios').select('*, colegio:colegios(*)').eq('id', user.id).single()
    if (!perfil) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })

    const { data: configs } = await supabase
      .from('configuracion').select('clave, valor').eq('colegio_id', perfil.colegio_id)
    const cfg: Record<string, string> = {}
    configs?.forEach(c => { cfg[c.clave] = c.valor })

    if (cfg.modo_mantenimiento === 'true') {
      return NextResponse.json({ error: 'El tutor está en mantenimiento.' }, { status: 503 })
    }

    const limite = parseInt(cfg.limite_preguntas_diarias || '999')
    if (limite < 999) {
      const hoy = new Date().toISOString().split('T')[0]
      const { count } = await supabase.from('interacciones')
        .select('*', { count: 'exact', head: true })
        .eq('usuario_id', user.id).gte('creado_en', `${hoy}T00:00:00`)
      if ((count || 0) >= limite) {
        return NextResponse.json({ error: `Limite de ${limite} preguntas alcanzado.` }, { status: 429 })
      }
    }

    const { data: materia } = await supabase.from('materias').select('*').eq('id', materia_id).single()
    const gradoEfectivo = grado_override || perfil.grado
    const colegioSlug   = perfil.colegio?.sharepoint_folder || perfil.colegio?.slug

    // Detectar tipo de pregunta
    const tipoPregunta = detectarTipoPregunta(pregunta)
    const esBienvenida = esSaludo(pregunta) && (!historial || historial.length === 0)

    let contenidoCurricular = ''
    let documentoFuente     = null

    // Solo buscar contenido académico si la pregunta es académica y no es saludo inicial
    if (tipoPregunta === 'academica' && !esBienvenida) {
      const result = await buscarContenido(colegioSlug, gradoEfectivo, materia?.nombre || '', pregunta)
      contenidoCurricular = result.contenido
      documentoFuente     = result.archivo
    }

    // Siempre leer docs de configuración (tienen videos y política pedagógica)
    const docsConfig = await leerConfig()
    const promptBase = cfg.prompt_personalizado || PROMPT_BASE

    // Contexto según tipo de pregunta
    let contextoContenido = ''

    if (esBienvenida) {
      contextoContenido = `El alumno acaba de saludar. Responde con bienvenida personalizada y pregunta de diagnóstico. NO muestres lista de temas todavía.`
    } else if (tipoPregunta === 'crisis') {
      contextoContenido = `ALERTA: El alumno toca un tema de crisis personal. NO busques documentos académicos. Responde con empatía breve y recomienda hablar con un adulto responsable, orientador o profesional. No profundices.`
    } else if (tipoPregunta === 'formativa') {
      contextoContenido = `El alumno toca un tema formativo (familia, valores, convivencia). Usa los documentos de configuración para orientarlo. Recomienda videos de Eduardo Montano si aplica.`
    } else if (contenidoCurricular) {
      contextoContenido = `CONTENIDO ACADEMICO (fuente principal):\n---\n${contenidoCurricular.substring(0, 3000)}\n---`
    } else {
      contextoContenido = `No se encontró contenido en SharePoint para ${gradoEfectivo} / ${materia?.nombre}. Responde con conocimiento general apropiado e indica consultar al profesor.`
    }

    const systemPrompt = `${promptBase}

CONTEXTO DEL ALUMNO:
- Nombre: ${perfil.nombre_completo.split(' ')[0]}
- Colegio: ${perfil.colegio?.nombre}
- Grado: ${gradoEfectivo}
- Materia seleccionada: ${materia?.nombre || 'General'}

${docsConfig ? `DOCUMENTOS DE CONFIGURACION OFICIAL:\n${docsConfig}\n` : ''}

${contextoContenido}`

    const mensajesOpenAI: { role: 'user' | 'assistant' | 'system'; content: string }[] = [
      { role: 'system', content: systemPrompt },
    ]

    if (historial?.length > 0) {
      historial.forEach((msg: { rol: string; contenido: string }) => {
        mensajesOpenAI.push({ role: msg.rol === 'usuario' ? 'user' : 'assistant', content: msg.contenido })
      })
    }
    mensajesOpenAI.push({ role: 'user', content: pregunta })

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', messages: mensajesOpenAI, max_tokens: 700, temperature: 0.7,
    })

    let respuesta = completion.choices[0].message.content || 'No pude generar una respuesta.'
    
    // Si es tema formativo, agregar link de video de Eduardo al final
    if (tipoPregunta === 'formativa') {
      respuesta += '\n\nTe comparto este recurso de Eduardo Montano que puede ayudarte: https://www.youtube.com/c/EduardoMontano'
    }
    const tokensUsados = completion.usage?.total_tokens || 0
    const costoUSD     = tokensUsados * 0.00000015

    await supabase.from('interacciones').insert({
      usuario_id: user.id, colegio_id: perfil.colegio_id, materia_id: materia_id || null,
      grado: gradoEfectivo, tema_detectado: pregunta.substring(0, 100),
      pregunta, respuesta, tokens_usados: tokensUsados, costo_usd: costoUSD,
      modelo_usado: 'gpt-4o-mini', documento_fuente: documentoFuente,
      sospecha_copia: detectarCopia(pregunta),
    })

    if (tipoPregunta === 'academica' && !contenidoCurricular && materia) {
      await registrarPendiente(supabase, perfil, materia, pregunta)
    }

    return NextResponse.json({ respuesta, tokens: tokensUsados, documento_fuente: documentoFuente })

  } catch (err) {
    console.error('Error /api/preguntar:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
