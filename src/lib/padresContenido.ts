// Hallazgo real CRÍTICO (QA en vivo, 2026-07-15): getDocsPadres() (en
// preguntar-padres/route.ts) cortaba cada documento base a los primeros 8000
// caracteres antes de mandarlo al prompt — pero los documentos reales de
// "Owlaris padres" son mucho más grandes de lo que ese límite fue pensado
// para cubrir: "Libro Foro Familiar.md" (185,163 caracteres, solo 4.3%
// visible), "Videos Español.md" (260,336 caracteres, solo 3.1% visible),
// "Libro EXTRA ORDINARIOS.md" (85,196 caracteres, solo 9.4% visible). El
// consejero de padres solo "conocía" el primer video del catálogo y el
// arranque del primer capítulo de cada libro, sin importar lo que el padre
// preguntara — el catálogo de videos incluso indica explícitamente "no se
// mantiene índice separado, buscar con Ctrl+F", confirmando que el
// documento está pensado para búsqueda, no para lectura lineal completa.
//
// Este módulo reemplaza el corte ciego por una selección real: separa cada
// documento en secciones (por encabezado markdown para los libros, por
// entrada de video para los catálogos de video), puntúa cada sección por
// relevancia a la pregunta del padre, y selecciona las más relevantes
// dentro de un presupuesto de caracteres — igual que buscarContenido ya
// hace para el contenido curricular de los alumnos.

export type SeccionContenido = { titulo: string; texto: string }
export type EntradaVideo = { titulo: string; url: string; texto: string }

const PALABRAS_VACIAS = new Set([
  'de', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'o', 'a',
  'en', 'con', 'por', 'para', 'que', 'como', 'mi', 'tu', 'su', 'es', 'son',
  'del', 'al', 'se', 'no', 'sí', 'si', 'me', 'te', 'lo', 'le', 'les', 'mis',
  'tus', 'sus', 'este', 'esta', 'esto', 'ese', 'esa', 'eso', 'muy', 'mas',
  'más', 'pero', 'sin', 'sobre', 'entre', 'hay', 'ya', 'qué', 'cómo', 'cuál',
])

function normalizeText(value: string) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function palabrasClave(texto: string): string[] {
  return normalizeText(texto)
    .split(' ')
    .filter((palabra) => palabra.length >= 4 && !PALABRAS_VACIAS.has(palabra))
}

// Puntuación simple por solapamiento de palabras clave — no necesita ser
// sofisticada: solo tiene que preferir secciones/videos genuinamente
// relacionados con la pregunta del padre sobre el resto del catálogo.
export function puntuarRelevancia(seccionTexto: string, pregunta: string): number {
  const palabrasPregunta = Array.from(new Set(palabrasClave(pregunta)))
  if (palabrasPregunta.length === 0) return 0
  const textoNormalizado = normalizeText(seccionTexto)
  let puntaje = 0
  for (const palabra of palabrasPregunta) {
    if (textoNormalizado.includes(palabra)) puntaje += 1
  }
  return puntaje
}

