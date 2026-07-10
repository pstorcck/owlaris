import { evaluate } from 'mathjs'

const NUMERO_ES_REFERENCIA_NO_RESPUESTA = /\b(grado|grade|tema|unidad|unit|nivel|level|cap[ií]tulo|chapter|lecci[oó]n|lesson|p[aá]gina|page|grupo|curso|course)\s+-?\d+(?:[.,]\d+)?\b/i

const UNIDADES: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
  seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
  dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20,
}

const DECENAS: Record<string, number> = {
  veinti: 20, treinta: 30, cuarenta: 40, cincuenta: 50,
  sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
}

function normalizeWordNumberText(value: string) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function generarNumerosEnPalabras(): Record<string, number> {
  const mapa: Record<string, number> = {}
  const agregar = (clave: string, valor: number) => {
    const normalizada = normalizeWordNumberText(clave)
    mapa[normalizada] = valor
    mapa[normalizada.replace(/\s+/g, '')] = valor
  }

  for (const [palabra, valor] of Object.entries(UNIDADES)) agregar(palabra, valor)
  for (const [palabra, valor] of Object.entries(DECENAS)) {
    if (palabra === 'veinti') continue
    agregar(palabra, valor)
  }

  // 21-29: "veintiuno", "veinti uno", "veinte y uno"
  for (const [unidad, valorUnidad] of Object.entries(UNIDADES)) {
    if (valorUnidad < 1 || valorUnidad > 9) continue
    agregar(`veinti${unidad}`, 20 + valorUnidad)
    agregar(`veinti ${unidad}`, 20 + valorUnidad)
    agregar(`veinte y ${unidad}`, 20 + valorUnidad)
  }

  // 31-99 (excluyendo decenas exactas y el rango 20-29 ya cubierto): "treinta y uno",
  // "treinta uno", "treintaiuno", "treintiuno".
  const decenasCompuestas: Array<[string, number]> = [
    ['treinta', 30], ['cuarenta', 40], ['cincuenta', 50],
    ['sesenta', 60], ['setenta', 70], ['ochenta', 80], ['noventa', 90],
  ]
  for (const [decenaPalabra, valorDecena] of decenasCompuestas) {
    for (const [unidad, valorUnidad] of Object.entries(UNIDADES)) {
      if (valorUnidad < 1 || valorUnidad > 9) continue
      const total = valorDecena + valorUnidad
      agregar(`${decenaPalabra} y ${unidad}`, total)
      agregar(`${decenaPalabra} ${unidad}`, total)
      const raizDecena = decenaPalabra.replace(/a$/, '')
      agregar(`${raizDecena}ai${unidad}`, total)
      agregar(`${raizDecena}i${unidad}`, total)
    }
  }

  agregar('cien', 100)
  agregar('cien por ciento', 100)

  // Inglés: "thirty one", "twenty nine" — el toggle idiomaIngles del tutor
  // significa que el alumno también puede responder en inglés.
  const unidadesIngles: Record<string, number> = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
    eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
    fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
    nineteen: 19, twenty: 20,
  }
  const decenasIngles: Record<string, number> = {
    thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  }
  for (const [palabra, valor] of Object.entries(unidadesIngles)) agregar(palabra, valor)
  for (const [palabra, valor] of Object.entries(decenasIngles)) agregar(palabra, valor)
  for (const [decenaPalabra, valorDecena] of Object.entries(decenasIngles)) {
    for (const [unidad, valorUnidad] of Object.entries(unidadesIngles)) {
      if (valorUnidad < 1 || valorUnidad > 9) continue
      const total = valorDecena + valorUnidad
      agregar(`${decenaPalabra} ${unidad}`, total)
      agregar(`${decenaPalabra}-${unidad}`, total)
    }
  }
  agregar('one hundred', 100)

  return mapa
}

const NUMEROS_EN_PALABRAS = generarNumerosEnPalabras()

export function parseSpanishNumberWord(texto: string): number | null {
  const normalizado = normalizeWordNumberText(texto).replace(/[^a-z\s]/g, '').trim()
  if (!normalizado) return null
  if (normalizado in NUMEROS_EN_PALABRAS) return NUMEROS_EN_PALABRAS[normalizado]
  const squished = normalizado.replace(/\s+/g, '')
  if (squished in NUMEROS_EN_PALABRAS) return NUMEROS_EN_PALABRAS[squished]
  return null
}

function resolverOperandoTextoONumero(token: string): number | null {
  const directo = parseNumericAnswerToken(token.trim())
  if (directo !== null) return directo
  return parseSpanishNumberWord(token)
}

