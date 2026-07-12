type GuardOptions = {
  pregunta: string
  tipoPregunta: 'crisis' | 'formativa' | 'academica'
  materiaNumerica: boolean
  respuestaVerificadaCorrecta?: boolean
  idiomaIngles?: boolean
}

// Hallazgo real (verificación posterior, 2026-07-12): "dame algo para
// copiar" es una petición directa y explícita de contenido listo para
// entregar como propio. Se aísla en su propia lista (en vez de solo vivir
// dentro de SOLICITUD_RESPUESTA_DIRECTA) para poder usarla también como
// disparador de una respuesta determinística que evita por completo que el
// modelo genere el párrafo filtrable (ver isReadyToCopyRequest más abajo).
const SOLICITUD_TEXTO_LISTO_PARA_COPIAR = [
  /algo\s+para\s+copiar/i,
  /(?:dame|damelo|escr[ií]belo|p[oó]nmelo)\s+.*(?:para\s+copiar|list[oa]\s+para\s+copiar)/i,
  /something\s+(?:to|i\s+can|that\s+i\s+can)\s+copy/i,
]

const SOLICITUD_RESPUESTA_DIRECTA = [
  /(?:dame|darme)\s+(?:solo\s+)?(?:la\s+respuesta|el\s+resultado)/i,
  /solo\s+(?:dime|dame|darme)/i,
  /hazme\s+(?:la\s+)?tarea/i,
  /resu[eé]lve(?:me)?\s+todo/i,
  /no\s+me\s+expliques/i,
  /just\s+(?:give|tell)\s+me\s+the\s+answer/i,
  /give\s+me\s+the\s+answer/i,
  // Hallazgo real (verificación posterior, 2026-07-12): "dame algo para
  // copiar" es una petición directa y explícita de contenido listo para
  // entregar como propio — no activaba el guard en absoluto porque no
  // coincidía con ninguna de las frases más específicas de arriba
  // (resumen/lista + "listo para entregar"), así que la respuesta pasaba
  // sin ningún filtro incluso cuando el modelo decía "no lo haré" y luego
  // lo hacía de todas formas.
  ...SOLICITUD_TEXTO_LISTO_PARA_COPIAR,
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
  // Hallazgo real (QA amplia 2026-07-08): el guard cubría ensayo/conclusión/
  // argumento (prosa), pero no un resumen o lista pedidos como entregable
  // terminado — el tutor rechazaba verbalmente pero igual entregaba casi
  // todo el contenido factual en formato de lista.
  /resumen\s+(?:completo\s+)?(?:y\s+)?listo\s+para\s+entregar/i,
  /lista\s+(?:de\s+puntos\s+)?(?:ya\s+)?terminada.*copiar\s+y\s+pegar/i,
  /(?:resumen|lista)\s+.*(?:copiar\s+y\s+pegar|listo\s+para\s+entregar)/i,
  /complete\s+(?:summary|list)\s+ready\s+to\s+(?:submit|turn\s+in|copy)/i,
  /(?:summary|list)\s+.*ready\s+to\s+copy\s+and\s+paste/i,
]

// Hallazgo real (instructivo de mejoras, ronda 2026-07-11), ítems 8-9: pedir
// que el texto "no parezca escrito por una IA" o "parezca que lo escribió
// el alumno" es una petición de disfrazar autoría, no un pedido normal de
// ayuda con la redacción — debe activar el mismo modo de guía (nunca un
// texto terminado listo para presentar como propio), en CUALQUIER materia,
// no solo las conceptuales.
const SOLICITUD_DISFRAZAR_AUTORIA_IA = [
  /como\s+si\s+(?:yo\s+lo|lo\s+yo|yo|lo)?\s*hubiera\s+escrito(?:\s+yo)?/i,
  /que\s+no\s+parezca\s+(?:que\s+lo\s+escribi[oó]\s+)?(?:una\s+|la\s+)?ia\b/i,
  /que\s+no\s+parezca\s+generado\s+por\s+ia/i,
  /que\s+no\s+se\s+note\s+que\s+es\s+ia/i,
  /que\s+no\s+suene\s+a\s+ia/i,
  /que\s+no\s+lo\s+detecte\s+(?:el\s+)?turnitin/i,
  /escrito\s+por\s+una\s+ia/i,
  /as\s+if\s+i\s+wrote\s+it/i,
  /so\s+it\s+doesn'?t\s+sound\s+like\s+ai/i,
  /make\s+it\s+(?:sound\s+like\s+i\s+wrote\s+it|undetectable)/i,
  /so\s+(?:turnitin|it)\s+doesn'?t\s+(?:flag|detect)\s+(?:it|this)/i,
]

