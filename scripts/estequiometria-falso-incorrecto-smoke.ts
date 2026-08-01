// Hallazgo real CRÍTICO (QA en vivo, 2026-07-31 y repetido el 2026-08-01,
// Química — Americano, estequiometría): ante la respuesta CORRECTA (34 g de
// NH₃) el tutor contestaba, palabra por palabra:
//
//   "Todavía no. Piensa la división como repartir en grupos iguales. ¿Cuál es
//    la primera operación pequeña que puedes resolver? Intenta de nuevo con
//    ese paso."
//
// sin revisar ningún paso. El texto es una plantilla fija del protocolo
// matemático (mathSafety.ts), no una respuesta del modelo: por eso era
// idéntica en cada corrida.
//
// La causa: de "N2 + 3H2 -> 2NH3" se inferían los coeficientes como una
// operación ARITMÉTICA ("2+3" = 5), y contra ese 5 se juzgaba el 34 del
// alumno. Como el protocolo responde directo cuando tiene veredicto, la
// plantilla de "incorrecto" reemplazaba la revisión completa del
// procedimiento.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  inferCanonicalOperationFromText,
  pareceEcuacionQuimica,
} from '../src/lib/mathSafety'

function main() {
  // El enunciado exacto que rompía: de una reacción no puede salir aritmética.
  const estequiometria = 'Para la reacción N2 + 3H2 -> 2NH3, si reaccionan 28 g de N2, ¿cuántos gramos de NH3 se producen? La masa molar del NH3 es 17 g/mol.'
  assert.equal(pareceEcuacionQuimica(estequiometria), true, 'debe reconocerse como ecuación química')
  assert.equal(
    inferCanonicalOperationFromText(estequiometria), null,
    'no debe inferirse ninguna operación aritmética de una ecuación química (antes devolvía "2+3")'
  )

  // Sin flecha, pero con varias fórmulas, sigue siendo química.
  const sinFlecha = 'En la reacción se tienen 2 moles de NH3 y 3 moles de H2. Si la masa molar del NH3 es 17 g/mol, ¿cuál es la masa?'
  assert.equal(pareceEcuacionQuimica(sinFlecha), true)
  assert.equal(inferCanonicalOperationFromText(sinFlecha), null)

  // El [OP:] explícito se respeta: ahí el tutor DECLARÓ qué verificar, y un
  // paso aritmético de estequiometría sí es verificable.
  const conOpExplicita = 'Para la reacción N2 + 3H2 -> 2NH3, calcula la masa de 2 moles de NH3.\n[OP: 2*17]'
  assert.equal(
    inferCanonicalOperationFromText(conOpExplicita), '2*17',
    'el [OP:] explícito debe seguir respetándose aunque el enunciado sea químico'
  )

  // NO debe cambiar nada para matemática real: los casos que la inferencia
  // ya resolvía siguen resolviéndose igual.
  const matematicaIntacta: Array<[string, string]> = [
    ['¿Cuánto es el 20% de 250?', '0.2*250'],
    ['Resuelve 2x + 6 = 14', '2x+6=14'],
    ['Calcula 145 + 278', '145+278'],
  ]
  for (const [enunciado, esperado] of matematicaIntacta) {
    assert.equal(pareceEcuacionQuimica(enunciado), false, `"${enunciado}" no es una ecuación química`)
    assert.equal(
      inferCanonicalOperationFromText(enunciado), esperado,
      `la inferencia de matemática real debe seguir funcionando en "${enunciado}"`
    )
  }

  // Geometría: un "punto P2" o un "vértice A1" no deben leerse como fórmulas,
  // aunque P sea el símbolo del fósforo.
  const geometria = 'Los vértices del rectángulo son A1 y P2. Calcula 12 * 5 para el área.'
  assert.equal(
    pareceEcuacionQuimica(geometria), false,
    'las etiquetas de puntos de geometría no son fórmulas químicas'
  )

  // Una mención suelta tipo "H2O" en prosa no convierte el texto en química:
  // hace falta la flecha o al menos dos fórmulas distintas.
  const mencionSuelta = 'Un tanque contiene 40 litros de H2O y se vacían 15 litros. ¿Cuántos quedan?'
  assert.equal(
    pareceEcuacionQuimica(mencionSuelta), false,
    'una sola fórmula suelta en prosa no debe bloquear la inferencia'
  )

  // Segunda ronda del QA (01/08): el fix anterior NO bastó. La pista era de
  // DIVISIÓN y la inferencia bloqueada producía una SUMA ("2+3") — señal de
  // que la operación con la que se calificaba venía de otro lado: de la
  // etiqueta [OP:] que escribe el modelo y que se guarda en
  // operacion_canonica (route.ts:2085 la reinyecta como [OP:] explícito en
  // cada turno siguiente). En estequiometría esa etiqueta es UN PASO de la
  // conversión, no la cantidad final que el alumno responde.
  //
  // Por eso el guard no puede vivir solo en la inferencia. Se verifica que
  // route.ts tenga las dos defensas que sí cubren ese camino.
  const route = readFileSync(join(__dirname, '..', 'src/app/api/preguntar/route.ts'), 'utf8')

  assert.match(
    route,
    /estado === 'incorrecto'[\s\S]{0,700}pareceEcuacionQuimica[\s\S]{0,400}evaluacionProtocolo = null/,
    'route.ts debe descartar el veredicto "incorrecto" del protocolo cuando el ejercicio usa ' +
    'notación química, venga la operación de donde venga (etiqueta del modelo, fila pendiente ' +
    'ya guardada o inferencia)'
  )

  assert.match(
    route,
    /opFinalRespuesta && pareceEcuacionQuimica\(respuesta\)[\s\S]{0,400}opFinalRespuesta = null/,
    'route.ts no debe guardar operacion_canonica para un ejercicio con notación química: ' +
    'esa fila pendiente es lo que envenenaba todos los turnos siguientes'
  )

  console.log('estequiometria-falso-incorrecto smoke passed')
}

main()
