import { normalizeStudentAnswer } from './mathSafety'

function normalizeText(value: string) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isLikelyMathAnswerText(value: string) {
  const text = value || ''
  if (normalizeStudentAnswer(text) !== null) return true
  return /\b(?:x\s*=|respuesta\s+es|resultado\s+es|answer\s+is|result\s+is)\s*-?\d+(?:[.,]\d+)?\b/i.test(text)
}

export function isNoAnswerComplaint(value: string) {
  const text = normalizeText(value)
  return [
    'no me respondiste',
    'no respondiste',
    'te pregunte',
    'me cambiaste',
    'me seguiste preguntando',
    'volvamos',
    'same exercise',
    'you did not answer',
    "didn't answer",
    'go back',
  ].some((needle) => text.includes(needle))
}

// Hallazgo real (QA Ronda 4, 2026-07-11): "no entiendo" también aparece en
// preguntas conceptuales genuinas y nuevas ("no entiendo bien qué es la
// fotosíntesis", "no entiendo cómo se suman fracciones con diferente
// denominador"), no solo en reacciones cortas sobre el ejercicio en curso
// ("no entiendo", "no entiendo este paso"). Tratarlas como continuidad
// hacía que el tutor ignorara la pregunta real del alumno y devolviera un
// ejercicio pendiente sin relación — a veces incluso de otra materia. Se
// excluye del disparador de continuidad cuando "no entiendo" va seguido de
// "qué es" / "cómo se..." + contenido adicional, el patrón típico de una
// pregunta nueva sobre un concepto distinto al ejercicio activo.
function pareceNoEntiendoPreguntaNueva(text: string): boolean {
  return /no entiendo\s+(?:bien\s+)?(?:qu[eé]\s+es|c[oó]mo\s+(?:se\s+)?\w+)/.test(text) ||
    /i\s+(?:do not|don't)\s+understand\s+(?:what|how|why)\b/.test(text)
}

export function isPendingContextQuestion(value: string) {
  const text = normalizeText(value)
  if (!text) return false
  if (/puedo usar\s+(?:una\s+|la\s+)?calculadora/.test(text) || /usar\s+(?:una\s+|la\s+)?calculadora para/.test(text)) return true
  if (isNoAnswerComplaint(value)) return true
  const esPreguntaNueva = pareceNoEntiendoPreguntaNueva(text)
  const NO_ENTIENDO_FAMILIA = new Set(['no entiendo', 'no entender', 'i do not understand', "i don't understand"])
  return [
    'sin calculadora',
    'sin usar calculadora',
    'puedo lograr',
    'puedo hacerlo',
    'puedo resolverlo',
    'como lo hago',
    'como empiezo',
    'no entiendo',
    'no entender',
    'no se que hacer',
    'necesito ayuda',
    'ayudame con este',
    'este mismo',
    'misma pregunta',
    'misma fraccion',
    // Peticiones de autonomía ("quiero resolver esto yo solo") piden lo
    // opuesto a un ejercicio nuevo: que se le deje intentar el mismo. Un
    // reporte real de QA (2026-07-07) mostró que el tutor las trataba como
    // "cambiar de ejercicio", justo lo contrario de lo pedido.
    'yo solo',
    'yo sola',
    'intentarlo solo',
    'intentarlo sola',
    'resolverlo yo mismo',
    'resolverlo yo misma',
    'hacerlo yo mismo',
    'hacerlo yo misma',
    'dejame intentarlo',
    'dejenme intentarlo',
    'without calculator',
    'without a calculator',
    'can i do it',
    'can i solve it',
    'how do i start',
    'i do not understand',
    "i don't understand",
    'do not know what to do',
    "don't know what to do",
    'need help with this',
    'on my own',
    'by myself',
    'let me try it myself',
    'i want to solve it myself',
    // Pedir aclarar/repetir el mismo paso NO debe cambiar de ejercicio —
    // bug real: "explícame ese paso otra vez" generaba un ejercicio nuevo.
    'ese paso otra vez',
    'ese paso de nuevo',
    'no entendi ese paso',
    'repite eso',
    'repitelo',
    'por que hiciste eso',
    'explicalo mas facil',
    'explicalo de otra forma',
    'de otra forma',
    'otra manera',
    'empieza desde cero',
    'desde cero',
    'no cambies de ejercicio',
    'sigo sin entender',
    'como si no supiera nada',
    'explicamelo mas simple',
    'that step again',
    "didn't understand that step",
    'repeat that',
    'why did you do that',
    'explain it more simply',
    'another way',
    'start from scratch',
    "don't change the exercise",
    "still don't understand",
    'like i know nothing',
  ].some((needle) => {
    if (esPreguntaNueva && NO_ENTIENDO_FAMILIA.has(needle)) return false
    return text.includes(needle)
  })
}

// "¿Cuál era el ejercicio?" debe recuperar el ejercicio activo, no generar
// uno nuevo — bug real detectado en el instructivo de mejoras.
export function isExerciseRecallRequest(value: string): boolean {
  const text = normalizeText(value)
  if (!text) return false
  return [
    'cual era el ejercicio',
    'cual era la pregunta',
    'cual era la ecuacion',
    'cual era el problema',
    'que estabamos haciendo',
    'donde ibamos',
    'recuerdame el problema',
    'recuerdame el ejercicio',
    'recuerdame la pregunta',
    'volvamos al ejercicio',
    'what was the exercise',
    'what was the question',
    'what was the equation',
    'what was the problem',
    'what were we doing',
    'where were we',
    'remind me of the problem',
    'remind me the exercise',
  ].some((needle) => text.includes(needle))
}

export function buildExerciseRecallResponse(input: {
  activeOperation?: string | null
  activePrompt?: string | null
  idiomaIngles?: boolean
}): string | null {
  const operation = formatOperation(input.activeOperation)
  if (!operation) return null
  return input.idiomaIngles
    ? `The exercise we were working on was:\n${operation}\nLet's keep solving it step by step. What is the next step you would try?`
    : `El ejercicio que estábamos trabajando era:\n${operation}\nSigamos resolviéndolo paso a paso. ¿Cuál sería el siguiente paso que intentarías?`
}

function extractActiveFraction(operation?: string | null, prompt?: string | null) {
  const source = `${prompt || ''}\n${operation || ''}`
  const fraction = source.match(/\b(\d{1,4})\s*\/\s*(\d{1,4})\b/)
  if (!fraction) return null
  return { numerator: fraction[1], denominator: fraction[2], display: `${fraction[1]}/${fraction[2]}` }
}

function formatOperation(operation?: string | null) {
  if (!operation) return ''
  return operation
    .replace(/\*/g, ' * ')
    .replace(/\+/g, ' + ')
    .replace(/-/g, ' - ')
    .replace(/\//g, ' / ')
    .replace(/=/g, ' = ')
    .replace(/\s+/g, ' ')
    .replace('( ', '(')
    .replace(' )', ')')
    .trim()
}

type PendingContextResponseInput = {
  studentQuestion: string
  activeOperation?: string | null
  activePrompt?: string | null
  idiomaIngles?: boolean
}

export function buildPendingContextResponse(input: PendingContextResponseInput) {
  const question = normalizeText(input.studentQuestion)
  const complaintPrefix = isNoAnswerComplaint(input.studentQuestion)
    ? input.idiomaIngles
      ? 'You are right. I moved away from your question. '
      : 'Tienes razón. Me desvié de tu pregunta. '
    : ''
  const fraction = extractActiveFraction(input.activeOperation, input.activePrompt)
  const operation = formatOperation(input.activeOperation)
  const asksAutonomy = [
    'yo solo', 'yo sola', 'intentarlo solo', 'intentarlo sola',
    'resolverlo yo mismo', 'resolverlo yo misma', 'hacerlo yo mismo', 'hacerlo yo misma',
    'dejame intentarlo', 'dejenme intentarlo',
    'on my own', 'by myself', 'let me try it myself', 'i want to solve it myself',
  ].some((needle) => question.includes(needle))
  const asksCalculator = question.includes('calculadora') || question.includes('calculator') || question.includes('puedo lograr') || question.includes('puedo hacerlo')
  const asksToUseCalculator = (
    /puedo usar(?: la| una)? calculadora/.test(question) ||
    /usar(?: la| una)? calculadora para/.test(question) ||
    /can i use (?:a )?calculator/.test(question)
  ) && !question.includes('sin usar calculadora') && !question.includes('without')

  if (operation && asksAutonomy) {
    return input.idiomaIngles
      ? `${complaintPrefix}Great, go for it. Stay with the active exercise: ${operation}. Take your time and try the next step yourself — I'm here if you get stuck.`
      : `${complaintPrefix}Perfecto, inténtalo. Sigamos con el ejercicio activo: ${operation}. Tómate tu tiempo e intenta el siguiente paso tú mismo — aquí estoy si te trabas.`
  }

  if (operation && asksToUseCalculator) {
    return input.idiomaIngles
      ? `${complaintPrefix}You can use a calculator to check at the end, but let us first practice the reasoning. Stay with the active exercise: ${operation}. What first step can you do without the calculator?`
      : `${complaintPrefix}Puedes usar calculadora para comprobar al final, pero primero practiquemos el razonamiento. Sigamos con el ejercicio activo: ${operation}. ¿Qué primer paso puedes hacer sin calculadora?`
  }

  if (fraction && asksCalculator) {
    return input.idiomaIngles
      ? `${complaintPrefix}Yes, you can do it without a calculator. Let us use the example we were working with: ${fraction.display}. To convert a fraction to a decimal, divide the numerator by the denominator: ${fraction.numerator} divided by ${fraction.denominator}. We will go step by step: since ${fraction.denominator} does not fit into ${fraction.numerator}, we use decimals. If we write ${fraction.numerator}.0, how many times does ${fraction.denominator} fit into ${Number(fraction.numerator) * 10}?`
      : `${complaintPrefix}Sí, puedes hacerlo sin calculadora. Usemos el ejemplo que veníamos trabajando: ${fraction.display}. Para convertir una fracción a decimal, dividimos el numerador entre el denominador: ${fraction.numerator} ÷ ${fraction.denominator}. Vamos paso a paso: como ${fraction.denominator} no cabe en ${fraction.numerator}, usamos decimales. Si escribimos ${fraction.numerator}.0, ¿cuántas veces cabe ${fraction.denominator} en ${Number(fraction.numerator) * 10}?`
  }

  if (operation && /x/i.test(operation) && operation.includes('=')) {
    return input.idiomaIngles
      ? `${complaintPrefix}Yes, you can work it out step by step. Let us stay with the active equation: ${operation}. First identify the number that is adding or subtracting right next to x, and think about the opposite operation that removes it. What would you do to both sides of the equation to leave x alone?`
      : `${complaintPrefix}Sí, puedes resolverlo paso a paso. Sigamos con la ecuación activa: ${operation}. Primero identifica el número que está sumando o restando junto a la x, y piensa en la operación contraria que lo quita. ¿Qué harías en ambos lados de la ecuación para dejar la x sola?`
  }

  if (operation) {
    return input.idiomaIngles
      ? `${complaintPrefix}Yes, you can solve it without a calculator if we go one step at a time. Let us stay with the active exercise: ${operation}. Start with the first operation you can safely do. What would that first step be?`
      : `${complaintPrefix}Sí, puedes resolverlo sin calculadora si vamos paso a paso. Sigamos con el ejercicio activo: ${operation}. Empieza por la primera operación que puedas hacer con seguridad. ¿Cuál sería ese primer paso?`
  }

  return input.idiomaIngles
    ? `${complaintPrefix}Yes. Let us stay with the same topic and solve it step by step. What part feels unclear right now: the concept, the first step, or the calculation?`
    : `${complaintPrefix}Sí. Sigamos con el mismo tema y resolvámoslo paso a paso. ¿Qué parte no está clara todavía: el concepto, el primer paso o el cálculo?`
}

// Centraliza en un solo lugar qué cuenta como "seguir con el mismo
// ejercicio" — el mismo módulo que lo detecta en código (isPendingContextQuestion
// más arriba) genera ahora también el texto que se lo pide al modelo en el
// prompt, para que ampliar la regla aquí no la deje desincronizada con lo
// que el prompt dice (sprint de estabilización, auditoría 2026-07-07).
export function describeSameExercisePolicyForPrompt(): string {
  return 'Mantén el contexto activo: si hay un ejercicio pendiente y el alumno pregunta si puede resolverlo sin calculadora, pide ayuda, dice que no entiende, reclama que no respondiste, o pide intentarlo él mismo, NO cambies de ejercicio ni de tema. Responde esa duda y vuelve al mismo ejercicio pendiente.'
}

// Hallazgo real (QA Ronda 3, 2026-07-10): el frontend solo envía al backend
// los últimos 6 mensajes del chat (ver ChatInterface.tsx, mensajes.slice(-6)),
// así que el modelo nunca tiene acceso real al historial completo de la
// sesión. Cuando se le preguntó "cuál fue el primer tema que discutimos hoy",
// el modelo respondió con seguridad pero incorrectamente (citó el ejercicio
// activo más reciente como si fuera el primero), presentándolo como un hecho
// verificado. Una repetición posterior mostró que a veces sí reconoce el
// límite ("no puedo proporcionar información sobre mensajes anteriores") y
// a veces no — es decir, es un comportamiento no determinístico del modelo.
// Se detecta este tipo de pregunta sobre el historial completo de la
// conversación de forma determinística, para no depender de que el modelo
// reconozca por su cuenta los límites de su propia memoria.
export function isConversationHistoryMetaQuestion(value: string): boolean {
  const text = normalizeText(value)
  if (!text) return false
  return [
    'primer tema', 'primer ejercicio', 'primera pregunta', 'primera cosa',
    'lo primero que', 'que fue lo primero', 'cual fue lo primero',
    'desde el principio de', 'desde que empezamos', 'desde que iniciamos',
    'todo lo que hemos hablado', 'todo lo que hablamos', 'resumen de toda la conversacion',
    'resumen de todo lo que', 'cuantos mensajes hemos', 'cuantas preguntas hemos',
    'cuantos ejercicios hemos hecho hoy', 'recuerdas todo lo que',
    'first topic', 'first exercise', 'first question', 'first thing',
    'since we started', 'since the beginning',
    "everything we've talked about", 'everything we have talked about',
    'summarize our whole conversation', 'summarize the whole conversation',
    'how many messages have we', 'how many questions have we',
    'do you remember everything',
  ].some((needle) => text.includes(needle))
}

export function buildConversationHistoryLimitResponse(idiomaIngles = false): string {
  return idiomaIngles
    ? 'I do not have a reliable record of our entire conversation today — I can only see the most recent part of it. For a complete, accurate record of everything we have covered, check the "Today\'s report" button. Want to keep going with what we are working on right now?'
    : 'No tengo un registro confiable de toda nuestra conversación de hoy — solo puedo ver la parte más reciente. Para un registro completo y preciso de todo lo que hemos visto, revisa el botón "Reporte de hoy". ¿Seguimos con lo que estamos trabajando ahora mismo?'
}

// Hallazgo real (QA Ronda 3, 2026-07-10): un mensaje con tres solicitudes
// distintas en una sola entrada ("¿Cuánto es 5+5 y además explícame las
// fracciones y también quiero practicar geometría?") no se descomponía —
// el sistema no atendió ninguna de las tres partes por separado y el
// anexo del reporte registró la entrada bajo el ejercicio de álgebra que
// ya estaba activo, en vez de reflejar alguna de las solicitudes reales.
// isCompoundMultiIntentMessage detecta este patrón de forma determinística
// (no depende de que el modelo lo note por su cuenta) para inyectar una
// instrucción explícita de que reconozca y atienda cada parte por orden.
export function isCompoundMultiIntentMessage(value: string): boolean {
  const text = normalizeText(value)
  if (!text) return false
  const marcadoresConjuncion = [
    'y tambien', 'y ademas', 'ademas quiero', 'ademas quisiera',
    'y quiero', 'y quisiera', 'y de paso', 'y aparte',
    'and also', 'and additionally', 'as well as', 'and i also want',
    'and i also need', 'and furthermore',
  ].some((needle) => text.includes(needle))
  if (marcadoresConjuncion) return true
  const signosPregunta = (text.match(/\?/g) || []).length
  return signosPregunta >= 2
}

export function describeCompoundMessagePolicyForPrompt(): string {
  return 'Este mensaje del alumno contiene varias solicitudes distintas en una sola entrada. NO respondas solo a una (ni asumas que se refiere al ejercicio pendiente si en realidad está pidiendo algo nuevo y distinto). Reconoce explícitamente cada solicitud por separado y atiéndelas en el orden en que aparecen, aunque tengas que ser breve en cada una.'
}

// Hallazgo real (QA Ronda 3, 2026-07-10): cuando se le pregunta al tutor en
// el chat "¿cuál es mi progreso?", las respuestas conversacionales tienden
// a ser vagas — aunque el "Reporte de hoy" real sí contiene datos de
// progreso precisos (racha de aciertos/fallos, nivel de dificultad). La
// brecha no es de datos faltantes sino de que el chat no los usaba. Se
// intercepta esta pregunta de forma determinística y se responde con los
// datos reales ya calculados en el backend para este turno, en vez de
// dejar que el modelo improvise una respuesta vaga.
export function isProgressQuestion(value: string): boolean {
  const text = normalizeText(value)
  if (!text) return false
  // "como voy"/"como vamos" a secas son demasiado genéricos: colisionan con
  // frases comunes como "no se como voy a resolver esto" (que no preguntan
  // por métricas de progreso). Se exige la frase completa con "en/con
  // esto/esta materia" o similar para evitar falsos positivos.
  return [
    'mi progreso', 'que tanto he avanzado', 'que tan bien voy',
    'cual es mi progreso', 'cuanto he mejorado', 'como voy en esto',
    'como voy con esto', 'como voy en la materia', 'como vamos en esto',
    'como vamos con esto', 'que tal voy', 'que tal vamos',
    'how am i doing', 'my progress', 'how is my progress', 'am i improving',
    'how am i improving', 'how are we doing',
  ].some((needle) => text.includes(needle))
}

export function buildProgressResponse(input: {
  correctStreak: number
  wrongStreak: number
  currentLevel: number
  materia?: string | null
  idiomaIngles?: boolean
}): string {
  const materiaTexto = input.materia
    ? (input.idiomaIngles ? ` in ${input.materia}` : ` en ${input.materia}`)
    : ''
  const cierre = input.idiomaIngles
    ? 'For the full picture of today\'s session (accuracy, topics covered, and more), check "Today\'s report".'
    : 'Para ver el panorama completo de la sesión de hoy (precisión, temas cubiertos y más), revisa "Reporte de hoy".'
  if (input.correctStreak > 0) {
    return input.idiomaIngles
      ? `Right now you have a streak of ${input.correctStreak} correct answer${input.correctStreak === 1 ? '' : 's'} in a row${materiaTexto}, working at difficulty level ${input.currentLevel} out of 8. ${cierre}`
      : `Ahora mismo llevas una racha de ${input.correctStreak} respuesta${input.correctStreak === 1 ? '' : 's'} correcta${input.correctStreak === 1 ? '' : 's'} seguida${input.correctStreak === 1 ? '' : 's'}${materiaTexto}, trabajando en el nivel de dificultad ${input.currentLevel} de 8. ${cierre}`
  }
  if (input.wrongStreak > 0) {
    return input.idiomaIngles
      ? `You are working through some challenges right now${materiaTexto} — ${input.wrongStreak} incorrect attempt${input.wrongStreak === 1 ? '' : 's'} in a row at difficulty level ${input.currentLevel} out of 8, and we are adjusting together. ${cierre}`
      : `Ahora mismo estás resolviendo algunos retos${materiaTexto} — ${input.wrongStreak} intento${input.wrongStreak === 1 ? '' : 's'} incorrecto${input.wrongStreak === 1 ? '' : 's'} seguido${input.wrongStreak === 1 ? '' : 's'} en el nivel de dificultad ${input.currentLevel} de 8, y estamos ajustando juntos. ${cierre}`
  }
  return input.idiomaIngles
    ? `You are currently at difficulty level ${input.currentLevel} out of 8${materiaTexto}, with no streak going yet this session. ${cierre}`
    : `Ahora mismo estás en el nivel de dificultad ${input.currentLevel} de 8${materiaTexto}, sin una racha activa todavía en esta sesión. ${cierre}`
}

// Hallazgo real (QA Ronda 2, revisión 2026-07-10): el botón/chip "Resume el
// tema" solo envía ese texto literal como si el alumno lo hubiera escrito,
// sin ninguna señal explícita de CUÁL tema resumir — el modelo decide por
// su cuenta a partir del historial reciente (y el frontend solo manda los
// últimos 6 mensajes), así que el resultado es no determinístico: a veces
// resume el ejercicio activo, a veces un tema anterior, a veces algo
// genérico. isResumeTopicChipRequest detecta este clic específico para
// poder inyectar un contexto explícito (ejercicio pendiente o materia
// activa) que le diga al modelo exactamente qué debe resumir, en vez de
// dejarlo a su criterio.
export function isResumeTopicChipRequest(value: string): boolean {
  const text = normalizeText(value)
  return text === 'resume el tema' || text === 'summarize the topic'
}

export function describeResumeTopicPolicyForPrompt(input: {
  pendingOperation?: string | null
  materia?: string | null
  idiomaIngles?: boolean
}): string {
  const tema = input.pendingOperation
    ? (input.idiomaIngles ? `the exercise we are currently working on (${formatOperation(input.pendingOperation)})` : `el ejercicio en el que estamos trabajando ahora mismo (${formatOperation(input.pendingOperation)})`)
    : input.materia
      ? (input.idiomaIngles ? `the most specific topic covered so far in ${input.materia} this session` : `el tema más específico que se haya cubierto hasta ahora en ${input.materia} en esta sesión`)
      : (input.idiomaIngles ? 'the most recent specific topic discussed in this session' : 'el tema más específico y reciente que se haya discutido en esta sesión')
  return input.idiomaIngles
    ? `The student clicked "Summarize the topic". Summarize specifically ${tema} — do not give a generic summary and do not default to the very first topic of the whole conversation if a more recent one is active.`
    : `El alumno presionó "Resume el tema". Resume específicamente ${tema} — no des un resumen genérico ni te vayas al primer tema de toda la conversación si hay uno más reciente activo.`
}

export function stripUnapprovedExternalResources(value: string, idiomaIngles = false) {
  const original = value || ''
  const lines = original
    .split('\n')
    .filter((line) => !/(youtube\.com|youtu\.be|eduardomontano|recurso externo)/i.test(line))
  let cleaned = lines.join('\n').replace(/https?:\/\/\S+/gi, '').replace(/\n{3,}/g, '\n\n').trim()
  if (cleaned === original.trim()) return { text: original, guardActivado: false }
  const cierre = idiomaIngles
    ? 'I will continue using the official Owlaris material available for this subject.'
    : 'Seguimos trabajando con el material oficial disponible en Owlaris para esta materia.'
  cleaned = cleaned ? `${cleaned}\n\n${cierre}` : cierre
  return { text: cleaned, guardActivado: true }
}
