// contentSafety.ts — Protección de contenido para menores en Owlaris
// Versión cuidadosa: protege sin rechazar, sin discriminar

export type ContentSafetyType =
  | 'crisis_autolesion'
  | 'crisis_abuso'
  | 'violencia'
  | 'politica_persuasiva'
  | 'religion_opinion'
  | 'sexual_no_academico'
  | 'identidad_personal_sensible'
  | 'ninguno'

export type ContentSafetyResult = {
  bloqueado: boolean
  tipo: ContentSafetyType
  respuesta: string | null
}

function norm(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function coincide(texto: string, patrones: string[]): boolean {
  const t = norm(texto)
  return patrones.some(p => t.includes(norm(p)))
}

// CRISIS AUTOLESIÓN — máxima prioridad
const AUTOLESION = [
  'me quiero matar', 'quiero morir', 'suicidar', 'quitarme la vida',
  'hacerme daño', 'cortarme', 'no quiero vivir', 'mejor muerto',
  'me voy a matar', 'autolesion', 'autolesionarme', 'me voy a cortar',
  'quisiera morirme', 'prefiero estar muerto', 'ya no quiero estar aquí',
]

// CRISIS ABUSO — reportar, no profundizar
const ABUSO = [
  'me abusaron', 'me violaron', 'me tocaron inapropiadamente',
  'abuso sexual', 'violación', 'me viola', 'me abusa',
  'un adulto me toca', 'me hacen cosas', 'me lastiman en casa',
  'me pegan mucho', 'me maltratan', 'me hacen daño en casa',
]

// VIOLENCIA — redirigir a adulto
const VIOLENCIA = [
  'me golpean', 'me pegan todos los días', 'violencia en casa',
  'mi papá me golpea', 'mi mamá me golpea', 'me amenazan',
  'me hacen bullying físico', 'me lastiman',
]

// POLÍTICA PERSUASIVA — no opinar, no persuadir
const POLITICA = [
  'cuál partido es mejor', 'a quién votar', 'mejor presidente',
  'el socialismo es bueno', 'el capitalismo es malo',
  'deberías votar por', 'el gobierno de', 'revolución política',
  'comunismo es mejor', 'marxismo dice', 'ideología política',
]

// RELIGIÓN COMO OPINIÓN — no comparar religiones
const RELIGION = [
  'cuál religión es verdadera', 'dios existe o no', 'mejor religión',
  'la biblia tiene razón', 'el corán es verdad', 'satanismo',
  'mi religión es mejor', 'los ateos están mal',
]

// SEXUAL EXPLÍCITO NO ACADÉMICO — bloquear siempre
const SEXUAL_EXPLICITO = [
  'sexo explícito', 'pornografía', 'porno', 'contenido sexual',
  'cómo tener sexo', 'posiciones sexuales', 'masturbación cómo',
  'fotos íntimas', 'videos sexuales', 'sexting',
]

// IDENTIDAD PERSONAL SENSIBLE — responder con calidez, NO bloquear por ser quien son
// Solo bloquear si pide persuasión, contenido explícito o debate ideológico
const IDENTIDAD_SENSIBLE = [
  'cuál orientación sexual es correcta', 'la homosexualidad es pecado',
  'los gays van al infierno', 'convénceme de ser', 'el transgenerismo es una enfermedad',
  'cambio de sexo cómo', 'operación de género cómo',
]

export function checkContentSafety(pregunta: string, idiomaIngles = false): ContentSafetyResult {
  const ninguno: ContentSafetyResult = { bloqueado: false, tipo: 'ninguno', respuesta: null }

  if (!pregunta?.trim()) return ninguno

  const es = idiomaIngles

  // 1. Crisis autolesión — máxima prioridad
  if (coincide(pregunta, AUTOLESION)) {
    return {
      bloqueado: true,
      tipo: 'crisis_autolesion',
      respuesta: es
        ? 'You are not alone. Please reach out to a trusted adult, a school counselor, or emergency services right now if you are in danger. Your life matters.'
        : 'No estás solo. Por favor busca ahora mismo a un adulto de confianza, un orientador escolar o servicios de emergencia si estás en peligro. Tu vida importa.',
    }
  }

  // 2. Crisis abuso
  if (coincide(pregunta, ABUSO)) {
    return {
      bloqueado: true,
      tipo: 'crisis_abuso',
      respuesta: es
        ? 'What you are sharing is very serious. Please tell a trusted adult, a teacher, or a counselor right away. You deserve to be safe.'
        : 'Lo que describes es muy serio. Por favor cuéntaselo ahora a un adulto de confianza, un maestro o un orientador. Mereces estar seguro.',
    }
  }

  // 3. Violencia
  if (coincide(pregunta, VIOLENCIA)) {
    return {
      bloqueado: true,
      tipo: 'violencia',
      respuesta: es
        ? 'That sounds very serious. Please talk to a trusted adult or school counselor as soon as possible. You do not have to face this alone.'
        : 'Eso suena muy serio. Por favor habla con un adulto de confianza o un orientador escolar lo antes posible. No tienes que enfrentar esto solo.',
    }
  }

  // 4. Sexual explícito
  if (coincide(pregunta, SEXUAL_EXPLICITO)) {
    return {
      bloqueado: true,
      tipo: 'sexual_no_academico',
      respuesta: es
        ? 'That is not something I can help with. How can I support your studies today?'
        : 'Ese no es un tema que pueda abordar. ¿En qué te puedo ayudar con tus estudios hoy?',
    }
  }

  // 5. Política persuasiva
  if (coincide(pregunta, POLITICA)) {
    return {
      bloqueado: true,
      tipo: 'politica_persuasiva',
      respuesta: es
        ? 'That is a topic outside of what I can address. How can I help you with your studies?'
        : 'Ese es un tema fuera de mi alcance. ¿En qué te puedo ayudar con tus estudios?',
    }
  }

  // 6. Religión como opinión
  if (coincide(pregunta, RELIGION)) {
    return {
      bloqueado: true,
      tipo: 'religion_opinion',
      respuesta: es
        ? 'That is a topic outside of what I can address. How can I help you with your studies?'
        : 'Ese es un tema fuera de mi alcance. ¿En qué te puedo ayudar con tus estudios?',
    }
  }

  // 7. Identidad — solo bloquear si pide persuasión o debate ideológico
  // "soy gay", "soy lesbiana", "me siento diferente" NO se bloquea
  if (coincide(pregunta, IDENTIDAD_SENSIBLE)) {
    return {
      bloqueado: true,
      tipo: 'identidad_personal_sensible',
      respuesta: es
        ? 'That is a topic outside of what I can address. How can I help you with your studies?'
        : 'Ese es un tema fuera de mi alcance. ¿En qué te puedo ayudar con tus estudios?',
    }
  }

  return ninguno
}
