function isRetryableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return true
  const status = (error as { status?: number }).status
  if (status === undefined) return true // errores de conexion/timeout del SDK no traen status
  return status === 429 || status >= 500
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

export async function withOpenAIRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; baseDelayMs?: number } = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 2
  const baseDelayMs = options.baseDelayMs ?? 500
  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt === maxRetries || !isRetryableError(error)) throw error
      await sleep(baseDelayMs * 2 ** attempt)
    }
  }
  throw lastError
}

// Hallazgo real (segunda verificación, 2026-07-12): el alumno reportó tres
// errores de servidor consecutivos antes de que una práctica de Geometría
// tuviera éxito — un patrón típico de una falla transitoria de red al
// llamar a Microsoft Graph (SharePoint), donde el flujo de búsqueda de
// contenido hace muchas llamadas de red secuenciales antes de responder, y
// ninguna tenía reintento (a diferencia de la llamada a OpenAI, que sí lo
// tenía desde antes). Se reutiliza la misma lógica de reintento genérica
// para envolver esas llamadas de red también, en vez de duplicarla.
export const withRetry = withOpenAIRetry
