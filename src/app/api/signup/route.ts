import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Dominios permitidos y su colegio correspondiente
const DOMINIOS_PERMITIDOS: Record<string, { colegio_slug: string; nombre: string }> = {
  'colegiomontano.edu.gt': { colegio_slug: 'colegio-montano', nombre: 'Colegio Montano' },
  'escolaris.edu.gt':      { colegio_slug: 'escolaris',       nombre: 'Colegio Escolaris' },
}

function generarPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const especiales = '@#$!'
  let pw = ''
  for (let i = 0; i < 8; i++) pw += chars[Math.floor(Math.random() * chars.length)]
  pw += especiales[Math.floor(Math.random() * especiales.length)]
  pw += Math.floor(Math.random() * 9)
  return pw
}

async function enviarEmailBienvenida(email: string, nombre: string, password: string, colegio: string) {
  // Usar Supabase Auth para enviar email — en producción conectar con Zoho SMTP
  // Por ahora retornamos true para no bloquear el flujo
  // TODO: conectar con Zoho cuando esté configurado
  console.log(`📧 Email de bienvenida para ${email} — Password: ${password}`)
  return true
}

export async function POST(req: NextRequest) {
  try {
    const admin = createAdminClient()
    const { nombre_completo, email, grado, rol } = await req.json()

    if (!nombre_completo?.trim() || !email?.trim()) {
      return NextResponse.json({ error: 'Nombre y email son requeridos' }, { status: 400 })
    }

    // Validar dominio
    const dominio = email.split('@')[1]?.toLowerCase()
    const colegioInfo = DOMINIOS_PERMITIDOS[dominio]

    if (!colegioInfo) {
      return NextResponse.json({
        error: `El dominio @${dominio} no está autorizado. Solo se permiten correos @colegiomontano.edu.gt y @escolaris.edu.gt`
      }, { status: 403 })
    }

    // Obtener colegio_id
    const { data: colegio } = await admin
      .from('colegios')
      .select('id, nombre')
      .eq('slug', colegioInfo.colegio_slug)
      .single()

    if (!colegio) {
      return NextResponse.json({ error: 'Colegio no encontrado en el sistema' }, { status: 404 })
    }

    // Generar contraseña temporal
    const passwordTemporal = generarPassword()

    // Crear usuario en Supabase Auth
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: email.toLowerCase(),
      password: passwordTemporal,
      email_confirm: true,
    })

    if (authError) {
      if (authError.message.includes('already registered')) {
        return NextResponse.json({ error: 'Este correo ya está registrado' }, { status: 409 })
      }
      throw authError
    }

    // Crear perfil
    const { error: perfilError } = await admin.from('usuarios').insert({
      id: authData.user.id,
      colegio_id: colegio.id,
      nombre_completo: nombre_completo.trim(),
      email: email.toLowerCase(),
      rol: rol || 'alumno',
      grado: grado || null,
      activo: true,
    })

    if (perfilError) throw perfilError

    // Enviar email de bienvenida
    await enviarEmailBienvenida(email, nombre_completo, passwordTemporal, colegio.nombre)

    return NextResponse.json({
      ok: true,
      mensaje: `Cuenta creada exitosamente. Te enviamos tu contraseña temporal a ${email}.`,
      // En desarrollo devolvemos el password para pruebas
      // En producción esto NO debe devolverse
      debug_password: process.env.NODE_ENV === 'development' ? passwordTemporal : undefined,
    })

  } catch (err: unknown) {
    console.error('Error en /api/signup:', err)
    const msg = err instanceof Error ? err.message : 'Error interno del servidor'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
