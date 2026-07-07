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

export function isPendingContextQuestion(value: string) {
  const text = normalizeText(value)
  if (!text) return false
  if (/puedo usar\s+(?:una\s+|la\s+)?calculadora/.test(text) || /usar\s+(?:una\s+|la\s+)?calculadora para/.test(text)) return true
  return isNoAnswerComplaint(value) || [
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
  ].some((needle) => text.includes(needle))
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
