import assert from 'node:assert/strict'
import { detectarVeredictoAutocontradictorio, repararVeredictoAutocontradictorio } from '../src/lib/contradictoryVerdict'

function main() {
  // Hallazgo real (QA en vivo, 2026-07-21, Mineduc Matemática 5to
  // Bachillerato, sistema de dos ecuaciones lineales — compra de globos y
  // serpentinas): el tutor abrió anunciando un error, pero su propio
  // desglose reproduce exactamente los pasos del alumno y concluye que la
  // respuesta es correcta.
  const casoGlobosYSerpentinas = 'Has hecho un buen intento, pero parece que hay un pequeño error en tu proceso.\nRevisemos tu ecuación paso a paso: 2x+4(15-x)=30 → -2x+60=30 → x=15 → y=0.\nAsí que, efectivamente, María compró 15 globos y 0 serpentinas.'

  assert.equal(detectarVeredictoAutocontradictorio(casoGlobosYSerpentinas), true, 'debe detectar el veredicto autocontradictorio')
  const reparado = repararVeredictoAutocontradictorio(casoGlobosYSerpentinas, false)
  assert.match(reparado, /^¡Correcto!/, 'debe reemplazar la apertura con un veredicto correcto')
  assert.doesNotMatch(reparado, /hay un peque[ñn]o error/i, 'no debe conservar el anuncio de error adelantado')
  assert.match(reparado, /María compró 15 globos y 0 serpentinas/, 'debe conservar el desglose real que sigue')

  // Versión en inglés del mismo patrón.
  const casoIngles = "There's a small mistake in your process.\nLet's review step by step: 2x+4(15-x)=30 → x=15 → y=0.\nSo, your answer is correct: 15 balloons and 0 streamers."
  assert.equal(detectarVeredictoAutocontradictorio(casoIngles), true)
  const reparadoIngles = repararVeredictoAutocontradictorio(casoIngles, true)
  assert.match(reparadoIngles, /^Correct\./)
  assert.doesNotMatch(reparadoIngles, /small mistake/i)

  // No debe activarse cuando el modelo SÍ encontró un error real (sin
  // confirmación de éxito posterior) — un veredicto de error genuino, sin
  // contradicción, debe conservarse tal cual.
  const errorGenuino = 'Hay un error en tu proceso: olvidaste distribuir el 4 en el segundo término. Vuelve a intentarlo.'
  assert.equal(detectarVeredictoAutocontradictorio(errorGenuino), false, 'un error genuino sin confirmación posterior no debe dispararse')

  // No debe activarse cuando la respuesta simplemente confirma un acierto
  // desde el inicio, sin anunciar ningún error (el caso normal, mayoritario).
  const aciertoDirecto = '¡Correcto! Has aplicado las fórmulas adecuadamente y el resultado final es correcto.'
  assert.equal(detectarVeredictoAutocontradictorio(aciertoDirecto), false)

  // No debe activarse cuando el error mencionado aparece tarde en el texto
  // (ya avanzada una explicación conceptual larga), fuera de la ventana de
  // "apertura" — no es un veredicto adelantado.
  const menormasTarde = 'Vamos a repasar con calma el concepto de reacciones químicas balanceadas, cómo se identifican los reactivos limitantes, qué papel juega la estequiometría en la vida real, y por qué es tan importante dominarla antes del examen final de la unidad. '.repeat(2) + 'Dicho esto, hay un error en un ejercicio anterior que ya corregiste.'
  assert.equal(detectarVeredictoAutocontradictorio(menormasTarde), false)

  console.log('contradictory-verdict smoke passed')
}

main()
