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

// Calculadora matemática — verifica por sustitución usando mathjs
function extraerYResolverEcuacion(textoTutor: string, respuestaAlumno: string): string | null {
  try {
    const math = require('mathjs') as { evaluate: (expr: string) => number }

    // Extraer número de la respuesta del alumno
    const numMatch = respuestaAlumno.replace(/[=]/g, ' ').match(/-?\d+([.,]\d+)?/)
    if (!numMatch) return null
    const numAlumno = parseFloat(numMatch[0].replace(',', '.'))
    if (isNaN(numAlumno)) return null

    // Buscar ecuaciones en el texto del tutor: ax ± b = c o x ± b = c
    const ecuacionRegex = /(\d*)?\s*([a-z])\s*([+\-])\s*(\d+)\s*=\s*(\d+)/gi
    let match
    while ((match = ecuacionRegex.exec(textoTutor)) !== null) {
      const [_, coefStr, _variable, _op, _b, _c] = match
      try {
        // Sustituir el valor del alumno en el lado izquierdo
        const izq = match[0].split('=')[0].trim()
        const der = parseFloat(match[0].split('=')[1].trim())
        
        // Preparar expresión: reemplazar variable por número, añadir * para coeficientes
        const expr = izq
          .replace(/(\d)([a-z])/gi, '$1*$2')  // 2x → 2*x
          .replace(/[a-z]/gi, numAlumno.toString()) // x → 7
        
        const resultado = math.evaluate(expr)
        const esCorrecta = Math.abs(resultado - der) < 0.001

        if (esCorrecta) {
          return `CALCULADORA_CORRECTO: Verificado matemáticamente. ${numAlumno} ES correcto.`
        } else {
          return `CALCULADORA_INCORRECTO: Verificado matemáticamente. ${numAlumno} es incorrecto. Al sustituir: ${expr.replace(/\*/g,'×')} = ${resultado}, pero debería ser ${der}.`
        }
      } catch { continue }
    }

    // Buscar porcentajes: N% de M
    const pctRegex = /(\d+)%\s+de\s+(\d+)/i
    const pMatch = textoTutor.match(pctRegex)
    if (pMatch) {
      const correcto = (parseFloat(pMatch[1]) / 100) * parseFloat(pMatch[2])
      const esCorrecta = Math.abs(numAlumno - correcto) < 0.001
      if (esCorrecta) return `CALCULADORA_CORRECTO: ${numAlumno} ES correcto.`
      return `CALCULADORA_INCORRECTO: La respuesta correcta es ${correcto}.`
    }

    // Sumas directas: a + b = ? o a + b
    const sumaRegex = /(\d+)\s*\+\s*(\d+)/
    const sumaMatch = textoTutor.match(sumaRegex)
    if (sumaMatch) {
      const correcto = parseFloat(sumaMatch[1]) + parseFloat(sumaMatch[2])
      const esCorrecta = Math.abs(numAlumno - correcto) < 0.001
      if (esCorrecta) return `CALCULADORA_CORRECTO: ${numAlumno} ES correcto.`
      return `CALCULADORA_INCORRECTO: La respuesta correcta es ${correcto}.`
    }

    // Restas directas: a - b = ?
    const restaRegex = /(\d+)\s*-\s*(\d+)/
    const restaMatch = textoTutor.match(restaRegex)
    if (restaMatch) {
      const correcto = parseFloat(restaMatch[1]) - parseFloat(restaMatch[2])
      const esCorrecta = Math.abs(numAlumno - correcto) < 0.001
      if (esCorrecta) return `CALCULADORA_CORRECTO: ${numAlumno} ES correcto.`
      return `CALCULADORA_INCORRECTO: La respuesta correcta es ${correcto}.`
    }

    // Multiplicaciones: a x b o a * b
    const multRegex = /(\d+)\s*[x\*×]\s*(\d+)/i
    const multMatch = textoTutor.match(multRegex)
    if (multMatch) {
      const correcto = parseFloat(multMatch[1]) * parseFloat(multMatch[2])
      const esCorrecta = Math.abs(numAlumno - correcto) < 0.001
      if (esCorrecta) return `CALCULADORA_CORRECTO: ${numAlumno} ES correcto.`
      return `CALCULADORA_INCORRECTO: La respuesta correcta es ${correcto}.`
    }

    // Divisiones: a ÷ b o a / b
    const divRegex = /(\d+)\s*[÷\/]\s*(\d+)/
    const divMatch = textoTutor.match(divRegex)
    if (divMatch && parseFloat(divMatch[2]) !== 0) {
      const correcto = parseFloat(divMatch[1]) / parseFloat(divMatch[2])
      const esCorrecta = Math.abs(numAlumno - correcto) < 0.001
      if (esCorrecta) return `CALCULADORA_CORRECTO: ${numAlumno} ES correcto.`
      return `CALCULADORA_INCORRECTO: La respuesta correcta es ${correcto}.`
    }

    return null
  } catch { return null }
}

