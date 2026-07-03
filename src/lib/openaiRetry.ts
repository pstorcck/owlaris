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
