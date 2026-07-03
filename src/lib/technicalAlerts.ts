type AdminClient = ReturnType<typeof import('@/lib/supabase/server').createAdminClient>

const VENTANA_MS = 60 * 60 * 1000 // 1 hora: los incidentes tecnicos se detectan rapido, no como las alertas pedagogicas de 24h
const UMBRAL = 5

// Alerta tecnica al guia "colegio" (contacto tecnico) cuando el mismo tipo de
// error tecnico se repite UMBRAL veces (y multiplos) dentro de la ventana.
// A diferencia de las alertas de seguridad/comprension, esta no pertenece a
// un alumno: es una senal de que algo en la plataforma esta fallando.
export async function registrarAlertaTecnica(
  admin: AdminClient,
  colegioId: string | null | undefined,
  tipoError: string,
  detalle: string
): Promise<void> {
  try {
    if (!colegioId) return

    const desde = new Date(Date.now() - VENTANA_MS).toISOString()
    const { data: recientes } = await admin
      .from('alertas')
      .select('id, contexto')
      .eq('colegio_id', colegioId)
      .eq('tipo', 'error_tecnico')
      .gte('creado_en', desde)

    const ocurrencias = (recientes || []).filter((a: { contexto?: string | null }) =>
      (a.contexto || '').includes(`TipoError:${tipoError}`)
    ).length + 1

    if (ocurrencias % UMBRAL !== 0) return

    const yaExiste = (recientes || []).some((a: { contexto?: string | null }) =>
      (a.contexto || '').includes(`TipoError:${tipoError}`) && (a.contexto || '').includes(`Umbral:${ocurrencias}`)
    )
    if (yaExiste) return

    const contexto = [`TipoError:${tipoError}`, `Umbral:${ocurrencias}`, `Ventana:1h`, detalle]
      .filter(Boolean).join(' | ')

    await admin.from('alertas').insert({
      colegio_id: colegioId,
      alumno_id: null,
      tipo: 'error_tecnico',
      descripcion: `${ocurrencias} errores tecnicos de tipo "${tipoError}" en la ultima hora.`,
      contexto,
    })

    const { data: asigColegio } = await admin
      .from('guia_asignaciones')
      .select('guia_id, guia:guia_id(email, nombre_completo)')
      .eq('colegio_id', colegioId)
      .eq('activo', true)
      .eq('tipo', 'colegio')
      .limit(1)
      .maybeSingle()

    if (asigColegio?.guia && process.env.RESEND_API_KEY) {
      try {
        const guia = asigColegio.guia as unknown as { email: string; nombre_completo: string }
        const { Resend } = await import('resend')
        await new Resend(process.env.RESEND_API_KEY).emails.send({
          from: 'Owlaris <noreply@owlaris.app>',
          to: guia.email,
          subject: `Alerta tecnica: ${ocurrencias}x "${tipoError}" en la ultima hora`,
          html: `<p>Hola ${guia.nombre_completo},</p><p>Owlaris registro <strong>${ocurrencias} errores tecnicos</strong> de tipo <strong>${tipoError}</strong> en la ultima hora.</p><p>${contexto}</p><a href="https://owlaris.app/admin">Ver en Owlaris</a>`,
        })
      } catch (e) { console.error('Email alerta tecnica:', e) }
    }
  } catch (e) {
    console.error('Error registrando alerta tecnica:', e)
  }
}
