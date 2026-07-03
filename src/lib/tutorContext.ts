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
  return isNoAnswerComplaint(value) || [
    'sin calculadora',
    'sin usar calculadora',
    'puedo usar calculadora',
    'puedo usar la calculadora',
    'usar calculadora para',
    'puedo lograr',
    'puedo hacerlo',
    'puedo resolverlo',
    'como lo hago',
    'como empiezo',
    'no entiendo',
    'ayudame con este',
    'este mismo',
    'misma pregunta',
    'misma fraccion',
    'without calculator',
    'without a calculator',
    'can i do it',
    'can i solve it',
    'how do i start',
    'i do not understand',
    "i don't understand",
  ].some((needle) => text.includes(needle))
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
  const asksCalculator = question.includes('calculadora') || question.includes('calculator') || question.includes('puedo lograr') || question.includes('puedo hacerlo')
  const asksToUseCalculator = (
    /puedo usar(?: la)? calculadora/.test(question) ||
    /usar(?: la)? calculadora para/.test(question) ||
    /can i use (?:a )?calculator/.test(question)
  ) && !question.includes('sin usar calculadora') && !question.includes('without')

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
      ? `${complaintPrefix}Yes, you can work it out step by step. Let us stay with the active equation: ${operation}. First, identify which term is attached to x and which term is separate. What operation would undo the separate term on both sides?`
      : `${complaintPrefix}Sí, puedes resolverlo paso a paso. Sigamos con la ecuación activa: ${operation}. Primero identifica qué término acompaña a x y qué término está separado. ¿Qué operación harías en ambos lados para deshacer el término separado?`
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
