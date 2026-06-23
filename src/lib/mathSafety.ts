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
  const parseNumericToken = (raw: string): number | null => {
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

  const direct = s.match(/^(?:x\s*=\s*)?(-?\d+(?:[.,]\d+)?(?:\s*\/\s*-?\d+(?:[.,]\d+)?)?)$/i)
  if (direct) return parseNumericToken(direct[1])

  const labeled = Array.from(s.matchAll(/\b(?:respuesta|resultado|answer|result)\s*(?:final|correcta|correct)?\s*(?:es|is|:|=)?\s*(-?\d+(?:[.,]\d+)?(?:\s*\/\s*-?\d+(?:[.,]\d+)?)?)/gi))
  if (labeled.length > 0) return parseNumericToken(labeled[labeled.length - 1][1])

  const equations = Array.from(s.matchAll(/=\s*(-?\d+(?:[.,]\d+)?(?:\s*\/\s*-?\d+(?:[.,]\d+)?)?)/g))
  if (equations.length > 0) return parseNumericToken(equations[equations.length - 1][1])

  const numbers = Array.from(s.matchAll(/-?\d+(?:[.,]\d+)?(?:\s*\/\s*-?\d+(?:[.,]\d+)?)?/g))
  if (numbers.length === 1) return parseNumericToken(numbers[0][0])

  return null
}

export function solveOperation(op: string): number | null {
  try {
    const clean = normalizeOperation(op)
    const opSinFunciones = clean.replace(/sqrt|log|sin|cos|tan|pi|abs/gi, '0')
    if (clean.includes('=') && /[a-zA-Z]/.test(opSinFunciones)) return null
    const result = evaluate(clean)
    return typeof result === 'number' && isFinite(result) ? result : null
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
  correctAnswer: number | null,
  idiomaIngles: boolean
): string {
  switch (estado) {
    case 'correcto':
    case 'equivalente':
      return idiomaIngles
        ? `Correct. ${studentAnswer} is the right answer. Can you explain how you solved it?`
        : `¡Correcto! ${studentAnswer} es la respuesta correcta. ¿Puedes explicarme cómo llegaste a ese resultado?`
    case 'incorrecto':
      return idiomaIngles
        ? `Incorrect. The correct result is ${correctAnswer}. Try again step by step.`
        : `Incorrecto. El resultado correcto es ${correctAnswer}. Intenta de nuevo paso a paso.`
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

function logEvaluation(data: Record<string, unknown>) {
  if (process.env.NODE_ENV !== 'production') console.log('EVAL:', JSON.stringify(data))
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

  const studentN = normalizeStudentAnswer(studentAnswer)
  const comparison = compareAnswers(studentN, correctAnswer)
  const estado = buildEvaluationState(comparison, correctAnswer !== null)
  const feedbackBase = generatePedagogicalFeedback(estado, studentAnswer, correctAnswer, idiomaIngles)
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
