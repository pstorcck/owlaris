// Hallazgo real CRÍTICO (captura del usuario, 2026-08-04): en 5to Primaria del
// Colegio Escolaris el sidebar muestra "Olimpiadas de Ciencias - Matemática"
// como una materia más, junto a "Matemáticas Primaria" y "Science Primaria" —
// es una carpeta REAL del grado.
//
// Al hacer clic NO se seleccionaba esa materia: el chip entraba en la rama de
// olimpiadas porque su nombre CONTIENE "olimpiadas", abría un submenú de cinco
// botones fijos, y ese botón enviaba "Olimpiadas - Matemática", que es el
// programa COMPARTIDO y no existe para ese colegio. El alumno nunca podía
// llegar a su propia carpeta, así que ningún arreglo del servidor podía
// notarse: tres commits seguidos no cambiaron nada de lo que él veía.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function main() {
  const chat = readFileSync(
    join(__dirname, '..', 'src/components/chat/ChatInterface.tsx'),
    'utf8'
  )

  // El submenú se abre SOLO con el chip del programa compartido, por nombre
  // exacto. Con includes(), cualquier materia real que mencione olimpiadas
  // quedaba secuestrada.
  assert.match(
    chat,
    /const esOlimpiadas = claveMat === 'olimpiadas de ciencias' \|\| claveMat === 'science olympiad'/,
    'el submenú de olimpiadas debe activarse por nombre EXACTO del programa compartido'
  )
  assert.doesNotMatch(
    chat,
    /const esOlimpiadas = mat\.toLowerCase\(\)\.includes\('olimpiadas'\)/,
    'includes() secuestraba las materias reales del grado que mencionan olimpiadas'
  )

  // El estilo de trofeo sí se conserva para cualquiera de ellas: lo que cambia
  // es el comportamiento del clic, no la apariencia.
  assert.match(
    chat,
    /const pareceOlimpiadas = claveMat\.includes\('olimpiadas'\) \|\| claveMat\.includes\('olympiad'\)/,
    'el estilo de olimpiadas debe seguir aplicándose por coincidencia amplia'
  )
  assert.match(
    chat,
    /const bg = pareceOlimpiadas \?/,
    'el color debe usar la coincidencia amplia, no la del programa'
  )

  // Una materia real del grado debe enviarse con su nombre EXACTO, que es como
  // el servidor la encuentra en la carpeta del grado.
  assert.match(
    chat,
    /enviarPregunta\(mat, \{ forceEstado: 'esperando_materia' \}\)/,
    'una materia normal debe enviarse con su propio nombre'
  )

  console.log('chip-olimpiadas-materia-real smoke passed')
}

main()
