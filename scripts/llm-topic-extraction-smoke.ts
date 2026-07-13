import assert from 'node:assert/strict'
import { extraerTemasConModelo, parseTemasLLMResponse, temasLLMCacheKey } from '../src/lib/llmTopicExtraction'

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
  return { cliente: cliente as unknown as Parameters<typeof extraerTemasConModelo>[0], getLlamadas: () => llamadas }
}

async function main() {
  // parseTemasLLMResponse: casos básicos de parseo real con el esquema de
  // clasificación por ítem (texto + es_tema_curricular).
  assert.deepEqual(
    parseTemasLLMResponse('{"items": [{"texto": "Fracciones", "es_tema_curricular": true}, {"texto": "Álgebra", "es_tema_curricular": true}]}'),
    ['Fracciones', 'Álgebra']
  )
  assert.deepEqual(parseTemasLLMResponse('{"items": []}'), [])
  assert.deepEqual(parseTemasLLMResponse('esto no es json'), [])
  assert.deepEqual(parseTemasLLMResponse('{}'), [])
  assert.deepEqual(
    parseTemasLLMResponse('{"items": [{"texto": "  Trigonometría  ", "es_tema_curricular": true}, {"texto": "", "es_tema_curricular": true}, {"texto": "   ", "es_tema_curricular": true}, {"texto": 42, "es_tema_curricular": true}, {"texto": null, "es_tema_curricular": true}]}'),
    ['Trigonometría']
  )

  // Hallazgo real CRÍTICO (QA en vivo, 2026-07-13): un documento de
  // Lenguaje (banco de ejercicios de comprensión lectora) devolvió los 4
  // temas genuinos de comprensión SEGUIDOS de títulos de lecturas de otras
  // materias, presentados como si fueran temas de Lenguaje — y un intento
  // anterior de corregirlo con una sola instrucción de prompt no bastó (el
  // modelo repitió el mismo error). Se reproduce exactamente ese patrón
  // real: el modelo ahora debe marcar es_tema_curricular=false para los
  // títulos de lectura y el fragmento de encabezado suelto, y
  // parseTemasLLMResponse debe filtrarlos determinísticamente en código,
  // sin depender de que el modelo ya los haya excluido de la lista.
  const respuestaContaminadaClasificada = JSON.stringify({
    items: [
      { texto: 'Comprensión lectora', es_tema_curricular: true },
      { texto: 'Análisis literal', es_tema_curricular: true },
      { texto: 'Análisis inferencial', es_tema_curricular: true },
      { texto: 'Análisis crítico', es_tema_curricular: true },
      { texto: 'NIVEL LITERAL', es_tema_curricular: false },
      { texto: 'Estructura colonial', es_tema_curricular: false },
      { texto: 'Identidad criolla', es_tema_curricular: false },
      { texto: 'Cambio climático', es_tema_curricular: false },
      { texto: 'Remesas familiares', es_tema_curricular: false },
      { texto: 'Realismo mágico', es_tema_curricular: false },
      { texto: 'Cosmovisión maya', es_tema_curricular: false },
    ],
  })
  const { cliente: clienteLenguaje } = fakeOpenAI([respuestaContaminadaClasificada])
  const temasLenguaje = await extraerTemasConModelo(clienteLenguaje, 'contenido banco de ejercicios lenguaje mineduc', 'Lenguaje-Ejercicios-Mineduc.docx')
  assert.deepEqual(temasLenguaje, ['Comprensión lectora', 'Análisis literal', 'Análisis inferencial', 'Análisis crítico'])
  assert.ok(!temasLenguaje.includes('Estructura colonial'))
  assert.ok(!temasLenguaje.includes('NIVEL LITERAL'))

  // temasLLMCacheKey: distingue por documento y longitud de contenido, para
  // no reusar el resultado de un documento distinto que coincida en nombre.
  assert.notEqual(temasLLMCacheKey('doc.docx', 100), temasLLMCacheKey('doc.docx', 200))
  assert.notEqual(temasLLMCacheKey('a.docx', 100), temasLLMCacheKey('b.docx', 100))

  // extraerTemasConModelo: primera llamada real al modelo (mock), y
  // confirma que devuelve los temas extraídos del JSON.
  const { cliente: cliente1, getLlamadas: llamadas1 } = fakeOpenAI([
    JSON.stringify({ items: [{ texto: 'Aritmética', es_tema_curricular: true }, { texto: 'Geometría', es_tema_curricular: true }] }),
  ])
  const temas1 = await extraerTemasConModelo(cliente1, 'contenido de prueba único 1', 'Doc-Prueba-1.docx')
  assert.deepEqual(temas1, ['Aritmética', 'Geometría'])
  assert.equal(llamadas1(), 1)

  // Segunda consulta para el MISMO documento (mismo nombre + misma
  // longitud de contenido) debe usar el caché — la llamada al modelo NO se
  // repite, que es justamente el punto de cachear por documento en vez de
  // por pregunta (evita pagar una llamada al modelo por cada alumno que
  // pregunta "temas de esta materia" sobre el mismo documento).
  const temas1otraVez = await extraerTemasConModelo(cliente1, 'contenido de prueba único 1', 'Doc-Prueba-1.docx')
  assert.deepEqual(temas1otraVez, ['Aritmética', 'Geometría'])
  assert.equal(llamadas1(), 1, 'debe reusar el caché por documento, no volver a llamar al modelo')

  // Un documento con NOMBRE o CONTENIDO distinto no debe reusar el caché
  // del documento anterior.
  const { cliente: cliente2, getLlamadas: llamadas2 } = fakeOpenAI([
    JSON.stringify({ items: [{ texto: 'Célula', es_tema_curricular: true }, { texto: 'Genética', es_tema_curricular: true }] }),
  ])
  const temas2 = await extraerTemasConModelo(cliente2, 'contenido de prueba único 2 (mas largo)', 'Doc-Prueba-2.docx')
  assert.deepEqual(temas2, ['Célula', 'Genética'])
  assert.equal(llamadas2(), 1)

  // Documento genuinamente sin lista de temas (ej. banco de ejercicios):
  // el modelo debe poder admitirlo explícitamente sin que se invente nada.
  const { cliente: cliente3 } = fakeOpenAI(['{"items": []}'])
  const temas3 = await extraerTemasConModelo(cliente3, 'banco de ejercicios sin indice de temas', 'Banco-Ejercicios.docx')
  assert.deepEqual(temas3, [])

  // Respuesta malformada del modelo (nunca debe tirar la petición completa)
  const { cliente: cliente4 } = fakeOpenAI(['no es json valido'])
  const temas4 = await extraerTemasConModelo(cliente4, 'contenido con respuesta malformada', 'Doc-Malformado.docx')
  assert.deepEqual(temas4, [])

  console.log('llm-topic-extraction smoke passed')
}

main()
