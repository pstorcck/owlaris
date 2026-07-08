import {
  inferCanonicalOperationFromText,
  isSafeCanonicalOperation,
  solveOperation,
} from './mathSafety'

export type MathPracticeExercise = {
  text: string
  op: string
}

export type MathPracticeFocus = 'general' | 'equation' | 'decimal' | 'suma_resta' | 'multiplicacion_division' | 'suma' | 'resta' | 'multiplicacion' | 'division' | 'geometria'

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

// Nombre de tema legible para reportes/registros, a partir de la operación
// canónica evaluada — NUNCA a partir de la respuesta libre del alumno (un
// número o "perdon 46" no es un tema).
//
// Hallazgo real (2026-07-08): un ejercicio de perímetro ("2*(30+15)") es
// simbólicamente indistinguible de un ejercicio genérico de orden de
// operaciones — ambos mezclan +/- con */. Cuando se conoce el enfoque de
// práctica que generó el ejercicio (focus === 'geometria'), se usa ese dato
// en vez de adivinar por los símbolos de la operación.
export function describeMathTopic(op: string | null | undefined, idiomaIngles = false, focus?: MathPracticeFocus | null): string {
  if (focus === 'geometria') return idiomaIngles ? 'Perimeter and area' : 'Perímetro y área'
  const clean = String(op || '')
  if (/x/i.test(clean) && clean.includes('=')) return idiomaIngles ? 'Equations' : 'Ecuaciones'
  if (/\d+\.\d+|%/.test(clean)) return idiomaIngles ? 'Decimals and percentages' : 'Decimales y porcentajes'
  if (/[+\-]/.test(clean) && /[*/]/.test(clean)) return idiomaIngles ? 'Order of operations' : 'Orden de operaciones'
  if (/[+-]/.test(clean)) return idiomaIngles ? 'Addition and subtraction' : 'Suma y resta'
  if (/[*/]/.test(clean)) return idiomaIngles ? 'Multiplication and division' : 'Multiplicación y división'
  return idiomaIngles ? 'Math practice' : 'Práctica de matemática'
}

