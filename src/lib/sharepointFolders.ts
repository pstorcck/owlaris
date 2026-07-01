type ColegioSharePointInput = {
  nombre?: string | null
  slug?: string | null
  sharepoint_folder?: string | null
} | string | null | undefined

export const CARPETA_COMPARTIDA_OWLARIS = 'Colegio Montano y Escolaris'

function normalizeKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function pushUnique(target: string[], value?: string | null) {
  const clean = (value || '').trim()
  if (clean && !target.includes(clean)) target.push(clean)
}

export function getSharePointFolderCandidates(input: ColegioSharePointInput): string[] {
  const rawValues: string[] = []
  if (typeof input === 'string') {
    rawValues.push(input)
  } else if (input) {
    rawValues.push(input.sharepoint_folder || '', input.slug || '', input.nombre || '')
  }

  const folders: string[] = []
  rawValues.forEach(value => pushUnique(folders, value))

  const normalized = rawValues.map(normalizeKey).join(' ')

  if (normalized.includes('montano') || normalized.includes('colegio-montano')) {
    pushUnique(folders, 'Colegio Montano')
    pushUnique(folders, CARPETA_COMPARTIDA_OWLARIS)
  }

  if (
    normalized.includes('escolaris') ||
    normalized.includes('escholaris') ||
    normalized.includes('colegio-escolaris')
  ) {
    pushUnique(folders, 'Escolaris')
    pushUnique(folders, 'eScholaris')
    pushUnique(folders, 'colegio-escolaris')
    pushUnique(folders, CARPETA_COMPARTIDA_OWLARIS)
  }

  pushUnique(folders, CARPETA_COMPARTIDA_OWLARIS)
  return folders
}

export function isEscolarisFolder(input: ColegioSharePointInput) {
  return getSharePointFolderCandidates(input).some(folder => {
    const key = normalizeKey(folder)
    return key.includes('escolaris') || key.includes('escholaris')
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
