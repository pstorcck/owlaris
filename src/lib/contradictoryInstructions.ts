// Hallazgo real (instructivo de mejoras, ronda 2026-07-11), ítems 19-21
// (manejo de instrucciones contradictorias): un mensaje con dos peticiones
// opuestas en la misma entrada ("dame la respuesta pero no me la digas",
// "sube el nivel pero bájalo") no tenía ningún manejo específico — el
// sistema podía (a) cumplir en silencio una de las dos partes sin avisar
// del conflicto, o (b) responder con un error genérico sin explicar por
// qué. Owlaris debe reconocer la contradicción y pedir una aclaración
// puntual, con un límite claro, en vez de obedecer sin condiciones una
// lectura arbitraria o esconder el conflicto detrás de un error.
function normalizeText(value: string) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export type ContradictionType =
  | 'respuesta_si_no'
  | 'ayuda_si_no'
  | 'nivel_sube_baja'
  | 'idioma_doble'
  | 'materia_cambia_no_cambia'

const PATRONES: Array<{ tipo: ContradictionType; a: RegExp; b: RegExp }> = [
  {
    tipo: 'respuesta_si_no',
    a: /(?:dame|damela|dime)\s+(?:la\s+)?respuesta/i,
    b: /no\s+me\s+(?:la\s+)?(?:des|digas)/i,
  },
  {
    tipo: 'ayuda_si_no',
    a: /(?:ay[uú]dame|res[uú]elvelo|resuelvemelo)\b/i,
    b: /no\s+me\s+ayudes|no\s+lo\s+resuelvas/i,
  },
  {
    tipo: 'nivel_sube_baja',
    a: /sube\s+(?:el\s+)?nivel|sube\s+la\s+dificultad/i,
    b: /baja\s+(?:el\s+)?nivel|baja\s+la\s+dificultad/i,
  },
  {
    tipo: 'idioma_doble',
    a: /en\s+espa[ñn]ol/i,
    b: /en\s+ingl[eé]s/i,
  },
  {
    tipo: 'materia_cambia_no_cambia',
    a: /cambia(?:mos)?\s+a\s+\w+/i,
    b: /no\s+cambies\s+de\s+materia|qu[eé]date\s+en\s+la\s+misma/i,
  },
]

export function detectContradictoryInstruction(value: string): ContradictionType | null {
  const text = normalizeText(value)
  if (!text) return null
  for (const patron of PATRONES) {
    if (patron.a.test(text) && patron.b.test(text)) return patron.tipo
  }
  return null
}

export function buildContradictionClarificationResponse(tipo: ContradictionType, idiomaIngles = false): string {
  const mensajes: Record<ContradictionType, { es: string; en: string }> = {
    respuesta_si_no: {
      es: 'Tu mensaje me pide la respuesta y, al mismo tiempo, me pide que no te la dé — no puedo hacer ambas cosas a la vez. ¿Quieres que te dé una pista para llegar tú mismo, o de verdad quieres que confirme el resultado final?',
      en: 'Your message asks me for the answer and also asks me not to give it to you — I cannot do both at once. Do you want a hint to get there yourself, or do you really want me to confirm the final result?',
    },
    ayuda_si_no: {
      es: 'Tu mensaje me pide que te ayude y también que no te ayude — no puedo hacer ambas cosas a la vez. ¿Prefieres que te guíe paso a paso, o que lo intentes tú primero sin ninguna ayuda mía?',
      en: 'Your message asks me to help and also asks me not to help — I cannot do both at once. Would you rather I guide you step by step, or would you like to try it first without any help from me?',
    },
    nivel_sube_baja: {
      es: 'Tu mensaje me pide subir el nivel y bajarlo al mismo tiempo — no puedo hacer ambas cosas a la vez. ¿Quieres algo más difícil o algo más sencillo ahora mismo?',
      en: 'Your message asks me to raise the difficulty and lower it at the same time — I cannot do both at once. Do you want something harder or something easier right now?',
    },
    idioma_doble: {
      es: 'Tu mensaje pide español e inglés al mismo tiempo — dime en cuál de los dos idiomas prefieres que continuemos.',
      en: 'Your message asks for Spanish and English at the same time — let me know which of the two languages you would like us to continue in.',
    },
    materia_cambia_no_cambia: {
      es: 'Tu mensaje pide cambiar de materia y, a la vez, quedarnos en la misma — no puedo hacer ambas cosas a la vez. ¿Cambiamos de materia o seguimos con la actual?',
      en: 'Your message asks to change subjects and also to stay on the same one — I cannot do both at once. Should we switch subjects or keep going with the current one?',
    },
  }
  const texto = mensajes[tipo]
  return idiomaIngles ? texto.en : texto.es
}
