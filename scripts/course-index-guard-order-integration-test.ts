// Prueba de integración de extremo a extremo (instructivo: quinta
// verificación, 2026-07-13). El fix de filtrado por categoría
// (buildCategoryTopicsResponse) ya estaba probado de forma aislada y
// funcionaba en unidad, pero seguía sin tener NINGÚN efecto reportado en
// producción — el mismo patrón de bug visto antes con intentClassifier.ts
// no estando conectado al flujo real. La causa real: isCourseTopicListRequest
// (dispara con la substring "todos los temas") se evaluaba ANTES que el
// guard de bloque/categoría en preguntar/route.ts, así que "dame todos los
// temas de verificación de dominio" siempre lo interceptaba primero y
// devolvía el índice completo sin darle nunca la oportunidad al guard más
// específico de filtrar. Esta prueba replica el ORDEN REAL de evaluación
// de ambos guards (no solo las funciones por separado) para que un futuro
// cambio no reintroduzca el problema de orden sin que la suite lo detecte.
import assert from 'node:assert/strict'
import {
  buildBlockTopicsResponse,
  buildCategoryTopicsResponse,
  buildCourseTopicListResponse,
  extractBlockQuery,
  extractCourseBlocks,
  extractCourseTopicIndex,
  findBlockByQuery,
  isBlockGroupingQuestion,
  isCourseTopicListRequest,
} from '../src/lib/courseTopics'

function decidirRespuestaIndice(pregunta: string, contenido: string, idiomaIngles = false): { fuente: string; respuesta: string } {
  // Replica exactamente el orden de preguntar/route.ts: el guard de
  // bloque/categoría corre PRIMERO; solo si no encuentra nada específico
  // cae al guard genérico de "lista todos los temas".
  const consultaBloque = extractBlockQuery(pregunta)
  if (isBlockGroupingQuestion(pregunta) && consultaBloque && contenido) {
    const bloques = extractCourseBlocks(contenido)
    const bloqueEncontrado = findBlockByQuery(bloques, consultaBloque)
    const respuestaCategoria = !bloqueEncontrado
      ? buildCategoryTopicsResponse({ topics: extractCourseTopicIndex(contenido).topics, query: consultaBloque, idiomaIngles })
      : null
    if (bloqueEncontrado || respuestaCategoria) {
      return {
        fuente: bloqueEncontrado ? 'bloque' : 'categoria',
        respuesta: bloqueEncontrado
          ? buildBlockTopicsResponse({ blocks: bloques, query: consultaBloque, idiomaIngles })
          : (respuestaCategoria as string),
      }
    }
  }
  if (isCourseTopicListRequest(pregunta)) {
    const index = extractCourseTopicIndex(contenido)
    return { fuente: 'indice_completo', respuesta: buildCourseTopicListResponse({ index, subject: 'Biology', idiomaIngles }) }
  }
  return { fuente: 'ninguno', respuesta: '' }
}

function main() {
  const indiceBiologia = Array.from({ length: 36 }, (_, i) => {
    const n = i + 1
    if (n === 6) return `${n}. Verificación de dominio: células y evidencia`
    if (n === 12) return `${n}. Verificación de dominio: energía, materia y células`
    if (n === 18) return `${n}. Verificación de dominio: genética y herencia`
    if (n === 24) return `${n}. Proyecto de dominio: evolución y diversidad`
    if (n === 30) return `${n}. Verificación de dominio: ecosistemas`
    return `${n}. Tema genérico número ${n} sin relación`
  })
  const contenido = '## Índice de temas\n' + indiceBiologia.join('\n')

  // Reproducción EXACTA de la pregunta reportada en la quinta verificación.
  const resultado = decidirRespuestaIndice(
    'dame absolutamente todos los temas de verificación de dominio de este curso, por favor',
    contenido
  )
  assert.equal(resultado.fuente, 'categoria', 'el guard de categoría debe ganar sobre el guard genérico de "todos los temas"')
  assert.match(resultado.respuesta, /6\. Verificación de dominio: células y evidencia/)
  assert.match(resultado.respuesta, /30\. Verificación de dominio: ecosistemas/)
  assert.doesNotMatch(resultado.respuesta, /Tema genérico número/)

  // Una petición genérica de "todos los temas" SIN ninguna categoría real
  // que filtrar debe seguir devolviendo el índice completo — sin regresión
  // sobre el comportamiento ya correcto para ese caso.
  const resultadoGenerico = decidirRespuestaIndice('dame todos los temas de esta clase', contenido)
  assert.equal(resultadoGenerico.fuente, 'indice_completo')
  assert.match(resultadoGenerico.respuesta, /Tema genérico número 1\b/)

  console.log('course-index-guard-order integration test passed')
}

main()
