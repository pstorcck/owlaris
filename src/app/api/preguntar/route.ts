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

OPCIÓN MÚLTIPLE — REGLA CRÍTICA:
Cuando plantees una pregunta de opción múltiple, SIEMPRE recuerda exactamente qué valor corresponde a cada letra.
Cuando el alumno responda con una letra (A, B, C o D):
1. Busca en tu pregunta anterior qué valor tiene esa letra.
2. Compara ese valor con la respuesta correcta.
3. Si el valor de la letra ES la respuesta correcta → di "Correcto" de inmediato.
4. Si el valor de la letra NO ES la respuesta correcta → di "Incorrecto" y explica.

Ejemplo: Si planteaste A)12 B)15 C)20 D)25 y la respuesta es 12, y el alumno dice "A" → es CORRECTO porque A=12.
NUNCA digas que está mal si la letra que eligió corresponde al valor correcto.

FORMATO: Nunca uses notación LaTeX como \( \) o \[ \]. Escribe ecuaciones en texto plano. Ejemplo: "x + 8 = 20" no "\( x + 8 = 20 \)".

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
const CARPETA_COMPARTIDA = 'Colegio Montano y Escolaris'

// Normalizar grado desde texto libre del alumno
function normalizarGrado(texto: string): string {
  const t = texto.toLowerCase()
    .replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i').replace(/ó/g,'o').replace(/ú/g,'u')
    .replace(/°/g,'').replace(/\.$/g,'').trim()

  if (/4.*prim|cuarto.*prim/i.test(t)) return '4to Primaria'
  if (/5.*prim|quinto.*prim/i.test(t)) return '5to Primaria'
  if (/6.*prim|sexto.*prim/i.test(t)) return '6to Primaria'
  if (/1.*bas|primer.*bas|primero.*bas/i.test(t)) return '1ero Básico'
  if (/2.*bas|segundo.*bas/i.test(t)) return '2do Básico'
  if (/3.*bas|tercer.*bas/i.test(t)) return '3ero Básico'
  if (/4.*bach|cuarto.*bach/i.test(t)) return '4to Bachillerato'
  if (/5.*bach|quinto.*bach/i.test(t)) return '5to Bachillerato'
  return ''
}

// Normalizar materia desde texto libre
function normalizarMateria(texto: string, esOlimpiadas = false): string {
  const t = texto.toLowerCase()
    .replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i').replace(/ó/g,'o').replace(/ú/g,'u')

  // Detectar si es olimpiadas primero
  if (/olimp.*mat/i.test(t)) return 'Olimpiadas - Matemática'
  if (/olimp.*biol/i.test(t)) return 'Olimpiadas - Biología'
  if (/olimp.*fis/i.test(t)) return 'Olimpiadas - Física'
  if (/olimp.*quim/i.test(t)) return 'Olimpiadas - Química'
  if (/olimp.*cien/i.test(t)) return 'Olimpiadas - Ciencias Naturales'
  if (/olimp/i.test(t)) return '__OLIMPIADAS__'  // señal para preguntar materia

  // Si ya está en modo olimpiadas, prefijar
  if (esOlimpiadas) {
    if (/matem/i.test(t)) return 'Olimpiadas - Matemática'
    if (/biol/i.test(t)) return 'Olimpiadas - Biología'
    if (/fis/i.test(t)) return 'Olimpiadas - Física'
    if (/quim/i.test(t)) return 'Olimpiadas - Química'
    if (/cien/i.test(t)) return 'Olimpiadas - Ciencias Naturales'
  }

  if (/mineduc.*leng|leng.*mineduc/i.test(t)) return 'Mineduc - Lenguaje'
  if (/mineduc.*mat|mat.*mineduc/i.test(t)) return 'Mineduc - Matemática'
  if (/mineduc/i.test(t)) return 'Mineduc - Lenguaje'
  if (/matem|math/i.test(t)) return 'Matemática'
  if (/leng|espan|español|castell|spanish/i.test(t)) return 'Español'
  if (/ingles|english|inglés/i.test(t)) return 'Inglés'
  if (/biol|biology/i.test(t)) return 'Biología'
  if (/fis|fisica|physics/i.test(t)) return 'Física'
  if (/quim|chemistry/i.test(t)) return 'Química'
  if (/hist|history/i.test(t)) return 'Historia'
  if (/cien.*nat|natural science|natural/i.test(t)) return 'Ciencias Naturales'
  return texto.trim()
}

