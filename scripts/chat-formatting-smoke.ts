import assert from 'node:assert/strict'
import { sanitizeChatFormatting } from '../src/lib/chatFormatting'

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

  console.log('chat-formatting smoke passed')
}

main()
