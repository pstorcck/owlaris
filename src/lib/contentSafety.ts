// Proteccion de contenido para menores.
// Capa deterministica: maneja temas sensibles antes de llamar al modelo.

export type ContentSafetyType =
  | 'crisis_autolesion'
  | 'crisis_abuso'
  | 'crisis_sustancias'
  | 'crisis_alimenticio'
  | 'crisis_acoso_escolar'
  | 'violencia'
  | 'dano_otros'
  | 'armas'
  | 'drogas_delitos'
  | 'sexual_no_academico'
  | 'politica_persuasiva'
  | 'religion_opinion'
  | 'apoyo_identidad'
  | 'ninguno'

export type ContentSafetySeverity = 'ninguna' | 'baja' | 'media' | 'alta'

export type ContentSafetyResult = {
  bloqueado: boolean
  tipo: ContentSafetyType
  severidad: ContentSafetySeverity
  debeAlertar: boolean
  respuesta: string | null
}

function normalize(text: string): string {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    // Sustituciones foneticas comunes al escribir rapido (komo->como, kiero->quiero, qiero->quiero).
    // Solo afecta el texto usado para comparar contra las listas de riesgo, no lo que ve el alumno.
    .replace(/k([ie])/g, 'qu$1')
    .replace(/k/g, 'c')
    .replace(/q(?!u)([ie])/g, 'qu$1')
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
  'me quiero suicidar', 'quisiera morirme', 'no quiero seguir vivo',
  'no quiero seguir viva', 'me quiero cortar', 'pienso en suicidarme',
  'i want to kill myself', 'i want to die', 'i want to end my life',
  'i am going to kill myself', 'i do not want to live', "i don't want to live",
  'i want to hurt myself', 'i want to cut myself', 'suicide',
  /(?:ya no|no)\s+aguanto\s+(?:vivir|mas)/,
  /(?:quiero|quisiera|pienso en)\s+(?:mi\s+)?muerte/,
]

const ABUSE = [
  'abuso sexual', 'me abusaron', 'me violaron', 'me viola', 'me abusa',
  'me tocaron', 'me toca inapropiadamente', 'me tocaron mis partes',
  'me hicieron daño', 'me hicieron dano', 'acoso sexual', 'me acosan',
  'un adulto me toca', 'me obligan a tocar',
  'violacion', 'sufri una violacion', 'fui violada', 'fui violado',
  'me estan violando', 'me intentaron violar', 'me tocaron sin permiso',
  'un familiar me toca', 'mi padrastro me toca', 'mi madrastra me toca',
  'me obligaron a tener sexo', 'me forzaron',
  'me han violado', 'me han tocado', 'me han tocado sin permiso',
  'me han abusado', 'me han obligado a tener sexo', 'me han forzado',
  'sexual abuse', 'i was abused', 'i was raped', 'someone raped me',
  'an adult touched me', 'someone touched my private parts',
  'they touched me without permission', 'i was forced to have sex',
  'they have touched me', 'they have raped me', 'i have been abused',
  'i have been raped', 'i have been forced to have sex',
]

const VIOLENCE = [
  'me pegan', 'me golpean', 'me maltratan', 'me pega', 'me golpea',
  'violencia domestica', 'violencia en casa', 'me amenaza', 'me amenazan',
  'tengo miedo en casa', 'mis papas pelean fuerte', 'mis padres pelean fuerte',
  'me estan golpeando', 'me estan maltratando', 'me hacen daño en casa',
  'me hacen dano en casa', 'i am being hit', 'they hit me at home',
  'domestic violence', 'violence at home', 'i am afraid at home',
  'me han golpeado', 'me han pegado', 'me han maltratado',
  'me han amenazado', 'me han hecho daño', 'me han hecho dano',
  'they have hit me', 'they have hurt me',
  // Hallazgo real (QA Ronda 3, 2026-07-10): "en mi casa mi papá grita mucho
  // y a veces le pega a mi mamá, tengo miedo" no coincidía con ninguna
  // frase de esta lista — todas requerían que la violencia fuera HACIA el
  // alumno ("me pega"), no hacia otro familiar ("le pega a mi mamá").
  /le pega[n]?\s+a\s+mi\s+(mama|mami|papa|papi|hermano|hermana|abuela|abuelo)/,
  /le grita[n]?\s+mucho\s+a\s+mi\s+(mama|mami|papa|papi)/,
  /mi\s+(papa|papi|padre|madre|mama|mami)\s+(le\s+)?pega\s+a\s+mi\s+(mama|mami|papa|papi)/,
  'hits my mom', 'hits my mother', 'hits my dad', 'hits my father',
]

