import assert from 'node:assert/strict'
import {
  agruparPorMateria,
  construirEvidenciaActividad,
  describirActividad,
  esCalificable,
  esDeSeguridad,
  estadoEvidencia,
  etiquetaResultadoActividad,
  fraseEstadoEvidencia,
  resolverNombreMateria,
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

  // Bug real encontrado con un escaneo de las palabras clave curriculares:
  // "enlace" (Química: enlace químico/covalente/iónico) y "artículo"
  // (Español: el artículo determinado/indeterminado) son temas reales que
  // NO deben confundirse con "enlace"/"artículo" como recurso externo.
  assert.equal(esRecomendacionConRecursoExterno('Revisar el tipo de enlace químico que se formó'), false)
  assert.equal(esRecomendacionConRecursoExterno('Practicar enlace covalente y enlace iónico'), false)
  assert.equal(esRecomendacionConRecursoExterno('Repasar el uso del artículo determinado e indeterminado'), false)
  // Pero un enlace o artículo EXTERNO de verdad sí debe seguir detectándose.
  assert.equal(esRecomendacionConRecursoExterno('Compartir este enlace externo con el estudiante'), true)
  assert.equal(esRecomendacionConRecursoExterno('Leer un articulo externo sobre el tema'), true)
  assert.equal(esRecomendacionConRecursoExterno('Check this link for more information'), true)

  // ── Hallazgo #9 (auditoría QA 2026-07-07): el ejercicio del anexo no debe
  // desfasarse una posición respecto a la respuesta del alumno. Cada fila
  // de "interacciones" guarda en operacion_canonica el ejercicio SIGUIENTE
  // (el que esa fila le presenta al alumno), no el que su propia pregunta
  // responde — construirEvidenciaActividad debe reconstruir el
  // emparejamiento correcto desplazando esa referencia una posición.
  const secuenciaReal: FilaInteraccion[] = [
    // Primer ejercicio presentado tras elegir el tema: aún no responde nada.
    { creado_en: '2026-07-07T18:00:00Z', pregunta: 'Quiero practicar ecuaciones', tema_detectado: 'Ecuaciones lineales', operacion_canonica: '2x+5=17', op_estado: 'pendiente', estado_evaluacion: null, materia_nombre: 'Math Grade 8' },
    // Responde 2x+5=17 con x=6 (correcto) y se le presenta x+3=55.
    { creado_en: '2026-07-07T18:01:00Z', pregunta: 'x=6', tema_detectado: 'Ecuaciones lineales', operacion_canonica: 'x+3=55', op_estado: 'pendiente', op_respuesta_alumno: null, estado_evaluacion: 'correcto', materia_nombre: 'Math Grade 8' },
    // Responde x+3=55 con x=52 (correcto) y se le presenta x*12=84.
    { creado_en: '2026-07-07T18:02:00Z', pregunta: 'x=52', tema_detectado: 'Ecuaciones lineales', operacion_canonica: 'x*12=84', op_estado: 'pendiente', op_respuesta_alumno: null, estado_evaluacion: 'correcto', materia_nombre: 'Math Grade 8' },
    // Responde x*12=84 con x=7 (correcto) y se le presenta 3x+16=76.
    { creado_en: '2026-07-07T18:03:00Z', pregunta: 'x=7', tema_detectado: 'Ecuaciones lineales', operacion_canonica: '3x+16=76', op_estado: 'pendiente', op_respuesta_alumno: null, estado_evaluacion: 'correcto', materia_nombre: 'Math Grade 8' },
  ]
  const evidencia = construirEvidenciaActividad(secuenciaReal, false)
  assert.equal(evidencia.length, 4)
  assert.match(evidencia[0].ejercicio, /2x\+5=17/)
  assert.match(evidencia[1].ejercicio, /2x\+5=17/)
  assert.equal(evidencia[1].respuesta_estudiante, 'x=6')
  assert.equal(evidencia[1].resultado, 'Correcta')
  assert.match(evidencia[2].ejercicio, /x\+3=55/)
  assert.equal(evidencia[2].respuesta_estudiante, 'x=52')
  assert.match(evidencia[3].ejercicio, /x\*12=84/)
  assert.equal(evidencia[3].respuesta_estudiante, 'x=7')

  // Si el UPDATE de la fila anterior sí llega a reflejarse (op_respuesta_alumno
  // ya poblado), el emparejamiento por desplazamiento debe seguir dando el
  // mismo resultado correcto (no debe duplicar ni desalinear nada).
  const secuenciaConUpdateReflejado: FilaInteraccion[] = secuenciaReal.map((fila, idx) =>
    idx > 0 && idx < secuenciaReal.length - 1 ? { ...fila, op_estado: 'evaluada', op_respuesta_alumno: fila.pregunta } : fila
  )
  const evidenciaConUpdate = construirEvidenciaActividad(secuenciaConUpdateReflejado, false)
  assert.match(evidenciaConUpdate[2].ejercicio, /x\+3=55/)
  assert.equal(evidenciaConUpdate[2].respuesta_estudiante, 'x=52')

  // ── Hallazgo #10 (auditoría QA 2026-07-07): las filas cuyo materia_id no
  // resuelve contra la tabla materias NO deben etiquetarse con la materia
  // activa al generar el reporte — deben usar el snapshot real de ese turno.
  assert.equal(resolverNombreMateria('Math Grade 8', { materia_id: 'abc' }, 'Science Grade 8'), 'Math Grade 8')
  assert.equal(resolverNombreMateria(null, { materia_id: null, materia_nombre_snapshot: 'Math Grade 8' }, 'Science Grade 8'), 'Math Grade 8')
  // Solo si NO hay ni FK ni snapshot (filas antiguas, previas a este fix) se
  // usa la materia activa como último recurso.
  assert.equal(resolverNombreMateria(null, { materia_id: null, materia_nombre_snapshot: null }, 'Science Grade 8'), 'Science Grade 8')
  // Si sí hay materia_id pero el FK no trajo nombre (fila borrada de materias),
  // no se debe inventar la materia activa como si fuera la real.
  assert.equal(resolverNombreMateria(null, { materia_id: 'abc', materia_nombre_snapshot: null }, 'Science Grade 8'), null)

  console.log('reporte-actividad smoke passed')
}

main()
