import assert from 'node:assert/strict'

// Replica exacta de la decisión que preguntar/route.ts toma en el estado
// 'esperando_confirmacion_cambio_materia' — ver src/app/api/preguntar/route.ts.
//
// Hallazgo real CRÍTICO (QA 100 pruebas, 2026-07-14, bug ya reportado que
// seguía presente): confirmar quedarse en la materia ACTUAL nombrándola
// explícitamente ("sigamos con Math Grade 8") se malinterpretaba como una
// confirmación de CAMBIO a la materia sugerida, porque la regex de
// afirmación no exigía límite de palabra ("si" hacía match con el prefijo
// de "sigamos").
function decidirConfirmacionCambioMateria(pregunta: string, materiaId: string, materiaSugerida: string): 'cambia' | 'se_queda' {
  const nombraMateriaActual = !!materiaId && pregunta.toLowerCase().includes(materiaId.toLowerCase())
  const esAfirmativo = !nombraMateriaActual && /^(si|sí|yes|s|claro|correcto|dale|ok|bueno|perfecto|va|vamos)\b/.test(pregunta.toLowerCase().trim())
  return esAfirmativo && materiaSugerida ? 'cambia' : 'se_queda'
}

function main() {
  // El caso real reportado: nombrar la materia actual explícitamente, sin
  // ninguna palabra afirmativa al inicio.
  assert.equal(decidirConfirmacionCambioMateria('sigamos con Math Grade 8', 'Math Grade 8', 'Science Grade 8'), 'se_queda')
  assert.equal(decidirConfirmacionCambioMateria('Sigamos con Math Grade 8', 'Math Grade 8', 'Science Grade 8'), 'se_queda')
  assert.equal(decidirConfirmacionCambioMateria('sigo con Math Grade 8', 'Math Grade 8', 'Science Grade 8'), 'se_queda')

  // Variante con palabra afirmativa AL INICIO seguida de nombrar la materia
  // actual — también debe quedarse, la mención explícita manda.
  assert.equal(decidirConfirmacionCambioMateria('sí, sigamos con Math Grade 8', 'Math Grade 8', 'Science Grade 8'), 'se_queda')
  assert.equal(decidirConfirmacionCambioMateria('vamos a seguir con Math Grade 8', 'Math Grade 8', 'Science Grade 8'), 'se_queda')

  // Confirmaciones genuinas (sin nombrar la materia actual) deben seguir
  // cambiando a la materia sugerida — sin regresión del caso normal.
  assert.equal(decidirConfirmacionCambioMateria('sí', 'Math Grade 8', 'Science Grade 8'), 'cambia')
  assert.equal(decidirConfirmacionCambioMateria('si', 'Math Grade 8', 'Science Grade 8'), 'cambia')
  assert.equal(decidirConfirmacionCambioMateria('claro', 'Math Grade 8', 'Science Grade 8'), 'cambia')
  assert.equal(decidirConfirmacionCambioMateria('dale, cambiemos', 'Math Grade 8', 'Science Grade 8'), 'cambia')
  assert.equal(decidirConfirmacionCambioMateria('vamos', 'Math Grade 8', 'Science Grade 8'), 'cambia')
  assert.equal(decidirConfirmacionCambioMateria('va', 'Math Grade 8', 'Science Grade 8'), 'cambia')

  // Otras palabras que empiezan con "si"/"s" pero NO son la afirmación —
  // no deben confundirse con un "sí" suelto.
  assert.equal(decidirConfirmacionCambioMateria('siempre me confundo con esto', 'Math Grade 8', 'Science Grade 8'), 'se_queda')
  assert.equal(decidirConfirmacionCambioMateria('sin problema, sigamos con Math Grade 8', 'Math Grade 8', 'Science Grade 8'), 'se_queda')

  // Rechazo explícito (ni afirmativo ni nombra la materia actual) también
  // debe quedarse — comportamiento ya correcto, sin regresión.
  assert.equal(decidirConfirmacionCambioMateria('no, mejor no', 'Math Grade 8', 'Science Grade 8'), 'se_queda')

  console.log('materia-confirmacion-cambio smoke passed')
}

main()
