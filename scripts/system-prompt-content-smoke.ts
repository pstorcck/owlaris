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

  console.log('system-prompt-content smoke passed')
}

main()
