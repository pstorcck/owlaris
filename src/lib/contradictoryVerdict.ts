// Hallazgo real recurrente (QA en vivo, 2026-07-19 en Contabilidad y
// Olimpiadas Química; 2026-07-21 en Mineduc Matemática, sistema de dos
// ecuaciones lineales): al verificar un procedimiento de varios pasos, el
// modelo a veces ABRE la respuesta anunciando un error ("parece que hay un
// pequeño error en tu proceso") pero el desglose que sigue confirma cada
// paso del alumno y CONCLUYE explícitamente que la respuesta es correcta
// ("Así que, efectivamente, María compró 15 globos y 0 serpentinas").
//
// La regla de PROMPT_BASE "ORDEN OBLIGATORIO AL VERIFICAR..." (desglose
// primero en silencio, veredicto solo al final) reduce la frecuencia de
// esto, pero una instrucción no es una garantía en un modelo que genera
// texto en una sola pasada — puede seguir comprometiéndose con el
// veredicto equivocado en la primera línea antes de "ver" su propia
// verificación completa. A diferencia del CONTRADICTION GUARD existente en
// route.ts (que exige poder RESOLVER la operación de forma independiente,
// algo que no siempre es posible — ej. un sistema de dos ecuaciones no
// tiene un solver dedicado), este guard es puramente textual: detecta que
// la PROPIA respuesta se contradice a sí misma, sin necesitar calcular
// nada por separado.
const ANUNCIOS_DE_ERROR = [
  /hay un (?:peque[ñn]o )?error/i,
  /parece que hay .{0,40}error/i,
  /cometiste un error/i,
  /tu (?:respuesta|resultado) (?:no es correct[oa]|es incorrect[oa])/i,
  /tu (?:proceso|procedimiento) (?:tiene|contiene) un error/i,
  /there(?:'s| is) a (?:small )?(?:mistake|error)/i,
  /your (?:answer|process|result) (?:is not correct|is incorrect|has a mistake)/i,
]

const CONFIRMACIONES_DE_EXITO = [
  /efectivamente/i,
  /\bes correcta?\b/i,
  /\bson correctas?\b/i,
  /(?:la respuesta|el resultado)(?: final)? es correct[oa]/i,
  /confirma(?:ndo)? que (?:la respuesta|el resultado)/i,
  /has (?:resuelto|aplicado|calculado) (?:correctamente|bien)/i,
  /(?:your answer|the (?:answer|result))(?: is)? correct/i,
  /you (?:solved|applied|calculated) .{0,30}correctly/i,
]

// Tamaño de la ventana de "apertura" donde debe aparecer el anuncio de
// error para contar como un veredicto adelantado (no una mención tardía,
// ya avanzada la explicación, que sería un uso legítimo de esas palabras).
const LARGO_APERTURA = 260

export function detectarVeredictoAutocontradictorio(respuesta: string): boolean {
  const texto = (respuesta || '').trim()
  if (!texto) return false
  const apertura = texto.slice(0, LARGO_APERTURA)
  const match = ANUNCIOS_DE_ERROR.map((r) => apertura.match(r)).find(Boolean)
  if (!match) return false
  // La confirmación de éxito debe aparecer DESPUÉS del anuncio de error, no
  // en un punto fijo arbitrario del texto (que podría cortar a mitad de la
  // propia frase de confirmación en respuestas cortas).
  const resto = texto.slice((match.index ?? 0) + match[0].length)
  return CONFIRMACIONES_DE_EXITO.some((r) => r.test(resto))
}

// Corta el texto justo después de la primera oración/párrafo que contiene
// el anuncio de error (para descartar SOLO esa frase adelantada), y
// antepone un veredicto correcto — el resto de la respuesta (el desglose
// paso a paso que el propio modelo ya escribió) se conserva intacto, ya
// que es contenido pedagógico válido y ya confirma la respuesta correcta.
export function repararVeredictoAutocontradictorio(respuesta: string, idiomaIngles = false): string {
  const texto = respuesta.trim()
  const match = ANUNCIOS_DE_ERROR.map((r) => texto.slice(0, LARGO_APERTURA).match(r)).find(Boolean)
  const indiceError = match?.index ?? 0
  const desde = indiceError + (match?.[0]?.length ?? 0)

  const saltoParrafo = texto.indexOf('\n', desde)
  const puntoFinal = texto.indexOf('. ', desde)
  const candidatos = [saltoParrafo, puntoFinal].filter((i) => i !== -1)
  const corte = candidatos.length > 0 ? Math.min(...candidatos) + (texto[Math.min(...candidatos)] === '.' ? 2 : 1) : texto.length

  const resto = texto.slice(corte).trim()
  const apertura = idiomaIngles ? 'Correct.' : '¡Correcto!'
  return resto ? `${apertura} ${resto}` : apertura
}
