export type InteraccionSeguridad = {
  estado_evaluacion?: string | null
  sospecha_copia?: boolean | null
}

export function contarAlertasSensibles(interacciones: InteraccionSeguridad[]): number {
  return interacciones.filter(i => i.estado_evaluacion === 'alerta_seguridad' || i.estado_evaluacion === 'crisis_emocional').length
}

export function contarSospechasCopia(interacciones: InteraccionSeguridad[]): number {
  return interacciones.filter(i => !!i.sospecha_copia).length
}

// Alertas que un padre necesita ver aunque el hijo estudie solo y el padre
// solo reciba el reporte: temas sensibles tocados durante la sesión, e
// intentos de copiar/pedir la respuesta directa en vez de razonarla. Es
// determinístico (no depende del LLM) para que nunca se omita por error.
export function resumenSeguridadIntegridad(alertasSensibles: number, sospechasCopia: number, idiomaIngles = false): string[] {
  const partes: string[] = []
  if (alertasSensibles > 0) {
    partes.push(idiomaIngles
      ? `Today's session touched a sensitive topic ${alertasSensibles} time${alertasSensibles === 1 ? '' : 's'}. We recommend talking with your child about it.`
      : `Hoy la sesión tocó un tema sensible ${alertasSensibles} ${alertasSensibles === 1 ? 'vez' : 'veces'}. Te sugerimos hablar con tu hijo o hija sobre esto.`)
  }
  if (sospechasCopia > 0) {
    partes.push(idiomaIngles
      ? `We detected ${sospechasCopia} possible attempt${sospechasCopia === 1 ? '' : 's'} to copy or ask for the direct answer instead of working through it. We recommend talking about this with your child.`
      : `Se detectaron ${sospechasCopia} posible${sospechasCopia === 1 ? '' : 's'} intento${sospechasCopia === 1 ? '' : 's'} de copiar o pedir la respuesta directa en vez de razonarla. Te sugerimos conversarlo con tu hijo o hija.`)
  }
  return partes
}
