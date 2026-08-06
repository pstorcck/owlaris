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

  // Hallazgo real (QA semanal en vivo, 2026-07-31, Física — Americano,
  // trabajo-energía): el patrón reapareció por dos huecos a la vez. El
  // modelo anunció el error con palabras que no estaban cubiertas ("Aquí
  // está el único error") y lo hizo DENTRO del Paso 3 (carácter 309), fuera
  // de la ventana de apertura — y acto seguido confirmó que el despeje del
  // alumno estaba bien.
  const casoFisicaTrabajoEnergia = [
    'Vamos a revisar tu procedimiento paso a paso.',
    '',
    'Paso 1: Calculaste el trabajo neto como W = F·d = 25 N × 4 m = 100 J. Correcto, esa es la definición de trabajo para una fuerza constante.',
    '',
    'Paso 2: Aplicaste el teorema trabajo-energía, W = ΔEc = ½mv². Bien planteado.',
    '',
    'Paso 3: Aquí está el único error. Despejaste v = √(2W/m) = √50 ≈ 7.07 m/s, está bien.',
    '',
    'Tu respuesta final de 7.07 m/s es correcta.',
  ].join('\n')

  assert.ok(
    casoFisicaTrabajoEnergia.indexOf('Aquí está el único error') > 260,
    'el caso debe tener el anuncio FUERA de la ventana de apertura, que es lo que falló'
  )
  assert.equal(
    detectarVeredictoAutocontradictorio(casoFisicaTrabajoEnergia), true,
    'debe detectar el anuncio de error contradicho aunque aparezca a mitad del desglose'
  )

  const fisicaReparado = repararVeredictoAutocontradictorio(casoFisicaTrabajoEnergia, false)
  assert.doesNotMatch(fisicaReparado, /único error/i, 'no debe conservar el anuncio de error desmentido')
  // Lo que NO debe pasar: que reparar se coma los pasos anteriores. Con el
  // corte desde el inicio que hacía la versión previa, Paso 1 y Paso 2
  // desaparecían enteros.
  assert.match(fisicaReparado, /Paso 1: Calculaste el trabajo neto/, 'debe conservar el Paso 1')
  assert.match(fisicaReparado, /Paso 2: Aplicaste el teorema/, 'debe conservar el Paso 2')
  assert.match(fisicaReparado, /Paso 3: Despejaste v/, 'debe conservar el Paso 3 sin la frase del error')
  assert.match(fisicaReparado, /7\.07 m\/s es correcta/, 'debe conservar el veredicto final correcto')

  // Una corrección REAL a mitad del desglose no es contradicción: el modelo
  // encontró un error, lo enmendó, y por eso lo que sigue ya está bien. Este
  // caso no debe tocarse — es el comportamiento deseado.
  const correccionLegitima = [
    'Vamos a revisar tu procedimiento paso a paso.',
    '',
    'Paso 1: El planteamiento del trabajo neto W = F·d = 100 J es correcto y está bien justificado.',
    '',
    'Paso 2: El teorema trabajo-energía quedó bien escrito, sin problemas hasta aquí.',
    '',
    'Paso 3: Aquí está el único error. Deberías haber usado √(2W/m) y no √(W/m); corrigiendo queda v = 7.07 m/s.',
  ].join('\n')
  assert.equal(
    detectarVeredictoAutocontradictorio(correccionLegitima), false,
    'una corrección real (con "deberías"/"corrigiendo") no debe tratarse como contradicción'
  )

  // "Está bien" es una confirmación débil: sirve pegada al anuncio, pero no
  // debe disparar el guard cuando aparece lejos y referida a otra cosa.
  const errorGenuinoConEstaBien = 'Hay un error en tu proceso: revisa el paso 2 con calma, porque el signo cambia al despejar. Cuando termines, fíjate si el planteamiento inicial está bien.'
  assert.equal(
    detectarVeredictoAutocontradictorio(errorGenuinoConEstaBien), false,
    '"está bien" lejos del anuncio y sobre otra cosa no es una contradicción'
  )

  console.log('contradictory-verdict smoke passed')
}

main()