// Deriva un enfoque puro (para buildNextMathExercise) a partir de una
// operación canónica ya evaluada — usado para proponer práctica enfocada en
// "Revisemos mis errores" a partir del error real más reciente, no de una
// palabra clave que el alumno tenga que volver a escribir.
export function inferMathPracticeFocusFromOperation(op: string | null | undefined): MathPracticeFocus {
  const clean = String(op || '')
  if (/x/i.test(clean) && clean.includes('=')) return 'equation'
  if (/\d+\.\d+|%/.test(clean)) return 'decimal'
  const tieneSuma = clean.includes('+')
  const tieneResta = /-/.test(clean)
  const tieneMult = clean.includes('*')
  const tieneDiv = clean.includes('/')
  if ((tieneSuma || tieneResta) && (tieneMult || tieneDiv)) return 'general'
  if (tieneSuma && tieneResta) return 'suma_resta'
  if (tieneSuma) return 'suma'
  if (tieneResta) return 'resta'
  if (tieneMult && tieneDiv) return 'multiplicacion_division'
  if (tieneMult) return 'multiplicacion'
  if (tieneDiv) return 'division'
  return 'general'
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

// Cuando el alumno pide solo "sumas" (o solo "restas"), debe practicar
// exclusivamente esa operación — no una mezcla, aunque sea de la misma familia.
function generateSuma(level: number): string {
  const span = 30 + level * 25
  return `${randInt(4, span)}+${randInt(3, span)}`
}

function generateResta(level: number): string {
  const span = 30 + level * 25
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

// Igual que suma/resta: pedir solo "multiplicaciones" (o solo "divisiones")
// no debe mezclarse con la otra operación de la misma familia.
function generateMultiplicacion(level: number): string {
  const maxFactor = Math.min(50, 12 + level * 6)
  return `${randInt(2, maxFactor)}*${randInt(2, maxFactor)}`
}

function generateDivision(level: number): string {
  const maxFactor = Math.min(50, 12 + level * 6)
  const b = randInt(2, maxFactor); const k = randInt(2, maxFactor)
  return `${b * k}/${b}`
}

function generateDecimal(): string {
  return LEVEL_GENERATORS[2]()
}

function exerciseGeneratorFor(level: number, focus: MathPracticeFocus): () => string {
  const safeLevel = Math.min(8, Math.max(1, Number.isFinite(level) ? Math.round(level) : 1))

  if (focus === 'suma_resta') return () => generateSumaResta(safeLevel)
  if (focus === 'suma') return () => generateSuma(safeLevel)
  if (focus === 'resta') return () => generateResta(safeLevel)
  if (focus === 'multiplicacion_division') return () => generateMultDiv(safeLevel)
  if (focus === 'multiplicacion') return () => generateMultiplicacion(safeLevel)
  if (focus === 'division') return () => generateDivision(safeLevel)
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

// Hallazgo real (2026-07-08): un alumno que cambiaba de tema a "Medición de
// perímetros y áreas" recibía UN ejercicio de perímetro (escrito por el
// modelo de IA), pero el siguiente "ejercicio distinto" venía del generador
// determinístico de abajo, que solo sabía producir aritmética pura — sin
// ninguna rama de geometría, el enfoque quedaba secuestrado por palabras
// como "sumar" en la propia explicación del perímetro ("sumar los lados") y
// terminaba generando sumas sueltas, un tema completamente ajeno. Estos
// generadores dan a "perímetro y área" la misma garantía determinística que
// ya tienen suma/resta/multiplicación/división: cada llamada produce un
// ejercicio nuevo de esa misma familia, nunca genérico.
function generateGeometriaExercise(idiomaIngles: boolean): { op: string; text: string } {
  const figura: 'rectangulo' | 'cuadrado' = randInt(0, 1) === 0 ? 'rectangulo' : 'cuadrado'
  const medida: 'perimetro' | 'area' = randInt(0, 1) === 0 ? 'perimetro' : 'area'

  if (figura === 'rectangulo') {
    const largo = randInt(4, 30)
    const ancho = randInt(2, Math.max(2, largo - 1))
    const op = medida === 'perimetro' ? `2*(${largo}+${ancho})` : `${largo}*${ancho}`
    const text = idiomaIngles
      ? medida === 'perimetro'
        ? `Try this different exercise: imagine a rectangle with a length of ${largo} cm and a width of ${ancho} cm. What is its perimeter?`
        : `Try this different exercise: imagine a rectangle with a length of ${largo} cm and a width of ${ancho} cm. What is its area?`
      : medida === 'perimetro'
        ? `Intenta este ejercicio distinto: imagina un rectángulo con un largo de ${largo} cm y un ancho de ${ancho} cm. ¿Cuál es su perímetro?`
        : `Intenta este ejercicio distinto: imagina un rectángulo con un largo de ${largo} cm y un ancho de ${ancho} cm. ¿Cuál es su área?`
    return { op, text }
  }

  const lado = randInt(3, 30)
  const op = medida === 'perimetro' ? `4*${lado}` : `${lado}*${lado}`
  const text = idiomaIngles
    ? medida === 'perimetro'
      ? `Try this different exercise: imagine a square with a side of ${lado} cm. What is its perimeter?`
      : `Try this different exercise: imagine a square with a side of ${lado} cm. What is its area?`
    : medida === 'perimetro'
      ? `Intenta este ejercicio distinto: imagina un cuadrado con un lado de ${lado} cm. ¿Cuál es su perímetro?`
      : `Intenta este ejercicio distinto: imagina un cuadrado con un lado de ${lado} cm. ¿Cuál es su área?`
  return { op, text }
}

function exerciseText(op: string, idiomaIngles: boolean) {
  const visible = formatOperation(op)
  if (op.includes('=') && /x/i.test(op)) {
    return idiomaIngles
      ? `Try this different equation: ${visible}. What is x?`
      : `Intenta esta ecuación distinta: ${visible}. ¿Cuánto vale x?`
  }
  return idiomaIngles
    ? `Try this different exercise: ${visible}. What is the result?`
    : `Intenta este ejercicio distinto: ${visible}. ¿Cuál es el resultado?`
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

  // Geometría (perímetro y área) tiene su propio texto narrativo por
  // ejercicio (rectángulo/cuadrado con dimensiones), no el formato genérico
  // "X op Y" de exerciseText — cada generador ya devuelve {op, text} listo.
  if (focus === 'geometria') {
    for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
      const exercise = generateGeometriaExercise(idiomaIngles)
      const key = normalizePracticeOperation(exercise.op)
      if (key && !recentSet.has(key) && isSafeCanonicalOperation(exercise.op) && solveOperation(exercise.op) !== null) {
        return exercise
      }
    }
    let exercise = generateGeometriaExercise(idiomaIngles)
    let guard = 0
    while (recentSet.has(normalizePracticeOperation(exercise.op)) && guard < 200) {
      exercise = generateGeometriaExercise(idiomaIngles)
      guard += 1
    }
    return exercise
  }

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
    /\b(ecuacion|ecuaciones|equation|equations|algebra|variable|variables)\b/.test(normalized) ||
    // "despej" es la raiz de despejar/despejando/despeje/despejamos, etc. —
    // sin limite de palabra al final para cubrir cualquier conjugacion.
    /\bdespej\w*/.test(normalized) ||
    /[0-9)]\s*\*?\s*x\s*[+\-*/=]/i.test(normalized) ||
    /x\s*[+\-*/=]/i.test(normalized)
  ) {
    return 'equation'
  }

  if (/\b(decimal|decimales|porcentaje|porcentajes|percent(age)?s?|fraccion(es)?|fraction(s)?)\b/.test(normalized)) {
    return 'decimal'
  }

  // Hallazgo real (2026-07-08): sin esta rama, la explicación de perímetro
  // ("para calcular el perímetro debes sumar todos los lados") activaba
  // "pideSuma" más abajo y secuestraba el enfoque hacia sumas sueltas, un
  // tema ajeno al que el alumno seguía trabajando. Se revisa ANTES que
  // suma/resta/mult/div para que una palabra de geometría siempre gane
  // sobre una palabra de operación aritmética que aparezca de paso en la
  // misma explicación.
  if (/\b(perimetro(s)?|area(s)?|geometria|rectangulo(s)?|cuadrado(s)?|triangulo(s)?|circulo(s)?)\b/.test(normalized)) {
    return 'geometria'
  }

  // Se distingue "solo sumas" de "solo restas" de "sumas y restas" (y lo
  // mismo para multiplicación/división): pedir únicamente una operación no
  // debe mezclarse con la otra de la misma familia en los ejercicios.
  // Nota: las formas en plural ("multiplicaciones", "divisiones") deben
  // reconocerse igual que el singular — antes "es?" no estaba cubierto y
  // esas frases caían silenciosamente en el enfoque genérico.
  const pideSuma = /\b(suma|sumas|sumar|adicion|addition|add)\b/.test(normalized)
  const pideResta = /\b(resta|restas|restar|sustraccion|subtraction|subtract)\b/.test(normalized)
  const pideMult = /\b(multiplicaci[oa]n(es)?|multiplicar|producto|multiplication|multiply|multiplying)\b/.test(normalized)
  const pideDiv = /\b(division(es)?|dividir|cociente|divide|divid[ei]ng)\b/.test(normalized)

  if (pideSuma && pideResta) return 'suma_resta'
  if (pideSuma && !pideMult && !pideDiv) return 'suma'
  if (pideResta && !pideMult && !pideDiv) return 'resta'
  if (pideMult && pideDiv) return 'multiplicacion_division'
  if (pideMult && !pideSuma && !pideResta) return 'multiplicacion'
  if (pideDiv && !pideSuma && !pideResta) return 'division'

  return 'general'
}

