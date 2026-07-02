import assert from 'node:assert/strict'
import {
  handleMathEvaluation,
  inferCanonicalOperationFromText,
  isLikelyNumericSubject,
  solveOperation,
} from '../src/lib/mathSafety'
import {
  GRADOS_ESCHOLARIS,
  getGradeFolderCandidates,
  inferSubjectFromSharePointName,
  isEScholarisSchool,
  isLikelyGradeFolder,
  sharePointNameMatchesSubject,
  sharePointTextMatchesGrade,
  sortGradesForSchool,
} from '../src/lib/sharepointFolders'

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

function buildEquationCase(i: number) {
  const x = (i % 23) - 8 || 5
  const a = (i % 9) + 2
  const b = (i % 17) - 6
  const right = a * x + b
  const sign = b >= 0 ? '+' : '-'
  const op = `${a}x${sign}${Math.abs(b)}=${right}`
  return { op, answer: x }
}

function buildExpressionCase(i: number) {
  const a = (i % 37) + 3
  const b = (i % 11) + 2
  const c = (i % 7) + 1
  const op = i % 5 === 0
    ? `${a}+${b}*${c}`
    : i % 5 === 1
      ? `${a * b}-${c}`
      : i % 5 === 2
        ? `${a}*${b}+${c}`
        : i % 5 === 3
          ? `${a * b}/${b}+${c}`
          : `(${a}+${b})/${c}`
  const answer = solveOperation(op)
  assert.notEqual(answer, null, `op sin resultado: ${op}`)
  return { op, answer: answer! }
}

