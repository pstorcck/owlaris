// Para preguntas humanísticas / abiertas no hay una operación canónica de la
// que derivar un tema (a diferencia de describeMathTopic). Sin limpieza, el
// reporte familiar terminaba mostrando el texto crudo del alumno como si
// fuera el tema estudiado (ej. "sobre la celula" en vez de "La célula").
const PREFIJOS_RELLENO = [
  /^sobre\s+/i,
  /^acerca de\s+/i,
  /^qu[eé] es\s+/i,
  /^que es\s+/i,
  /^explica(me)?\s+/i,
  /^expl[ií]cam[ea]\s+/i,
  /^puedes explicarme\s+/i,
  /^podr[ií]as explicarme\s+/i,
  /^cu[eé]ntame( sobre)?\s+/i,
  /^quiero saber( m[aá]s)?( sobre)?\s+/i,
  /^d[ií]me( sobre)?\s+/i,
  /^ay[uú]dame con\s+/i,
  /^tengo una duda( sobre)?\s+/i,
  /^what is\s+/i,
  /^what are\s+/i,
  /^can you explain\s+/i,
  /^tell me about\s+/i,
  /^i want to know( more)?( about)?\s+/i,
  /^help me with\s+/i,
]

function capitalizar(value: string): string {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function limpiarTemaGeneral(pregunta: string, idiomaIngles = false): string {
  let t = (pregunta || '').trim().replace(/^[¿¡]+/, '').replace(/[¿?¡!]+$/g, '').trim()
  for (const patron of PREFIJOS_RELLENO) {
    const antes = t
    t = t.replace(patron, '').trim()
    // Solo se aplica un prefijo — evita sobre-limpiar una pregunta legítima
    // que empiece con varias de estas palabras encadenadas.
    if (t !== antes) break
  }
  t = t.replace(/\s+/g, ' ').trim()
  if (t.length < 3) return idiomaIngles ? 'Open question' : 'Pregunta abierta'
  return capitalizar(t).substring(0, 100)
}
