import {
  inferCanonicalOperationFromText,
  isSafeCanonicalOperation,
  solveOperation,
} from './mathSafety'

export type MathPracticeExercise = {
  text: string
  op: string
}

export type MathPracticeFocus = 'general' | 'equation' | 'decimal' | 'suma_resta' | 'multiplicacion_division'

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

function randInt(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1))
}

// Un valor con signo listo para concatenar despues de "=" o "+" sin producir
// "+-5" (doble signo pegado), que algunos parsers de expresiones rechazan.
function withSign(value: number) {
  return value >= 0 ? `+${value}` : `-${Math.abs(value)}`
}

// Generadores por nivel: cada llamada produce una operacion aleatoria dentro
// de un rango amplio, en vez de elegir entre un puñado de ejercicios fijos.
// Esa lista fija (6-8 items por nivel) era la causa real de la repeticion:
// cualquier alumno con mas de unas pocas sesiones agotaba las combinaciones
// posibles y el sistema quedaba obligado a repetir el mismo banco para siempre.
const LEVEL_GENERATORS: Array<() => string> = [
  // Nivel 1: suma, resta, multiplicacion o division simple.
  () => {
    const kind = randInt(0, 3)
    if (kind === 0) return `${randInt(10, 89)}+${randInt(3, 70)}`
    if (kind === 1) { const a = randInt(20, 99); const b = randInt(3, a - 3); return `${a}-${b}` }
    if (kind === 2) return `${randInt(2, 12)}*${randInt(2, 12)}`
    const b = randInt(2, 12); const k = randInt(2, 12); return `${b * k}/${b}`
  },
  // Nivel 2: dos pasos, orden de operaciones.
  () => {
    const kind = randInt(0, 3)
    if (kind === 0) return `${randInt(4, 40)}+${randInt(2, 9)}*${randInt(2, 9)}`
    if (kind === 1) {
      const d = randInt(2, 8); const k = randInt(2, 15); const suma = d * k
      const p = randInt(1, suma - 1)
      return `(${p}+${suma - p})/${d}`
    }
    if (kind === 2) { const d = randInt(2, 8); const k = randInt(2, 15); return `${d * k}/${d}+${randInt(2, 30)}` }
    return `${randInt(20, 70)}-${randInt(2, 9)}*${randInt(2, 9)}`
  },
  // Nivel 3: decimales/porcentajes.
  () => {
    const decimales = [0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.75, 0.8, 0.9]
    const d = decimales[randInt(0, decimales.length - 1)]
    return `${d}*${randInt(2, 40) * 10}`
  },
  // Nivel 4: ecuaciones de un paso.
  () => {
    const kind = randInt(0, 3)
    const b = randInt(2, 30)
    if (kind === 0) { const x = randInt(2, 60); return `x+${b}=${x + b}` }
    if (kind === 1) { const x = randInt(b + 2, b + 60); return `x-${b}=${x - b}` }
    if (kind === 2) { const k = randInt(2, 15); return `x/${b}=${k}` }
    const k = randInt(2, 15); return `x*${b}=${b * k}`
  },
  // Nivel 5: ecuaciones de dos pasos.
  () => {
    const m = randInt(2, 9); const x = randInt(2, 20); const c = randInt(1, 40)
    const signo = randInt(0, 1) === 0 ? '+' : '-'
    const r = signo === '+' ? m * x + c : m * x - c
    return `${m}*x${signo}${c}=${r}`
  },
  // Nivel 6: ecuaciones con parentesis.
  () => {
    const m = randInt(2, 8); const x = randInt(2, 20); const c = randInt(1, 15)
    const signo = randInt(0, 1) === 0 ? '+' : '-'
    const dentro = signo === '+' ? x + c : x - c
    return `${m}*(x${signo}${c})=${m * dentro}`
  },
  // Nivel 7: x en ambos lados.
  () => {
    const m2 = randInt(2, 8); const m1 = randInt(m2 + 1, m2 + 6)
    const x = randInt(2, 20); const c1 = randInt(1, 30)
    const c2 = (m1 - m2) * x + c1
    return `${m1}*x+${c1}=${m2}*x+${c2}`
  },
  // Nivel 8: ecuaciones combinadas (parentesis + terminos en ambos lados).
  () => {
    const m2 = randInt(2, 6); const m1 = randInt(m2 + 1, m2 + 5)
    const x = randInt(2, 15); const c1 = randInt(1, 10); const c2 = randInt(1, 10)
    const d1 = randInt(1, 20)
    const signo1 = randInt(0, 1) === 0 ? '+' : '-'
    const signo2 = randInt(0, 1) === 0 ? '+' : '-'
    const dentro1 = signo1 === '+' ? x + c1 : x - c1
    const dentro2 = signo2 === '+' ? x + c2 : x - c2
    const izquierda = m1 * dentro1 + d1
    const d2 = izquierda - m2 * dentro2
    return `${m1}*(x${signo1}${c1})+${d1}=${m2}*(x${signo2}${c2})${withSign(d2)}`
  },
]

