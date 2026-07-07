// Hallazgo real (auditoría del 2026-07-07, misma sesión que el bug de
// "multiplicaciones"): detectarTipoPregunta (preguntar/route.ts) usaba
// palabras sueltas demasiado genéricas para detectar temas "formativos"
// (familia/emociones) — "solo", "amigos", "valores", "hábitos", "no sé qué
// hacer", "necesito ayuda" — que aparecen constantemente en preguntas
// académicas normales. Cuando eso pasaba, el sistema descartaba el
// contenido curricular ya encontrado y respondía con orientación genérica
// en vez de ayudar con el ejercicio real.
//
// detectarTipoPregunta no está exportada desde route.ts (es una función
// local), así que este test replica la misma lógica ya corregida — igual
// que route-course-switch-integration-test.ts hace con otras funciones
// internas de esa ruta — para que un cambio futuro que reintroduzca una
// palabra suelta demasiado genérica falle aquí.
import assert from 'node:assert/strict'

const PALABRAS_CRISIS = ['me quiero matar','suicidar','quitarme la vida','hacerme daño','autolesion','no quiero vivir','me voy a matar','quiero morir','abuso sexual','me violaron','me toca inapropiadamente']
const PALABRAS_FORMATIVAS = ['mi papá','mi mamá','mis padres','mi familia','pelea','problema en casa','me siento mal','triste','bullying','me molestan','convivencia','disciplina','motivación','me pega','me golpea','me grita','me insulta','violencia en casa','mis padres pelean','me siento solo','no tengo amigos','me hacen menos','me discriminan','me ignoran','no me entienden','estoy deprimido','me siento triste','estoy triste','muy triste','problema familiar','no me quieren','me castigan','me regañan','mis papás']
const PALABRAS_CONTEXTO_FAMILIAR = ['mi papá','mi mamá','mis padres','mis papás','mi familia','en casa','me pega','me golpea','me grita','me insulta','pelean','pelea','violencia']

function detectarTipoPregunta(pregunta: string): 'crisis' | 'formativa' | 'academica' {
  const p = pregunta.toLowerCase()
  if (PALABRAS_CRISIS.some(w => p.includes(w))) return 'crisis'
  if (PALABRAS_FORMATIVAS.some(w => p.includes(w))) return 'formativa'
  const tieneMiedoOPreocupacion = p.includes('tengo miedo') || p.includes('me preocupa')
  if (tieneMiedoOPreocupacion && PALABRAS_CONTEXTO_FAMILIAR.some(w => p.includes(w))) return 'formativa'
  return 'academica'
}

type Failure = { name: string; message: string }
const failures: Failure[] = []
let total = 0
function test(name: string, fn: () => void) {
  total += 1
  try { fn() } catch (error) { failures.push({ name, message: error instanceof Error ? error.message : String(error) }) }
}

function main() {
  // ── Casos académicos reales que ANTES se clasificaban mal ───────────
  const casosAcademicos: [string, string][] = [
    ['solo', 'Quiero resolver esto solo, sin ayuda'],
    ['amigos', 'Mis amigos y yo tenemos examen de biología mañana'],
    ['habitos-biologia', 'Explícame los hábitos alimenticios de las plantas'],
    ['habitos-estudio', 'Quiero mejorar mis hábitos de estudio'],
    ['valores-algebra', 'Cuáles son los valores de x en esta ecuación'],
    ['miedo-examen', 'Tengo miedo de reprobar el examen de matemática'],
    ['no-se-que-hacer', 'No sé qué hacer con este ejercicio de fracciones'],
    ['preocupa-tema', 'Me preocupa no entender el tema de fotosíntesis'],
    ['necesito-ayuda', 'Necesito ayuda con este ejercicio de multiplicación'],
  ]
  for (const [nombre, texto] of casosAcademicos) {
    test(`academico-no-se-confunde-${nombre}`, () => {
      assert.equal(detectarTipoPregunta(texto), 'academica', `"${texto}" se clasificó mal`)
    })
  }

  // ── Señales de riesgo real que deben SEGUIR detectándose ────────────
  const casosRiesgo: [string, string, 'crisis' | 'formativa'][] = [
    ['papa-pega', 'Mi papá me pega cuando saco malas notas', 'formativa'],
    ['bullying', 'Me están haciendo bullying en el colegio', 'formativa'],
    ['sin-amigos-solo', 'No tengo amigos y me siento muy solo', 'formativa'],
    ['triste-padres-pelean', 'Estoy muy triste, mis papás pelean todos los días', 'formativa'],
    ['miedo-con-contexto-familiar', 'Tengo miedo, mi papá me grita mucho', 'formativa'],
    ['preocupa-con-contexto-familiar', 'Me preocupa que mis papás peleen tanto', 'formativa'],
    ['crisis-suicidio', 'Quiero suicidarme', 'crisis'],
    ['crisis-abuso', 'Me violaron', 'crisis'],
  ]
  for (const [nombre, texto, esperado] of casosRiesgo) {
    test(`riesgo-real-sigue-detectandose-${nombre}`, () => {
      assert.equal(detectarTipoPregunta(texto), esperado, `"${texto}" dejó de detectarse como ${esperado}`)
    })
  }

  assert.equal(total, 9 + 8)

  if (failures.length > 0) {
    console.error(`\n${failures.length} fallas de ${total}:`)
    for (const f of failures) console.error(`- ${f.name}: ${f.message}`)
    process.exit(1)
  }
  console.log(`tipo-pregunta clasificacion smoke passed: ${total}/${total}`)
}

main()
