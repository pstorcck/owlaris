import assert from 'node:assert/strict'
import {
  buildAnalogousWorkedExample,
  buildNextMathExercise,
  calculateAdaptiveDifficulty,
  collectRecentMathOperations,
  inferMathPracticeFocus,
  isWorkedExampleRequest,
  isRepeatedMathOperation,
  normalizePracticeOperation,
  resolveMathPracticeFocus,
} from '../src/lib/mathPractice'
import {
  handleMathEvaluation,
  inferCanonicalOperationFromText,
  isLikelyNumericSubject,
  solveOperation,
} from '../src/lib/mathSafety'

type Failure = { name: string; message: string }

const failures: Failure[] = []
let total = 0

function test(name: string, fn: () => void) {
  total += 1
  try {
    fn()
  } catch (error) {
    failures.push({ name, message: error instanceof Error ? error.message : String(error) })
  }
}

async function testAsync(name: string, fn: () => Promise<void>) {
  total += 1
  try {
    await fn()
  } catch (error) {
    failures.push({ name, message: error instanceof Error ? error.message : String(error) })
  }
}

function numericAnswer(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(4)
}

async function main() {
  const subjects = [
    'Matemática',
    'Matematicas',
    'Mineduc - Matemática',
    'Math',
    'Math 6',
    'Math 7',
    'Math 8',
    'Math Grade 6',
    'Mathematics Grade 7',
    'Algebra I',
    'Geometry',
  ]

  const recentSeed = [
    '¿Cuánto es 7 + 5?',
    'Resuelve: 8 + 3 * 2',
    'Resuelve: x + 5 = 12',
    'Solve: 3*x + 5 = 20',
    'Try this different exercise: 24 / 3 + 5. What is the result?',
  ]
  const recentOps = collectRecentMathOperations(recentSeed)

  for (let i = 0; i < 220; i += 1) {
    const subject = subjects[i % subjects.length]
    test(`numeric-subject-${i}`, () => {
      assert.equal(isLikelyNumericSubject(subject), true)
    })
  }

  for (let i = 0; i < 300; i += 1) {
    const level = (i % 8) + 1
    const history = recentOps.slice(0, (i % recentOps.length) + 1)
    const next = buildNextMathExercise(history, level, i % 2 === 0)
    test(`fresh-exercise-${i}`, () => {
      assert.equal(isRepeatedMathOperation(next.op, history), false, `repeated ${next.op}`)
      assert.equal(isRepeatedMathOperation(history[history.length - 1], history), true)
      assert.equal(normalizePracticeOperation(next.op).length > 0, true)
      assert.equal(isLikelyNumericSubject(subjects[i % subjects.length]), true)
      assert.notEqual(solveOperation(next.op), null, `unsolved ${next.op}`)
      const inferred = inferCanonicalOperationFromText(next.text)
      assert.equal(normalizePracticeOperation(inferred), normalizePracticeOperation(next.op))
    })
  }

  const productionRepeatedOps = ['0.15*60', '72/8', '20-4*2', '2*(x+3)=18']
  const productionSessionOps = [...productionRepeatedOps]
  for (let i = 0; i < 20; i += 1) {
    const next = buildNextMathExercise(productionSessionOps, 6, false)
    test(`production-session-no-repeat-${i}`, () => {
      assert.equal(isRepeatedMathOperation(next.op, productionSessionOps), false, `repeated ${next.op}`)
      assert.notEqual(solveOperation(next.op), null, `unsolved ${next.op}`)
    })
    productionSessionOps.push(next.op)
  }

  const algebraSessionOps = ['x+5=12']
  for (let i = 0; i < 30; i += 1) {
    const focus = inferMathPracticeFocus(['Matemática', 'álgebra', 'Resuelve: x + 5 = 12', algebraSessionOps[algebraSessionOps.length - 1]])
    const next = buildNextMathExercise(algebraSessionOps, (i % 4) + 1, false, focus)
    test(`algebra-session-stays-on-equations-${i}`, () => {
      assert.equal(focus, 'equation')
      assert.match(next.op, /x/i)
      assert.match(next.op, /=/)
      assert.equal(isRepeatedMathOperation(next.op, algebraSessionOps), false, `repeated ${next.op}`)
      assert.notEqual(solveOperation(next.op), null, `unsolved ${next.op}`)
    })
    algebraSessionOps.push(next.op)
  }

  for (let i = 0; i < 20; i += 1) {
    const activeOp = i % 2 === 0 ? '2*(x+3)=18' : '2*x-4=10'
    const example = buildAnalogousWorkedExample(activeOp, i % 3 === 0)
    test(`analog-example-does-not-solve-active-${i}`, () => {
      assert.notEqual(normalizePracticeOperation(example.op), normalizePracticeOperation(activeOp))
      assert.doesNotMatch(example.text, /2\s*\*\s*\(\s*x\s*\+\s*3\s*\)\s*=\s*18/i)
      assert.doesNotMatch(example.text, /\bx\s*=\s*6\b/i)
      assert.notEqual(solveOperation(example.op), solveOperation(activeOp))
    })
  }

  const exampleRequests = [
    'Explícame con un ejemplo',
    'explicame con un ejemplo por favor',
    'Dame un ejemplo parecido',
    'Explain with an example',
    'show me one example',
  ]
  for (let i = 0; i < 20; i += 1) {
    test(`worked-example-request-${i}`, () => {
      assert.equal(isWorkedExampleRequest(exampleRequests[i % exampleRequests.length]), true)
    })
  }

  const difficultyCases = [
    { currentLevel: 1, correctStreak: 4, wrongStreak: 0, tipo: 'mantiene', nivel: 1 },
    { currentLevel: 1, correctStreak: 5, wrongStreak: 0, tipo: 'sube', nivel: 2 },
    { currentLevel: 3, correctStreak: 10, wrongStreak: 0, tipo: 'sube', nivel: 4 },
    { currentLevel: 8, correctStreak: 5, wrongStreak: 0, tipo: 'mantiene', nivel: 8 },
    { currentLevel: 4, correctStreak: 0, wrongStreak: 3, tipo: 'mantiene', nivel: 4 },
    { currentLevel: 4, correctStreak: 0, wrongStreak: 4, tipo: 'baja', nivel: 3 },
    { currentLevel: 4, correctStreak: 0, wrongStreak: 5, tipo: 'mantiene', nivel: 4 },
    { currentLevel: 1, correctStreak: 0, wrongStreak: 4, tipo: 'refuerza', nivel: 1 },
  ] as const

  difficultyCases.forEach((caso, i) => {
    test(`adaptive-difficulty-checkpoint-${i}`, () => {
      const result = calculateAdaptiveDifficulty({ ...caso })
      assert.equal(result.tipo, caso.tipo)
      assert.equal(result.nivel_nuevo, caso.nivel)
    })
  })

  const rollingHistory: string[] = []
  for (let i = 0; i < 212; i += 1) {
    const level = (i % 8) + 1
    const next = buildNextMathExercise(rollingHistory, level, i % 3 === 0)
    test(`rolling-no-immediate-repeat-${i}`, () => {
      assert.equal(isRepeatedMathOperation(next.op, rollingHistory.slice(-12)), false, `repeated ${next.op}`)
    })
    rollingHistory.push(next.op)
    if (rollingHistory.length > 12) rollingHistory.shift()
  }

  for (let i = 0; i < 170; i += 1) {
    const level = (i % 8) + 1
    const next = buildNextMathExercise(rollingHistory, level, i % 2 === 1)
    const answer = solveOperation(next.op)
    assert.notEqual(answer, null, `op without answer: ${next.op}`)
    await testAsync(`fresh-exercise-evaluates-${i}`, async () => {
      const result = await handleMathEvaluation(`${next.text} [OP: ${next.op}]`, numericAnswer(answer!), i % 2 === 1)
      assert.equal(result?.estado, 'correcto')
      assert.equal(result?.correctAnswer !== null, true)
      assert.doesNotMatch(result?.feedback || '', /incorrect|incorrecto/i)
    })
  }

  // ── Enfoque suma/resta y multiplicacion/division ────────────────
  // Bug reportado en produccion: pedir solo "sumas" mezclaba restas en los
  // ejercicios (y viceversa), porque ambas palabras caian en el mismo
  // enfoque combinado 'suma_resta'. Ahora se distinguen tres casos: solo
  // suma, solo resta, y ambas juntas.
  const sumaSoloPhrases = [
    'quiero practicar sumas', 'vamos con suma', 'sumas por favor',
    'quiero sumar', 'practica de adicion', 'addition please',
  ]
  for (let i = 0; i < 20; i += 1) {
    test(`focus-detects-suma-solo-${i}`, () => {
      const focus = inferMathPracticeFocus([sumaSoloPhrases[i % sumaSoloPhrases.length]])
      assert.equal(focus, 'suma')
    })
  }

  const restaSoloPhrases = [
    'quiero practicar restas', 'vamos con resta', 'restas por favor',
    'quiero restar', 'practica de sustraccion', 'subtraction please',
  ]
  for (let i = 0; i < 20; i += 1) {
    test(`focus-detects-resta-solo-${i}`, () => {
      const focus = inferMathPracticeFocus([restaSoloPhrases[i % restaSoloPhrases.length]])
      assert.equal(focus, 'resta')
    })
  }

  const sumaYRestaPhrases = [
    'quiero practicar sumas y restas', 'vamos con suma y resta', 'suma y resta por favor',
    'quiero sumar y restar', 'practica de suma y resta', 'addition and subtraction please',
  ]
  for (let i = 0; i < 20; i += 1) {
    test(`focus-detects-suma-y-resta-${i}`, () => {
      const focus = inferMathPracticeFocus([sumaYRestaPhrases[i % sumaYRestaPhrases.length]])
      assert.equal(focus, 'suma_resta')
    })
  }

  // Igual que suma/resta: pedir solo "multiplicaciones" (o solo "divisiones")
  // no debe mezclarse con la otra operación de la misma familia. También se
  // cubren las formas en plural, que antes caían silenciosamente en 'general'.
  const multSoloPhrases = [
    'quiero practicar multiplicaciones', 'vamos con multiplicacion', 'multiplicaciones por favor',
    'quiero multiplicar', 'el producto de dos numeros', 'multiplication please',
  ]
  for (let i = 0; i < 20; i += 1) {
    test(`focus-detects-mult-solo-${i}`, () => {
      const focus = inferMathPracticeFocus([multSoloPhrases[i % multSoloPhrases.length]])
      assert.equal(focus, 'multiplicacion')
    })
  }

  const divSoloPhrases = [
    'quiero practicar divisiones', 'vamos con division', 'divisiones por favor',
    'quiero dividir', 'el cociente de dos numeros', 'division please',
  ]
  for (let i = 0; i < 20; i += 1) {
    test(`focus-detects-div-solo-${i}`, () => {
      const focus = inferMathPracticeFocus([divSoloPhrases[i % divSoloPhrases.length]])
      assert.equal(focus, 'division')
    })
  }

  const multYDivPhrases = [
    'quiero practicar multiplicacion y division', 'vamos con multiplicacion y division', 'multiplicacion y division por favor',
    'quiero multiplicar y dividir', 'practica de multiplicacion y division', 'multiplication and division please',
  ]
  for (let i = 0; i < 20; i += 1) {
    test(`focus-detects-mult-y-div-${i}`, () => {
      const focus = inferMathPracticeFocus([multYDivPhrases[i % multYDivPhrases.length]])
      assert.equal(focus, 'multiplicacion_division')
    })
  }

  // ── Auditoría proactiva del mismo patrón de bug (formas no cubiertas por
  // la expresión regular) en las categorías "equation" y "decimal". ──
  const equationConjugationPhrases = [
    'quiero despejar la variable', 'ayudame despejando x', 'cual es el despeje aqui',
    'necesito despejamos juntos', 'como despejo esta ecuacion', 'practiquemos despejes',
  ]
  for (let i = 0; i < 18; i += 1) {
    test(`focus-detects-despejar-conjugations-${i}`, () => {
      const focus = inferMathPracticeFocus([equationConjugationPhrases[i % equationConjugationPhrases.length]])
      assert.equal(focus, 'equation')
    })
  }

  const decimalEnglishPluralPhrases = [
    'quiero practicar percentages', 'lets work on percentage problems', 'quiero fractions',
    'practice with fractions please', 'help me with percentage', 'quiero practicar fractions y percentages',
  ]
  for (let i = 0; i < 18; i += 1) {
    test(`focus-detects-decimal-english-plurals-${i}`, () => {
      const focus = inferMathPracticeFocus([decimalEnglishPluralPhrases[i % decimalEnglishPluralPhrases.length]])
      assert.equal(focus, 'decimal')
    })
  }

  for (let i = 0; i < 60; i += 1) {
    const level = (i % 8) + 1
    test(`suma-resta-pool-is-pure-${i}`, () => {
      const next = buildNextMathExercise([], level, false, 'suma_resta')
      assert.doesNotMatch(next.op, /[*/]/, `not pure addition/subtraction: ${next.op}`)
    })
  }

  for (let i = 0; i < 30; i += 1) {
    const level = (i % 8) + 1
    test(`suma-pool-is-pure-${i}`, () => {
      const next = buildNextMathExercise([], level, false, 'suma')
      assert.doesNotMatch(next.op, /[*/-]/, `not pure addition: ${next.op}`)
    })
  }

  for (let i = 0; i < 30; i += 1) {
    const level = (i % 8) + 1
    test(`resta-pool-is-pure-${i}`, () => {
      const next = buildNextMathExercise([], level, false, 'resta')
      assert.doesNotMatch(next.op, /[*/+]/, `not pure subtraction: ${next.op}`)
    })
  }

  for (let i = 0; i < 60; i += 1) {
    const level = (i % 8) + 1
    test(`mult-div-pool-is-pure-${i}`, () => {
      const next = buildNextMathExercise([], level, false, 'multiplicacion_division')
      assert.doesNotMatch(next.op, /[+-]/, `not pure multiplication/division: ${next.op}`)
    })
  }

  for (let i = 0; i < 30; i += 1) {
    const level = (i % 8) + 1
    test(`mult-pool-is-pure-${i}`, () => {
      const next = buildNextMathExercise([], level, false, 'multiplicacion')
      assert.doesNotMatch(next.op, /[+\-/]/, `not pure multiplication: ${next.op}`)
    })
  }

  for (let i = 0; i < 30; i += 1) {
    const level = (i % 8) + 1
    test(`div-pool-is-pure-${i}`, () => {
      const next = buildNextMathExercise([], level, false, 'division')
      assert.doesNotMatch(next.op, /[+\-*]/, `not pure division: ${next.op}`)
    })
  }

  // ── Bug reportado en produccion: el alumno pide "sumas y restas" una vez,
  // y varios ejercicios despues el sistema le da division/multiplicacion
  // porque la ventana de historial (6 mensajes) ya no incluye esa frase. ──
  const sumaRestaSessionOps: string[] = []
  let enfoqueSesion = resolveMathPracticeFocus(['quiero practicar sumas y restas'], null)
  for (let i = 0; i < 25; i += 1) {
    // A partir de aqui, el contexto de cada turno YA NO menciona "sumas y restas"
    // (simula la ventana de 6 mensajes deslizandose mas alla del pedido original).
    enfoqueSesion = resolveMathPracticeFocus([String(i), 'Matematica'], enfoqueSesion)
    const next = buildNextMathExercise(sumaRestaSessionOps, 1, false, enfoqueSesion)
    test(`focus-persists-across-sliding-window-${i}`, () => {
      assert.equal(enfoqueSesion, 'suma_resta', `enfoque se perdio en el turno ${i}`)
      assert.doesNotMatch(next.op, /[*/]/, `se coló multiplicacion/division en el turno ${i}: ${next.op}`)
    })
    sumaRestaSessionOps.push(next.op)
  }

  // ── Bug reportado en produccion: el alumno pide SOLO "sumas" (no "sumas y
  // restas"), pero los ejercicios se mezclaban con restas de todos modos
  // porque ambas palabras caian en el mismo enfoque combinado. ──
  const sumaSoloSessionOps: string[] = []
  let enfoqueSumaSolo = resolveMathPracticeFocus(['sumas'], null)
  for (let i = 0; i < 20; i += 1) {
    enfoqueSumaSolo = resolveMathPracticeFocus([String(i), 'Matematica'], enfoqueSumaSolo)
    const next = buildNextMathExercise(sumaSoloSessionOps, 1, false, enfoqueSumaSolo)
    test(`suma-solo-no-se-mezcla-con-resta-${i}`, () => {
      assert.equal(enfoqueSumaSolo, 'suma', `enfoque se perdio en el turno ${i}`)
      assert.doesNotMatch(next.op, /[*/-]/, `se coló una resta u otra operacion en el turno ${i}: ${next.op}`)
    })
    sumaSoloSessionOps.push(next.op)
  }

  // Mismo hallazgo, pero para "multiplicaciones" (plural) — antes esta forma
  // ni siquiera se reconocia (caia en 'general'), y aunque se reconociera,
  // se mezclaba con divisiones por el mismo bug de enfoque combinado.
  const multSoloSessionOps: string[] = []
  let enfoqueMultSolo = resolveMathPracticeFocus(['multiplicaciones'], null)
  for (let i = 0; i < 20; i += 1) {
    enfoqueMultSolo = resolveMathPracticeFocus([String(i), 'Matematica'], enfoqueMultSolo)
    const next = buildNextMathExercise(multSoloSessionOps, 1, false, enfoqueMultSolo)
    test(`mult-solo-no-se-mezcla-con-division-${i}`, () => {
      assert.equal(enfoqueMultSolo, 'multiplicacion', `enfoque se perdio en el turno ${i}`)
      assert.doesNotMatch(next.op, /[+\-/]/, `se coló una division u otra operacion en el turno ${i}: ${next.op}`)
    })
    multSoloSessionOps.push(next.op)
  }

  // Sin la funcion de persistencia, el mismo escenario SI pierde el enfoque
  // (confirma que el hallazgo era real y que resolveMathPracticeFocus lo cierra).
  test('without-persistence-focus-is-lost', () => {
    const focusSinPersistencia = inferMathPracticeFocus(['23', 'Matematica'])
    assert.equal(focusSinPersistencia, 'general')
  })

  assert.equal(total, 1000 + 20 + 20 + 20 + 20 + 20 + 20 + 18 + 18 + 60 + 30 + 30 + 60 + 30 + 30 + 25 + 20 + 20 + 1)

  if (failures.length > 0) {
    console.error(`math practice stress failed: ${failures.length}/${total}`)
    for (const failure of failures.slice(0, 25)) {
      console.error(`- ${failure.name}: ${failure.message}`)
    }
    process.exit(1)
  }

  console.log(`math practice stress passed: ${total}/${total}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
