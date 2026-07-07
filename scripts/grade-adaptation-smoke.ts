// Sprint de estabilización (2026-07-07): antes no existía ninguna regla de
// adaptación de vocabulario/complejidad por grado — este test verifica que
// las tres bandas (primaria/básico/bachillerato) producen instrucciones
// realmente distintas, que ambos sistemas de nombre de grado (CNB
// guatemalteco y eScholaris en inglés) se reconocen, y que un grado no
// reconocido cae a un valor por defecto razonable sin crashear.
import assert from 'node:assert/strict'
import { buildGradeAdaptationInstruction, inferirBandaGrado } from '../src/lib/gradeAdaptation'

function main() {
  // ── Sistema CNB guatemalteco ──
  assert.equal(inferirBandaGrado('4to Primaria'), 'primaria')
  assert.equal(inferirBandaGrado('5to Primaria'), 'primaria')
  assert.equal(inferirBandaGrado('6to Primaria'), 'primaria')
  assert.equal(inferirBandaGrado('1ero Básico'), 'basico')
  assert.equal(inferirBandaGrado('2do Básico'), 'basico')
  assert.equal(inferirBandaGrado('3ero Básico'), 'basico')
  assert.equal(inferirBandaGrado('4to Bachillerato'), 'bachillerato')
  assert.equal(inferirBandaGrado('5to Bachillerato'), 'bachillerato')

  // ── Sistema eScholaris (numérico, en inglés/español mixto) ──
  assert.equal(inferirBandaGrado('Grado 6'), 'primaria')
  assert.equal(inferirBandaGrado('Grade 6'), 'primaria')
  assert.equal(inferirBandaGrado('Grado 7'), 'basico')
  assert.equal(inferirBandaGrado('Grado 8'), 'basico')
  assert.equal(inferirBandaGrado('Grado 9'), 'basico')
  assert.equal(inferirBandaGrado('Grado 10'), 'bachillerato')
  assert.equal(inferirBandaGrado('Grado 11'), 'bachillerato')
  assert.equal(inferirBandaGrado('Grado 12'), 'bachillerato')

  // ── Grado no reconocido o vacío: cae a "basico", nunca crashea ──
  assert.equal(inferirBandaGrado(''), 'basico')
  assert.equal(inferirBandaGrado(null), 'basico')
  assert.equal(inferirBandaGrado(undefined), 'basico')
  assert.equal(inferirBandaGrado('Kinder'), 'basico')
  assert.equal(inferirBandaGrado('texto sin sentido'), 'basico')

  // ── Las tres bandas producen instrucciones realmente distintas ──
  const primaria = buildGradeAdaptationInstruction('4to Primaria', false)
  const basico = buildGradeAdaptationInstruction('2do Básico', false)
  const bachillerato = buildGradeAdaptationInstruction('5to Bachillerato', false)
  assert.notEqual(primaria, basico)
  assert.notEqual(basico, bachillerato)
  assert.notEqual(primaria, bachillerato)
  assert.match(primaria, /ADAPTACIÓN POR GRADO — Primaria/)
  assert.match(basico, /ADAPTACIÓN POR GRADO — Básico/)
  assert.match(bachillerato, /ADAPTACIÓN POR GRADO — Bachillerato/)

  // Las cinco dimensiones pedidas deben estar presentes en cada banda.
  for (const instruccion of [primaria, basico, bachillerato]) {
    assert.match(instruccion, /Vocabulario:/)
    assert.match(instruccion, /Extensión:/)
    assert.match(instruccion, /Tono:/)
    assert.match(instruccion, /Ejemplos:/)
    assert.match(instruccion, /Nivel de abstracción:/)
  }

  // ── Versión en inglés (modo de conversación en inglés) ──
  const bachilleratoEn = buildGradeAdaptationInstruction('5to Bachillerato', true)
  assert.match(bachilleratoEn, /GRADE ADAPTATION — High school/)
  assert.notEqual(bachilleratoEn, bachillerato)

  // ── Hallazgo real (QA post-despliegue, 2026-07-07): pedir "¿Qué es la
  // fotosíntesis?" en Grado 6 y en Grado 12 dio respuestas casi idénticas,
  // ambas con terminología avanzada (ATP, NADPH, ciclo de Calvin). La
  // instrucción original ("vocabulario cotidiano") era demasiado blanda
  // frente al sesgo del modelo a dar la explicación técnica completa. La
  // banda primaria/básico ahora debe prohibir explícitamente ese nivel de
  // detalle salvo que el alumno lo pida, no solo sugerir simplicidad. ──
  assert.match(primaria, /OBLIGATORIO/)
  assert.match(primaria, /PROHIBIDO/)
  assert.match(primaria, /a menos que el alumno pida/i)
  assert.match(basico, /OBLIGATORIO/)
  assert.match(basico, /(?:a menos que|salvo que) el alumno pida/i)
  // Bachillerato NO debe llevar esa restricción — ahí sí corresponde el
  // detalle técnico completo por defecto.
  assert.doesNotMatch(bachillerato, /PROHIBIDO/)

  console.log('grade-adaptation smoke passed')
}

main()
