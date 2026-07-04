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

// La regla de no dar la respuesta final es interna: el alumno no debe leer un
// anuncio de la regla en cada turno (se sentía rígido y defensivo). Estas frases
// guían sin anunciarla, y se elige una de forma estable según el texto original
// para que el comportamiento sea determinístico y comprobable en pruebas.
const GUIA_SIN_ANUNCIO_ES = [
  'Empecemos por identificar qué nos pide el problema.',
  'Vamos paso a paso.',
  'Estás cerca. Revisemos qué operación ayuda a avanzar.',
  'Probemos con una pista para seguir avanzando.',
  'Pensemos juntos cuál sería el siguiente paso.',
]
const GUIA_SIN_ANUNCIO_EN = [
  "Let's start by identifying what the problem is asking.",
  "Let's go step by step.",
  "You're close. Let's check which operation helps you move forward.",
  "Let's try a hint to keep going.",
  "Let's think together about the next step.",
]

function elegirGuiaEstable(seed: string, idiomaIngles: boolean): string {
  const lista = idiomaIngles ? GUIA_SIN_ANUNCIO_EN : GUIA_SIN_ANUNCIO_ES
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return lista[hash % lista.length]
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

  const prefix = elegirGuiaEstable(text, !!options.idiomaIngles)
  const preguntaSiguientePaso = options.idiomaIngles
    ? 'What would be the first step you would try?'
    : '¿Cuál sería el primer paso que intentarías?'

  return {
    text: cleaned ? `${prefix}\n\n${cleaned}` : `${prefix} ${preguntaSiguientePaso}`,
    guardActivado: true,
  }
}
