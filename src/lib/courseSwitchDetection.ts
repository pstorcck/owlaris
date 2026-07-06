function normalizeText(value: string) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Frases que introducen una mención explícita de materia/curso/grado — no
// dependen del set cerrado de materias CNB en español, para detectar casos
// como "Dime los temas de Science Grade 8" en colegios con cursos
// granulares en inglés (eScholaris: Geometry, Algebra I, Math Grade 6...).
const FRASES_DISPARADORAS = [
  'dime los temas de',
  'dame los temas de',
  'dame el indice de',
  'dime el indice de',
  'quiero ver',
  'cambia a',
  'cambiemos a',
  'cambiar a',
  'quiero cambiar a',
  'quiero practicar',
  'quiero estudiar',
  'ensename el curso de',
  'enseñame el curso de',
  'muestrame',
  'muéstrame',
  'pasar a',
  'pasemos a',
  'vamos a',
  'switch to',
  'show me',
  'change to',
  'i want to see',
  'i want to study',
  'let us switch to',
  'lets switch to',
  'teach me',
]

// Un nombre de curso "tipo eScholaris" — asignatura en inglés, con o sin
// número de grado ("Science Grade 8", "Biology Grade 10", "Geometry",
// "Algebra 2", "Math Grade 6"). No exige que la materia exista en el set
// CNB: cualquier nombre con esta forma es candidato a mención explícita de
// curso, independientemente de si coincide con la materia activa.
const PATRON_CURSO_CON_GRADO = /\b(?:grade|grado)\s*\d{1,2}\b/i
const PALABRAS_MATERIA_GENERICAS = /\b(algebra|geometry|geometr[ií]a|calculus|c[aá]lculo|biology|biolog[ií]a|chemistry|qu[ií]mica|physics|f[ií]sica|science|ciencias?|math(?:ematics)?|matem[aá]ticas?|english|ingl[eé]s|literature|literatura|history|historia|spanish|espa[ñn]ol)\b/i

export function looksLikeCourseOrGradeName(candidate: string): boolean {
  const texto = (candidate || '').trim()
  if (!texto || texto.length > 60) return false
  return PATRON_CURSO_CON_GRADO.test(texto) || PALABRAS_MATERIA_GENERICAS.test(texto)
}

export function extractExplicitCourseMention(pregunta: string): string | null {
  const normalizado = normalizeText(pregunta)
  if (!normalizado) return null
  for (const frase of FRASES_DISPARADORAS) {
    const idx = normalizado.indexOf(frase)
    if (idx === -1) continue
    const resto = normalizado.slice(idx + frase.length).trim()
    if (resto && looksLikeCourseOrGradeName(resto)) {
      // Recuperar el fragmento original (no normalizado) para mostrarlo
      // legible, aproximando por longitud desde el mismo punto de corte.
      const original = pregunta.trim()
      const candidato = original.slice(-resto.length).trim() || resto
      return candidato
    }
  }
  return null
}

export function matchesAvailableCourse(candidate: string, materiasDisponibles: string[]): string | null {
  const candidatoNorm = normalizeText(candidate)
  if (!candidatoNorm) return null
  for (const materia of materiasDisponibles || []) {
    const materiaNorm = normalizeText(materia)
    if (!materiaNorm) continue
    if (candidatoNorm.includes(materiaNorm) || materiaNorm.includes(candidatoNorm)) return materia
  }
  return null
}

export type ExplicitCourseSwitchResult = {
  detectado: boolean
  cursoMencionado: string | null
  coincideDisponible: string | null
}

// Detecta una mención explícita de cambio/consulta de materia o grado sin
// depender del set cerrado CNB — instructivo de mejoras, punto 12/24.
// Si `materiasDisponibles` se provee, se prioriza la coincidencia real con
// el curso disponible; si no hay lista o no coincide, igual se reconoce la
// intención (para poder responder "no tengo esa materia disponible" en vez
// de evaluarlo como respuesta de ejercicio).
export function isExplicitCourseSwitchRequest(
  pregunta: string,
  materiasDisponibles: string[] = []
): ExplicitCourseSwitchResult {
  const cursoMencionado = extractExplicitCourseMention(pregunta)
  if (!cursoMencionado) return { detectado: false, cursoMencionado: null, coincideDisponible: null }
  const coincideDisponible = matchesAvailableCourse(cursoMencionado, materiasDisponibles)
  return { detectado: true, cursoMencionado, coincideDisponible }
}
