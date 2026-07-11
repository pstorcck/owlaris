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
  'Biología': ['célula','celula','fotosíntesis','fotosintesis','adn','genética','genetica','gen','genes','herencia','alelo','alelos','rasgo','rasgos','evolución','evolucion','ecosistema','ecosistemas','ecología','ecologia','biodiversidad','organismo','organismos','proteína','proteina','mitosis','meiosis','respiración celular','anatomía','anatomia','fisiología','fisiologia','reproducción','reproduccion','adaptación','adaptacion'],
  'Historia': ['guerra','revolución','revolucion','independencia','civilización','civilizacion','colonia','conquista','maya','azteca','inca','república','republica','democracia','feudalismo'],
  'Español': ['gramática','gramatica','sintaxis','ortografía','ortografia','redacción','redaccion','literatura','poesía','poesia','narración','narracion','verbo','sustantivo','adjetivo','párrafo','parrafo'],
  'Inglés': ['vocabulary','grammar','verb','tense','sentence','reading','writing','speaking','listening','english'],
  'Ciencias Naturales': ['planta','animal','ecosistema','medio ambiente','naturaleza','suelo','agua','aire','clima','biodiversidad','nutrición','nutricion'],
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function detectarMateriaDesdeTexto(texto: string): string | null {
  const t = texto.toLowerCase().replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i').replace(/ó/g,'o').replace(/ú/g,'u')
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

// Hallazgo real (instructivo de mejoras, ronda 2026-07-11), ítems 15-16: la
// palabra "english" está en TEMAS_POR_MATERIA['Inglés'] para detectar cuando
// un alumno quiere cambiar a la clase de Inglés, pero esa misma palabra
// aparece en peticiones que solo piden el idioma de la RESPUESTA ("can you
// answer in english", "responde en inglés"), no un cambio de materia. Sin
// esta excepción, pedir la respuesta en otro idioma en medio de Matemática
// (por ejemplo) activaba "cambio_materia_grado" hacia Inglés.
const PETICION_SOLO_IDIOMA = [
  /\b(?:responde|respondeme|contesta|contestame|habla|hablame|puedes\s+(?:hablar|responder|contestar))\s+en\s+ingl[ée]s\b/i,
  /\ben\s+ingl[ée]s\s+por\s+favor\b/i,
  /\btraduce(?:lo|melo)?\s+(?:esto\s+)?(?:al|a)\s+ingl[ée]s\b/i,
  /\b(?:respond|answer|reply|talk|speak)\s+in\s+english\b/i,
  /\bin\s+english\s+please\b/i,
  /\bcan\s+you\s+(?:answer|respond|reply|talk|speak)\s+in\s+english\b/i,
  /\btranslate\s+(?:this|it|that)?\s*(?:to|into)\s+english\b/i,
]
export function isLanguageSwitchRequest(text: string): boolean {
  return PETICION_SOLO_IDIOMA.some((pattern) => pattern.test(text || ''))
}
