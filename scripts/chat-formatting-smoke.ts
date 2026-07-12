import assert from 'node:assert/strict'
import { isExplicitTableRequest, isFormatRequest, sanitizeChatFormatting } from '../src/lib/chatFormatting'

function main() {
  assert.equal(sanitizeChatFormatting('### Ejemplo:\nAlgo de texto'), 'Ejemplo:\nAlgo de texto')
  assert.equal(sanitizeChatFormatting('## Otro título'), 'Otro título')
  assert.equal(sanitizeChatFormatting('**Ejemplo:**\nTexto en negrita'), 'Ejemplo:\nTexto en negrita')

  const tabla = [
    'Datos del ejemplo:',
    '',
    '| Horas estudiadas (x) | Calificación (y) |',
    '|---|---|',
    '| 1 | 50 |',
    '| 2 | 60 |',
    '| 3 | 70 |',
    '',
    'Fin.',
  ].join('\n')
  const limpio = sanitizeChatFormatting(tabla)
  assert.doesNotMatch(limpio, /\|/)
  assert.doesNotMatch(limpio, /-{2,}/)
  assert.match(limpio, /Horas estudiadas \(x\): 1 — Calificación \(y\): 50/)
  assert.match(limpio, /Horas estudiadas \(x\): 2 — Calificación \(y\): 60/)
  assert.match(limpio, /Horas estudiadas \(x\): 3 — Calificación \(y\): 70/)

  const plano = 'Texto normal sin nada raro.\nSegunda línea.'
  assert.equal(sanitizeChatFormatting(plano), plano)

  assert.equal(sanitizeChatFormatting(''), '')

  // Bloque de código: los backticks no se renderizan en el chat del alumno.
  const conBloqueCodigo = sanitizeChatFormatting('```python\nprint("hola")\n```')
  assert.doesNotMatch(conBloqueCodigo, /```/)
  assert.match(conBloqueCodigo, /print\("hola"\)/)

  // Dos tablas separadas por texto deben convertirse independientemente.
  const dosTablas = sanitizeChatFormatting([
    '| A | B |', '|---|---|', '| 1 | 2 |', '',
    'Texto entre tablas.', '',
    '| C | D |', '|---|---|', '| 3 | 4 |',
  ].join('\n'))
  assert.match(dosTablas, /A: 1 — B: 2/)
  assert.match(dosTablas, /C: 3 — D: 4/)
  assert.match(dosTablas, /Texto entre tablas\./)

  // Negritas dentro de una celda de tabla no deben romper la conversión.
  const tablaConNegritas = sanitizeChatFormatting(['| **Concepto** | Valor |', '|---|---|', '| **x** | 5 |'].join('\n'))
  assert.match(tablaConNegritas, /Concepto: x — Valor: 5/)

  // Un pipe suelto que no forma parte de una tabla real no debe alterarse.
  const pipeSuelto = 'El resultado es 5 | 6 dependiendo del caso.'
  assert.equal(sanitizeChatFormatting(pipeSuelto), pipeSuelto)

  // Instructivo de mejoras (ronda 2026-07-11), ítems 18, 29: petición de
  // reformatear el contenido activo (tabla, lista, "organiza esto bonito").
  for (const frase of [
    'ponme esto en una tabla',
    'organiza esto bonito',
    'organízalo mejor',
    'hazlo en lista',
    'put this in a table',
    'organize this nicely',
  ]) {
    assert.equal(isFormatRequest(frase), true, frase)
  }
  assert.equal(isFormatRequest('¿qué es la fotosíntesis?'), false)
  assert.equal(isFormatRequest(''), false)

  // Hallazgo real (verificación posterior, 2026-07-12): el PROMPT_BASE ya
  // permite una tabla explícita, pero sanitizeChatFormatting la convertía
  // a "Etiqueta: valor" en línea de todas formas, sin excepción — el
  // alumno nunca veía la tabla que pidió. preserveTables=true debe
  // conservar la tabla tal cual quedó (con pipes), y solo debe activarse
  // para peticiones de tabla explícita, no para "organiza esto bonito".
  for (const frase of ['ponme esto en una tabla', 'en una tabla', 'put this in a table', 'in table format']) {
    assert.equal(isExplicitTableRequest(frase), true, frase)
  }
  for (const frase of ['organiza esto bonito', 'hazlo en lista', 'organize this nicely']) {
    assert.equal(isExplicitTableRequest(frase), false, frase)
  }
  const tablaPreservada = sanitizeChatFormatting(tabla, true)
  assert.match(tablaPreservada, /\|/)
  assert.doesNotMatch(tablaPreservada, /Horas estudiadas \(x\): 1 — Calificación \(y\): 50/)

  console.log('chat-formatting smoke passed')
}

main()
