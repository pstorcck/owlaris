import assert from 'node:assert/strict'
import {
  buildAnalogousWorkedExample,
  buildNextMathExercise,
  calculateAdaptiveDifficulty,
  collectRecentMathOperations,
  isWorkedExampleRequest,
  isRepeatedMathOperation,
  normalizePracticeOperation,
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

  for (let i = 0; i < 200; i += 1) {
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

  assert.equal(total, 1000)

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
