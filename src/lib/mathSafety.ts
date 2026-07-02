import { evaluate } from 'mathjs'

export type MathEvaluation = {
  estado: string
  feedback: string
  correctAnswer: number | null
  op: string | null
  guardActivado: boolean
}

export function extractAndCleanOperation(rawText: string): { visibleText: string; operation: string | null } {
  if (!rawText || typeof rawText !== 'string') return { visibleText: '', operation: null }
  const opRegex = /\[?\s*OP\s*:\s*([^\]\n]+)\]?/gi
  const matches = Array.from(rawText.matchAll(opRegex))
  const lastMatch = matches.length > 0 ? matches[matches.length - 1] : null
  const operation = lastMatch?.[1]?.trim() || null
  const visibleText = rawText
    .replace(/(?:^|\n)\s*\[?\s*OP\s*:\s*[^\]\n]+\]?\s*(?=\n|$)/gi, '\n')
    .replace(/\s*\[?\s*OP\s*:\s*[^\]\n]+\]?\s*/gi, ' ')
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ').trim()
  return { visibleText, operation }
}

export function extractCanonicalOperation(texto: string): string | null {
  return extractAndCleanOperation(texto).operation
}

function normalizeOperation(op: string): string {
  return op
    .replace(/,/g, '.')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/\s+/g, '')
}

function parseNumericAnswerToken(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.')
  const fracMatch = normalized.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/)
  if (fracMatch) {
    const denominator = parseFloat(fracMatch[2])
    if (denominator === 0) return null
    return parseFloat(fracMatch[1]) / denominator
  }
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return null
  const n = parseFloat(normalized)
  return isNaN(n) ? null : n
}

export function isSafeCanonicalOperation(op: string | null): boolean {
  if (!op || op.trim().length === 0 || op.length > 200) return false
  const normalized = normalizeOperation(op)
  return /^[0-9xX+\-*/().=\s%^]+$/.test(normalized.replace(/sqrt|log|sin|cos|tan/gi, ''))
}

export function validateOperation(op: string): { ok: boolean; reason?: string } {
  if (!op) return { ok: false, reason: 'sin_operacion' }
  const opLimpia = normalizeOperation(op).replace(/sqrt|log|sin|cos|tan|pi|abs|floor|ceil/gi, '0')
  if (/[a-zA-Z]{2,}/.test(opLimpia)) return { ok: false, reason: 'contiene_texto' }
  if (op.length > 300) return { ok: false, reason: 'demasiado_larga' }
  return { ok: true }
}

export function normalizeStudentAnswer(respuesta: string): number | null {
  const s = String(respuesta).trim().toLowerCase()

  const direct = s.match(/^(?:x\s*=\s*)?(-?\d+(?:[.,]\d+)?(?:\s*\/\s*-?\d+(?:[.,]\d+)?)?)$/i)
  if (direct) return parseNumericAnswerToken(direct[1])

  const labeled = Array.from(s.matchAll(/\b(?:respuesta|resultado|answer|result)\s*(?:final|correcta|correct)?\s*(?:es|is|:|=)?\s*(-?\d+(?:[.,]\d+)?(?:\s*\/\s*-?\d+(?:[.,]\d+)?)?)/gi))
  if (labeled.length > 0) return parseNumericAnswerToken(labeled[labeled.length - 1][1])

  const equations = Array.from(s.matchAll(/=\s*(-?\d+(?:[.,]\d+)?(?:\s*\/\s*-?\d+(?:[.,]\d+)?)?)/g))
  if (equations.length > 0) return parseNumericAnswerToken(equations[equations.length - 1][1])

  const numbers = Array.from(s.matchAll(/-?\d+(?:[.,]\d+)?(?:\s*\/\s*-?\d+(?:[.,]\d+)?)?/g))
  if (numbers.length === 1) return parseNumericAnswerToken(numbers[0][0])

  return null
}

