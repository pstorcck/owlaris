// Proteccion de contenido para menores.
// Capa deterministica: maneja temas sensibles antes de llamar al modelo.

export type ContentSafetyType =
  | 'crisis_autolesion'
  | 'crisis_abuso'
  | 'violencia'
  | 'sexual_no_academico'
  | 'politica_persuasiva'
  | 'religion_opinion'
  | 'apoyo_identidad'
  | 'ninguno'

export type ContentSafetyResult = {
  bloqueado: boolean
  tipo: ContentSafetyType
  respuesta: string | null
}

function normalize(text: string): string {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function includesAny(text: string, patterns: Array<string | RegExp>): boolean {
  return patterns.some((pattern) =>
    typeof pattern === 'string' ? text.includes(normalize(pattern)) : pattern.test(text)
  )
}

const SELF_HARM = [
  'me quiero matar', 'quiero morir', 'quiero morirme', 'me quiero morir',
  'quitarme la vida', 'me voy a matar', 'suicidar', 'suicidio',
  'no quiero vivir', 'prefiero estar muerto', 'mejor muerto',
  'hacerme daño', 'hacerme dano', 'cortarme', 'autolesion', 'autolesionarme',
  /(?:ya no|no)\s+aguanto\s+(?:vivir|mas)/,
]

const ABUSE = [
  'abuso sexual', 'me abusaron', 'me violaron', 'me viola', 'me abusa',
  'me tocaron', 'me toca inapropiadamente', 'me tocaron mis partes',
  'me hicieron daño', 'me hicieron dano', 'acoso sexual', 'me acosan',
  'un adulto me toca', 'me obligan a tocar',
]

const VIOLENCE = [
  'me pegan', 'me golpean', 'me maltratan', 'me pega', 'me golpea',
  'violencia domestica', 'violencia en casa', 'me amenaza', 'me amenazan',
  'tengo miedo en casa', 'mis papas pelean fuerte', 'mis padres pelean fuerte',
]

const SEXUAL_NON_ACADEMIC = [
  'mandame fotos', 'manda fotos desnuda', 'manda nudes', 'nudes',
  'sexo explicito', 'quiero ver porno', 'pornografia', 'porno',
  'como tener sexo', 'como besar sexualmente', 'hablame sucio',
]

const POLITICAL_PERSUASION = [
  'por quien votar', 'por quién votar', 'a quien votar', 'a quién votar',
  'votar por', 'mejor candidato', 'mejor presidente', 'que partido es mejor',
  'qué partido es mejor', 'convenceme de votar', 'campaña politica',
  'campana politica', 'haz propaganda', 'apoya a este partido',
]

const POLITICAL_ALWAYS_BLOCK = [
  'convenceme de votar', 'convenceme para votar', 'campaña politica',
  'campana politica', 'haz propaganda', 'apoya a este partido',
]

const RELIGION_OPINION = [
  'cual religion es verdadera', 'cuál religión es verdadera',
  'mejor religion', 'mejor religión', 'dios existe', 'dios no existe',
  'religion falsa', 'religión falsa', 'unica religion verdadera',
  'única religión verdadera', 'debo cambiarme de religion',
]

const IDENTITY_SUPPORT = [
  'soy gay', 'soy lesbiana', 'soy bisexual', 'soy trans', 'soy transgenero',
  'soy transgénero', 'soy no binario', 'me gustan los hombres',
  'me gustan las mujeres', 'creo que soy gay', 'creo que soy lesbiana',
]

const ACADEMIC_INTENT = [
  'explica', 'resumen', 'resumir', 'investiga', 'investigar', 'tarea',
  'clase', 'historia', 'causas', 'consecuencias', 'definicion', 'definición',
  'concepto', 'analiza', 'analisis', 'análisis', 'ensayo', 'lectura',
  'biologia', 'biología', 'ciencias', 'literatura',
]

function isAcademicQuestion(text: string) {
  return includesAny(text, ACADEMIC_INTENT)
}

function crisisResponse(tipo: ContentSafetyType, idiomaIngles: boolean): string {
  if (idiomaIngles) {
    if (tipo === 'crisis_autolesion') {
      return 'I am really sorry you are feeling this. You should not handle this alone. Please talk to a trusted adult right now, such as a parent, teacher, counselor, or school guide. If you might hurt yourself or you are in immediate danger, contact emergency services in your country right away. I can stay with you for study support, but this needs help from a real adult now.'
    }
    if (tipo === 'crisis_abuso') {
      return 'What you described sounds very serious. Please tell a trusted adult right away, such as a parent, teacher, counselor, school guide, or another adult who can protect you. If you are in immediate danger, contact emergency services in your country now. You deserve to be safe.'
    }
    return 'That sounds unsafe and serious. Please talk to a trusted adult right away, such as a parent, teacher, counselor, or school guide. If there is immediate danger, contact emergency services in your country now.'
  }

  if (tipo === 'crisis_autolesion') {
    return 'Siento mucho que te estés sintiendo así. No tienes que manejar esto solo. Por favor habla ahora mismo con un adulto de confianza, como un familiar, maestro, orientador o guía del colegio. Si crees que puedes hacerte daño o estás en peligro inmediato, contacta a los servicios de emergencia de tu país de inmediato. Yo puedo acompañarte con tus estudios, pero esto necesita ayuda real de un adulto ahora.'
  }
  if (tipo === 'crisis_abuso') {
    return 'Lo que describes suena muy serio. Por favor cuéntaselo de inmediato a un adulto de confianza, como un familiar, maestro, orientador, guía del colegio u otra persona adulta que pueda protegerte. Si estás en peligro inmediato, contacta a los servicios de emergencia de tu país ahora. Mereces estar seguro.'
  }
  return 'Eso suena inseguro y serio. Por favor habla de inmediato con un adulto de confianza, como un familiar, maestro, orientador o guía del colegio. Si hay peligro inmediato, contacta a los servicios de emergencia de tu país ahora.'
}

function outOfScopeResponse(idiomaIngles: boolean): string {
  return idiomaIngles
    ? 'That is not a topic I can discuss here. I can help you with school subjects, study skills, reading, writing, math, science, or practice questions.'
    : 'Ese no es un tema que pueda conversar aquí. Sí puedo ayudarte con materias del colegio, hábitos de estudio, lectura, escritura, matemática, ciencias o preguntas de práctica.'
}

function identitySupportResponse(idiomaIngles: boolean): string {
  return idiomaIngles
    ? 'Thank you for trusting me. You deserve respect and kindness. If you want to talk about how you feel, it is a good idea to speak with a trusted adult, counselor, or school guide. I can also help you return to your studies whenever you are ready.'
    : 'Gracias por confiarme eso. Mereces respeto y buen trato. Si quieres hablar de cómo te sientes, es buena idea hacerlo con un adulto de confianza, orientador o guía del colegio. También puedo ayudarte a volver a tus estudios cuando estés listo.'
}

export function checkContentSafety(pregunta: string, idiomaIngles = false): ContentSafetyResult {
  const p = normalize(pregunta)
  if (!p) return { bloqueado: false, tipo: 'ninguno', respuesta: null }

  if (includesAny(p, SELF_HARM)) {
    return { bloqueado: true, tipo: 'crisis_autolesion', respuesta: crisisResponse('crisis_autolesion', idiomaIngles) }
  }
  if (includesAny(p, ABUSE)) {
    return { bloqueado: true, tipo: 'crisis_abuso', respuesta: crisisResponse('crisis_abuso', idiomaIngles) }
  }
  if (includesAny(p, VIOLENCE)) {
    return { bloqueado: true, tipo: 'violencia', respuesta: crisisResponse('violencia', idiomaIngles) }
  }
  if (includesAny(p, SEXUAL_NON_ACADEMIC)) {
    return { bloqueado: true, tipo: 'sexual_no_academico', respuesta: outOfScopeResponse(idiomaIngles) }
  }
  if (includesAny(p, POLITICAL_ALWAYS_BLOCK)) {
    return { bloqueado: true, tipo: 'politica_persuasiva', respuesta: outOfScopeResponse(idiomaIngles) }
  }
  if (includesAny(p, POLITICAL_PERSUASION) && !isAcademicQuestion(p)) {
    return { bloqueado: true, tipo: 'politica_persuasiva', respuesta: outOfScopeResponse(idiomaIngles) }
  }
  if (includesAny(p, RELIGION_OPINION) && !isAcademicQuestion(p)) {
    return { bloqueado: true, tipo: 'religion_opinion', respuesta: outOfScopeResponse(idiomaIngles) }
  }
  if (includesAny(p, IDENTITY_SUPPORT)) {
    return { bloqueado: true, tipo: 'apoyo_identidad', respuesta: identitySupportResponse(idiomaIngles) }
  }

  return { bloqueado: false, tipo: 'ninguno', respuesta: null }
}
