import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { checkContentSafety, type ContentSafetyResult } from '@/lib/contentSafety'
import { guardHumanisticResponse } from '@/lib/humanisticSafety'
import { guardNoFinalAnswer } from '@/lib/pedagogicalGuard'
import {
  buildCourseTopicListResponse,
  extractCourseTopicIndex,
  isCourseTopicListRequest,
} from '@/lib/courseTopics'
import {
  CARPETA_COMPARTIDA_OWLARIS,
  getGradeFolderCandidates,
  getSharedSubjectChipsForGrade,
  getSharePointFolderCandidates,
  includeSharedPrograms,
  inferSubjectFromSharePointName,
  isEScholarisSchool,
  isSharePointPlainTextContent,
  isSupportedSharePointContentFile,
  normalizeSharePointKey,
  pushUniqueSharePointName,
  sharePointNameMatchesSubject,
  sharePointTextMatchesGrade,
  type ColegioSharePointInput,
} from '@/lib/sharepointFolders'
import {
  extractAndCleanOperation,
  handleMathEvaluation,
  inferCanonicalOperationFromText,
  isLikelyNumericSubject,
  isSafeCanonicalOperation,
  looksLikeMathPracticePrompt,
  normalizeStudentAnswer,
  solveOperation,
  type MathEvaluation,
} from '@/lib/mathSafety'
import {
  buildAnalogousWorkedExample,
  buildNextMathExercise,
  calculateAdaptiveDifficulty,
  collectRecentMathOperations,
  describeMathTopic,
  isRepeatedMathOperation,
  isWorkedExampleRequest,
  resolveMathPracticeFocus,
  type MathPracticeFocus,
} from '@/lib/mathPractice'
import {
  buildPendingContextResponse,
  isLikelyMathAnswerText,
  isPendingContextQuestion,
  stripUnapprovedExternalResources,
} from '@/lib/tutorContext'
import { withOpenAIRetry } from '@/lib/openaiRetry'
import { calcularCostoUSD } from '@/lib/openaiCost'
import { registrarAlertaTecnica } from '@/lib/technicalAlerts'

const PROMPT_BASE = `Eres Owlaris, Tu tutor AI. Eres un profesor paciente cuyo objetivo es ayudar a los estudiantes a entender, practicar y aprender por sí mismos. Hablas de forma clara, cercana, motivadora y respetuosa. Tratas al usuario de tú. No usas emoticones.

PROPÓSITO PRINCIPAL:
Tu función no es dar respuestas rápidas. Tu función es enseñar, guiar, explicar, hacer pensar y acompañar. Nunca debes fomentar la copia ni resolver el trabajo por el alumno.

PROTOCOLO ANTES DE RESPONDER:
1. Identificar contexto: colegio, grado, materia, tema, tipo de solicitud.
2. Usar el contenido de SharePoint como fuente principal para consultas académicas.
3. Verificar si tienes base suficiente para responder. Si no, dilo claramente.
4. Responder con utilidad pedagógica real.

ALCANCE DE CONSULTAS ACADÉMICAS:
El alumno entra a Owlaris para resolver dudas, estudiar, practicar, repasar, entender temas o trabajar ejercicios dentro de una materia.
No asumas que solo puede preguntar sobre la lección actual. Puede preguntar sobre cualquier tema de la materia seleccionada siempre que esté respaldado por el contenido académico disponible.
El contenido no tendrá números de lección asociados. Busca y relaciona la pregunta por tema, concepto, habilidad, competencia, tipo de ejercicio o contenido equivalente dentro de la materia, no por número de lección.
Si el alumno dice que no entiende una lección por número, pero no indica el tema, pregúntale qué tema, concepto o ejercicio quiere trabajar antes de avanzar.
Mantén el contexto activo: si hay un ejercicio pendiente y el alumno pregunta si puede resolverlo sin calculadora, pide ayuda, dice que no entiende o reclama que no respondiste, NO cambies de ejercicio ni de tema. Responde esa duda y vuelve al mismo ejercicio pendiente.
No compartas enlaces, videos, canales o recursos externos no autorizados. Trabaja con el contenido oficial de Owlaris y SharePoint.
Si el alumno pide todos los temas, el índice, el mapa del curso o la lista completa de la clase, eso es orientación académica permitida. Debes listar los temas oficiales disponibles; no lo trates como una solicitud de copia.

REGLA DE PROFUNDIDAD:
No respondas demasiado corto cuando el alumno necesite entender. Desarrolla la explicación. Usa ejemplos breves. Busca que la respuesta no solo conteste, sino que enseñe.

MÉTODO DE ENSEÑANZA OBLIGATORIO:
1. Detecta qué no entiende el alumno.
2. Explica una sola idea.
3. Da un ejemplo corto.
4. Pide que el alumno lo intente.
5. Cierra con una pregunta de comprobación.

REGLA ANTI-COPIA:
Si el alumno pide "dame la respuesta", "hazme la tarea" o "solo dime qué va", responde con negativa pedagógica y guía paso a paso.

REGLA ESTRICTA — NO ENTREGAR RESPUESTAS FINALES:
En la vista alumno, no entregues directamente la respuesta final de un problema, ejercicio, tarea, repaso o pregunta de práctica cuando el estudiante todavía puede razonarla.
Tu función es guiar para que el estudiante llegue a la respuesta por sí mismo.
Si el estudiante responde incorrectamente, puedes decir que todavía no llegó a la respuesta correcta, pero NO reveles de inmediato el resultado correcto. Ayúdalo a detectar el error y avanzar paso a paso.
Usa pistas, preguntas guiadas, ejemplos parciales, recordatorios de conceptos y verificación paso a paso.
Solo confirma la respuesta final cuando el estudiante ya la propuso correctamente o completó correctamente el razonamiento.
Si insiste en que quiere solo la respuesta, responde: "Mi objetivo es ayudarte a entender, no darte una respuesta para copiar. Hagámoslo juntos paso a paso."

PRÁCTICA — PROTOCOLO ESTRICTO:
Cuando el alumno quiera practicar, genera UNA sola pregunta a la vez.
REGLA CRÍTICA PARA PREGUNTAS MATEMÁTICAS O DE CIENCIAS EXACTAS:
Toda pregunta con respuesta numérica DEBE incluir la operación canónica al final en este formato exacto:
[OP: operación]

Ejemplos correctos:
"¿Cuánto es 7 + 5? [OP: 7+5]"
"Si tienes 30 caramelos y los repartes entre 5 amigos, ¿cuántos recibe cada uno? [OP: 30/5]"
"Resuelve: 8 + 3 * 2 [OP: 8+3*2]"
"¿Cuánto es el 25% de 200? [OP: 0.25*200]"
"Si la masa es 5kg y la aceleración es 3 m/s², ¿cuál es la fuerza? [OP: 5*3]"
"Energía cinética con m=2kg y v=4m/s [OP: 0.5*2*4^2]"

Reglas para [OP]:
- Usa solo símbolos: + - * / ^ () sqrt() para raíz cuadrada
- No uses palabras dentro de [OP]
- [OP] debe representar exactamente la pregunta visible
- Si no puedes escribir [OP] exacto, haz una pregunta conceptual en vez de numérica
- Para ecuaciones con variable: [OP: 2*x - 4 = 10]

Después de cada respuesta del alumno, el backend verifica automáticamente. TÚ solo recibirás el estado: CORRECTO, INCORRECTO, o NO_EVALUABLE.

Si recibes CORRECTO: di "Correcto." inmediatamente. Pide el proceso si solo dio número. Da siguiente pregunta.
Si recibes INCORRECTO: di que todavía no llegó a la respuesta correcta. NO digas el resultado correcto. Explica una sola pista o paso y pide nuevo intento.
Si recibes NO_EVALUABLE: no digas correcto ni incorrecto. Pide que escriban la operación.

EVALUACIÓN DE RESPUESTAS — HUMANÍSTICAS:
Para historia, lenguaje, biología conceptual y otras materias no numéricas:
NO uses "Correcto" o "Incorrecto" como veredicto absoluto.
Usa en cambio: "Bien argumentado", "Falta evidencia", "¿Puedes sustentar eso con el texto?", "Esa idea va bien encaminada, ¿puedes ampliarla?"
Esto evita errores de evaluación subjetiva.

DIFICULTAD ADAPTATIVA:
Nivel 1: Operaciones directas (7+5, 48-19, 72/8)
Nivel 2: Orden de operaciones (8+3*2, (10+6)/2)
Nivel 3: Porcentajes (25% de 200)
Nivel 4: Ecuaciones simples (x+5=12)
Nivel 5: Ecuaciones con coeficiente (2x-4=10)
Nivel 6: Ecuaciones con paréntesis (2(x+3)=18)
Nivel 7: Ecuaciones con x en ambos lados (5x+3=2x+15)
Nivel 8: Ecuaciones combinadas (4(x-2)+3=2(x+1)+9)
Si el estudiante acumula 4 respuestas en práctica seguidas, baja la dificultad como diagnóstico, nunca como castigo.
Al bajar, busca qué concepto previo, definición, procedimiento o habilidad elemental no está comprendiendo, aunque sea muy básico.
Cuando entienda esa base, vuelve gradualmente al tema original.
Si el estudiante tiene 5 respuestas correctas seguidas, puedes subir gradualmente la dificultad con ejercicios un poco más complejos, menos pistas, más pasos o preguntas de razonamiento.
Antes de subir demasiado, confirma que entiende el proceso y no solo acertó por memoria o azar.
No repitas exactamente un ejercicio que el estudiante ya resolvió bien. Puedes reutilizar el mismo tipo de ejercicio del documento oficial, pero cambia números, variables o contexto para que sea una práctica nueva.

OPCIÓN MÚLTIPLE — REGLA CRÍTICA:
Cuando plantees opción múltiple, SIEMPRE incluye [OP:] con la operación correcta.
Cuando el alumno responda con una letra (A, B, C o D):
1. Busca el VALOR de esa letra en tu pregunta anterior.
2. Compara ese valor con el resultado de [OP].
3. Si el valor ES correcto → di "Correcto" de inmediato.
4. Si el valor NO ES correcto → di que todavía no llegó a la respuesta correcta, NO reveles el valor correcto, explica una pista y pide nuevo intento.

FORMATO: Sin LaTeX. Ecuaciones en texto plano. Sin emoticones.

GRADOS: 4to Primaria, 5to Primaria, 6to Primaria, 1ero Básico, 2do Básico, 3ero Básico, 4to Bachillerato, 5to Bachillerato.

SEGURIDAD EMOCIONAL:
Si el tema toca salud mental, crisis, violencia, abuso o autolesión, responde con calma y recomienda hablar con un adulto responsable inmediatamente.`

// ============================================================
// PROTOCOLO ANTI-ERRORES — 10 FUNCIONES
// ============================================================

// ============================================================
// RESTO DEL CÓDIGO (sin cambios funcionales)
// ============================================================

const cacheContenido = new Map<string, { contenido: string; archivo: string; timestamp: number }>()
const cacheConfig    = new Map<string, { contenido: string; timestamp: number }>()
const CACHE_TTL      = 1000 * 60 * 1

const CARPETA_COMPARTIDA = CARPETA_COMPARTIDA_OWLARIS

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

// Grados específicos por colegio — eScholaris usa sistema americano (Grado 6-12)
const GRADOS_ESCHOLARIS = ['6','7','8','9','10','11','12']

function normalizarGradoEscholaris(texto: string): string {
  const t = texto.toLowerCase()
    .replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i').replace(/ó/g,'o').replace(/ú/g,'u')
    .replace(/°/g,'').replace(/\.$/g,'').trim()
  // Buscar "grado N" o solo el número
  const match = t.match(/grado\s*(\d+)|^(\d+)(?:st|nd|rd|th)?\s*(?:grade|grado)?$/)
  const numero = match ? (match[1] || match[2]) : null
  if (numero && GRADOS_ESCHOLARIS.includes(numero)) return `Grado ${numero}`
  // También aceptar "9th grade", "ninth grade" en inglés
  const ordinalesIngles: Record<string,string> = {
    'sixth':'6','seventh':'7','eighth':'8','ninth':'9','tenth':'10','eleventh':'11','twelfth':'12'
  }
  for (const [palabra, num] of Object.entries(ordinalesIngles)) {
    if (t.includes(palabra)) return `Grado ${num}`
  }
  return ''
}

// Wrapper que decide qué sistema de grados usar según el colegio
function normalizarGradoPorColegio(texto: string, colegio?: ColegioSharePointInput): string {
  if (isEScholarisSchool(colegio)) {
    return normalizarGradoEscholaris(texto)
  }
  return normalizarGrado(texto)
}

