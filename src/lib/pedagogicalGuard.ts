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

// Sprint de estabilización (auditoría 2026-07-07): el guard de "no dar la
// respuesta final" solo se activaba en materias numéricas o con las frases
// genéricas de arriba. Una materia conceptual (Historia, Lenguaje, Biología,
// Ciencias, Filosofía...) con un trabajo asignado ("escribe la conclusión de
// tu ensayo", "dame el argumento final") quedaba fuera — no por ser menos
// importante, sino porque nadie había mapeado ese pedido específico. No se
// activa para CUALQUIER pregunta conceptual (eso rompería "resume el tema" y
// preguntas legítimas como "¿qué es la fotosíntesis?"), solo cuando el
// mensaje pide completar un trabajo evaluable.
const SOLICITUD_TRABAJO_CONCEPTUAL = [
  /ensayo/i,
  /reda(?:cci[oó]n|ctar)/i,
  /composici[oó]n\s+(?:escrita|literaria)/i,
  /an[aá]lisis\s+(?:completo|literario|hist[oó]rico)/i,
  /argumento\s+(?:final|completo|a\s+favor|en\s+contra)/i,
  /\btesis\b/i,
  /conclusi[oó]n\s+(?:de\s+(?:mi|tu|este)\s+)?(?:ensayo|trabajo|informe)/i,
  /responde\s+la\s+pregunta\s+de(?:l)?\s+(?:examen|evaluaci[oó]n)/i,
  /resuelve\s+el\s+caso/i,
  /opini[oó]n\s+fundamentada/i,
  /essay/i,
  /(?:final|complete)\s+argument/i,
  /\bthesis\b/i,
  /conclusion\s+(?:of|for)\s+(?:my|your|this)\s+(?:essay|paper|report)/i,
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

// Equivalente conceptual de FRASES_RESPUESTA_FINAL: un ensayo o análisis no
// tiene un número que revele — tiene un anuncio de que el trabajo completo
// ya está listo. Los patrones son deliberadamente específicos ("la
// conclusión completa DE TU ensayo/trabajo", no "en conclusión" a secas) para
// no recortar una explicación legítima que naturalmente cierre con esa frase
// como parte de guiar al alumno, no de resolverle el trabajo.
const FRASES_RESPUESTA_FINAL_CONCEPTUAL = [
  /\baqu[ií]\s+(?:tienes|est[aá])\s+(?:la\s+)?conclusi[oó]n\s+(?:completa\s+)?(?:de\s+tu\s+|de\s+mi\s+)?(?:ensayo|trabajo|redacci[oó]n|an[aá]lisis|informe)\b[^\n]*[.\n]?/gi,
  /\b(?:esta|esa)\s+es\s+la\s+conclusi[oó]n\s+(?:final\s+)?(?:de\s+tu\s+)?(?:ensayo|trabajo|redacci[oó]n|informe)\b[^\n]*[.\n]?/gi,
  /\bmi\s+conclusi[oó]n\s+final\s+(?:para\s+tu\s+ensayo\s+)?es\s*:?\s*[^\n.]+[.\n]?/gi,
  /\bel\s+argumento\s+(?:final\s+|completo\s+)?que\s+puedes\s+usar\s+es\s*:?\s*[^\n.]+[.\n]?/gi,
  /\baqu[ií]\s+(?:tienes|est[aá])\s+(?:el\s+)?(?:ensayo|argumento|an[aá]lisis)\s+completo\b[^\n]*[.\n]?/gi,
  /\b(?:esta|esa)\s+es\s+la\s+respuesta\s+completa\s+(?:a\s+tu\s+pregunta\s+de\s+)?(?:examen|tarea)\b[^\n]*[.\n]?/gi,
  /\bhere('|’)s\s+the\s+complete\s+(?:essay|argument|analysis|conclusion)\b[^\n]*[.\n]?/gi,
  /\bmy\s+final\s+conclusion\s+(?:for\s+your\s+essay\s+)?is\s*:?\s*[^\n.]+[.\n]?/gi,
  /\bthis\s+is\s+the\s+complete\s+(?:essay|argument|analysis)\b[^\n]*[.\n]?/gi,
]

export function shouldGuideWithoutFinalAnswer(options: GuardOptions): boolean {
  if (options.tipoPregunta !== 'academica') return false
  if (options.respuestaVerificadaCorrecta) return false
  const pregunta = options.pregunta || ''
  return options.materiaNumerica ||
    SOLICITUD_RESPUESTA_DIRECTA.some((pattern) => pattern.test(pregunta)) ||
    CONTEXTO_PRACTICA.some((pattern) => pattern.test(pregunta)) ||
    (!options.materiaNumerica && SOLICITUD_TRABAJO_CONCEPTUAL.some((pattern) => pattern.test(pregunta)))
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
  for (const pattern of FRASES_RESPUESTA_FINAL_CONCEPTUAL) {
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

// Centraliza en un solo lugar qué cuenta como "revelar la respuesta" — el
// mismo módulo que la hace cumplir en código (guardNoFinalAnswer) genera
// ahora también el texto que se lo pide al modelo en el prompt, para que
// ampliar la regla aquí no la deje desincronizada con lo que el prompt dice
// (sprint de estabilización, auditoría 2026-07-07).
export function describeFinalAnswerPolicyForPrompt(): string {
  return `REGLA ESTRICTA — NO ENTREGAR RESPUESTAS FINALES (comportamiento interno, NO lo anuncies):
En la vista alumno, no entregues directamente la respuesta final de un problema, ejercicio, tarea, ensayo, análisis o pregunta de práctica cuando el estudiante todavía puede razonarla — esto aplica igual a materias numéricas (el valor de x, un resultado) y a materias conceptuales (la conclusión de un ensayo, un argumento completo, una tesis).
Tu función es guiar para que el estudiante llegue a la respuesta por sí mismo, pero esta regla es interna: NUNCA le digas al alumno frases como "no te voy a dar la respuesta", "mi objetivo es que aprendas y no darte una respuesta para copiar" o similares. Simplemente guía sin anunciar la regla — se ve rígido y defensivo repetirla.
Si el estudiante responde incorrectamente, puedes decir que todavía no llegó a la respuesta correcta, pero NO reveles de inmediato el resultado correcto. Ayúdalo a detectar el error y avanzar paso a paso.
En materias conceptuales, si te piden escribir un ensayo, la conclusión de un trabajo o un argumento completo, no lo entregues terminado — ayuda a construirlo por partes (idea principal, evidencia, estructura) y pide que el alumno proponga cada parte antes de confirmarla.
Usa pistas, preguntas guiadas, ejemplos parciales, recordatorios de conceptos y verificación paso a paso. Varía cómo guías para no sonar repetitivo.
Solo confirma la respuesta final cuando el estudiante ya la propuso correctamente o completó correctamente el razonamiento.
Si insiste en que quiere solo la respuesta, redirígelo con naturalidad hacia resolverlo juntos paso a paso, sin repetir siempre la misma frase ni anunciar la regla.`
}