function withImplicitMultiplication(expr: string): string {
  return expr
    .replace(/X/g, 'x')
    .replace(/(\d(?:\.\d+)?)(?=x|\()/gi, '$1*')
    .replace(/\)(?=\d|x|\()/gi, ')*')
    .replace(/x(?=\()/gi, 'x*')
}

function evaluateNumericExpression(expr: string, scope?: { x?: number }): number | null {
  try {
    const normalized = withImplicitMultiplication(expr)
    const result = scope ? evaluate(normalized, scope) : evaluate(normalized)
    return typeof result === 'number' && isFinite(result) ? result : null
  } catch {
    return null
  }
}

function solveLinearEquation(op: string): number | null {
  const parts = normalizeOperation(op).replace(/X/g, 'x').split('=')
  if (parts.length !== 2 || !parts[0] || !parts[1] || !/[x]/i.test(op)) return null

  const differenceAt = (x: number): number | null => {
    const left = evaluateNumericExpression(parts[0], { x })
    const right = evaluateNumericExpression(parts[1], { x })
    return left !== null && right !== null ? left - right : null
  }

  const y0 = differenceAt(0)
  const y1 = differenceAt(1)
  if (y0 === null || y1 === null) return null

  const coefficient = y1 - y0
  if (Math.abs(coefficient) < 1e-12) return null

  const solution = -y0 / coefficient
  const check = differenceAt(solution)
  if (check === null || Math.abs(check) > 0.001) return null

  const rounded = Math.round(solution)
  return Math.abs(solution - rounded) < 0.000001 ? rounded : solution
}

export function solveOperation(op: string): number | null {
  try {
    const clean = normalizeOperation(op)
    if (clean.includes('=') && /x/i.test(clean)) return solveLinearEquation(clean)
    const opSinFunciones = clean.replace(/sqrt|log|sin|cos|tan|pi|abs/gi, '0')
    if (/[a-zA-Z]/.test(opSinFunciones)) return null
    return evaluateNumericExpression(clean)
  } catch {
    return null
  }
}

export function compareAnswers(studentN: number | null, correctN: number | null): string {
  if (studentN === null || correctN === null) return 'no_evaluable'
  if (Math.abs(studentN - correctN) < 0.001) return 'correcto'
  if (Math.abs(studentN - correctN) < 0.01) return 'equivalente'
  return 'incorrecto'
}

function normalizeSubjectForMathProtocol(subject: string): string {
  return String(subject || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function isLikelyNumericSubject(subject: string): boolean {
  const s = normalizeSubjectForMathProtocol(subject)
  return /\b(mathematics?|math|algebra|geometry|geometria|aritmetica|estadistica|statistics|physics?|fisica|chemistry|quimica|biology|biologia|natural sciences?|ciencias naturales|olimpiadas?)\b/.test(s) ||
    s.includes('matematica') ||
    s.includes('mineduc - matematica')
}

function buildEvaluationState(comparison: string, hasVerifiedOp: boolean): string {
  if (!hasVerifiedOp) return 'no_evaluable'
  return comparison
}

function contradictionGuard(
  feedback: string,
  estado: string,
  studentN: number | null,
  correctN: number | null,
  idiomaIngles: boolean
): { feedback: string; guardActivado: boolean } {
  if (studentN !== null && correctN !== null && Math.abs(studentN - correctN) < 0.001) {
    if (feedback.toLowerCase().includes('incorrecto') || feedback.toLowerCase().includes('incorrect')) {
      const feedbackCorregido = idiomaIngles
        ? `Correct. ${studentN} is the right answer. Can you explain how you solved it?`
        : `Correcto. ${studentN} es la respuesta correcta. ¿Puedes explicarme cómo llegaste a ese resultado?`
      return { feedback: feedbackCorregido, guardActivado: true }
    }
  }

  if (estado === 'no_evaluable') {
    if ((feedback.toLowerCase().includes('correcto') && !feedback.toLowerCase().includes('¿')) ||
        feedback.toLowerCase().includes('incorrecto')) {
      return {
        feedback: idiomaIngles
          ? 'To check properly, first write the operation. What operation represents the problem?'
          : 'Para revisarlo bien, primero escribamos la operación. ¿Qué operación representa el problema?',
        guardActivado: true,
      }
    }
  }

  return { feedback, guardActivado: false }
}

function generatePedagogicalFeedback(
  estado: string,
  studentAnswer: string,
  _correctAnswer: number | null,
  idiomaIngles: boolean,
  op?: string | null
): string {
  const hint = buildGuidedMathHint(op, idiomaIngles)
  switch (estado) {
    case 'correcto':
    case 'equivalente':
      return idiomaIngles
        ? `Correct. ${studentAnswer} is the right answer. Can you explain how you solved it?`
        : `¡Correcto! ${studentAnswer} es la respuesta correcta. ¿Puedes explicarme cómo llegaste a ese resultado?`
    case 'incorrecto':
      return idiomaIngles
        ? `Not yet. I will not give you the final answer directly, but I will guide you. ${hint} Try again with that step.`
        : `Todavía no llegamos a la respuesta correcta. No te voy a dar la respuesta directamente, pero sí te voy a guiar. ${hint} Intenta de nuevo con ese paso.`
    case 'no_evaluable':
      return idiomaIngles
        ? "To check properly, first write the operation. What operation represents the problem?"
        : 'Para revisarlo bien, primero escribamos la operación. ¿Qué operación representa el problema?'
    default:
      return idiomaIngles
        ? "I couldn't verify that right now. Let's review the process step by step."
        : 'No pude verificarlo en este momento. Revisemos el procedimiento paso a paso.'
  }
}

function buildGuidedMathHint(op: string | null | undefined, idiomaIngles: boolean): string {
  const clean = normalizeOperation(op || '')
  if (clean.includes('=') && /x/i.test(clean)) {
    return idiomaIngles
      ? 'First identify what operation is affecting x, then use the inverse operation to isolate it.'
      : 'Primero identifica qué operación afecta a x y luego usa la operación inversa para dejarla sola.'
  }
  if ((clean.includes('*') || clean.includes('/')) && (clean.includes('+') || clean.includes('-'))) {
    return idiomaIngles
      ? 'Remember the order of operations: solve multiplication or division before addition or subtraction.'
      : 'Recuerda el orden de operaciones: resuelve multiplicación o división antes de sumar o restar.'
  }
  if (clean.includes('/')) {
    return idiomaIngles
      ? 'Think of division as sharing into equal groups. What is the first smaller operation you can solve?'
      : 'Piensa la división como repartir en grupos iguales. ¿Cuál es la primera operación pequeña que puedes resolver?'
  }
  if (clean.includes('-')) {
    return idiomaIngles
      ? 'For subtraction, try breaking apart the number you subtract and remove it in two easier steps.'
      : 'Para restar, prueba separar el número que quitas y hacerlo en dos pasos más fáciles.'
  }
  if (clean.includes('*')) {
    return idiomaIngles
      ? 'Think of multiplication as equal groups. How many groups are there, and how many are in each group?'
      : 'Piensa la multiplicación como grupos iguales. ¿Cuántos grupos hay y cuántos hay en cada grupo?'
  }
  return idiomaIngles
    ? 'First write the operation clearly, then solve only the first step.'
    : 'Primero escribe la operación con claridad y resuelve solo el primer paso.'
}

function logEvaluation(data: Record<string, unknown>) {
  if (process.env.NODE_ENV !== 'production') console.log('EVAL:', JSON.stringify(data))
}

function normalizeOptionAnswer(respuesta: string): string | null {
  const match = String(respuesta).trim().match(/^(?:opci[oó]n\s*)?([abcd])[\).:\s]*$/i)
  return match ? match[1].toUpperCase() : null
}

function extractMultipleChoiceValue(tutorQuestion: string, studentAnswer: string): number | null {
  const option = normalizeOptionAnswer(studentAnswer)
  if (!option) return null

  const optionRegex = /(?:^|[\s\n\r])([A-D])\s*[\).:-]\s*(-?\d+(?:[.,]\d+)?(?:\s*\/\s*-?\d+(?:[.,]\d+)?)?)/gi
  const matches = Array.from(tutorQuestion.matchAll(optionRegex))
  const selected = matches.find((match) => match[1].toUpperCase() === option)
  return selected ? parseNumericAnswerToken(selected[2]) : null
}

export async function handleMathEvaluation(
  tutorQuestion: string,
  studentAnswer: string,
  idiomaIngles: boolean,
  wolframAppId?: string
): Promise<MathEvaluation | null> {
  const op = extractCanonicalOperation(tutorQuestion) || inferCanonicalOperationFromText(tutorQuestion)
  if (!op) return null

  const validation = validateOperation(op)
  if (!validation.ok) return null

  let correctAnswer = solveOperation(op)

  if (correctAnswer === null && wolframAppId) {
    try {
      const query = encodeURIComponent(op)
      const url = `https://api.wolframalpha.com/v1/result?appid=${wolframAppId}&i=${query}`
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) })
      if (res.ok) {
        const texto = await res.text()
        if (!texto.includes('did not understand')) {
          const num = parseFloat(texto.match(/-?\d+([.,]\d+)?/)?.[0] || '')
          if (!isNaN(num)) correctAnswer = num
        }
      }
    } catch {
      // Wolfram es respaldo, no debe bloquear la respuesta.
    }
  }

  const studentN = normalizeStudentAnswer(studentAnswer) ?? extractMultipleChoiceValue(tutorQuestion, studentAnswer)
  const comparison = compareAnswers(studentN, correctAnswer)
  const estado = buildEvaluationState(comparison, correctAnswer !== null)
  const feedbackBase = generatePedagogicalFeedback(estado, studentAnswer, correctAnswer, idiomaIngles, op)
  const { feedback, guardActivado } = contradictionGuard(feedbackBase, estado, studentN, correctAnswer, idiomaIngles)

  logEvaluation({ op, correctAnswer, studentAnswer, studentN, estado, guardActivado })

  return { estado, feedback, correctAnswer, op, guardActivado }
}