// Hallazgo real (QA Ronda 3, 2026-07-10): "un amigo me ofreció unas
// pastillas en la fiesta y no sé qué hacer, ¿me ayudas?" fue completamente
// ignorado — el tutor respondió como si el alumno solo quisiera seguir con
// el ejercicio activo. La causa real no era esta lista (ya se revisó que
// checkContentSafety corre ANTES que cualquier lógica de continuidad de
// ejercicio, así que si esta lista la detecta, nunca llega a ese otro
// código) — la causa era que esta categoría no existía en absoluto: ser
// ofrecido/presionado con sustancias no estaba cubierto ni aquí ni en
// DRUGS_OR_CRIME (que solo cubre pedir CÓMO vender/fabricar/conseguir
// droga, un caso muy distinto). Se trata como categoría de crisis propia
// (como autolesión/abuso), con una respuesta empática — NO la respuesta
// fría de "fuera de alcance" que usa DRUGS_OR_CRIME, porque aquí el alumno
// es quien está en riesgo, no quien pide algo inapropiado.
const SUBSTANCE_RISK = [
  /ofreci(?:o|eron)[^.!?]{0,25}(pastillas?|droga(s)?|alcohol)/,
  /(pastillas?|droga(s)?)[^.!?]{0,25}ofreci(?:o|eron)/,
  /me dieron[^.!?]{0,15}(pastillas?|droga(s)?)/,
  /(pastillas?|droga(s)?)\s+que\s+me\s+dio/,
  /tom[eé][^.!?]{0,20}(pastillas?|droga(s)?)[^.!?]{0,20}(me dio|me dieron|senti mal|me senti mal)/,
  /me presionan?\s+(?:para|a)\s+(?:usar|consumir|tomar)\s+(?:drogas?|pastillas?|alcohol)/,
  /me obligaron\s+a\s+consumir/,
  'offered me pills', 'offered me drugs', 'someone offered me drugs',
  'gave me pills', 'they gave me drugs', 'i took pills someone gave me',
  'pressured me to use drugs', 'pressured me to take drugs',
]

// Hallazgo real (QA Ronda 3, 2026-07-10): "últimamente casi no como porque
// siento que estoy muy gordo y eso me preocupa muchísimo" no tenía ninguna
// categoría dedicada — el tutor respondió bien esa vez porque el modelo lo
// manejó por su cuenta (instrucción general del prompt), pero sin un
// chequeo determinístico esto no está garantizado, y el reporte para
// padres no puede señalarlo si no queda marcado como alerta de seguridad.
const EATING_DISORDER = [
  'casi no como', 'no quiero comer', 'dejo de comer', 'deje de comer',
  'me da miedo comer', 'me obligo a vomitar', 'me provoco el vomito',
  'me purgo despues de comer', 'cuento las calorias todo el dia',
  'me preocupa muchisimo mi peso', 'me odio por comer',
  'i barely eat', 'i stopped eating', 'i am afraid to eat',
  'i make myself throw up', 'i purge after eating',
  'i am obsessed with my weight', 'i hate myself for eating',
]

// Hallazgo real (QA Ronda 4, 2026-07-11): "en la escuela unos compañeros me
// están molestando mucho y me han empujado, tengo miedo de ir a clases" no
// tenía ninguna categoría dedicada — quedaba sin marcar como alerta de
// seguridad y por lo tanto invisible en el reporte para padres, igual que
// las revelaciones de bienestar antes de agregar EATING_DISORDER/SUBSTANCE_RISK.
const BULLYING = [
  'me estan molestando', 'me están molestando', 'me molestan mucho en la escuela',
  'me molestan mucho en el colegio', 'me han empujado', 'me empujan en la escuela',
  'me pegan en la escuela', 'me pegan en el colegio', 'me hacen bullying',
  'me hacen bulliyng', 'sufro bullying', 'me tienen miedo de ir a clases',
  'tengo miedo de ir a clases', 'tengo miedo de ir al colegio',
  'no quiero ir a la escuela por miedo', 'no quiero ir al colegio por miedo',
  'se burlan de mi todos los dias', 'se burlan de mí todos los días',
  'me humillan en la escuela', 'me humillan en el colegio',
  'me amenazan en la escuela', 'me amenazan en el colegio',
  'being bullied', 'they bully me', 'i get bullied at school',
  'kids push me at school', 'i am afraid to go to school',
  'scared to go to school', 'they threaten me at school',
  'they humiliate me at school',
]

const HARM_OTHERS = [
  'quiero matar a', 'voy a matar a', 'quiero hacerle daño a', 'quiero hacerle dano a',
  'quiero vengarme', 'voy a lastimar a', 'como lastimar a alguien',
  'como matar a alguien', 'amenazar a alguien', 'hacer una masacre',
]

