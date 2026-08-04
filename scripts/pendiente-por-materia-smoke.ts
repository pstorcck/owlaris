// Hallazgo real (QA 2026-08-04, caso B): tras dejar un ejercicio sin responder
// en Matemáticas, cambiar de materia y volver por el chip, el tutor ya no lo
// reconocía — trataba "x = 5" como una afirmación suelta e inventaba otro
// ejercicio ("2x + 3 = 13").
//
// El primer intento de arreglo (mapa de pendientes por materia) no podía
// funcionar: el chip del sidebar envía forceEstado 'esperando_materia', eso
// dispara reiniciarVentanaReporte(), y ahí se borraba el mapa COMPLETO. El
// borrado ocurría exactamente en el flujo que el arreglo debía proteger.
//
// Este test fija las cuatro condiciones que hacen que el pendiente sobreviva
// a un cambio de materia. Es de interfaz y no se puede ejecutar sin navegador,
// así que se comprueba sobre el código — igual que los guards de route.ts.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function main() {
  const chat = readFileSync(
    join(__dirname, '..', 'src/components/chat/ChatInterface.tsx'),
    'utf8'
  )

  // 1. Se ENVÍA el pendiente de la materia de esta petición, no uno global.
  assert.match(
    chat,
    /pending_math_interaction_id: pendientesPorMateria\.current\[clavePendiente\(materiaActiva\)\]/,
    'debe enviarse el ejercicio pendiente de la materia activa, no un valor compartido'
  )

  // 2. LA CONDICIÓN QUE FALLÓ EN LA REPRUEBA: se archiva bajo la materia que
  //    el SERVIDOR declara activa, no bajo materiaActiva. En el turno de
  //    cambio de materia, materiaActiva todavía es la ANTERIOR (el chip solo
  //    fuerza el estado), y ese turno responde pending_math_interaction_id:
  //    null — así que archivar por materiaActiva borraba el pendiente de la
  //    materia recién abandonada.
  assert.match(
    chat,
    /const materiaDelTurno = data\.materia_detectada \|\| materiaActiva/,
    'el turno debe archivarse bajo la materia que declara el servidor, no bajo materiaActiva'
  )
  assert.match(
    chat,
    /pendientesPorMateria\.current\[clavePendiente\(materiaDelTurno\)\] = data\.pending_math_interaction_id/,
    'la respuesta debe archivarse bajo la materia de ese turno'
  )
  assert.doesNotMatch(
    chat,
    /pendientesPorMateria\.current\[clavePendiente\(materiaActiva\)\] = data\.pending_math_interaction_id/,
    'archivar por materiaActiva es exactamente lo que borraba el pendiente al cambiar de materia'
  )

  // 3. LA CONDICIÓN QUE FALLÓ: reiniciarVentanaReporte NO puede vaciar el
  //    mapa. Esa función corre al seleccionar materia, así que vaciarlo ahí
  //    borra el pendiente justo cuando hay que conservarlo.
  const cuerpo = chat.match(/function reiniciarVentanaReporte\(\)\s*\{([\s\S]*?)\n  \}/)
  assert.ok(cuerpo, 'no se encontró reiniciarVentanaReporte')
  assert.doesNotMatch(
    cuerpo[1],
    /pendientesPorMateria\.current\s*=\s*\{\}/,
    'reiniciarVentanaReporte NO debe vaciar el mapa: corre al seleccionar materia, ' +
    'que es justo cuando el ejercicio pendiente tiene que sobrevivir'
  )

  // 4. Sí debe vaciarse al cambiar de GRADO: ahí el ejercicio es de otro nivel.
  assert.match(
    chat,
    /update\(\{ grado \}\)|pendientesPorMateria\.current = \{\}[\s\S]{0,200}update\(\{ grado \}\)/,
    'el cambio de grado debe seguir existiendo como punto de limpieza'
  )
  const trasCambioDeGrado = chat.match(/setEstadoChat\('esperando_materia'\)\s*\n\s*reiniciarVentanaReporte\(\)([\s\S]{0,400})/)
  assert.ok(trasCambioDeGrado, 'no se encontró el flujo de cambio de grado')
  assert.match(
    trasCambioDeGrado[1],
    /pendientesPorMateria\.current = \{\}/,
    'al cambiar de grado el mapa sí debe vaciarse'
  )

  console.log('pendiente-por-materia smoke passed')
}

main()