function selectRelevantMathText(text: string): string {
  const normalized = text.replace(/\r/g, '\n')
  const questionChunks = Array.from(normalized.matchAll(/¿?[^?]*\?/g))
    .map((match) => match[0].trim())
    .filter((chunk) => looksLikeMathPracticePrompt(chunk))

  if (questionChunks.length > 0) return questionChunks[questionChunks.length - 1]

  const practiceLines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /(?:cu[aá]nto|resuelve|calcula|resultado|what is|solve|calculate)/i.test(line))

  if (practiceLines.length > 0) return practiceLines[practiceLines.length - 1]
  return text
}

export function inferCanonicalOperationFromText(text: string): string | null {
  if (!text) return null

  const explicit = extractCanonicalOperation(text)
  if (explicit && isSafeCanonicalOperation(explicit)) return normalizeOperation(explicit)

  const relevantText = selectRelevantMathText(text)
  const normalized = relevantText
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/,/g, '.')

  const percentMatches = Array.from(normalized.matchAll(/(\d+(?:\.\d+)?)\s*%\s*(?:de|of)\s*(\d+(?:\.\d+)?)/gi))
  const percent = percentMatches.length > 0 ? percentMatches[percentMatches.length - 1] : null
  if (percent) return `${parseFloat(percent[1]) / 100}*${percent[2]}`

  const equations = Array.from(normalized.matchAll(/[\dxX().+\-*/^\s]+=[\dxX().+\-*/^\s]+/g))
  const equation = equations.length > 0 ? equations[equations.length - 1] : null
  if (equation) {
    const op = normalizeOperation(equation[0]).replace(/\.+$/g, '')
    if (/[xX]/.test(op) && isSafeCanonicalOperation(op)) return op
  }

  const parenthesizedExpressions = Array.from(normalized.matchAll(/\(-?\d+(?:\.\d+)?(?:\s*(?:[+\-*/^])\s*-?\d+(?:\.\d+)?){1,4}\)\s*(?:[*/^]\s*-?\d+(?:\.\d+)?){1,3}/g))
  const parenthesizedExpression = parenthesizedExpressions.length > 0 ? parenthesizedExpressions[parenthesizedExpressions.length - 1] : null
  if (parenthesizedExpression) {
    const op = normalizeOperation(parenthesizedExpression[0])
    if (isSafeCanonicalOperation(op)) return op
  }

  const expressions = Array.from(normalized.matchAll(/-?\d+(?:\.\d+)?(?:\s*(?:[+\-*/^])\s*-?\d+(?:\.\d+)?){1,4}/g))
  const expression = expressions.length > 0 ? expressions[expressions.length - 1] : null
  if (!expression) return null

  const op = normalizeOperation(expression[0])
  return isSafeCanonicalOperation(op) ? op : null
}

export function looksLikeMathPracticePrompt(text: string): boolean {
  const lower = text.toLowerCase()
  return lower.includes('?') &&
    /(cu[aá]nto|resuelve|calcula|resultado|intenta|dame tu respuesta|what is|solve|calculate|answer)/i.test(lower)
}

export function hasIncorrectVerdict(text: string): boolean {
  const lower = text.toLowerCase()
  return lower.includes('incorrecto') ||
    lower.includes('incorrect') ||
    lower.includes('no es correcto') ||
    lower.includes('not correct')
}
