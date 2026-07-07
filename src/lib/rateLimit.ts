// Hallazgo real (auditoría 2026-07-07): /api/preguntar, /api/transcribir y
// /api/tts no tenían ningún límite de frecuencia por usuario — una sola
// cuenta autenticada podía disparar llamadas repetidas a OpenAI (costo real)
// sin ningún freno más allá de la latencia natural de cada request.
//
// Ventana deslizante en memoria, por proceso. En Vercel (runtime Node.js) una
// misma instancia lambda atiende varias requests consecutivas mientras está
// "caliente", así que esto frena ráfagas reales del mismo usuario en ese
// lapso — no es un límite duro y global entre instancias concurrentes (eso
// requeriría Redis/Upstash), pero cubre el abuso más común sin agregar
// infraestructura nueva.
type Bucket = { count: number; inicioVentana: number }

const buckets = new Map<string, Bucket>()

export type ResultadoLimite = { permitido: boolean; reintentarEnMs: number }

export function verificarLimiteFrecuencia(
  clave: string,
  limite: number,
  ventanaMs: number,
  ahora: number = Date.now()
): ResultadoLimite {
  const bucket = buckets.get(clave)

  if (!bucket || ahora - bucket.inicioVentana >= ventanaMs) {
    buckets.set(clave, { count: 1, inicioVentana: ahora })
    return { permitido: true, reintentarEnMs: 0 }
  }

  if (bucket.count >= limite) {
    return { permitido: false, reintentarEnMs: ventanaMs - (ahora - bucket.inicioVentana) }
  }

  bucket.count++
  return { permitido: true, reintentarEnMs: 0 }
}
