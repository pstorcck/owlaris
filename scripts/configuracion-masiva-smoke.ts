import assert from 'node:assert/strict'
import { construirFilasConfiguracionParaTodos } from '../src/lib/configuracionMasiva'

function main() {
  const ahora = '2026-07-06T12:00:00.000Z'
  const filas = construirFilasConfiguracionParaTodos(['col-1', 'col-2', 'col-3'], 'limite_preguntas_diarias', '999', ahora)

  assert.equal(filas.length, 3)
  for (const fila of filas) {
    assert.equal(fila.clave, 'limite_preguntas_diarias')
    assert.equal(fila.valor, '999')
    assert.equal(fila.actualizado_en, ahora)
  }
  assert.deepEqual(filas.map(f => f.colegio_id), ['col-1', 'col-2', 'col-3'])

  // IDs vacíos/nulos no deben generar filas inválidas.
  const conVacios = construirFilasConfiguracionParaTodos(['col-1', '', 'col-2'], 'modo_mantenimiento', 'false', ahora)
  assert.equal(conVacios.length, 2)
  assert.deepEqual(conVacios.map(f => f.colegio_id), ['col-1', 'col-2'])

  assert.deepEqual(construirFilasConfiguracionParaTodos([], 'clave', 'valor', ahora), [])

  console.log('configuracion-masiva smoke passed')
}

main()