// Validar respuesta de opción múltiple comparando con el historial
function validarOpcionMultiple(preguntaAlumno: string, historial: {rol:string; contenido:string}[]): string | null {
  // Solo aplica si el alumno respondió con una sola letra
  const respLetra = preguntaAlumno.trim().toUpperCase()
  if (!/^[ABCD]$/.test(respLetra)) return null

  // Buscar la última pregunta del tutor con opciones A) B) C) D)
  const mensajesTutor = historial.filter(m => m.rol === 'asistente')
  const ultimoMensaje = mensajesTutor[mensajesTutor.length - 1]
  if (!ultimoMensaje) return null

  const texto = ultimoMensaje.contenido

  // Extraer opciones del mensaje anterior
  const opcionRegex = new RegExp('[A-D][).]\\s*([^\\n]+)', 'g')
  const opciones: Record<string, string> = {}
  let match
  while ((match = opcionRegex.exec(texto)) !== null) {
    const letra = match[0][0].toUpperCase()
    opciones[letra] = match[1].trim()
  }

  if (Object.keys(opciones).length < 2) return null

  const respCorrectaRegex = new RegExp('respuesta\\s+(?:correcta\\s+)?(?:es\\s+)?[lael]*\\s*(?:opci[oó]n\\s+)?([A-D])', 'gi')
  const matchCorrecta = respCorrectaRegex.exec(texto)
  
  if (!matchCorrecta) return null
  
  const letraCorrecta = matchCorrecta[1].toUpperCase()
  const esCorrecta = respLetra === letraCorrecta

  if (esCorrecta) {
    return `VALIDACIÓN_CORRECTA: El alumno eligió ${respLetra}) ${opciones[respLetra] || ''} que ES la respuesta correcta. Confirma que es correcto y pide el proceso.`
  } else {
    return `VALIDACIÓN_INCORRECTA: El alumno eligió ${respLetra}) ${opciones[respLetra] || ''} pero la respuesta correcta es ${letraCorrecta}) ${opciones[letraCorrecta] || ''}. Explica por qué es incorrecto.`
  }
}

// Estados del onboarding
type EstadoChat = 'esperando_nombre' | 'esperando_grado' | 'esperando_materia' | 'activo'

// Mapeo de grados del sistema a nombres en carpetas de Olimpiadas
const GRADOS_OLIMPIADAS: Record<string, string> = {
  '1ero Básico':        'Primero Basico',
  '2do Básico':         'Segundo Basico',
  '3ero Básico':        'Tercero Basico',
  '4to Bachillerato':   'Diversificado',
  '5to Bachillerato':   'Diversificado',
  '4to Bachillerato en Ciencias y Letras':            'Diversificado',
  '4to Bachillerato en Computación y Pre Ingeniería': 'Diversificado',
  '4to Bachillerato en Mercadotecnia':                'Diversificado',
  '5to Bachillerato en Ciencias y Letras':            'Diversificado',
  '5to Bachillerato en Computación y Pre Ingeniería': 'Diversificado',
  '5to Bachillerato en Mercadotecnia':                'Diversificado',
  '4to Primaria':       'Primaria',
  '5to Primaria':       'Primaria',
  '6to Primaria':       'Primaria',
}

