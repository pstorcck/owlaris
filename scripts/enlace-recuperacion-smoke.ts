// Hallazgo real (logs de producción, 2026-07-31): "el correo sí llega, pero
// al hacer clic me manda al login". El enlace del correo apuntaba a
// /auth/callback, que canjeaba el token al ABRIRSE. Los logs muestran un
// escáner de correo abriendo el enlace un segundo antes que la persona:
//
//   18:28:57 HEAD /auth/callback  307   (sin error)
//   18:28:58 HEAD /reset-password 200   (canje exitoso — token consumido)
//   18:28:58 GET  /auth/callback  307   verifyOtp: Email link is invalid or
//                                       has expired
//
// El token de recuperación es de UN SOLO USO, así que el clic humano siempre
// llegaba tarde. La regla que este test protege: ABRIR el enlace no debe
// consumir el token; el canje ocurre solo al ENVIAR la contraseña nueva.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const RAIZ = join(__dirname, '..')

function leer(ruta: string): string {
  return readFileSync(join(RAIZ, ruta), 'utf8')
}

function main() {
  // 1. El enlace del correo debe llevar a la PANTALLA, no a un endpoint que
  //    canjea el token con solo abrirse.
  const envio = leer('src/app/api/recuperar-password/route.ts')
  const enlace = envio.match(/const enlace = `([^`]+)`/)
  assert.ok(enlace, 'no se encontró la construcción del enlace en /api/recuperar-password')
  assert.ok(
    enlace[1].includes('/reset-password?token_hash='),
    `el enlace del correo debe apuntar a /reset-password?token_hash=, no a un endpoint ` +
    `que canjea al abrirse. Actual: ${enlace[1]}`
  )
  assert.ok(
    !enlace[1].includes('/auth/callback'),
    'el enlace del correo NO debe apuntar a /auth/callback: ese endpoint canjea el token ' +
    'al abrirse y un prefetch del cliente de correo lo quema antes del clic humano'
  )

  // 2. El token se canjea al enviar el formulario, no al pintar la pantalla.
  const api = leer('src/app/api/reset-password/route.ts')
  assert.ok(
    /export async function POST/.test(api),
    '/api/reset-password debe canjear el token en un POST (nunca en un GET: los ' +
    'escáneres de correo hacen GET y HEAD, jamás POST)'
  )
  assert.ok(
    api.includes('verifyOtp'),
    '/api/reset-password debe ser quien llama a verifyOtp'
  )
  assert.ok(
    !/export async function GET/.test(api),
    '/api/reset-password no debe exponer GET: un prefetch lo dispararía'
  )

  const pantalla = leer('src/app/reset-password/page.tsx')
  assert.ok(
    !pantalla.includes('verifyOtp') && !pantalla.includes('exchangeCodeForSession'),
    'la pantalla /reset-password no debe canjear el token al cargarse; solo debe ' +
    'mostrar el formulario y mandar el token al enviar'
  )

  // 3. Los enlaces viejos que siguen en las bandejas pasan por /auth/callback:
  //    ahí el HEAD del escáner no puede consumir nada. Sin un HEAD explícito,
  //    Next atiende el HEAD ejecutando el GET — que sí canjea.
  const callback = leer('src/app/auth/callback/route.ts')
  assert.ok(
    /export async function HEAD/.test(callback),
    '/auth/callback debe exportar HEAD propio: si no, Next responde al HEAD ejecutando ' +
    'el GET y el prefetch del escáner de correo quema el token de un solo uso'
  )

  console.log('enlace-recuperacion smoke passed')
}

main()
