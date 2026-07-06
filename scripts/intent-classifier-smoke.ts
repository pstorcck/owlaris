import assert from 'node:assert/strict'
import { clasificarIntencion, estadoPedagogicoInicial } from '../src/lib/intentClassifier'

function main() {
  const estadoInicial = estadoPedagogicoInicial()
  assert.equal(estadoInicial.ejercicioActivo, null)
  assert.equal(estadoInicial.ultimaIntencionAlumno, null)
  assert.equal(estadoInicial.nivelDificultad, 1)

  // Ejemplo del instructivo (sección A): alumno con Matemática activa (una
  // materia del sistema CNB) menciona un tema claramente de otra materia
  // (Historia) mientras hay una ecuación pendiente — debe clasificarse como
  // cambio_materia_grado, no como respuesta al ejercicio.
  const cambioMateria = clasificarIntencion({
    pregunta: 'Explícame la revolución francesa',
    ultimoMensajeAsistente: 'Resuelve: 2x + 5 = 17',
    hayEjercicioActivo: true,
    materiaActivaId: 'Matemática',
  })
  assert.equal(cambioMateria.intencion, 'cambio_materia_grado')
  assert.equal(cambioMateria.detalle?.materiaDetectada, 'Historia')

  // Selección de lista tiene prioridad sobre "parece una respuesta numérica".
  const listaTemas = 'Podemos trabajar cualquiera de estos temas:\n1. Células\n2. Genética\n3. Evolución\n4. Ecología'
  // Bug real del instructivo (sección G, punto 12): alumno con un curso
  // granular no-CNB activo (ej. eScholaris "Algebra 2") pide un curso
  // distinto por nombre completo ("Science Grade 8") mientras hay una
  // ecuación pendiente — debe reconocerse como cambio_materia_grado, NUNCA
  // evaluarse como respuesta incorrecta al ejercicio activo.
  const cambioMateriaNoCNB = clasificarIntencion({
    pregunta: 'Dime los temas de Science Grade 8',
    ultimoMensajeAsistente: 'Resuelve: 2x + 5 = 17',
    hayEjercicioActivo: true,
    materiaActivaId: 'Algebra 2',
  })
  assert.equal(cambioMateriaNoCNB.intencion, 'cambio_materia_grado')
  assert.equal(cambioMateriaNoCNB.detalle?.cursoMencionado, 'Science Grade 8')

  for (const pregunta of [
    'Quiero ver Biology Grade 10',
    'Cambia a Geometry',
    'Dame los temas de Math Grade 6',
    'Quiero practicar Science',
    'Enséñame el curso de Algebra 2',
  ]) {
    const resultado = clasificarIntencion({
      pregunta,
      ultimoMensajeAsistente: 'Resuelve: x + 30 = 61 [OP: x+30=61]',
      hayEjercicioActivo: true,
      materiaActivaId: 'Geometry',
    })
    assert.equal(resultado.intencion, 'cambio_materia_grado', `"${pregunta}" debería reconocerse como cambio de materia/grado`)
  }

  // "Quiero practicar" sin tema explícito no debe interpretarse como cambio
  // de materia (no hay curso mencionado) — la respuesta pedagógica de no
  // adivinar el tema se resuelve en el prompt (instructivo, sección B).
  const practicaSinTema = clasificarIntencion({
    pregunta: 'Quiero practicar',
    ultimoMensajeAsistente: '',
    hayEjercicioActivo: false,
    materiaActivaId: 'Geometry',
  })
  assert.notEqual(practicaSinTema.intencion, 'cambio_materia_grado')

  const seleccion = clasificarIntencion({
    pregunta: 'quiero el 2',
    ultimoMensajeAsistente: listaTemas,
    hayEjercicioActivo: false,
    materiaActivaId: null,
  })
  assert.equal(seleccion.intencion, 'seleccion_lista')
  assert.equal(seleccion.detalle?.seleccionLista?.tema, 'Genética')

  const recordar = clasificarIntencion({
    pregunta: '¿Cuál era el ejercicio que estábamos haciendo?',
    ultimoMensajeAsistente: 'Resuelve: x + 30 = 61 [OP: x+30=61]',
    hayEjercicioActivo: true,
    materiaActivaId: null,
  })
  assert.equal(recordar.intencion, 'recordar_ejercicio')

  const aclaracion = clasificarIntencion({
    pregunta: 'No entendí ese paso',
    ultimoMensajeAsistente: 'Suma 4 a ambos lados.',
    hayEjercicioActivo: true,
    materiaActivaId: null,
  })
  assert.equal(aclaracion.intencion, 'aclaracion_mismo_paso')

  const revisarErrores = clasificarIntencion({
    pregunta: 'Revisemos mis errores',
    ultimoMensajeAsistente: '',
    hayEjercicioActivo: false,
    materiaActivaId: null,
  })
  assert.equal(revisarErrores.intencion, 'solicitud_revisar_errores')

  const listaOficial = clasificarIntencion({
    pregunta: 'Dame todos los temas de esta clase',
    ultimoMensajeAsistente: '',
    hayEjercicioActivo: false,
    materiaActivaId: null,
  })
  assert.equal(listaOficial.intencion, 'solicitud_lista_temas')

  const respuestaEjercicio = clasificarIntencion({
    pregunta: '31',
    ultimoMensajeAsistente: 'Resuelve: x + 30 = 61 [OP: x+30=61]',
    hayEjercicioActivo: true,
    materiaActivaId: null,
  })
  assert.equal(respuestaEjercicio.intencion, 'respuesta_ejercicio')

  const preguntaDirecta = clasificarIntencion({
    pregunta: '¿Qué es la fotosíntesis?',
    ultimoMensajeAsistente: '',
    hayEjercicioActivo: false,
    materiaActivaId: null,
  })
  assert.equal(preguntaDirecta.intencion, 'pregunta_directa')

  const vacio = clasificarIntencion({
    pregunta: '   ',
    ultimoMensajeAsistente: '',
    hayEjercicioActivo: false,
    materiaActivaId: null,
  })
  assert.equal(vacio.intencion, 'no_evaluable')

  console.log('intent-classifier smoke passed')
}

main()
