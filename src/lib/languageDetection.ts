// Hallazgo real (QA amplia 2026-07-08): un alumno que escribe su pregunta en
// un idioma distinto al configurado en la sesión ("Can you explain what a
// cell membrane does?" con la sesión en español) recibía "Eso es un tema
// distinto de [materia]" — el modelo confundía la señal de idioma con un
// cambio de tema/subtema, porque no existía ninguna forma determinística de
// distinguir ambas cosas. Esta heurística de palabras clave (sin librerías
// nuevas) detecta el caso para poder avisarle al modelo explícitamente que
// es solo un cambio de idioma, no de tema.
const PALABRAS_ES = [
  /\bqu[eé]\b/i, /\bc[oó]mo\b/i, /\bpor\s+qu[eé]\b/i, /\bpuedes\b/i,
  /\bexplica(?:me|r)?\b/i, /\bcu[aá]l(?:es)?\b/i, /\bd[oó]nde\b/i,
  /\bcu[aá]ndo\b/i, /\bpara\s+qu[eé]\b/i, /\bay[uú]dame\b/i, /\bentiendo\b/i,
]

const PALABRAS_EN = [
  /\bcan\s+you\b/i, /\bwhat\b/i, /\bhow\b/i, /\bwhy\b/i, /\bwhere\b/i,
  /\bwhen\b/i, /\bexplain\b/i, /\bdoes\b/i, /\bhelp\s+me\b/i,
  /\bunderstand\b/i, /\bcould\s+you\b/i,
]

// Requiere al menos 2 coincidencias y que superen claramente al otro idioma,
// para no disparar con un solo término técnico compartido entre idiomas
// (ej. "membrane", "cell") — solo cuenta cuando el patrón gramatical del
// mensaje completo apunta a un idioma distinto al configurado.
export function pareceIdiomaDistinto(texto: string, idiomaIngles: boolean): boolean {
  const t = (texto || '').toLowerCase()
  const coincidenciasEs = PALABRAS_ES.filter((patron) => patron.test(t)).length
  const coincidenciasEn = PALABRAS_EN.filter((patron) => patron.test(t)).length

  if (idiomaIngles) {
    return coincidenciasEs >= 2 && coincidenciasEs > coincidenciasEn
  }
  return coincidenciasEn >= 2 && coincidenciasEn > coincidenciasEs
}
