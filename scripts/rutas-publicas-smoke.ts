// Hallazgo real (logs de producción, 2026-07-31): /api/recuperar-password no
// estaba en la lista de rutas públicas del middleware. Como quien recupera su
// contraseña no tiene sesión, el POST se redirigía a /login con 307 (que
// conserva el método) y moría con 405 sin llegar nunca al handler. En los
// logs quedó el par exacto:
//
//   POST /api/recuperar-password 307 [edge-middleware]
//   POST /login                  405 [edge-middleware]
//
// El correo nunca se enviaba y la pantalla igual decía "revisa tu correo".
//
// Este test cubre dos cosas:
//   1. Las rutas del flujo previo al login son públicas, y las privadas no.
//   2. Toda ruta /api/... que las pantallas PREVIAS al login llaman por fetch
//      está en la lista — que es exactamente lo que falló. Sin esto, agregar
//      mañana otro endpoint pre-sesión repite el bug en silencio.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { esRutaPublica } from '../src/lib/rutasPublicas'

const RAIZ = join(__dirname, '..')

// Pantallas que un usuario SIN sesión puede tener abiertas.
const PANTALLAS_PRE_SESION = [
  'src/app/login/page.tsx',
  'src/app/padres/login/page.tsx',
  'src/app/signup/page.tsx',
  'src/app/reset-password/page.tsx',
]

function main() {
  // 1a. El flujo completo de recuperación de contraseña debe ser público.
  const publicasEsperadas = [
    '/login',
    '/padres/login',
    '/signup',
    '/reset-password',
    '/api/signup',
    '/api/recuperar-password',
    '/api/reset-password',
    '/auth/callback',
    '/auth/callback?token_hash=abc&type=recovery',
  ]
  for (const ruta of publicasEsperadas) {
    assert.equal(esRutaPublica(ruta), true, `${ruta} debe ser pública (se usa sin sesión)`)
  }

  // 1b. Lo que está detrás de sesión NO puede volverse público por accidente.
  const privadasEsperadas = [
    '/',
    '/chat',
    '/dashboard',
    '/reporte-alumno',
    '/api/preguntar',
    '/api/usuarios',
    '/api/admin',
    '/api/reporte-alumno',
    '/api/padre-asignaciones',
  ]
  for (const ruta of privadasEsperadas) {
    assert.equal(esRutaPublica(ruta), false, `${ruta} NO debe ser pública (requiere sesión)`)
  }

  // 2. Cada endpoint que llaman las pantallas previas al login tiene que estar
  //    en la lista pública, o el middleware lo redirige a /login antes de
  //    ejecutarlo.
  let endpointsRevisados = 0
  for (const archivo of PANTALLAS_PRE_SESION) {
    let codigo: string
    try {
      codigo = readFileSync(join(RAIZ, archivo), 'utf8')
    } catch {
      // La pantalla se movió o se renombró: no es motivo para fallar el test
      // del middleware, pero sí para no dar cobertura falsa.
      console.warn(`  aviso: no se encontró ${archivo}, se omite`)
      continue
    }

    const patron = /fetch\(\s*['"`](\/api\/[^'"`?]+)/g
    let coincidencia: RegExpExecArray | null
    while ((coincidencia = patron.exec(codigo)) !== null) {
      const endpoint = coincidencia[1]
      endpointsRevisados++
      assert.equal(
        esRutaPublica(endpoint),
        true,
        `${archivo} llama a ${endpoint} sin sesión, pero no está en rutasPublicas.ts: ` +
        `el middleware lo redirigirá a /login (307 → 405) y el handler nunca se ejecuta`
      )
    }
  }

  assert.ok(
    endpointsRevisados > 0,
    'no se encontró ninguna llamada fetch a /api/... en las pantallas previas al login; ' +
    'el chequeo 2 estaría pasando en vacío'
  )

  console.log(`rutas-publicas smoke passed (${endpointsRevisados} endpoints pre-sesión revisados)`)
}

main()