async function main() {
  const eScholarisInput = {
    nombre: 'eScholaris',
    slug: 'escholaris',
    sharepoint_folder: 'eScholaris',
  }

  const mathClasses = [
    'Math',
    'Math 6',
    'Math 7',
    'Math 8',
    'Math 9',
    'Math 10',
    'Math 11',
    'Math 12',
    'Math Grade 6',
    'Math Grade 7',
    'Owlaris - Math Grade 8.md',
    'Owlaris - Math Grade 9.md',
    'Mathematics Grade 10',
    'Integrated Math 11',
    'Advanced Math 12',
    'Pre-Algebra',
    'Algebra I',
    'Geometry',
    'Geometry Grade 10',
    'Math 6.md',
    'Mathematics 7.markdown',
  ]

  for (let i = 0; i < 150; i++) {
    const subject = mathClasses[i % mathClasses.length]
    test(`escholaris-math-subject-${i}`, () => {
      assert.equal(isLikelyNumericSubject(subject), true)
      assert.equal(sharePointNameMatchesSubject(subject, 'Matemática'), true)
      assert.equal(inferSubjectFromSharePointName(subject), 'Matemática')
    })
  }

  const nonMathClasses = [
    ['Environmental Systems', null],
    ['Language Arts', 'Inglés'],
    ['English Language Arts', 'Inglés'],
    ['ELA Grade 8', 'Inglés'],
    ['Social Studies', 'Ciencias Sociales'],
    ['World History', 'Ciencias Sociales'],
    ['World Geography', 'Ciencias Sociales'],
    ['Spanish', 'Español'],
    ['Literature', null],
    ['Technology', 'Computación'],
    ['Art', 'Arte'],
    ['Music', 'Arte'],
    ['Physical Education', 'Educación Física'],
  ] as const

  for (let i = 0; i < 100; i++) {
    const [subject, inferred] = nonMathClasses[i % nonMathClasses.length]
    test(`escholaris-non-math-class-${i}`, () => {
      assert.equal(isLikelyNumericSubject(subject), false)
      if (inferred) assert.equal(inferSubjectFromSharePointName(subject), inferred)
      assert.equal(sharePointNameMatchesSubject(subject, 'Matemática'), false)
    })
  }

  for (let i = 0; i < 100; i++) {
    const grade = GRADOS_ESCHOLARIS[i % GRADOS_ESCHOLARIS.length]
    const candidates = getGradeFolderCandidates(grade)
    const gradeNumber = grade.match(/\d+/)?.[0] || ''
    const ordinalWord: Record<string, string> = {
      '6': 'Sixth Grade',
      '7': 'Seventh Grade',
      '8': 'Eighth Grade',
      '9': 'Ninth Grade',
      '10': 'Tenth Grade',
      '11': 'Eleventh Grade',
      '12': 'Twelfth Grade',
    }
    const gradeAliases = [
      `Grado ${gradeNumber}`,
      `Grade ${gradeNumber}`,
      `${gradeNumber}th Grade`,
      `${gradeNumber}th`,
      ordinalWord[gradeNumber],
      ordinalWord[gradeNumber]?.replace(' Grade', ''),
      `G${gradeNumber}`,
    ].filter((alias): alias is string => Boolean(alias))
    test(`escholaris-grade-folder-${i}`, () => {
      assert.equal(isEScholarisSchool(eScholarisInput), true)
      for (const alias of gradeAliases) assert.equal(isLikelyGradeFolder(alias, eScholarisInput), true, alias)
      assert.ok(candidates.includes(grade))
      assert.ok(candidates.includes(`Grade ${gradeNumber}`))
      assert.ok(candidates.includes(`${gradeNumber}th Grade`))
      assert.ok(candidates.includes(`${gradeNumber}th`))
      assert.ok(candidates.includes(ordinalWord[gradeNumber]))
      assert.ok(candidates.includes(`G${gradeNumber}`))
      assert.ok(sharePointTextMatchesGrade(`Owlaris - Math Grade ${gradeNumber}.md`, grade))
      assert.ok(sharePointTextMatchesGrade(`Owlaris - Math Grado ${gradeNumber}.md`, `Grade ${gradeNumber}`))
      assert.ok(sharePointTextMatchesGrade(`Owlaris - Math ${gradeNumber}th Grade.md`, `Grade ${gradeNumber}`))

      const shuffled = ['Grade 12', 'Grado 6', '9th Grade', 'Grade 7']
      assert.deepEqual(sortGradesForSchool(shuffled, eScholarisInput), ['Grado 6', 'Grade 7', '9th Grade', 'Grade 12'])
    })
  }

  for (let i = 0; i < 350; i++) {
    const subject = mathClasses[i % mathClasses.length]
    const equation = i % 2 === 0
    const { op, answer } = equation ? buildEquationCase(i) : buildExpressionCase(i)
    const prompt = equation
      ? `Solve this ${subject} equation: ${op}. What value of x do you get?`
      : `Solve this ${subject} exercise: ${op}. What is the result?`

    await testAsync(`escholaris-math-correct-${i}`, async () => {
      assert.equal(isLikelyNumericSubject(subject), true)
      const inferred = inferCanonicalOperationFromText(prompt)
      assert.equal(inferred, op)
      const result = await handleMathEvaluation(prompt, numericAnswer(answer), true)
      assert.equal(result?.estado, 'correcto')
      assert.ok(result?.correctAnswer !== null)
      assert.doesNotMatch(result?.feedback || '', /\bincorrect\b/i)
    })
  }

  for (let i = 0; i < 200; i++) {
    const subject = mathClasses[i % mathClasses.length]
    const equation = i % 2 === 0
    const { op, answer } = equation ? buildEquationCase(i + 350) : buildExpressionCase(i + 350)
    const wrong = answer + (answer >= 0 ? 1 : -1)
    const prompt = equation
      ? `Solve this ${subject} equation: ${op}. What value of x do you get?`
      : `Solve this ${subject} exercise: ${op}. What is the result?`

    await testAsync(`escholaris-math-wrong-${i}`, async () => {
      const result = await handleMathEvaluation(prompt, numericAnswer(wrong), true)
      assert.equal(result?.estado, 'incorrecto')
      assert.ok(result?.correctAnswer !== null && Math.abs((result?.correctAnswer || 0) - answer) < 0.001)
      assert.match(result?.feedback || '', /Not yet|guide|Try again/i)
      assert.doesNotMatch(result?.feedback || '', /correct (?:result|answer)\s+(?:is|would be)/i)
    })
  }

  for (let i = 0; i < 100; i++) {
    const subject = mathClasses[i % mathClasses.length]
    const { op, answer } = buildEquationCase(i + 550)
    const prompt = `Let's practice ${subject}.\n\nHere is one equation:\n${op}\n\nWhat is x?`
    const studentAnswer = i % 2 === 0 ? `x = ${numericAnswer(answer)}` : `yes, it is ${numericAnswer(answer)}`

    await testAsync(`escholaris-pending-like-equation-${i}`, async () => {
      const inferred = inferCanonicalOperationFromText(prompt)
      assert.equal(inferred, op)
      const result = await handleMathEvaluation(prompt, studentAnswer, true)
      assert.equal(result?.estado, 'correcto')
      assert.equal(result?.correctAnswer, answer)
    })
  }

  assert.equal(total, 1000)

  if (failures.length > 0) {
    console.error(`eScholaris math stress failed: ${failures.length}/${total}`)
    for (const failure of failures.slice(0, 25)) {
      console.error(`- ${failure.name}: ${failure.message}`)
    }
    process.exit(1)
  }

  console.log(`eScholaris math stress passed: ${total}/${total}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