// Mapeo de temas a materias
const TEMAS_POR_MATERIA: Record<string, string[]> = {
  'Matemática':       ['aritmética','aritmetica','algebra','álgebra','geometría','geometria','fracciones','ecuaciones','trigonometría','trigonometria','estadística','estadistica','probabilidad','porcentajes','decimales','números','numeros','matrices','funciones','polinomios','logaritmos'],
  'Física':           ['cinemática','cinematica','dinámica','dinamica','fuerza','movimiento','velocidad','aceleración','aceleracion','energía','energia','trabajo','calor','temperatura','ondas','luz','electricidad','magnetismo','gravedad','óptica','optica'],
  'Química':          ['átomo','atomo','molécula','molecula','enlace','reacción','reaccion','tabla periódica','tabla periodica','ácido','acido','base','solución','solucion','oxidación','oxidacion','elemento','compuesto','estequiometría'],
  'Biología':         ['célula','celula','fotosíntesis','fotosintesis','adn','genética','genetica','evolución','evolucion','ecosistema','organismo','proteína','proteina','mitosis','meiosis','respiración celular'],
  'Historia':         ['guerra','revolución','revolucion','independencia','civilización','civilizacion','colonia','conquista','maya','azteca','inca','república','republica','democracia','feudalismo'],
  'Español':          ['gramática','gramatica','sintaxis','ortografía','ortografia','redacción','redaccion','literatura','poesía','poesia','narración','narracion','verbo','sustantivo','adjetivo','párrafo','parrafo'],
  'Inglés':           ['vocabulary','grammar','verb','tense','sentence','reading','writing','speaking','listening','english'],
  'Ciencias Naturales':['planta','animal','ecosistema','medio ambiente','naturaleza','suelo','agua','aire','clima','biodiversidad','nutrición','nutricion'],
}

function detectarMateriaDesdeTexto(texto: string): string | null {
  const t = texto.toLowerCase()
    .replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i').replace(/ó/g,'o').replace(/ú/g,'u')
  for (const [materia, temas] of Object.entries(TEMAS_POR_MATERIA)) {
    for (const tema of temas) {
      const temaNorm = tema.replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i').replace(/ó/g,'o').replace(/ú/g,'u')
      if (t.includes(temaNorm)) return materia
    }
  }
  return null
}

