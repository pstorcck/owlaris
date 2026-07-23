import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { describeFinalAnswerPolicyForPrompt } from '../src/lib/pedagogicalGuard'
import { describeSameExercisePolicyForPrompt } from '../src/lib/tutorContext'
import { buildGradeAdaptationInstruction } from '../src/lib/gradeAdaptation'

// route.ts importa clientes de Supabase/OpenAI a nivel de módulo y no puede
// cargarse en este entorno sin credenciales, así que este smoke test valida
// el contenido del PROMPT_BASE leyendo el archivo como texto — el mismo
// patrón que ya usan otros chequeos de contenido estático en este repo.
function main() {
  const routePath = path.join(__dirname, '..', 'src', 'app', 'api', 'preguntar', 'route.ts')
  const contenido = fs.readFileSync(routePath, 'utf-8')

  const promptStart = contenido.indexOf('const PROMPT_BASE = `')
  const promptEnd = contenido.indexOf('SEGURIDAD EMOCIONAL:')
  assert.ok(promptStart !== -1 && promptEnd !== -1 && promptEnd > promptStart, 'no se encontró el bloque PROMPT_BASE')
  const promptBase = contenido.slice(promptStart, promptEnd)

  // Instructivo de mejoras, sección B/H/I/J (tareas 26): reforzar el prompt
  // para no practicar sin tema, no inventar currículo, tono seguro al
  // rechazar recursos externos, y no sugerir temas sin base clara.
  assert.match(promptBase, /REGLA — NO PRACTICAR SIN TEMA CLARO/)
  assert.match(promptBase, /NO generes un ejercicio al azar/)
  assert.match(promptBase, /REGLA — FIDELIDAD A LAS FUENTES OFICIALES/)
  assert.match(promptBase, /Nunca inventes temas, unidades ni contenido/)
  assert.match(promptBase, /REGLA — RECURSOS EXTERNOS, TONO SEGURO/)
  assert.match(promptBase, /t[uú] eres su tutor y puedes ayudarle directamente aqu[ií]/i)
  assert.match(promptBase, /REGLA — NO SUGERIR TEMAS SIN BASE CLARA/)

  // Hallazgo real (QA 2026-07-16): de los 11 botones de "Acciones rápidas"
  // del sidebar, 5 ("Dame una pista", "Explícame el primer paso", "Ponme un
  // ejemplo parecido", "Explícamelo más fácil", "Empieza desde cero") no
  // tenían NINGUNA regla explícita en el prompt ni detección determinística
  // en el código — dependían enteramente de que el modelo adivinara la
  // intención por contexto. "Empieza desde cero" en particular era ambigua
  // hasta en su significado previsto (¿reiniciar el ejercicio? ¿cambiar de
  // tema? ¿borrar el historial?). Se agrega una regla explícita por cada
  // una, incluyendo qué hacer si no hay contexto reciente al cual referirse.
  assert.match(promptBase, /REGLA — OPCIONES DE AYUDA RÁPIDA/)
  assert.match(promptBase, /"Dame una pista": da SOLO una pista/)
  assert.match(promptBase, /"Explícame el primer paso": identifica el ejercicio o procedimiento activo/)
  assert.match(promptBase, /"Ponme un ejemplo parecido": genera un ejercicio NUEVO/)
  assert.match(promptBase, /"Explícamelo más fácil": vuelve a explicar la ÚLTIMA explicación/)
  assert.match(promptBase, /"Empieza desde cero": significa reiniciar el EJERCICIO actual/)
  assert.match(promptBase, /NO significa cambiar de materia, cambiar de tema, ni borrar el progreso o historial/)

  // Hallazgo real (QA Ronda 4, backlog pendiente): tras un acierto, ofrecer
  // 1-2 ejercicios más del mismo tema para consolidar antes de asumir que
  // el alumno quiere cambiar de tema.
  assert.match(promptBase, /REGLA — REFUERZO DE CONSOLIDACIÓN TRAS UN ACIERTO/)
  assert.match(promptBase, /1-2 ejercicios más del MISMO tema/)

  // No debe reaparecer la jerga algebraica que el instructivo pidió evitar.
  assert.doesNotMatch(promptBase, /término separado|estructura algebraica|componente operacional|elemento aislado/i)

  // Hallazgo #5 (auditoría QA 2026-07-07): no cambiar de subtema en silencio
  // dentro de la misma materia (ej. sistema digestivo -> leyes de Newton).
  assert.match(promptBase, /subtema claramente distinto/i)
  assert.match(promptBase, /No cambies de subtema en silencio/i)

  // Hallazgo #2 (auditoría QA 2026-07-07): la señal de "ejercicio activo
  // pendiente" debe inyectarse fuera del PROMPT_BASE estático (depende del
  // turno), verificado en su propio bloque de construcción más abajo.
  assert.match(contenido, /EJERCICIO ACTIVO PENDIENTE: \$\{pendingMathOperation\}/)
  assert.match(contenido, /NO le preguntes de nuevo qué tema quiere trabajar/)

  // Sprint de estabilización (2026-07-07): "qué es revelar la respuesta" y
  // "qué es seguir con el mismo ejercicio" ahora se generan desde un único
  // módulo fuente en vez de vivir como texto duplicado dentro de
  // PROMPT_BASE — se verifica que route.ts siga llamando a esas funciones
  // (no que alguien haya revertido a texto hardcodeado) y que el contenido
  // real que devuelven siga siendo el esperado.
  assert.match(promptBase, /\$\{describeSameExercisePolicyForPrompt\(\)\}/)
  assert.match(promptBase, /\$\{describeFinalAnswerPolicyForPrompt\(\)\}/)
  const politicaMismoEjercicio = describeSameExercisePolicyForPrompt()
  assert.match(politicaMismoEjercicio, /ejercicio pendiente/i)
  assert.match(politicaMismoEjercicio, /NO cambies de ejercicio ni de tema/i)
  const politicaRespuestaFinal = describeFinalAnswerPolicyForPrompt()
  assert.match(politicaRespuestaFinal, /RESPUESTAS FINALES/)
  assert.match(politicaRespuestaFinal, /ensayo/i)

  // Instructivo de mejoras (ronda 2026-07-11), ítem 17: la regla de "nunca
  // tablas" ahora tiene una excepción explícita cuando el alumno la pide
  // directamente (la interfaz no renderiza HTML, pero una tabla con pipes
  // sigue siendo legible como texto plano si el alumno la solicitó).
  assert.match(promptBase, /EXCEPCIÓN.*pide expl[ií]citamente una tabla/i)

  // Ítem 3: "ponme una trampa" es una petición pedagógica legítima (un
  // ejercicio con un error común/paso fácil de olvidar), no una petición de
  // hacer trampa académica — no deben confundirse.
  assert.match(promptBase, /PONME UNA TRAMPA.*NO ES HACER TRAMPA/i)

  // Hallazgo real (QA en vivo, 2026-07-19, Contabilidad y Olimpiadas
  // Química): al verificar un cálculo de varios pasos, el modelo a veces
  // anunciaba "hay un error" al inicio de la respuesta, pero el desglose
  // que seguía confirmaba cada paso como correcto y concluía que la
  // respuesta final SÍ era correcta — un mensaje contradictorio que no
  // afecta la calificación pero puede confundir al estudiante.
  // Refuerzo estructural (mismo día, feedback del equipo de QA): una
  // instrucción de "no lo hagas" no es una garantía en un modelo que genera
  // texto en una sola pasada — reaparecía con variaciones (más términos,
  // otra materia) porque el compromiso con el veredicto ya queda escrito
  // antes de terminar de razonar el resto. Se exige el ORDEN de la
  // respuesta (desglose primero en silencio, veredicto solo al final) en
  // vez de solo pedir que no se adelante — el modelo escribe el veredicto
  // ya habiendo "visto" su propio desglose correcto como contexto previo.
  assert.match(promptBase, /ORDEN OBLIGATORIO AL VERIFICAR UN PROCEDIMIENTO DE VARIOS PASOS/i)
  assert.match(promptBase, /sin escribir ninguna palabra de veredicto todav[ií]a/i)
  assert.match(promptBase, /esa frase debe ir al final de tu verificaci[oó]n, nunca como la primera l[ií]nea/i)

  // Hallazgo real (QA en vivo, 2026-07-19, Olimpiadas Ciencias Naturales,
  // 2do Básico): un ejercicio generado sobre cadenas alimenticias omitió la
  // cantidad de "carnívoros" necesaria para resolverlo — al señalarlo, el
  // tutor no reconoció la omisión, solo presentó el número faltante como si
  // siempre hubiera estado en el enunciado.
  assert.match(promptBase, /verifica que TODOS los datos necesarios para resolverlo est[eé]n escritos expl[ií]citamente/i)
  assert.match(promptBase, /reconoce con honestidad que falt[oó] en el enunciado original/i)

  // Pedido explícito del usuario (2026-07-19): el tutor no revisaba
  // ortografía ni gramática al practicar inglés, solo el contenido/concepto
  // de la respuesta. Se agrega revisión activa en materias de gramática
  // estructurada, y un toque más ligero (mención de patrón al cierre, sin
  // interrumpir cada oración) en materias de fluidez conversacional, para
  // no desalentar al alumno a comunicarse.
  assert.match(promptBase, /REGLA — CORRECCIÓN DE ORTOGRAFÍA Y GRAMÁTICA EN INGLÉS/i)
  assert.match(promptBase, /revisa tambi[eé]n la ortograf[ií]a y gram[aá]tica de lo que el alumno escribi[oó]/i)
  assert.match(promptBase, /no interrumpas cada oraci[oó]n para corregir errores menores/i)

  // Hallazgo real (QA en vivo, 2026-07-19, Olimpiadas Científicas
  // Matemática): las fórmulas citadas de un documento fuente se mostraban
  // con notación LaTeX cruda ("\( n^2+n+1 \)") en vez de convertirse a
  // texto plano, violando la regla de FORMATO existente al citar fuentes.
  assert.match(promptBase, /si la fuente original usa notaci[oó]n LaTeX/i)

  // Instructivo de mejoras (ronda 2026-07-11), ítems 26-28: nunca inventar
  // alineación a estándares oficiales, derivar el "enfoque principal" de
  // TODO el índice (no solo los primeros temas), y permitir listar temas
  // para un "chequeo de dominio" sin resolver los ejercicios.
  assert.match(promptBase, /alineaci[oó]n con est[aá]ndares curriculares oficiales/i)
  assert.match(promptBase, /b[aá]salo en TODO el [ií]ndice de temas/i)
  assert.match(promptBase, /chequeo de dominio/i)

  // La adaptación por grado se inyecta por turno (depende de gradoEfectivo),
  // no dentro de PROMPT_BASE estático — se verifica que route.ts la
  // construya y que el módulo produzca contenido real por banda.
  assert.match(contenido, /buildGradeAdaptationInstruction\(gradoEfectivo, idiomaIngles\)/)
  assert.match(buildGradeAdaptationInstruction('4to Primaria', false), /ADAPTACIÓN POR GRADO/)

  // Hallazgo real (QA en vivo, 2026-07-22, Listening & Speaking): con el
  // interruptor de idioma en Español, el tutor generaba diálogos de
  // práctica completos en español para una clase de práctica de inglés —
  // se verifica que route.ts siga consultando esClaseDePracticaDeIngles al
  // construir contextoIdioma, en vez de depender solo del interruptor.
  assert.match(contenido, /esClaseDePracticaDeIngles\(materiaConsultaSharePoint\)/)

  console.log('system-prompt-content smoke passed')
}

main()
