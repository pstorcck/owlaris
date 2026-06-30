type GuardOptions = {
  pregunta: string
  tipoPregunta: 'crisis' | 'formativa' | 'academica'
  materiaNumerica: boolean
  respuestaVerificadaCorrecta?: boolean
  idiomaIngles?: boolean
}

const SOLICITUD_RESPUESTA_DIRECTA = [
  /dame\s+(?:solo\s+)?(?:la\s+)?respuesta/i,
  /solo\s+dime/i,
  /hazme\s+(?:la\s+)?tarea/i,
  /resu[eé]lve(?:me)?\s+todo/i,
  /no\s+me\s+expliques/i,
  /just\s+(?:give|tell)\s+me\s+the\s+answer/i,
  /give\s+me\s+the\s+answer/i,
]

const CONTEXTO_PRACTICA = [
  /practic/i,
  /ejercicio/i,
  /problema/i,
  /tarea/i,
  /repaso/i,
  /resuelve/i,
  /cu[aá]nto\s+es/i,
  /calcula/i,
  /encuentra/i,
  /solve/i,
  /practice/i,
  /homework/i,
  /exercise/i,
  /problem/i,
]

const FRASES_RESPUESTA_FINAL = [
  /\b(?:la\s+)?respuesta\s+correcta\s+(?:es|ser[ií]a|:)\s*[^\n.]+[.\n]?/gi,
  /\b(?:el\s+)?resultado\s+correcto\s+(?:es|ser[ií]a|:)\s*[^\n.]+[.\n]?/gi,
  /\b(?:the\s+)?correct\s+answer\s+(?:is|would\s+be|:)\s*[^\n.]+[.\n]?/gi,
  /\b(?:the\s+)?correct\s+result\s+(?:is|would\s+be|:)\s*[^\n.]+[.\n]?/gi,
]

export function shouldGuideWithoutFinalAnswer(options: GuardOptions): boolean {
  if (options.tipoPregunta !== 'academica') return false
  if (options.respuestaVerificadaCorrecta) return false
  const pregunta = options.pregunta || ''
  return options.materiaNumerica ||
    SOLICITUD_RESPUESTA_DIRECTA.some((pattern) => pattern.test(pregunta)) ||
    CONTEXTO_PRACTICA.some((pattern) => pattern.test(pregunta))
}

export function guardNoFinalAnswer(text: string, options: GuardOptions): { text: string; guardActivado: boolean } {
  if (!text || !shouldGuideWithoutFinalAnswer(options)) {
    return { text, guardActivado: false }
  }

  let cleaned = text
  for (const pattern of FRASES_RESPUESTA_FINAL) {
    cleaned = cleaned.replace(pattern, '')
  }

  cleaned = cleaned
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()

  if (cleaned === text.trim()) return { text, guardActivado: false }

  const prefix = options.idiomaIngles
    ? 'I will not give you the final answer directly, but I will guide you so you can find it.'
    : 'No te voy a dar la respuesta final directamente, pero sí te voy a guiar para que puedas encontrarla.'

  return {
    text: `${prefix}\n\n${cleaned || (options.idiomaIngles ? 'Let us go step by step. What is the first step you would try?' : 'Vamos paso a paso. ¿Cuál sería el primer paso que intentarías?')}`,
    guardActivado: true,
  }
}
