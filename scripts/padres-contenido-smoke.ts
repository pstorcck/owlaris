import assert from 'node:assert/strict'
import {
  construirIndiceVideos,
  parseCatalogoVideos,
  parseSeccionesPorEncabezado,
  puntuarRelevancia,
  seleccionarRelevantes,
} from '../src/lib/padresContenido'

function main() {
  // Hallazgo real CRÍTICO (QA en vivo, 2026-07-15): getDocsPadres() cortaba
  // cada documento a 8000 caracteres antes de mandarlo al modelo, pero los
  // documentos reales de "Owlaris padres" tienen entre 85,000 y 260,000
  // caracteres — el consejero solo veía el primer capítulo/video, sin
  // importar la pregunta real del padre. Estas pruebas reproducen la
  // estructura real de esos documentos.

  // ── parseSeccionesPorEncabezado (libros: "Libro Foro Familiar",
  // "Libro EXTRA ORDINARIOS" — ambos usan encabezados markdown limpios) ──
  const libroSimulado = `# Libro Foro Familiar

## Agradecimientos

Gracias a todas las familias.

## Pequeños invasores

Las pantallas han cambiado la infancia. Hablemos de límites y pantallas.

### Reflexión

¿Cuánto tiempo de pantalla tiene tu hijo al día?

## Nueva propuesta

El Foro Familiar es una reunión mensual para conectar con tus hijos.
`
  const seccionesLibro = parseSeccionesPorEncabezado(libroSimulado)
  assert.equal(seccionesLibro.length, 4)
  assert.equal(seccionesLibro[0].titulo, 'Agradecimientos')
  assert.equal(seccionesLibro[1].titulo, 'Pequeños invasores')
  assert.match(seccionesLibro[1].texto, /pantallas han cambiado la infancia/)
  assert.equal(seccionesLibro[2].titulo, 'Reflexión')
  assert.equal(seccionesLibro[3].titulo, 'Nueva propuesta')
  assert.match(seccionesLibro[3].texto, /Foro Familiar es una reunión mensual/)

  // ── parseCatalogoVideos: reproduce la estructura real y variada de
  // "Videos Español.md" — distintos formatos de link a lo largo del mismo
  // documento, líneas en negrita usadas SOLO como énfasis dentro de la
  // transcripción (no deben confundirse con un título de video nuevo), y
  // un preámbulo ("Canal de Youtube") que menciona una URL que NO es un
  // video (canal, no "watch?v=" ni "youtu.be/") y no debe convertirse en
  // una entrada falsa.
  const catalogoSimulado = `**Canal de Youtube**

*Español: <https://www.youtube.com/c/EduardoMontano>*

**Desinformación, el "extraño" que entra a tu casa cada día**

<https://youtu.be/4tqQIhbiADE>

Hola, soy Eduardo Montano.

**Enséñales pensamiento crítico.**

Pregunten juntos: ¿quién lo dijo?, ¿se puede comprobar?

**Pantallas vs vida real, el secreto del cerebro infantil**

Link: <https://www.youtube.com/watch?v=MFGyVmZ7Hgo>

El cerebro de un niño necesita variedad, prueba y error, y buen sueño.

**¿Quién manda en tu casa, tú o las notificaciones?**

Link https://www.youtube.com/watch?v=cqY-tRzTQAs

Las notificaciones compiten por la atención de nuestros hijos todo el día.
`
  const entradas = parseCatalogoVideos(catalogoSimulado)
  assert.equal(entradas.length, 3, 'debe reconocer exactamente 3 videos reales, no el preámbulo del canal ni las líneas de énfasis')
  assert.equal(entradas[0].titulo, 'Desinformación, el "extraño" que entra a tu casa cada día')
  assert.equal(entradas[0].url, 'https://youtu.be/4tqQIhbiADE')
  assert.match(entradas[0].texto, /Hola, soy Eduardo Montano/)
  // La línea de énfasis "Enséñales pensamiento crítico." (sin ningún link
  // de video después) debe quedar DENTRO del texto del video anterior, no
  // convertirse en su propia entrada falsa.
  assert.match(entradas[0].texto, /Enséñales pensamiento crítico/)
  assert.equal(entradas[1].titulo, 'Pantallas vs vida real, el secreto del cerebro infantil')
  assert.equal(entradas[1].url, 'https://www.youtube.com/watch?v=MFGyVmZ7Hgo')
  assert.equal(entradas[2].titulo, '¿Quién manda en tu casa, tú o las notificaciones?')
  assert.equal(entradas[2].url, 'https://www.youtube.com/watch?v=cqY-tRzTQAs')
  assert.ok(!entradas.some((e) => e.url.includes('/c/EduardoMontano')), 'la URL del canal no debe convertirse en una entrada de video')

  // Duplicados reales (el mismo video aparece dos veces en el documento
  // fuente) no deben producir entradas repetidas.
  const catalogoConDuplicado = catalogoSimulado + `
**Desinformación, el "extraño" que entra a tu casa cada día**

<https://youtu.be/4tqQIhbiADE>

Repetido.
`
  assert.equal(parseCatalogoVideos(catalogoConDuplicado).length, 3, 'no debe duplicar una entrada con la misma URL')

  const indice = construirIndiceVideos(entradas)
  assert.match(indice, /Desinformación.*https:\/\/youtu\.be\/4tqQIhbiADE/)
  assert.match(indice, /Pantallas vs vida real.*watch\?v=MFGyVmZ7Hgo/)

  // ── puntuarRelevancia / seleccionarRelevantes ──
  assert.ok(puntuarRelevancia('Hablemos de pantallas y límites de tiempo', 'cómo limitar las pantallas de mi hijo') > 0)
  assert.equal(puntuarRelevancia('Hablemos de pantallas', ''), 0, 'sin pregunta útil, no hay coincidencias')

  const secciones = [
    { titulo: 'Nutrición', texto: 'Micronutrientes y alimentación saludable para niños.' },
    { titulo: 'Pantallas', texto: 'Límites de tiempo de pantalla y notificaciones en el celular.' },
    { titulo: 'Comunicación', texto: 'Cómo hablar con tu hijo adolescente sobre sus emociones.' },
  ]
  const relevantesPantallas = seleccionarRelevantes(secciones, '¿cómo limito las pantallas y notificaciones de mi hijo?', 10000)
  assert.equal(relevantesPantallas[0].titulo, 'Pantallas', 'la sección más relevante a la pregunta debe ir primero')

  // Presupuesto de caracteres: no debe incluir más secciones de las que
  // caben, pero SIEMPRE debe incluir al menos una (para no devolver vacío).
  const seccionesLargas = [
    { titulo: 'A', texto: 'x'.repeat(100) },
    { titulo: 'B', texto: 'x'.repeat(100) },
    { titulo: 'C', texto: 'x'.repeat(100) },
  ]
  const limitadas = seleccionarRelevantes(seccionesLargas, '', 150)
  assert.equal(limitadas.length, 2, 'debe respetar el presupuesto de caracteres')
  const limitadasMuyChico = seleccionarRelevantes(seccionesLargas, '', 10)
  assert.equal(limitadasMuyChico.length, 1, 'siempre debe incluir al menos una sección, aunque exceda un presupuesto diminuto')

  // Sin ninguna coincidencia real con la pregunta, debe conservar el orden
  // original (comportamiento anterior: tomar desde el principio) en vez de
  // devolver una selección vacía o arbitraria.
  const sinCoincidencias = seleccionarRelevantes(secciones, 'algo completamente no relacionado xyz', 10000)
  assert.equal(sinCoincidencias[0].titulo, 'Nutrición')

  console.log('padres-contenido smoke passed')
}

main()
