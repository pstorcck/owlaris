// Pruebas de integración "de verdad" para las 17 mejoras de vista alumno
// pedidas hoy. A diferencia de los *-smoke.ts existentes (que prueban cada
// función aislada), este script encadena las MISMAS funciones que
// preguntar/route.ts y reporte/route.ts llaman en producción, con datos
// realistas (incluyendo el escenario exacto del PDF real de producción que
// compartió el usuario), para detectar bugs de integración que las pruebas
// unitarias por separado no ven.
import assert from 'node:assert/strict'
import { guardNoFinalAnswer } from '../src/lib/pedagogicalGuard'
import { sanitizeChatFormatting } from '../src/lib/chatFormatting'
import { isReviewMistakesRequest, primeraOperacionValida, temaMasFrecuente } from '../src/lib/mistakeReview'
import {
  buildNextMathExercise,
  describeMathTopic,
  inferMathPracticeFocusFromOperation,
  resolveMathPracticeFocus,
} from '../src/lib/mathPractice'
import { buildGuidedMathHint, handleMathEvaluation, normalizeStudentAnswer } from '../src/lib/mathSafety'
import { matchNumberedListSelection } from '../src/lib/courseTopics'
import { detectarMateriaDesdeTexto, materiaActualEnSistemaCNB, normalizarMateria } from '../src/lib/materiaDetection'
import {
  agruparPorMateria,
  describirActividad,
  esCalificable,
  esDeSeguridad,
  estadoEvidencia,
  etiquetaResultadoActividad,
  fraseEstadoEvidencia,
  type FilaInteraccion,
} from '../src/lib/reporteActividad'
import { esRecomendacionConRecursoExterno, filtrarRecomendaciones, stripUngroundedEmotionalClaims } from '../src/lib/reporteLenguaje'
import { limpiarTemaGeneral } from '../src/lib/temaGeneral'

let total = 0
const failures: { name: string; message: string }[] = []
function check(name: string, fn: () => void) {
  total += 1
  try { fn() } catch (e) { failures.push({ name, message: e instanceof Error ? e.message : String(e) }) }
}
async function checkAsync(name: string, fn: () => Promise<void>) {
  total += 1
  try { await fn() } catch (e) { failures.push({ name, message: e instanceof Error ? e.message : String(e) }) }
}