// Validar respuesta de opción múltiple comparando con el historial
function validarOpcionMultiple(preguntaAlumno: string, historial: {rol:string; contenido:string}[]): string | null {
  // Solo aplica si el alumno respondió con una sola letra
  const respLetra = preguntaAlumno.trim().toUpperCase()
  // Detectar también si el alumno dio el valor numérico en lugar de la letra
  // Ej: dice "es 12" cuando la opción C es 12
  const esRespuestaDirecta = !/^[ABCD]$/.test(respLetra)
  
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

  // Si el alumno dio valor directo (no letra), buscar qué letra corresponde
  if (esRespuestaDirecta) {
    const valorAlumno = preguntaAlumno.trim().toLowerCase().replace(/[^\w\s.,]/g, '')
    for (const [letra, valor] of Object.entries(opciones)) {
      const valorLimpio = valor.toLowerCase().replace(/[^\w\s.,]/g, '')
      if (valorLimpio.includes(valorAlumno) || valorAlumno.includes(valorLimpio)) {
        return `VALIDACIÓN_VALOR_DIRECTO: El alumno dijo "${preguntaAlumno.trim()}" que corresponde a la opción ${letra}) ${valor}. Evalúa si ${letra} es la respuesta correcta según la pregunta anterior.`
      }
    }
    return null // No se pudo mapear el valor a ninguna opción
  }

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

async function leerCarpetasGrado(grado: string, idiomaIngles: boolean): Promise<string[]> {
  const token = await getToken()
  if (!token) return []
  const driveId = process.env.SHAREPOINT_DRIVE_ID!
  const carpetas: string[] = []
  try {
    const ruta = encodeURIComponent('Owlaris') + '/' + encodeURIComponent(CARPETA_COMPARTIDA) + '/' + encodeURIComponent(grado)
    const url = 'https://graph.microsoft.com/v1.0/drives/' + driveId + '/root:/' + ruta + ':/children'
    const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } })
    if (res.ok) {
      const data = await res.json()
      const items: string[] = (data.value || []).filter((i: {folder?:unknown}) => i.folder).map((i: {name:string}) => i.name)
      carpetas.push(...items)
    }
  } catch { /* silencioso */ }
  if (!carpetas.includes('Olimpiadas de Ciencias')) carpetas.push('Olimpiadas de Ciencias')
  carpetas.push(idiomaIngles ? '» English Conversation' : '» Conversar en Inglés')
  return carpetas
}

async function leerDocumentosPadres(): Promise<string> {
  const token = await getToken()
  if (!token) return ''
  const driveId = process.env.SHAREPOINT_DRIVE_ID!
  let contenido = ''
  try {
    const ruta = encodeURIComponent('Owlaris') + '/' + encodeURIComponent('Owlaris padres')
    const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${ruta}:/children`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return ''
    const data = await res.json()
    const docs = (data.value || []).filter((i: {file?:unknown}) => i.file)
    for (const doc of docs) {
      try {
        const dlUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${doc.id}/content`
        const dlRes = await fetch(dlUrl, { headers: { Authorization: `Bearer ${token}` } })
        if (dlRes.ok) {
          const texto = await dlRes.text()
          // Tomar secciones distribuidas del documento para mayor cobertura
          const chunk1 = texto.substring(0, 1000)
          const mid = Math.floor(texto.length / 2)
          const chunk2 = texto.substring(mid, mid + 1000)
          const chunk3 = texto.substring(texto.length - 1000)
          contenido += `\n--- ${doc.name} ---\n${chunk1}\n...\n${chunk2}\n...\n${chunk3}\n`
        }
      } catch { /* silencioso */ }
    }
  } catch { /* silencioso */ }
  return contenido
}

