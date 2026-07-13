// Hallazgo real (instructivo de mejoras, ronda 2026-07-11), ítems 22-23 y
// 25: "qué sigue después de X" debe respetar el orden real del índice
// oficial de temas, y "¿este curso incluye X?" debe responderse con base
// en el índice real, no en una suposición del modelo.
import assert from 'node:assert/strict'
import {
  buildAreaPresenceResponse,
  buildBlockTopicsResponse,
  buildCategoryTopicsResponse,
  buildNextTopicResponse,
  buildStandardsAlignmentResponse,
  extractAreaQuery,
  extractBlockQuery,
  extractCourseBlocks,
  extractCourseTopicIndex,
  extractNextTopicReference,
  extractStandardFromPriorResponse,
  extractStandardMentionedInHistory,
  extractStandardQuery,
  filterTopicsByCategory,
  findBlockByQuery,
  findNextTopic,
  isBlockGroupingQuestion,
  isBroadAreaPresenceQuestion,
  isNextTopicRequest,
  isStandardsAlignmentQuestion,
  isStandardsCitationFollowUp,
} from '../src/lib/courseTopics'

type Failure = { name: string; message: string }
const failures: Failure[] = []
let total = 0

function test(name: string, fn: () => void) {
  total += 1
  try {
    fn()
  } catch (error) {
    failures.push({ name, message: error instanceof Error ? error.message : String(error) })
  }
}