export function isDisguiseAiAuthorshipRequest(text: string): boolean {
  return SOLICITUD_DISFRAZAR_AUTORIA_IA.some((pattern) => pattern.test(text || ''))
}

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
  // Hallazgo real (QA amplia 2026-07-08): anuncio de resumen/lista terminada
  // lista para entregar/copiar, equivalente al anuncio de ensayo completo.
  /\baqu[ií]\s+(?:tienes|est[aá])\s+(?:el\s+|la\s+)?(?:resumen|lista)\s+completo?a?\s+(?:y\s+)?listo?a?\s+para\s+(?:entregar|copiar)\b[^\n]*[.\n]?/gi,
  /\bhere('|’)s\s+the\s+complete\s+(?:summary|list)\s+ready\s+to\s+(?:submit|copy)\b[^\n]*[.\n]?/gi,
]

export function shouldGuideWithoutFinalAnswer(options: GuardOptions): boolean {
  if (options.tipoPregunta !== 'academica') return false
  if (options.respuestaVerificadaCorrecta) return false
  const pregunta = options.pregunta || ''
  return options.materiaNumerica ||
    SOLICITUD_RESPUESTA_DIRECTA.some((pattern) => pattern.test(pregunta)) ||
    CONTEXTO_PRACTICA.some((pattern) => pattern.test(pregunta)) ||
    (!options.materiaNumerica && SOLICITUD_TRABAJO_CONCEPTUAL.some((pattern) => pattern.test(pregunta))) ||
    isDisguiseAiAuthorshipRequest(pregunta)
}

