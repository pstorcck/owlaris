import assert from 'node:assert/strict'
import { traducirTemasAIngles } from '../src/lib/topicTranslation'

function fakeOpenAI(respuestas: string[]) {
  let llamadas = 0
  const cliente = {
    chat: {
      completions: {
        create: async () => {
          const contenido = respuestas[Math.min(llamadas, respuestas.length - 1)]
          llamadas += 1
          return { choices: [{ message: { content: contenido } }] }
        },
      },
    },
  }
  return { cliente: cliente as unknown as Parameters<typeof traducirTemasAIngles>[0], getLlamadas: () => llamadas }
}

async function main() {
  const temasEspanol = [
    'Productos notables, factorización y fracciones algebraicas',
    'Figuras planas, círculo y cuerpos sólidos',
  ]

  // Traducción exitosa: mismo orden y misma cantidad de elementos.
  const { cliente: cliente1, getLlamadas: llamadas1 } = fakeOpenAI([
    '{"temas": ["Special products, factoring, and algebraic fractions", "Plane figures, circles, and solids"]}',
  ])
  const traducidos1 = await traducirTemasAIngles(cliente1, temasEspanol)
  assert.deepEqual(traducidos1, ['Special products, factoring, and algebraic fractions', 'Plane figures, circles, and solids'])
  assert.equal(llamadas1(), 1)

  // Misma lista exacta de temas otra vez: debe usar el caché, no repetir la llamada.
  const traducidos1otraVez = await traducirTemasAIngles(cliente1, temasEspanol)
  assert.deepEqual(traducidos1otraVez, ['Special products, factoring, and algebraic fractions', 'Plane figures, circles, and solids'])
  assert.equal(llamadas1(), 1, 'debe reusar el caché, no volver a llamar al modelo por la misma lista')

  // Si la traducción devuelve MENOS o MÁS elementos que el original (riesgo
  // de lista desalineada o inventada), se descarta y se devuelve el
  // original en español — más seguro que arriesgar una lista incorrecta.
  const { cliente: cliente2 } = fakeOpenAI(['{"temas": ["Solo un tema traducido"]}'])
  const temasDistintos = ['Tema uno', 'Tema dos', 'Tema tres']
  const resultado2 = await traducirTemasAIngles(cliente2, temasDistintos)
  assert.deepEqual(resultado2, temasDistintos)

  // Respuesta malformada del modelo: nunca debe tirar la petición completa,
  // debe devolver el original. Se usa una lista DISTINTA a temasEspanol
  // para no reusar por accidente el caché ya poblado por la primera prueba.
  const temasParaMalformado = ['Ecuaciones lineales y sistemas', 'Geometría analítica básica']
  const { cliente: cliente3 } = fakeOpenAI(['no es json valido'])
  const resultado3 = await traducirTemasAIngles(cliente3, temasParaMalformado)
  assert.deepEqual(resultado3, temasParaMalformado)

  // Lista vacía: no debe llamar al modelo.
  let llamadasVacio = 0
  const clienteVacio = {
    chat: { completions: { create: async () => { llamadasVacio += 1; return { choices: [{ message: { content: '{}' } }] } } } },
  } as unknown as Parameters<typeof traducirTemasAIngles>[0]
  const resultadoVacio = await traducirTemasAIngles(clienteVacio, [])
  assert.deepEqual(resultadoVacio, [])
  assert.equal(llamadasVacio, 0)

  console.log('topic-translation smoke passed')
}

main()