const WEAPONS = [
  'como hacer una bomba', 'fabricar una bomba', 'hacer explosivos',
  'comprar un arma', 'conseguir una pistola', 'llevar una pistola',
  'llevar un cuchillo', 'ocultar un arma', 'usar un arma',
  'disparar a alguien', 'balas', 'explosivo casero',
]

const DRUGS_OR_CRIME = [
  'como vender droga', 'vender drogas', 'fabricar drogas', 'hacer droga',
  'como consumir droga', 'drogas sin que sepan', 'comprar droga',
  'como robar', 'como estafar', 'hackear una cuenta', 'robar una cuenta',
  'ocultar un delito', 'escapar de la policia',
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

function immediateSafetyResponse(tipo: ContentSafetyType, idiomaIngles: boolean): string {
  if (idiomaIngles) {
    if (tipo === 'crisis_autolesion') {
      return 'I am really sorry you are feeling this. You should not handle this alone. Please talk to a trusted adult right now, such as a parent, teacher, counselor, or school guide. If you might hurt yourself or you are in immediate danger, contact emergency services in your country right away. I can stay with you for study support, but this needs help from a real adult now.'
    }
    if (tipo === 'crisis_abuso') {
      return 'What you described sounds very serious. Please tell a trusted adult right away, such as a parent, teacher, counselor, school guide, or another adult who can protect you. If you are in immediate danger, contact emergency services in your country now. You deserve to be safe.'
    }
    if (tipo === 'crisis_sustancias') {
      return 'What you are describing is serious, and you should not face it alone. Please tell a trusted adult right away, such as a parent, teacher, counselor, or school guide. If you have taken something and you feel unwell, or there is immediate danger, contact emergency services in your country right now. I can stay with you for study support, but this needs help from a real adult.'
    }
    if (tipo === 'crisis_alimenticio') {
      return 'Thank you for sharing that — what you are describing matters and deserves real support. Please talk with a trusted adult soon, such as a parent, school counselor, or doctor, about how you have been feeling about eating and your body. I can help with your studies, but this is something a caring adult should know about.'
    }
    if (tipo === 'crisis_acoso_escolar') {
      return "I'm really sorry that's happening to you — no one should feel afraid to go to school. Please tell a trusted adult soon, like a parent, teacher, counselor, or school guide, so they can help stop this. I can help with your studies, but this is something an adult at your school needs to know about."
    }
    if (tipo === 'dano_otros' || tipo === 'armas') {
      return 'I cannot help with that. If you or someone else could be in danger, please get help immediately from a trusted adult, teacher, school guide, local emergency services, or another responsible adult nearby.'
    }
    return 'That sounds unsafe and serious. Please talk to a trusted adult right away, such as a parent, teacher, counselor, or school guide. If there is immediate danger, contact emergency services in your country now.'
  }

  if (tipo === 'crisis_autolesion') {
    return 'Siento mucho que te estés sintiendo así. No tienes que manejar esto solo. Por favor habla ahora mismo con un adulto de confianza, como un familiar, maestro, orientador o guía del colegio. Si crees que puedes hacerte daño o estás en peligro inmediato, contacta a los servicios de emergencia de tu país de inmediato. Yo puedo acompañarte con tus estudios, pero esto necesita ayuda real de un adulto ahora.'
  }
  if (tipo === 'crisis_abuso') {
    return 'Lo que describes suena muy serio. Por favor cuéntaselo de inmediato a un adulto de confianza, como un familiar, maestro, orientador, guía del colegio u otra persona adulta que pueda protegerte. Si estás en peligro inmediato, contacta a los servicios de emergencia de tu país ahora. Mereces estar seguro.'
  }
  if (tipo === 'crisis_sustancias') {
    return 'Lo que describes es serio y no tienes que enfrentarlo solo. Por favor cuéntaselo de inmediato a un adulto de confianza, como un familiar, maestro, orientador o guía del colegio. Si consumiste algo y te sientes mal, o hay peligro inmediato, contacta a los servicios de emergencia de tu país ahora mismo. Yo puedo acompañarte con tus estudios, pero esto necesita ayuda real de un adulto.'
  }
  if (tipo === 'crisis_alimenticio') {
    return 'Gracias por contarme eso — lo que describes importa y merece apoyo real. Por favor habla pronto con un adulto de confianza, como un familiar, un orientador del colegio o un médico, sobre cómo te has sentido con la comida y tu cuerpo. Yo puedo ayudarte con tus estudios, pero esto es algo que un adulto que te cuida debe saber.'
  }
  if (tipo === 'crisis_acoso_escolar') {
    return 'Lamento mucho que estés pasando por eso — nadie debería sentir miedo de ir al colegio. Por favor cuéntaselo pronto a un adulto de confianza, como un familiar, maestro, orientador o guía del colegio, para que puedan ayudarte a que esto pare. Yo puedo ayudarte con tus estudios, pero esto es algo que un adulto de tu colegio debe saber.'
  }
  if (tipo === 'dano_otros' || tipo === 'armas') {
    return 'No puedo ayudarte con eso. Si tú o alguien más podría estar en peligro, busca ayuda inmediata con un adulto de confianza, maestro, guía del colegio, emergencias locales u otra persona responsable cercana.'
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
  if (!p) return { bloqueado: false, tipo: 'ninguno', severidad: 'ninguna', debeAlertar: false, respuesta: null }

  if (includesAny(p, SELF_HARM)) {
    return { bloqueado: true, tipo: 'crisis_autolesion', severidad: 'alta', debeAlertar: true, respuesta: immediateSafetyResponse('crisis_autolesion', idiomaIngles) }
  }
  if (includesAny(p, ABUSE)) {
    return { bloqueado: true, tipo: 'crisis_abuso', severidad: 'alta', debeAlertar: true, respuesta: immediateSafetyResponse('crisis_abuso', idiomaIngles) }
  }
  if (includesAny(p, VIOLENCE)) {
    return { bloqueado: true, tipo: 'violencia', severidad: 'alta', debeAlertar: true, respuesta: immediateSafetyResponse('violencia', idiomaIngles) }
  }
  if (includesAny(p, SUBSTANCE_RISK)) {
    return { bloqueado: true, tipo: 'crisis_sustancias', severidad: 'alta', debeAlertar: true, respuesta: immediateSafetyResponse('crisis_sustancias', idiomaIngles) }
  }
  if (includesAny(p, EATING_DISORDER)) {
    return { bloqueado: true, tipo: 'crisis_alimenticio', severidad: 'alta', debeAlertar: true, respuesta: immediateSafetyResponse('crisis_alimenticio', idiomaIngles) }
  }
  if (includesAny(p, BULLYING)) {
    return { bloqueado: true, tipo: 'crisis_acoso_escolar', severidad: 'alta', debeAlertar: true, respuesta: immediateSafetyResponse('crisis_acoso_escolar', idiomaIngles) }
  }
  if (includesAny(p, HARM_OTHERS)) {
    return { bloqueado: true, tipo: 'dano_otros', severidad: 'alta', debeAlertar: true, respuesta: immediateSafetyResponse('dano_otros', idiomaIngles) }
  }
  if (includesAny(p, WEAPONS) && !isAcademicQuestion(p)) {
    return { bloqueado: true, tipo: 'armas', severidad: 'alta', debeAlertar: true, respuesta: immediateSafetyResponse('armas', idiomaIngles) }
  }
  if (includesAny(p, DRUGS_OR_CRIME) && !isAcademicQuestion(p)) {
    return { bloqueado: true, tipo: 'drogas_delitos', severidad: 'media', debeAlertar: true, respuesta: outOfScopeResponse(idiomaIngles) }
  }
  if (includesAny(p, SEXUAL_NON_ACADEMIC)) {
    return { bloqueado: true, tipo: 'sexual_no_academico', severidad: 'media', debeAlertar: true, respuesta: outOfScopeResponse(idiomaIngles) }
  }
  if (includesAny(p, POLITICAL_ALWAYS_BLOCK)) {
    return { bloqueado: true, tipo: 'politica_persuasiva', severidad: 'baja', debeAlertar: false, respuesta: outOfScopeResponse(idiomaIngles) }
  }
  if (includesAny(p, POLITICAL_PERSUASION) && !isAcademicQuestion(p)) {
    return { bloqueado: true, tipo: 'politica_persuasiva', severidad: 'baja', debeAlertar: false, respuesta: outOfScopeResponse(idiomaIngles) }
  }
  if (includesAny(p, RELIGION_OPINION) && !isAcademicQuestion(p)) {
    return { bloqueado: true, tipo: 'religion_opinion', severidad: 'baja', debeAlertar: false, respuesta: outOfScopeResponse(idiomaIngles) }
  }
  if (includesAny(p, IDENTITY_SUPPORT)) {
    return { bloqueado: true, tipo: 'apoyo_identidad', severidad: 'baja', debeAlertar: false, respuesta: identitySupportResponse(idiomaIngles) }
  }

  return { bloqueado: false, tipo: 'ninguno', severidad: 'ninguna', debeAlertar: false, respuesta: null }
}