// Mapeo de materias Olimpiadas a carpetas
const MATERIAS_OLIMPIADAS: Record<string, string> = {
  'Olimpiadas - Matemática':        'Matematica',
  'Olimpiadas - Biología':          'Biologia',
  'Olimpiadas - Física':            'Fisica',
  'Olimpiadas - Química':           'Quimica',
  'Olimpiadas - Ciencias Naturales':'Ciencias Naturales',
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

async function construirIndice(driveId: string, token: string, ...segs: string[]) {
  const idxKey  = 'idx/' + segs.join('/')
  const cached  = indiceDocumentos.get(idxKey)
  if (cached) return cached

  console.log('Construyendo indice: ' + segs.join('/'))
  const archivos = await listarArchivos(driveId, token, ...segs)
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

  let indice: { nombre: string; tema: string; downloadUrl: string }[] = []

  // Si es materia de Olimpiadas, buscar directamente en Colegios Guatemala
  if (materia.startsWith('Olimpiadas')) {
    const carpetaMateria = MATERIAS_OLIMPIADAS[materia] || materia.replace('Olimpiadas - ', '')
    const carpetaGrado   = GRADOS_OLIMPIADAS[grado] || grado

    // Buscar en carpeta compartida con grado específico
    indice = await construirIndice(driveId, token, 'Owlaris', CARPETA_COMPARTIDA, 'Olimpiadas de Ciencias', carpetaMateria, carpetaGrado)
    if (indice.length === 0) {
      indice = await construirIndice(driveId, token, 'Owlaris', CARPETA_COMPARTIDA, 'Olimpiadas de Ciencias', carpetaMateria)
    }
    console.log('Olimpiadas: ' + carpetaMateria + '/' + carpetaGrado + ' -> ' + indice.length + ' docs')

  } else {
    const buscarEnGrado = async (raiz: string, gradoB: string, materiaB: string) => {
      let idx = await construirIndice(driveId, token, raiz, gradoB, materiaB)
      if (idx.length > 0) return idx
      const url = 'https://graph.microsoft.com/v1.0/drives/' + driveId + '/root:/' + encodeURIComponent(raiz) + '/' + encodeURIComponent(gradoB) + ':/children'
      const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } })
      if (!res.ok) return []
      const data = await res.json()
      const carpetas: string[] = (data.value || []).filter((i: {folder?:unknown}) => i.folder).map((i: {name:string}) => i.name)
      const mLower = materiaB.toLowerCase().replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i').replace(/ó/g,'o').replace(/ú/g,'u')
      const match = carpetas.find(cp => {
        const cl = cp.toLowerCase().replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i').replace(/ó/g,'o').replace(/ú/g,'u')
        return cl.includes(mLower) || mLower.includes(cl)
      })
      if (match) idx = await construirIndice(driveId, token, raiz, gradoB, match)
      return idx
    }

    // 1. Buscar en carpeta compartida
    indice = await buscarEnGrado('Owlaris/' + CARPETA_COMPARTIDA, grado, materia)

    // 2. Si no hay, buscar en carpeta del colegio
    if (indice.length === 0) {
      indice = await buscarEnGrado('Owlaris/' + colegioSP, grado, materia)
    }

    // 3. Si no hay, buscar en Mineduc
    if (indice.length === 0) {
      indice = await construirIndice(driveId, token, 'Owlaris', CARPETA_COMPARTIDA, 'Preparación pruebas nacionales', 'Mineduc', grado, materia)
    }
    if (indice.length === 0) {
      indice = await construirIndice(driveId, token, 'Owlaris', CARPETA_COMPARTIDA, 'Preparación pruebas nacionales', 'Mineduc', materia)
    }
  }

  if (indice.length === 0) {
    console.log('No encontrado: ' + colegioSP + '/' + grado + '/' + materia)
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

    const body = await req.json()
    const { pregunta, historial } = body
    const materia_id      = body.materia_id || body.materia_detectada || ''
    const userId: string  = body.user_id || ''
    const idiomaIngles: boolean = body.idioma_ingles || false
    console.log('userId recibido:', userId)
    const grado_override = body.grado_override || body.grado_detectado || ''
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

    // Buscar materia por ID o por nombre
    const { data: materiaPorId } = await supabase.from('materias').select('*').eq('id', materia_id).single()
    const { data: materiaPorNombre } = !materiaPorId && materia_id
      ? await supabase.from('materias').select('*').eq('nombre', materia_id).eq('colegio_id', perfil.colegio_id).single()
      : { data: null }
    const materia = materiaPorId || materiaPorNombre
    const gradoEfectivo = grado_override || perfil.grado
    const colegioSlug   = perfil.colegio?.sharepoint_folder || perfil.colegio?.slug

    // Detectar tipo de pregunta
    // ── ONBOARDING ──────────────────────────────────────────────────
    const estado: string = body.estado || 'activo'
    const nombreAlumno: string = body.nombre_alumno || ''
    const gradoAlumno: string  = body.grado_override || ''

    if (estado === 'esperando_confirmacion_grado') {
      const resp = pregunta.toLowerCase().trim()
      const esAfirmativo = /^(si|sí|yes|s|claro|correcto|asi|así|efectivamente)/.test(resp)
      if (esAfirmativo) {
        // Asegurar que el grado esté guardado
        if (userId && gradoAlumno) {
          await supabase.from('usuarios').update({ grado: gradoAlumno }).eq('id', userId)
          console.log('Grado confirmado y guardado:', gradoAlumno, 'para userId:', userId)
        }
        return NextResponse.json({
          respuesta: idiomaIngles ? 'Perfect. What subject do you want to study today?' : 'Perfecto. ¿Qué materia quieres estudiar hoy?',
          nuevo_estado: 'esperando_materia',
          nombre_alumno: nombreAlumno,
          grado_detectado: gradoAlumno,
          tokens: 0,
        })
      } else {
        return NextResponse.json({
          respuesta: idiomaIngles ? 'No problem. What grade are you in?' : 'Sin problema. ¿En qué grado estás ahora?',
          nuevo_estado: 'esperando_grado',
          nombre_alumno: nombreAlumno,
          tokens: 0,
        })
      }
    }

    if (estado === 'esperando_nombre') {
      const nombre = pregunta.trim().split(' ')[0]
      return NextResponse.json({
        respuesta: idiomaIngles ? 'Hi, ' + nombre + '! Great to have you here. What grade are you in?' : '¡Hola, ' + nombre + '! Qué bueno tenerte aquí. ¿En qué grado estás?',
        nuevo_estado: 'esperando_grado',
        nombre_alumno: nombre,
        tokens: 0,
      })
    }

    if (estado === 'esperando_grado') {
      const gradoDetectado = normalizarGrado(pregunta)
      if (!gradoDetectado) {
        return NextResponse.json({
          respuesta: 'No reconocí ese grado. ¿Puedes decirme tu grado? Por ejemplo: "4to Primaria", "3ero Básico", "5to Bachillerato"...',
          nuevo_estado: 'esperando_grado',
          nombre_alumno: nombreAlumno,
          tokens: 0,
        })
      }
      // Guardar grado en Supabase
      if (userId) await supabase.from('usuarios').update({ grado: gradoDetectado }).eq('id', userId)

      return NextResponse.json({
        respuesta: idiomaIngles ? 'Perfect, ' + nombreAlumno + '. What subject do you want to study today?' : 'Perfecto, ' + nombreAlumno + '. ¿Qué materia quieres estudiar hoy?',
        nuevo_estado: 'esperando_materia',
        nombre_alumno: nombreAlumno,
        grado_detectado: gradoDetectado,
        tokens: 0,
      })
    }

    if (estado === 'esperando_materia') {
      const materiaDetectada = normalizarMateria(pregunta)
      const gradoMostrar = gradoAlumno || body.grado_detectado || ''
      if (materiaDetectada === '__OLIMPIADAS__') {
        return NextResponse.json({
          respuesta: 'Olimpiadas, perfecto. ¿De cuál materia? Matemática, Biología, Física, Química o Ciencias Naturales.',
          nuevo_estado: 'esperando_materia_olimpiadas',
          nombre_alumno: nombreAlumno,
          grado_detectado: gradoMostrar,
          tokens: 0,
        })
      }
      return NextResponse.json({
        respuesta: idiomaIngles ? 'Ok, ' + materiaDetectada + '. Do you have a specific question or would you like me to suggest a topic?' : 'Ok, ' + materiaDetectada + '. ¿Tienes una duda específica o quieres que te proponga un tema?',
        nuevo_estado: 'activo',
        nombre_alumno: nombreAlumno,
        grado_detectado: gradoAlumno,
        materia_detectada: materiaDetectada,
        tokens: 0,
      })
    }

    if (estado === 'esperando_materia_olimpiadas') {
      const materiaDetectada = normalizarMateria(pregunta, true)
      return NextResponse.json({
        respuesta: idiomaIngles ? 'Ok, ' + materiaDetectada + '. Do you have a specific question or would you like me to suggest a topic?' : 'Ok, ' + materiaDetectada + '. ¿Tienes una duda específica o quieres que te proponga un tema?',
        nuevo_estado: 'activo',
        nombre_alumno: nombreAlumno,
        grado_detectado: gradoAlumno,
        materia_detectada: materiaDetectada,
        tokens: 0,
      })
    }
    // Detectar si el alumno menciona un tema de otra materia
    if (estado === 'activo' && materia_id) {
      const materiaDetectada = detectarMateriaDesdeTexto(pregunta)
      if (materiaDetectada && materiaDetectada !== materia_id) {
        return NextResponse.json({
          respuesta: '"' + pregunta.trim() + '" es un tema de ' + materiaDetectada + '. ¿Quieres que cambiemos a ' + materiaDetectada + '?',
          nuevo_estado: 'esperando_confirmacion_cambio_materia',
          materia_sugerida: materiaDetectada,
          tokens: 0,
        })
      }
    }

    if (estado === 'esperando_confirmacion_cambio_materia') {
      const esAfirmativo = /^(si|sí|yes|s|claro|correcto|dale|ok|bueno|perfecto|va|vamos)/.test(pregunta.toLowerCase().trim())
      const materiaSugerida = body.materia_sugerida || ''
      if (esAfirmativo && materiaSugerida) {
        Array.from(cacheContenido.keys()).forEach(key => { if (key.includes(materia_id)) cacheContenido.delete(key) })
        Array.from(indiceDocumentos.keys()).forEach(key => { if (key.includes(materia_id)) indiceDocumentos.delete(key) })
        return NextResponse.json({
          respuesta: 'Perfecto, cambiamos a ' + materiaSugerida + '. ¿Tienes una duda específica o quieres que te proponga un tema?',
          nuevo_estado: 'activo',
          materia_detectada: materiaSugerida,
          tokens: 0,
        })
      } else {
        return NextResponse.json({
          respuesta: 'Sin problema, seguimos con ' + materia_id + '. ¿En qué te puedo ayudar?',
          nuevo_estado: 'activo',
          tokens: 0,
        })
      }
    }

    // Detectar cambio de materia mid-sesión
    if (estado === 'activo') {
      // Solo detectar cambio si menciona explícitamente una materia conocida
      const MATERIAS_KEYWORDS = ['matemática','matematica','física','fisica','química','quimica','biología','biologia','historia','español','espanol','inglés','ingles','ciencias naturales','mineduc','olimpiadas']
      const preguntaLow = pregunta.toLowerCase()
      const cambioExplicito = /(?:quiero estudiar|cambia(?:mos)? a|ahora estudiemos|vamos con)\s+(.+)/i.exec(pregunta)
      const mencionaMateria = MATERIAS_KEYWORDS.some(m => preguntaLow.includes(m))
      
      if (cambioExplicito && mencionaMateria) {
        const textoMateria = cambioExplicito[1].trim()
        const nuevaMateria = normalizarMateria(textoMateria)
        if (nuevaMateria && nuevaMateria !== materia_id && !nuevaMateria.startsWith('__')) {
          console.log('Cambio materia:', materia_id, '->', nuevaMateria)
          // Limpiar caché de la materia anterior
          Array.from(cacheContenido.keys()).forEach(key => { if (key.includes(materia_id)) cacheContenido.delete(key) })
          Array.from(indiceDocumentos.keys()).forEach(key => { if (key.includes(materia_id)) indiceDocumentos.delete(key) })
          return NextResponse.json({
            respuesta: 'Claro, cambiamos a ' + nuevaMateria + '. ¿Tienes una duda específica o quieres que te proponga un tema?',
            nuevo_estado: 'activo',
            materia_detectada: nuevaMateria,
            tokens: 0,
          })
        }
      }
    }

    // Detectar cambio de grado mid-sesión
    if (estado === 'activo') {
      const cambioGradoRegex = /ahora (estoy en|curso|voy a|soy de)\s+(.+)|cambi[eé] (a|de) grado[:\s]*(.+)|estoy en\s+(.+(?:grado|b[aá]sico|primaria|bachillerato))/i
      const cambioGradoMatch = cambioGradoRegex.exec(pregunta)
      if (cambioGradoMatch) {
        const textoGrado = cambioGradoMatch[2] || cambioGradoMatch[4] || cambioGradoMatch[5] || ''
        const nuevoGrado = normalizarGrado(textoGrado.trim())
        if (nuevoGrado) {
              if (userId) await supabase.from('usuarios').update({ grado: nuevoGrado }).eq('id', userId)
          return NextResponse.json({
            respuesta: 'Perfecto, actualicé tu grado a ' + nuevoGrado + '. ¿Qué materia quieres estudiar?',
            nuevo_estado: 'esperando_materia',
            grado_detectado: nuevoGrado,
            tokens: 0,
          })
        }
      }
    }

    // ── FIN ONBOARDING ───────────────────────────────────────────────

    // Validar opción múltiple antes de llamar a OpenAI
    const validacionOM = validarOpcionMultiple(pregunta, historial || [])

    const tipoPregunta = detectarTipoPregunta(pregunta)
    const esBienvenida = esSaludo(pregunta) && (!historial || historial.length === 0)

    let contenidoCurricular = ''
    let documentoFuente     = null

    // Solo buscar contenido académico si la pregunta es académica y no es saludo inicial
    if (tipoPregunta === 'academica' && !esBienvenida) {
      const result = await buscarContenido(colegioSlug, gradoEfectivo, materia_id || '', pregunta)
      contenidoCurricular = result.contenido
      documentoFuente     = result.archivo
    }

    // Siempre leer docs de configuración (tienen videos y política pedagógica)
    const docsConfig = await leerConfig()
    const promptBase = cfg.prompt_personalizado || PROMPT_BASE
    const contextoValidacion = validacionOM ? `

INSTRUCCIÓN CRÍTICA DE EVALUACIÓN: ${validacionOM}` : ''
    const contextoIdioma = idiomaIngles ? '\n\nLANGUAGE INSTRUCTION: You MUST respond entirely in English. All explanations, questions, feedback and conversation must be in English only.' : ''

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

    const systemPrompt = `${promptBase}${contextoIdioma}

CONTEXTO DEL ALUMNO:
- Nombre: ${perfil.nombre_completo.split(' ')[0]}
- Colegio: ${perfil.colegio?.nombre}
- Grado: ${gradoEfectivo}
- Materia seleccionada: ${materia_id || materia?.nombre || 'General'}

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
