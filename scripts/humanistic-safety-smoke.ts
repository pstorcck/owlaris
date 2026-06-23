import assert from 'node:assert/strict'
import { guardHumanisticResponse, isHumanisticContext } from '../src/lib/humanisticSafety'

function main() {
  assert.equal(isHumanisticContext({
    materia: 'Historia',
    tipoPregunta: 'academica',
    materiaNumerica: false,
  }), true)

  const historia = guardHumanisticResponse(
    'Incorrecto. La respuesta correcta es que la independencia ocurrió por una sola causa.',
    { materia: 'Historia', tipoPregunta: 'academica', materiaNumerica: false }
  )
  assert.equal(historia.guardActivado, true)
  assert.doesNotMatch(historia.text, /\bIncorrecto\b/i)
  assert.doesNotMatch(historia.text, /respuesta correcta/i)
  assert.match(historia.text, /evidencia|sustentar|precisi[oó]n/i)

  const espanol = guardHumanisticResponse(
    'Correcto. Esa es la única respuesta correcta es que el poema significa tristeza.',
    { materia: 'Español', tipoPregunta: 'academica', materiaNumerica: false }
  )
  assert.equal(espanol.guardActivado, true)
  assert.doesNotMatch(espanol.text, /\bCorrecto\b/i)
  assert.doesNotMatch(espanol.text, /única respuesta correcta/i)

  const biologiaConceptual = guardHumanisticResponse(
    'Incorrecto. La respuesta correcta es que todas las células son iguales.',
    { materia: 'Biología', tipoPregunta: 'academica', materiaNumerica: true, hasVerifiedOperation: false }
  )
  assert.equal(biologiaConceptual.guardActivado, true)
  assert.doesNotMatch(biologiaConceptual.text, /\bIncorrecto\b/i)

  const mathVerified = guardHumanisticResponse(
    'Incorrecto. El resultado correcto es 13.',
    { materia: 'Matemática', tipoPregunta: 'academica', materiaNumerica: true, hasVerifiedOperation: true }
  )
  assert.equal(mathVerified.guardActivado, false)
  assert.equal(mathVerified.text, 'Incorrecto. El resultado correcto es 13.')

  const english = guardHumanisticResponse(
    'Incorrect. The correct answer is that the author only wanted to inform.',
    { materia: 'Literatura', tipoPregunta: 'academica', materiaNumerica: false, idiomaIngles: true }
  )
  assert.equal(english.guardActivado, true)
  assert.doesNotMatch(english.text, /\bIncorrect\b/i)
  assert.doesNotMatch(english.text, /correct answer/i)

  console.log('humanistic-safety smoke passed')
}

main()
