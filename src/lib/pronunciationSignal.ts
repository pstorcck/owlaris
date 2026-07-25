// gpt-4o-mini-transcribe, con include:['logprobs'], devuelve un logprob por
// TOKEN (fragmentos estilo BPE, ej. "th" + "ought"), no por palabra
// completa. Antes se promediaban todos los tokens de la respuesta en un
// único número global (ver confianzaDesdeLogprobs en transcribir/route.ts)
// — útil como señal general, pero inservible para decirle al alumno QUÉ
// palabra puntual costó entender. Este módulo agrupa los tokens en
// palabras para poder señalar la más débil de la frase.

export type TokenLogprob = { token?: string; logprob?: number }
export type PalabraConfianza = { palabra: string; confianza: number }

// Un token que empieza con espacio marca el inicio de una palabra nueva;
// los que no lo tienen son continuación de la palabra anterior. Esta es la
// convención estándar de los tokenizers BPE de OpenAI.
export function agruparPorPalabra(logprobs: TokenLogprob[] | undefined): PalabraConfianza[] {
  if (!logprobs || logprobs.length === 0) return []
  const grupos: { texto: string; logprobs: number[] }[] = []
  for (const { token, logprob } of logprobs) {
    if (typeof token !== 'string' || typeof logprob !== 'number') continue
    if (grupos.length === 0 || /^\s/.test(token)) {
      grupos.push({ texto: token, logprobs: [logprob] })
    } else {
      grupos[grupos.length - 1].texto += token
      grupos[grupos.length - 1].logprobs.push(logprob)
    }
  }
  return grupos
    .map(g => ({
      palabra: g.texto.trim(),
      confianza: Math.exp(g.logprobs.reduce((a, b) => a + b, 0) / g.logprobs.length),
    }))
    .filter(g => g.palabra.length > 0)
}

function limpiarPalabra(texto: string): string {
  return texto.replace(/^[^a-zA-Z']+|[^a-zA-Z']+$/g, '')
}

const UMBRAL_PALABRA_DEBIL = 0.6

// Solo palabras alfabéticas de al menos 3 letras califican como candidatas:
// descarta signos de puntuación sueltos y palabras función muy cortas (a,
// to, in) que suelen salir con confianza baja de forma natural sin que sea
// una señal real de pronunciación. Devuelve la más débil entre las que
// bajan del umbral, o null si ninguna califica.
export function palabraMasDebil(logprobs: TokenLogprob[] | undefined): PalabraConfianza | null {
  const candidatas = agruparPorPalabra(logprobs)
    .map(p => ({ palabra: limpiarPalabra(p.palabra), confianza: p.confianza }))
    .filter(p => p.palabra.length >= 3 && /^[a-zA-Z']+$/.test(p.palabra) && p.confianza < UMBRAL_PALABRA_DEBIL)
  if (candidatas.length === 0) return null
  return candidatas.reduce((peor, p) => (p.confianza < peor.confianza ? p : peor), candidatas[0])
}
