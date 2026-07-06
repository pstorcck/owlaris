import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const { pathname } = request.nextUrl

  // Rutas completamente públicas — sin verificar sesión
  if (pathname === '/signup' || 
      pathname === '/login' || 
      pathname === '/padres/login' || 
      pathname.startsWith('/api/signup')) {
    return supabaseResponse
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2])
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Evitar que el caché intercepte rutas específicas
  const response = supabaseResponse
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
  response.headers.set('x-pathname', pathname)
  return response
}

export const config = {
  // vendor/ y models/ sirven el búho 3D (model-viewer + decodificador Draco
  // + .glb) en el login público — sin excluirlos, un visitante SIN sesión
  // hace que estas peticiones estáticas se redirijan a /login en vez de
  // servirse, y el búho nunca carga.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|vendor/|models/|api/signup|.*\\.(?:svg|png|jpg|jpeg|gif|webp|js|wasm|glb)$).*)'],
}
