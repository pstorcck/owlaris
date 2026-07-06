import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

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

  console.log('system-prompt-content smoke passed')
}

main()
