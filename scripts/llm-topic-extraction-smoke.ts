import assert from 'node:assert/strict'
import { extraerTemasConModelo, parseTemasLLMResponse, recortarAntesDeBancoEjercicios, temasLLMCacheKey } from '../src/lib/llmTopicExtraction'

function fakeOpenAI(respuestas: string[]) {
  let llamadas = 0
  const contenidosEnviados: string[] = []
  const cliente = {
    chat: {
      completions: {
        create: async (params: { messages: { role: string; content: string }[] }) => {
          contenidosEnviados.push(params.messages[params.messages.length - 1].content)
          const contenido = respuestas[Math.min(llamadas, respuestas.length - 1)]
          llamadas += 1
          return { choices: [{ message: { content: contenido } }] }
        },
      },
    },
  }
  return {
    cliente: cliente as unknown as Parameters<typeof extraerTemasConModelo>[0],
    getLlamadas: () => llamadas,
    getContenidosEnviados: () => contenidosEnviados,
  }
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

  // Hallazgo real (QA 2026-07-14, Prim4mate7.docx): el modelo marcó
  // "es_tema_curricular: true" para una oración explicativa completa (con
  // viñetas internas y más de 12 palabras) en vez de un tema real —
  // parseTemasLLMResponse no debe confiar solo en esa bandera, debe aplicar
  // el mismo filtro determinístico (isProbablyTopic) que ya protege al
  // respaldo estructural.
  const respuestaConOracionExplicativa = JSON.stringify({
    items: [
      { texto: 'Sistema de numeración maya', es_tema_curricular: true },
      { texto: 'Un punto (●) vale 1• Una barra (—) vale 5• Un caracol o concha representa el 0', es_tema_curricular: true },
      { texto: 'Sistema de numeración romano', es_tema_curricular: true },
    ],
  })
  assert.deepEqual(
    parseTemasLLMResponse(respuestaConOracionExplicativa),
    ['Sistema de numeración maya', 'Sistema de numeración romano']
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

  // Hallazgo real CRÍTICO (tercera vía, con evidencia real del documento
  // fuente vía logs de diagnóstico): dos intentos de prompt no bastaron
  // porque el modelo SÍ VE el "Banco de práctica integrado" (con sus
  // "Texto 1: ...", "Texto 2: ..." de lecturas de otras materias) y lo
  // generaliza como una lista de temas, sin importar la instrucción. La
  // tercera vía recorta el documento ANTES de esa sección, para que el
  // modelo nunca la vea. Se reproduce la estructura real exacta.
  const documentoRealLenguaje = `Quinto Bachillerato — Ejercicios para Mineduc Lenguaje
Contenido interno para ambiente de pruebas.

Propósito del paquete

Este paquete está diseñado para preparar práctica intensiva de Lenguaje para Quinto Bachillerato. El enfoque principal es comprensión lectora y análisis literal, inferencial y crítico a partir de textos breves.

Reglas de uso del paquete

Este paquete queda en versión alumno únicamente.

Banco de práctica integrado

NIVEL LITERAL

Texto 1: "La teoría de la relatividad general, publicada por Einstein en 1915..."
¿Qué confirmó el eclipse solar de 1919 según el texto?

Texto 2: Marco Legal de la Educación en Guatemala
Constitución Política de la República:

Texto 3: El Corredor Seco y la Captación de Agua
"El Corredor Seco de Guatemala es una de las regiones más vulnerables al cambio climático..."

Texto 4: Remesas y Economía Familiar
"Las remesas familiares se han convertido en el motor principal de la economía guatemalteca..."

Texto 5: Miguel Ángel Asturias y el Realismo Mágico
"Miguel Ángel Asturias, Premio Nobel de Literatura 1967..."`

  assert.doesNotMatch(recortarAntesDeBancoEjercicios(documentoRealLenguaje), /Banco de pr[aá]ctica/i)
  assert.doesNotMatch(recortarAntesDeBancoEjercicios(documentoRealLenguaje), /Texto \d+:/)
  assert.match(recortarAntesDeBancoEjercicios(documentoRealLenguaje), /Propósito del paquete/)
  assert.match(recortarAntesDeBancoEjercicios(documentoRealLenguaje), /comprensión lectora y análisis literal/)

  const { cliente: clienteDocReal, getContenidosEnviados } = fakeOpenAI([
    JSON.stringify({
      items: [
        { texto: 'Comprensión lectora', es_tema_curricular: true },
        { texto: 'Análisis literal', es_tema_curricular: true },
        { texto: 'Análisis inferencial', es_tema_curricular: true },
        { texto: 'Análisis crítico', es_tema_curricular: true },
      ],
    }),
  ])
  const temasDocReal = await extraerTemasConModelo(clienteDocReal, documentoRealLenguaje, 'Quinto Bachillerato-Lenguaje-Ejercicios para Mineduc Lenguaje.docx')
  assert.deepEqual(temasDocReal, ['Comprensión lectora', 'Análisis literal', 'Análisis inferencial', 'Análisis crítico'])
  const contenidoEnviadoAlModelo = getContenidosEnviados()[0]
  assert.doesNotMatch(contenidoEnviadoAlModelo, /Texto \d+:/, 'el modelo nunca debe ver el banco de ejercicios, para que no pueda confundirlo con temas')
  assert.doesNotMatch(contenidoEnviadoAlModelo, /Banco de pr[aá]ctica/i)

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

  // Hallazgo real (QA 2026-07-14, Estadística Descriptiva): un documento de
  // 27432 caracteres (sin marcador de banco de ejercicios) se cortaba a
  // 16000 caracteres ANTES de que el modelo pudiera ver el resto —
  // devolvía 0 temas aunque el documento sí tuviera un índice real más
  // adelante. El modelo debe recibir contenido mucho más allá de ese
  // límite viejo.
  const contenidoLargoSinBanco = 'Introducción sin temas todavía. '.repeat(1000) + 'Tema real al final del documento.'
  assert.ok(contenidoLargoSinBanco.length > 16000, 'el contenido de prueba debe superar el límite viejo para ser una prueba real')
  const { cliente: cliente5, getContenidosEnviados: getContenidosEnviados5 } = fakeOpenAI(['{"items": []}'])
  await extraerTemasConModelo(cliente5, contenidoLargoSinBanco, 'Doc-Largo.docx')
  const contenidoEnviado5 = getContenidosEnviados5()[0]
  assert.ok(contenidoEnviado5.length > 16000, 'el modelo debe recibir más de los 16000 caracteres del límite viejo')
  assert.match(contenidoEnviado5, /Tema real al final del documento/, 'el final del documento no debe quedar cortado antes de llegar al modelo')

  console.log('llm-topic-extraction smoke passed')
}

main()
