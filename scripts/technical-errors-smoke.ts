import assert from 'node:assert/strict'
import {
  clasificarErrorTecnico,
  construirContextoErrorTecnico,
  mensajeErrorTecnico,
} from '../src/lib/technicalErrors'

function main() {
  assert.equal(clasificarErrorTecnico({ status: 429 }), 'openai_agotado')
  assert.equal(clasificarErrorTecnico({ status: 503 }), 'openai_agotado')
  assert.equal(clasificarErrorTecnico(new Error('SharePoint request timed out')), 'fuente_no_disponible')
  assert.equal(clasificarErrorTecnico(new Error('fetch failed')), 'fuente_no_disponible')
  assert.equal(clasificarErrorTecnico(new Error('No se encontró la materia solicitada')), 'materia_no_disponible')
  assert.equal(clasificarErrorTecnico(new Error('algo inesperado explotó')), 'error_interno')

  assert.equal(
    mensajeErrorTecnico({ tipo: 'error_interno' }),
    'Tuvimos un problema técnico al cargar la respuesta. Intenta nuevamente en unos segundos.'
  )
  assert.match(
    mensajeErrorTecnico({ tipo: 'materia_no_disponible', materiaNombre: 'Algebra 2' }),
    /No pude cargar Algebra 2 en este momento/
  )
  assert.match(
    mensajeErrorTecnico({ tipo: 'fuente_no_disponible' }),
    /No pude cargar el contenido de esta materia/
  )
  assert.match(
    mensajeErrorTecnico({ tipo: 'materia_no_disponible', materiaNombre: 'Algebra 2', idiomaIngles: true }),
    /could not load Algebra 2/
  )
  // Sin nombre de materia, cae al mensaje genérico de fuente en vez de dejar
  // un hueco en el texto.
  assert.match(
    mensajeErrorTecnico({ tipo: 'materia_no_disponible' }),
    /Tuvimos un problema técnico/
  )

  const contexto = construirContextoErrorTecnico({
    ruta: '/api/preguntar',
    usuarioId: 'user-123',
    materia: 'Algebra 2',
    grado: 'Grado 9',
    accion: 'responder_pregunta',
    fuenteEsperada: 'Owlaris - Algebra 2.md',
    mensajeMostrado: 'No pude cargar Algebra 2 en este momento.',
    detalleError: 'fetch failed',
  })
  assert.match(contexto, /Usuario:user-123/)
  assert.match(contexto, /Materia:Algebra 2/)
  assert.match(contexto, /Grado:Grado 9/)
  assert.match(contexto, /Accion:responder_pregunta/)
  assert.match(contexto, /Fuente:Owlaris - Algebra 2\.md/)
  assert.match(contexto, /MensajeMostrado:/)
  assert.match(contexto, /Detalle:fetch failed/)

  console.log('technical-errors smoke passed')
}

main()
