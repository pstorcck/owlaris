export type ColegioSharePointInput = {
  nombre?: string | null
  slug?: string | null
  sharepoint_folder?: string | null
} | string | null | undefined

export const CARPETA_COMPARTIDA_OWLARIS = 'Colegio Montano y Escolaris'
export const GRADOS_MONTANO_ESCOLARIS = [
  '4to Primaria',
  '5to Primaria',
  '6to Primaria',
  '1ero Básico',
  '2do Básico',
  '3ero Básico',
  '4to Bachillerato',
  '5to Bachillerato',
]
export const GRADOS_ESCHOLARIS = [
  'Grado 6',
  'Grado 7',
  'Grado 8',
  'Grado 9',
  'Grado 10',
  'Grado 11',
  'Grado 12',
]

function normalizeKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function normalizeSharePointKey(value: string) {
  return normalizeKey(value).replace(/[^a-z0-9]+/g, ' ').trim()
}

function pushUnique(target: string[], value?: string | null) {
  const clean = (value || '').trim()
  if (clean && !target.includes(clean)) target.push(clean)
}

export function pushUniqueSharePointName(target: string[], value?: string | null) {
  pushUnique(target, value)
}

export function isSharePointDocx(name: string) {
  const clean = (name || '').trim()
  return clean.toLowerCase().endsWith('.docx') && !clean.startsWith('~$')
}

const SUBJECT_PATTERNS: Array<{ subject: string; patterns: RegExp[] }> = [
  { subject: 'Matemática', patterns: [/\bmatematica\b/, /\bmatematicas\b/, /\bmath\b/, /\bmathematics\b/, /\balgebra\b/, /\bgeometria\b/, /\bgeometry\b/] },
  { subject: 'Español', patterns: [/\bespanol\b/, /\blenguaje\b/, /\bliteratura\b/, /\bcomunicacion\b/, /\blectura\b/, /\bspanish\b/] },
  { subject: 'Inglés', patterns: [/\bingles\b/, /\benglish\b/, /\bela\b/, /\blanguage arts\b/] },
  { subject: 'Ciencias Naturales', patterns: [/\bciencias naturales\b/, /\bnatural science\b/, /\bscience\b/, /\bciencias\b/, /\bnaturales\b/] },
  { subject: 'Ciencias Sociales', patterns: [/\bciencias sociales\b/, /\bestudios sociales\b/, /\bsocial studies\b/, /\bsociales\b/, /\bhistoria\b/, /\bhistory\b/, /\bgeografia\b/, /\bgeography\b/] },
  { subject: 'Biología', patterns: [/\bbiologia\b/, /\bbiology\b/] },
  { subject: 'Física', patterns: [/\bfisica\b/, /\bphysics\b/] },
  { subject: 'Química', patterns: [/\bquimica\b/, /\bchemistry\b/] },
  { subject: 'Computación', patterns: [/\bcomputacion\b/, /\binformatica\b/, /\btechnology\b/, /\btecnologia\b/] },
  { subject: 'Arte', patterns: [/\barte\b/, /\bart\b/, /\bmusica\b/, /\bmusic\b/] },
  { subject: 'Educación Física', patterns: [/\beducacion fisica\b/, /\bphysical education\b/, /\bpe\b/] },
]

export function inferSubjectFromSharePointName(name: string) {
  const normalized = normalizeSharePointKey(name.replace(/\.docx$/i, ' '))
  for (const { subject, patterns } of SUBJECT_PATTERNS) {
    if (patterns.some(pattern => pattern.test(normalized))) return subject
  }
  return null
}

export function sharePointNameMatchesSubject(name: string, subject: string) {
  const normalizedName = normalizeSharePointKey(name)
  const normalizedSubject = normalizeSharePointKey(subject)
  if (!normalizedName || !normalizedSubject) return false
  if (normalizedName.includes(normalizedSubject)) return true
  const inferred = inferSubjectFromSharePointName(name)
  if (inferred && normalizeSharePointKey(inferred) === normalizedSubject) return true

  const subjectWords = normalizedSubject.split(' ').filter(word => word.length > 2)
  return subjectWords.length > 0 && subjectWords.every(word => normalizedName.includes(word))
}

function getRawValues(input: ColegioSharePointInput) {
  const rawValues: string[] = []
  if (typeof input === 'string') {
    rawValues.push(input)
  } else if (input) {
    rawValues.push(input.sharepoint_folder || '', input.slug || '', input.nombre || '')
  }
  return rawValues.filter(Boolean)
}

function normalizedInput(input: ColegioSharePointInput) {
  return getRawValues(input).map(normalizeKey).join(' ')
}

export function isEScholarisSchool(input: ColegioSharePointInput) {
  return normalizedInput(input).includes('escholaris')
}