async function main() {
  // ── Punto 1: guía sin anunciar la regla ──────────────────────────────
  // El modelo revela la respuesta final de un ejercicio de práctica real.
  const modelLeak = 'Vamos bien. El resultado correcto es 13. Sigue así.'
  const guard1 = guardNoFinalAnswer(modelLeak, {
    pregunta: 'Resuelve 24 / 3 + 5',
    tipoPregunta: 'academica',
    materiaNumerica: true,
  })
  check('punto1-no-anuncia-la-regla', () => {
    assert.equal(guard1.guardActivado, true)
    assert.doesNotMatch(guard1.text, /no te voy a dar/i)
    assert.doesNotMatch(guard1.text, /13/)
  })
  check('punto1-frases-varian-segun-texto', () => {
    const a = guardNoFinalAnswer('El resultado correcto es 9.', { pregunta: 'x', tipoPregunta: 'academica', materiaNumerica: true })
    const b = guardNoFinalAnswer('El resultado correcto es 41.', { pregunta: 'y', tipoPregunta: 'academica', materiaNumerica: true })
    // No debe ser siempre exactamente la misma frase fija.
    assert.notEqual(a.text, b.text)
  })

  // ── Punto 2: formato limpio (ejemplo real del pedido del usuario) ────
  const respuestaConTabla = [
    '### Ejemplo:',
    '',
    '| Horas estudiadas (x) | Calificación (y) |',
    '|---|---|',
    '| 1 | 50 |',
    '| 2 | 60 |',
    '| 3 | 70 |',
  ].join('\n')
  check('punto2-sin-markdown-crudo', () => {
    const limpio = sanitizeChatFormatting(respuestaConTabla)
    assert.doesNotMatch(limpio, /###/)
    assert.doesNotMatch(limpio, /\|/)
    assert.match(limpio, /Horas estudiadas \(x\): 1 — Calificación \(y\): 50/)
  })

  // ── Punto 3: "Revisemos mis errores" end-to-end, con el bug real de
  // producción (mezclaba sumas/restas al pedir práctica enfocada) ──────
  const erroresRecientesResta: FilaInteraccion[] = [
    { tema_detectado: 'Suma y resta', operacion_canonica: '62-13', estado_evaluacion: 'incorrecto', creado_en: '2026-07-04T10:00:00Z' },
    { tema_detectado: 'Suma y resta', operacion_canonica: '58-14', estado_evaluacion: 'incorrecto', creado_en: '2026-07-04T10:01:00Z' },
    { tema_detectado: 'Ecuaciones', operacion_canonica: 'x+5=12', estado_evaluacion: 'correcto', creado_en: '2026-07-04T10:02:00Z' },
  ]
  await checkAsync('punto3-revisemos-mis-errores-end-to-end', async () => {
    assert.equal(isReviewMistakesRequest('Revisemos mis errores'), true)
    const patron = temaMasFrecuente(erroresRecientesResta)
    assert.equal(patron, 'Suma y resta')
    const opReciente = primeraOperacionValida(erroresRecientesResta)
    assert.equal(opReciente, '62-13')
    const enfoque = inferMathPracticeFocusFromOperation(opReciente!)
    assert.equal(enfoque, 'resta')
    const hint = buildGuidedMathHint(opReciente, false)
    assert.match(hint, /separar|romper|más fáciles|dos pasos/i)
    const siguienteEjercicio = buildNextMathExercise([opReciente!, '58-14'], 3, false, enfoque)
    // El ejercicio propuesto debe ser SOLO de resta (nunca suma/mult/div) y
    // nunca repetir uno de los errores recientes.
    assert.doesNotMatch(siguienteEjercicio.op, /[+*/]/)
    assert.notEqual(siguienteEjercicio.op.replace(/\s+/g, ''), '62-13')
    assert.notEqual(siguienteEjercicio.op.replace(/\s+/g, ''), '58-14')
  })

  // ── Punto 4: equivalencias en lenguaje natural, ecuación real del
  // ejemplo del usuario (2x + 5 = 17 -> x = 6) ──────────────────────────
  const promptEcuacion = 'Resuelve: 2x + 5 = 17 [OP: 2*x+5=17]'
  for (const respuestaAlumno of ['x es 6', 'x vale 6', 'la x es 6', 'el valor de x es 6', 'creo que x vale 6']) {
    await checkAsync(`punto4-equivalencia-${respuestaAlumno}`, async () => {
      const evaluado = await handleMathEvaluation(promptEcuacion, respuestaAlumno, false)
      assert.equal(evaluado?.estado, 'correcto', `"${respuestaAlumno}" debería marcarse correcto`)
    })
  }

  // ── Punto 5: selección numérica tras una lista, y que NO interfiera con
  // una respuesta matemática real cuando NO hubo lista ─────────────────
  const listaBiologia = 'Podemos trabajar cualquiera de estos temas:\n1. Células\n2. Genética\n3. Evolución\n4. Ecología'
  check('punto5-seleccion-de-lista', () => {
    const seleccion = matchNumberedListSelection('2', listaBiologia)
    assert.equal(seleccion?.tema, 'Genética')
  })
  check('punto5-no-interfiere-con-respuesta-matematica', () => {
    const mensajeMatematico = '¿Cuánto es 3 + 5? [OP: 3+5]'
    assert.equal(matchNumberedListSelection('8', mensajeMatematico), null)
  })

  // ── Punto 6: Biology/Geometry — el bug real reportado ────────────────
  check('punto6-biology-genetica-no-secuestra-materia', () => {
    const materiaActivaBiology = 'Biology'
    const materiaDetectada = detectarMateriaDesdeTexto('¿cómo funciona la genética en los cromosomas?')
    assert.equal(materiaDetectada, 'Biología')
    // Esta es EXACTAMENTE la comparación que hace preguntar/route.ts antes
    // de sugerir un cambio de materia: si son iguales tras normalizar, NO
    // debe activarse el mensaje "¿quieres cambiar a...?".
    assert.equal(materiaDetectada, normalizarMateria(materiaActivaBiology))
  })
  check('punto6-geometry-ecuaciones-no-activa-el-detector', () => {
    const materiaActivaGeometry = 'Geometry'
    // route.ts solo entra al bloque de detección si materiaActualEnSistemaCNB
    // es true — para "Geometry" debe ser false, así que el mensaje ni
    // siquiera se evalúa, sin importar qué palabra clave use el alumno.
    assert.equal(materiaActualEnSistemaCNB(materiaActivaGeometry), false)
  })

  // ── Puntos 7-15: reporte de hoy, reproduciendo el escenario real
  // reportado (Biology + Geometry el mismo día, mezclado en el reporte) ──
  const diaCompleto: FilaInteraccion[] = [
    // Mañana: Biology — selección de tema (no calificable) + pregunta abierta
    { materia_nombre: 'Biology', tema_detectado: 'Genética', estado_evaluacion: 'no_calificable', modelo_usado: 'topic_selection_guard', creado_en: '2026-07-04T08:00:00Z', documento_fuente: 'Owlaris - Biology.md' },
    { materia_nombre: 'Biology', tema_detectado: limpiarTemaGeneral('sobre la celula'), estado_evaluacion: null, modelo_usado: 'gpt-4o-mini', pregunta: 'sobre la celula', creado_en: '2026-07-04T08:05:00Z', documento_fuente: 'Owlaris - Biology.md' },
    // Alerta de seguridad en medio de la sesión de Biology — debe contarse
    // pero NUNCA aparecer en el anexo con el texto crudo del alumno.
    { materia_nombre: 'Biology', tema_detectado: 'Alerta de seguridad', estado_evaluacion: 'alerta_seguridad', modelo_usado: 'content_safety', creado_en: '2026-07-04T08:10:00Z' },
    // Tarde: Geometry — práctica de suma y resta, con un error revisado
    { materia_nombre: 'Geometry', tema_detectado: 'Suma y resta', operacion_canonica: '45+12', estado_evaluacion: 'correcto', modelo_usado: 'calculadora', creado_en: '2026-07-04T14:00:00Z', documento_fuente: 'Owlaris - Geometry.md' },
    { materia_nombre: 'Geometry', tema_detectado: 'Suma y resta', operacion_canonica: '62-13', estado_evaluacion: 'incorrecto', modelo_usado: 'calculadora', creado_en: '2026-07-04T14:02:00Z', documento_fuente: 'Owlaris - Geometry.md' },
    { materia_nombre: 'Geometry', tema_detectado: 'Suma y resta', estado_evaluacion: 'no_calificable', modelo_usado: 'mistake_review_guard', creado_en: '2026-07-04T14:05:00Z' },
  ]

  // El resumen por materia (portada del reporte) NUNCA debe incluir las
  // filas de alerta de seguridad — se cuentan aparte (ver
  // resumenSeguridadIntegridad) pero no son "temas" académicos. Esto
  // reproduce exactamente el filtro que calcularMetricasHoy aplica antes
  // de llamar agruparPorMateria.
  const diaCompletoAcademico = diaCompleto.filter(f => !esDeSeguridad(f))

  check('punto7-8-consolida-ambas-materias-del-dia', () => {
    const resumen = agruparPorMateria(diaCompletoAcademico, 'Geometry')
    // Antes, cambiar de materia reiniciaba la ventana del reporte y
    // "perdía" Biology; ahora ambas materias del día deben aparecer.
    const materias = resumen.map(m => m.materia)
    assert.ok(materias.includes('Biology'), 'Biology debería seguir en el reporte del día')
    assert.ok(materias.includes('Geometry'), 'Geometry también debe aparecer')
  })

  check('punto9-temas-por-materia-correctos', () => {
    const resumen = agruparPorMateria(diaCompletoAcademico, 'Geometry')
    const biology = resumen.find(m => m.materia === 'Biology')!
    const geometry = resumen.find(m => m.materia === 'Geometry')!
    assert.ok(biology.temas.includes('Genética'))
    assert.ok(geometry.temas.includes('Suma y resta'))
    // Bug real encontrado con esta misma prueba: sin filtrar antes de
    // agrupar, "Alerta de seguridad" se colaba como tema de Biology.
    assert.ok(!biology.temas.includes('Alerta de seguridad'))
  })

  check('punto10-fuente-no-se-usa-como-nombre-de-clase', () => {
    // "Clases trabajadas hoy" debe usar el nombre de materia (Biology,
    // Geometry), nunca el nombre técnico de archivo (Owlaris - X.md).
    const resumen = agruparPorMateria(diaCompletoAcademico, 'Geometry')
    const nombresClase = resumen.map(m => m.materia)
    assert.ok(nombresClase.every(n => !n.includes('.md')))
  })

  check('punto11-calificable-vs-no-calificable-y-precision', () => {
    const resumen = agruparPorMateria(diaCompletoAcademico, 'Geometry')
    const geometry = resumen.find(m => m.materia === 'Geometry')!
    // 1 correcta + 1 incorrecta calificables; la revisión de errores
    // (mistake_review_guard, no_calificable) NO debe contar como ejercicio.
    assert.equal(geometry.ejerciciosCalificables, 2)
    assert.equal(geometry.precision, 50)
    const biology = resumen.find(m => m.materia === 'Biology')!
    // Biology no tuvo ejercicios calificables hoy (solo selección de tema
    // y una pregunta abierta) — la precisión debe ser insuficiente, no 0%.
    assert.equal(biology.ejerciciosCalificables, 0)
    assert.equal(biology.precision, null)
  })

  check('punto12-anexo-incluye-toda-la-actividad-no-solo-ejercicios', () => {
    const visibles = diaCompleto.filter(f => !esDeSeguridad(f))
    // 5 de las 6 filas (se excluye solo la alerta de seguridad), incluyendo
    // la selección de tema y la pregunta abierta que antes se descartaban.
    assert.equal(visibles.length, 5)
    const conOperacion = visibles.filter(f => f.operacion_canonica)
    assert.equal(conOperacion.length, 2, 'antes el anexo solo mostraba filas con operación/estado')
  })

  check('punto11-etiquetas-de-actividad-no-calificable-son-especificas', () => {
    const seleccionTema = diaCompleto[0]
    const preguntaAbierta = diaCompleto[1]
    const revisionErrores = diaCompleto[5]
    assert.equal(describirActividad(seleccionTema, false), 'Selección de tema')
    assert.doesNotMatch(describirActividad(preguntaAbierta, false), /ejercicio acad[eé]mico registrado/i)
    assert.equal(describirActividad(revisionErrores, false), 'Revisión de errores')
    assert.equal(etiquetaResultadoActividad(seleccionTema, false), 'No calificable')
    assert.equal(esCalificable(seleccionTema), false)
  })

  check('punto13-sin-inferencias-emocionales-no-observables', () => {
    // Frase real vista en un PDF de producción.
    const real = 'Aunque no se realizaron ejercicios, el alumno mostró iniciativa al elegir el tema.'
    const limpio = stripUngroundedEmotionalClaims(real, false)
    assert.equal(limpio.guardActivado, true)
    assert.doesNotMatch(limpio.text, /mostr[oó] iniciativa/i)
    const proactivo = stripUngroundedEmotionalClaims('Se inició el tema sobre la célula de manera proactiva.', false)
    assert.doesNotMatch(proactivo.text, /proactiv/i)
  })

  check('punto14-sin-recomendar-recursos-externos', () => {
    assert.equal(esRecomendacionConRecursoExterno('Ver un video de Khan Academy sobre el tema'), true)
    const recomendaciones = filtrarRecomendaciones(
      ['Mirar un video sobre la célula', "Usar la opción 'Revisemos mis errores' en Owlaris"],
      ["Usar la opción 'Revisemos mis errores' en Owlaris"]
    )
    assert.deepEqual(recomendaciones, ["Usar la opción 'Revisemos mis errores' en Owlaris"])
  })

  check('punto15-estado-de-evidencia-y-frase', () => {
    const resumen = agruparPorMateria(diaCompletoAcademico, 'Geometry')
    const totalCalificables = resumen.reduce((acc, m) => acc + m.ejerciciosCalificables, 0)
    assert.equal(totalCalificables, 2)
    assert.equal(estadoEvidencia(totalCalificables), 'parcial')
    assert.match(fraseEstadoEvidencia('parcial', false), /parcial/i)
  })

  // ── Verificación cruzada: el enfoque de práctica persiste correctamente
  // incluso con el nombre de materia como señal ambiental (regresión ya
  // corregida antes, pero relevante para el punto 6) ───────────────────
  check('punto6-enfoque-de-practica-no-lo-secuestra-el-nombre-de-materia', () => {
    const enfoque = resolveMathPracticeFocus(['quiero practicar sumas', 'Geometry', 'x+5=12'], null)
    assert.equal(enfoque, 'suma')
  })

  check('describeMathTopic-consistente-con-la-operacion-real', () => {
    assert.equal(describeMathTopic('62-13', false), 'Suma y resta')
    assert.equal(normalizeStudentAnswer('62-13'), null) // no es una respuesta, es una operación
  })

  console.log(`\ntodays-changes integration test: ${total - failures.length}/${total} passed`)
  if (failures.length > 0) {
    console.error(`${failures.length} FALLARON:`)
    for (const f of failures) console.error(`- ${f.name}: ${f.message}`)
    process.exit(1)
  }
}

main()
