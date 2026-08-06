// Hallazgo real CRÍTICO (QA en vivo, Matemáticas 5to Bach — tema 6,
// ecuaciones exponenciales y logarítmicas). Transcripción real:
//
//   OWLARIS: Resuelve la siguiente ecuación logarítmica: log₃(x) = 4
//   ALUMNO:  81                    <- CORRECTO
//   OWLARIS: "Todavía no. Primero distribuye la multiplicación dentro del
//             paréntesis y luego sigue despejando x."
//   ALUMNO:  X=81                  <- lo mismo, y esta vez sí lo aceptó
//   OWLARIS: "Correcto. Has encontrado que x = 81."
//
// Cadena reproducida:
//   1. Del enunciado se infería la operación "(x)=4": el extractor se comía
//      el "log₃" y dejaba la basura entre paréntesis.
//   2. isSafeCanonicalOperation la daba por válida.
//   3. Esa basura SÍ resuelve (da 4), así que el 81 se calificaba contra 4.
//   4. La pista salía de ver "=", "x" y "(" en la operación — de ahí el
//      "distribuye el paréntesis" en un ejercicio de logaritmos.
import assert from 'node:assert/strict'
import {
  inferCanonicalOperationFromText,
  esOperacionCalificable,
  isSafeCanonicalOperation,
  usaFuncionNoSoportada,
  solveOperation,
} from '../src/lib/mathSafety'

function main() {
  const enunciadoLog = 'Resuelve la siguiente ecuación logarítmica:\n\nlog₃(x) = 4\n\n¿Cuál es el valor de x?'

  assert.equal(usaFuncionNoSoportada(enunciadoLog), true, 'un logaritmo debe reconocerse como no soportado')
  assert.equal(
    inferCanonicalOperationFromText(enunciadoLog), null,
    'de una ecuación logarítmica no debe inferirse ninguna operación (antes devolvía "(x)=4")'
  )

  // El corazón del bug: la basura inferida era "resoluble", y por eso llegaba
  // a calificar. Se deja fijado que ese valor jamás debe volver a aceptarse.
  assert.equal(solveOperation('(x)=4'), 4, 'la operación basura resolvía a 4 — de ahí el falso "incorrecto" al 81')
  assert.equal(
    esOperacionCalificable('log3(x)=4'), false,
    'una ecuación logarítmica no puede ser referencia de calificación'
  )

  // Exponencial: sin función rara, pero el motor NO la resuelve. Antes pasaba
  // isSafeCanonicalOperation y se guardaba como operacion_canonica.
  assert.equal(isSafeCanonicalOperation('2^(x+1)=16'), true, 'seguía pasando el filtro de "segura"')
  assert.equal(solveOperation('2^(x+1)=16'), null, 'pero el motor no la resuelve')
  assert.equal(
    esOperacionCalificable('2^(x+1)=16'), false,
    'una operación que no se puede resolver no debe sostener ningún veredicto'
  )

  // Lo que NO debe cambiar: la aritmética normal sigue siendo calificable.
  for (const op of ['3^4', '145+278', '0.2*250', '2x+6=14']) {
    assert.equal(esOperacionCalificable(op), true, `"${op}" debe seguir siendo calificable`)
  }
  assert.equal(
    inferCanonicalOperationFromText('Calcula 145 + 278'), '145+278',
    'la inferencia de aritmética normal debe seguir intacta'
  )

  console.log('log-exponencial-falso-incorrecto smoke passed')
}

main()