// Solo frases completas y simples tipo "la mitad de 22", "10 más 4" — se
// evalúa el mensaje completo, no una subcadena dentro de una oración larga,
// para no arriesgar falsos positivos como los demás bugs de hoy.
export function parseExpresionEquivalente(texto: string): number | null {
  const s = normalizeWordNumberText(texto).replace(/[¿?¡!.]+$/g, '').trim()
  if (!s || s.split(/\s+/).length > 8) return null

  const operandoToken = '([a-z]+(?:\\s+y\\s+[a-z]+)?|-?\\d+(?:[.,]\\d+)?)'

  const mitad = s.match(new RegExp(`^la\\s+mitad\\s+de\\s+${operandoToken}$`))
  if (mitad) {
    const n = resolverOperandoTextoONumero(mitad[1])
    return n === null ? null : n / 2
  }

  const doble = s.match(new RegExp(`^el\\s+doble\\s+de\\s+${operandoToken}$`))
  if (doble) {
    const n = resolverOperandoTextoONumero(doble[1])
    return n === null ? null : n * 2
  }

  const triple = s.match(new RegExp(`^el\\s+triple\\s+de\\s+${operandoToken}$`))
  if (triple) {
    const n = resolverOperandoTextoONumero(triple[1])
    return n === null ? null : n * 3
  }

  const cuadrado = s.match(new RegExp(`^${operandoToken}\\s+al\\s+cuadrado$`))
  if (cuadrado) {
    const n = resolverOperandoTextoONumero(cuadrado[1])
    return n === null ? null : n * n
  }

  const cubo = s.match(new RegExp(`^${operandoToken}\\s+al\\s+cubo$`))
  if (cubo) {
    const n = resolverOperandoTextoONumero(cubo[1])
    return n === null ? null : n * n * n
  }

  const dividido = s.match(new RegExp(`^${operandoToken}\\s+dividid[oa]\\s+(?:entre|por)\\s+${operandoToken}$`)) ||
    s.match(new RegExp(`^${operandoToken}\\s+entre\\s+${operandoToken}$`))
  if (dividido) {
    const a = resolverOperandoTextoONumero(dividido[1])
    const b = resolverOperandoTextoONumero(dividido[2])
    if (a === null || b === null || b === 0) return null
    return a / b
  }

  const multiplicado = s.match(new RegExp(`^${operandoToken}\\s+por\\s+${operandoToken}$`))
  if (multiplicado) {
    const a = resolverOperandoTextoONumero(multiplicado[1])
    const b = resolverOperandoTextoONumero(multiplicado[2])
    if (a === null || b === null) return null
    return a * b
  }

  const mas = s.match(new RegExp(`^${operandoToken}\\s+m[aá]s\\s+${operandoToken}$`))
  if (mas) {
    const a = resolverOperandoTextoONumero(mas[1])
    const b = resolverOperandoTextoONumero(mas[2])
    if (a === null || b === null) return null
    return a + b
  }

  const menos = s.match(new RegExp(`^${operandoToken}\\s+menos\\s+${operandoToken}$`))
  if (menos) {
    const a = resolverOperandoTextoONumero(menos[1])
    const b = resolverOperandoTextoONumero(menos[2])
    if (a === null || b === null) return null
    return a - b
  }

  return null
}

