// Prueba de integración del fix agregado a preguntar/route.ts (QA en vivo,
// 2026-07-13): la búsqueda de respaldo de "ejercicio matemático pendiente"
// (cuando el frontend no manda pending_math_interaction_id) solo filtraba
// por usuario + materia + grado + ventana de 2 horas, sin verificar
// continuidad de TEMA — así que una respuesta corta ("4") en un ejercicio
// de tasas unitarias completamente nuevo resucitaba un ejercicio de
// descuento/impuesto ya abandonado de la misma sesión, calificándolo contra
// esa operación vieja. Se replica aquí la misma decisión de dos consultas
// (encontrar el pendiente más reciente, luego verificar que no haya ninguna
// interacción MÁS RECIENTE que él) sobre datos en memoria, sin depender de
// credenciales de Supabase.
import assert from 'node:assert/strict'

type Interaccion = {
  id: string
  usuario_id: string
  materia_id: string | null
  grado: string | null
  op_estado: string | null
  op_evaluada_en: string | null
  operacion_canonica: string | null
  creado_en: string
}

function resolverPendingMathId(
  interacciones: Interaccion[],
  input: { usuarioId: string; materiaUuid: string | null; grado: string | null; ahora: Date }
): string | null {
  const hace2h = new Date(input.ahora.getTime() - 2 * 3600000).toISOString()

  const candidatos = interacciones
    .filter((i) => i.usuario_id === input.usuarioId)
    .filter((i) => i.op_estado === 'pendiente')
    .filter((i) => i.op_evaluada_en === null)
    .filter((i) => i.operacion_canonica !== null)
    .filter((i) => i.creado_en >= hace2h)
    .filter((i) => (input.materiaUuid ? i.materia_id === input.materiaUuid : true))
    .filter((i) => (input.grado ? i.grado === input.grado : true))
    .sort((a, b) => (a.creado_en < b.creado_en ? 1 : -1))

  const latestPendingMath = candidatos[0] || null
  if (!latestPendingMath) return null

  const actividadPosterior = interacciones
    .filter((i) => i.usuario_id === input.usuarioId)
    .filter((i) => (input.materiaUuid ? i.materia_id === input.materiaUuid : true))
    .some((i) => i.creado_en > latestPendingMath.creado_en)

  return actividadPosterior ? null : latestPendingMath.id
}

function main() {
  const ahora = new Date('2026-07-13T18:00:00.000Z')
  const usuarioId = 'user-1'
  const materiaUuid = 'materia-math-grade-7'

  // Caso real reportado: el ejercicio de descuento+impuesto quedó pendiente
  // (nunca se marcó op_evaluada_en), y 40 minutos después el alumno ya está
  // trabajando un ejercicio de tasas unitarias totalmente distinto — hubo
  // una interacción intermedia (el tutor presentando el nuevo problema) con
  // creado_en posterior al pendiente. No debe resucitarse el viejo.
  const conActividadIntermedia: Interaccion[] = [
    {
      id: 'ejercicio-descuento-impuesto',
      usuario_id: usuarioId,
      materia_id: materiaUuid,
      grado: '7',
      op_estado: 'pendiente',
      op_evaluada_en: null,
      operacion_canonica: '240*0.12',
      creado_en: '2026-07-13T17:20:00.000Z',
    },
    {
      id: 'tutor-presenta-tasas-unitarias',
      usuario_id: usuarioId,
      materia_id: materiaUuid,
      grado: '7',
      op_estado: null,
      op_evaluada_en: null,
      operacion_canonica: null,
      creado_en: '2026-07-13T17:45:00.000Z',
    },
  ]
  assert.equal(
    resolverPendingMathId(conActividadIntermedia, { usuarioId, materiaUuid, grado: '7', ahora }),
    null,
    'no debe resucitar un pendiente si ya hubo actividad posterior (la conversación avanzó a otro tema)'
  )

  // Caso legítimo que el fix NO debe romper: el frontend simplemente no
  // mandó el ID (hipo de red), y NO ha pasado nada más desde que se planteó
  // el ejercicio — debe seguir resucitándose para poder calificar la
  // respuesta del alumno contra el ejercicio real que sigue activo.
  const sinActividadIntermedia: Interaccion[] = [
    {
      id: 'ejercicio-aun-activo',
      usuario_id: usuarioId,
      materia_id: materiaUuid,
      grado: '7',
      op_estado: 'pendiente',
      op_evaluada_en: null,
      operacion_canonica: '24/6',
      creado_en: '2026-07-13T17:58:00.000Z',
    },
  ]
  assert.equal(
    resolverPendingMathId(sinActividadIntermedia, { usuarioId, materiaUuid, grado: '7', ahora }),
    'ejercicio-aun-activo',
    'debe seguir resucitando el pendiente cuando de verdad no ha pasado nada más'
  )

  // Un pendiente de hace más de 2 horas nunca debe resucitarse, con o sin
  // actividad posterior (comportamiento ya existente, no debe romperse).
  const pendienteViejo: Interaccion[] = [
    {
      id: 'ejercicio-de-ayer',
      usuario_id: usuarioId,
      materia_id: materiaUuid,
      grado: '7',
      op_estado: 'pendiente',
      op_evaluada_en: null,
      operacion_canonica: '5+5',
      creado_en: '2026-07-13T10:00:00.000Z',
    },
  ]
  assert.equal(resolverPendingMathId(pendienteViejo, { usuarioId, materiaUuid, grado: '7', ahora }), null)

  // Actividad posterior de OTRO usuario o de OTRA materia no debe bloquear
  // la resurrección legítima del pendiente de ESTE usuario/materia.
  const actividadDeOtroUsuario: Interaccion[] = [
    {
      id: 'ejercicio-de-paul',
      usuario_id: usuarioId,
      materia_id: materiaUuid,
      grado: '7',
      op_estado: 'pendiente',
      op_evaluada_en: null,
      operacion_canonica: '24/6',
      creado_en: '2026-07-13T17:58:00.000Z',
    },
    {
      id: 'actividad-de-otro-alumno',
      usuario_id: 'otro-usuario',
      materia_id: materiaUuid,
      grado: '7',
      op_estado: null,
      op_evaluada_en: null,
      operacion_canonica: null,
      creado_en: '2026-07-13T17:59:00.000Z',
    },
  ]
  assert.equal(
    resolverPendingMathId(actividadDeOtroUsuario, { usuarioId, materiaUuid, grado: '7', ahora }),
    'ejercicio-de-paul'
  )

  console.log('pending-math-stale-topic integration test passed')
}

main()
