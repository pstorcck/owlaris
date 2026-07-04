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

  console.log('chat-formatting smoke passed')
}

main()