function normalizarMateria(texto: string, esOlimpiadas = false): string {
  const t = texto.toLowerCase()
    .replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i').replace(/ó/g,'o').replace(/ú/g,'u')
  if (/olimp.*mat/i.test(t)) return 'Olimpiadas - Matemática'
  if (/olimp.*biol/i.test(t)) return 'Olimpiadas - Biología'
  if (/olimp.*fis/i.test(t)) return 'Olimpiadas - Física'
  if (/olimp.*quim/i.test(t)) return 'Olimpiadas - Química'
  if (/olimp.*cien/i.test(t)) return 'Olimpiadas - Ciencias Naturales'
  if (/olimp/i.test(t)) return '__OLIMPIADAS__'
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

function esMateriaNumerica(materia: string): boolean {
  return isLikelyNumericSubject(materia)
}

const GRADOS_OLIMPIADAS: Record<string, string> = {
  '1ero Básico': 'Primero Basico', '2do Básico': 'Segundo Basico', '3ero Básico': 'Tercero Basico',
  '4to Bachillerato': 'Diversificado', '5to Bachillerato': 'Diversificado',
  '4to Primaria': 'Primaria', '5to Primaria': 'Primaria', '6to Primaria': 'Primaria',
}

const TEMAS_POR_MATERIA: Record<string, string[]> = {
  'Matemática': ['aritmética','aritmetica','algebra','álgebra','geometría','geometria','fracciones','ecuaciones','trigonometría','trigonometria','estadística','estadistica','probabilidad','porcentajes','decimales','números','numeros','matrices','funciones','polinomios','logaritmos'],
  'Física': ['cinemática','cinematica','dinámica','dinamica','fuerza','movimiento','velocidad','aceleración','aceleracion','energía','energia','trabajo','calor','temperatura','ondas','luz','electricidad','magnetismo','gravedad','óptica','optica'],
  'Química': ['átomo','atomo','molécula','molecula','enlace','reacción','reaccion','tabla periódica','tabla periodica','ácido','acido','base','solución','solucion','oxidación','oxidacion','elemento','compuesto','estequiometría'],
  'Biología': ['célula','celula','fotosíntesis','fotosintesis','adn','genética','genetica','evolución','evolucion','ecosistema','organismo','proteína','proteina','mitosis','meiosis','respiración celular'],
  'Historia': ['guerra','revolución','revolucion','independencia','civilización','civilizacion','colonia','conquista','maya','azteca','inca','república','republica','democracia','feudalismo'],
  'Español': ['gramática','gramatica','sintaxis','ortografía','ortografia','redacción','redaccion','literatura','poesía','poesia','narración','narracion','verbo','sustantivo','adjetivo','párrafo','parrafo'],
  'Inglés': ['vocabulary','grammar','verb','tense','sentence','reading','writing','speaking','listening','english'],
  'Ciencias Naturales': ['planta','animal','ecosistema','medio ambiente','naturaleza','suelo','agua','aire','clima','biodiversidad','nutrición','nutricion'],
}

function detectarMateriaDesdeTexto(texto: string): string | null {
  const t = texto.toLowerCase().replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i').replace(/ó/g,'o').replace(/ú/g,'u')
  for (const [materia, temas] of Object.entries(TEMAS_POR_MATERIA)) {
    for (const tema of temas) {
      const temaNorm = tema.replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i').replace(/ó/g,'o').replace(/ú/g,'u')
      if (t.includes(temaNorm)) return materia
    }
  }
  return null
}

const MATERIAS_OLIMPIADAS: Record<string, string> = {
  'Olimpiadas - Matemática': 'Matematica', 'Olimpiadas - Biología': 'Biologia',
  'Olimpiadas - Física': 'Fisica', 'Olimpiadas - Química': 'Quimica',
  'Olimpiadas - Ciencias Naturales': 'Ciencias Naturales',
}

const DOCS_CONFIG = [
  'Prompt Principal - Agente Alumno.docx', 'Politica Pedagogica Oficial - Agente Alumno.docx',
  'Documento Maestro - Agente Alumno.docx', 'Instrucciones SharePoint - Agente Alumno.docx',
  'Especificacion Tecnica - Agente Alumno.docx', 'Videos Español.docx', 'Videos Inglés.docx',
]

const PALABRAS_CRISIS = ['me quiero matar','suicidar','quitarme la vida','hacerme daño','autolesion','no quiero vivir','me voy a matar','quiero morir','abuso sexual','me violaron','me toca inapropiadamente']
const PALABRAS_FORMATIVAS = ['mi papá','mi mamá','mis padres','mi familia','pelea','problema en casa','me siento mal','triste','solo','amigos','bullying','me molestan','valores','convivencia','disciplina','hábitos','motivación','me pega','me golpea','me grita','me insulta','violencia en casa','mis padres pelean','me siento solo','no tengo amigos','me hacen menos','me discriminan','me ignoran','no me entienden','estoy deprimido','me preocupa','tengo miedo','no sé qué hacer','necesito ayuda','me siento triste','estoy triste','muy triste','problema familiar','no me quieren','me castigan','me regañan','mis papás']

function detectarTipoPregunta(pregunta: string): 'crisis' | 'formativa' | 'academica' {
  const p = pregunta.toLowerCase()
  if (PALABRAS_CRISIS.some(w => p.includes(w))) return 'crisis'
  if (PALABRAS_FORMATIVAS.some(w => p.includes(w))) return 'formativa'
  return 'academica'
}

function esSaludo(pregunta: string): boolean {
  const saludos = ['hola','buenos días','buenas tardes','buenas noches','hi','hello','buenas','hey']
  const p = pregunta.toLowerCase().trim()
  return saludos.some(s => p === s || p.startsWith(s + ' ') || p.startsWith(s + ','))
}

function detectarCopia(pregunta: string): boolean {
  return ['hazme la tarea','dame las respuestas','dame la respuesta','solo dime qué va','resuelve todo']
    .some(p => pregunta.toLowerCase().includes(p))
}

function ultimoMensajeAsistente(historial: { rol: string; contenido: string }[] | undefined): string {
  if (!Array.isArray(historial)) return ''
  for (let i = historial.length - 1; i >= 0; i--) {
    if (historial[i]?.rol !== 'usuario') return historial[i]?.contenido || ''
  }
  return ''
}

async function getToken(): Promise<string | null> {
  try {
    const res = await fetch(`https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: process.env.AZURE_CLIENT_ID!, client_secret: process.env.AZURE_CLIENT_SECRET!, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' }),
    })
    const data = await res.json()
    return data.access_token || null
  } catch { return null }
}

type ArchivoSharePoint = {
  name: string
  file?: unknown
  folder?: unknown
  parentReference?: { path?: string }
  '@microsoft.graph.downloadUrl'?: string
}

async function listarHijos(driveId: string, token: string, ...segs: string[]): Promise<ArchivoSharePoint[]> {
  const ruta = segs.map(s => encodeURIComponent(s)).join('/')
  const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${ruta}:/children`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return []
  const data = await res.json()
  return data.value || []
}

async function listarArchivos(driveId: string, token: string, ...segs: string[]) {
  const hijos = await listarHijos(driveId, token, ...segs)
  return hijos.filter((a: ArchivoSharePoint) => a.file && isSupportedSharePointContentFile(a.name))
}

async function buscarArchivosPorBusqueda(driveId: string, token: string, query: string, ...segs: string[]) {
  const ruta = segs.map(s => encodeURIComponent(s)).join('/')
  const safeQuery = encodeURIComponent(query.replace(/'/g, "''"))
  const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${ruta}:/search(q='${safeQuery}')`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return []
  const data = await res.json()
  return (data.value || []).filter((a: ArchivoSharePoint) => a.file && isSupportedSharePointContentFile(a.name))
}

async function extraerTexto(url: string, nombreArchivo = ''): Promise<string> {
  const r = await fetch(url)
  if (!r.ok) return ''
  if (isSharePointPlainTextContent(nombreArchivo)) {
    return (await r.text()).replace(/\r\n/g, '\n').trim()
  }
  const buf = await r.arrayBuffer()
  const m = await import('mammoth')
  const { value } = await m.extractRawText({ buffer: Buffer.from(buf) })
  return value
}

const indiceDocumentos = new Map<string, { nombre: string; tema: string; downloadUrl: string }[]>()

async function construirIndiceDesdeArchivos(idxKey: string, logLabel: string, archivos: ArchivoSharePoint[]) {
  const cached = indiceDocumentos.get(idxKey)
  if (cached) return cached
  console.log('Construyendo indice: ' + logLabel)
  if (archivos.length === 0) return []
  const indice: { nombre: string; tema: string; downloadUrl: string }[] = []
  await Promise.all(archivos.map(async (archivo: ArchivoSharePoint) => {
    const downloadUrl = archivo['@microsoft.graph.downloadUrl']
    if (!downloadUrl) return
    try {
      const value = await extraerTexto(downloadUrl, archivo.name)
      indice.push({ nombre: archivo.name, tema: value.substring(0, 300).trim(), downloadUrl })
    } catch {
      indice.push({ nombre: archivo.name, tema: archivo.name, downloadUrl })
    }
  }))
  indiceDocumentos.set(idxKey, indice)
  console.log(`✅ Índice construido: ${indice.length} documentos`)
  setTimeout(() => indiceDocumentos.delete(idxKey), CACHE_TTL)
  return indice
}

async function construirIndice(driveId: string, token: string, ...segs: string[]) {
  const idxKey = 'idx/' + segs.join('/')
  const cached = indiceDocumentos.get(idxKey)
  if (cached) return cached
  const archivos = await listarArchivos(driveId, token, ...segs)
  return construirIndiceDesdeArchivos(idxKey, segs.join('/'), archivos)
}

async function buscarContenido(colegio: ColegioSharePointInput, grado: string, materia: string, pregunta: string) {
  const token = await getToken()
  if (!token) return { contenido: '', archivo: null }
  const driveId = process.env.SHAREPOINT_DRIVE_ID!
  const colegiosSP = getSharePointFolderCandidates(colegio, { includeShared: false })
  const carpetasCompartidas = getSharePointFolderCandidates(colegio, { sharedOnly: true })
  const permitirCompartidas = includeSharedPrograms(colegio)
  let indice: { nombre: string; tema: string; downloadUrl: string }[] = []
  if (materia.startsWith('Olimpiadas') && permitirCompartidas) {
    const carpetaMateria = MATERIAS_OLIMPIADAS[materia] || materia.replace('Olimpiadas - ', '')
    const carpetaGrado = GRADOS_OLIMPIADAS[grado] || grado
    for (const carpetaColegio of carpetasCompartidas.length > 0 ? carpetasCompartidas : [CARPETA_COMPARTIDA]) {
      for (const gradoCarpeta of getGradeFolderCandidates(carpetaGrado)) {
        indice = await construirIndice(driveId, token, 'Owlaris', carpetaColegio, 'Olimpiadas de Ciencias', carpetaMateria, gradoCarpeta)
        if (indice.length > 0) break
      }
      if (indice.length > 0) break
      indice = await construirIndice(driveId, token, 'Owlaris', carpetaColegio, 'Olimpiadas de Ciencias', carpetaMateria)
      if (indice.length > 0) break
    }
  } else {
    const buscarEnGrado = async (raizSegs: string[], gradoB: string, materiaB: string) => {
      const buscarPorBusqueda = async () => {
        for (const termino of [materiaB, ...getGradeFolderCandidates(gradoB)]) {
          const archivosBusqueda = await buscarArchivosPorBusqueda(driveId, token, termino, ...raizSegs)
          const matches = archivosBusqueda.filter((archivo: ArchivoSharePoint) => {
            const textoUbicacion = `${archivo.name} ${archivo.parentReference?.path || ''}`
            return sharePointNameMatchesSubject(textoUbicacion, materiaB) &&
              sharePointTextMatchesGrade(textoUbicacion, gradoB)
          })
          if (matches.length > 0) {
            return construirIndiceDesdeArchivos(
              'idx/' + [...raizSegs, gradoB, 'search', normalizeSharePointKey(materiaB)].join('/'),
              [...raizSegs, gradoB].join('/') + ' [search:' + materiaB + ']',
              matches
            )
          }
        }
        return []
      }

      let idx = await construirIndice(driveId, token, ...raizSegs, gradoB, materiaB)
      if (idx.length > 0) return idx
      const hijos = await listarHijos(driveId, token, ...raizSegs, gradoB)
      if (hijos.length === 0) return buscarPorBusqueda()
      const carpetas: string[] = hijos.filter((i: ArchivoSharePoint) => i.folder).map((i: ArchivoSharePoint) => i.name)
      const mLower = normalizeSharePointKey(materiaB)
      const match = carpetas.find(cp => {
        const cl = normalizeSharePointKey(cp)
        return cl.includes(mLower) || mLower.includes(cl)
      })
      if (match) idx = await construirIndice(driveId, token, ...raizSegs, gradoB, match)
      if (idx.length > 0) return idx

      const archivosDirectos = hijos
        .filter((i: ArchivoSharePoint) => i.file && isSupportedSharePointContentFile(i.name))
        .filter((archivo: ArchivoSharePoint) => sharePointNameMatchesSubject(archivo.name, materiaB))
      if (archivosDirectos.length > 0) {
        idx = await construirIndiceDesdeArchivos(
          'idx/' + [...raizSegs, gradoB, 'direct', normalizeSharePointKey(materiaB)].join('/'),
          [...raizSegs, gradoB].join('/') + ' [direct:' + materiaB + ']',
          archivosDirectos
        )
      }
      if (idx.length > 0) return idx

      return buscarPorBusqueda()
    }
    for (const carpetaColegio of colegiosSP) {
      for (const gradoCarpeta of getGradeFolderCandidates(grado)) {
        indice = await buscarEnGrado(['Owlaris', carpetaColegio], gradoCarpeta, materia)
        if (indice.length > 0) break
      }
      if (indice.length > 0) break
    }
    if (permitirCompartidas && indice.length === 0) indice = await construirIndice(driveId, token, 'Owlaris', CARPETA_COMPARTIDA, 'Preparación pruebas nacionales', 'Mineduc', grado, materia)
    if (permitirCompartidas && indice.length === 0) indice = await construirIndice(driveId, token, 'Owlaris', CARPETA_COMPARTIDA, 'Preparación pruebas nacionales', 'Mineduc', materia)
  }
  if (indice.length === 0) return { contenido: '', archivo: null }
  const preguntaLower = pregunta.toLowerCase()
  const palabras = preguntaLower.split(/\s+/).filter(p => p.length > 3)
  let mejorPuntaje = -1, mejorDoc = indice[0]
  for (const doc of indice) {
    const temaLower = doc.tema.toLowerCase()
    let puntaje = 0
    for (const palabra of palabras) {
      if (temaLower.includes(palabra)) puntaje += 2
      if (doc.nombre.toLowerCase().includes(palabra)) puntaje += 1
    }
    if (puntaje > mejorPuntaje) { mejorPuntaje = puntaje; mejorDoc = doc }
  }
  console.log(`✅ Elegido: ${mejorDoc.nombre} (puntaje: ${mejorPuntaje})`)
  const cacheKey = `${colegiosSP.join('|')}/${grado}/${materia}/${mejorDoc.nombre}`
  const cached = cacheContenido.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) return { contenido: cached.contenido, archivo: cached.archivo }
  const contenido = await extraerTexto(mejorDoc.downloadUrl, mejorDoc.nombre)
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
      const texto = await extraerTexto(data['@microsoft.graph.downloadUrl'], doc)
      contenido += `\n\n=== ${doc} ===\n${texto.substring(0, 2000)}`
      console.log(`✅ Config: ${doc}`)
    } catch (e) { console.log(`Error config ${doc}:`, e) }
  }
  cacheConfig.set('config', { contenido, timestamp: Date.now() })
  return contenido
}

async function leerCarpetasGrado(
  grado: string,
  idiomaIngles: boolean,
  carpetasColegio: string[] = [CARPETA_COMPARTIDA]
): Promise<string[]> {
  const token = await getToken()
  if (!token) return []
  const driveId = process.env.SHAREPOINT_DRIVE_ID!
  const carpetas: string[] = []
  const buscarMateriasPorBusqueda = async (carpetaColegio: string) => {
    const materias: string[] = []
    for (const termino of getGradeFolderCandidates(grado)) {
      const archivos = await buscarArchivosPorBusqueda(driveId, token, termino, 'Owlaris', carpetaColegio)
      archivos
        .filter((archivo: ArchivoSharePoint) => sharePointTextMatchesGrade(`${archivo.name} ${archivo.parentReference?.path || ''}`, grado))
        .map((archivo: ArchivoSharePoint) => inferSubjectFromSharePointName(archivo.name))
        .filter((materia: string | null): materia is string => Boolean(materia))
        .forEach((materia: string) => pushUniqueSharePointName(materias, materia))
      if (materias.length > 0) break
    }
    return materias
  }

  for (const carpetaColegio of carpetasColegio) {
    for (const gradoCarpeta of getGradeFolderCandidates(grado)) {
      try {
        const ruta = encodeURIComponent('Owlaris') + '/' + encodeURIComponent(carpetaColegio) + '/' + encodeURIComponent(gradoCarpeta)
        const url = 'https://graph.microsoft.com/v1.0/drives/' + driveId + '/root:/' + ruta + ':/children'
        const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } })
        if (res.ok) {
          const data = await res.json()
          const value = data.value || []
          const carpetasMateria = value
            .filter((i: {folder?:unknown}) => i.folder)
            .map((i: {name:string}) => i.name)
          const materiasDesdeDocumentos = value
            .filter((i: {file?:unknown; name:string}) => i.file && isSupportedSharePointContentFile(i.name))
            .map((i: {name:string}) => inferSubjectFromSharePointName(i.name))
            .filter((materia: string | null): materia is string => Boolean(materia))
          ;[...carpetasMateria, ...materiasDesdeDocumentos].forEach(materia => {
            pushUniqueSharePointName(carpetas, materia)
          })
          if (carpetasMateria.length > 0 || materiasDesdeDocumentos.length > 0) break
        }
      } catch { /* silencioso */ }
    }
    if (carpetas.length === 0) {
      const materiasEncontradas = await buscarMateriasPorBusqueda(carpetaColegio).catch(() => [])
      materiasEncontradas.forEach(materia => pushUniqueSharePointName(carpetas, materia))
    }
    if (carpetas.length > 0) break
  }
  carpetas.push(idiomaIngles ? '» English Conversation' : '» Conversar en Inglés')
  return carpetas
}

function combinarConAccesosEspeciales(materias: string[], idiomaIngles: boolean, grado: string, incluirCompartidas: boolean) {
  const out = Array.from(new Set(materias.filter(Boolean)))
  if (incluirCompartidas) {
    getSharedSubjectChipsForGrade(grado).forEach(materia => {
      if (!out.includes(materia)) out.push(materia)
    })
  }
  const conversacion = idiomaIngles ? '» English Conversation' : '» Conversar en Inglés'
  if (!out.includes(conversacion)) out.push(conversacion)
  return out
}

function normalizarClaveSeleccion(texto: string) {
  return (texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[»🎙️🏆]/g, '')
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function resolverMateriaSeleccionada(texto: string, disponibles: string[], permitirOlimpiadas: boolean) {
  const entrada = normalizarClaveSeleccion(texto)
  if (!entrada) return ''

  const disponiblesCurriculares = disponibles.filter(Boolean)
  const matchDirecto = disponiblesCurriculares.find(m => normalizarClaveSeleccion(m) === entrada)
  if (matchDirecto) return matchDirecto

  if (permitirOlimpiadas && /olimpiad|competencia/.test(entrada)) {
    const existeOlimpiadas = disponiblesCurriculares.some(m => normalizarClaveSeleccion(m).includes('olimpiadas'))
    if (existeOlimpiadas) return '__OLIMPIADAS__'
  }

  const normalizada = normalizarMateria(texto)
  const normalizadaKey = normalizarClaveSeleccion(normalizada)
  if (!normalizadaKey || normalizada === texto.trim()) return ''

  const matchNormalizado = disponiblesCurriculares.find(m => {
    const materiaKey = normalizarClaveSeleccion(m)
    return materiaKey === normalizadaKey || materiaKey.includes(normalizadaKey) || normalizadaKey.includes(materiaKey)
  })
  return matchNormalizado || ''
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
          const mid = Math.floor(texto.length / 2)
          contenido += `\n--- ${doc.name} ---\n${texto.substring(0, 1000)}\n...\n${texto.substring(mid, mid+1000)}\n...\n${texto.substring(texto.length - 1000)}\n`
        }
      } catch { /* silencioso */ }
    }
  } catch { /* silencioso */ }
  return contenido
}

async function registrarPendiente(_supabase: ReturnType<typeof import('@/lib/supabase/server').createClient>, perfil: { colegio_id: string; grado: string | null }, materia: { nombre: string }, pregunta: string) {
  const admin = createAdminClient()
  const tema = pregunta.substring(0, 150)
  const { data: existente } = await admin.from('pendientes').select('id, veces_solicitado').eq('colegio_id', perfil.colegio_id).eq('materia', materia.nombre).eq('tema_solicitado', tema).single()
  if (existente) {
    await admin.from('pendientes').update({ veces_solicitado: existente.veces_solicitado + 1 }).eq('id', existente.id)
  } else {
    await admin.from('pendientes').insert({ colegio_id: perfil.colegio_id, grado: perfil.grado || '', materia: materia.nombre, tema_solicitado: tema, veces_solicitado: 1, resuelto: false })
  }
}

function respuestaSinFuenteSuficiente(idiomaIngles: boolean) {
  return idiomaIngles
    ? 'With the content available for this subject, I do not have enough information to answer that safely. We can continue with a topic that is covered in your subject material, or you can ask your teacher to add this material.'
    : 'Con el contenido disponible para esta materia, no tengo suficiente información para responder eso con seguridad. Podemos continuar con un tema que sí esté cubierto en el material, o puedes pedirle a tu maestro que agregue este contenido.'
}

function normalizarTextoBase(texto: string) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function pideLeccionSinTema(pregunta: string) {
  const texto = normalizarTextoBase(pregunta)
  const match = texto.match(/\b(?:leccion|lesson)\s*(?:numero|no\.?|#)?\s*\d+\b/)
  if (!match) return false
  const despues = texto.slice((match.index || 0) + match[0].length)
  const mencionaTemaDespues = /\b(?:de|sobre|about|tema|concepto|habilidad|competencia|ejercicio)\s+[a-z]{4,}/.test(despues)
  return !mencionaTemaDespues
}

function respuestaPedirTemaLeccion(idiomaIngles: boolean) {
  return idiomaIngles
    ? 'I can help you with that, but Owlaris does not work by lesson number. Tell me the topic, concept, skill, or exercise you want to review, and we will work through it step by step.'
    : 'Sí puedo ayudarte con eso, pero Owlaris no trabaja por número de lección. Dime el tema, concepto, habilidad o ejercicio que quieres revisar, y lo trabajamos paso a paso.'
}

type TipoRacha = 'correcta' | 'incorrecta'

function clasificarInteraccionAprendizaje(row: { respuesta?: string | null; estado_evaluacion?: string | null }): TipoRacha | null {
  const estado = row.estado_evaluacion || ''
  if (estado === 'correcto' || estado === 'equivalente') return 'correcta'
  if (estado === 'incorrecto') return 'incorrecta'
  const respuesta = normalizarTextoBase(row.respuesta || '')
  if (respuesta.includes('incorrecto') || respuesta.includes('no es correcto') || respuesta.includes('todavia no llegamos') || respuesta.includes('todavía no llegamos') || respuesta.includes('incorrect')) return 'incorrecta'
  if (respuesta.startsWith('correcto') || respuesta.startsWith('correct.') || respuesta.includes('¡correcto!')) return 'correcta'
  return null
}

async function obtenerRachaAprendizaje(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  materiaUuid: string | null
) {
  try {
    let query = admin
      .from('interacciones')
      .select('respuesta, estado_evaluacion')
      .eq('usuario_id', userId)
      .order('creado_en', { ascending: false })
      .limit(12)
    if (materiaUuid) query = query.eq('materia_id', materiaUuid)
    const { data } = await query

    let tipo: TipoRacha | null = null
    let total = 0
    for (const row of data || []) {
      const clasificacion = clasificarInteraccionAprendizaje(row)
      if (!clasificacion) continue
      if (!tipo) tipo = clasificacion
      if (clasificacion !== tipo) break
      total += 1
    }
    return {
      correctas: tipo === 'correcta' ? total : 0,
      incorrectas: tipo === 'incorrecta' ? total : 0,
    }
  } catch (e) {
    console.error('No se pudo calcular racha de aprendizaje:', e)
    return { correctas: 0, incorrectas: 0 }
  }
}

function construirContextoAdaptativo(input: { correctas: number; incorrectas: number; nivel: number; idiomaIngles: boolean }) {
  const nivel = Math.min(8, Math.max(1, Number.isFinite(input.nivel) ? input.nivel : 1))
  if (input.incorrectas >= 4) {
    return input.idiomaIngles
      ? `\n\nADAPTIVE DIFFICULTY: The student has ${input.incorrectas} incorrect answers in a row. Lower the difficulty from level ${nivel} as a diagnosis. Find the missing prerequisite concept, explain one basic step, and then return gradually to the original topic. Do not frame this as failure or punishment.`
      : `\n\nDIFICULTAD ADAPTATIVA: El estudiante acumula ${input.incorrectas} respuestas en práctica seguidas. Baja la dificultad desde el nivel ${nivel} como diagnóstico. Busca el concepto previo que falta, explica una base concreta y vuelve gradualmente al tema original. No lo presentes como castigo ni fracaso.`
  }
  if (input.correctas >= 5) {
    return input.idiomaIngles
      ? `\n\nADAPTIVE DIFFICULTY: The student has ${input.correctas} correct answers in a row. Raise the difficulty only at controlled checkpoints of 5 correct answers, with a slightly harder exercise and without skipping conceptual checks.`
      : `\n\nDIFICULTAD ADAPTATIVA: El estudiante lleva ${input.correctas} respuestas correctas seguidas. Sube la dificultad solo en puntos controlados de 5 aciertos, con un ejercicio un poco más retador y sin saltarte la verificación conceptual.`
  }
  return input.idiomaIngles
    ? `\n\nADAPTIVE DIFFICULTY: Current working level ${nivel}. Keep the exercise appropriate to the student's grade and the selected subject.`
    : `\n\nDIFICULTAD ADAPTATIVA: Nivel de trabajo actual ${nivel}. Mantén el ejercicio adecuado al grado y a la materia seleccionada.`
}

function reforzarDiagnosticoPorFallos(respuesta: string, idiomaIngles: boolean, fallosConsecutivos: number) {
  if (fallosConsecutivos < 4) return respuesta
  const refuerzo = idiomaIngles
    ? 'Let us lower the difficulty for a moment, not as a punishment, but to find the missing base. First, let us review the simplest step involved here.'
    : 'Vamos a bajar la dificultad por un momento, no como castigo, sino para encontrar la base que falta. Primero revisemos el paso más simple de este procedimiento.'
  return `${respuesta}\n\n${refuerzo}`
}

const ENFOQUES_PRACTICA_VALIDOS: MathPracticeFocus[] = ['equation', 'decimal', 'suma_resta', 'multiplicacion_division', 'suma', 'resta', 'multiplicacion', 'division']

async function cargarOperacionesEvaluadas(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  materiaUuid?: string | null
) {
  try {
    let query = supabase
      .from('interacciones')
      .select('operacion_canonica')
      .eq('usuario_id', userId)
      .eq('op_estado', 'evaluada')
      .not('operacion_canonica', 'is', null)
    if (materiaUuid) query = query.eq('materia_id', materiaUuid)
    const { data, error } = await query
      .order('creado_en', { ascending: false })
      .limit(1000)
    if (error) throw error
    return (data || [])
      .map((row: { operacion_canonica: string | null }) => row.operacion_canonica || '')
      .filter(Boolean)
  } catch (error) {
    console.error('No se pudieron cargar operaciones evaluadas:', error)
    return []
  }
}

function combinarOperacionesBloqueadas(...grupos: Array<Array<string | null | undefined>>) {
  const out: string[] = []
  const seen = new Set<string>()
  for (const grupo of grupos) {
    for (const op of grupo) {
      const canonical = inferCanonicalOperationFromText(String(op || '')) || String(op || '')
      const key = canonical.replace(/\s+/g, '').toLowerCase()
      if (canonical && key && !seen.has(key)) {
        seen.add(key)
        out.push(canonical)
      }
    }
  }
  return out
}

async function obtenerFuenteCurricularParaPractica(input: {
  colegio: ColegioSharePointInput
  grado: string
  materiaConsulta: string
  pregunta: string
  fallbackArchivo?: string | null
}) {
  if (!input.materiaConsulta) return { contenido: '', archivo: input.fallbackArchivo || null }
  try {
    const result = await buscarContenido(input.colegio, input.grado, input.materiaConsulta, input.pregunta)
    return {
      contenido: result.contenido || '',
      archivo: result.archivo || input.fallbackArchivo || null,
    }
  } catch (error) {
    console.error('No se pudo obtener fuente curricular de práctica:', error)
    return { contenido: '', archivo: input.fallbackArchivo || null }
  }
}

function buildEnglishConversationSystemPrompt(input: { entradaVoz: boolean; speechConfidence: number | null }) {
  const confidenceHint = input.entradaVoz
    ? input.speechConfidence !== null
      ? `\nVOICE SIGNAL: The student's speech recognition confidence was ${input.speechConfidence.toFixed(2)}. If it is below 0.72, include one short pronunciation tip or ask them to repeat one useful phrase slowly.`
      : '\nVOICE SIGNAL: The student spoke by microphone. Include pronunciation coaching when it naturally helps, but do not claim you heard sounds you cannot verify.'
    : ''

  return `You are Owlaris, a premium English conversation coach for Guatemalan students.
ALWAYS respond in English only.
Prioritize speed, warmth, and live speaking practice.
Keep the reply under 45 words.
Use this structure when useful:
1. Model one improved phrase with "Try saying: ..."
2. Give one tiny pronunciation or fluency tip.
3. Ask exactly one natural follow-up question.
Do not lecture. Do not switch to Spanish. Do not grade harshly.
For pronunciation, be honest: correct likely stress, rhythm, clarity, or word choice from the transcript; never pretend you can measure exact phonemes.${confidenceHint}`
}

async function registrarAlertaContenido(
  _supabase: ReturnType<typeof import('@/lib/supabase/server').createClient>,
  userId: string,
  perfil: { colegio_id: string; grado?: string | null; nombre_completo?: string | null },
  safety: ContentSafetyResult,
  pregunta: string,
  materiaSeleccionada: string,
  gradoEfectivo: string
) {
  try {
    if (!safety.bloqueado || !safety.debeAlertar) return
    const admin = createAdminClient()

    const hace1h = new Date(Date.now() - 3600000).toISOString()
    const { data: existente } = await admin
      .from('alertas')
      .select('id')
      .eq('alumno_id', userId)
      .eq('tipo', 'seguridad_contenido')
      .eq('resuelta', false)
      .gte('creado_en', hace1h)
      .maybeSingle()
    if (existente) return

    let asig = null
    const { data: asigAlumno } = await admin
      .from('guia_asignaciones')
      .select('guia_id, guia:guia_id(email, nombre_completo)')
      .eq('colegio_id', perfil.colegio_id)
      .eq('activo', true)
      .eq('tipo', 'alumno')
      .eq('alumno_id', userId)
      .limit(1)
      .maybeSingle()

    if (asigAlumno) {
      asig = asigAlumno
    } else {
      const { data: asigGrado } = await admin
        .from('guia_asignaciones')
        .select('guia_id, guia:guia_id(email, nombre_completo)')
        .eq('colegio_id', perfil.colegio_id)
        .eq('activo', true)
        .eq('tipo', 'grado')
        .eq('grado', gradoEfectivo || perfil.grado || '')
        .limit(1)
        .maybeSingle()
      asig = asigGrado
    }

    const alumno = perfil.nombre_completo || 'Alumno'
    const resumenPregunta = pregunta.replace(/\s+/g, ' ').trim().substring(0, 280)
    const contexto = [
      `Categoria: ${safety.tipo}`,
      `Severidad: ${safety.severidad}`,
      `Grado: ${gradoEfectivo || perfil.grado || 'N/D'}`,
      `Materia: ${materiaSeleccionada || 'N/D'}`,
      `Pregunta: ${resumenPregunta}`,
    ].join(' | ')

    await admin.from('alertas').insert({
      alumno_id: userId,
      colegio_id: perfil.colegio_id,
      guia_id: asig?.guia_id || null,
      tipo: 'seguridad_contenido',
      descripcion: `${alumno} activó una alerta de seguridad (${safety.tipo}, severidad ${safety.severidad}).`,
      contexto,
    })

    if (asig?.guia && process.env.RESEND_API_KEY) {
      try {
        const guia = asig.guia as unknown as { email: string; nombre_completo: string }
        const { Resend } = await import('resend')
        await new Resend(process.env.RESEND_API_KEY).emails.send({
          from: 'Owlaris <noreply@owlaris.app>',
          to: guia.email,
          subject: 'Alerta de seguridad (' + safety.severidad + ') - ' + alumno,
          html: '<p>Hola ' + guia.nombre_completo + ',</p><p><strong>' + alumno + '</strong> activó una alerta de seguridad en Owlaris.</p><p><strong>Categoría:</strong> ' + safety.tipo + '<br/><strong>Severidad:</strong> ' + safety.severidad + '</p><p>Contexto: ' + contexto + '</p><a href="https://owlaris.app/guia">Ver en Owlaris</a>'
        })
      } catch (e) { console.error('Email alerta seguridad:', e) }
    }
  } catch (e) {
    console.error('Error registrando alerta de contenido:', e)
  }
}

export async function POST(req: NextRequest) {
  let colegioIdParaAlerta: string | null = null
  try {
    const OpenAI = (await import('openai')).default
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const supabase = createClient()
    const admin = createAdminClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await req.json()
    const { pregunta, historial, alerta_comprension = false, alerta_materia = '', alerta_tema = '' } = body
    const materia_id = body.materia_id || body.materia_detectada || ''
    const userId: string = body.user_id || ''
    const idiomaIngles: boolean = body.idioma_ingles || false
    const practicaEnfoquePersistido = body.practica_enfoque
    const practicaEnfoqueEstable: MathPracticeFocus = ENFOQUES_PRACTICA_VALIDOS.includes(practicaEnfoquePersistido as MathPracticeFocus)
      ? practicaEnfoquePersistido as MathPracticeFocus
      : 'general'

    const grado_override = body.grado_override || body.grado_detectado || ''
    if (!pregunta?.trim()) return NextResponse.json({ error: 'Pregunta vacía' }, { status: 400 })

    const { data: perfil } = await supabase.from('usuarios').select('*, colegio:colegios(*)').eq('id', user.id).single()
    if (!perfil) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    colegioIdParaAlerta = perfil.colegio_id

    // CONTENT SAFETY - proteccion deterministica para menores
    const safety = checkContentSafety(pregunta, idiomaIngles)
    if (safety.bloqueado) {
      await registrarAlertaContenido(
        supabase,
        user.id,
        perfil,
        safety,
        pregunta,
        materia_id,
        grado_override || perfil.grado || ''
      )
      // El reporte para padres cuenta estos eventos a partir de interacciones,
      // asi que se registra uno aqui tambien (antes solo quedaba en "alertas",
      // invisible para /api/reporte). El tema_detectado es generico a proposito:
      // no se expone el texto sensible tal cual en un reporte familiar.
      await supabase.from('interacciones').insert({
        usuario_id: user.id,
        colegio_id: perfil.colegio_id,
        materia_id: null,
        grado: grado_override || perfil.grado || '',
        tema_detectado: idiomaIngles ? 'Safety alert' : 'Alerta de seguridad',
        pregunta,
        respuesta: safety.respuesta,
        tokens_usados: 0,
        costo_usd: 0,
        modelo_usado: 'content_safety',
        documento_fuente: null,
        sospecha_copia: false,
        operacion_canonica: null,
        op_estado: null,
        estado_evaluacion: 'alerta_seguridad',
        guard_activado: true,
      })
      return NextResponse.json({
        respuesta: safety.respuesta,
        source: 'content_safety',
        nuevo_estado: 'activo',
        tokens: 0,
        safety_tipo: safety.tipo,
        safety_severidad: safety.severidad,
      })
    }

    const { data: configs } = await admin
      .from('configuracion')
      .select('clave, valor')
      .eq('colegio_id', perfil.colegio_id)
    const cfg: Record<string, string> = {}
    configs?.forEach(c => { cfg[c.clave] = c.valor })

    if (cfg.modo_mantenimiento === 'true') return NextResponse.json({ error: 'El tutor está en mantenimiento.' }, { status: 503 })

    const limite = parseInt(cfg.limite_preguntas_diarias || '999')
    if (limite < 999) {
      const hoy = new Date().toISOString().split('T')[0]
      const { count } = await supabase.from('interacciones').select('*', { count: 'exact', head: true }).eq('usuario_id', user.id).gte('creado_en', `${hoy}T00:00:00`)
      if ((count || 0) >= limite) return NextResponse.json({ error: `Limite de ${limite} preguntas alcanzado.` }, { status: 429 })
    }

    const { data: materiaPorId } = await supabase.from('materias').select('*').eq('id', materia_id).single()
    const { data: materiaPorNombre } = !materiaPorId && materia_id ? await supabase.from('materias').select('*').ilike('nombre', materia_id).eq('colegio_id', perfil.colegio_id).single() : { data: null }
    const materia = materiaPorId || materiaPorNombre
    const materia_uuid = materia?.id || null
    const materiaConsultaSharePoint = materia?.nombre || materia_id || ''
    const gradoEfectivo = grado_override || perfil.grado
    const colegioSharePoint = perfil.colegio || null
    const carpetasColegio = getSharePointFolderCandidates(perfil.colegio, { includeShared: false })
    const incluirOlimpiadas = includeSharedPrograms(colegioSharePoint)
    const materiaNumerica = esMateriaNumerica(materia?.nombre || materia_id || '')
    const guardarGradoAlumno = async (grado: string) => {
      if (!grado) return
      const { error } = await admin.from('usuarios').update({ grado }).eq('id', user.id)
      if (error) console.error('No se pudo guardar grado:', error.message)
    }
    const cargarMateriasDisponibles = async (grado: string) => {
      let carpetas = await leerCarpetasGrado(grado, idiomaIngles, carpetasColegio)
      carpetas = combinarConAccesosEspeciales(carpetas, idiomaIngles, grado, incluirOlimpiadas)
      return carpetas
    }

    // ── ONBOARDING ──────────────────────────────────────────────────
    const estado: string = body.estado || 'activo'
    const nombreAlumno: string = body.nombre_alumno || ''
    const gradoAlumno: string = body.grado_override || ''

    if (pregunta === '__CARGAR_MATERIAS__' || (estado === 'esperando_materia' && gradoAlumno && !pregunta.trim())) {
      const grado = gradoAlumno || grado_override || perfil.grado || ''
      if (grado) {
        await guardarGradoAlumno(grado)
        const carpetas = await cargarMateriasDisponibles(grado)
        return NextResponse.json({ materias_disponibles: carpetas, respuesta: '', tokens: 0 })
      }
    }

    if (estado === 'esperando_nombre') {
      const nombre = pregunta.trim().split(' ')[0]
      return NextResponse.json({ respuesta: idiomaIngles ? 'Hi, ' + nombre + '! Great to have you here. What grade are you in?' : '¡Hola, ' + nombre + '! Qué bueno tenerte aquí. ¿En qué grado estás?', nuevo_estado: 'esperando_grado', nombre_alumno: nombre, tokens: 0 })
    }

    if (estado === 'esperando_grado') {
      const gradoDetectado = normalizarGradoPorColegio(pregunta, colegioSharePoint)
      if (!gradoDetectado) return NextResponse.json({ respuesta: 'No reconocí ese grado. ¿Puedes decirme tu grado? Por ejemplo: "4to Primaria", "3ero Básico", "5to Bachillerato"...', nuevo_estado: 'esperando_grado', nombre_alumno: nombreAlumno, tokens: 0 })
      await guardarGradoAlumno(gradoDetectado)
      const carpetasG = await cargarMateriasDisponibles(gradoDetectado)
      return NextResponse.json({ respuesta: idiomaIngles ? `Perfect, ${nombreAlumno}! What would you like to study?` : `Perfecto, ${nombreAlumno}. ¿Qué quieres estudiar hoy?`, nuevo_estado: 'esperando_materia', nombre_alumno: nombreAlumno, grado_detectado: gradoDetectado, materias_disponibles: carpetasG, tokens: 0 })
    }

    if (estado === 'esperando_materia') {
      const gradoMostrar = gradoAlumno || body.grado_detectado || ''
      const disponibles = await cargarMateriasDisponibles(gradoMostrar || perfil.grado || '')
      const materiaSeleccionada = resolverMateriaSeleccionada(pregunta, disponibles, incluirOlimpiadas)
      if (materiaSeleccionada === '__OLIMPIADAS__') {
        return NextResponse.json({ respuesta: 'Olimpiadas, perfecto. ¿De cuál materia? Matemática, Biología, Física, Química o Ciencias Naturales.', nuevo_estado: 'esperando_materia_olimpiadas', nombre_alumno: nombreAlumno, grado_detectado: gradoMostrar, materias_disponibles: disponibles, tokens: 0 })
      }
      if (!materiaSeleccionada) {
        return NextResponse.json({
          respuesta: idiomaIngles
            ? 'Please choose one of the subject buttons below. I cannot use that as a subject.'
            : 'Elige una materia de los botones de abajo. No voy a tomar ese mensaje como materia.',
          nuevo_estado: 'esperando_materia',
          nombre_alumno: nombreAlumno,
          grado_detectado: gradoMostrar,
          materias_disponibles: disponibles,
          tokens: 0,
        })
      }
      return NextResponse.json({
        respuesta: idiomaIngles ? 'Great, let\'s study that subject! What topic would you like to work on, or do you have a specific question?' : '¡Perfecto, vamos con esa materia! ¿Qué tema te gustaría trabajar, o tienes alguna duda específica?',
        nuevo_estado: 'activo',
        nombre_alumno: nombreAlumno,
        grado_detectado: gradoAlumno,
        materia_detectada: materiaSeleccionada,
        tokens: 0,
        pending_math_interaction_id: null,
        nivel_dificultad: 1,
        aciertos_consecutivos: 0,
        fallos_consecutivos: 0,
        practica_enfoque: 'general',
      })
    }

    if (estado === 'esperando_materia_olimpiadas') {
      if (!incluirOlimpiadas) {
        const disponibles = await cargarMateriasDisponibles(gradoAlumno || perfil.grado || '')
        return NextResponse.json({
          respuesta: idiomaIngles
            ? 'Choose one of your available classes below.'
            : 'Elige una de tus clases disponibles abajo.',
          nuevo_estado: 'esperando_materia',
          nombre_alumno: nombreAlumno,
          grado_detectado: gradoAlumno || perfil.grado || '',
          materias_disponibles: disponibles,
          tokens: 0,
        })
      }
      const materiaDetectada = normalizarMateria(pregunta, true)
      return NextResponse.json({ respuesta: idiomaIngles ? 'Ok, ' + materiaDetectada + '. Do you have a specific question or would you like me to suggest a topic?' : 'Ok, ' + materiaDetectada + '. ¿Tienes una duda específica o quieres que te proponga un tema?', nuevo_estado: 'activo', nombre_alumno: nombreAlumno, grado_detectado: gradoAlumno, materia_detectada: materiaDetectada, tokens: 0, pending_math_interaction_id: null, nivel_dificultad: 1, aciertos_consecutivos: 0, fallos_consecutivos: 0, practica_enfoque: 'general' })
    }

    if (estado === 'activo' && materia_id) {
      const materiaDetectada = detectarMateriaDesdeTexto(pregunta)
      if (materiaDetectada && materiaDetectada !== materia_id) return NextResponse.json({ respuesta: '"' + pregunta.trim() + '" es un tema de ' + materiaDetectada + '. ¿Quieres que cambiemos a ' + materiaDetectada + '?', nuevo_estado: 'esperando_confirmacion_cambio_materia', materia_sugerida: materiaDetectada, tokens: 0 })
    }

    if (estado === 'esperando_confirmacion_cambio_materia') {
      const esAfirmativo = /^(si|sí|yes|s|claro|correcto|dale|ok|bueno|perfecto|va|vamos)/.test(pregunta.toLowerCase().trim())
      const materiaSugerida = body.materia_sugerida || ''
      if (esAfirmativo && materiaSugerida) {
        Array.from(cacheContenido.keys()).forEach(key => { if (key.includes(materia_id)) cacheContenido.delete(key) })
        Array.from(indiceDocumentos.keys()).forEach(key => { if (key.includes(materia_id)) indiceDocumentos.delete(key) })
        return NextResponse.json({ respuesta: 'Perfecto, cambiamos a ' + materiaSugerida + '. ¿Tienes una duda específica o quieres que te proponga un tema?', nuevo_estado: 'activo', materia_detectada: materiaSugerida, tokens: 0, pending_math_interaction_id: null, nivel_dificultad: 1, aciertos_consecutivos: 0, fallos_consecutivos: 0, practica_enfoque: 'general' })
      }
      return NextResponse.json({ respuesta: 'Sin problema, seguimos con ' + materia_id + '. ¿En qué te puedo ayudar?', nuevo_estado: 'activo', tokens: 0 })
    }

    if (estado === 'activo') {
      const MATERIAS_KEYWORDS = ['matemática','matematica','física','fisica','química','quimica','biología','biologia','historia','español','espanol','inglés','ingles','ciencias naturales','mineduc','olimpiadas']
      const preguntaLow = pregunta.toLowerCase()
      const cambioExplicito = /(?:quiero estudiar|cambia(?:mos)? a|ahora estudiemos|vamos con)\s+(.+)/i.exec(pregunta)
      const mencionaMateria = MATERIAS_KEYWORDS.some(m => preguntaLow.includes(m))
      if (cambioExplicito && mencionaMateria) {
        const nuevaMateria = normalizarMateria(cambioExplicito[1].trim())
        if (nuevaMateria && nuevaMateria !== materia_id && !nuevaMateria.startsWith('__')) {
          Array.from(cacheContenido.keys()).forEach(key => { if (key.includes(materia_id)) cacheContenido.delete(key) })
          Array.from(indiceDocumentos.keys()).forEach(key => { if (key.includes(materia_id)) indiceDocumentos.delete(key) })
          return NextResponse.json({ respuesta: 'Claro, cambiamos a ' + nuevaMateria + '. ¿Tienes una duda específica o quieres que te proponga un tema?', nuevo_estado: 'activo', materia_detectada: nuevaMateria, tokens: 0, pending_math_interaction_id: null, nivel_dificultad: 1, aciertos_consecutivos: 0, fallos_consecutivos: 0, practica_enfoque: 'general' })
        }
      }
    }

    if (estado === 'activo') {
      const cambioGradoRegex = /ahora (estoy en|curso|voy a|soy de)\s+(.+)|cambi[eé] (a|de) grado[:\s]*(.+)|estoy en\s+(.+(?:grado|b[aá]sico|primaria|bachillerato))/i
      const cambioGradoMatch = cambioGradoRegex.exec(pregunta)
      if (cambioGradoMatch) {
        const textoGrado = cambioGradoMatch[2] || cambioGradoMatch[4] || cambioGradoMatch[5] || ''
        const nuevoGrado = normalizarGradoPorColegio(textoGrado.trim(), colegioSharePoint)
        if (nuevoGrado) {
          await guardarGradoAlumno(nuevoGrado)
          const carpetasNuevoGrado = await cargarMateriasDisponibles(nuevoGrado)
          return NextResponse.json({ respuesta: 'Perfecto, actualicé tu grado a ' + nuevoGrado + '. ¿Qué materia quieres estudiar?', nuevo_estado: 'esperando_materia', grado_detectado: nuevoGrado, materias_disponibles: carpetasNuevoGrado, tokens: 0, pending_math_interaction_id: null, nivel_dificultad: 1, aciertos_consecutivos: 0, fallos_consecutivos: 0, practica_enfoque: 'general' })
        }
      }
    }
    // ── FIN ONBOARDING ───────────────────────────────────────────────

    // ── RUTA RÁPIDA: conversación en inglés ─────────────────────────
    // Evita búsquedas en SharePoint y protocolo matemático para reducir latencia en voz.
    const esModoConversacion = body.modo_conversacion === true && body.modo_conversacion_explicito === true
    if (esModoConversacion) {
      const historialConv = (historial || [])
        .slice(-6)
        .map((m: {rol:string;contenido:string}) => ({
          role: m.rol === 'usuario' ? 'user' as const : 'assistant' as const,
          content: String(m.contenido || '').substring(0, 700),
        }))
      const speechConfidence = typeof body.speech_confidence === 'number' ? body.speech_confidence : null
      const system = buildEnglishConversationSystemPrompt({
        entradaVoz: !!body.entrada_voz,
        speechConfidence,
      })
      const completion = await withOpenAIRetry(() => openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 85,
        temperature: 0.55,
        messages: [
          { role: 'system', content: system },
          ...historialConv,
          { role: 'user', content: pregunta },
        ],
      }), { maxRetries: 1, baseDelayMs: 300 }) // ruta rapida de voz: menos reintentos para no sumar latencia
      const respuesta = completion.choices[0].message.content?.trim() || 'Try saying: “Could you repeat that, please?” What would you like to talk about?'
      await supabase.from('interacciones').insert({
        usuario_id: user.id,
        colegio_id: perfil.colegio_id,
        grado: gradoEfectivo || perfil.grado || '',
        tema_detectado: 'Conversación en Inglés',
        pregunta: pregunta.substring(0, 500),
        respuesta: respuesta.substring(0, 1000),
        tokens_usados: completion.usage?.total_tokens || 0,
        costo_usd: calcularCostoUSD(completion.usage),
        modelo_usado: 'gpt-4o-mini-conversation-fast',
        sospecha_copia: false,
      })
      supabase.from('usuarios').update({ ultimo_acceso: new Date().toISOString() }).eq('id', user.id).then(() => {})
      return NextResponse.json({
        respuesta,
        nuevo_estado: 'activo',
        materia_detectada: 'Inglés',
        activar_conversacion: true,
        tokens: completion.usage?.total_tokens || 0,
      })
    }

    const tipoPregunta = detectarTipoPregunta(pregunta)
    const esBienvenida = esSaludo(pregunta) && (!historial || historial.length === 0)
    const nivelDificultadActual = Math.min(8, Math.max(1, parseInt(String(body.nivel_dificultad || '1'), 10) || 1))
    const rachaAprendizaje = await obtenerRachaAprendizaje(admin, user.id, materia_uuid)

    if (tipoPregunta === 'academica' && pideLeccionSinTema(pregunta)) {
      const respuesta = respuestaPedirTemaLeccion(idiomaIngles)
      const { data: insertedRow } = await supabase.from('interacciones').insert({
        usuario_id: user.id,
        colegio_id: perfil.colegio_id,
        materia_id: materia_uuid,
        grado: gradoEfectivo,
        tema_detectado: 'Leccion sin tema',
        pregunta,
        respuesta,
        tokens_usados: 0,
        costo_usd: 0,
        modelo_usado: 'lesson_topic_clarifier',
        documento_fuente: null,
        sospecha_copia: false,
        guard_activado: true,
      }).select('id').single()
      supabase.from('usuarios').update({ ultimo_acceso: new Date().toISOString() }).eq('id', user.id).then(() => {})
      return NextResponse.json({
        respuesta,
        source: 'lesson_topic_clarifier',
        tokens: 0,
        documento_fuente: null,
        interaction_id: insertedRow?.id || null,
        pending_math_interaction_id: null,
      })
    }

    // ── PROTOCOLO ANTI-ERRORES — evaluación por backend ─────────────
    let evaluacionProtocolo: MathEvaluation | null = null
    let pendingMathId: string | null = body.pending_math_interaction_id || null
    let pendingMathOperation: string | null = null
    let pendingMathDocumentoFuente: string | null = null
    let pendingMathPrompt: string | null = null

    if (!pendingMathId && (isLikelyMathAnswerText(pregunta) || isPendingContextQuestion(pregunta) || isWorkedExampleRequest(pregunta))) {
      try {
        let pendingQuery = supabase
          .from('interacciones')
          .select('id')
          .eq('usuario_id', user.id)
          .eq('op_estado', 'pendiente')
          .is('op_evaluada_en', null)
          .not('operacion_canonica', 'is', null)
          .order('creado_en', { ascending: false })
          .limit(1)
        if (materia_uuid) pendingQuery = pendingQuery.eq('materia_id', materia_uuid)
        if (gradoEfectivo) pendingQuery = pendingQuery.eq('grado', gradoEfectivo)
        const { data: latestPendingMath } = await pendingQuery.maybeSingle()
        if (latestPendingMath?.id) pendingMathId = latestPendingMath.id
      } catch (error) {
        console.error('No se pudo recuperar OP pendiente reciente:', error)
      }
    }

    if (pendingMathId) {
      try {
        let preguntaPendienteQuery = supabase
          .from('interacciones')
          .select('id, respuesta, operacion_canonica, op_estado, op_evaluada_en, documento_fuente')
          .eq('id', pendingMathId)
          .eq('usuario_id', user.id)
          .eq('op_estado', 'pendiente')
          .is('op_evaluada_en', null)
        // Defensa adicional: un ejercicio pendiente de otra materia nunca debe
        // reutilizarse, sin importar qué ID mande el cliente.
        if (materia_uuid) preguntaPendienteQuery = preguntaPendienteQuery.eq('materia_id', materia_uuid)
        const { data: preguntaPendiente } = await preguntaPendienteQuery
          .maybeSingle()

        if (preguntaPendiente?.operacion_canonica && isSafeCanonicalOperation(preguntaPendiente.operacion_canonica)) {
          pendingMathOperation = preguntaPendiente.operacion_canonica
          pendingMathDocumentoFuente = preguntaPendiente.documento_fuente || null
          pendingMathPrompt = preguntaPendiente.respuesta || null

          if (isPendingContextQuestion(pregunta) && !isLikelyMathAnswerText(pregunta)) {
            const respuesta = buildPendingContextResponse({
              studentQuestion: pregunta,
              activeOperation: pendingMathOperation,
              activePrompt: pendingMathPrompt,
              idiomaIngles,
            })
            const { data: insertedRow } = await supabase.from('interacciones').insert({
              usuario_id: user.id,
              colegio_id: perfil.colegio_id,
              materia_id: materia_uuid,
              grado: gradoEfectivo,
              tema_detectado: 'Apoyo sobre ejercicio activo',
              pregunta,
              respuesta,
              tokens_usados: 0,
              costo_usd: 0,
              modelo_usado: 'context_repair_guard',
              documento_fuente: pendingMathDocumentoFuente,
              sospecha_copia: false,
              operacion_canonica: null,
              op_estado: null,
              estado_evaluacion: 'contexto_pendiente',
              guard_activado: true,
            }).select('id').single()
            supabase.from('usuarios').update({ ultimo_acceso: new Date().toISOString() }).eq('id', user.id).then(() => {})
            return NextResponse.json({
              respuesta,
              source: 'context_repair_guard',
              tokens: 0,
              documento_fuente: pendingMathDocumentoFuente,
              interaction_id: insertedRow?.id || null,
              pending_math_interaction_id: pendingMathId,
              nivel_dificultad: nivelDificultadActual,
              aciertos_consecutivos: rachaAprendizaje.correctas,
              fallos_consecutivos: rachaAprendizaje.incorrectas,
              practica_enfoque: practicaEnfoqueEstable,
              adaptacion_dificultad: calculateAdaptiveDifficulty({
                currentLevel: nivelDificultadActual,
                correctStreak: rachaAprendizaje.correctas,
                wrongStreak: rachaAprendizaje.incorrectas,
                idiomaIngles,
              }),
            })
          }

          const textoConOP = preguntaPendiente.respuesta + '\n[OP: ' + preguntaPendiente.operacion_canonica + ']'
          evaluacionProtocolo = await handleMathEvaluation(textoConOP, pregunta, idiomaIngles, process.env.WOLFRAM_APP_ID)
          // Si acertó el valor final: marcar como evaluada (best-effort, sin
          // condicionar la respuesta al resultado de este update). Un intento
          // previo de hacerlo compare-and-swap contra .eq('op_estado','pendiente')
          // devolvía 0 filas incluso en peticiones solitarias sin ninguna
          // concurrencia real, lo que bloqueaba el avance de la práctica para
          // todos los alumnos — un daño mucho mayor que el caso raro de doble
          // clic que ese guard intentaba prevenir.
          if (evaluacionProtocolo && !evaluacionProtocolo.pasoIntermedio && (evaluacionProtocolo.estado === 'correcto' || evaluacionProtocolo.estado === 'equivalente')) {
            await supabase.from('interacciones')
              .update({ op_estado: 'evaluada', op_evaluada_en: new Date().toISOString(), op_respuesta_alumno: pregunta })
              .eq('id', pendingMathId).eq('usuario_id', user.id)
          }
          // Si incorrecto: mantener pendiente — no actualizar, el frontend conserva el mismo ID
        } else {
          // El pending_math_interaction_id no encontró una fila válida (cambio de
          // materia, condición de carrera, ID desincronizado). Antes de rendirnos,
          // intentamos inferir la operación desde el último mensaje del asistente
          // en el historial visible — igual que el respaldo de más abajo. Sin este
          // intento, un ID desincronizado dejaba al alumno atascado para siempre
          // pidiéndole "escribe la operación" en vez de evaluar su respuesta.
          evaluacionProtocolo = null
          if (normalizeStudentAnswer(pregunta) !== null) {
            const ultimaPreguntaHistorial = ultimoMensajeAsistente(historial)
            const opInferidaHistorial = inferCanonicalOperationFromText(ultimaPreguntaHistorial)
            if (opInferidaHistorial && isSafeCanonicalOperation(opInferidaHistorial) && solveOperation(opInferidaHistorial) !== null) {
              evaluacionProtocolo = await handleMathEvaluation(
                ultimaPreguntaHistorial + '\n[OP: ' + opInferidaHistorial + ']',
                pregunta,
                idiomaIngles,
                process.env.WOLFRAM_APP_ID
              )
            }
          }
          if (!evaluacionProtocolo) {
            evaluacionProtocolo = { estado: 'no_evaluable', feedback: idiomaIngles ? 'I cannot verify that safely. Let me explain step by step.' : 'No puedo verificarlo con seguridad. Revisemos el procedimiento paso a paso.', correctAnswer: null, op: null, guardActivado: false }
          }
        }
      } catch (e) { console.error('Error recuperando OP pendiente:', e) }
    }

    if (
      pendingMathId &&
      pendingMathOperation &&
      isWorkedExampleRequest(pregunta) &&
      (!evaluacionProtocolo || evaluacionProtocolo.estado === 'no_evaluable')
    ) {
      const ejemploAnalogico = buildAnalogousWorkedExample(pendingMathOperation, idiomaIngles)
      const fuentePractica = await obtenerFuenteCurricularParaPractica({
        colegio: colegioSharePoint,
        grado: gradoEfectivo,
        materiaConsulta: materiaConsultaSharePoint,
        pregunta: `${pendingMathPrompt || ''}\n${pregunta}\n${ejemploAnalogico.text}`,
        fallbackArchivo: pendingMathDocumentoFuente,
      })
      const respuesta = ejemploAnalogico.text
      const { data: insertedRow } = await supabase.from('interacciones').insert({
        usuario_id: user.id,
        colegio_id: perfil.colegio_id,
        materia_id: materia_uuid,
        grado: gradoEfectivo,
        tema_detectado: 'Ejemplo análogo',
        pregunta,
        respuesta,
        tokens_usados: 0,
        costo_usd: 0,
        modelo_usado: 'math_example_guard',
        documento_fuente: fuentePractica.archivo,
        sospecha_copia: detectarCopia(pregunta),
        operacion_canonica: null,
        op_estado: null,
        estado_evaluacion: 'ejemplo_analogico',
        guard_activado: true,
      }).select('id').single()
      await verificarAlertasBajaComprension(supabase, user.id, perfil, gradoEfectivo, materia, respuesta, fuentePractica.archivo, 'ejemplo_analogico')
      supabase.from('usuarios').update({ ultimo_acceso: new Date().toISOString() }).eq('id', user.id).then(() => {})
      return NextResponse.json({
        respuesta,
        tokens: 0,
        documento_fuente: fuentePractica.archivo,
        interaction_id: insertedRow?.id || null,
        pending_math_interaction_id: pendingMathId,
        nivel_dificultad: nivelDificultadActual,
        aciertos_consecutivos: rachaAprendizaje.correctas,
        fallos_consecutivos: rachaAprendizaje.incorrectas,
        practica_enfoque: practicaEnfoqueEstable,
        adaptacion_dificultad: calculateAdaptiveDifficulty({
          currentLevel: nivelDificultadActual,
          correctStreak: rachaAprendizaje.correctas,
          wrongStreak: rachaAprendizaje.incorrectas,
          idiomaIngles,
        }),
      })
    }

    if (!evaluacionProtocolo && normalizeStudentAnswer(pregunta) !== null) {
      const ultimaPregunta = ultimoMensajeAsistente(historial)
      const opInferida = inferCanonicalOperationFromText(ultimaPregunta)
      if (opInferida && isSafeCanonicalOperation(opInferida) && solveOperation(opInferida) !== null) {
        evaluacionProtocolo = await handleMathEvaluation(
          ultimaPregunta + '\n[OP: ' + opInferida + ']',
          pregunta,
          idiomaIngles,
          process.env.WOLFRAM_APP_ID
        )
      }
    }

    // Si el protocolo evaluó y tiene resultado definitivo, responder directo
    if (evaluacionProtocolo && evaluacionProtocolo.estado !== 'no_evaluable') {
      const esRespuestaCorrecta = evaluacionProtocolo.estado === 'correcto' || evaluacionProtocolo.estado === 'equivalente'
      const esPasoIntermedio = evaluacionProtocolo.estado === 'paso_correcto' || evaluacionProtocolo.pasoIntermedio
      const aciertosConsecutivos = evaluacionProtocolo.estado === 'correcto' || evaluacionProtocolo.estado === 'equivalente'
        ? rachaAprendizaje.correctas + 1
        : esPasoIntermedio ? rachaAprendizaje.correctas : 0
      const fallosConsecutivos = evaluacionProtocolo.estado === 'incorrecto'
        ? rachaAprendizaje.incorrectas + 1
        : esPasoIntermedio ? rachaAprendizaje.incorrectas : 0
      const adaptacionDificultad = calculateAdaptiveDifficulty({
        currentLevel: nivelDificultadActual,
        correctStreak: aciertosConsecutivos,
        wrongStreak: fallosConsecutivos,
        idiomaIngles,
      })
      const nivelSiguiente = adaptacionDificultad.nivel_nuevo
      const operacionesHistorial = collectRecentMathOperations([
        ...(Array.isArray(historial) ? historial.map((msg: { contenido?: string }) => msg.contenido || '') : []),
      ])
      const operacionesEvaluadas = esRespuestaCorrecta ? await cargarOperacionesEvaluadas(supabase, user.id, materia_uuid) : []
      const operacionesBloqueadas = combinarOperacionesBloqueadas(
        operacionesHistorial,
        operacionesEvaluadas,
        [evaluacionProtocolo.op || '']
      )
      // El nombre de la materia (ej. "Algebra I") NO debe entrar aqui: si la
      // clase se llama asi, "algebra" secuestraba el enfoque a "equation"
      // para siempre, incluso cuando el alumno pedia explicitamente "sumas".
      // El nombre de la materia es una etiqueta fija, no una señal de que
      // operacion quiere practicar el alumno en este turno.
      const enfoquePractica = resolveMathPracticeFocus([
        pregunta,
        pendingMathOperation,
        pendingMathPrompt,
        ultimoMensajeAsistente(historial),
      ], practicaEnfoquePersistido)
      const siguienteEjercicio = esRespuestaCorrecta
        ? buildNextMathExercise(operacionesBloqueadas, nivelSiguiente, idiomaIngles, enfoquePractica)
        : null
      const fuentePractica = siguienteEjercicio
        ? await obtenerFuenteCurricularParaPractica({
            colegio: colegioSharePoint,
            grado: gradoEfectivo,
            materiaConsulta: materiaConsultaSharePoint,
            pregunta: `${pendingMathPrompt || ''}\n${pregunta}\n${siguienteEjercicio.text}`,
            fallbackArchivo: pendingMathDocumentoFuente,
          })
        : { contenido: '', archivo: pendingMathDocumentoFuente }
      const avisoSubida = adaptacionDificultad.tipo === 'sube'
        ? idiomaIngles
          ? 'You have built a strong streak, so I will raise the challenge a little.'
          : 'Ya llevas una buena racha, así que voy a subir un poco el reto.'
        : ''
      const respuestaCorrectaConSiguiente = siguienteEjercicio
        ? idiomaIngles
          ? `Correct. Your answer is right. Let's try a different exercise now.${avisoSubida ? '\n\n' + avisoSubida : ''}\n\n${siguienteEjercicio.text}`
          : `¡Correcto! Tu respuesta está bien. Vamos con un ejercicio distinto.${avisoSubida ? '\n\n' + avisoSubida : ''}\n\n${siguienteEjercicio.text}`
        : evaluacionProtocolo.feedback
      const respuesta = esRespuestaCorrecta
        ? respuestaCorrectaConSiguiente
        : esPasoIntermedio
          ? evaluacionProtocolo.feedback
          : reforzarDiagnosticoPorFallos(evaluacionProtocolo.feedback, idiomaIngles, fallosConsecutivos)
      const { data: evaluacionInsertada } = await supabase.from('interacciones').insert({
        usuario_id: user.id, colegio_id: perfil.colegio_id, materia_id: materia_uuid,
        grado: gradoEfectivo, tema_detectado: describeMathTopic(evaluacionProtocolo.op, idiomaIngles),
        pregunta, respuesta, tokens_usados: 0, costo_usd: 0,
        modelo_usado: 'calculadora', documento_fuente: fuentePractica.archivo, sospecha_copia: false,
        operacion_canonica: siguienteEjercicio?.op || evaluacionProtocolo?.op || null,
        op_estado: siguienteEjercicio ? 'pendiente' : evaluacionProtocolo?.estado === 'incorrecto' || (esPasoIntermedio && !pendingMathId) ? 'pendiente' : 'evaluada',
        op_evaluada_en: siguienteEjercicio || evaluacionProtocolo?.estado === 'incorrecto' || (esPasoIntermedio && !pendingMathId) ? null : new Date().toISOString(),
        op_respuesta_alumno: siguienteEjercicio ? null : pregunta,
        estado_evaluacion: evaluacionProtocolo?.estado || null,
        guard_activado: evaluacionProtocolo?.guardActivado || false,
      }).select('id').single()
      supabase.from('usuarios').update({ ultimo_acceso: new Date().toISOString() }).eq('id', user.id).then(() => {})
      
      // Verificar alertas pedagógicas
      await verificarAlertasBajaComprension(supabase, user.id, perfil, gradoEfectivo, materia, respuesta, fuentePractica.archivo, evaluacionProtocolo?.estado || null)
      
      // Si incorrecto conservar pendingMathId para reintento; si correcto, la nueva pregunta queda pendiente.
      const returnPendingId = siguienteEjercicio
        ? (evaluacionInsertada?.id || null)
        : esPasoIntermedio
          ? (pendingMathId || evaluacionInsertada?.id || null)
          : (evaluacionProtocolo?.estado === 'incorrecto') ? (pendingMathId || evaluacionInsertada?.id || null) : null
      return NextResponse.json({
        respuesta,
        tokens: 0,
        documento_fuente: fuentePractica.archivo,
        pending_math_interaction_id: returnPendingId,
        nivel_dificultad: nivelSiguiente,
        aciertos_consecutivos: aciertosConsecutivos,
        fallos_consecutivos: fallosConsecutivos,
        adaptacion_dificultad: adaptacionDificultad,
        practica_enfoque: enfoquePractica,
      })
    }

    // Inyectar contexto de evaluación al prompt si hay resultado no_evaluable o sin OP
    const contextoEvaluacion = evaluacionProtocolo?.estado === 'no_evaluable'
      ? '\n\nINSTRUCCIÓN BACKEND: Esta respuesta no tiene operación verificable. NO digas Correcto ni Incorrecto. Pide al alumno que escriba la operación matemática.'
      : ''
    // ── FIN PROTOCOLO ANTI-ERRORES ───────────────────────────────────

    let contenidoCurricular = ''
    let documentoFuente: string | null = null
      if (tipoPregunta === 'academica' && !esBienvenida) {
      const result = await buscarContenido(colegioSharePoint, gradoEfectivo, materiaConsultaSharePoint, pregunta)
      contenidoCurricular = result.contenido
      documentoFuente = result.archivo
    }

    if (tipoPregunta === 'academica' && !esBienvenida && isCourseTopicListRequest(pregunta)) {
      if (!contenidoCurricular) {
        const respuesta = respuestaSinFuenteSuficiente(idiomaIngles)
        const { data: insertedRow } = await supabase.from('interacciones').insert({
          usuario_id: user.id,
          colegio_id: perfil.colegio_id,
          materia_id: materia_uuid,
          grado: gradoEfectivo,
          tema_detectado: 'Solicitud de índice de temas',
          pregunta,
          respuesta,
          tokens_usados: 0,
          costo_usd: 0,
          modelo_usado: 'course_index_guard',
          documento_fuente: documentoFuente,
          sospecha_copia: false,
          guard_activado: true,
        }).select('id').single()
        return NextResponse.json({
          respuesta,
          source: 'course_index_guard',
          tokens: 0,
          documento_fuente: documentoFuente,
          interaction_id: insertedRow?.id || null,
          pending_math_interaction_id: null,
        })
      }

      const index = extractCourseTopicIndex(contenidoCurricular)
      const respuesta = buildCourseTopicListResponse({
        index,
        subject: materiaConsultaSharePoint || materia_id || 'esta clase',
        documentName: documentoFuente,
        idiomaIngles,
      })
      const { data: insertedRow } = await supabase.from('interacciones').insert({
        usuario_id: user.id,
        colegio_id: perfil.colegio_id,
        materia_id: materia_uuid,
        grado: gradoEfectivo,
        tema_detectado: 'Índice de temas',
        pregunta,
        respuesta,
        tokens_usados: 0,
        costo_usd: 0,
        modelo_usado: 'course_index_guard',
        documento_fuente: documentoFuente,
        sospecha_copia: false,
        guard_activado: index.incomplete || index.source === 'none',
      }).select('id').single()
      supabase.from('usuarios').update({ ultimo_acceso: new Date().toISOString() }).eq('id', user.id).then(() => {})
      return NextResponse.json({
        respuesta,
        source: 'course_index_guard',
        tokens: 0,
        documento_fuente: documentoFuente,
        interaction_id: insertedRow?.id || null,
        pending_math_interaction_id: null,
      })
    }

    const operacionDirecta = inferCanonicalOperationFromText(pregunta)
    const tieneOperacionDirectaSegura = !!operacionDirecta && isSafeCanonicalOperation(operacionDirecta) && solveOperation(operacionDirecta) !== null

    if (
      tipoPregunta === 'academica' &&
      !esBienvenida &&
      !contenidoCurricular &&
      (materia || materia_id) &&
      !tieneOperacionDirectaSegura
    ) {
      const respuesta = respuestaSinFuenteSuficiente(idiomaIngles)
      if (materia) await registrarPendiente(supabase, perfil, materia, pregunta)
      const { data: insertedRow } = await supabase.from('interacciones').insert({
        usuario_id: user.id,
        colegio_id: perfil.colegio_id,
        materia_id: materia_uuid,
        grado: gradoEfectivo,
        tema_detectado: pregunta.substring(0, 100),
        pregunta,
        respuesta,
        tokens_usados: 0,
        costo_usd: 0,
        modelo_usado: 'source_guard',
        documento_fuente: null,
        sospecha_copia: detectarCopia(pregunta),
        guard_activado: true,
      }).select('id').single()
      supabase.from('usuarios').update({ ultimo_acceso: new Date().toISOString() }).eq('id', user.id).then(() => {})
      return NextResponse.json({
        respuesta,
        source: 'source_guard',
        tokens: 0,
        documento_fuente: null,
        interaction_id: insertedRow?.id || null,
        pending_math_interaction_id: null,
      })
    }

    const docsConfig = await leerConfig()
    const promptPersonalizado = cfg.prompt_personalizado?.trim()
    const contextoAdaptativo = construirContextoAdaptativo({
      correctas: rachaAprendizaje.correctas,
      incorrectas: rachaAprendizaje.incorrectas,
      nivel: nivelDificultadActual,
      idiomaIngles,
    })
    const promptBase = PROMPT_BASE +
      (promptPersonalizado
        ? '\n\nINSTRUCCIONES ADICIONALES DEL COLEGIO (no reemplazan el protocolo anti-error anterior):\n' + promptPersonalizado
        : '') +
      (idiomaIngles ? '\n\nIDIOMA: El alumno está en modo inglés. Responde SIEMPRE en inglés.' : '') +
      contextoAdaptativo +
      contextoEvaluacion

    // Baja comprension se verifica en servidor despues de registrar cada interaccion.
    // Los campos alerta_* quedan solo por compatibilidad con clientes antiguos.
    void alerta_comprension
    void alerta_materia
    void alerta_tema

    const esPadre = body.rol_usuario === 'padre'
    let promptPadre = ''
    if (esPadre) {
      const docsPadres = await leerDocumentosPadres()
      promptPadre = `\n\nROL ESPECIAL - ASISTENTE PARA PADRES: Estás hablando con un padre o madre de familia. Usa los siguientes documentos:\n${docsPadres}\n\nAyuda con: estrategias para apoyar el aprendizaje, hábitos de estudio, comunicación con hijos. Sé cálido, empático y práctico.`
    }

    const contextoIdioma = idiomaIngles ? '\n\nLANGUAGE INSTRUCTION: Respond entirely in English. All explanations, questions and feedback must be in English only.' : ''

    let contextoContenido = ''
    if (esBienvenida) {
      contextoContenido = `El alumno acaba de saludar. Responde con bienvenida personalizada. NO muestres lista de temas todavía.`
    } else if (tipoPregunta === 'crisis') {
      contextoContenido = `ALERTA: El alumno toca un tema de crisis personal. Responde con empatía breve y recomienda hablar con un adulto responsable.`
    } else if (tipoPregunta === 'formativa') {
      contextoContenido = `El alumno toca un tema formativo. Usa los documentos de configuración para orientarlo.`
    } else if (contenidoCurricular) {
      contextoContenido = `CONTENIDO ACADEMICO (fuente principal):\n---\n${contenidoCurricular.substring(0, 3000)}\n---`
    } else {
      contextoContenido = `No se encontro documento especifico en SharePoint. No inventes contenido academico. Indica que no hay suficiente informacion en el material disponible de la materia.`
    }

    const systemPrompt = `${promptBase}${promptPadre}${contextoIdioma}

CONTEXTO DEL ALUMNO:
- Nombre: ${perfil.nombre_completo.split(' ')[0]}
- Colegio: ${perfil.colegio?.nombre}
- Grado: ${gradoEfectivo}
- Materia seleccionada: ${materia_id || materia?.nombre || 'Sin materia seleccionada'}

${docsConfig ? `DOCUMENTOS DE CONFIGURACION OFICIAL:\n${docsConfig}\n` : ''}

${contextoContenido}`

    const mensajesOpenAI: { role: 'user' | 'assistant' | 'system'; content: string }[] = [{ role: 'system', content: systemPrompt }]
    if (historial?.length > 0) historial.forEach((msg: { rol: string; contenido: string }) => { mensajesOpenAI.push({ role: msg.rol === 'usuario' ? 'user' : 'assistant', content: msg.contenido }) })
    mensajesOpenAI.push({ role: 'user', content: pregunta })

    const completion = await withOpenAIRetry(() => openai.chat.completions.create({ model: 'gpt-4o-mini', messages: mensajesOpenAI, max_tokens: 700, temperature: 0.7 }))
    let respuesta = completion.choices[0].message.content || 'No pude generar una respuesta.'

    // CONTRADICTION GUARD FINAL — última línea de defensa
    // Aunque el modelo no usó [OP:], si dice incorrecto=correcto, lo bloqueamos
    const studentN = normalizeStudentAnswer(pregunta)
    let respuestaVerificadaCorrecta = false
    if (studentN !== null) {
      const respuestaLow = respuesta.toLowerCase()
      const dijoIncorrecto = respuestaLow.includes('incorrecto') || respuestaLow.includes('incorrect')
      const opDeContexto = inferCanonicalOperationFromText(ultimoMensajeAsistente(historial)) || inferCanonicalOperationFromText(respuesta)
      const respuestaCorrectaCalculada = opDeContexto ? solveOperation(opDeContexto) : null
      respuestaVerificadaCorrecta = respuestaCorrectaCalculada !== null && Math.abs(studentN - respuestaCorrectaCalculada) < 0.001
      if (dijoIncorrecto && respuestaVerificadaCorrecta) {
        respuesta = idiomaIngles
          ? `Correct. ${studentN} is the right answer. Can you explain how you solved it?`
          : `¡Correcto! ${studentN} es la respuesta correcta. Bien hecho. ¿Puedes explicarme cómo llegaste a ese resultado?`
        console.log('CONTRADICTION GUARD FINAL activado con operación:', opDeContexto)
      }

      const valorCorrectoEnRespuesta = respuesta.match(/(?:respuesta correcta|resultado correcto|correct result|correct answer)\s+(?:es|is)\s+(-?\d+(?:[.,]\d+)?)/i)
      if (dijoIncorrecto && valorCorrectoEnRespuesta) {
        const valorCorrecto = parseFloat(valorCorrectoEnRespuesta[1].replace(',', '.'))
        if (!isNaN(valorCorrecto) && Math.abs(studentN - valorCorrecto) < 0.001) {
          // GUARD: el modelo dice "incorrecto, la respuesta es X" pero X == lo que dijo el alumno
          respuesta = idiomaIngles
            ? `Correct. ${studentN} is the right answer. Can you explain how you solved it?`
            : `¡Correcto! ${studentN} es la respuesta correcta. Bien hecho. ¿Puedes explicarme cómo llegaste a ese resultado?`
          console.log('CONTRADICTION GUARD FINAL activado: modelo se contradecía')
        }
      }
    }

    // La alerta de baja comprensión y las métricas del reporte para padres dependen
    // de "estado_evaluacion". Para materias humanísticas evaluacionProtocolo siempre
    // es null (esa evaluación determinística solo corre para materias numéricas), y
    // el guard humanístico de abajo reemplaza "Incorrecto"/"Correcto" por lenguaje
    // más suave — si no se captura la señal ANTES de ese reemplazo, ambas quedan
    // ciegas para historia, español, literatura, etc.
    const estadoEvaluacionHumanistico = (() => {
      if (evaluacionProtocolo) return null
      const baja = respuesta.toLowerCase()
      if (/\bincorrecto\b|\bno es correcto\b|\bincorrect\b|\bnot correct\b/.test(baja)) return 'incorrecto'
      if (/\bcorrecto\b|\bcorrect\b/.test(baja)) return 'correcto'
      return null
    })()

    const pedagogicalGuard = guardNoFinalAnswer(respuesta, {
      pregunta,
      tipoPregunta,
      materiaNumerica,
      respuestaVerificadaCorrecta,
      idiomaIngles,
    })
    respuesta = pedagogicalGuard.text

    const externalResourceGuard = stripUnapprovedExternalResources(respuesta, idiomaIngles)
    respuesta = externalResourceGuard.text

    const tokensUsados = completion.usage?.total_tokens || 0
    const costoUSD = calcularCostoUSD(completion.usage)

    // Extraer OP de la respuesta del tutor y limpiar texto visible
    const { visibleText: _respLimpia, operation: _opExtraida } = extractAndCleanOperation(respuesta)
    respuesta = _respLimpia
    const opInferida = !_opExtraida && looksLikeMathPracticePrompt(respuesta)
      ? inferCanonicalOperationFromText(respuesta)
      : null
    const opAlumno = inferCanonicalOperationFromText(pregunta)
    const respuestaGuiaEcuacion = /(?:suma|sumar|resta|restar|divide|dividir|multiplica|multiplicar|ambos lados|despej|aisla|a[ií]sla|both sides|isolate|add|subtract|divide|multiply)/i.test(respuesta)
    const opDesdeAlumno = opAlumno &&
      /x/i.test(opAlumno) &&
      opAlumno.includes('=') &&
      solveOperation(opAlumno) !== null &&
      normalizeStudentAnswer(pregunta) === null &&
      respuestaGuiaEcuacion
      ? opAlumno
      : null
    let opFinalRespuesta = _opExtraida || opInferida || opDesdeAlumno
    let opValidaEnRespuesta = isSafeCanonicalOperation(opFinalRespuesta) ? opFinalRespuesta : null
    let practicaEnfoqueFinal: MathPracticeFocus = practicaEnfoqueEstable
    if (opValidaEnRespuesta) {
      const operacionesHistorial = collectRecentMathOperations(
        Array.isArray(historial) ? historial.map((msg: { contenido?: string }) => msg.contenido || '') : []
      )
      try {
        const operacionesEvaluadas = await cargarOperacionesEvaluadas(supabase, user.id, materia_uuid)
        const operacionesBloqueadas = combinarOperacionesBloqueadas(operacionesHistorial, operacionesEvaluadas)
        if (isRepeatedMathOperation(opValidaEnRespuesta, operacionesBloqueadas)) {
          // Ver nota arriba: el nombre de la materia no debe influir en el
          // enfoque de práctica detectado en este turno.
          const enfoquePractica = resolveMathPracticeFocus([
            pregunta,
            respuesta,
            ultimoMensajeAsistente(historial),
            opValidaEnRespuesta,
          ], practicaEnfoquePersistido)
          practicaEnfoqueFinal = enfoquePractica
          const ejercicioFresco = buildNextMathExercise([...operacionesBloqueadas, opValidaEnRespuesta], nivelDificultadActual, idiomaIngles, enfoquePractica)
          respuesta = idiomaIngles
            ? `Let's use a different exercise so we do not repeat the same one.\n\n${ejercicioFresco.text}`
            : `Usemos un ejercicio distinto para no repetir el mismo.\n\n${ejercicioFresco.text}`
          opFinalRespuesta = ejercicioFresco.op
          opValidaEnRespuesta = ejercicioFresco.op
        }
      } catch (error) {
        console.error('Error anti-repetición:', error)
      }
    }
    const guardiaHumanistica = guardHumanisticResponse(respuesta, {
      materia: materia?.nombre || materia_id,
      tipoPregunta,
      materiaNumerica,
      hasVerifiedOperation: !!opValidaEnRespuesta,
      idiomaIngles,
    })
    respuesta = guardiaHumanistica.text
    const externalResourceGuardFinal = stripUnapprovedExternalResources(respuesta, idiomaIngles)
    respuesta = externalResourceGuardFinal.text

    const { data: insertedRow, error: insertErr } = await supabase.from('interacciones').insert({
      usuario_id: user.id, colegio_id: perfil.colegio_id, materia_id: materia_uuid,
      grado: gradoEfectivo, tema_detectado: pregunta.substring(0, 100),
      pregunta, respuesta, tokens_usados: tokensUsados, costo_usd: costoUSD,
      modelo_usado: 'gpt-4o-mini', documento_fuente: documentoFuente,
      sospecha_copia: detectarCopia(pregunta),
      operacion_canonica: opValidaEnRespuesta || null,
      op_estado: opValidaEnRespuesta ? 'pendiente' : null,
      // "crisis" es una clasificacion mas suave que el bloqueo de content safety
      // (no bloquea la respuesta, pero SI es un tema sensible que el reporte
      // para padres debe poder contar y senalar).
      estado_evaluacion: tipoPregunta === 'crisis' ? 'crisis_emocional' : (evaluacionProtocolo?.estado || estadoEvaluacionHumanistico),
      guard_activado: evaluacionProtocolo?.guardActivado || pedagogicalGuard.guardActivado || guardiaHumanistica.guardActivado || externalResourceGuard.guardActivado || externalResourceGuardFinal.guardActivado || false,
    }).select('id').single()
    const insertedId = insertedRow?.id || null
    if (insertErr) console.error('INSERT interaccion ERROR:', insertErr.message)

    if (tipoPregunta === 'academica' && !contenidoCurricular && materia) await registrarPendiente(supabase, perfil, materia, pregunta)

    // Alertas pedagógicas
    await verificarAlertasBajaComprension(supabase, user.id, perfil, gradoEfectivo, materia, respuesta, documentoFuente, evaluacionProtocolo?.estado || estadoEvaluacionHumanistico)

    supabase.from('usuarios').update({ ultimo_acceso: new Date().toISOString() }).eq('id', user.id).then(() => {})

    return NextResponse.json({ 
      respuesta, tokens: tokensUsados, documento_fuente: documentoFuente,
      interaction_id: insertedId,
      pending_math_interaction_id: opValidaEnRespuesta ? insertedId : null,
      nivel_dificultad: nivelDificultadActual,
      aciertos_consecutivos: rachaAprendizaje.correctas,
      fallos_consecutivos: rachaAprendizaje.incorrectas,
      practica_enfoque: practicaEnfoqueFinal,
      adaptacion_dificultad: calculateAdaptiveDifficulty({
        currentLevel: nivelDificultadActual,
        correctStreak: rachaAprendizaje.correctas,
        wrongStreak: rachaAprendizaje.incorrectas,
        idiomaIngles,
      }),
    })

  } catch (err) {
    console.error('Error /api/preguntar:', err)
    const status = (err as { status?: number } | null)?.status
    const tipoError = status === 429 || (typeof status === 'number' && status >= 500) ? 'openai_agotado' : 'error_interno'
    await registrarAlertaTecnica(createAdminClient(), colegioIdParaAlerta, tipoError, `Ruta:/api/preguntar | ${err instanceof Error ? err.message : String(err)}`.substring(0, 280))
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// Función de alertas pedagógicas extraída para reutilización
async function verificarAlertasBajaComprension(
  _supabase: ReturnType<typeof import('@/lib/supabase/server').createClient>,
  userId: string,
  perfil: { id?: string; colegio_id: string; grado?: string; nombre_completo: string },
  gradoEfectivo: string,
  materia: { nombre: string } | null,
  respuesta: string,
  documentoFuente: string | null,
  estadoEvaluacion?: string | null
) {
  try {
    if (typeof respuesta !== 'string') return
    const admin = createAdminClient()
    const respuestaNormalizada = respuesta.toLowerCase()
    const esIncorrecta = estadoEvaluacion === 'incorrecto' ||
      respuestaNormalizada.includes('incorrecto') ||
      respuestaNormalizada.includes('no es correcto') ||
      respuestaNormalizada.includes('vamos a revisarlo') ||
      respuestaNormalizada.includes('vamos a analizarlo')
    if (!esIncorrecta) return

    const hace24h = new Date(Date.now() - 24 * 3600000).toISOString()
    const { data: recientes } = await admin
      .from('interacciones')
      .select('respuesta, estado_evaluacion')
      .eq('usuario_id', userId)
      .gte('creado_en', hace24h)

    const fallos = (recientes || []).filter((i: {respuesta?: string; estado_evaluacion?: string | null}) =>
      i.estado_evaluacion === 'incorrecto' ||
      i.respuesta?.toLowerCase().includes('incorrecto') ||
      i.respuesta?.toLowerCase().includes('vamos a revisar') ||
      i.respuesta?.toLowerCase().includes('vamos a analizar')
    ).length
    if (fallos < 5 || fallos % 5 !== 0) return

    const umbral = fallos
    const contexto = [
      `Umbral:${umbral}`,
      'Ventana:24h',
      materia?.nombre ? `Materia:${materia.nombre}` : null,
      documentoFuente ? `Fuente:${documentoFuente}` : null,
    ].filter(Boolean).join(' | ')

    const { data: yaExiste } = await admin
      .from('alertas')
      .select('id')
      .eq('alumno_id', userId)
      .eq('tipo', 'baja_comprension')
      .gte('creado_en', hace24h)
      .ilike('contexto', `%Umbral:${umbral}%`)
      .maybeSingle()
    if (yaExiste) return

    let asig = null
    const { data: asigAlumno } = await admin.from('guia_asignaciones').select('guia_id, guia:guia_id(email, nombre_completo)').eq('colegio_id', perfil.colegio_id).eq('activo', true).eq('tipo', 'alumno').eq('alumno_id', userId).limit(1).maybeSingle()
    if (asigAlumno) { asig = asigAlumno } else {
      const { data: asigGrado } = await admin.from('guia_asignaciones').select('guia_id, guia:guia_id(email, nombre_completo)').eq('colegio_id', perfil.colegio_id).eq('activo', true).eq('tipo', 'grado').eq('grado', gradoEfectivo || perfil.grado || '').limit(1).maybeSingle()
      asig = asigGrado
    }

    await admin.from('alertas').insert({
      alumno_id: userId,
      colegio_id: perfil.colegio_id,
      guia_id: asig?.guia_id || null,
      tipo: 'baja_comprension',
      descripcion: perfil.nombre_completo + ' llegó a ' + umbral + ' fallos en las últimas 24 horas' + (materia?.nombre ? ' en ' + materia.nombre : '') + '.',
      contexto,
    })

    if (asig?.guia && process.env.RESEND_API_KEY) {
      try {
        const guia = asig.guia as unknown as {email:string; nombre_completo:string}
        const { Resend } = await import('resend')
        await new Resend(process.env.RESEND_API_KEY).emails.send({
          from: 'Owlaris <noreply@owlaris.app>',
          to: guia.email,
          subject: 'Alerta: ' + umbral + ' fallos - ' + perfil.nombre_completo,
          html: '<p>Hola ' + guia.nombre_completo + ',</p><p><strong>' + perfil.nombre_completo + '</strong> llegó a <strong>' + umbral + ' fallos</strong> en las últimas 24 horas en Owlaris.</p><p>' + contexto + '</p><a href="https://owlaris.app/guia">Ver en Owlaris</a>'
        })
      } catch(e) { console.error('Email alerta:', e) }
    }
  } catch { /* silencioso */ }
}