const ENFOQUES_PRACTICA_VALIDOS: MathPracticeFocus[] = ['equation', 'decimal', 'suma_resta', 'multiplicacion_division', 'suma', 'resta', 'multiplicacion', 'division', 'geometria']

// El historial que llega al backend es una ventana corta (ultimos 6 mensajes),
// asi que a partir del 3er-4to ejercicio la frase original ("sumas y restas")
// ya no esta en esa ventana. Si el turno actual no trae una senal clara, se
// conserva el enfoque que el alumno ya habia pedido antes en la sesion.
//
// El primer elemento del arreglo se trata como la peticion ACTUAL del alumno
// y tiene prioridad exclusiva sobre el resto (operacion pendiente, nombre de
// la materia, mensaje anterior del tutor): si por si sola revela un enfoque,
// ese gana. Sin esto, una materia llamada "Algebra I" secuestraba el enfoque
// a 'equation' para siempre (incluso pidiendo "sumas"), y lo mismo pasaba
// cuando el ejercicio pendiente era una ecuacion como "x+5=12" — el texto
// literal de esa operacion tambien activaba la deteccion de 'equation',
// sin importar lo que el alumno acabara de pedir en este turno.
export function resolveMathPracticeFocus(
  textosActuales: Array<string | null | undefined>,
  enfoquePersistido: unknown
): MathPracticeFocus {
  const [actual, ...contexto] = textosActuales
  const inferidoActual = inferMathPracticeFocus([actual])
  if (inferidoActual !== 'general') return inferidoActual

  const inferidoContexto = inferMathPracticeFocus(contexto)
  if (inferidoContexto !== 'general') return inferidoContexto

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