export async function POST(req: NextRequest) {
  try {
    const OpenAI = (await import('openai')).default
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await req.json()
    const { pregunta, historial, alerta_comprension = false, alerta_materia = '', alerta_tema = '' } = body
    const materia_id      = body.materia_id || body.materia_detectada || ''
    const userId: string  = body.user_id || ''
    const idiomaIngles: boolean = body.idioma_ingles || false
    const materiasDisponibles: string[] = body.materias_disponibles || []

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
      ? await supabase.from('materias').select('*').ilike('nombre', materia_id).eq('colegio_id', perfil.colegio_id).single()
      : { data: null }
    const materia = materiaPorId || materiaPorNombre
    const materia_uuid = materia?.id || null  // UUID real para inserts
    const gradoEfectivo = grado_override || perfil.grado
    const colegioSlug   = perfil.colegio?.sharepoint_folder || perfil.colegio?.slug

    // Detectar tipo de pregunta
    // ── ONBOARDING ──────────────────────────────────────────────────
    const estado: string = body.estado || 'activo'
    const nombreAlumno: string = body.nombre_alumno || ''
    const gradoAlumno: string  = body.grado_override || ''

    // Cargar materias disponibles desde SharePoint
    if (pregunta === '__CARGAR_MATERIAS__' || (estado === 'esperando_materia' && gradoAlumno && !pregunta.trim())) {
      const grado = gradoAlumno || grado_override || perfil.grado || ''
      if (grado) {
        const carpetas = await leerCarpetasGrado(grado, idiomaIngles)
        return NextResponse.json({
          materias_disponibles: carpetas,
          respuesta: '',
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


      const carpetasG = await leerCarpetasGrado(gradoDetectado, idiomaIngles)
      const msgGrado = idiomaIngles
        ? `Perfect, ${nombreAlumno}! What would you like to study?`
        : `Perfecto, ${nombreAlumno}. ¿Qué quieres estudiar hoy?`
      return NextResponse.json({
        respuesta: msgGrado,
        nuevo_estado: 'esperando_materia',
        nombre_alumno: nombreAlumno,
        grado_detectado: gradoDetectado,
        materias_disponibles: carpetasG,
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
      // Si el texto normalizado es igual al original (no se reconoció como materia conocida)
      // tratarlo como tema libre — usar la materia anterior o Matemática por defecto
      const esMateriaNormalizada = materiaDetectada !== pregunta.trim()
      if (!esMateriaNormalizada && materia_id) {
        // Continuar con la materia actual y tratar como pregunta académica
        return NextResponse.json({
          respuesta: idiomaIngles ? 'Ok, let me help you with that topic.' : 'Ok, vamos con ese tema.',
          nuevo_estado: 'activo',
          nombre_alumno: nombreAlumno,
          grado_detectado: gradoAlumno,
          materia_detectada: materia_id,
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
    
    // Calculadora matemática — verificar respuestas numéricas
    let validacionCalc: string | null = null
    if (!validacionOM && historial?.length > 0) {
      const ultimoTutor = [...(historial || [])].reverse().find(m => m.rol === 'asistente')
      if (ultimoTutor) {
        validacionCalc = extraerYResolverEcuacion(ultimoTutor.contenido, pregunta)
      }
    }

    // Si la calculadora detecta INCORRECTO, responder directo sin OpenAI
    if (validacionCalc?.startsWith('CALCULADORA_INCORRECTO')) {
      const ultimoTutor = [...(historial || [])].reverse().find((m: any) => m.rol === 'asistente')
      const ecuacion = ultimoTutor?.contenido?.match(/[\d]+\s*[+\-*\/x×÷]\s*[\d]+/)?.[0] || ''
      const respuesta = `Incorrecto. Vamos a revisarlo juntos.${ecuacion ? ' La operación es: ' + ecuacion + '.' : ''} ¿Puedes intentarlo de nuevo paso a paso?`
      await supabase.from('interacciones').insert({
        usuario_id: user.id, colegio_id: perfil.colegio_id, materia_id: materia_uuid,
        grado: gradoEfectivo, tema_detectado: pregunta.substring(0, 100),
        pregunta, respuesta, tokens_usados: 0, costo_usd: 0,
        modelo_usado: 'calculadora', documento_fuente: null, sospecha_copia: false,
      })
      return NextResponse.json({ respuesta, tokens: 0 })
    }

    // Si la calculadora confirma que es CORRECTO, responder directo sin OpenAI
    if (validacionCalc?.startsWith('CALCULADORA_CORRECTO')) {
      const numMatch = pregunta.replace(/[=]/g, ' ').match(/-?\d+([.,]\d+)?/)
      const valor = numMatch ? numMatch[0] : pregunta.trim()
      const respuesta = `¡Correcto! ${valor} es la respuesta correcta. Bien hecho. ¿Puedes explicarme cómo llegaste a ese resultado?`
      await supabase.from('interacciones').insert({
        usuario_id: user.id, colegio_id: perfil.colegio_id, materia_id: materia_uuid,
        grado: gradoEfectivo, tema_detectado: pregunta.substring(0, 100),
        pregunta, respuesta, tokens_usados: 0, costo_usd: 0,
        modelo_usado: 'calculadora', documento_fuente: null, sospecha_copia: false,
      })
      return NextResponse.json({ respuesta, tokens: 0 })
    }

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

INSTRUCCIÓN CRÍTICA DE EVALUACIÓN: ${validacionOM}` : validacionCalc ? `

INSTRUCCIÓN CRÍTICA DE EVALUACIÓN: ${validacionCalc}` : ''
    const esModoConversacion = body.modo_conversacion || false

    // Alerta por 3 fallos consecutivos detectados en el frontend
    if (alerta_comprension) {
      const { data: alertaExist } = await supabase.from('alertas')
        .select('id').eq('alumno_id', user.id).eq('tipo', 'baja_comprension')
        .eq('resuelta', false).gte('creado_en', new Date(Date.now() - 3600000).toISOString()).maybeSingle()
      if (!alertaExist) {
        const { data: asig } = await supabase.from('guia_asignaciones')
          .select('guia_id, guia:guia_id(email, nombre_completo)')
          .eq('colegio_id', perfil.colegio_id).eq('activo', true)
          .or(`alumno_id.eq.${user.id},grado.eq.${perfil.grado || ''}`)
          .limit(1).maybeSingle()
        const guiaId = asig?.guia_id || null
        await supabase.from('alertas').insert({
          alumno_id: user.id, colegio_id: perfil.colegio_id, guia_id: guiaId,
          tipo: 'baja_comprension',
              descripcion: `${perfil.nombre_completo} tuvo 3 respuestas incorrectas consecutivas${alerta_materia ? ' en ' + alerta_materia : ''}.`,
              contexto: alerta_materia + (alerta_tema ? ' — ' + alerta_tema : ''),
        })
        console.log('ALERTA GENERADA: 3 fallos consecutivos para', perfil.nombre_completo)
        if (asig?.guia) {
          try {
            const guia = asig.guia as unknown as {email:string; nombre_completo:string}
            const { Resend } = await import('resend')
            const resend = new Resend(process.env.RESEND_API_KEY)
            await resend.emails.send({
              from: 'Owlaris <noreply@owlaris.app>',
              to: guia.email,
              subject: `Alerta: Baja comprensión — ${perfil.nombre_completo}`,
              html: '<div style="font-family:system-ui;max-width:500px;margin:0 auto">' +
                '<div style="background:#2C3E6B;padding:20px;border-radius:12px 12px 0 0">' +
                '<h2 style="color:white;margin:0">Alerta Pedagógica — Owlaris</h2></div>' +
                '<div style="background:white;padding:20px;border:1px solid #E2E8F0;border-radius:0 0 12px 12px">' +
                '<p>Hola <strong>' + guia.nombre_completo + '</strong>,</p>' +
                '<p>El alumno <strong>' + perfil.nombre_completo + '</strong> (' + (perfil.grado||'') + ') tuvo <strong>3 respuestas incorrectas consecutivas</strong> en Owlaris.</p>' +
                '<p style="color:#64748B;font-size:13px">Última pregunta: "' + pregunta.substring(0,150) + '"</p>' +
                '<a href="https://owlaris.app/guia" style="display:inline-block;background:#2C3E6B;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;margin-top:12px">Ver en Owlaris →</a>' +
                '</div></div>'
            })
          } catch(e) { console.error('Email error:', e) }
        }
      }
    }

    // Modo conversación inglés — respuesta directa sin SharePoint
    if (esModoConversacion) {
      const OpenAI = (await import('openai')).default
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      const historialConv = (historial || []).slice(-4).map((m: {rol:string;contenido:string}) => ({
        role: m.rol === 'usuario' ? 'user' as const : 'assistant' as const,
        content: m.contenido
      }))
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 60,
        temperature: 0.8,
        messages: [
          { role: 'system', content: 'You are Owlaris, a friendly English conversation coach for Guatemalan students of all ages. Your mission is to help them improve their English naturally through conversation. RULES: 1) ALWAYS respond in English only — never use Spanish under any circumstance. 2) Keep responses SHORT: 1-2 sentences max. 3) Gently correct grammar and pronunciation by modeling the correct form naturally in your reply — never say the student is wrong directly. 4) Adapt vocabulary to the student level: simple for beginners, richer for advanced. 5) Ask ONE follow-up question to keep conversation flowing. 6) Be warm, patient and encouraging — mistakes are normal. 7) Any topic is welcome: daily life, school, family, food, hobbies, travel, culture. 8) Follow any special instructions the student gives you naturally as part of the conversation.' },
          ...historialConv,
          { role: 'user', content: pregunta }
        ]
      })
      const respuesta = completion.choices[0].message.content || ''
      // Guardar interacción
      await supabase.from('interacciones').insert({
        usuario_id: user.id,
        colegio_id: perfil.colegio_id,
        grado: perfil.grado || '',
        tema_detectado: 'Conversación en Inglés',
        pregunta: pregunta.substring(0, 500),
        respuesta: respuesta.substring(0, 1000),
        tokens_usados: completion.usage?.total_tokens || 0,
        costo_usd: (completion.usage?.total_tokens || 0) * 0.00000015,
        modelo_usado: 'gpt-4o-mini',
        sospecha_copia: false,
      })
      // Actualizar ultimo_acceso
      supabase.from('usuarios').update({ ultimo_acceso: new Date().toISOString() }).eq('id', user.id).then(() => {})
      return NextResponse.json({ respuesta, nuevo_estado: 'activo', tokens: completion.usage?.total_tokens || 0 })
    }
    const esPadre = body.rol_usuario === 'padre'
    let promptPadre = ''
    if (esPadre) {
      const docsPadres = await leerDocumentosPadres()
      promptPadre = `\n\nROL ESPECIAL - ASISTENTE PARA PADRES: Estás hablando con un padre o madre de familia, NO con un alumno. Tu rol es ser un consejero educativo familiar. Usa los siguientes documentos como base de conocimiento para responder:\n${docsPadres}\n\nAyuda con: estrategias para apoyar el aprendizaje en casa, hábitos de estudio, comunicación con los hijos sobre el colegio, manejo del estrés académico, tips de motivación. Sé cálido, empático y práctico. Responde en español, tono de consejero de confianza.`
    }
    const contextoExtra = promptPadre || ''
    const contextoIdioma = idiomaIngles
      ? esModoConversacion
        ? '\n\nCONVERSATION MODE - CRITICAL RULES:\n1. ALWAYS respond in ENGLISH ONLY. Never use Spanish. Even if the student writes in Spanish, respond in English.\n2. Keep responses VERY SHORT: 1-2 sentences maximum.\n3. Gently correct grammar by modeling the correct form in your response.\n4. Ask ONE simple follow-up question.\n5. Be warm and encouraging.\n6. Topics: daily life, school, hobbies, food, travel.'
        : '\n\nLANGUAGE INSTRUCTION: You MUST respond entirely in English. All explanations, questions, feedback and conversation must be in English only.'
      : ''

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
      contextoContenido = `No se encontró un documento específico en SharePoint para esta consulta en ${gradoEfectivo}. Responde con tu conocimiento general del tema. Si detectas que la pregunta pertenece a una materia específica (Matemática, Física, Química, Biología, Historia, Español), menciona al alumno que puede estudiar esa materia directamente seleccionándola del menú.`
    }

    const systemPrompt = `${promptBase}${contextoIdioma}

CONTEXTO DEL ALUMNO:
- Nombre: ${perfil.nombre_completo.split(' ')[0]}
- Colegio: ${perfil.colegio?.nombre}
- Grado: ${gradoEfectivo}
- Materia seleccionada: ${materia_id || materia?.nombre || 'Sin materia seleccionada — el alumno está eligiendo'}

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
      model: 'gpt-4o-mini', messages: mensajesOpenAI, max_tokens: esModoConversacion ? 80 : 700, temperature: 0.7,
    })

    let respuesta = completion.choices[0].message.content || 'No pude generar una respuesta.'

    // JUEZ INDEPENDIENTE — verificar si el alumno respondió algo y el modelo evaluó
    // Solo actúa cuando hay historial (el alumno está respondiendo, no preguntando)
    const ultimaPreguntaTutor = [...(historial || [])].reverse().find((m: any) => m.rol === 'asistente')
    // El juez solo evalúa respuestas numéricas o de letra, no explicaciones
    const esRespuestaNumerica = /^[a-dA-D]$/.test(pregunta.trim()) || 
      /^-?\d+([.,]\d+)?$/.test(pregunta.trim().replace(/[=xX]/g,'').trim()) ||
      /^[a-dA-D][).]/.test(pregunta.trim()) ||
      /^(es|son|da|el resultado es|la respuesta es)?\s*-?\d/.test(pregunta.trim().toLowerCase())
    const esRespuestaAlumno = ultimaPreguntaTutor && 
      esRespuestaNumerica &&
      pregunta.trim().length < 50 &&
      tipoPregunta === 'academica'

    if (esRespuestaAlumno) {
      try {
        const juezMessages = [
          {
            role: 'system' as const,
            content: `Eres un juez académico experto. Tu ÚNICA función es evaluar si la respuesta del alumno es correcta o incorrecta.

RESPONDE SOLO con este JSON exacto, sin texto adicional, sin markdown, sin explicaciones fuera del JSON:
{"correcto": true, "respuesta_correcta": "valor", "explicacion_breve": "razón en 10 palabras"}
{"correcto": false, "respuesta_correcta": "valor correcto", "explicacion_breve": "razón en 10 palabras"}
{"correcto": null, "respuesta_correcta": null, "explicacion_breve": "pregunta no evaluable"}

REGLAS EN ORDEN ESTRICTO:

REGLA 1 - OPCIÓN MÚLTIPLE (la pregunta contiene A) B) C) D)):
  Paso 1: Lee todas las opciones y sus valores. Ejemplo: "A) 5  B) 10  C) 15  D) 20"
  Paso 2: Identifica la letra que eligió el alumno
  Paso 3: Encuentra el VALOR numérico o textual de esa letra
  Paso 4: Evalúa si ese VALOR es la respuesta correcta al problema planteado
  EJEMPLOS:
  - Problema: 15-5=?, opciones: A)5 B)10 C)15 D)20, alumno dice "B" → B=10, 15-5=10 ✓ → {"correcto": true, "respuesta_correcta": "B (10)", "explicacion_breve": "B equivale a 10 que es 15 menos 5"}
  - Problema: 15-5=?, opciones: A)5 B)10 C)15 D)20, alumno dice "A" → A=5, 15-5=10≠5 ✗ → {"correcto": false, "respuesta_correcta": "B (10)", "explicacion_breve": "A equivale a 5 pero 15 menos 5 es 10"}
  NUNCA evalúes la letra en sí misma como respuesta. SIEMPRE evalúa el valor que representa.

REGLA 2 - NÚMERO DIRECTO (alumno da un número):
  - Calcula exactamente la operación de la pregunta
  - Compara con el número del alumno
  - Ejemplo: "¿Cuánto es 23+17?" alumno dice "40" → 23+17=40 → {"correcto": true}
  - Ejemplo: "¿Cuánto es 23+17?" alumno dice "41" → 23+17=40≠41 → {"correcto": false, "respuesta_correcta": "40"}

REGLA 3 - TEXTO O CONCEPTO (historia, ciencias, lenguaje):
  - Evalúa si el concepto central es correcto
  - Acepta sinónimos, paráfrasis y respuestas equivalentes
  - Si el alumno da una respuesta parcialmente correcta pero con la idea principal → {"correcto": true}
  - Solo marca false si la respuesta es claramente incorrecta o contradice la pregunta

REGLA 4 - NO EVALUABLE (responde null):
  - El alumno está explicando cómo resolvió algo (no dando respuesta)
  - El alumno hace una pregunta al tutor
  - El alumno pide otra pregunta o ayuda
  - La pregunta del tutor es una explicación, no una evaluación
  - El alumno da texto largo que no es una respuesta directa`
          },
          {
            role: 'user' as const,
            content: `Pregunta del tutor: "${ultimaPreguntaTutor.contenido.substring(0, 500)}"
Respuesta del alumno: "${pregunta}"
Evalúa si la respuesta del alumno es correcta.`
          }
        ]

        const juezCompletion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: juezMessages,
          max_tokens: 150,
          temperature: 0,
        })

        const juezRaw = juezCompletion.choices[0].message.content || '{}'
        const juezJSON = JSON.parse(juezRaw.replace(/```json|```/g, '').trim())

        if (juezJSON.correcto === true && respuesta.toLowerCase().includes('incorrecto')) {
          // El modelo dijo incorrecto pero el juez dice correcto
          const numMatch = pregunta.replace(/[=]/g, ' ').match(/-?\d+([.,]\d+)?/)
          const valor = numMatch ? numMatch[0] : pregunta.trim()
          respuesta = `¡Correcto! ${valor} es la respuesta correcta. Bien hecho. ¿Puedes explicarme cómo llegaste a ese resultado?`
        } else if (juezJSON.correcto === false && (
          respuesta.toLowerCase().includes('correcto') && 
          !respuesta.toLowerCase().includes('incorrecto')
        )) {
          // El modelo dijo correcto pero el juez dice incorrecto
          respuesta = `Incorrecto. La respuesta correcta es ${juezJSON.respuesta_correcta}. ${juezJSON.explicacion_breve}. ¿Puedes intentarlo de nuevo?`
        }
      } catch(juezErr) {
        console.error('Juez error (no crítico):', juezErr)
      }
    }

    // Si es tema formativo, agregar link de video de Eduardo al final
    if (tipoPregunta === 'formativa') {
      respuesta += '\n\nTe comparto este recurso de Eduardo Montano que puede ayudarte: https://www.youtube.com/c/EduardoMontano'
    }
    const tokensUsados = completion.usage?.total_tokens || 0
    const costoUSD     = tokensUsados * 0.00000015

    const { error: insertErr } = await supabase.from('interacciones').insert({
      usuario_id: user.id, colegio_id: perfil.colegio_id, materia_id: materia_uuid,
      grado: gradoEfectivo, tema_detectado: pregunta.substring(0, 100),
      pregunta, respuesta, tokens_usados: tokensUsados, costo_usd: costoUSD,
      modelo_usado: 'gpt-4o-mini', documento_fuente: documentoFuente,
      sospecha_copia: detectarCopia(pregunta),
    })

    if (tipoPregunta === 'academica' && !contenidoCurricular && materia) {
      await registrarPendiente(supabase, perfil, materia, pregunta)
    }

    // Detectar alertas pedagógicas
    try {
      const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://owlaris.app'
      
      // Alerta riesgo de copia
      if (detectarCopia(pregunta)) {
        const { data: alertaCopia } = await supabase.from('alertas')
          .select('id').eq('alumno_id', user.id).eq('tipo', 'riesgo_copia')
          .eq('resuelta', false).gte('creado_en', new Date(Date.now() - 3600000).toISOString()).single()
        if (!alertaCopia) {
          const { data: asigCopia } = await supabase.from('guia_asignaciones')
            .select('guia_id').eq('colegio_id', perfil.colegio_id).eq('activo', true)
            .or(`alumno_id.eq.${user.id},grado.eq.${gradoEfectivo}`).limit(1).single()
          await supabase.from('alertas').insert({
            alumno_id: user.id, colegio_id: perfil.colegio_id, guia_id: asigCopia?.guia_id || null,
            tipo: 'riesgo_copia',
            descripcion: 'El alumno solicitó respuesta directa o entrega sospechosa.',
            contexto: pregunta.substring(0, 200)
          })
        }
      }

      // Alerta baja comprensión — detectar retroalimentación negativa
      const indicadoresBajaComprension = ['no entiendo', 'no entendí', 'no me queda claro', 'sigo sin entender', 'todavía no entiendo', "i don't understand", 'confused']
      const esBajaComprension = indicadoresBajaComprension.some(i => pregunta.toLowerCase().includes(i))
      if (esBajaComprension) {
        console.log('ALERTA BAJA COMPRENSION DETECTADA:', pregunta)
        const { count } = await supabase.from('interacciones')
          .select('*', { count: 'exact', head: true })
          .eq('usuario_id', user.id)
          .gte('creado_en', new Date(Date.now() - 1800000).toISOString())
        console.log('COUNT INTERACCIONES ULTIMA HORA:', count)
        if ((count || 0) >= 2) {
          // Verificar no duplicar alerta reciente
          const { data: alertaExistente } = await supabase.from('alertas')
            .select('id').eq('alumno_id', user.id).eq('tipo', 'baja_comprension')
            .eq('resuelta', false).gte('creado_en', new Date(Date.now() - 3600000).toISOString()).single()
          if (!alertaExistente) {
            // Buscar guía asignado
            const { data: asig } = await supabase.from('guia_asignaciones')
              .select('guia_id, guia:guia_id(email, nombre_completo)')
              .eq('colegio_id', perfil.colegio_id)
              .eq('activo', true)
              .or(`alumno_id.eq.${user.id},grado.eq.${gradoEfectivo}`)
              .limit(1).single()
            const guiaId = asig?.guia_id || null
            await supabase.from('alertas').insert({
              alumno_id: user.id, colegio_id: perfil.colegio_id, guia_id: guiaId,
              tipo: 'baja_comprension',
              descripcion: 'El alumno expresó no entender después de varios intentos.',
              contexto: pregunta.substring(0, 200)
            })
            // Email al guía
            if (asig?.guia) {
              const guia = asig.guia as unknown as {email:string; nombre_completo:string}
              const { Resend } = await import('resend')
              const resend = new Resend(process.env.RESEND_API_KEY)
              await resend.emails.send({
                from: 'Owlaris <noreply@owlaris.app>',
                to: guia.email,
                subject: `Alerta: Baja comprensión — ${perfil.nombre_completo}`,
                html: `<p>Hola ${guia.nombre_completo},</p><p>El alumno <strong>${perfil.nombre_completo}</strong> (${gradoEfectivo}) ha expresado no entender después de varios intentos.</p><p>Contexto: "${pregunta.substring(0,200)}"</p><a href="https://owlaris.app/guia">Ver en Owlaris →</a>`
              })
            }
          }
        }
      }

      // Alerta bloqueo recurrente — mismo tema varias veces
      if (materia && gradoEfectivo) {
        const { count: countTema } = await supabase.from('interacciones')
          .select('*', { count: 'exact', head: true })
          .eq('usuario_id', user.id)
          .eq('grado', gradoEfectivo)
          .ilike('tema_detectado', `%${pregunta.substring(0,30)}%`)
          .gte('creado_en', new Date(Date.now() - 3600000).toISOString())
        if ((countTema || 0) >= 3) {
          fetch(`${baseUrl}/api/alertas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              alumno_id: user.id,
              colegio_id: perfil.colegio_id,
              tipo: 'bloqueo_recurrente',
              descripcion: `El alumno ha preguntado sobre el mismo tema más de 3 veces en la última hora.`,
              contexto: `Materia: ${materia?.nombre || ''} | Tema: ${pregunta.substring(0, 100)}`
            })
          })
        }
      }
    } catch { /* silencioso */ }

    // Actualizar ultimo_acceso del alumno
    supabase.from('usuarios').update({ ultimo_acceso: new Date().toISOString() }).eq('id', user.id).then(() => {})

    // ALERTA 1: Baja comprensión — detectar del lado del servidor
    if (typeof respuesta === 'string') {
      const esIncorrecta = respuesta.toLowerCase().includes('incorrecto') ||
        respuesta.toLowerCase().includes('no es correcto') ||
        respuesta.toLowerCase().includes('vamos a revisar juntos') ||
        respuesta.toLowerCase().includes('esa respuesta no es') ||
        respuesta.toLowerCase().includes('esa respuesta tampoco') ||
        respuesta.toLowerCase().includes('parece que la respuesta') ||
        respuesta.toLowerCase().includes('vamos a revisarlo') ||
        respuesta.toLowerCase().includes('vamos a analizarlo') ||
        respuesta.toLowerCase().includes('vamos a desglosarlo') ||
        respuesta.toLowerCase().includes('that is not correct') ||
        respuesta.toLowerCase().includes('thats not correct')
      if (esIncorrecta === true) {
        const hace1h = new Date(Date.now() - 3600000).toISOString()
        const { data: recientes } = await supabase.from('interacciones')
          .select('respuesta').eq('usuario_id', user.id).gte('creado_en', hace1h)
        const fallos = (recientes || []).filter((i: any) =>
          i.respuesta?.toLowerCase().includes('incorrecto') ||
          i.respuesta?.toLowerCase().includes('vamos a revisar')
        ).length
        if (fallos >= 2) {
          const { data: yaExiste } = await supabase.from('alertas')
            .select('id').eq('alumno_id', user.id).eq('tipo', 'baja_comprension')
            .eq('resuelta', false).gte('creado_en', hace1h).maybeSingle()
          if (!yaExiste) {
            // Buscar guía por alumno individual primero, luego por grado
            let asig = null
            const { data: asigAlumno } = await supabase.from('guia_asignaciones')
              .select('guia_id, guia:guia_id(email, nombre_completo)')
              .eq('colegio_id', perfil.colegio_id).eq('activo', true)
              .eq('tipo', 'alumno').eq('alumno_id', user.id).limit(1).maybeSingle()
            if (asigAlumno) {
              asig = asigAlumno
            } else {
              const { data: asigGrado } = await supabase.from('guia_asignaciones')
                .select('guia_id, guia:guia_id(email, nombre_completo)')
                .eq('colegio_id', perfil.colegio_id).eq('activo', true)
                .eq('tipo', 'grado').eq('grado', gradoEfectivo || perfil.grado || '').limit(1).maybeSingle()
              asig = asigGrado
            }
            await supabase.from('alertas').insert({
              alumno_id: user.id, colegio_id: perfil.colegio_id,
              guia_id: asig?.guia_id || null, tipo: 'baja_comprension',
              descripcion: perfil.nombre_completo + ' tuvo ' + (fallos+1) + ' respuestas incorrectas' + (materia?.nombre ? ' en ' + materia.nombre : '') + '.',
              contexto: documentoFuente || pregunta.substring(0, 150)
            })
            if (asig?.guia) {
              try {
                const guia = asig.guia as unknown as {email:string; nombre_completo:string}
                const { Resend } = await import('resend')
                await new Resend(process.env.RESEND_API_KEY).emails.send({
                  from: 'Owlaris <noreply@owlaris.app>', to: guia.email,
                  subject: 'Alerta: Baja comprension - ' + perfil.nombre_completo,
                  html: '<p>Hola ' + guia.nombre_completo + ',</p><p><strong>' + perfil.nombre_completo + '</strong> tuvo ' + (fallos+1) + ' respuestas incorrectas en Owlaris.</p><a href="https://owlaris.app/guia">Ver en Owlaris</a>'
                })
              } catch(e) { console.error('Email alerta:', e) }
            }
          }
        }
      }
    }

    return NextResponse.json({ respuesta, tokens: tokensUsados, documento_fuente: documentoFuente })

  } catch (err) {
    console.error('Error /api/preguntar:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
