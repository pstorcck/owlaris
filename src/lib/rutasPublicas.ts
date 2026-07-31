// Rutas a las que se llega SIN sesión. El middleware las deja pasar sin
// verificar al usuario.
//
// Hallazgo real (logs de producción, 2026-07-31): esta lista vivía dentro del
// middleware y /api/recuperar-password quedó fuera. Como quien recupera su
// contraseña por definición no tiene sesión, el POST se redirigía a /login
// con 307 (que conserva el método) y moría con 405 sin llegar nunca al
// handler — el correo no se enviaba jamás y no había forma de notarlo desde
// la UI. Se extrae aquí para poder cubrirla con un test de regresión
// (scripts/rutas-publicas-smoke.ts) en vez de depender de revisar el
// middleware a ojo cada vez que se agrega una pantalla previa al login.
//
// Regla para agregar: si la pantalla o el endpoint puede ejecutarse antes de
// que exista sesión (login, alta, recuperación de contraseña, callback de
// correo), va en esta lista. Todo lo demás NO.
const RUTAS_EXACTAS = [
  '/signup',
  '/login',
  '/padres/login',
  '/reset-password',
]

const PREFIJOS = [
  // Recibe el enlace del correo ANTES de que exista sesión.
  '/auth/callback',
  '/api/signup',
  // Envía el correo de recuperación: el usuario no tiene sesión, es
  // justamente lo que está intentando recuperar.
  '/api/recuperar-password',
  // Canjea el token del correo y aplica la contraseña nueva. Tampoco hay
  // sesión: la autorización es el token de un solo uso, no una cookie.
  '/api/reset-password',
]

export function esRutaPublica(pathname: string): boolean {
  return RUTAS_EXACTAS.includes(pathname) ||
    PREFIJOS.some((prefijo) => pathname.startsWith(prefijo))
}
