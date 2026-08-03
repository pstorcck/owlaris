// Hallazgos del QA semanal en vivo (Estadística 5to Bach y Filosofía 4to
// Bach). Los dos parecían "el modelo se porta mal" y los dos resultaron ser
// código determinístico.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { guardNoFinalAnswer } from '../src/lib/pedagogicalGuard'
import { respuestaConfirmaAcierto } from '../src/lib/contradictoryVerdict'

// Mensaje típico del alumno que entrega su procedimiento completo: activa
// shouldGuideWithoutFinalAnswer por contexto de práctica.
const MENSAJE_ALUMNO = 'Resolví el ejercicio de estadística, este es mi procedimiento completo, ¿está bien?'
const opciones = { tipoPregunta: 'academica' as const, pregunta: MENSAJE_ALUMNO, materiaNumerica: true }

function main() {
  // ── Estadística: el "falso error" en variante suave ───────────────────
  // "Estás cerca. Revisemos qué operación ayuda a avanzar." es una de las
  // frases-guía FIJAS de pedagogicalGuard, no texto del modelo. El guard la
  // anteponía a una respuesta que confirmaba los 4 pasos correctos.
  // El texto DEBE contener una frase que el guard recorta ("el resultado es
  // ..."): sin recorte el guard no se activa y el caso no reproduce nada.
  // Es justo lo que pasa al verificar un procedimiento: el tutor nombra el
  // resultado del alumno para confirmarlo.
  const verificacionCorrecta = [
    'Revisemos tu procedimiento paso a paso.',
    'Paso 1: la media que calculaste, 14.2, está bien.',
    'Paso 2: la varianza poblacional de 6.16 es correcta.',
    'Paso 3: el resultado es 2.48, la desviación estándar poblacional.',
    'Paso 4: interpretaste bien la dispersión.',
    'Tu procedimiento es correcto.',
  ].join('\n')

  assert.equal(
    respuestaConfirmaAcierto(verificacionCorrecta), true,
    'debe reconocerse que la respuesta confirma el trabajo del alumno'
  )

  const resultado = guardNoFinalAnswer(verificacionCorrecta, opciones)
  assert.equal(
    resultado.guardActivado, false,
    'el guard de "no dar la respuesta final" no debe intervenir cuando la respuesta CONFIRMA ' +
    'el trabajo que el alumno ya hizo — la respuesta la produjo él'
  )
  assert.equal(resultado.text, verificacionCorrecta, 'el texto debe quedar intacto')
  assert.doesNotMatch(
    resultado.text, /Estás cerca/,
    'no debe anteponerse una frase de "todavía te falta" a un veredicto de acierto'
  )

  // El guard SÍ debe seguir actuando cuando no hay confirmación de acierto:
  // ahí es donde protege de entregar la respuesta final.
  const entregaLaRespuesta = 'La respuesta final es 42. Con eso ya tienes el ejercicio resuelto.'
  assert.equal(
    respuestaConfirmaAcierto(entregaLaRespuesta), false,
    'entregar el resultado no es confirmar el trabajo del alumno'
  )
  assert.equal(
    guardNoFinalAnswer(entregaLaRespuesta, opciones).guardActivado, true,
    'el guard debe seguir protegiendo cuando la respuesta entrega el resultado final'
  )

  // ── Filosofía: el ejercicio activo fantasma ───────────────────────────
  // El filtro por materia existía pero solo se aplicaba "if (materia_uuid)":
  // con la materia sin resolver se reutilizaba el pendiente de otra materia.
  const route = readFileSync(join(__dirname, '..', 'src/app/api/preguntar/route.ts'), 'utf8')

  assert.match(
    route,
    /if \(pendingMathId && materia_uuid\) \{/,
    'la fila de ejercicio pendiente solo debe consultarse con la materia confirmada'
  )
  assert.doesNotMatch(
    route,
    /if \(materia_uuid\) preguntaPendienteQuery = preguntaPendienteQuery\.eq\('materia_id'/,
    'el filtro por materia ya no puede ser condicional: así es como fallaba abierto'
  )
  assert.match(
    route,
    /\.eq\('op_estado', 'pendiente'\)[\s\S]{0,400}\.eq\('materia_id', materia_uuid\)/,
    'la consulta del pendiente debe filtrar SIEMPRE por materia'
  )

  console.log('falso-error-suave-y-ejercicio-fantasma smoke passed')
}

main()
