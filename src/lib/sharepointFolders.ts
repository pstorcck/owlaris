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
const MINEDUC_GRADES = ['3ero Básico', '5to Bachillerato']

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

export function isSharePointPlainTextContent(name: string) {
  const clean = (name || '').trim().toLowerCase()
  return !clean.startsWith('~$') && (
    clean.endsWith('.md') ||
    clean.endsWith('.markdown') ||
    clean.endsWith('.txt')
  )
}

export function isSupportedSharePointContentFile(name: string) {
  return isSharePointDocx(name) || isSharePointPlainTextContent(name)
}

export function stripSharePointContentExtension(name: string) {
  return (name || '').replace(/\.(docx|md|markdown|txt)$/i, ' ')
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
  const normalized = normalizeSharePointKey(stripSharePointContentExtension(name))
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

function isSharedOwlarisFolderName(value: string) {
  const normalized = normalizeSharePointKey(value)
  return normalized === normalizeSharePointKey(CARPETA_COMPARTIDA_OWLARIS) ||
    normalized === 'colegio montano y colegio escolaris' ||
    normalized === 'colegio montano colegio escolaris' ||
    normalized === 'montano y escolaris' ||
    normalized === 'montano escolaris'
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

export function getSharePointFolderCandidates(
  input: ColegioSharePointInput,
  options: { includeShared?: boolean; sharedOnly?: boolean } = {}
): string[] {
  const includeShared = options.includeShared ?? true
  const rawValues = getRawValues(input)

  const ownFolders: string[] = []
  const sharedFolders: string[] = []
  const pushOwn = (value?: string | null) => pushUnique(ownFolders, value)
  const pushOwnFirst = (value?: string | null) => {
    const clean = (value || '').trim()
    if (!clean) return
    const idx = ownFolders.indexOf(clean)
    if (idx >= 0) ownFolders.splice(idx, 1)
    ownFolders.unshift(clean)
  }
  const pushShared = (value?: string | null) => pushUnique(sharedFolders, value)

  rawValues.forEach(value => {
    pushOwn(value)
    if (isSharedOwlarisFolderName(value)) pushShared(value)
  })

  if (isEScholarisSchool(input)) {
    pushOwn('eScholaris')
    pushOwn('Escholaris')
    pushOwn('e-scholaris')
    return options.sharedOnly ? [] : ownFolders
  }

  if (isMontanoEscolarisSchool(input)) {
    ;[
      'Montano Escolaris',
      'Montano y Escolaris',
      'Colegio Montano - Colegio Escolaris',
      'Colegio Montano y Colegio Escolaris',
      CARPETA_COMPARTIDA_OWLARIS,
    ].forEach(pushOwnFirst)

    rawValues.map(normalizeSharePointKey).forEach(value => {
      if ((value.includes('escolaris') || value.includes('colegio escolaris')) && !value.includes('montano')) {
        pushOwn('Colegio Escolaris')
        pushOwn('Escolaris')
        pushOwn('colegio-escolaris')
      }
      if (value.includes('montano') && !value.includes('escolaris')) {
        pushOwn('Colegio Montano')
        if (value.includes('alamos')) {
          pushOwn('Colegio Montano Portal Los Álamos')
          pushOwn('Colegio Montano Portal Los Alamos')
        }
        if (value.includes('cortijo')) pushOwn('Colegio Montano Cortijo')
      }
    })

    if (ownFolders.length === 0) {
      pushOwn('Colegio Montano')
      pushOwn('Colegio Montano Portal Los Álamos')
      pushOwn('Colegio Montano Portal Los Alamos')
      pushOwn('Colegio Montano Cortijo')
      pushOwn('Colegio Escolaris')
      pushOwn('Escolaris')
      pushOwn('colegio-escolaris')
    }

    pushShared(CARPETA_COMPARTIDA_OWLARIS)
    pushShared('Colegio Montano y Colegio Escolaris')
    pushShared('Colegio Montano - Colegio Escolaris')
    pushShared('Montano y Escolaris')
    pushShared('Montano Escolaris')

    if (options.sharedOnly) return sharedFolders
    return includeShared ? Array.from(new Set([...ownFolders, ...sharedFolders])) : ownFolders
  }

  pushShared(CARPETA_COMPARTIDA_OWLARIS)
  if (options.sharedOnly) return sharedFolders
  return includeShared ? Array.from(new Set([...ownFolders, ...sharedFolders])) : ownFolders
}

export function includeSharedPrograms(input: ColegioSharePointInput) {
  return isMontanoEscolarisSchool(input)
}

export function getExpectedGradeFallbacks(input: ColegioSharePointInput) {
  return isEScholarisSchool(input) ? GRADOS_ESCHOLARIS : GRADOS_MONTANO_ESCOLARIS
}

export function getSharedSubjectChipsForGrade(grado?: string | null) {
  const chips: string[] = []
  const normalizedGrade = normalizeSharePointKey(grado || '')
  const hasMineduc = MINEDUC_GRADES.some(g => normalizeSharePointKey(g) === normalizedGrade)
  if (hasMineduc) {
    chips.push('Mineduc - Lenguaje')
    chips.push('Mineduc - Matemática')
  }
  if (normalizedGrade) chips.push('Olimpiadas de Ciencias')
  return chips
}

function eScholarisGradeNumber(value: string) {
  const normalized = normalizeKey(value)
  const match = normalized.match(/^grado\s*(6|7|8|9|10|11|12)$/)?.[1]
    || normalized.match(/^grade\s*(6|7|8|9|10|11|12)$/)?.[1]
    || normalized.match(/^(6|7|8|9|10|11|12)(?:st|nd|rd|th)?\s*grade$/)?.[1]
    || normalized.match(/^(6|7|8|9|10|11|12)(?:st|nd|rd|th)$/)?.[1]
    || normalized.match(/^g\s*(6|7|8|9|10|11|12)$/)?.[1]
    || normalized.match(/^(6|7|8|9|10|11|12)$/)?.[1]
  if (match) return match

  const words: Record<string, string> = {
    sixth: '6',
    seventh: '7',
    eighth: '8',
    ninth: '9',
    tenth: '10',
    eleventh: '11',
    twelfth: '12',
  }
  for (const [word, num] of Object.entries(words)) {
    if (normalized === word || normalized === `${word} grade`) return num
  }
  return ''
}

export function isLikelyGradeFolder(name: string, input?: ColegioSharePointInput) {
  const normalized = normalizeKey(name)
  const expected = (input ? getExpectedGradeFallbacks(input) : [...GRADOS_MONTANO_ESCOLARIS, ...GRADOS_ESCHOLARIS])
    .map(normalizeKey)
  if (expected.includes(normalized)) return true
  if (eScholarisGradeNumber(name)) return true
  return /(primaria|basico|bachillerato)$/.test(normalized)
}

export function sortGradesForSchool(grades: string[], input?: ColegioSharePointInput) {
  const expected = getExpectedGradeFallbacks(input).map(normalizeKey)
  return [...grades].sort((a, b) => {
    const ia = expected.indexOf(normalizeKey(a))
    const ib = expected.indexOf(normalizeKey(b))
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
    if (isEScholarisSchool(input)) {
      const gradeA = eScholarisGradeNumber(a)
      const gradeB = eScholarisGradeNumber(b)
      if (gradeA || gradeB) {
        return (gradeA ? Number(gradeA) : 999) - (gradeB ? Number(gradeB) : 999)
      }
    }
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

function englishOrdinalWordGrade(num: string) {
  const words: Record<string, string> = {
    '6': 'Sixth Grade',
    '7': 'Seventh Grade',
    '8': 'Eighth Grade',
    '9': 'Ninth Grade',
    '10': 'Tenth Grade',
    '11': 'Eleventh Grade',
    '12': 'Twelfth Grade',
  }
  return words[num] || ''
}

export function getGradeFolderCandidates(grado?: string | null) {
  const folders: string[] = []
  const clean = (grado || '').trim()
  pushUnique(folders, clean)
  if (!clean) return folders

  const normalized = normalizeKey(clean)
  pushUnique(folders, clean.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))

  const gradeNumber = eScholarisGradeNumber(clean)
  if (gradeNumber) {
    pushUnique(folders, gradeNumber)
    pushUnique(folders, `Grado ${gradeNumber}`)
    pushUnique(folders, `Grade ${gradeNumber}`)
    pushUnique(folders, englishOrdinalGrade(gradeNumber))
    pushUnique(folders, englishOrdinalGrade(gradeNumber).replace(' Grade', ''))
    pushUnique(folders, englishOrdinalWordGrade(gradeNumber))
    pushUnique(folders, englishOrdinalWordGrade(gradeNumber).replace(' Grade', ''))
    pushUnique(folders, `G${gradeNumber}`)
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

export function sharePointTextMatchesGrade(value: string, grado?: string | null) {
  const normalizedValue = normalizeSharePointKey(value)
  if (!normalizedValue || !grado) return false

  const candidates = getGradeFolderCandidates(grado)
    .map(candidate => normalizeSharePointKey(candidate))
    .filter(Boolean)
  if (candidates.some(candidate => normalizedValue.includes(candidate))) return true

  const normalizedGrade = normalizeSharePointKey(grado)
  const gradeNumber = normalizedGrade.match(/\b(\d+)\b/)?.[1]
  if (!gradeNumber) return false

  if (normalizedGrade.includes('primaria')) {
    const names: Record<string, string> = { '4': 'cuarto', '5': 'quinto', '6': 'sexto' }
    return normalizedValue.includes(`${gradeNumber} primaria`) ||
      (!!names[gradeNumber] && normalizedValue.includes(`${names[gradeNumber]} primaria`))
  }
  if (normalizedGrade.includes('basico')) {
    const names: Record<string, string> = { '1': 'primero', '2': 'segundo', '3': 'tercero' }
    return normalizedValue.includes(`${gradeNumber} basico`) ||
      (!!names[gradeNumber] && normalizedValue.includes(`${names[gradeNumber]} basico`))
  }
  if (normalizedGrade.includes('bachillerato')) {
    const names: Record<string, string> = { '4': 'cuarto', '5': 'quinto' }
    return normalizedValue.includes(`${gradeNumber} bachillerato`) ||
      (!!names[gradeNumber] && normalizedValue.includes(`${names[gradeNumber]} bachillerato`)) ||
      normalizedValue.includes('diversificado')
  }
  if (normalizedGrade.includes('grado')) {
    return normalizedValue.includes(`grado ${gradeNumber}`) ||
      normalizedValue.includes(`grade ${gradeNumber}`)
  }
  return false
}