// Divide un documento tipo libro en secciones por encabezado markdown
// (#, ## o ###) — ambos libros base ("Libro Foro Familiar", "Libro EXTRA
// ORDINARIOS") usan encabezados markdown limpios para sus capítulos y
// subsecciones, confirmado leyendo el documento fuente real.
export function parseSeccionesPorEncabezado(contenido: string): SeccionContenido[] {
  const lineas = (contenido || '').split(/\r?\n/)
  const secciones: SeccionContenido[] = []
  let tituloActual: string | null = null
  let bufferActual: string[] = []

  const cerrarSeccionActual = () => {
    if (tituloActual !== null) {
      secciones.push({ titulo: tituloActual, texto: bufferActual.join('\n').trim() })
    }
    bufferActual = []
  }

  for (const linea of lineas) {
    const encabezado = linea.match(/^#{1,3}\s+(.+)$/)
    if (encabezado) {
      cerrarSeccionActual()
      tituloActual = encabezado[1].trim()
      continue
    }
    if (tituloActual !== null) bufferActual.push(linea)
  }
  cerrarSeccionActual()
  return secciones.filter((s) => s.texto.length > 0)
}

const URL_VIDEO = /https?:\/\/(?:www\.)?youtube\.com\/watch\?v=[\w-]+|https?:\/\/youtu\.be\/[\w-]+/
const LINEA_TITULO_CANDIDATA = /^\*\*[^*]{3,150}\*\*$/

function pareceTituloDeVideo(lineas: string[], indice: number): boolean {
  if (!LINEA_TITULO_CANDIDATA.test(lineas[indice].trim())) return false
  // Un título de video real siempre está seguido, dentro de pocas líneas
  // (permitiendo líneas en blanco y un prefijo tipo "Link:"), por un link
  // de YouTube — a diferencia de una línea en negrita usada solo como
  // énfasis dentro de la transcripción (mucho más frecuente en el texto).
  for (let j = indice + 1; j < Math.min(indice + 6, lineas.length); j++) {
    if (URL_VIDEO.test(lineas[j])) return true
    if (LINEA_TITULO_CANDIDATA.test(lineas[j].trim())) return false
  }
  return false
}

// Divide un catálogo de videos ("Videos Español.md", "Videos Inglés.md")
// en entradas individuales (título + link + transcripción). El formato del
// link varía mucho a lo largo del documento real (<url>, [texto](url),
// "Link: url", "Link url", sin decoración) — se busca el patrón de URL
// directamente, sin depender de ningún prefijo o envoltorio específico.
export function parseCatalogoVideos(contenido: string): EntradaVideo[] {
  const lineas = (contenido || '').split(/\r?\n/)
  const indicesTitulo: number[] = []
  for (let i = 0; i < lineas.length; i++) {
    if (pareceTituloDeVideo(lineas, i)) indicesTitulo.push(i)
  }

  const entradas: EntradaVideo[] = []
  const urlsVistas = new Set<string>()
  for (let k = 0; k < indicesTitulo.length; k++) {
    const inicio = indicesTitulo[k]
    const fin = k + 1 < indicesTitulo.length ? indicesTitulo[k + 1] : lineas.length
    const bloque = lineas.slice(inicio, fin).join('\n')
    const match = bloque.match(URL_VIDEO)
    if (!match) continue
    const url = match[0]
    if (urlsVistas.has(url)) continue // documento fuente tiene duplicados conocidos
    urlsVistas.add(url)
    const titulo = lineas[inicio].trim().replace(/^\*\*/, '').replace(/\*\*$/, '').trim()
    entradas.push({ titulo, url, texto: bloque.trim() })
  }
  return entradas
}

export function construirIndiceVideos(entradas: EntradaVideo[]): string {
  return entradas.map((e) => `- ${e.titulo}: ${e.url}`).join('\n')
}

// Selecciona las secciones más relevantes a la pregunta dentro de un
// presupuesto de caracteres — sin pregunta útil (o sin ninguna coincidencia
// real), conserva el comportamiento anterior de tomar desde el principio,
// en vez de devolver nada.
export function seleccionarRelevantes<T extends { texto: string }>(
  secciones: T[],
  pregunta: string,
  presupuestoCaracteres: number
): T[] {
  const puntuadas = secciones
    .map((seccion, indice) => ({ seccion, indice, puntaje: puntuarRelevancia(seccion.texto, pregunta) }))
    .sort((a, b) => b.puntaje - a.puntaje || a.indice - b.indice)

  // Sin ninguna coincidencia real, "puntuadas" ya queda ordenado por índice
  // original (todos los puntajes son 0) — se conserva el comportamiento
  // anterior de tomar desde el principio, en vez de devolver nada.
  const seleccionadas: T[] = []
  let usados = 0
  for (const { seccion } of puntuadas) {
    if (usados >= presupuestoCaracteres && seleccionadas.length > 0) break
    seleccionadas.push(seccion)
    usados += seccion.texto.length
  }
  return seleccionadas
}
