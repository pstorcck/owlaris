// Sprint de estabilización (auditoría 2026-07-07): antes, el grado del
// alumno se pasaba al prompt como un dato de contexto inerte ("Grado: 4to
// Primaria") sin ninguna instrucción de cómo debía cambiar la explicación
// para un niño de 9 años frente a uno de 17 — la adaptación quedaba
// enteramente al criterio del modelo. Este módulo centraliza esa regla en
// un solo lugar: vocabulario, extensión, tono, ejemplos y nivel de
// abstracción por banda de grado, para inyectarla en el prompt de cada turno.

export type BandaGrado = 'primaria' | 'basico' | 'bachillerato'

function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

// Cubre los dos sistemas de nombres de grado que usa Owlaris: CNB
// guatemalteco ("4to Primaria".."5to Bachillerato") y eScholaris en inglés
// ("Grado 6".."Grado 12", equivalente a 6th-12th grade). Un grado no
// reconocido cae a "basico" — el punto medio menos arriesgado, en vez de
// asumir el extremo más simple o más avanzado.
export function inferirBandaGrado(grado: string | null | undefined): BandaGrado {
  const g = normalizeKey(grado || '')
  if (!g) return 'basico'

  if (/\bbachillerato\b/.test(g)) return 'bachillerato'
  if (/\bbasico\b/.test(g)) return 'basico'
  if (/\bprimaria\b/.test(g)) return 'primaria'

  const numeroMatch = g.match(/(\d+)/)
  const numero = numeroMatch ? parseInt(numeroMatch[1], 10) : null
  if (numero !== null && /grado|grade/.test(g)) {
    if (numero <= 6) return 'primaria'
    if (numero <= 9) return 'basico'
    return 'bachillerato'
  }

  return 'basico'
}

type InstruccionBanda = { es: string; en: string }

const INSTRUCCIONES_POR_BANDA: Record<BandaGrado, InstruccionBanda> = {
  primaria: {
    es: `ADAPTACIÓN POR GRADO — Primaria (aprox. 9-12 años):
- Vocabulario: palabras cotidianas y sencillas; si usas un término técnico nuevo, explícalo de inmediato con una frase simple.
- Extensión: oraciones cortas, párrafos breves. No encadenes más de 2-3 ideas por respuesta.
- Tono: cálido, alentador, con mucha paciencia — celebra los intentos, no solo los aciertos.
- Ejemplos: concretos y de la vida diaria (comida, juguetes, animales, la familia, la escuela), nunca abstractos por sí solos.
- Nivel de abstracción: mínimo — apoya cualquier idea abstracta en algo concreto y visual antes de generalizar.`,
    en: `GRADE ADAPTATION — Elementary (approx. ages 9-12):
- Vocabulary: everyday, simple words; if you introduce a new technical term, explain it right away in one simple sentence.
- Length: short sentences, short paragraphs. Don't chain more than 2-3 ideas per reply.
- Tone: warm, encouraging, patient — celebrate effort, not only correct answers.
- Examples: concrete and from daily life (food, toys, animals, family, school), never abstract on their own.
- Abstraction level: minimal — ground any abstract idea in something concrete and visual before generalizing.`,
  },
  basico: {
    es: `ADAPTACIÓN POR GRADO — Básico (aprox. 13-15 años):
- Vocabulario: técnico moderado; puedes introducir términos propios de la materia con una definición breve la primera vez que aparecen.
- Extensión: párrafos de longitud media; puedes encadenar 2-3 pasos de razonamiento.
- Tono: cercano pero orientado a que el alumno gane autonomía — trátalo como alguien que ya puede sostener una idea por sí mismo.
- Ejemplos: escolares y cotidianos con un paso más de abstracción (deportes, tecnología, situaciones sociales), no solo lo concreto inmediato.
- Nivel de abstracción: moderado — puede manejar variables, generalizaciones simples y comparaciones entre conceptos.`,
    en: `GRADE ADAPTATION — Middle school (approx. ages 13-15):
- Vocabulary: moderately technical; you can introduce subject-specific terms with a brief definition the first time they appear.
- Length: medium-length paragraphs; you can chain 2-3 steps of reasoning.
- Tone: friendly but aimed at building autonomy — treat the student as someone who can already hold an idea on their own.
- Examples: school and everyday life with one extra step of abstraction (sports, technology, social situations), not just the immediately concrete.
- Abstraction level: moderate — can handle variables, simple generalizations, and comparisons between concepts.`,
  },
  bachillerato: {
    es: `ADAPTACIÓN POR GRADO — Bachillerato (aprox. 16-18 años):
- Vocabulario: terminología técnica plena de la materia, sin necesidad de simplificar los términos propios del currículo.
- Extensión: puedes desarrollar explicaciones más extensas y con más pasos cuando el tema lo requiera.
- Tono: de par académico — dale más autonomía intelectual, sin ser condescendiente ni sobre-explicar lo obvio.
- Ejemplos: pueden ser abstractos, académicos o de aplicación real/profesional, no solo cotidianos.
- Nivel de abstracción: pleno — símbolos, generalizaciones y razonamiento en varios pasos sin necesitar siempre un apoyo concreto.`,
    en: `GRADE ADAPTATION — High school (approx. ages 16-18):
- Vocabulary: full technical terminology for the subject, no need to simplify curriculum-standard terms.
- Length: you can develop longer explanations with more steps when the topic calls for it.
- Tone: academic-peer — give more intellectual autonomy, without being condescending or over-explaining the obvious.
- Examples: can be abstract, academic, or real/professional application, not only everyday ones.
- Abstraction level: full — symbols, generalizations, and multi-step reasoning without always needing concrete support.`,
  },
}

export function buildGradeAdaptationInstruction(grado: string | null | undefined, idiomaIngles = false): string {
  const banda = inferirBandaGrado(grado)
  const instruccion = INSTRUCCIONES_POR_BANDA[banda]
  return idiomaIngles ? instruccion.en : instruccion.es
}
