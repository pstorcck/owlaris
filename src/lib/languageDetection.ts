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

// Hallazgo real (QA ~80 pruebas, 2026-07-08): el mismo problema se repitió
// con un mensaje en francés ("Peux-tu expliquer les fractions s'il te
// plaît?"), confirmando que el problema no es exclusivo de inglés — CUALQUIER
// idioma distinto al configurado dispara la confusión con cambio de tema.
// Owlaris solo tiene un interruptor binario español/inglés, así que no hay
// un "modo francés" propio de la sesión — pero la heurística igual debe
// reconocer un mensaje en otro idioma (francés incluido) como tal, no como
// un tema distinto.
const PALABRAS_FR = [
  /\bpeux-tu\b/i, /\bpourrais-tu\b/i, /\bqu['’]est-ce\b/i, /\bpourquoi\b/i,
  /\bcomment\b/i, /\bexpliquer\b/i, /\bo[uù]\b/i, /\bcombien\b/i,
  /\baide-moi\b/i, /\bcomprends\b/i, /\bs['’]il\s+te\s+pla[iî]t\b/i,
  /\bs['’]il\s+vous\s+pla[iî]t\b/i,
]

// Requiere al menos 2 coincidencias y que superen claramente al idioma
// configurado, para no disparar con un solo término técnico compartido
// entre idiomas (ej. "membrane", "cell") — solo cuenta cuando el patrón
// gramatical del mensaje completo apunta a un idioma distinto al
// configurado. El idioma "distinto" se evalúa contra cualquiera de los
// idiomas conocidos que NO es el configurado (inglés y francés cuando la
// sesión está en español; español y francés cuando está en inglés).
export function pareceIdiomaDistinto(texto: string, idiomaIngles: boolean): boolean {
  const t = (texto || '').toLowerCase()
  const coincidenciasEs = PALABRAS_ES.filter((patron) => patron.test(t)).length
  const coincidenciasEn = PALABRAS_EN.filter((patron) => patron.test(t)).length
  const coincidenciasFr = PALABRAS_FR.filter((patron) => patron.test(t)).length

  const coincidenciasConfigurado = idiomaIngles ? coincidenciasEn : coincidenciasEs
  const mejorOtroIdioma = idiomaIngles
    ? Math.max(coincidenciasEs, coincidenciasFr)
    : Math.max(coincidenciasEn, coincidenciasFr)

  return mejorOtroIdioma >= 2 && mejorOtroIdioma > coincidenciasConfigurado
}
