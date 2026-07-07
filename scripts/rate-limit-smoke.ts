// Hallazgo real (auditoría 2026-07-07): /api/preguntar, /api/transcribir y
// /api/tts no tenían ningún límite de frecuencia por usuario. Este test
// cubre solo la lógica pura de ventana deslizante (verificarLimiteFrecuencia)
// — la app real inyecta Date.now(), aquí se inyecta un reloj falso para que
// el test sea determinista.
import assert from 'node:assert/strict'
import { verificarLimiteFrecuencia } from '../src/lib/rateLimit'

function main() {
  const clave = 'test:usuario-1'
  const limite = 3
  const ventanaMs = 1000

  // Las primeras `limite` requests dentro de la ventana se permiten.
  for (let i = 0; i < limite; i++) {
    const r = verificarLimiteFrecuencia(clave, limite, ventanaMs, 1000 + i)
    assert.equal(r.permitido, true, `request ${i + 1} debería permitirse`)
  }

  // La request número limite+1, todavía dentro de la ventana, se rechaza.
  const rechazada = verificarLimiteFrecuencia(clave, limite, ventanaMs, 1000 + limite)
  assert.equal(rechazada.permitido, false)
  assert.ok(rechazada.reintentarEnMs > 0)

  // Pasada la ventana completa, se reinicia el conteo y se permite de nuevo.
  const reiniciada = verificarLimiteFrecuencia(clave, limite, ventanaMs, 1000 + ventanaMs + 1)
  assert.equal(reiniciada.permitido, true)

  // Dos claves distintas (dos usuarios) no comparten cupo entre sí.
  const claveOtroUsuario = 'test:usuario-2'
  for (let i = 0; i < limite; i++) {
    verificarLimiteFrecuencia(clave, limite, ventanaMs, 5000 + i)
  }
  const otroUsuarioPermitido = verificarLimiteFrecuencia(claveOtroUsuario, limite, ventanaMs, 5000)
  assert.equal(otroUsuarioPermitido.permitido, true)

  console.log('rate-limit smoke passed')
}

main()
