// Hallazgo real (QA de verificación, 2026-08-03, casos 1 y 2). Después de
// quitar la operación basura de logaritmos, el falso "incorrecto" siguió —
// pero por otra causa. Transcripción real:
//
//   OWLARIS: log(x) + log(2) = 3          (correcto: x = 500)
//   ALUMNO:  500
//   OWLARIS: "Parece que no llegaste a la respuesta correcta..."
//   ...y tras fijar el paso 2x = 1000, el MISMO x = 500 lo acepta.
//
//   OWLARIS: 3^(x - 2) = 81               (correcto: x = 6)
//   ALUMNO:  6
//   OWLARIS: "Aún no has llegado a la respuesta correcta..."
//
// Esta vez el texto era fluido y la pista matemáticamente válida: ya no era
// una plantilla, era el modelo juzgando mal. Al no poder resolver esas formas,
// el protocolo se abstenía y nadie verificaba nada.
//
// No hace falta resolver la ecuación para saber si el alumno acertó: basta
// sustituir su valor y comprobar si la satisface.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { verificarPorSustitucion, extraerEcuacionConIncognita } from '../src/lib/mathSafety'

const enunciado = (ecuacion: string) =>
  `Resuelve la siguiente ecuación:\n\n${ecuacion}\n\n¿Cuál es el valor de x?`

function main() {
  // Los dos casos exactos que el QA reportó como fallidos.
  assert.equal(
    verificarPorSustitucion(enunciado('log(x) + log(2) = 3'), 500), true,
    'x = 500 satisface log(x) + log(2) = 3 (caso 1 del QA)'
  )
  assert.equal(
    verificarPorSustitucion(enunciado('3^(x - 2) = 81'), 6), true,
    'x = 6 satisface 3^(x-2) = 81 (caso 2 del QA)'
  )

  // Otras formas de la misma familia.
  const aciertos: Array<[string, number]> = [
    ['2^(x+1) = 16', 3],
    ['log₃(x) = 4', 81],
    ['2x + 6 = 14', 4],
    ['ln(x) = 0', 1],
  ]
  for (const [ecuacion, valor] of aciertos) {
    assert.equal(
      verificarPorSustitucion(enunciado(ecuacion), valor), true,
      `${valor} debe satisfacer ${ecuacion}`
    )
  }

  // Un valor equivocado NO debe confirmarse.
  const fallos: Array<[string, number]> = [
    ['log(x) + log(2) = 3', 250],
    ['3^(x - 2) = 81', 5],
    ['2^(x+1) = 16', 4],
    ['2x + 6 = 14', 5],
  ]
  for (const [ecuacion, valor] of fallos) {
    assert.notEqual(
      verificarPorSustitucion(enunciado(ecuacion), valor), true,
      `${valor} NO debe confirmarse para ${ecuacion}`
    )
  }

  // Sin ecuación legible no se concluye nada: null, nunca false disfrazado de
  // veredicto. Este camino no puede inventar un "incorrecto".
  assert.equal(
    verificarPorSustitucion('¿Cuánto es el 20% de 250?', 50), null,
    'sin una ecuación con incógnita no se concluye nada'
  )
  assert.equal(
    extraerEcuacionConIncognita('Resuelve la siguiente ecuación logarítmica:'), null,
    'la prosa del enunciado no debe confundirse con la ecuación'
  )

  // El flujo solo puede crear veredictos de ACIERTO por esta vía.
  const route = readFileSync(join(__dirname, '..', 'src/app/api/preguntar/route.ts'), 'utf8')
  assert.match(
    route,
    /verificarPorSustitucion\(textoEjercicio, valorAlumno\) === true[\s\S]{0,400}estado: 'correcto'/,
    'la verificación por sustitución solo debe producir veredictos de acierto'
  )

  console.log('verificacion-por-sustitucion smoke passed')
}

main()
