// Precios de gpt-4o-mini: $0.15 / 1M tokens de entrada, $0.60 / 1M tokens de salida.
// El calculo anterior aplicaba el precio de entrada a todos los tokens, subestimando
// el costo real (los tokens de salida cuestan 4x mas).
const PRECIO_INPUT_POR_TOKEN = 0.15 / 1_000_000
const PRECIO_OUTPUT_POR_TOKEN = 0.60 / 1_000_000

export type OpenAIUsage = {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
} | null | undefined

export function calcularCostoUSD(usage: OpenAIUsage): number {
  if (!usage) return 0
  const promptTokens = usage.prompt_tokens ?? 0
  const completionTokens = usage.completion_tokens ?? 0
  if (promptTokens === 0 && completionTokens === 0) {
    // Respaldo si el SDK no separa input/output: mantiene el comportamiento anterior.
    return (usage.total_tokens || 0) * PRECIO_INPUT_POR_TOKEN
  }
  return promptTokens * PRECIO_INPUT_POR_TOKEN + completionTokens * PRECIO_OUTPUT_POR_TOKEN
}
