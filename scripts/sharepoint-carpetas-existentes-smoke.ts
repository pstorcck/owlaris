import assert from 'node:assert/strict'
import { getSharedSubjectChipsForGrade, resolverCarpetasExistentes } from '../src/lib/sharepointFolders'

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

  // Hallazgo real (QA 2026-07-14): "Olimpiadas de Ciencias" aparecía para
  // 4to Primaria aunque el contenido de Olimpiadas no está pensado para
  // ese nivel — debe verse desde Básico/Bachillerato en adelante, pero no
  // en Primaria.
  assert.deepEqual(getSharedSubjectChipsForGrade('4to Primaria'), [])
  assert.deepEqual(getSharedSubjectChipsForGrade('5to Primaria'), [])
  assert.deepEqual(getSharedSubjectChipsForGrade('6to Primaria'), [])
  assert.deepEqual(getSharedSubjectChipsForGrade('1ero Básico'), ['Olimpiadas de Ciencias'])
  assert.deepEqual(getSharedSubjectChipsForGrade('2do Básico'), ['Olimpiadas de Ciencias'])
  assert.deepEqual(getSharedSubjectChipsForGrade('3ero Básico'), ['Mineduc - Lenguaje', 'Mineduc - Matemática', 'Olimpiadas de Ciencias'])
  assert.deepEqual(getSharedSubjectChipsForGrade('4to Bachillerato'), ['Olimpiadas de Ciencias'])
  assert.deepEqual(getSharedSubjectChipsForGrade('5to Bachillerato'), ['Mineduc - Lenguaje', 'Mineduc - Matemática', 'Olimpiadas de Ciencias'])
  assert.deepEqual(getSharedSubjectChipsForGrade('Grado 8'), ['Olimpiadas de Ciencias'])
  assert.deepEqual(getSharedSubjectChipsForGrade(''), [])
  assert.deepEqual(getSharedSubjectChipsForGrade(null), [])

  console.log('sharepoint-carpetas-existentes smoke passed')
}

main()
