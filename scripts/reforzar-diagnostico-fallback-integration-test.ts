// Prueba de integración del refuerzo determinístico de "bajar la dificultad"
// en la rama de respaldo (problemas de palabras, materias humanísticas) de
// preguntar/route.ts. Hallazgo real (QA Ronda 3, 2026-07-10): este refuerzo
// solo se aplicaba en la rama de evaluación matemática estricta
// (evaluacionProtocolo) — la rama de respaldo dependía únicamente de que el
// modelo decidiera bajar la dificultad por su cuenta vía una instrucción de
// prompt, lo cual era inconsistente. Este script replica la misma lógica
// que ahora corre en route.ts (sin depender de credenciales de
// Supabase/OpenAI) para verificar que ambas ramas escalen con el mismo
// umbral.
import assert from 'node:assert/strict'

function reforzarDiagnosticoPorFallos(respuesta: string, idiomaIngles: boolean, fallosConsecutivos: number) {
  if (fallosConsecutivos < 4) return respuesta
  const refuerzo = idiomaIngles
    ? 'Let us lower the difficulty for a moment, not as a punishment, but to find the missing base. First, let us review the simplest step involved here.'
    : 'Vamos a bajar la dificultad por un momento, no como castigo, sino para encontrar la base que falta. Primero revisemos el paso más simple de este procedimiento.'
  return `${respuesta}\n\n${refuerzo}`
}

function computeFallbackStreaks(
  estadoEvaluacionHumanistico: 'correcto' | 'incorrecto' | null,
  racha: { correctas: number; incorrectas: number }
) {
  const aciertosConsecutivosFallback = estadoEvaluacionHumanistico === 'correcto'
    ? racha.correctas + 1
    : estadoEvaluacionHumanistico === null ? racha.correctas : 0
  const fallosConsecutivosFallback = estadoEvaluacionHumanistico === 'incorrecto'
    ? racha.incorrectas + 1
    : estadoEvaluacionHumanistico === null ? racha.incorrectas : 0
  return { aciertosConsecutivosFallback, fallosConsecutivosFallback }
}

function main() {
  // Racha real reportada en QA Ronda 3: un problema de palabras (ej. "María
  // tiene 12 manzanas...") mal respondido 3 veces seguidas no debía escalar
  // todavía (el umbral es 4, igual que en la rama estricta) — pero la
  // CUARTA vez sí debe aplicar el refuerzo, exactamente igual que si fuera
  // una ecuación evaluada por el protocolo estricto.
  const streaksTrasVarios = computeFallbackStreaks('incorrecto', { correctas: 0, incorrectas: 2 })
  assert.equal(streaksTrasVarios.fallosConsecutivosFallback, 3)
  const respuestaConTres = reforzarDiagnosticoPorFallos('Por reforzar, intenta de nuevo.', false, streaksTrasVarios.fallosConsecutivosFallback)
  assert.equal(respuestaConTres, 'Por reforzar, intenta de nuevo.')

  const streaksCuartoFallo = computeFallbackStreaks('incorrecto', { correctas: 0, incorrectas: 3 })
  assert.equal(streaksCuartoFallo.fallosConsecutivosFallback, 4)
  const respuestaConCuatro = reforzarDiagnosticoPorFallos('Por reforzar, intenta de nuevo.', false, streaksCuartoFallo.fallosConsecutivosFallback)
  assert.match(respuestaConCuatro, /bajar la dificultad/i)

  // Una respuesta correcta reinicia la racha de fallos a 0, sin importar
  // cuántos fallos venía acumulando.
  const streaksTrasAcierto = computeFallbackStreaks('correcto', { correctas: 0, incorrectas: 6 })
  assert.equal(streaksTrasAcierto.fallosConsecutivosFallback, 0)
  assert.equal(streaksTrasAcierto.aciertosConsecutivosFallback, 1)

  // Un turno que no es una evaluación (ni "correcto" ni "incorrecto" en el
  // texto — ej. el alumno cambió de tema o pidió una aclaración) preserva
  // la racha existente en vez de reiniciarla a 0, igual que el caso
  // "pasoIntermedio" ya existente en la rama estricta.
  const streaksSinEvaluar = computeFallbackStreaks(null, { correctas: 1, incorrectas: 3 })
  assert.equal(streaksSinEvaluar.fallosConsecutivosFallback, 3)
  assert.equal(streaksSinEvaluar.aciertosConsecutivosFallback, 1)

  // Inglés: el refuerzo debe estar completamente en inglés.
  const respuestaIngles = reforzarDiagnosticoPorFallos('Not correct, try again.', true, 4)
  assert.match(respuestaIngles, /lower the difficulty/i)
  assert.doesNotMatch(respuestaIngles, /[áéíóúñ]/i)

  console.log('reforzar-diagnostico-fallback integration test passed')
}

main()