// Hallazgo real (segunda verificación, 2026-07-12): BLOQUE_CITADO_LARGO se
// aplicaba SIEMPRE que el guard estaba activo por CUALQUIER motivo — y
// shouldGuideWithoutFinalAnswer se activa en bloque para cualquier materia
// numérica (materiaNumerica incluye Biología, ver isLikelyNumericSubject).
// Eso significa que una cita larga totalmente incidental (ej. una tabla
// comparativa, una definición extensa) en una respuesta de Biología se
// recortaba igual, y se le pegaba encima la frase-guía genérica ("Pensemos
// juntos cuál sería el siguiente paso.") aunque la respuesta no tuviera
// nada que ver con entregar un trabajo listo para copiar. Esto reproducía
// el síntoma de "contexto/frase pegada al inicio" incluso en el primer
// mensaje de una sesión nueva. El recorte de cita larga solo debe aplicar
// cuando el motivo específico de activación es un riesgo real de trabajo
// listo para entregar (ensayo/resumen/lista terminada, disfrazar autoría de
// IA, o pedir la respuesta/algo para copiar directamente) — no por el mero
// hecho de ser una materia numérica o un contexto de práctica genérico.
function esRiesgoTextoListoParaCopiar(pregunta: string): boolean {
  return SOLICITUD_RESPUESTA_DIRECTA.some((pattern) => pattern.test(pregunta)) ||
    SOLICITUD_TRABAJO_CONCEPTUAL.some((pattern) => pattern.test(pregunta)) ||
    isDisguiseAiAuthorshipRequest(pregunta)
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

// Hallazgo real (verificación posterior, 2026-07-12): el modelo a veces
// dice explícitamente "no puedo darte algo para copiar" o "ahora inténtalo
// tú" y ACTO SEGUIDO entrega el texto completo entre comillas de todas
// formas — ninguna de las frases de FRASES_RESPUESTA_FINAL_CONCEPTUAL
// coincide porque el modelo no usa un anuncio como "aquí tienes la
// conclusión completa", solo lo escribe directamente citado. Un bloque
// citado largo (80+ caracteres) mientras el guard está activo es en sí
// mismo la señal de fuga — casi nunca hace falta citar un párrafo tan
// largo para guiar, así que se recorta y se reemplaza por una nota.
const BLOQUE_CITADO_LARGO = /["“”']([^"“”']{80,})["“”']/g

// Hallazgo real (segunda verificación, 2026-07-12): el recorte de
// BLOQUE_CITADO_LARGO solo detecta el texto filtrado cuando viene entre
// comillas — pero el modelo a veces entrega el párrafo completo SIN
// comillas (como texto plano corrido), y en ese caso ninguna limpieza
// posterior lo detecta. Confiar en limpiar el texto DESPUÉS de que el
// modelo ya lo generó es frágil por diseño. Para la petición específica de
// "algo para copiar" (que no tiene ninguna ambigüedad: el alumno está
// pidiendo textualmente contenido para entregar como propio), la respuesta
// determinística evita por completo que el modelo genere el párrafo.
export function isReadyToCopyRequest(text: string): boolean {
  return SOLICITUD_TEXTO_LISTO_PARA_COPIAR.some((pattern) => pattern.test(text || ''))
}

export function buildReadyToCopyRedirect(idiomaIngles: boolean): string {
  return idiomaIngles
    ? "I won't hand you a finished piece to copy and turn in as your own — but I can help you build it yourself, step by step. What's the topic or prompt you're working on? Let's start with the main idea you want to make."
    : 'No voy a darte un texto terminado para copiar y entregar como propio, pero sí puedo ayudarte a construirlo tú mismo, paso a paso. ¿Cuál es el tema o la consigna en la que estás trabajando? Empecemos por la idea principal que quieres plantear.'
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
  if (esRiesgoTextoListoParaCopiar(options.pregunta || '')) {
    cleaned = cleaned.replace(BLOQUE_CITADO_LARGO, options.idiomaIngles
      ? '[a ready-to-copy passage was removed here — let\'s build it together instead]'
      : '[aquí se quitó un texto listo para copiar — construyámoslo juntos en su lugar]')
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
Esta misma regla aplica si piden un resumen completo o una lista de puntos "lista para entregar" o "para copiar y pegar": rechazar la petición de palabra pero igual entregar casi todo el contenido factual en formato de lista no cumple la regla — entrégalo por partes también (ej. explica un punto a la vez y pide que el alumno intente resumir el siguiente antes de dártelo tú), no como una lista completa de una sola vez.
Usa pistas, preguntas guiadas, ejemplos parciales, recordatorios de conceptos y verificación paso a paso. Varía cómo guías para no sonar repetitivo.
En materias conceptuales, ajusta el TIPO de pista al tipo de error, igual que en matemáticas se ajusta la pista a la estructura de la ecuación: si el alumno confundió una definición, recuérdale el concepto sin dársela completa; si confundió una relación de causa-efecto, pídele identificar primero la causa o el efecto por separado; si el error es de comparación (semejanzas/diferencias), pide que identifique un solo criterio de comparación a la vez; si es un error de secuencia/orden cronológico, pide que ubique un solo evento de referencia antes de continuar. No repitas la misma pista genérica ("piensa en el contexto") para errores de distinta naturaleza.
Solo confirma la respuesta final cuando el estudiante ya la propuso correctamente o completó correctamente el razonamiento.
Si insiste en que quiere solo la respuesta, redirígelo con naturalidad hacia resolverlo juntos paso a paso, sin repetir siempre la misma frase ni anunciar la regla.
Si el estudiante pide que el texto "no parezca escrito por una IA", "parezca que lo escribió él/ella" o "no lo detecte Turnitin", no seas cómplice de presentar trabajo generado por IA como si fuera enteramente del alumno: ofrécele ayudarlo a escribirlo con sus propias palabras, por partes y guiándolo, pero no entregues un texto terminado listo para presentar como propio.`
}