export function isMontanoEscolarisSchool(input: ColegioSharePointInput) {
  const normalized = normalizedInput(input)
  return !isEScholarisSchool(input) && (
    normalized.includes('montano') ||
    normalized.includes('escolaris') ||
    normalized.includes('colegio-escolaris')
  )
}

export function getSharePointFolderCandidates(input: ColegioSharePointInput): string[] {
  const rawValues = getRawValues(input)

  const folders: string[] = []
  rawValues.forEach(value => pushUnique(folders, value))

  if (isEScholarisSchool(input)) {
    pushUnique(folders, 'eScholaris')
    pushUnique(folders, 'Escholaris')
    pushUnique(folders, 'e-scholaris')
    return folders
  }

  if (isMontanoEscolarisSchool(input)) {
    pushUnique(folders, CARPETA_COMPARTIDA_OWLARIS)
    pushUnique(folders, 'Colegio Montano')
    pushUnique(folders, 'Colegio Escolaris')
    pushUnique(folders, 'Escolaris')
    pushUnique(folders, 'colegio-escolaris')
    return folders
  }

  pushUnique(folders, CARPETA_COMPARTIDA_OWLARIS)
  return folders
}

export function includeSharedPrograms(input: ColegioSharePointInput) {
  return isMontanoEscolarisSchool(input)
}

export function getExpectedGradeFallbacks(input: ColegioSharePointInput) {
  return isEScholarisSchool(input) ? GRADOS_ESCHOLARIS : GRADOS_MONTANO_ESCOLARIS
}

export function isLikelyGradeFolder(name: string, input?: ColegioSharePointInput) {
  const normalized = normalizeKey(name)
  const expected = (input ? getExpectedGradeFallbacks(input) : [...GRADOS_MONTANO_ESCOLARIS, ...GRADOS_ESCHOLARIS])
    .map(normalizeKey)
  if (expected.includes(normalized)) return true
  if (/^grado\s*(6|7|8|9|10|11|12)$/.test(normalized)) return true
  if (/^(6|7|8|9|10|11|12)(st|nd|rd|th)?\s*grade$/.test(normalized)) return true
  return /(primaria|basico|bachillerato)$/.test(normalized)
}

export function sortGradesForSchool(grades: string[], input?: ColegioSharePointInput) {
  const expected = getExpectedGradeFallbacks(input).map(normalizeKey)
  return [...grades].sort((a, b) => {
    const ia = expected.indexOf(normalizeKey(a))
    const ib = expected.indexOf(normalizeKey(b))
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
    return a.localeCompare(b, 'es')
  })
}

function englishOrdinalGrade(num: string) {
  const n = Number(num)
  if (n === 1) return '1st Grade'
  if (n === 2) return '2nd Grade'
  if (n === 3) return '3rd Grade'
  return `${num}th Grade`
}

export function getGradeFolderCandidates(grado?: string | null) {
  const folders: string[] = []
  const clean = (grado || '').trim()
  pushUnique(folders, clean)
  if (!clean) return folders

  const normalized = normalizeKey(clean)
  pushUnique(folders, clean.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))

  const gradeNumber = normalized.match(/^grado\s*(\d+)$/)?.[1]
    || normalized.match(/^(\d+)(?:st|nd|rd|th)?\s*grade$/)?.[1]
  if (gradeNumber) {
    pushUnique(folders, gradeNumber)
    pushUnique(folders, `Grado ${gradeNumber}`)
    pushUnique(folders, `Grade ${gradeNumber}`)
    pushUnique(folders, englishOrdinalGrade(gradeNumber))
  }

  const spanishVariants: Record<string, string[]> = {
    '1ero basico': ['1ero Básico', '1ero Basico', 'Primero Básico', 'Primero Basico'],
    '2do basico': ['2do Básico', '2do Basico', 'Segundo Básico', 'Segundo Basico'],
    '3ero basico': ['3ero Básico', '3ero Basico', 'Tercero Básico', 'Tercero Basico'],
    '4to primaria': ['4to Primaria', '4to Primaria', 'Cuarto Primaria'],
    '5to primaria': ['5to Primaria', '5to Primaria', 'Quinto Primaria'],
    '6to primaria': ['6to Primaria', '6to Primaria', 'Sexto Primaria'],
    '4to bachillerato': ['4to Bachillerato', '4to Bachillerato', 'Cuarto Bachillerato'],
    '5to bachillerato': ['5to Bachillerato', '5to Bachillerato', 'Quinto Bachillerato'],
  }
  Object.entries(spanishVariants).forEach(([key, values]) => {
    if (normalized === key) values.forEach(value => pushUnique(folders, value))
  })

  return folders
}
