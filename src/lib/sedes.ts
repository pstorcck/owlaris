export const SEDES_POR_PREFIJO: Record<string, string> = {
  cortijo: 'Cortijo',
  pla: 'Portal Los Alamos',
}

export const SEDE_PRINCIPAL = 'Colegio Montano'

export function detectarSedePorEmail(email: string | null | undefined): string {
  const prefijo = String(email || '').split('-')[0].toLowerCase().trim()
  return SEDES_POR_PREFIJO[prefijo] || SEDE_PRINCIPAL
}

export function mismaSedePorEmail(a: string | null | undefined, b: string | null | undefined): boolean {
  return detectarSedePorEmail(a) === detectarSedePorEmail(b)
}
