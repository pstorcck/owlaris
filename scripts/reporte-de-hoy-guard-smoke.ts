// Hallazgo real (instructivo de mejoras, ronda 2026-07-11), ítems 12-13:
// pedir "el reporte de hoy" escribiéndolo en el chat es una función real de
// la plataforma (el botón que genera el PDF), no una redacción para el
// modelo — debe dirigir al botón real, no inventar un resumen de texto. Un
// reporte/informe ESCOLAR (tarea, laboratorio, investigación de una materia
// específica) es un concepto distinto y no debe activarse por esta guarda.
import assert from 'node:assert/strict'
import { buildReporteDeHoyRedirectResponse, isReporteDeHoyRequest } from '../src/lib/tutorContext'

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

function main() {
  const peticionesReporteDeHoy = [
    'dame el reporte de hoy',
    'quiero mi reporte de hoy',
    '¿me puedes dar el reporte de hoy?',
    'necesito el reporte de hoy para mis papás',
    'generame el reporte de hoy',
    'puedes darme el reporte',
    'pasame el reporte',
    "can you give me today's report?",
    'i want the report',
    'i need my report',
    'generate the report please',
  ]
  peticionesReporteDeHoy.forEach((frase, i) => {
    test(`reporte-de-hoy-detectado-${i}`, () => {
      assert.equal(isReporteDeHoyRequest(frase), true, frase)
    })
  })

  // Un reporte/informe ESCOLAR (tarea de una materia específica) es un
  // concepto distinto — no debe confundirse con la función de la
  // plataforma ni interceptarse aquí.
  const reportesEscolares = [
    'necesito ayuda con mi reporte de laboratorio de química',
    'ayúdame con mi reporte de investigación sobre las plantas',
    'tengo que entregar un reporte del colegio sobre historia',
    'necesito ayuda con mi reporte de biología',
    'mi reporte para la clase de ciencias',
  ]
  reportesEscolares.forEach((frase, i) => {
    test(`reporte-escolar-no-intercepta-${i}`, () => {
      assert.equal(isReporteDeHoyRequest(frase), false, frase)
    })
  })

  // Preguntas normales que no mencionan "reporte" no deben activarse.
  assert.equal(isReporteDeHoyRequest('¿qué es la fotosíntesis?'), false)
  assert.equal(isReporteDeHoyRequest(''), false)

  const respuestaEs = buildReporteDeHoyRedirectResponse(false)
  assert.match(respuestaEs, /Reporte de hoy/)
  assert.match(respuestaEs, /bot[oó]n/i)

  const respuestaEn = buildReporteDeHoyRedirectResponse(true)
  assert.match(respuestaEn, /Today's report/)
  assert.match(respuestaEn, /button/i)

  if (failures.length > 0) {
    console.error(`reporte-de-hoy-guard smoke failed: ${failures.length}/${total}`)
    for (const failure of failures) {
      console.error(`- ${failure.name}: ${failure.message}`)
    }
    process.exit(1)
  }

  console.log(`reporte-de-hoy-guard smoke passed: ${total}/${total}`)
}

main()