function main() {
  const contenido = `
## Índice de temas
Cantidad de temas: 5
1. Fotosíntesis
2. Respiración celular
3. Mitosis
4. Meiosis
5. Genética básica
`
  const index = extractCourseTopicIndex(contenido)
  assert.equal(index.topics.length, 5)

  // Hallazgo real CRÍTICO (sexta verificación, 2026-07-13): "temas de esta
  // materia" respondía "no tengo suficiente información" para un documento
  // .docx REAL y correctamente encontrado — extraerTexto() lee .docx con
  // mammoth.extractRawText(), que DESCARTA los números/viñetas de una
  // lista nativa de Word (Word los dibuja desde numbering.xml, no forman
  // parte del texto del párrafo). Un índice de temas con ese formato (el
  // caso más común en documentos reales) se convierte en líneas sueltas de
  // texto plano SIN NINGÚN marcador — ninguna estrategia anterior podía
  // reconocerlas. Se reproduce ese escenario exacto (sin bullets/números).
  test('extractCourseTopicIndex reconoce un índice cuya lista nativa de Word perdió sus números/viñetas (mammoth.extractRawText)', () => {
    const contenidoSinMarcadores = [
      'Índice de temas',
      'Fracciones',
      'Decimales',
      'Ecuaciones lineales',
      'Geometría básica',
      '',
      'Objetivo: que el alumno domine las operaciones básicas.',
    ].join('\n')
    const indiceSinMarcadores = extractCourseTopicIndex(contenidoSinMarcadores)
    assert.deepEqual(indiceSinMarcadores.topics, ['Fracciones', 'Decimales', 'Ecuaciones lineales', 'Geometría básica'])
  })

  test('extractCourseTopicIndex reconoce "Tema 1: X" sin encabezado markdown (# también se pierde con mammoth)', () => {
    const contenidoSinAlmohadilla = [
      'Tema 1: Fracciones',
      'Tema 2: Decimales',
      'Tema 3: Ecuaciones lineales',
    ].join('\n')
    const indiceSinAlmohadilla = extractCourseTopicIndex(contenidoSinAlmohadilla)
    assert.equal(indiceSinAlmohadilla.topics.length, 3)
    assert.equal(indiceSinAlmohadilla.topics[0], 'Fracciones')
  })

  // Detección de la petición "qué sigue después de X".
  for (const frase of [
    'qué sigue después de la fotosíntesis',
    '¿qué viene después de mitosis?',
    'cuál es el siguiente tema después de respiración celular',
    'what comes after photosynthesis',
  ]) {
    test(`next-topic-request-detectado: ${frase}`, () => {
      assert.equal(isNextTopicRequest(frase), true, frase)
    })
  }

  test('extrae referencia del tema mencionado', () => {
    assert.equal(extractNextTopicReference('qué sigue después de la fotosíntesis'), 'la fotosíntesis')
    assert.equal(extractNextTopicReference('¿qué viene después de mitosis?'), 'mitosis')
    assert.equal(extractNextTopicReference('qué sigue en el curso'), null)
  })

  test('encuentra el siguiente tema respetando el orden real del índice', () => {
    const resultado = findNextTopic(index, 'fotosíntesis')
    assert.equal(resultado.actual?.tema, 'Fotosíntesis')
    assert.equal(resultado.siguiente?.tema, 'Respiración celular')
  })

  test('el último tema no tiene siguiente', () => {
    const resultado = findNextTopic(index, 'genética básica')
    assert.equal(resultado.actual?.tema, 'Genética básica')
    assert.equal(resultado.siguiente, null)
  })

  test('respuesta de siguiente tema cita el tema real del índice', () => {
    const respuesta = buildNextTopicResponse({ index, referencia: 'mitosis', idiomaIngles: false })
    assert.match(respuesta, /Meiosis/)
    assert.match(respuesta, /Mitosis/)
  })

  test('respuesta cuando el tema de referencia no está en el índice', () => {
    const respuesta = buildNextTopicResponse({ index, referencia: 'ecología', idiomaIngles: false })
    assert.match(respuesta, /no encontré/i)
  })

  // Ítem 25: preguntas de presencia de un área amplia.
  for (const frase of [
    '¿este curso incluye genética?',
    '¿esta clase incluye mitosis?',
    '¿vemos algo de meiosis en esta materia?',
    'does this course include genetics?',
  ]) {
    test(`area-presence-detectada: ${frase}`, () => {
      assert.equal(isBroadAreaPresenceQuestion(frase), true, frase)
    })
  }

  test('extrae el área consultada', () => {
    assert.equal(extractAreaQuery('¿este curso incluye genética?'), 'genética')
  })

  test('confirma presencia real basada en el índice', () => {
    const respuesta = buildAreaPresenceResponse({ index, area: 'genética', idiomaIngles: false })
    assert.match(respuesta, /Sí/)
    assert.match(respuesta, /Genética básica/)
  })

  test('responde con cautela cuando el área no está en el índice disponible', () => {
    const respuesta = buildAreaPresenceResponse({ index, area: 'ecología', idiomaIngles: false })
    assert.match(respuesta, /no veo/i)
    assert.doesNotMatch(respuesta, /^Sí/i)
  })

  // Ítem 24: reconocer bloques/agrupaciones de temas cuando la fuente los
  // organiza con encabezados de bloque/unidad antes de cada grupo.
  const contenidoConBloques = `
## Índice de temas
Cantidad de temas: 6
## Bloque 3: Campos e interacciones
1. Fuerza y movimiento
2. Energía en interacciones
3. Ondas y su propagación
## Bloque 4: Estructura de la materia
4. Átomos y moléculas
5. Estados de la materia
6. Reacciones químicas
`
  const bloques = extractCourseBlocks(contenidoConBloques)

  test('extrae los bloques con su nombre y el rango de temas correcto', () => {
    assert.equal(bloques.length, 2)
    assert.equal(bloques[0].nombre, 'Campos e interacciones')
    assert.deepEqual([bloques[0].desde, bloques[0].hasta], [1, 3])
    assert.equal(bloques[1].nombre, 'Estructura de la materia')
    assert.deepEqual([bloques[1].desde, bloques[1].hasta], [4, 6])
  })

  for (const frase of [
    '¿qué temas incluye el bloque de campos e interacciones?',
    '¿cuáles son los temas de la unidad de estructura de la materia?',
    'what topics does the block include for fields and interactions',
  ]) {
    test(`block-grouping-detectada: ${frase}`, () => {
      assert.equal(isBlockGroupingQuestion(frase), true, frase)
    })
  }
  test('no detecta agrupación en una pregunta normal', () => {
    assert.equal(isBlockGroupingQuestion('¿qué es la fotosíntesis?'), false)
  })

  test('extrae el nombre del bloque consultado', () => {
    assert.equal(extractBlockQuery('¿qué temas incluye el bloque de campos e interacciones?'), 'campos e interacciones')
  })

  test('responde con los temas reales del bloque consultado', () => {
    const respuesta = buildBlockTopicsResponse({ blocks: bloques, query: 'campos e interacciones', idiomaIngles: false })
    assert.match(respuesta, /Fuerza y movimiento/)
    assert.match(respuesta, /Ondas y su propagación/)
    assert.doesNotMatch(respuesta, /Átomos y moléculas/)
  })

  test('responde con cautela si el bloque consultado no existe en la fuente', () => {
    const respuesta = buildBlockTopicsResponse({ blocks: bloques, query: 'ecología', idiomaIngles: false })
    assert.match(respuesta, /no encontré/i)
  })

  test('sin bloques en la fuente (documento plano sin agrupar), no se inventan agrupaciones', () => {
    const sinBloques = extractCourseBlocks('## Índice de temas\n1. Fotosíntesis\n2. Respiración celular')
    assert.equal(sinBloques.length, 0)
  })

  // Hallazgo real (verificación posterior, 2026-07-12): "dame los temas de
  // campos e interacciones" (sin decir "bloque"/"unidad") no se reconocía
  // en absoluto — el sistema devolvía el índice completo sin filtrar.
  for (const frase of [
    'dame los temas de campos e interacciones',
    'cuáles son los temas de estructura de la materia',
    'give me the topics of fields and interactions',
  ]) {
    test(`block-grouping-generico-detectado: ${frase}`, () => {
      assert.equal(isBlockGroupingQuestion(frase), true, frase)
    })
  }

  // Hallazgo real (segunda verificación, 2026-07-12): "dame TODOS los temas
  // de X" no se detectaba porque la lista anterior usaba coincidencia de
  // substring exacto — la palabra "todos" insertada rompía la substring
  // literal "dame los temas de".
  for (const frase of [
    'dame todos los temas de campos e interacciones',
    'dame todas los temas de estructura de la materia',
    'cuales son todos los temas de campos e interacciones',
  ]) {
    test(`block-grouping-con-palabra-insertada-detectado: ${frase}`, () => {
      assert.equal(isBlockGroupingQuestion(frase), true, frase)
    })
  }

  // Hallazgo real CRÍTICO (tercera verificación, 2026-07-13): el arreglo
  // anterior enumeraba palabras insertables específicas (todos/todas), pero
  // "dame ABSOLUTAMENTE todos los temas de X" volvió a fallar porque
  // "absolutamente" no estaba en esa lista — la misma clase de bug con
  // palabras distintas. Ahora se tolera cualquier palabra intermedia
  // (hueco acotado en vez de una lista fija).
  for (const frase of [
    'dame absolutamente todos los temas de verificación de dominio de este curso, por favor',
    'quiero por favor absolutamente todos los temas de campos e interacciones',
  ]) {
    test(`block-grouping-con-cualquier-palabra-insertada-detectado: ${frase}`, () => {
      assert.equal(isBlockGroupingQuestion(frase), true, frase)
    })
  }

  test('petición genérica de temas de un bloque real (con palabra insertada arbitraria) encuentra el bloque correcto', () => {
    const query = extractBlockQuery('dame absolutamente todos los temas de campos e interacciones')
    const encontrado = findBlockByQuery(bloques, query)
    assert.equal(encontrado?.nombre, 'Campos e interacciones')
  })

  test('petición genérica de temas de un bloque real encuentra el bloque correcto', () => {
    const query = extractBlockQuery('dame los temas de campos e interacciones')
    const encontrado = findBlockByQuery(bloques, query)
    assert.equal(encontrado?.nombre, 'Campos e interacciones')
  })

  // Hallazgo real CRÍTICO (cuarta verificación, 2026-07-13): "dame todos los
  // temas de verificación de dominio" seguía devolviendo el índice COMPLETO
  // sin filtrar — el bug real no era de tolerancia a palabras insertadas
  // (ya se detectaba isBlockGroupingQuestion correctamente), sino que la
  // categoría pedida no es un BLOQUE con encabezado propio, sino una
  // palabra clave que se repite en el TÍTULO de temas individuales
  // dispersos en el índice. extractCourseBlocks nunca encontraba esto, así
  // que findBlockByQuery siempre fallaba y el flujo caía al índice
  // completo. Se reproduce el índice real reportado (36 temas, con
  // "Verificación de dominio"/"Proyecto de dominio" en las posiciones 6,
  // 12, 18, 24 y 30) para confirmar que el filtro por categoría SÍ acota
  // la respuesta a esos temas.
  const indiceBiologiaCompleto = Array.from({ length: 36 }, (_, i) => {
    const n = i + 1
    if (n === 6) return 'Verificación de dominio: células y evidencia'
    if (n === 12) return 'Verificación de dominio: energía, materia y células'
    if (n === 18) return 'Verificación de dominio: genética y herencia'
    if (n === 24) return 'Proyecto de dominio: evolución y diversidad'
    if (n === 30) return 'Verificación de dominio: ecosistemas'
    return `Tema genérico número ${n} sin relación`
  })

  test('extractBlockQuery recorta el ruido final ("de este curso, por favor") antes de buscar', () => {
    const query = extractBlockQuery('dame absolutamente todos los temas de verificación de dominio de este curso, por favor')
    assert.equal(query, 'verificación de dominio')
  })

  test('filterTopicsByCategory acota el índice completo a solo los temas de la categoría pedida', () => {
    const filtrados = filterTopicsByCategory(indiceBiologiaCompleto, 'verificación de dominio')
    assert.equal(filtrados.length, 5)
    assert.deepEqual(filtrados.map((f) => f.indice), [6, 12, 18, 24, 30])
    assert.match(filtrados[3].tema, /Proyecto de dominio/)
  })

  test('buildCategoryTopicsResponse responde SOLO con los temas de la categoría, no el índice completo de 36', () => {
    const respuesta = buildCategoryTopicsResponse({ topics: indiceBiologiaCompleto, query: 'verificación de dominio', idiomaIngles: false })
    assert.notEqual(respuesta, null)
    assert.match(respuesta || '', /6\. Verificación de dominio: células y evidencia/)
    assert.match(respuesta || '', /30\. Verificación de dominio: ecosistemas/)
    assert.doesNotMatch(respuesta || '', /Tema genérico número/)
  })

  test('buildCategoryTopicsResponse devuelve null cuando la categoría no acota nada (sin palabras clave útiles)', () => {
    assert.equal(buildCategoryTopicsResponse({ topics: indiceBiologiaCompleto, query: 'de la', idiomaIngles: false }), null)
  })

  test('una petición genérica de temas SIN relación a ningún bloque real no encuentra coincidencia (debe seguir el flujo normal)', () => {
    const query = extractBlockQuery('dame los temas de esta clase')
    const encontrado = findBlockByQuery(bloques, query)
    assert.equal(encontrado, null)
  })

  // Hallazgo real CRÍTICO (verificación posterior, 2026-07-12): al
  // preguntar si el curso está alineado con NGSS, el modelo respondía con
  // total confianza una alineación inventada, sin ninguna fuente real.
  const contenidoConEstandar = 'Índice de temas alineado al estándar NGSS para ciencias.\n1. Fotosíntesis\n2. Genética'
  const contenidoSinEstandar = 'Índice de temas\n1. Fotosíntesis\n2. Genética'

  for (const frase of [
    '¿está el curso alineado con NGSS?',
    '¿cumple con los estándares de Common Core?',
    'does this course meet NGSS standards?',
    'is this course aligned with NGSS?',
  ]) {
    test(`standards-alignment-detectada: ${frase}`, () => {
      assert.equal(isStandardsAlignmentQuestion(frase), true, frase)
    })
  }
  test('no detecta alineación curricular en una pregunta normal', () => {
    assert.equal(isStandardsAlignmentQuestion('¿qué es la fotosíntesis?'), false)
  })

  test('confirma alineación solo cuando el estándar aparece literalmente en la fuente', () => {
    const respuesta = buildStandardsAlignmentResponse({ content: contenidoConEstandar, standard: 'NGSS', idiomaIngles: false })
    assert.match(respuesta, /menciona expl[ií]citamente "NGSS"/)
  })

  test('responde con cautela y NO inventa una alineación cuando el estándar no está en la fuente', () => {
    const respuesta = buildStandardsAlignmentResponse({ content: contenidoSinEstandar, standard: 'NGSS', idiomaIngles: false })
    assert.match(respuesta, /no veo "NGSS" mencionado/i)
    assert.doesNotMatch(respuesta, /^S[ií]/i)
  })

  // Hallazgo real CRÍTICO (segunda verificación, 2026-07-12): la pregunta
  // directa de alineación se interceptaba, pero el seguimiento natural
  // ("cítame textualmente dónde dice eso") no repite el nombre del
  // estándar ni la frase de alineación, y caía a generación libre del
  // modelo — que inventó una justificación elaborada y falsa. La respuesta
  // inicial ahora incluye la línea literal donde aparece el estándar, y un
  // guard aparte reconoce el seguimiento para reutilizar el mismo
  // resultado determinístico.
  test('la respuesta de alineación incluye la línea literal donde aparece el estándar', () => {
    const respuesta = buildStandardsAlignmentResponse({ content: contenidoConEstandar, standard: 'NGSS', idiomaIngles: false })
    assert.match(respuesta, /línea literal en la fuente es/i)
    assert.match(respuesta, /alineado al est[aá]ndar NGSS/i)
  })

  for (const frase of [
    'cítame textualmente dónde dice eso',
    '¿en qué parte exacta dice eso?',
    'muéstrame textualmente donde',
    'show me exactly where it says that',
    // Hallazgo real CRÍTICO (tercera verificación, 2026-07-13): esta frase
    // exacta seguía sin interceptarse — "citar" (no "cítame") y "puedes
    // citar" no coincidían con los patrones anteriores.
    '¿puedes citar textualmente dónde dice eso?',
  ]) {
    test(`standards-citation-follow-up-detectado: ${frase}`, () => {
      assert.equal(isStandardsCitationFollowUp(frase), true, frase)
    })
  }
  test('no confunde una pregunta normal con un seguimiento de cita textual', () => {
    assert.equal(isStandardsCitationFollowUp('¿qué es la fotosíntesis?'), false)
  })

  test('recupera el estándar consultado de la respuesta anterior del guard (caso confirmado)', () => {
    const respuestaPrevia = buildStandardsAlignmentResponse({ content: contenidoConEstandar, standard: 'NGSS', idiomaIngles: false })
    assert.equal(extractStandardFromPriorResponse(respuestaPrevia), 'NGSS')
  })
  test('recupera el estándar consultado de la respuesta anterior del guard (caso no encontrado)', () => {
    const respuestaPrevia = buildStandardsAlignmentResponse({ content: contenidoSinEstandar, standard: 'NGSS', idiomaIngles: false })
    assert.equal(extractStandardFromPriorResponse(respuestaPrevia), 'NGSS')
  })
  test('no confunde un mensaje normal del asistente con una respuesta previa del guard', () => {
    assert.equal(extractStandardFromPriorResponse('Claro, la fotosíntesis es el proceso por el cual las plantas producen energía.'), null)
  })

  // Hallazgo real CRÍTICO (tercera verificación, 2026-07-13): el seguimiento
  // seguía sin resolverse en la práctica porque extractStandardFromPriorResponse
  // depende de que el turno anterior tenga EXACTAMENTE el formato canónico
  // de este guard — si la pregunta inicial se respondió de otra forma (o
  // hubo un turno intermedio), no se reconocía nada y el seguimiento caía a
  // generación libre, que alucinó una justificación nueva. El respaldo
  // busca el nombre del estándar en cualquier mensaje reciente del
  // historial, sin depender del formato exacto de este guard.
  test('extractStandardMentionedInHistory encuentra el estándar aunque el turno anterior no tenga el formato exacto del guard', () => {
    const historialSimulado = [
      { rol: 'usuario', contenido: '¿este curso está alineado con NGSS?' },
      { rol: 'asistente', contenido: 'Sí, el curso está diseñado con base en los estándares de NGSS, que son el marco fundacional para esta iniciativa.' },
    ]
    assert.equal(extractStandardMentionedInHistory(historialSimulado), 'NGSS')
  })
  test('extractStandardMentionedInHistory devuelve null si no hay ningún estándar conocido en el historial reciente', () => {
    const historialSimulado = [
      { rol: 'usuario', contenido: '¿qué es la fotosíntesis?' },
      { rol: 'asistente', contenido: 'La fotosíntesis es el proceso por el cual las plantas producen energía.' },
    ]
    assert.equal(extractStandardMentionedInHistory(historialSimulado), null)
  })

  if (failures.length > 0) {
    console.error(`course-topic-navigation smoke failed: ${failures.length}/${total}`)
    for (const failure of failures) {
      console.error(`- ${failure.name}: ${failure.message}`)
    }
    process.exit(1)
  }

  console.log(`course-topic-navigation smoke passed: ${total}/${total}`)
}

main()
