export function normalizarMateria(texto: string, esOlimpiadas = false): string {
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

export const TEMAS_POR_MATERIA: Record<string, string[]> = {
  'Matemática': ['aritmética','aritmetica','algebra','álgebra','geometría','geometria','fracciones','ecuaciones','trigonometría','trigonometria','estadística','estadistica','probabilidad','porcentajes','decimales','números','numeros','matrices','funciones','polinomios','logaritmos'],
  // Hallazgo real (reporte de un maestro, 2026-07-08): un problema de
  // aplicación de Matemática ("la velocidad es 20, encuentra el tiempo:
  // distancia = velocidad * tiempo") se detectó como "Física" solo por
  // mencionar "velocidad", y el tutor sugirió cambiar de materia en medio
  // de un ejercicio de álgebra legítimo (el alumno mismo aclaró "es
  // matemáticas porque estamos despejando X"). "velocidad" y "trabajo"
  // se quitan de esta lista: son vocabulario que también aparece en
  // problemas de aplicación de Matemática (velocidad) o son palabras del
  // español cotidiano sin relación con Física en absoluto ("trabajo" —
  // "mi trabajo de matemática", "tengo mucho trabajo"). El resto de la
  // lista sigue siendo suficientemente específico de Física.
  'Física': ['cinemática','cinematica','dinámica','dinamica','fuerza','movimiento','aceleración','aceleracion','energía','energia','calor','temperatura','ondas','luz','electricidad','magnetismo','gravedad','óptica','optica'],
  'Química': ['átomo','atomo','molécula','molecula','enlace','reacción','reaccion','tabla periódica','tabla periodica','ácido','acido','base','solución','solucion','oxidación','oxidacion','elemento','compuesto','estequiometría'],
  // Hallazgo real (QA en vivo, 2026-07-14, cuenta Paul): un ejercicio
  // genuino de Biología sobre el método científico ("¿cómo afecta la
  // cantidad de agua diaria al crecimiento de una planta de frijol?" —
  // respondiendo directamente a lo que el tutor acababa de pedir) se
  // detectó como "Ciencias Naturales" solo porque "planta" y "crecimiento"
  // no estaban en la lista de Biología, pero sí en la de Ciencias
  // Naturales — la biología de plantas (crecimiento, germinación, etc.)
  // es contenido central de Biología, no exclusivo de Ciencias Naturales.
  'Biología': ['célula','celula','fotosíntesis','fotosintesis','adn','genética','genetica','gen','genes','herencia','alelo','alelos','rasgo','rasgos','evolución','evolucion','ecosistema','ecosistemas','ecología','ecologia','biodiversidad','organismo','organismos','proteína','proteina','mitosis','meiosis','respiración celular','anatomía','anatomia','fisiología','fisiologia','reproducción','reproduccion','adaptación','adaptacion','planta','plantas','crecimiento','germinación','germinacion','semilla','semillas','raíz','raiz','raíces','raices','tallo','tallos'],
  'Historia': ['guerra','revolución','revolucion','independencia','civilización','civilizacion','colonia','conquista','maya','azteca','inca','república','republica','democracia','feudalismo'],
  // Hallazgo real (QA en vivo, 2026-07-16, cuenta Paul): el alumno seleccionó
  // el tema oficial "Signo lingüístico, funciones, dialectos y paralenguaje"
  // directamente de la lista de temas que Owlaris acababa de mostrarle para
  // "Comunicación y Lenguaje Idioma Español" — pero como esa lista no tenía
  // ninguna palabra de vocabulario lingüístico ("lingüístico", "paralenguaje",
  // "dialecto") que coincideConMateria pudiera reconocer como Español, la
  // palabra "funciones" (también vocabulario típico de Matemática, ej.
  // "funciones lineales") activó un falso candado sugiriendo cambiar a
  // Matemática, en un tema que es 100% de Lenguaje.
  'Español': ['gramática','gramatica','sintaxis','ortografía','ortografia','redacción','redaccion','literatura','poesía','poesia','narración','narracion','verbo','sustantivo','adjetivo','párrafo','parrafo','lingüístico','linguistico','lingüística','linguistica','paralenguaje','dialecto','dialectos','fonema','fonemas','morfema','morfemas','semántica','semantica'],
  'Inglés': ['vocabulary','grammar','verb','tense','sentence','reading','writing','speaking','listening','english'],
  'Ciencias Naturales': ['planta','animal','ecosistema','medio ambiente','naturaleza','suelo','agua','aire','clima','biodiversidad','nutrición','nutricion'],
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function coincideConMateria(t: string, materia: string): boolean {
  const temas = TEMAS_POR_MATERIA[materia]
  if (!temas) return false
  return temas.some((tema) => {
    const temaNorm = tema.replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i').replace(/ó/g,'o').replace(/ú/g,'u')
    return new RegExp(`\\b${escapeRegExp(temaNorm)}\\b`).test(t)
  })
}

// Hallazgo real (QA en vivo, 2026-07-14): las listas de palabras clave de
// materias con dominio superpuesto (Biología / Ciencias Naturales) nunca
// van a estar completamente libres de solapamiento — es whack-a-mole
// agregar una palabra a la vez. Como defensa general (no solo para este
// caso puntual), si el mensaje TAMBIÉN coincide con las palabras clave de
// la materia ACTIVA, no se trata como señal clara de cambio: la materia
// activa ya cubre razonablemente el mensaje, así que no vale la pena
// interrumpir con una pregunta de "¿quieres cambiar?" por una ambigüedad
// de vocabulario compartido.
// Hallazgo real (QA en vivo, 2026-07-19): en Comunicación y Lenguaje (1ero y
// 2do Básico), un ejercicio de ESCRITURA que el propio tutor asignó ("tu
// animal favorito", "un árbol con pájaros") se marcó como posible cambio a
// Ciencias Naturales solo porque la respuesta del alumno —al responder
// exactamente lo que se le pidió— mencionaba esas palabras. A diferencia de
// Matemática/Ciencias/Historia (donde el vocabulario sí correlaciona con la
// materia), las materias de lenguaje/escritura son temáticamente libres por
// diseño: un ejercicio de redacción o comprensión lectora puede tratar
// cualquier tema del mundo sin que eso implique ningún cambio de materia.
// El vocabulario de contenido de la respuesta del alumno nunca es una señal
// confiable de cambio de materia en estas clases.
const MATERIAS_TEMATICAMENTE_LIBRES = new Set(['Español', 'Inglés'])

export function detectarMateriaDesdeTexto(texto: string, materiaActual?: string | null): string | null {
  if (materiaActual && MATERIAS_TEMATICAMENTE_LIBRES.has(normalizarMateria(materiaActual))) return null
  const t = texto.toLowerCase().replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i').replace(/ó/g,'o').replace(/ú/g,'u')
  if (materiaActual && coincideConMateria(t, materiaActual)) return null
  for (const [materia, temas] of Object.entries(TEMAS_POR_MATERIA)) {
    for (const tema of temas) {
      const temaNorm = tema.replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i').replace(/ó/g,'o').replace(/ú/g,'u')
      // Coincidencia de palabra completa: un substring simple confundía
      // "revolución" (Historia) con "evolución" (Biología), porque
      // "revolucion".includes("evolucion") es true.
      if (new RegExp(`\\b${escapeRegExp(temaNorm)}\\b`).test(t)) return materia
    }
  }
  return null
}

// detectarMateriaDesdeTexto/normalizarMateria solo conocen el set cerrado de
// materias CNB en español (Matemática, Física, Química, Biología, Historia,
// Español, Inglés, Ciencias Naturales). eScholaris usa clases más granulares
// en inglés (Geometry, Algebra I, Math Grade 6, etc.) que NO existen en ese
// set: si la materia activa no normaliza a una de esas 8 claves, comparar
// "materiaDetectada !== materia_id" no tiene sentido y genera falsos
// positivos (ej. un alumno de "Geometry" mencionando "ecuaciones" activaba
// "¿quieres cambiar a Matemática?" aunque ya estaba en la materia correcta).
export function materiaActualEnSistemaCNB(materiaId: string): boolean {
  if (!materiaId) return false
  return Object.prototype.hasOwnProperty.call(TEMAS_POR_MATERIA, normalizarMateria(materiaId))
}

// Hallazgo real (QA 100 pruebas, 2026-07-14): el candado de tema sugiere
// cambiar de materia usando la categoría CNB genérica que detectarMateriaDesdeTexto
// devuelve por palabras clave (ej. "Biología") — pero una cuenta eScholaris
// (contenido estilo EEUU) no tiene una clase llamada literalmente "Biología"
// en Grado 8, sino "Science Grade 8" ("Biología" es exclusiva de Grado 10 en
// esa cuenta). El aviso terminaba ofreciendo cambiar a una materia que no
// existe para ese grado. Se resuelve la categoría CNB contra la lista real
// de materias disponibles del alumno (ya sea por nombre exacto — cuentas
// Mineduc que sí usan el nombre CNB literal — o por palabra clave típica de
// nombre de clase eScholaris) antes de mostrarla u ofrecerla como cambio.
// Si no hay ninguna coincidencia, se conserva la categoría genérica tal cual
// (comportamiento anterior, sin regresión para cuentas sin esa lista).
const CATEGORIA_A_PALABRAS_CLASE_MATERIA: Record<string, string[]> = {
  'Física': ['science', 'físic', 'fisic'],
  'Química': ['science', 'quím', 'quim', 'chem'],
  'Biología': ['science', 'biolog'],
  'Ciencias Naturales': ['science', 'natural'],
  'Matemática': ['math', 'matem'],
  'Historia': ['social studies', 'histor'],
  'Español': ['spanish', 'español', 'espanol', 'language arts'],
  'Inglés': ['english', 'ingl'],
}

export function resolverMateriaRealDisponible(categoriaDetectada: string, materiasDisponibles: string[]): string {
  if (!Array.isArray(materiasDisponibles) || materiasDisponibles.length === 0) return categoriaDetectada
  const exacta = materiasDisponibles.find((m) => normalizarMateria(m) === categoriaDetectada)
  if (exacta) return exacta
  const palabrasClave = CATEGORIA_A_PALABRAS_CLASE_MATERIA[categoriaDetectada] || []
  if (palabrasClave.length === 0) return categoriaDetectada
  const porPalabraClave = materiasDisponibles.find((m) => {
    const normalizado = m.toLowerCase()
    return palabrasClave.some((palabra) => normalizado.includes(palabra))
  })
  return porPalabraClave || categoriaDetectada
}

// Hallazgo real (instructivo de mejoras, ronda 2026-07-11), ítems 15-16: la
// palabra "english" está en TEMAS_POR_MATERIA['Inglés'] para detectar cuando
// un alumno quiere cambiar a la clase de Inglés, pero esa misma palabra
// aparece en peticiones que solo piden el idioma de la RESPUESTA ("can you
// answer in english", "responde en inglés"), no un cambio de materia. Sin
// esta excepción, pedir la respuesta en otro idioma en medio de Matemática
// (por ejemplo) activaba "cambio_materia_grado" hacia Inglés.
// Hallazgo real (verificación posterior, 2026-07-12): dos problemas
// distintos hacían que esto siguiera fallando pese al fix original. (1) La
// función no le quitaba los acentos al texto, así que "explícame" (con
// acento) nunca coincidía con un patrón escrito "explicame" — se agrega
// normalización de acentos, igual que el resto del archivo. (2) Solo
// cubría responde/contesta/habla — el verbo más natural para esto,
// "explica"/"explícame"/"explicarme"/"explicas", no estaba cubierto en
// ninguna de sus formas. Se usa un comodín de sufijo (\w*) sobre la raíz
// del verbo en vez de enumerar cada conjugación.
const PETICION_SOLO_IDIOMA = [
  /\b(?:responde\w*|contesta\w*|habla\w*|explica\w*|dime\w*|cuentame|escribelo|ponlo|puedes\s+\w+)\s+(?:esto\s+|eso\s+|lo\s+mismo\s+)?en\s+ingles\b/,
  /\ben\s+ingles\s+por\s+favor\b/,
  /\btraduce\w*\s+(?:esto\s+)?(?:al|a)\s+ingles\b/,
  /\b(?:respond|answer|reply|talk|speak|explain|say|write)\w*\s+(?:this|it|that)?\s*in\s+english\b/,
  /\bin\s+english\s+please\b/,
  /\bcan\s+you\s+\w+\s+(?:this|it|that)?\s*in\s+english\b/,
  /\btranslate\s+(?:this|it|that)?\s*(?:to|into)\s+english\b/,
]
export function isLanguageSwitchRequest(text: string): boolean {
  const t = (text || '').toLowerCase()
    .replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i').replace(/ó/g,'o').replace(/ú/g,'u')
  return PETICION_SOLO_IDIOMA.some((pattern) => pattern.test(t))
}
