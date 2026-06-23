export type HumanisticGuardInput = {
  materia?: string | null
  tipoPregunta?: string | null
  materiaNumerica?: boolean
  hasVerifiedOperation?: boolean
  idiomaIngles?: boolean
}

export type HumanisticGuardResult = {
  text: string
  guardActivado: boolean
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function isHumanisticContext(input: HumanisticGuardInput): boolean {
  if (input.hasVerifiedOperation) return false
  if (input.tipoPregunta === 'formativa') return true
  if (input.tipoPregunta && input.tipoPregunta !== 'academica') return false

  const materia = normalizeText(input.materia || '')
  if (/(historia|sociales|lenguaje|espanol|literatura|filosofia|etica|ciudadania|formacion)/.test(materia)) {
    return true
  }

  if (/(biologia|ciencias naturales)/.test(materia)) {
    return true
  }

  return !input.materiaNumerica && materia.length > 0
}

function hasFollowUpQuestion(text: string): boolean {
  return /[¿?]/.test(text.slice(-220))
}

export function guardHumanisticResponse(text: string, input: HumanisticGuardInput): HumanisticGuardResult {
  if (!text || !isHumanisticContext(input)) {
    return { text, guardActivado: false }
  }

  const replacements: Array<[RegExp, string]> = input.idiomaIngles
    ? [
        [/(^|\n)\s*Correct[!.:]?\s*/gi, '$1That is a reasonable start. '],
        [/(^|\n)\s*Incorrect[!.:]?\s*/gi, '$1Let us review the evidence carefully. '],
        [/\bthe only correct answer is\b/gi, 'a well-supported answer would be'],
        [/\bthe correct answer is\b/gi, 'a well-supported answer would be'],
        [/\bthat is not correct\b/gi, 'that needs more precision'],
        [/\bthat is wrong\b/gi, 'that needs revision'],
        [/\byou are wrong\b/gi, 'we should review the evidence'],
      ]
    : [
        [/(^|\n)\s*¡?Correcto[!.:]?\s*/gi, '$1Vas bien encaminado. '],
        [/(^|\n)\s*Incorrecto[!.:]?\s*/gi, '$1Revisemos la evidencia con cuidado. '],
        [/\bla única respuesta correcta es\b/gi, 'una respuesta bien sustentada sería'],
        [/\bla respuesta correcta es\b/gi, 'una respuesta bien sustentada sería'],
        [/\bno,?\s+eso\s+(?:es|esta|está)\s+incorrecto\b/gi, 'esa idea necesita más precisión'],
        [/\bno es correcto\b/gi, 'necesita más precisión'],
        [/\best[aá]\s+mal\b/gi, 'necesita revisión'],
        [/\bte equivocaste\b/gi, 'conviene revisar la evidencia'],
      ]

  let guarded = text
  for (const [pattern, replacement] of replacements) {
    guarded = guarded.replace(pattern, replacement)
  }

  guarded = guarded.replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+\n/g, '\n').trim()
  const changed = guarded !== text.trim()

  if (changed && !hasFollowUpQuestion(guarded)) {
    guarded += input.idiomaIngles
      ? '\n\nCan you support your answer with one idea from the text or topic?'
      : '\n\n¿Puedes sustentar tu respuesta con una idea del texto o del tema?'
  }

  return { text: guarded, guardActivado: changed }
}
