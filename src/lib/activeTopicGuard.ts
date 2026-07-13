// Hallazgo real (QA en vivo, 2026-07-13): sin un tema activo explícito, el
// modelo podía derivar de un tema a otro de la misma materia dentro de la
// misma conversación (ej. de fracciones a sumas, o de adjetivos a verbos)
// sin que el alumno lo pidiera. Este módulo detecta, a partir del historial
// reciente, cuál tema del índice oficial está activo, y si el alumno pidió
// explícitamente cambiar a otro — para reforzar el prompt con una
// instrucción puntual que fije el tema o permita el cambio, según el caso.
// Solo aplica cuando el índice de temas ya se pudo extraer de forma
// determinística (no vía el respaldo con el modelo), para no agregar una
// llamada extra al modelo en cada turno académico.

function normalizeText(value: string) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Los temas reales suelen ser frases compuestas ("Productos notables,
// factorización y fracciones algebraicas") — un alumno rara vez repite el
// nombre completo. Se parte en sub-frases para que mencionar solo una parte
// ("veamos factorización") cuente como una mención real del tema completo.
function subFrasesDeTema(tema: string): string[] {
  return normalizeText(tema)
    .split(/,| y | and /)
    .map((parte) => parte.trim())
    .filter((parte) => parte.length >= 4)
}

function mensajeMencionaTema(mensajeNormalizado: string, tema: string): boolean {
  return subFrasesDeTema(tema).some((sub) => mensajeNormalizado.includes(sub))
}

export function detectActiveTopic(
  historial: Array<{ rol: string; contenido: string }> | undefined | null,
  topics: string[]
): string | null {
  if (!historial || historial.length === 0 || topics.length === 0) return null
  for (let i = historial.length - 1; i >= 0; i--) {
    const contenido = normalizeText(historial[i]?.contenido || '')
    if (!contenido) continue
    const tema = topics.find((t) => mensajeMencionaTema(contenido, t))
    if (tema) return tema
  }
  return null
}

const FRASES_CAMBIO_TEMA = [
  'cambiemos a', 'cambiar a', 'cambia a', 'pasemos a', 'pasar a', 'pasa a',
  'quiero ver', 'quiero trabajar', 'vamos a ver', 'ahora quiero', 'mejor veamos',
  'quiero pasar a', 'quiero cambiar a', 'veamos mejor', 'prefiero ver',
  'switch to', "let's see", 'lets see', 'i want to see', 'i want to work on',
  'move to', 'now i want', 'i want to switch to',
]

export type TopicSwitchResult = { detectado: boolean; temaMencionado: string | null }

export function detectExplicitTopicSwitch(
  pregunta: string,
  topics: string[],
  temaActivo: string | null
): TopicSwitchResult {
  const normalizado = normalizeText(pregunta)
  if (!normalizado || topics.length === 0) return { detectado: false, temaMencionado: null }

  const temaActivoNorm = temaActivo ? normalizeText(temaActivo) : null
  const candidatos = topics.filter((t) => normalizeText(t) !== temaActivoNorm)
  if (candidatos.length === 0) return { detectado: false, temaMencionado: null }

  // 1) Frase explícita de cambio, seguida de una mención a otro tema de la lista.
  for (const frase of FRASES_CAMBIO_TEMA) {
    const idx = normalizado.indexOf(frase)
    if (idx === -1) continue
    const resto = normalizado.slice(idx + frase.length).trim()
    if (!resto) continue
    const tema = candidatos.find((t) => mensajeMencionaTema(resto, t))
    if (tema) return { detectado: true, temaMencionado: tema }
  }

  // 2) Mensaje corto que nombra directamente otro tema, sin frase de cambio
  // — igual que seleccionar un tema por nombre de una lista recién mostrada.
  if (normalizado.split(' ').length <= 6) {
    const tema = candidatos.find((t) => mensajeMencionaTema(normalizado, t))
    if (tema) return { detectado: true, temaMencionado: tema }
  }

  return { detectado: false, temaMencionado: null }
}

export function buildTemaActivoInstruction(input: {
  temaActivo: string | null
  cambioExplicito: boolean
  idiomaIngles?: boolean
}): string {
  const { temaActivo, cambioExplicito, idiomaIngles } = input
  if (!temaActivo) return ''
  if (cambioExplicito) {
    return idiomaIngles
      ? `\n\nBACKEND NOTE: the student explicitly asked to move to a different topic ("${temaActivo}"). Allow the switch naturally.`
      : `\n\nNOTA BACKEND: el alumno pidió explícitamente cambiar al tema "${temaActivo}". Permite el cambio con naturalidad.`
  }
  return idiomaIngles
    ? `\n\nBACKEND NOTE: the active declared topic is "${temaActivo}". Do not drift to a different topic from this subject's official topic list unless the student explicitly asks to switch.`
    : `\n\nNOTA BACKEND: el tema activo declarado es "${temaActivo}". No cambies a otro tema del índice oficial de esta materia a menos que el alumno lo pida explícitamente.`
}