// Generadores dedicados para los enfoques de practica dirigida: garantizan por
// construccion que la operacion sea pura (sin mezclar suma/resta con mult/div),
// y crecen el rango con el nivel para no agotar las combinaciones en sesiones largas.
function generateSumaResta(level: number): string {
  const span = 30 + level * 25
  if (randInt(0, 1) === 0) return `${randInt(4, span)}+${randInt(3, span)}`
  const a = randInt(20, span * 2)
  const b = randInt(3, Math.max(4, a - 2))
  return `${a}-${b}`
}

function generateMultDiv(level: number): string {
  const maxFactor = Math.min(50, 12 + level * 6)
  if (randInt(0, 1) === 0) return `${randInt(2, maxFactor)}*${randInt(2, maxFactor)}`
  const b = randInt(2, maxFactor); const k = randInt(2, maxFactor)
  return `${b * k}/${b}`
}

function generateDecimal(): string {
  return LEVEL_GENERATORS[2]()
}

function exerciseGeneratorFor(level: number, focus: MathPracticeFocus): () => string {
  const safeLevel = Math.min(8, Math.max(1, Number.isFinite(level) ? Math.round(level) : 1))

  if (focus === 'suma_resta') return () => generateSumaResta(safeLevel)
  if (focus === 'multiplicacion_division') return () => generateMultDiv(safeLevel)
  if (focus === 'decimal') return generateDecimal

  if (focus === 'equation') {
    const equationMaxLevel = Math.min(8, Math.max(4, safeLevel + 3))
    return () => LEVEL_GENERATORS[randInt(4, equationMaxLevel) - 1]()
  }

  return () => LEVEL_GENERATORS[randInt(1, safeLevel) - 1]()
}

function formatOperation(op: string) {
  return op
    .replace(/\*/g, ' * ')
    .replace(/\+/g, ' + ')
    .replace(/-/g, ' - ')
    .replace(/\//g, ' / ')
    .replace(/=/g, ' = ')
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
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

const MAX_GENERATION_ATTEMPTS = 60

export function buildNextMathExercise(
  recentOps: Array<string | null | undefined>,
  level = 1,
  idiomaIngles = false,
  focus: MathPracticeFocus = 'general'
): MathPracticeExercise {
  const recentSet = new Set(
    recentOps.map((op) => normalizePracticeOperation(op)).filter(Boolean)
  )
  const generate = exerciseGeneratorFor(level, focus)

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const op = generate()
    const key = normalizePracticeOperation(op)
    if (key && !recentSet.has(key) && isSafeCanonicalOperation(op) && solveOperation(op) !== null) {
      return { op, text: exerciseText(op, idiomaIngles) }
    }
  }

  // Con el rango de valores de los generadores esto es extremadamente
  // improbable, pero siempre debe devolverse un ejercicio utilizable.
  let op = generate()
  let guard = 0
  while (recentSet.has(normalizePracticeOperation(op)) && guard < 200) {
    op = generate()
    guard += 1
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

  const pideSumaResta = /\b(suma|sumas|sumar|adicion|resta|restas|restar|sustraccion|addition|subtraction|add|subtract)\b/.test(normalized)
  const pideMultDiv = /\b(multiplicaci[oa]n|multiplicar|division|dividir|producto|cociente|multiplication|divide|divid[ei]ng)\b/.test(normalized)

  if (pideSumaResta && !pideMultDiv) return 'suma_resta'
  if (pideMultDiv && !pideSumaResta) return 'multiplicacion_division'

  return 'general'
}

const ENFOQUES_PRACTICA_VALIDOS: MathPracticeFocus[] = ['equation', 'decimal', 'suma_resta', 'multiplicacion_division']

// El historial que llega al backend es una ventana corta (ultimos 6 mensajes),
// asi que a partir del 3er-4to ejercicio la frase original ("sumas y restas")
// ya no esta en esa ventana. Si el turno actual no trae una senal clara, se
// conserva el enfoque que el alumno ya habia pedido antes en la sesion.
export function resolveMathPracticeFocus(
  textosActuales: Array<string | null | undefined>,
  enfoquePersistido: unknown
): MathPracticeFocus {
  const inferido = inferMathPracticeFocus(textosActuales)
  if (inferido !== 'general') return inferido
  if (ENFOQUES_PRACTICA_VALIDOS.includes(enfoquePersistido as MathPracticeFocus)) {
    return enfoquePersistido as MathPracticeFocus
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
