import {
  inferCanonicalOperationFromText,
  isSafeCanonicalOperation,
  solveOperation,
} from './mathSafety'

export type MathPracticeExercise = {
  text: string
  op: string
}

export function normalizePracticeOperation(op?: string | null) {
  return String(op || '')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/\s+/g, '')
    .toLowerCase()
}

export function collectRecentMathOperations(texts: Array<string | null | undefined>) {
  const ops: string[] = []
  const seen = new Set<string>()
  for (const text of texts) {
    const op = inferCanonicalOperationFromText(String(text || ''))
    const key = normalizePracticeOperation(op)
    if (op && key && !seen.has(key)) {
      seen.add(key)
      ops.push(op)
    }
  }
  return ops
}

export function isRepeatedMathOperation(op: string | null | undefined, recentOps: Array<string | null | undefined>) {
  const key = normalizePracticeOperation(op)
  if (!key) return false
  return recentOps.some((recent) => normalizePracticeOperation(recent) === key)
}

function hashText(value: string) {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function exercisePoolForLevel(level: number) {
  const safeLevel = Math.min(8, Math.max(1, Number.isFinite(level) ? Math.round(level) : 1))
  const pools = [
    ['7+5', '48-19', '72/8', '8*6', '63-27', '9*7'],
    ['8+3*2', '(10+6)/2', '24/3+5', '20-4*2', '30+6/2', '15-3*2'],
    ['0.25*200', '0.10*80', '0.5*36', '0.15*60', '0.2*45', '0.75*24'],
    ['x+5=12', 'x-8=14', 'x/4=6', 'x+9=20', 'x-11=7', 'x/3=9'],
    ['2*x-4=10', '3*x+5=20', '4*x-7=21', '5*x+2=32', '6*x-3=27', '7*x+1=43'],
    ['2*(x+3)=18', '3*(x-2)=15', '4*(x+1)=28', '5*(x-3)=20', '2*(x+7)=30'],
    ['5*x+3=2*x+15', '4*x-1=x+11', '6*x+2=3*x+20', '7*x-5=2*x+25'],
    ['4*(x-2)+3=2*(x+1)+9', '3*(x+4)-5=x+17', '2*(x-6)+8=4*x-10'],
  ]
  return pools.slice(0, safeLevel).flat()
}

function fallbackExercise(recentOps: string[], level: number) {
  const seed = recentOps.length + Math.max(1, level) * 11
  if (level >= 4) {
    const x = (seed % 9) + 2
    const a = (seed % 5) + 2
    const b = (seed % 7) + 1
    return `${a}*x+${b}=${a * x + b}`
  }
  const a = (seed % 40) + 12
  const b = (seed % 9) + 2
  return `${a}+${b}*2`
}

function formatOperation(op: string) {
  return op
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

function exerciseText(op: string, idiomaIngles: boolean) {
  const visible = formatOperation(op)
  if (op.includes('=') && /x/i.test(op)) {
    return idiomaIngles
      ? `Try this different equation: ${visible}. What is x?`
      : `Intenta esta ecuacion distinta: ${visible}. ¿Cuanto vale x?`
  }
  return idiomaIngles
    ? `Try this different exercise: ${visible}. What is the result?`
    : `Intenta este ejercicio distinto: ${visible}. ¿Cual es el resultado?`
}

export function buildNextMathExercise(
  recentOps: Array<string | null | undefined>,
  level = 1,
  idiomaIngles = false
): MathPracticeExercise {
  const recentClean = recentOps
    .map((op) => normalizePracticeOperation(op))
    .filter(Boolean)
  const recentSet = new Set(recentClean)
  const pool = exercisePoolForLevel(level)
  const start = hashText(`${recentClean.join('|')}|${level}`) % pool.length

  for (let i = 0; i < pool.length; i += 1) {
    const op = pool[(start + i) % pool.length]
    const key = normalizePracticeOperation(op)
    if (!recentSet.has(key) && isSafeCanonicalOperation(op) && solveOperation(op) !== null) {
      return { op, text: exerciseText(op, idiomaIngles) }
    }
  }

  let op = fallbackExercise(recentClean, level)
  while (recentSet.has(normalizePracticeOperation(op))) {
    op = fallbackExercise([...recentClean, op], level)
  }
  return { op, text: exerciseText(op, idiomaIngles) }
}
