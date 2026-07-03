type GuardOptions = {
  pregunta: string
  tipoPregunta: 'crisis' | 'formativa' | 'academica'
  materiaNumerica: boolean
  respuestaVerificadaCorrecta?: boolean
  idiomaIngles?: boolean
}

const SOLICITUD_RESPUESTA_DIRECTA = [
  /(?:dame|darme)\s+(?:solo\s+)?(?:la\s+respuesta|el\s+resultado)/i,
  /solo\s+(?:dime|dame|darme)/i,
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
  // Anuncios explícitos de respuesta final (con o sin "correcta/o")
  /\b(?:la\s+)?respuesta\s+(?:correcta\s+|final\s+)?(?:es|ser[ií]a|:)\s*[^\n.]+[.\n]?/gi,
  /\b(?:el\s+)?resultado\s+(?:correcto\s+|final\s+)?(?:es|ser[ií]a|:)\s*[^\n.]+[.\n]?/gi,
  /\b(?:the\s+)?(?:correct\s+|final\s+)?answer\s+(?:is|would\s+be|:)\s*[^\n.]+[.\n]?/gi,
  /\b(?:the\s+)?(?:correct\s+|final\s+)?result\s+(?:is|would\s+be|:)\s*[^\n.]+[.\n]?/gi,
  /\bfinal\s+answer\s*:?\s*-?\d+(?:[.,]\d+)?[^\n.]*[.\n]?/gi,
  // Conclusiones que revelan el valor de la variable ("x = N", "x vale N", "el valor de x es N")
  /\b(?:entonces|por lo tanto|as[ií]\s+que|en conclusi[oó]n|al final|finalmente)\s*,?\s*(?:el\s+valor\s+de\s+)?x\s*(?:=|vale|es(?:\s+igual\s+a)?)\s*-?\d+(?:[.,]\d+)?[^\n.]*[.\n]?/gi,
  /\b(?:so|thus|therefore|finally|in\s+conclusion|that\s+gives\s+us)\b[^\n.]{0,20}\bx\s*(?:=|is|equals)\s*-?\d+(?:[.,]\d+)?[^\n.]*[.\n]?/gi,
  /\b(?:el\s+)?valor\s+(?:de\s+)?x\s+es\s+-?\d+(?:[.,]\d+)?[^\n.]*[.\n]?/gi,
  /\bx\s+vale\s+-?\d+(?:[.,]\d+)?[^\n.]*[.\n]?/gi,
  /\b(?:el\s+)?valor\s+final\s+es\s+-?\d+(?:[.,]\d+)?[^\n.]*[.\n]?/gi,
  /\bllegamos\s+a\s+-?\d+(?:[.,]\d+)?[^\n.]*[.\n]?/gi,
  /\bx\s+queda\s+en\s+-?\d+(?:[.,]\d+)?[^\n.]*[.\n]?/gi,
  /\bx\s+da\s+-?\d+(?:[.,]\d+)?[^\n.]*[.\n]?/gi,
  // "x = N" / "x=N" sueltos, como declaración final (no como parte de una ecuación con más operadores)
  /\bx\s*=\s*-?\d+(?:[.,]\d+)?\.?(?=\s|$)/gi,
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
