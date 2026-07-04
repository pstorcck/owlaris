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

  // Si el alumno no responde con un número puro, no debe activarse.
  assert.equal(matchNumberedListSelection('quiero el segundo', listaBiologia), null)
  assert.equal(matchNumberedListSelection('genética por favor', listaBiologia), null)

  console.log('topic-selection smoke passed')
}

main()
