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
  'Física': ['cinemática','cinematica','dinámica','dinamica','fuerza','movimiento','velocidad','aceleración','aceleracion','energía','energia','trabajo','calor','temperatura','ondas','luz','electricidad','magnetismo','gravedad','óptica','optica'],
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
