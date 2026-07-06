export type TipoErrorTecnico = 'openai_agotado' | 'fuente_no_disponible' | 'materia_no_disponible' | 'error_interno'

// Clasifica el error real capturado en el catch general de una ruta para
// decidir qué mensaje mostrarle al alumno — instructivo de mejoras, punto
// 22: el mensaje técnico debe distinguirse según la causa, no ser siempre
// el mismo "Hubo un problema. Intenta de nuevo." genérico.
export function clasificarErrorTecnico(err: unknown): TipoErrorTecnico {
  const status = (err as { status?: number } | null)?.status
  if (status === 429 || (typeof status === 'number' && status >= 500)) return 'openai_agotado'

  const mensaje = (err instanceof Error ? err.message : String(err)).toLowerCase()
  if (/sharepoint|graph\.microsoft|timeout|timed out|etimedout|econnreset|fetch failed|network|abort/.test(mensaje)) {
    return 'fuente_no_disponible'
  }
  if (/materia|colegio|carpeta|grado/.test(mensaje)) return 'materia_no_disponible'
  return 'error_interno'
}

export function mensajeErrorTecnico(input: {
  tipo: TipoErrorTecnico
  materiaNombre?: string | null
  idiomaIngles?: boolean
}): string {
  const { tipo, materiaNombre, idiomaIngles } = input

  if (tipo === 'materia_no_disponible' && materiaNombre) {
    return idiomaIngles
      ? `I could not load ${materiaNombre} right now. Try again or select another subject.`
      : `No pude cargar ${materiaNombre} en este momento. Intenta nuevamente o selecciona otra materia.`
  }

  if (tipo === 'fuente_no_disponible') {
    return idiomaIngles
      ? "I could not load this subject's content right now. Try again in a few seconds."
      : 'No pude cargar el contenido de esta materia en este momento. Intenta nuevamente en unos segundos.'
  }

  return idiomaIngles
    ? 'We had a technical problem loading the response. Please try again in a few seconds.'
    : 'Tuvimos un problema técnico al cargar la respuesta. Intenta nuevamente en unos segundos.'
}

// Contexto enriquecido para la alerta técnica interna — instructivo, punto
// 22: usuario, materia activa, grado activo, acción solicitada, hora,
// fuente esperada, tipo de error y mensaje mostrado al alumno.
export function construirContextoErrorTecnico(input: {
  ruta: string
  usuarioId?: string | null
  materia?: string | null
  grado?: string | null
  accion?: string | null
  fuenteEsperada?: string | null
  mensajeMostrado: string
  detalleError: string
}): string {
  return [
    `Ruta:${input.ruta}`,
    input.usuarioId ? `Usuario:${input.usuarioId}` : null,
    input.materia ? `Materia:${input.materia}` : null,
    input.grado ? `Grado:${input.grado}` : null,
    input.accion ? `Accion:${input.accion}` : null,
    input.fuenteEsperada ? `Fuente:${input.fuenteEsperada}` : null,
    `Hora:${new Date().toISOString()}`,
    `MensajeMostrado:${input.mensajeMostrado}`,
    `Detalle:${input.detalleError}`,
  ].filter(Boolean).join(' | ').substring(0, 500)
}
