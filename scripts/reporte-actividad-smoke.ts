import assert from 'node:assert/strict'
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
import {
  esRecomendacionConRecursoExterno,
  filtrarRecomendaciones,
  stripUngroundedEmotionalClaims,
} from '../src/lib/reporteLenguaje'

function main() {
  // ── Calificable vs no calificable (punto 11) ──
  assert.equal(esCalificable({ estado_evaluacion: 'correcto' }), true)
  assert.equal(esCalificable({ estado_evaluacion: 'incorrecto' }), true)
  assert.equal(esCalificable({ estado_evaluacion: 'equivalente' }), true)
  assert.equal(esCalificable({ estado_evaluacion: 'paso_correcto' }), true)
  assert.equal(esCalificable({ estado_evaluacion: 'no_calificable' }), false)
  assert.equal(esCalificable({ estado_evaluacion: null }), false)
  assert.equal(esCalificable({ estado_evaluacion: 'contexto_pendiente' }), false)

  assert.equal(esDeSeguridad({ estado_evaluacion: 'alerta_seguridad' }), true)
  assert.equal(esDeSeguridad({ estado_evaluacion: 'crisis_emocional' }), true)
  assert.equal(esDeSeguridad({ estado_evaluacion: 'incorrecto' }), false)

  // Bug real: "Resume el tema" (no_calificable, sin operacion) no debe
  // etiquetarse como "Ejercicio académico registrado".
  const resumenSolicitado: FilaInteraccion = { estado_evaluacion: null, operacion_canonica: null, modelo_usado: 'gpt-4o-mini' }
  assert.doesNotMatch(describirActividad(resumenSolicitado, false), /ejercicio acad[eé]mico registrado/i)

  const seleccionTema: FilaInteraccion = { estado_evaluacion: 'no_calificable', modelo_usado: 'topic_selection_guard' }
  assert.equal(describirActividad(seleccionTema, false), 'Selección de tema')
  assert.equal(describirActividad(seleccionTema, true), 'Topic selection')

  const ejercicioMath: FilaInteraccion = { estado_evaluacion: 'incorrecto', operacion_canonica: '62-13' }
  assert.equal(describirActividad(ejercicioMath, false), 'Ejercicio: 62-13')
  assert.equal(etiquetaResultadoActividad(ejercicioMath, false), 'Por reforzar')
  assert.equal(etiquetaResultadoActividad(seleccionTema, false), 'No calificable')

  // ── Agrupación por materia (puntos 9 y 10) ──
  const filas: FilaInteraccion[] = [
    { materia_nombre: 'Biology', tema_detectado: 'Genética', estado_evaluacion: null },
    { materia_nombre: 'Biology', tema_detectado: 'Genética', estado_evaluacion: 'no_calificable' },
    { materia_nombre: 'Geometry', tema_detectado: 'Suma y resta', estado_evaluacion: 'correcto' },
    { materia_nombre: 'Geometry', tema_detectado: 'Suma y resta', estado_evaluacion: 'incorrecto' },
  ]
  const resumen = agruparPorMateria(filas, 'Biology')
  assert.equal(resumen.length, 2)
  assert.equal(resumen[0].materia, 'Biology')
  assert.deepEqual(resumen[0].temas, ['Genética'])
  assert.equal(resumen[0].ejerciciosCalificables, 0)
  assert.equal(resumen[0].precision, null)
  assert.equal(resumen[1].materia, 'Geometry')
  assert.equal(resumen[1].ejerciciosCalificables, 2)
  assert.equal(resumen[1].precision, 50)

  // ── Estado de evidencia (punto 15) ──
  assert.equal(estadoEvidencia(0), 'insuficiente')
  assert.equal(estadoEvidencia(2), 'parcial')
  assert.equal(estadoEvidencia(4), 'suficiente')
  assert.match(fraseEstadoEvidencia('insuficiente', false), /limitada/i)
  assert.match(fraseEstadoEvidencia('suficiente', false), /suficiente/i)

  // ── Sin inferencias emocionales no observables (punto 13) ──
  const conInferencia = stripUngroundedEmotionalClaims('El estudiante mostró interés y receptividad durante la clase.', false)
  assert.equal(conInferencia.guardActivado, true)
  assert.doesNotMatch(conInferencia.text, /mostr[oó] inter[eé]s/i)

  const sinInferencia = stripUngroundedEmotionalClaims('El estudiante consultó temas de Biology y registró actividad en Genética.', false)
  assert.equal(sinInferencia.guardActivado, false)
  assert.equal(sinInferencia.text, 'El estudiante consultó temas de Biology y registró actividad en Genética.')

  // ── Sin recursos externos no aprobados (punto 14) ──
  assert.equal(esRecomendacionConRecursoExterno('Ver un video de Khan Academy sobre el tema'), true)
  assert.equal(esRecomendacionConRecursoExterno('Practicar de nuevo en Owlaris el tema con errores'), false)
  const recomendaciones = filtrarRecomendaciones(
    ['Mirar un video sobre fracciones', 'Practicar de nuevo en Owlaris'],
    ['Usar la opción Revisemos mis errores']
  )
  assert.deepEqual(recomendaciones, ['Practicar de nuevo en Owlaris'])
  const todasFiltradas = filtrarRecomendaciones(['Ver este video externo'], ['Usar la opción Revisemos mis errores'])
  assert.deepEqual(todasFiltradas, ['Usar la opción Revisemos mis errores'])

  console.log('reporte-actividad smoke passed')
}

main()