export type MathEvaluation = {
  estado: string
  feedback: string
  correctAnswer: number | null
  op: string | null
  guardActivado: boolean
  pasoIntermedio?: boolean
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

// Hallazgo real (QA Ronda 3, 2026-07-10, confirmado con 2 PDFs reales
// descargados): el modelo a veces etiqueta un problema de palabras recién
// escrito con un [OP: ...] que en realidad pertenece a un ejercicio
// anterior — probablemente porque el ejercicio pendiente se le muestra
// como contexto justo antes de escribir uno nuevo, y lo reutiliza por
// error en vez de calcular uno fresco para el problema que acaba de
// redactar. Esto hace que una respuesta correcta se califique como
// incorrecta contra un ejercicio que el alumno nunca vio. Se verifica que
// al menos uno de los números de la operación etiquetada aparezca en el
// texto visible del problema — si ninguno coincide, la etiqueta es
// sospechosa y no debe usarse como verdad para calificar.
function extraerNumeros(texto: string): number[] {
  const matches = String(texto || '').match(/-?\d+(?:\.\d+)?/g) || []
  return matches.map(Number)
}

export function opCoincideConTexto(op: string | null, textoVisible: string): boolean {
  if (!op) return false
  const numerosOp = extraerNumeros(op)
  if (numerosOp.length === 0) return true
  const numerosTexto = new Set(extraerNumeros(textoVisible))
  return numerosOp.some((n) => numerosTexto.has(n))
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
  const s = String(respuesta)
    .trim()
    .toLowerCase()
    .replace(/[¿?¡!]+$/g, '')
    .trim()

  // Frases equivalentes completas ("la mitad de 22", "10 más 4") y números
  // escritos en palabras ("treinta y uno", "veintinueve") — solo se acepta
  // el mensaje completo, nunca una subcadena dentro de una oración más
  // larga, para no repetir el patrón de falsos positivos de hoy.
  const equivalente = parseExpresionEquivalente(s)
  if (equivalente !== null) return equivalente

  const numeroEnPalabras = parseSpanishNumberWord(s)
  if (numeroEnPalabras !== null) return numeroEnPalabras

  // Cubre "x = 6", "x=6", "x es 6", "x vale 6", "x es igual a 6" — el alumno
  // no siempre escribe el signo "=", así que no basta con depender del caso
  // de respaldo (un único número suelto en todo el mensaje).
  const variableAssignments = Array.from(s.matchAll(/(?:^|[^\d])x\s*(?:=|es(?:\s+igual\s+a)?|vale)\s*(-?\d+(?:[.,]\d+)?(?:\s*\/\s*-?\d+(?:[.,]\d+)?)?)/gi))
  if (variableAssignments.length > 0) return parseNumericAnswerToken(variableAssignments[variableAssignments.length - 1][1])

  const direct = s.match(/^(?:x\s*=\s*)?(-?\d+(?:[.,]\d+)?(?:\s*\/\s*-?\d+(?:[.,]\d+)?)?)[\s.]*$/i)
  if (direct) return parseNumericAnswerToken(direct[1])

  const labeled = Array.from(s.matchAll(/\b(?:respuesta|resultado|answer|result)\s*(?:final|correcta|correct)?\s*(?:es|is|:|=)?\s*(-?\d+(?:[.,]\d+)?(?:\s*\/\s*-?\d+(?:[.,]\d+)?)?)/gi))
  if (labeled.length > 0) return parseNumericAnswerToken(labeled[labeled.length - 1][1])

  if (!/[x]/i.test(s)) {
    const equations = Array.from(s.matchAll(/=\s*(-?\d+(?:[.,]\d+)?(?:\s*\/\s*-?\d+(?:[.,]\d+)?)?)/g))
    if (equations.length > 0) return parseNumericAnswerToken(equations[equations.length - 1][1])
  }

  // Bug real: "Dime los temas de Science Grade 8" tiene un solo número
  // suelto (8), y el respaldo de "un único número en todo el mensaje" lo
  // extraía como si fuera la respuesta al ejercicio activo. Un número que
  // acompaña a una palabra de referencia (grado, tema, unidad, lección...)
  // casi nunca es una respuesta matemática — es parte de un nombre de
  // materia/grado o una selección de lista, que se manejan en otro lugar.
  if (NUMERO_ES_REFERENCIA_NO_RESPUESTA.test(s)) return null

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
  // "Educacion Fisica" / "Physical Education" (deportes) contiene "fisica"/
  // "physical" pero NO es una materia numerica — el protocolo matematico
  // determinístico no debe activarse ahi. Se excluye antes de la deteccion.
  if (/educacion fisica|physical education/.test(s)) return false
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

function formatNumberForFeedback(n: number): string {
  const rounded = Math.round(n)
  const value = Math.abs(n - rounded) < 0.000001 ? rounded : n
  return Number(value.toFixed(6)).toString()
}

function evaluateEquivalentEquationStep(
  originalOp: string | null,
  studentAnswer: string,
  correctAnswer: number | null,
): { stepOp: string; stepSolution: number } | null {
  if (!originalOp || correctAnswer === null) return null
  const original = normalizeOperation(originalOp)
  if (!original.includes('=') || !/[x]/i.test(original)) return null

  const stepOp = inferCanonicalOperationFromText(studentAnswer)
  if (!stepOp || !stepOp.includes('=') || !/[x]/i.test(stepOp)) return null

  const stepSolution = solveOperation(stepOp)
  if (stepSolution === null) return null

  return Math.abs(stepSolution - correctAnswer) < 0.001
    ? { stepOp, stepSolution }
    : null
}

function generateIntermediateStepFeedback(studentAnswer: string, idiomaIngles: boolean): string {
  const hasUnsimplifiedRightSide = /=\s*[^=\n]*[+\-*/]/.test(studentAnswer.replace(/−/g, '-'))
  if (idiomaIngles) {
    return hasUnsimplifiedRightSide
      ? 'That step is valid. You kept an equivalent equation. Now simplify the right side and continue isolating x. What value of x do you get?'
      : 'That step is valid. You kept an equivalent equation. Now use the inverse operation to isolate x. What value of x do you get?'
  }
  return hasUnsimplifiedRightSide
    ? 'Ese paso es válido. Mantienes una ecuación equivalente. Ahora simplifica el lado derecho y continúa despejando x. ¿Qué valor de x obtienes?'
    : 'Ese paso es válido. Mantienes una ecuación equivalente. Ahora usa la operación inversa para despejar x. ¿Qué valor de x obtienes?'
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
        ? `Not yet. ${hint} Try again with that step.`
        : `Todavía no. ${hint} Intenta de nuevo con ese paso.`
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

export function buildGuidedMathHint(op: string | null | undefined, idiomaIngles: boolean): string {
  const clean = normalizeOperation(op || '')
  if (clean.includes('=') && /x/i.test(clean)) {
    // Hallazgo real (auditoría QA 2026-07-07): el mismo mensaje genérico se
    // daba para una ecuación con paréntesis/distribución y para una con la
    // incógnita en ambos lados — dos errores de naturaleza distinta que
    // necesitan una pista distinta.
    const [ladoIzquierdo = '', ladoDerecho = ''] = clean.split('=')
    if (clean.includes('(')) {
      return idiomaIngles
        ? 'First distribute the multiplication into the parentheses, then continue isolating x.'
        : 'Primero distribuye la multiplicación dentro del paréntesis y luego sigue despejando x.'
    }
    if (/x/i.test(ladoIzquierdo) && /x/i.test(ladoDerecho)) {
      return idiomaIngles
        ? 'First move all the x terms to one side of the equation and the plain numbers to the other, then isolate x.'
        : 'Primero junta los términos con x en un mismo lado de la ecuación y los números en el otro, y luego despeja x.'
    }
    // Hallazgo real (QA amplia 2026-07-08): coeficiente negativo de x caía en
    // el mensaje genérico — el signo negativo es justo el paso donde más se
    // equivocan, necesita su propia pista.
    if (/-\d*x/i.test(clean)) {
      return idiomaIngles
        ? 'The coefficient of x is negative — after isolating it, remember that dividing by a negative number can flip the meaning of the sign. Check the sign carefully on both sides.'
        : 'El coeficiente de x es negativo — al despejarla, recuerda que dividir entre un número negativo afecta el signo. Revisa con cuidado el signo en ambos lados.'
    }
    // Hallazgo real (QA amplia 2026-07-08): una ecuación con decimales caía
    // en el mismo mensaje genérico que coeficiente negativo, sin ninguna
    // pista sobre el manejo de decimales.
    if (/\d\.\d/.test(clean)) {
      return idiomaIngles
        ? 'This equation has decimals — solve it with the same steps as usual, just keep the decimal point aligned in each operation.'
        : 'Esta ecuación tiene decimales — resuélvela con los mismos pasos de siempre, solo cuida mantener el punto decimal alineado en cada operación.'
    }
    return idiomaIngles
      ? 'First identify what operation is affecting x, then use the inverse operation to isolate it.'
      : 'Primero identifica qué operación afecta a x y luego usa la operación inversa para dejarla sola.'
  }
  // Hallazgo real (QA amplia 2026-07-08): sumar/restar fracciones con
  // distinto denominador caía en el chequeo genérico de "orden de
  // operaciones" (por tener '/' junto con '+' o '-'), una pista ajena al
  // error real de fracciones.
  if (/\d+\/\d+\s*[+\-]\s*\d+\/\d+/.test(clean)) {
    return idiomaIngles
      ? 'For adding or subtracting fractions, first find a common denominator, then add or subtract only the numerators.'
      : 'Para sumar o restar fracciones, primero busca un denominador común, y luego suma o resta solo los numeradores.'
  }
  if (/\d+\.\d+/.test(clean) && clean.includes('*')) {
    return idiomaIngles
      ? 'For decimal multiplication, treat the decimal as a fraction or percentage: 0.15 means 15/100, so multiply by 15 and then divide by 100.'
      : 'Para multiplicar con decimales, piensa el decimal como fracción o porcentaje: 0.15 significa 15/100, así que multiplica por 15 y luego divide entre 100.'
  }
  if (clean.includes('%')) {
    return idiomaIngles
      ? 'For a percentage, first change it to a decimal or fraction, then multiply by the quantity.'
      : 'Para un porcentaje, primero conviértelo a decimal o fracción y luego multiplícalo por la cantidad.'
  }
  // Hallazgo real (QA ~80 pruebas, 2026-07-08): un ejercicio de exponentes
  // (ej. 3^4*3^2) caía en "multiplicación" o "orden de operaciones" según
  // qué otros símbolos tuviera al lado — ninguna pista mencionaba la
  // propiedad de exponentes que realmente hace falta.
  if (clean.includes('^')) {
    return idiomaIngles
      ? 'Remember that when you multiply powers with the same base, you add the exponents; when you divide them, you subtract the exponents. Work through the base and exponent separately.'
      : 'Recuerda que al multiplicar potencias de la misma base, se suman los exponentes; al dividirlas, se restan. Trabaja la base y el exponente por separado.'
  }
  // Hallazgo real (QA amplia 2026-07-08): una expresión con paréntesis pero
  // sin ecuación (ej. 2*(3+5)-4) caía en el chequeo genérico de "orden de
  // operaciones" en vez de una pista específica sobre resolver el paréntesis
  // primero.
  if (clean.includes('(')) {
    return idiomaIngles
      ? 'First solve what is inside the parentheses, then continue with the rest of the operation.'
      : 'Primero resuelve lo que está dentro del paréntesis, y luego continúa con el resto de la operación.'
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
  let estado = buildEvaluationState(comparison, correctAnswer !== null)
  const pasoIntermedio = estado !== 'correcto' && estado !== 'equivalente'
    ? evaluateEquivalentEquationStep(op, studentAnswer, correctAnswer)
    : null
  if (pasoIntermedio) estado = 'paso_correcto'
  const studentFeedbackValue = studentN !== null ? formatNumberForFeedback(studentN) : studentAnswer
  const feedbackBase = pasoIntermedio
    ? generateIntermediateStepFeedback(studentAnswer, idiomaIngles)
    : generatePedagogicalFeedback(estado, studentFeedbackValue, correctAnswer, idiomaIngles, op)
  const { feedback, guardActivado } = contradictionGuard(feedbackBase, estado, studentN, correctAnswer, idiomaIngles)

  logEvaluation({ op, correctAnswer, studentAnswer, studentN, estado, pasoIntermedio: !!pasoIntermedio, guardActivado })

  return { estado, feedback, correctAnswer, op, guardActivado, pasoIntermedio: !!pasoIntermedio }
}

function selectRelevantMathText(text: string): string {
  const normalized = text.replace(/\r/g, '\n')
  const questionChunks = Array.from(normalized.matchAll(/¿?[^?]*\?/g))
    .map((match) => match[0].trim())
    .filter((chunk) => looksLikeMathPracticePrompt(chunk))

  if (questionChunks.length > 0) return questionChunks[questionChunks.length - 1]

  // Hallazgo real (auditoría QA 2026-07-07, seguimiento): cuando el modelo
  // presenta el ejercicio en una línea y la instrucción ("Intenta
  // resolverlo y dime el valor de x.") en la línea siguiente, recortar a
  // SOLO la línea que contiene la palabra clave descartaba la línea con la
  // ecuación real — inferCanonicalOperationFromText nunca la veía. Si hay
  // una señal de práctica en cualquier parte del texto, se usa el texto
  // completo (las expresiones/ecuaciones se extraen después con sus propias
  // reglas, ya bastante específicas), en vez de una sola línea.
  const tienePalabraClave = /(?:cu[aá]nto|resuelve|calcula|resultado|what is|solve|calculate)/i.test(normalized)
  if (tienePalabraClave) return normalized
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
  // Hallazgo real (auditoría QA 2026-07-07): exigir "?" dejaba sin detectar
  // ejercicios que el modelo presenta en modo imperativo, sin signo de
  // interrogación (ej. "Intenta resolverlo y dime el valor de x."). Cuando
  // eso pasaba y el modelo tampoco incluía el tag [OP:], el ejercicio nunca
  // quedaba marcado como pendiente — así que la siguiente respuesta del
  // alumno se evaluaba contra un ejercicio viejo y ya abandonado, dando una
  // pista que no correspondía al ejercicio realmente en pantalla.
  const lower = text.toLowerCase()
  return /(cu[aá]nto|resuelve|resu[eé]lvelo|resolverlo|calcula|resultado|intenta|dame tu respuesta|el valor de|what is|solve|calculate|answer)/i.test(lower)
}

export function hasIncorrectVerdict(text: string): boolean {
  const lower = text.toLowerCase()
  return lower.includes('incorrecto') ||
    lower.includes('incorrect') ||
    lower.includes('no es correcto') ||
    lower.includes('not correct')
}
