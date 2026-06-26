import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkContentSafety } from '@/lib/contentSafety'
import { guardHumanisticResponse } from '@/lib/humanisticSafety'
import {
  extractAndCleanOperation,
  handleMathEvaluation,
  inferCanonicalOperationFromText,
  isSafeCanonicalOperation,
  looksLikeMathPracticePrompt,
  normalizeStudentAnswer,
  solveOperation,
  type MathEvaluation,
} from '@/lib/mathSafety'

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

MÉTODO DE ENSEÑANZA OBLIGATORIO:
1. Detecta qué no entiende el alumno.
2. Explica una sola idea.
3. Da un ejemplo corto.
4. Pide que el alumno lo intente.
5. Cierra con una pregunta de comprobación.

REGLA ANTI-COPIA:
Si el alumno pide "dame la respuesta", "hazme la tarea" o "solo dime qué va", responde con negativa pedagógica y guía paso a paso.

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
Si recibes INCORRECTO: di "Incorrecto." inmediatamente. Explica una sola idea. Pide nuevo intento.
Si recibes NO_EVALUABLE: no digas correcto ni incorrecto. Pide que escriban la operación.

EVALUACIÓN DE RESPUESTAS — HUMANÍSTICAS:
Para historia, lenguaje, biología conceptual y otras materias no numéricas:
NO uses "Correcto" o "Incorrecto" como veredicto absoluto.
Usa en cambio: "Bien argumentado", "Falta evidencia", "¿Puedes sustentar eso con el texto?", "Esa idea va bien encaminada, ¿puedes ampliarla?"
Esto evita errores de evaluación subjetiva.

DIFICULTAD PROGRESIVA:
Nivel 1: Operaciones directas (7+5, 48-19, 72/8)
Nivel 2: Orden de operaciones (8+3*2, (10+6)/2)
Nivel 3: Porcentajes (25% de 200)
Nivel 4: Ecuaciones simples (x+5=12)
Nivel 5: Ecuaciones con coeficiente (2x-4=10)
Nivel 6: Ecuaciones con paréntesis (2(x+3)=18)
Nivel 7: Ecuaciones con x en ambos lados (5x+3=2x+15)
Nivel 8: Ecuaciones combinadas (4(x-2)+3=2(x+1)+9)
Sube nivel con 3 aciertos consecutivos. Baja con 2 errores consecutivos.

OPCIÓN MÚLTIPLE — REGLA CRÍTICA:
Cuando plantees opción múltiple, SIEMPRE incluye [OP:] con la operación correcta.
Cuando el alumno responda con una letra (A, B, C o D):
1. Busca el VALOR de esa letra en tu pregunta anterior.
2. Compara ese valor con el resultado de [OP].
3. Si el valor ES correcto → di "Correcto" de inmediato.
4. Si el valor NO ES correcto → di "Incorrecto" y explica.

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

const COLEGIOS_SP: Record<string, string> = {
  'escolaris':       'Escolaris',
  'colegio-montano': 'Colegio Montano',
}
const CARPETA_COMPARTIDA = 'Colegio Montano y Escolaris'

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

// Materias numéricas — usan protocolo [OP:]
const MATERIAS_NUMERICAS = ['Matemática', 'Física', 'Química', 'Biología', 'Ciencias Naturales', 'Estadística',
  'Olimpiadas - Matemática', 'Olimpiadas - Biología', 'Olimpiadas - Física', 'Olimpiadas - Química',
  'Olimpiadas - Ciencias Naturales', 'Mineduc - Matemática']

