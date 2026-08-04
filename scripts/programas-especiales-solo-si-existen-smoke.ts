// Hallazgo real (reporte del usuario, 2026-08-04): "se agregaron esas materias
// pero no debió agregar las otras clases si no existían".
//
// El alumno elegía "Olimpiadas de Ciencias", el submenú le ofrecía Matemática,
// Biología, Física, Química y Ciencias Naturales, y al elegir cualquiera
// chocaba con "no tengo suficiente información para responder eso". Los logs
// de producción confirmaron que ninguna de las diez rutas probadas existía:
//
//   Construyendo indice: Owlaris/Colegio Montano y Escolaris/Olimpiadas de
//                        Ciencias/Matematica/Primaria
//   ...y nueve más, ninguna con "✅ Índice construido".
//
// La causa: las materias normales salen de las carpetas REALES de SharePoint
// (leerCarpetasGrado), pero Olimpiadas y Mineduc se agregaban por una lista
// fija según el grado, y el submenú de Olimpiadas era un texto escrito a mano
// con las cinco materias posibles. Dos fuentes de verdad distintas para lo
// mismo.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getSharedSubjectChipsForGrade } from '../src/lib/sharepointFolders'

function main() {
  const route = readFileSync(join(__dirname, '..', 'src/app/api/preguntar/route.ts'), 'utf8')

  // 1. Un programa especial solo se ofrece si tiene contenido cargado.
  assert.match(
    route,
    /if \(materia === 'Olimpiadas de Ciencias' && olimpiadasReales\.length === 0\) return/,
    'Olimpiadas no debe ofrecerse cuando no hay carpetas de materia cargadas'
  )
  assert.match(
    route,
    /if \(materia\.startsWith\('Mineduc'\) && mineducReales\.length === 0\) return/,
    'Mineduc no debe ofrecerse cuando no hay contenido para ese grado'
  )

  // 2. El submenú de Olimpiadas se arma con las materias reales, no con la
  //    lista fija de cinco.
  assert.doesNotMatch(
    route,
    /¿De cuál materia\? Matemática, Biología, Física, Química o Ciencias Naturales/,
    'el submenú ya no puede ser una lista escrita a mano'
  )
  assert.match(
    route,
    /const olimpiadasReales = await materiasOlimpiadasDisponibles\(/,
    'el submenú debe consultar qué materias de Olimpiadas existen'
  )

  // 3. Si no hay ninguna, se dice claramente en vez de ofrecer un menú que
  //    lleva a "no tengo suficiente información".
  assert.match(
    route,
    /Todavía no hay material de Olimpiadas cargado para tu grado/,
    'sin material, hay que decirlo en vez de ofrecer materias que fallarán'
  )

  // 4. La regla por grado sigue intacta: es un filtro ADICIONAL, no un
  //    reemplazo. Primaria nunca ve Olimpiadas, tenga o no carpetas.
  for (const grado of ['4to Primaria', '5to Primaria', '6to Primaria']) {
    assert.ok(
      !getSharedSubjectChipsForGrade(grado).includes('Olimpiadas de Ciencias'),
      `${grado} no debe ver Olimpiadas`
    )
  }
  assert.ok(
    getSharedSubjectChipsForGrade('5to Bachillerato').includes('Olimpiadas de Ciencias'),
    '5to Bachillerato sí puede ver Olimpiadas (si hay contenido)'
  )
  assert.ok(
    getSharedSubjectChipsForGrade('5to Bachillerato').some((m) => m.startsWith('Mineduc')),
    '5to Bachillerato sí puede ver Mineduc (si hay contenido)'
  )

  // 5. Hallazgo real (captura del usuario, 2026-08-04): en 5to Primaria del
  //    Colegio Escolaris, "Olimpiadas de Ciencias - Matemática" es una carpeta
  //    REAL del grado del alumno (aparece como chip junto a "Matemáticas
  //    Primaria" y "Science Primaria"). Pero como el nombre empieza con
  //    "Olimpiadas", la búsqueda se desviaba al programa compartido —
  //    .../Olimpiadas de Ciencias/Matematica/Primaria, que no existe — y se
  //    rendía sin mirar nunca la carpeta de la que salió el chip.
  //
  //    El programa compartido debe ser una PREFERENCIA, no un desvío
  //    exclusivo: si no da resultado, se busca como materia normal del grado.
  assert.doesNotMatch(
    route,
    /if \(materia\.startsWith\('Olimpiadas'\) && permitirCompartidas\) \{[\s\S]{0,1200}\n  \} else \{/,
    'la rama de Olimpiadas no puede ser excluyente: si no encuentra nada debe seguir la búsqueda normal'
  )
  assert.match(
    route,
    /Sin contenido en el programa compartido de Olimpiadas[\s\S]{0,1400}if \(indice\.length === 0\) \{\s*\n\s*const buscarEnGrado/,
    'tras fallar el programa compartido debe ejecutarse la búsqueda normal del grado'
  )

  console.log('programas-especiales-solo-si-existen smoke passed')
}

main()
