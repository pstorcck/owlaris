import assert from 'node:assert/strict'
import { matchNumberedListSelection } from '../src/lib/courseTopics'

function main() {
  const listaBiologia = 'Podemos trabajar cualquiera de estos temas:\n1. Células\n2. Genética\n3. Evolución\n4. Ecología'

  const seleccion = matchNumberedListSelection('2', listaBiologia)
  assert.ok(seleccion)
  assert.equal(seleccion?.indice, 2)
  assert.equal(seleccion?.tema, 'Genética')

  assert.equal(matchNumberedListSelection('2.', listaBiologia)?.tema, 'Genética')
  assert.equal(matchNumberedListSelection('2)', listaBiologia)?.tema, 'Genética')
  assert.equal(matchNumberedListSelection('opción 2', listaBiologia)?.tema, 'Genética')
  assert.equal(matchNumberedListSelection('número 2', listaBiologia)?.tema, 'Genética')
  assert.equal(matchNumberedListSelection('el 2', listaBiologia)?.tema, 'Genética')
  assert.equal(matchNumberedListSelection('  4  ', listaBiologia)?.tema, 'Ecología')

  // Fuera de rango: no debe inventar una selección.
  assert.equal(matchNumberedListSelection('9', listaBiologia), null)
  assert.equal(matchNumberedListSelection('0', listaBiologia), null)

  // Sin lista numerada reciente (ej. mensaje del tutor era un ejercicio de
  // matemática), un número suelto NO debe interpretarse como selección —
  // debe seguir evaluándose como respuesta de ejercicio en otro lugar.
  const mensajeSinLista = '¿Cuánto es 3 + 5? [OP: 3+5]'
  assert.equal(matchNumberedListSelection('8', mensajeSinLista), null)

  // Una sola línea "numerada" no es un menú real (podría ser coincidencia).
  const listaDeUnItem = 'Trabajemos con esto:\n1. Único tema disponible'
  assert.equal(matchNumberedListSelection('1', listaDeUnItem), null)

  assert.equal(matchNumberedListSelection('genética por favor', listaBiologia), null)

  // Bug real encontrado con datos realistas: si el tutor numera preguntas o
  // instrucciones de ejercicio (no temas reales), un número suelto del
  // alumno NO debe interpretarse como selección de "tema" — sigue siendo
  // (o debería seguir siendo) una respuesta de ejercicio en otro lugar.
  const preguntasNumeradas = '1. ¿Cuánto es 5 + 3?\n2. ¿Cuánto es 8 - 2?'
  assert.equal(matchNumberedListSelection('2', preguntasNumeradas), null)
  const instruccionesNumeradas = '1) Explica la Revolución Francesa\n2) Explica la Revolución Industrial'
  assert.equal(matchNumberedListSelection('1', instruccionesNumeradas), null)

  // ── Ampliación pedida en el instructivo: número embebido en una frase de
  // selección, ordinales, y referencia por nombre de tema ──
  const listaAlgebra = [
    'Podemos trabajar cualquiera de estos temas:',
    '1. Ecuaciones y desigualdades',
    '2. Funciones',
    '3. Sistemas de ecuaciones',
    '4. Polinomios',
    '5. Radicales y exponentes',
    '6. Progresiones',
  ].join('\n')

  assert.equal(matchNumberedListSelection('quiero el 4', listaAlgebra)?.tema, 'Polinomios')
  assert.equal(matchNumberedListSelection('dame el número 8', listaAlgebra), null) // fuera de rango
  assert.equal(matchNumberedListSelection('el tema 6', listaAlgebra)?.tema, 'Progresiones')
  assert.equal(matchNumberedListSelection('quiero practicar el tema 6', listaAlgebra)?.tema, 'Progresiones')
  assert.equal(matchNumberedListSelection('explícame el 4', listaAlgebra)?.tema, 'Polinomios')

  // Ordinales: "quiero el segundo" ahora SÍ selecciona (antes no se
  // reconocía) — cambio de comportamiento pedido explícitamente.
  assert.equal(matchNumberedListSelection('quiero el segundo', listaBiologia)?.tema, 'Genética')
  assert.equal(matchNumberedListSelection('volvamos al primero', listaAlgebra)?.tema, 'Ecuaciones y desigualdades')
  assert.equal(matchNumberedListSelection('el tercero', listaAlgebra)?.tema, 'Sistemas de ecuaciones')
  assert.equal(matchNumberedListSelection('el último', listaAlgebra)?.tema, 'Progresiones')

  // Por nombre de tema.
  assert.equal(matchNumberedListSelection('el de funciones', listaAlgebra)?.tema, 'Funciones')
  assert.equal(matchNumberedListSelection('quiero el de radicales', listaAlgebra)?.tema, 'Radicales y exponentes')
  assert.equal(matchNumberedListSelection('el de genética', listaBiologia)?.tema, 'Genética')

  // Un mensaje largo no es una selección simple, aunque termine en número.
  assert.equal(
    matchNumberedListSelection('no entiendo nada de lo que me estás explicando en esta clase tan larga y confusa 4', listaAlgebra),
    null
  )

  console.log('topic-selection smoke passed')
}

main()