function esMateriaNumerica(materia: string): boolean {
  return MATERIAS_NUMERICAS.some(m => materia.includes(m.split(' ')[0]))
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

async function listarArchivos(driveId: string, token: string, ...segs: string[]) {
  const ruta = segs.map(s => encodeURIComponent(s)).join('/')
  const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${ruta}:/children`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return []
  const data = await res.json()
  return (data.value || []).filter((a: {name:string}) => a.name.endsWith('.docx') && !a.name.startsWith('~$'))
}

async function extraerTexto(url: string): Promise<string> {
  const r = await fetch(url)
  const buf = await r.arrayBuffer()
  const m = await import('mammoth')
  const { value } = await m.extractRawText({ buffer: Buffer.from(buf) })
  return value
}

const indiceDocumentos = new Map<string, { nombre: string; tema: string; downloadUrl: string }[]>()

async function construirIndice(driveId: string, token: string, ...segs: string[]) {
  const idxKey = 'idx/' + segs.join('/')
  const cached = indiceDocumentos.get(idxKey)
  if (cached) return cached
  console.log('Construyendo indice: ' + segs.join('/'))
  const archivos = await listarArchivos(driveId, token, ...segs)
  if (archivos.length === 0) return []
  const indice: { nombre: string; tema: string; downloadUrl: string }[] = []
  await Promise.all(archivos.map(async (archivo: { name: string; '@microsoft.graph.downloadUrl': string }) => {
    try {
      const r = await fetch(archivo['@microsoft.graph.downloadUrl'])
      const buf = await r.arrayBuffer()
      const m = await import('mammoth')
      const { value } = await m.extractRawText({ buffer: Buffer.from(buf) })
      indice.push({ nombre: archivo.name, tema: value.substring(0, 300).trim(), downloadUrl: archivo['@microsoft.graph.downloadUrl'] })
    } catch {
      indice.push({ nombre: archivo.name, tema: archivo.name, downloadUrl: archivo['@microsoft.graph.downloadUrl'] })
    }
  }))
  indiceDocumentos.set(idxKey, indice)
  console.log(`✅ Índice construido: ${indice.length} documentos`)
  setTimeout(() => indiceDocumentos.delete(idxKey), CACHE_TTL)
  return indice
}

async function buscarContenido(colegio_slug: string, grado: string, materia: string, pregunta: string) {
  const token = await getToken()
  if (!token) return { contenido: '', archivo: null }
  const driveId = process.env.SHAREPOINT_DRIVE_ID!
  const colegioSP = COLEGIOS_SP[colegio_slug] || colegio_slug
  let indice: { nombre: string; tema: string; downloadUrl: string }[] = []
  if (materia.startsWith('Olimpiadas')) {
    const carpetaMateria = MATERIAS_OLIMPIADAS[materia] || materia.replace('Olimpiadas - ', '')
    const carpetaGrado = GRADOS_OLIMPIADAS[grado] || grado
    indice = await construirIndice(driveId, token, 'Owlaris', CARPETA_COMPARTIDA, 'Olimpiadas de Ciencias', carpetaMateria, carpetaGrado)
    if (indice.length === 0) indice = await construirIndice(driveId, token, 'Owlaris', CARPETA_COMPARTIDA, 'Olimpiadas de Ciencias', carpetaMateria)
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
      const match = carpetas.find(cp => { const cl = cp.toLowerCase().replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i').replace(/ó/g,'o').replace(/ú/g,'u'); return cl.includes(mLower) || mLower.includes(cl) })
      if (match) idx = await construirIndice(driveId, token, raiz, gradoB, match)
      return idx
    }
    indice = await buscarEnGrado('Owlaris/' + CARPETA_COMPARTIDA, grado, materia)
    if (indice.length === 0) indice = await buscarEnGrado('Owlaris/' + colegioSP, grado, materia)
    if (indice.length === 0) indice = await construirIndice(driveId, token, 'Owlaris', CARPETA_COMPARTIDA, 'Preparación pruebas nacionales', 'Mineduc', grado, materia)
    if (indice.length === 0) indice = await construirIndice(driveId, token, 'Owlaris', CARPETA_COMPARTIDA, 'Preparación pruebas nacionales', 'Mineduc', materia)
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
  const cacheKey = `${colegioSP}/${grado}/${materia}/${mejorDoc.nombre}`
  const cached = cacheContenido.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) return { contenido: cached.contenido, archivo: cached.archivo }
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
      contenido += `\n\n=== ${doc} ===\n${texto.substring(0, 2000)}`
      console.log(`✅ Config: ${doc}`)
    } catch (e) { console.log(`Error config ${doc}:`, e) }
  }
  cacheConfig.set('config', { contenido, timestamp: Date.now() })
  return contenido
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
      carpetas.push(...(data.value || []).filter((i: {folder?:unknown}) => i.folder).map((i: {name:string}) => i.name))
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
          const mid = Math.floor(texto.length / 2)
          contenido += `\n--- ${doc.name} ---\n${texto.substring(0, 1000)}\n...\n${texto.substring(mid, mid+1000)}\n...\n${texto.substring(texto.length - 1000)}\n`
        }
      } catch { /* silencioso */ }
    }
  } catch { /* silencioso */ }
  return contenido
}

async function registrarPendiente(supabase: ReturnType<typeof import('@/lib/supabase/server').createClient>, perfil: { colegio_id: string; grado: string | null }, materia: { nombre: string }, pregunta: string) {
  const tema = pregunta.substring(0, 150)
  const { data: existente } = await supabase.from('pendientes').select('id, veces_solicitado').eq('colegio_id', perfil.colegio_id).eq('materia', materia.nombre).eq('tema_solicitado', tema).single()
  if (existente) {
    await supabase.from('pendientes').update({ veces_solicitado: existente.veces_solicitado + 1 }).eq('id', existente.id)
  } else {
    await supabase.from('pendientes').insert({ colegio_id: perfil.colegio_id, grado: perfil.grado || '', materia: materia.nombre, tema_solicitado: tema, veces_solicitado: 1, resuelto: false })
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
    const { pregunta, historial, alerta_comprension = false, alerta_materia = '', alerta_tema = '' } = body
    const materia_id = body.materia_id || body.materia_detectada || ''
    const userId: string = body.user_id || ''
    const idiomaIngles: boolean = body.idioma_ingles || false

    const grado_override = body.grado_override || body.grado_detectado || ''
    if (!pregunta?.trim()) return NextResponse.json({ error: 'Pregunta vacía' }, { status: 400 })

    // CONTENT SAFETY - proteccion deterministica para menores
    const safety = checkContentSafety(pregunta, idiomaIngles)
    if (safety.bloqueado) {
      return NextResponse.json({
        respuesta: safety.respuesta,
        source: 'content_safety',
        nuevo_estado: 'activo',
        tokens: 0,
        safety_tipo: safety.tipo,
      })
    }

    const { data: perfil } = await supabase.from('usuarios').select('*, colegio:colegios(*)').eq('id', user.id).single()
    if (!perfil) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })

    const { data: configs } = await supabase.from('configuracion').select('clave, valor').eq('colegio_id', perfil.colegio_id)
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
    const gradoEfectivo = grado_override || perfil.grado
    const colegioSlug = perfil.colegio?.sharepoint_folder || perfil.colegio?.slug
    const materiaNumerica = esMateriaNumerica(materia?.nombre || materia_id || '')

    // ── ONBOARDING ──────────────────────────────────────────────────
    const estado: string = body.estado || 'activo'
    const nombreAlumno: string = body.nombre_alumno || ''
    const gradoAlumno: string = body.grado_override || ''

    if (pregunta === '__CARGAR_MATERIAS__' || (estado === 'esperando_materia' && gradoAlumno && !pregunta.trim())) {
      const grado = gradoAlumno || grado_override || perfil.grado || ''
      if (grado) {
        const carpetas = await leerCarpetasGrado(grado, idiomaIngles)
        return NextResponse.json({ materias_disponibles: carpetas, respuesta: '', tokens: 0 })
      }
    }

    if (estado === 'esperando_nombre') {
      const nombre = pregunta.trim().split(' ')[0]
      return NextResponse.json({ respuesta: idiomaIngles ? 'Hi, ' + nombre + '! Great to have you here. What grade are you in?' : '¡Hola, ' + nombre + '! Qué bueno tenerte aquí. ¿En qué grado estás?', nuevo_estado: 'esperando_grado', nombre_alumno: nombre, tokens: 0 })
    }

    if (estado === 'esperando_grado') {
      const gradoDetectado = normalizarGrado(pregunta)
      if (!gradoDetectado) return NextResponse.json({ respuesta: 'No reconocí ese grado. ¿Puedes decirme tu grado? Por ejemplo: "4to Primaria", "3ero Básico", "5to Bachillerato"...', nuevo_estado: 'esperando_grado', nombre_alumno: nombreAlumno, tokens: 0 })
      if (userId) await supabase.from('usuarios').update({ grado: gradoDetectado }).eq('id', userId)
      const carpetasG = await leerCarpetasGrado(gradoDetectado, idiomaIngles)
      return NextResponse.json({ respuesta: idiomaIngles ? `Perfect, ${nombreAlumno}! What would you like to study?` : `Perfecto, ${nombreAlumno}. ¿Qué quieres estudiar hoy?`, nuevo_estado: 'esperando_materia', nombre_alumno: nombreAlumno, grado_detectado: gradoDetectado, materias_disponibles: carpetasG, tokens: 0 })
    }

    if (estado === 'esperando_materia') {
      const materiaDetectada = normalizarMateria(pregunta)
      const gradoMostrar = gradoAlumno || body.grado_detectado || ''
      if (materiaDetectada === '__OLIMPIADAS__') return NextResponse.json({ respuesta: 'Olimpiadas, perfecto. ¿De cuál materia? Matemática, Biología, Física, Química o Ciencias Naturales.', nuevo_estado: 'esperando_materia_olimpiadas', nombre_alumno: nombreAlumno, grado_detectado: gradoMostrar, tokens: 0 })
      const esMateriaNormalizada = materiaDetectada !== pregunta.trim()
      if (!esMateriaNormalizada && materia_id) return NextResponse.json({ respuesta: idiomaIngles ? 'Ok, let me help you with that topic.' : 'Ok, vamos con ese tema.', nuevo_estado: 'activo', nombre_alumno: nombreAlumno, grado_detectado: gradoAlumno, materia_detectada: materia_id, tokens: 0 })
      return NextResponse.json({ respuesta: idiomaIngles ? 'Ok, ' + materiaDetectada + '. Do you have a specific question or would you like me to suggest a topic?' : 'Ok, ' + materiaDetectada + '. ¿Tienes una duda específica o quieres que te proponga un tema?', nuevo_estado: 'activo', nombre_alumno: nombreAlumno, grado_detectado: gradoAlumno, materia_detectada: materiaDetectada, tokens: 0 })
    }

    if (estado === 'esperando_materia_olimpiadas') {
      const materiaDetectada = normalizarMateria(pregunta, true)
      return NextResponse.json({ respuesta: idiomaIngles ? 'Ok, ' + materiaDetectada + '. Do you have a specific question or would you like me to suggest a topic?' : 'Ok, ' + materiaDetectada + '. ¿Tienes una duda específica o quieres que te proponga un tema?', nuevo_estado: 'activo', nombre_alumno: nombreAlumno, grado_detectado: gradoAlumno, materia_detectada: materiaDetectada, tokens: 0 })
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
        return NextResponse.json({ respuesta: 'Perfecto, cambiamos a ' + materiaSugerida + '. ¿Tienes una duda específica o quieres que te proponga un tema?', nuevo_estado: 'activo', materia_detectada: materiaSugerida, tokens: 0 })
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
          return NextResponse.json({ respuesta: 'Claro, cambiamos a ' + nuevaMateria + '. ¿Tienes una duda específica o quieres que te proponga un tema?', nuevo_estado: 'activo', materia_detectada: nuevaMateria, tokens: 0 })
        }
      }
    }

    if (estado === 'activo') {
      const cambioGradoRegex = /ahora (estoy en|curso|voy a|soy de)\s+(.+)|cambi[eé] (a|de) grado[:\s]*(.+)|estoy en\s+(.+(?:grado|b[aá]sico|primaria|bachillerato))/i
      const cambioGradoMatch = cambioGradoRegex.exec(pregunta)
      if (cambioGradoMatch) {
        const textoGrado = cambioGradoMatch[2] || cambioGradoMatch[4] || cambioGradoMatch[5] || ''
        const nuevoGrado = normalizarGrado(textoGrado.trim())
        if (nuevoGrado) {
          if (userId) await supabase.from('usuarios').update({ grado: nuevoGrado }).eq('id', userId)
          return NextResponse.json({ respuesta: 'Perfecto, actualicé tu grado a ' + nuevoGrado + '. ¿Qué materia quieres estudiar?', nuevo_estado: 'esperando_materia', grado_detectado: nuevoGrado, tokens: 0 })
        }
      }
    }
    // ── FIN ONBOARDING ───────────────────────────────────────────────

    // ── PROTOCOLO ANTI-ERRORES — evaluación por backend ─────────────
    let evaluacionProtocolo: MathEvaluation | null = null
    const pendingMathId: string | null = body.pending_math_interaction_id || null

    if (pendingMathId && materiaNumerica) {
      try {
        const { data: preguntaPendiente } = await supabase
          .from('interacciones')
          .select('id, respuesta, operacion_canonica, op_estado, op_evaluada_en')
          .eq('id', pendingMathId)
          .eq('usuario_id', user.id)
          .eq('op_estado', 'pendiente')
          .is('op_evaluada_en', null)
          .maybeSingle()

        if (preguntaPendiente?.operacion_canonica && isSafeCanonicalOperation(preguntaPendiente.operacion_canonica)) {
          const textoConOP = preguntaPendiente.respuesta + '\n[OP: ' + preguntaPendiente.operacion_canonica + ']'
          evaluacionProtocolo = await handleMathEvaluation(textoConOP, pregunta, idiomaIngles, process.env.WOLFRAM_APP_ID)
          // Si acertó: marcar como evaluada
          if (evaluacionProtocolo && (evaluacionProtocolo.estado === 'correcto' || evaluacionProtocolo.estado === 'equivalente')) {
            await supabase.from('interacciones')
              .update({ op_estado: 'evaluada', op_evaluada_en: new Date().toISOString(), op_respuesta_alumno: pregunta })
              .eq('id', pendingMathId).eq('usuario_id', user.id)
          }
          // Si incorrecto: mantener pendiente — no actualizar, el frontend conserva el mismo ID
        } else {
          // ID inválido o OP no segura — no evaluar
          evaluacionProtocolo = { estado: 'no_evaluable', feedback: idiomaIngles ? 'I cannot verify that safely. Let me explain step by step.' : 'No puedo verificarlo con seguridad. Revisemos el procedimiento paso a paso.', correctAnswer: null, op: null, guardActivado: false }
        }
      } catch (e) { console.error('Error recuperando OP pendiente:', e) }
    }

    if (!evaluacionProtocolo && materiaNumerica && normalizeStudentAnswer(pregunta) !== null) {
      const ultimaPregunta = ultimoMensajeAsistente(historial)
      const opInferida = inferCanonicalOperationFromText(ultimaPregunta)
      if (opInferida && isSafeCanonicalOperation(opInferida)) {
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
      const respuesta = evaluacionProtocolo.feedback
      const { data: evaluacionInsertada } = await supabase.from('interacciones').insert({
        usuario_id: user.id, colegio_id: perfil.colegio_id, materia_id: materia_uuid,
        grado: gradoEfectivo, tema_detectado: pregunta.substring(0, 100),
        pregunta, respuesta, tokens_usados: 0, costo_usd: 0,
        modelo_usado: 'calculadora', documento_fuente: null, sospecha_copia: false,
        operacion_canonica: evaluacionProtocolo?.op || null,
        op_estado: evaluacionProtocolo?.estado === 'incorrecto' ? 'pendiente' : 'evaluada',
        op_evaluada_en: evaluacionProtocolo?.estado === 'incorrecto' ? null : new Date().toISOString(),
        op_respuesta_alumno: pregunta,
        estado_evaluacion: evaluacionProtocolo?.estado || null,
        guard_activado: evaluacionProtocolo?.guardActivado || false,
      }).select('id').single()
      supabase.from('usuarios').update({ ultimo_acceso: new Date().toISOString() }).eq('id', user.id).then(() => {})
      
      // Verificar alertas pedagógicas
      await verificarAlertasBajaComprension(supabase, user.id, perfil, gradoEfectivo, materia, respuesta, null)
      
      // Si incorrecto conservar pendingMathId para reintento; si correcto ya fue marcado evaluada
      const returnPendingId = (evaluacionProtocolo?.estado === 'incorrecto') ? (pendingMathId || evaluacionInsertada?.id || null) : null
      return NextResponse.json({ respuesta, tokens: 0, pending_math_interaction_id: returnPendingId })
    }

    // Inyectar contexto de evaluación al prompt si hay resultado no_evaluable o sin OP
    const contextoEvaluacion = evaluacionProtocolo?.estado === 'no_evaluable'
      ? '\n\nINSTRUCCIÓN BACKEND: Esta respuesta no tiene operación verificable. NO digas Correcto ni Incorrecto. Pide al alumno que escriba la operación matemática.'
      : ''
    // ── FIN PROTOCOLO ANTI-ERRORES ───────────────────────────────────

    const tipoPregunta = detectarTipoPregunta(pregunta)
    const esBienvenida = esSaludo(pregunta) && (!historial || historial.length === 0)

    let contenidoCurricular = ''
    let documentoFuente: string | null = null
      if (tipoPregunta === 'academica' && !esBienvenida) {
      const result = await buscarContenido(colegioSlug, gradoEfectivo, materia_id || '', pregunta)
      contenidoCurricular = result.contenido
      documentoFuente = result.archivo
    }

    const docsConfig = await leerConfig()
    const promptPersonalizado = cfg.prompt_personalizado?.trim()
    const promptBase = PROMPT_BASE +
      (promptPersonalizado
        ? '\n\nINSTRUCCIONES ADICIONALES DEL COLEGIO (no reemplazan el protocolo anti-error anterior):\n' + promptPersonalizado
        : '') +
      (idiomaIngles ? '\n\nIDIOMA: El alumno está en modo inglés. Responde SIEMPRE en inglés.' : '') +
      contextoEvaluacion

    // Alerta por 3 fallos consecutivos del frontend
    if (alerta_comprension) {
      const { data: alertaExist } = await supabase.from('alertas').select('id').eq('alumno_id', user.id).eq('tipo', 'baja_comprension').eq('resuelta', false).gte('creado_en', new Date(Date.now() - 3600000).toISOString()).maybeSingle()
      if (!alertaExist) {
        const { data: asig } = await supabase.from('guia_asignaciones').select('guia_id, guia:guia_id(email, nombre_completo)').eq('colegio_id', perfil.colegio_id).eq('activo', true).or(`alumno_id.eq.${user.id},grado.eq.${perfil.grado || ''}`).limit(1).maybeSingle()
        await supabase.from('alertas').insert({ alumno_id: user.id, colegio_id: perfil.colegio_id, guia_id: asig?.guia_id || null, tipo: 'baja_comprension', descripcion: `${perfil.nombre_completo} tuvo 3 respuestas incorrectas consecutivas${alerta_materia ? ' en ' + alerta_materia : ''}.`, contexto: alerta_materia + (alerta_tema ? ' — ' + alerta_tema : '') })
        if (asig?.guia) {
          try {
            const guia = asig.guia as unknown as {email:string; nombre_completo:string}
            const { Resend } = await import('resend')
            await new Resend(process.env.RESEND_API_KEY).emails.send({ from: 'Owlaris <noreply@owlaris.app>', to: guia.email, subject: `Alerta: Baja comprensión — ${perfil.nombre_completo}`, html: '<div style="font-family:system-ui;max-width:500px;margin:0 auto"><div style="background:#2C3E6B;padding:20px;border-radius:12px 12px 0 0"><h2 style="color:white;margin:0">Alerta Pedagógica — Owlaris</h2></div><div style="background:white;padding:20px;border:1px solid #E2E8F0;border-radius:0 0 12px 12px"><p>Hola <strong>' + guia.nombre_completo + '</strong>,</p><p>El alumno <strong>' + perfil.nombre_completo + '</strong> (' + (perfil.grado||'') + ') tuvo <strong>3 respuestas incorrectas consecutivas</strong> en Owlaris.</p><a href="https://owlaris.app/guia" style="display:inline-block;background:#2C3E6B;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;margin-top:12px">Ver en Owlaris →</a></div></div>' })
          } catch(e) { console.error('Email error:', e) }
        }
      }
    }

    // Modo conversación inglés
    const esModoConversacion = body.modo_conversacion || false
    if (esModoConversacion) {
      const historialConv = (historial || []).slice(-4).map((m: {rol:string;contenido:string}) => ({ role: m.rol === 'usuario' ? 'user' as const : 'assistant' as const, content: m.contenido }))
      const completion = await openai.chat.completions.create({ model: 'gpt-4o-mini', max_tokens: 60, temperature: 0.8, messages: [{ role: 'system', content: 'You are Owlaris, a friendly English conversation coach for Guatemalan students. ALWAYS respond in English only. Keep responses SHORT: 1-2 sentences max. Gently correct grammar by modeling the correct form. Ask ONE follow-up question. Be warm and encouraging.' }, ...historialConv, { role: 'user', content: pregunta }] })
      const respuesta = completion.choices[0].message.content || ''
      await supabase.from('interacciones').insert({ usuario_id: user.id, colegio_id: perfil.colegio_id, grado: perfil.grado || '', tema_detectado: 'Conversación en Inglés', pregunta: pregunta.substring(0, 500), respuesta: respuesta.substring(0, 1000), tokens_usados: completion.usage?.total_tokens || 0, costo_usd: (completion.usage?.total_tokens || 0) * 0.00000015, modelo_usado: 'gpt-4o-mini', sospecha_copia: false })
      supabase.from('usuarios').update({ ultimo_acceso: new Date().toISOString() }).eq('id', user.id).then(() => {})
      return NextResponse.json({ respuesta, nuevo_estado: 'activo', tokens: completion.usage?.total_tokens || 0 })
    }

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
      contextoContenido = `No se encontró documento específico en SharePoint. Responde con conocimiento general.`
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

    const completion = await openai.chat.completions.create({ model: 'gpt-4o-mini', messages: mensajesOpenAI, max_tokens: 700, temperature: 0.7 })
    let respuesta = completion.choices[0].message.content || 'No pude generar una respuesta.'

    // CONTRADICTION GUARD FINAL — última línea de defensa
    // Aunque el modelo no usó [OP:], si dice incorrecto=correcto, lo bloqueamos
    const studentN = normalizeStudentAnswer(pregunta)
    if (studentN !== null) {
      const respuestaLow = respuesta.toLowerCase()
      const dijoIncorrecto = respuestaLow.includes('incorrecto') || respuestaLow.includes('incorrect')
      const opDeContexto = materiaNumerica
        ? (inferCanonicalOperationFromText(ultimoMensajeAsistente(historial)) || inferCanonicalOperationFromText(respuesta))
        : null
      const respuestaCorrectaCalculada = opDeContexto ? solveOperation(opDeContexto) : null
      if (dijoIncorrecto && respuestaCorrectaCalculada !== null && Math.abs(studentN - respuestaCorrectaCalculada) < 0.001) {
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

    if (tipoPregunta === 'formativa') {
      respuesta += '\n\nTe comparto este recurso de Eduardo Montano que puede ayudarte: https://www.youtube.com/c/EduardoMontano'
    }

    const tokensUsados = completion.usage?.total_tokens || 0
    const costoUSD = tokensUsados * 0.00000015

    // Extraer OP de la respuesta del tutor y limpiar texto visible
    const { visibleText: _respLimpia, operation: _opExtraida } = extractAndCleanOperation(respuesta)
    respuesta = _respLimpia
    const opInferida = !_opExtraida && materiaNumerica && looksLikeMathPracticePrompt(respuesta)
      ? inferCanonicalOperationFromText(respuesta)
      : null
    const opFinalRespuesta = _opExtraida || opInferida
    const opValidaEnRespuesta = isSafeCanonicalOperation(opFinalRespuesta) ? opFinalRespuesta : null
    const guardiaHumanistica = guardHumanisticResponse(respuesta, {
      materia: materia?.nombre || materia_id,
      tipoPregunta,
      materiaNumerica,
      hasVerifiedOperation: !!opValidaEnRespuesta,
      idiomaIngles,
    })
    respuesta = guardiaHumanistica.text

    const { data: insertedRow, error: insertErr } = await supabase.from('interacciones').insert({
      usuario_id: user.id, colegio_id: perfil.colegio_id, materia_id: materia_uuid,
      grado: gradoEfectivo, tema_detectado: pregunta.substring(0, 100),
      pregunta, respuesta, tokens_usados: tokensUsados, costo_usd: costoUSD,
      modelo_usado: 'gpt-4o-mini', documento_fuente: documentoFuente,
      sospecha_copia: detectarCopia(pregunta),
      operacion_canonica: opValidaEnRespuesta || null,
      op_estado: opValidaEnRespuesta ? 'pendiente' : null,
      estado_evaluacion: evaluacionProtocolo?.estado || null,
      guard_activado: evaluacionProtocolo?.guardActivado || guardiaHumanistica.guardActivado || false,
    }).select('id').single()
    const insertedId = insertedRow?.id || null
    if (insertErr) console.error('INSERT interaccion ERROR:', insertErr.message)

    if (tipoPregunta === 'academica' && !contenidoCurricular && materia) await registrarPendiente(supabase, perfil, materia, pregunta)

    // Alertas pedagógicas
    await verificarAlertasBajaComprension(supabase, user.id, perfil, gradoEfectivo, materia, respuesta, documentoFuente)

    supabase.from('usuarios').update({ ultimo_acceso: new Date().toISOString() }).eq('id', user.id).then(() => {})

    return NextResponse.json({ 
      respuesta, tokens: tokensUsados, documento_fuente: documentoFuente,
      interaction_id: insertedId,
      pending_math_interaction_id: opValidaEnRespuesta ? insertedId : null,
    })

  } catch (err) {
    console.error('Error /api/preguntar:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// Función de alertas pedagógicas extraída para reutilización
async function verificarAlertasBajaComprension(
  supabase: ReturnType<typeof import('@/lib/supabase/server').createClient>,
  userId: string,
  perfil: { id?: string; colegio_id: string; grado?: string; nombre_completo: string },
  gradoEfectivo: string,
  materia: { nombre: string } | null,
  respuesta: string,
  documentoFuente: string | null
) {
  try {
    if (typeof respuesta !== 'string') return
    const esIncorrecta = respuesta.toLowerCase().includes('incorrecto') ||
      respuesta.toLowerCase().includes('no es correcto') ||
      respuesta.toLowerCase().includes('vamos a revisarlo') ||
      respuesta.toLowerCase().includes('vamos a analizarlo')
    if (!esIncorrecta) return

    const hace1h = new Date(Date.now() - 3600000).toISOString()
    const { data: recientes } = await supabase.from('interacciones').select('respuesta').eq('usuario_id', userId).gte('creado_en', hace1h)
    const fallos = (recientes || []).filter((i: {respuesta?: string}) =>
      i.respuesta?.toLowerCase().includes('incorrecto') || i.respuesta?.toLowerCase().includes('vamos a revisar')
    ).length
    if (fallos < 2) return

    const { data: yaExiste } = await supabase.from('alertas').select('id').eq('alumno_id', userId).eq('tipo', 'baja_comprension').eq('resuelta', false).gte('creado_en', hace1h).maybeSingle()
    if (yaExiste) return

    let asig = null
    const { data: asigAlumno } = await supabase.from('guia_asignaciones').select('guia_id, guia:guia_id(email, nombre_completo)').eq('colegio_id', perfil.colegio_id).eq('activo', true).eq('tipo', 'alumno').eq('alumno_id', userId).limit(1).maybeSingle()
    if (asigAlumno) { asig = asigAlumno } else {
      const { data: asigGrado } = await supabase.from('guia_asignaciones').select('guia_id, guia:guia_id(email, nombre_completo)').eq('colegio_id', perfil.colegio_id).eq('activo', true).eq('tipo', 'grado').eq('grado', gradoEfectivo || perfil.grado || '').limit(1).maybeSingle()
      asig = asigGrado
    }

    await supabase.from('alertas').insert({ alumno_id: userId, colegio_id: perfil.colegio_id, guia_id: asig?.guia_id || null, tipo: 'baja_comprension', descripcion: perfil.nombre_completo + ' tuvo ' + (fallos+1) + ' respuestas incorrectas' + (materia?.nombre ? ' en ' + materia.nombre : '') + '.', contexto: documentoFuente || '' })

    if (asig?.guia) {
      try {
        const guia = asig.guia as unknown as {email:string; nombre_completo:string}
        const { Resend } = await import('resend')
        await new Resend(process.env.RESEND_API_KEY).emails.send({ from: 'Owlaris <noreply@owlaris.app>', to: guia.email, subject: 'Alerta: Baja comprension - ' + perfil.nombre_completo, html: '<p>Hola ' + guia.nombre_completo + ',</p><p><strong>' + perfil.nombre_completo + '</strong> tuvo ' + (fallos+1) + ' respuestas incorrectas en Owlaris.</p><a href="https://owlaris.app/guia">Ver en Owlaris</a>' })
      } catch(e) { console.error('Email alerta:', e) }
    }
  } catch { /* silencioso */ }
}
