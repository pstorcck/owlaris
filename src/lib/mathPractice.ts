import {
  inferCanonicalOperationFromText,
  isSafeCanonicalOperation,
  solveOperation,
} from './mathSafety'

export type MathPracticeExercise = {
  text: string
  op: string
}

export type MathPracticeFocus = 'general' | 'equation' | 'decimal'

export type DifficultyAdaptationType = 'sube' | 'baja' | 'refuerza' | 'mantiene'

export type DifficultyAdaptation = {
  tipo: DifficultyAdaptationType
  nivel_anterior: number
  nivel_nuevo: number
  aciertos_consecutivos: number
  fallos_consecutivos: number
  motivo: string
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

function exercisePoolForLevel(level: number, focus: MathPracticeFocus = 'general') {
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

  if (focus === 'equation') {
    const equationMaxLevel = Math.min(8, Math.max(4, safeLevel + 3))
    return pools.slice(3, equationMaxLevel).flat()
  }

  if (focus === 'decimal') return pools[2]

  return pools.slice(0, safeLevel).flat()
}

function fallbackExercise(recentOps: string[], level: number, focus: MathPracticeFocus = 'general') {
  const seed = recentOps.length + Math.max(1, level) * 11
  if (focus === 'equation' || level >= 4) {
    const x = (seed % 9) + 2
    const a = (seed % 5) + 2
    const b = (seed % 7) + 1
    return `${a}*x+${b}=${a * x + b}`
  }
  if (focus === 'decimal') {
    const hundredths = [10, 15, 20, 25, 50, 75][seed % 6]
    const quantity = ((seed % 9) + 2) * 10
    return `${hundredths / 100}*${quantity}`
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

export function calculateAdaptiveDifficulty(input: {
  currentLevel: number
  correctStreak: number
  wrongStreak: number
  idiomaIngles?: boolean
}): DifficultyAdaptation {
  const nivelAnterior = Math.min(8, Math.max(1, Number.isFinite(input.currentLevel) ? Math.round(input.currentLevel) : 1))
  const aciertos = Math.max(0, Math.round(input.correctStreak || 0))
  const fallos = Math.max(0, Math.round(input.wrongStreak || 0))
  const english = !!input.idiomaIngles

  if (fallos > 0 && fallos % 4 === 0) {
    const nivelNuevo = Math.max(1, nivelAnterior - 1)
    const tipo: DifficultyAdaptationType = nivelNuevo < nivelAnterior ? 'baja' : 'refuerza'
    return {
      tipo,
      nivel_anterior: nivelAnterior,
      nivel_nuevo: nivelNuevo,
      aciertos_consecutivos: aciertos,
      fallos_consecutivos: fallos,
      motivo: english
        ? tipo === 'baja'
          ? `After ${fallos} incorrect attempts in a row, Owlaris lowers the difficulty one level to diagnose the missing base.`
          : `After ${fallos} incorrect attempts in a row, Owlaris keeps the basic level and reinforces prerequisite skills.`
        : tipo === 'baja'
          ? `Después de ${fallos} respuestas en práctica seguidas, Owlaris baja un nivel para diagnosticar la base que falta.`
          : `Después de ${fallos} respuestas en práctica seguidas, Owlaris mantiene el nivel base y refuerza habilidades previas.`,
    }
  }

  if (aciertos > 0 && aciertos % 5 === 0) {
    const nivelNuevo = Math.min(8, nivelAnterior + 1)
    const tipo: DifficultyAdaptationType = nivelNuevo > nivelAnterior ? 'sube' : 'mantiene'
    return {
      tipo,
      nivel_anterior: nivelAnterior,
      nivel_nuevo: nivelNuevo,
      aciertos_consecutivos: aciertos,
      fallos_consecutivos: fallos,
      motivo: english
        ? tipo === 'sube'
          ? `After ${aciertos} correct answers in a row, Owlaris raises the difficulty one level.`
          : `The student reached ${aciertos} correct answers in a row and is already at the highest level.`
        : tipo === 'sube'
          ? `Después de ${aciertos} respuestas correctas seguidas, Owlaris sube un nivel la dificultad.`
          : `El estudiante llegó a ${aciertos} respuestas correctas seguidas y ya está en el nivel más alto.`,
    }
  }

  return {
    tipo: 'mantiene',
    nivel_anterior: nivelAnterior,
    nivel_nuevo: nivelAnterior,
    aciertos_consecutivos: aciertos,
    fallos_consecutivos: fallos,
    motivo: english
      ? `Owlaris keeps level ${nivelAnterior} while it gathers enough evidence to adjust.`
      : `Owlaris mantiene el nivel ${nivelAnterior} mientras reúne suficiente evidencia para ajustar.`,
  }
}

export function buildNextMathExercise(
  recentOps: Array<string | null | undefined>,
  level = 1,
  idiomaIngles = false,
  focus: MathPracticeFocus = 'general'
): MathPracticeExercise {
  const recentClean = recentOps
    .map((op) => normalizePracticeOperation(op))
    .filter(Boolean)
  const recentSet = new Set(recentClean)
  const pool = exercisePoolForLevel(level, focus)
  const start = hashText(`${recentClean.join('|')}|${level}|${focus}`) % pool.length

  for (let i = 0; i < pool.length; i += 1) {
    const op = pool[(start + i) % pool.length]
    const key = normalizePracticeOperation(op)
    if (!recentSet.has(key) && isSafeCanonicalOperation(op) && solveOperation(op) !== null) {
      return { op, text: exerciseText(op, idiomaIngles) }
    }
  }

  let op = fallbackExercise(recentClean, level, focus)
  while (recentSet.has(normalizePracticeOperation(op))) {
    op = fallbackExercise([...recentClean, op], level, focus)
  }
  return { op, text: exerciseText(op, idiomaIngles) }
}

export function inferMathPracticeFocus(texts: Array<string | null | undefined>): MathPracticeFocus {
  const normalized = texts
    .filter(Boolean)
    .join('\n')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (
    /\b(ecuacion|ecuaciones|equation|equations|algebra|despej|variable|variables)\b/.test(normalized) ||
    /[0-9)]\s*\*?\s*x\s*[+\-*/=]/i.test(normalized) ||
    /x\s*[+\-*/=]/i.test(normalized)
  ) {
    return 'equation'
  }

  if (/\b(decimal|decimales|porcentaje|porcentajes|percent|fraction|fraccion|fracciones)\b/.test(normalized)) {
    return 'decimal'
  }

  return 'general'
}

export function isWorkedExampleRequest(text: string) {
  const normalized = String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  return /(explicame|explica|explain|show me|muestrame|dame).*(ejemplo|example)/i.test(normalized) ||
    /(con|with)\s+(un\s+)?(ejemplo|example)/i.test(normalized)
}

function chooseAnalogousOperation(activeOp: string | null | undefined) {
  const activeKey = normalizePracticeOperation(activeOp)
  const candidates = activeKey.includes('=') && /x/.test(activeKey)
    ? activeKey.includes('(')
      ? ['3*(x+2)=15', '4*(x+1)=20', '2*(x+5)=18']
      : ['3*x+6=21', '2*x-3=11', 'x+4=12']
    : activeKey.includes('.') || activeKey.includes('%')
      ? ['0.2*50', '0.25*80', '0.15*40']
      : activeKey.includes('*') && (activeKey.includes('+') || activeKey.includes('-'))
        ? ['18-3*4', '6+2*5', '20-4*3']
        : activeKey.includes('/')
          ? ['36/6', '48/8', '45/5']
          : ['8+7', '21-9', '6*4']

  return candidates.find((op) => normalizePracticeOperation(op) !== activeKey && solveOperation(op) !== null) || candidates[0]
}

function solvedAnalogExample(op: string, idiomaIngles: boolean) {
  const visible = formatOperation(op)
  const solution = solveOperation(op)
  const solutionText = solution === null ? '' : Number(solution.toFixed(6)).toString()

  if (op.includes('=') && /x/i.test(op)) {
    if (idiomaIngles) {
      return `Use this similar example, not your active exercise: ${visible}. First undo the outside operation, then isolate x. In this example the final value is x = ${solutionText}. Now apply the same kind of step to your exercise without copying this number.`
    }
    return `Usemos un ejemplo parecido, no tu ejercicio activo: ${visible}. Primero deshacemos la operación de afuera y luego dejamos x sola. En este ejemplo el valor final es x = ${solutionText}. Ahora aplica ese mismo tipo de paso a tu ejercicio sin copiar este número.`
  }

  if (idiomaIngles) {
    return `Use this similar example, not your active exercise: ${visible}. Work one operation at a time until the result is ${solutionText}. Now try the same process with your exercise.`
  }
  return `Usemos un ejemplo parecido, no tu ejercicio activo: ${visible}. Resuelve una operación a la vez hasta llegar a ${solutionText}. Ahora intenta el mismo proceso con tu ejercicio.`
}

export function buildAnalogousWorkedExample(activeOp: string | null | undefined, idiomaIngles = false): MathPracticeExercise {
  const op = chooseAnalogousOperation(activeOp)
  const intro = idiomaIngles
    ? 'I will not solve the active exercise for you, but I can show you the method with different numbers.'
    : 'No voy a resolver el ejercicio activo por ti, pero sí puedo mostrarte el método con números distintos.'
  return {
    op,
    text: `${intro}\n\n${solvedAnalogExample(op, idiomaIngles)}`,
  }
}
