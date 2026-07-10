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

// Intentos de copiar/pedir la respuesta directa en vez de razonarla. Es
// determinístico (no depende del LLM) para que nunca se omita por error.
export function resumenSeguridadIntegridad(sospechasCopia: number, idiomaIngles = false): string[] {
  const partes: string[] = []
  if (sospechasCopia > 0) {
    partes.push(idiomaIngles
      ? `We detected ${sospechasCopia} possible attempt${sospechasCopia === 1 ? '' : 's'} to copy or ask for the direct answer instead of working through it. We recommend talking about this with your child.`
      : `Se detectaron ${sospechasCopia} posible${sospechasCopia === 1 ? '' : 's'} intento${sospechasCopia === 1 ? '' : 's'} de copiar o pedir la respuesta directa en vez de razonarla. Te sugerimos conversarlo con tu hijo o hija.`)
  }
  return partes
}

// Hallazgo real (QA Ronda 3, 2026-07-10): las revelaciones serias de
// bienestar (posible trastorno alimenticio, violencia familiar, oferta de
// sustancias) quedaban invisibles para la familia — solo existía la
// sección de honestidad académica, y el conteo de "temas sensibles" estaba
// mezclado ahí con un texto genérico y débil ("tocó un tema sensible").
// Se separa en su propia sección, con lenguaje más directo y accionable,
// porque el público de este reporte es la familia y una revelación de
// bienestar merece una llamada a la acción más clara que una sospecha de
// copia académica.
export function resumenBienestarSeguridad(alertasSensibles: number, idiomaIngles = false): string[] {
  const partes: string[] = []
  if (alertasSensibles > 0) {
    partes.push(idiomaIngles
      ? `Today's session included ${alertasSensibles} moment${alertasSensibles === 1 ? '' : 's'} where your child shared something related to their wellbeing or safety. Owlaris responded with care and encouraged talking to a trusted adult, but we strongly recommend you follow up with your child about this as soon as possible.`
      : `La sesión de hoy incluyó ${alertasSensibles} ${alertasSensibles === 1 ? 'momento' : 'momentos'} en que tu hijo o hija compartió algo relacionado con su bienestar o seguridad. Owlaris respondió con cuidado y lo animó a hablar con un adulto de confianza, pero te recomendamos encarecidamente que converses con él o ella sobre esto lo antes posible.`)
  }
  return partes
}
