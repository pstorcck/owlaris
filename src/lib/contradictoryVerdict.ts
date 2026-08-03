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
// Hallazgo real (QA semanal en vivo, 2026-07-31, Física — Americano,
// trabajo-energía): el patrón reapareció con DOS huecos distintos, ambos
// reproducidos en scripts/contradictory-verdict-smoke.ts:
//
//   1. VOCABULARIO: el modelo escribió "Aquí está el único error" — ninguno
//      de los patrones de abajo lo cubría, así que ni siquiera se detectaba
//      con la frase al inicio del texto.
//   2. UBICACIÓN: la frase apareció dentro del "Paso 3" (carácter 309), no
//      en la apertura. Al verificar un procedimiento paso a paso el modelo
//      no abre con el veredicto: lo suelta al llegar al paso que cree malo,
//      y acto seguido se contradice ("v = √50 ≈ 7.07 m/s, está bien").
const ANUNCIOS_DE_ERROR = [
  /hay un (?:peque[ñn]o )?error/i,
  /parece que hay .{0,40}error/i,
  /cometiste un error/i,
  /tu (?:respuesta|resultado) (?:no es correct[oa]|es incorrect[oa])/i,
  /tu (?:proceso|procedimiento) (?:tiene|contiene) un error/i,
  /there(?:'s| is) a (?:small )?(?:mistake|error)/i,
  /your (?:answer|process|result) (?:is not correct|is incorrect|has a mistake)/i,
  // Anuncios que SEÑALAN dónde está el error, la forma natural de hacerlo
  // en un desglose paso a paso.
  /(?:aqu[ií] )?est[aá] (?:el|tu) (?:[uú]nico )?error/i,
  /el (?:[uú]nico )?error est[aá] (?:aqu[ií]|en)/i,
  /(?:aqu[ií] )?(?:hay|est[aá]) (?:un|el) (?:peque[ñn]o )?fallo/i,
  /te equivocaste (?:aqu[ií]|en)/i,
  /here(?:'s| is) (?:the|your) (?:only )?(?:mistake|error)/i,
  /the (?:only )?(?:mistake|error) is (?:here|in)/i,
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

// Confirmaciones que solo son fiables PEGADAS al anuncio de error. "Está
// bien" a secas es demasiado débil para aceptarla a cualquier distancia
// (una respuesta que corrige de verdad puede cerrar con "fíjate si el
// planteamiento inicial está bien" sin contradecirse en absoluto), pero a
// menos de una oración del anuncio, y sin ninguna marca de corrección de
// por medio, sí delata la contradicción.
const CONFIRMACIONES_CERCANAS = [
  ...CONFIRMACIONES_DE_EXITO,
  /(?<!\bno\s)\best[aá]\s+bien\b/i,
  /\bbien\s+(?:hecho|resuelto|planteado|calculado|aplicado)\b/i,
  /(?<!\bnot\s)\blooks\s+(?:good|right|correct)\b/i,
]

// Si entre el anuncio y la confirmación el modelo CORRIGE algo, no hay
// contradicción: encontró un error real, lo enmendó y por eso lo que sigue
// ya está bien. Ese es el comportamiento deseado y no debe tocarse.
const MARCAS_DE_CORRECCION = [
  /deber[ií]as/i,
  /debiste/i,
  /en realidad/i,
  /lo correcto (?:es|ser[ií]a)/i,
  /corrigiendo/i,
  /corregido/i,
  /el valor correcto/i,
  /vuelve a (?:intentar|revisar|calcular)/i,
  /int[eé]ntalo de nuevo/i,
  /should (?:be|have been)/i,
  /actually/i,
  /the correct value/i,
  /try again/i,
]

// Tamaño de la ventana de "apertura" donde un anuncio de error cuenta como
// veredicto adelantado sin más requisitos (el patrón original: el modelo
// abre con el veredicto equivocado y lo desmiente en el resto del texto).
const LARGO_APERTURA = 260

// Fuera de la apertura, la confirmación tiene que estar PEGADA al anuncio
// para que cuente: una mención de error ya avanzada la explicación, seguida
// mucho después de un "es correcta" sobre otra cosa, no es contradicción.
const VENTANA_CONFIRMACION_CERCANA = 220

type Contradiccion = { indice: number; largo: number; adelantado: boolean }

// Devuelve el anuncio de error que la propia respuesta desmiente, o null.
// Lo comparten la detección y la reparación para que ambas operen sobre
// exactamente el mismo hallazgo.
function encontrarContradiccion(respuesta: string): Contradiccion | null {
  const texto = (respuesta || '').trim()
  if (!texto) return null

  for (const patron of ANUNCIOS_DE_ERROR) {
    const busqueda = new RegExp(patron.source, patron.flags.includes('g') ? patron.flags : `${patron.flags}g`)
    let match: RegExpExecArray | null
    while ((match = busqueda.exec(texto)) !== null) {
      const indice = match.index
      const desde = indice + match[0].length
      // La confirmación debe aparecer DESPUÉS del anuncio, no en un punto
      // fijo arbitrario del texto (que podría cortar a mitad de la propia
      // frase de confirmación en respuestas cortas).
      const resto = texto.slice(desde)
      const adelantado = indice < LARGO_APERTURA

      if (adelantado) {
        if (CONFIRMACIONES_DE_EXITO.some((r) => r.test(resto))) {
          return { indice, largo: match[0].length, adelantado }
        }
        continue
      }

      const cercano = resto.slice(0, VENTANA_CONFIRMACION_CERCANA)
      if (!CONFIRMACIONES_CERCANAS.some((r) => r.test(cercano))) continue
      if (MARCAS_DE_CORRECCION.some((r) => r.test(cercano))) continue
      return { indice, largo: match[0].length, adelantado }
    }
  }

  return null
}

export function detectarVeredictoAutocontradictorio(respuesta: string): boolean {
  return encontrarContradiccion(respuesta) !== null
}

// Hallazgo real (QA semanal en vivo, Estadística 5to Bach): ante un
// procedimiento 100% correcto (media, varianza y desviación poblacional) la
// respuesta ABRIÓ con "Estás cerca. Revisemos qué operación ayuda a avanzar."
// y a renglón seguido confirmó los 4 pasos y cerró "Tu procedimiento es
// correcto". Esa apertura NO la escribió el modelo: es una de las frases-guía
// fijas de pedagogicalGuard.ts, que guardNoFinalAnswer antepone cuando se
// activa. Confirmar el trabajo YA HECHO por el alumno no es revelarle la
// respuesta —él la produjo—, así que ese guard no debe intervenir ahí.
const CONFIRMACIONES_DE_TRABAJO_CORRECTO = [
  ...CONFIRMACIONES_DE_EXITO,
  /tu (?:procedimiento|proceso|desarrollo|razonamiento|c[aá]lculo)\s+(?:es|est[aá])\s+correct[oa]/i,
  /(?:todos\s+)?(?:los|tus)\s+(?:\d+\s+)?pasos\s+(?:est[aá]n|son)\s+correctos/i,
  /your (?:procedure|process|reasoning|work) is correct/i,
  /(?:all\s+)?(?:your\s+)?steps are correct/i,
]

export function respuestaConfirmaAcierto(respuesta: string): boolean {
  const texto = (respuesta || '').trim()
  if (!texto) return false
  return CONFIRMACIONES_DE_TRABAJO_CORRECTO.some((r) => r.test(texto))
}

// Fin de la oración/párrafo que contiene el anuncio de error.
function finDeOracion(texto: string, desde: number): number {
  const saltoParrafo = texto.indexOf('\n', desde)
  const puntoFinal = texto.indexOf('. ', desde)
  const candidatos = [saltoParrafo, puntoFinal].filter((i) => i !== -1)
  if (candidatos.length === 0) return texto.length
  const corte = Math.min(...candidatos)
  return corte + (texto[corte] === '.' ? 2 : 1)
}

// Inicio de la cláusula que contiene el anuncio. Se corta también en ":" y
// "," para no arrastrar la etiqueta del paso: en "Paso 3: Aquí está el
// único error." lo que sobra es la frase, no el "Paso 3:".
function inicioDeClausula(texto: string, indice: number): number {
  const limites = ['\n', '. ', ': ', ', ']
    .map((sep) => {
      const pos = texto.lastIndexOf(sep, indice)
      return pos === -1 ? -1 : pos + sep.length
    })
    .filter((pos) => pos >= 0 && pos <= indice)
  return limites.length > 0 ? Math.max(...limites) : 0
}

// Quita SOLO la frase que anuncia el error; el resto de la respuesta (el
// desglose paso a paso que el propio modelo ya escribió) se conserva
// intacto, porque es contenido pedagógico válido que ya confirma la
// respuesta correcta.
//
// Hallazgo real (QA 2026-07-31): la versión anterior siempre cortaba desde
// el inicio del texto hasta el final de esa frase, lo cual solo es correcto
// cuando el anuncio ESTÁ en la apertura. Con el anuncio dentro del "Paso 3",
// ese mismo corte se habría comido los pasos 1 y 2 — la parte más útil de
// la explicación. Ahora el corte desde el inicio se reserva al veredicto
// adelantado, y en cualquier otra posición la frase se extirpa en el lugar.
export function repararVeredictoAutocontradictorio(respuesta: string, idiomaIngles = false): string {
  const texto = respuesta.trim()
  const apertura = idiomaIngles ? 'Correct.' : '¡Correcto!'
  const hallazgo = encontrarContradiccion(texto)
  if (!hallazgo) return texto

  const fin = finDeOracion(texto, hallazgo.indice + hallazgo.largo)

  if (hallazgo.adelantado) {
    const resto = texto.slice(fin).trim()
    return resto ? `${apertura} ${resto}` : apertura
  }

  const inicio = inicioDeClausula(texto, hallazgo.indice)
  const limpio = `${texto.slice(0, inicio)}${texto.slice(fin)}`
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return limpio || apertura
}
