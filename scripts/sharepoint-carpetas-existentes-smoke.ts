import assert from 'node:assert/strict'
import { resolverCarpetasExistentes } from '../src/lib/sharepointFolders'

async function main() {
  // Caso real (Colegio Montano y Escolaris, verificación en vivo
  // 2026-07-13): de ~10 variantes de ortografía candidatas, solo UNA
  // existe de verdad en SharePoint. Debe devolver solo esa, para que el
  // resto de la búsqueda (grado x materia) itere sobre 1 carpeta y no 10.
  const candidatos = [
    'Montano Escolaris',
    'Montano y Escolaris',
    'Colegio Montano - Colegio Escolaris',
    'Colegio Montano y Colegio Escolaris',
    'Colegio Montano y Escolaris',
    'Colegio Escolaris',
    'Escolaris',
    'colegio-escolaris',
  ]
  let llamadas = 0
  const resultado = await resolverCarpetasExistentes(candidatos, async (candidato) => {
    llamadas += 1
    return candidato === 'Colegio Montano y Escolaris'
  })
  assert.deepEqual(resultado, ['Colegio Montano y Escolaris'])
  assert.equal(llamadas, candidatos.length, 'debe probar todas las variantes EN PARALELO (una sola vez cada una)')

  // Caso con más de una carpeta real (colegio con dos escuelas separadas
  // que ambas tienen contenido) — no debe perder ninguna, para no romper
  // la búsqueda si el documento vive en la otra carpeta real.
  const conDosReales = await resolverCarpetasExistentes(
    ['Colegio Montano', 'Colegio Escolaris', 'Variante Inexistente'],
    async (c) => c === 'Colegio Montano' || c === 'Colegio Escolaris'
  )
  assert.deepEqual(conDosReales, ['Colegio Montano', 'Colegio Escolaris'])

  // Caso en que NINGUNA variante candidata existe (falla de datos real, o
  // error transitorio de red en todas): debe devolver la lista original
  // sin filtrar como respaldo seguro, en vez de quedarse con una lista
  // vacía que haría fallar toda la búsqueda de inmediato.
  const ningunaExiste = await resolverCarpetasExistentes(
    ['Colegio X', 'Colegio Y'],
    async () => false
  )
  assert.deepEqual(ningunaExiste, ['Colegio X', 'Colegio Y'])

  // Con 0 o 1 candidato no tiene sentido resolver nada — se devuelve tal
  // cual sin llamar al predicado (no hay ambigüedad de ortografía que
  // resolver).
  let llamadasUnico = 0
  const unico = await resolverCarpetasExistentes(['eScholaris'], async () => { llamadasUnico += 1; return true })
  assert.deepEqual(unico, ['eScholaris'])
  assert.equal(llamadasUnico, 0)

  const vacio = await resolverCarpetasExistentes([], async () => true)
  assert.deepEqual(vacio, [])

  console.log('sharepoint-carpetas-existentes smoke passed')
}

main()
