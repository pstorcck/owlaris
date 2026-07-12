import assert from 'node:assert/strict'
import { withOpenAIRetry, withRetry } from '../src/lib/openaiRetry'
import { calcularCostoUSD } from '../src/lib/openaiCost'

async function main() {
  // ── Costo real por token ──────────────────────────────────────
  assert.equal(calcularCostoUSD({ prompt_tokens: 1_000_000, completion_tokens: 0 }), 0.15)
  assert.equal(calcularCostoUSD({ prompt_tokens: 0, completion_tokens: 1_000_000 }), 0.6)
  assert.equal(
    calcularCostoUSD({ prompt_tokens: 500_000, completion_tokens: 500_000 }),
    0.15 * 0.5 + 0.6 * 0.5
  )
  assert.equal(calcularCostoUSD(null), 0)
  assert.equal(calcularCostoUSD(undefined), 0)
  // Respaldo cuando el SDK no separa prompt/completion tokens.
  assert.equal(calcularCostoUSD({ total_tokens: 1_000_000 }), 0.15)

  // ── Reintentos con backoff ────────────────────────────────────
  let intentos = 0
  const resultadoExitoso = await withOpenAIRetry(async () => {
    intentos += 1
    if (intentos < 3) {
      const error = new Error('rate limited') as Error & { status: number }
      error.status = 429
      throw error
    }
    return 'ok'
  }, { baseDelayMs: 1 })
  assert.equal(resultadoExitoso, 'ok')
  assert.equal(intentos, 3)

  let intentosNoRetryable = 0
  await assert.rejects(
    withOpenAIRetry(async () => {
      intentosNoRetryable += 1
      const error = new Error('bad request') as Error & { status: number }
      error.status = 400
      throw error
    }, { baseDelayMs: 1 })
  )
  assert.equal(intentosNoRetryable, 1, 'no debe reintentar errores no recuperables (4xx distinto de 429)')

  let intentosAgotados = 0
  await assert.rejects(
    withOpenAIRetry(async () => {
      intentosAgotados += 1
      const error = new Error('server error') as Error & { status: number }
      error.status = 500
      throw error
    }, { maxRetries: 2, baseDelayMs: 1 })
  )
  assert.equal(intentosAgotados, 3, 'debe intentar 1 + maxRetries veces antes de rendirse')

  // Hallazgo real (segunda verificación, 2026-07-12): tres errores de
  // servidor consecutivos antes de que una práctica de Geometría tuviera
  // éxito — patrón típico de una falla transitoria de red al llamar a
  // Microsoft Graph (SharePoint), donde ninguna llamada de red tenía
  // reintento (a diferencia de la llamada a OpenAI). withRetry reutiliza la
  // misma lógica: un error de conexión típico de fetch (TypeError, sin
  // .status) debe tratarse como recuperable e intentarse de nuevo.
  let intentosFetchFallido = 0
  const resultadoFetchRecuperado = await withRetry(async () => {
    intentosFetchFallido += 1
    if (intentosFetchFallido < 2) throw new TypeError('fetch failed')
    return 'ok'
  }, { baseDelayMs: 1 })
  assert.equal(resultadoFetchRecuperado, 'ok')
  assert.equal(intentosFetchFallido, 2)

  console.log('openai-reliability smoke passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
