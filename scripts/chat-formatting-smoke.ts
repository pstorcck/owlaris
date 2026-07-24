import assert from 'node:assert/strict'
import { isExplicitTableRequest, isFormatRequest, isTableRejection, looksLikeMarkdownTable, sanitizeChatFormatting } from '../src/lib/chatFormatting'

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

  // Hallazgo real (segunda verificación, 2026-07-12): la lista de frases
  // fijas exigía una frase completa ("en una tabla"), pero un pedido
  // natural como "una tabla comparando X vs Y" no la contiene (falta la
  // palabra "en" antes de "una tabla") — se agrega la palabra suelta
  // "tabla"/"table" con límite de palabra como criterio adicional.
  for (const frase of [
    'una tabla comparando célula procariota vs eucariota',
    'ponme la información en tabla',
    'quiero un table con los datos',
    'me lo puedes poner en forma de tabla',
  ]) {
    assert.equal(isExplicitTableRequest(frase), true, frase)
  }

  const tablaPreservada = sanitizeChatFormatting(tabla, true)
  assert.match(tablaPreservada, /\|/)
  assert.doesNotMatch(tablaPreservada, /Horas estudiadas \(x\): 1 — Calificación \(y\): 50/)

  // Hallazgo real (cuarta verificación, 2026-07-13): incluso con la
  // instrucción del prompt, el modelo a veces igual rechazaba una tabla
  // explícitamente pedida ("no puedo hacer una tabla en formato visual") y
  // entregaba viñetas en su lugar. Se necesita detectar ese rechazo y la
  // ausencia de sintaxis de tabla real de forma determinística para poder
  // reintentar en preguntar/route.ts.
  assert.equal(
    looksLikeMarkdownTable('| Característica | Fotosíntesis | Respiración |\n|---|---|---|\n| Lugar | Cloroplastos | Mitocondrias |'),
    true
  )
  assert.equal(looksLikeMarkdownTable('- Proceso: fotosíntesis\n- Lugar: cloroplastos'), false)
  assert.equal(looksLikeMarkdownTable(''), false)

  // Hallazgo real CRÍTICO (QA en vivo, 2026-07-24, Olimpiadas de Ciencias
  // — Química): PALABRA_TABLA marcaba CUALQUIER mención de "tabla" como
  // petición explícita de tabla — incluyendo "tabla periódica" (un término
  // de química, no un formato) y los reclamos del alumno para RECHAZAR una
  // tabla no pedida ("no quiero la tabla", "otra vez la misma tabla").
  // Esto forzaba al modelo a responder con tabla en cada uno de los 4
  // turnos exactos de la conversación real, incluyendo los turnos donde el
  // alumno confrontaba directamente el bucle — reforzándolo en vez de
  // romperlo.
  const turno1 = 'holis, en la tabla periodica que significa el numero atomico? siempre lo confundo con la masa'
  const turno2 = 'ay pero no me explicaste la diferencia jaja, la tabla no me dice que ES el numero atomico'
  const turno3 = 'no jaja otra vez la misma tabla. mi pregunta es conceptual: que representa fisicamente el numero atomico de un atomo? no quiero la tabla'
  const turno4 = 'hola? sigues mandando la misma tabla como robot, ya la vi 3 veces. contesta con palabras no con tabla porfavor'
  assert.equal(isExplicitTableRequest(turno1), false, 'turno1: "tabla periódica" es un término de química, no una petición de formato')
  assert.equal(isExplicitTableRequest(turno2), false, 'turno2: reclamo, no petición')
  assert.equal(isExplicitTableRequest(turno3), false, 'turno3: rechazo explícito ("no quiero la tabla")')
  assert.equal(isExplicitTableRequest(turno4), false, 'turno4: rechazo explícito ("contesta con palabras no con tabla")')
  assert.equal(isTableRejection(turno3), true)
  assert.equal(isTableRejection(turno4), true)

  // Las peticiones legítimas de tabla (sin mención de "tabla periódica" ni
  // frase de rechazo) deben seguir funcionando exactamente igual que antes.
  for (const frase of [
    'una tabla comparando célula procariota vs eucariota',
    'ponme la información en tabla',
    'quiero un table con los datos',
    'me lo puedes poner en forma de tabla',
    'hazme una tabla con los planetas del sistema solar',
  ]) {
    assert.equal(isExplicitTableRequest(frase), true, frase)
  }

  console.log('chat-formatting smoke passed')
}

main()
