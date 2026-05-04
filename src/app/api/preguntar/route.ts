import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const LIMITE_DIARIO = 50

export async function POST(req: NextRequest) {
  try {
    const OpenAI = (await import('openai')).default
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { pregunta, materia_id, grado_override, historial } = await req.json()
    if (!pregunta?.trim()) return NextResponse.json({ error: 'Pregunta vacía' }, { status: 400 })

    const { data: perfil } = await supabase
      .from('usuarios')
      .select('*, colegio:colegios(*)')
      .eq('id', user.id)
      .single()

    if (!perfil) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })

    const hoy = new Date().toISOString().split('T')[0]
    const { count } = await supabase
      .from('interacciones')
      .select('*', { count: 'exact', head: true })
      .eq('usuario_id', user.id)
      .gte('creado_en', `${hoy}T00:00:00`)

    if ((count || 0) >= LIMITE_DIARIO) {
      return NextResponse.json({ error: 'Alcanzaste el límite de preguntas del día.' }, { status: 429 })
    }

    const { data: materia } = await supabase
      .from('materias')
      .select('*')
      .eq('id', materia_id)
      .single()

    const gradoEfectivo = grado_override || perfil.grado

    let contenidoCurricular = ''
    let documentoFuente = null

    try {
      const resContenido = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/contenido`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': req.headers.get('cookie') || '' },
        body: JSON.stringify({
          colegio_slug: perfil.colegio?.sharepoint_folder || perfil.colegio?.slug,
          grado: gradoEfectivo,
          materia: materia?.nombre || materia?.slug,
          pregunta,
        }),
      })
      if (resContenido.ok) {
        const dataContenido = await resContenido.json()
        contenidoCurricular = dataContenido.contenido || ''
        documentoFuente = dataContenido.archivo || null
      }
    } catch {
      console.log('SharePoint no disponible, continuando sin contenido')
    }

    const systemPrompt = construirSystemPrompt(
      perfil.colegio?.nombre || 'tu colegio',
      gradoEfectivo || 'tu grado',
      materia?.nombre || 'la materia',
      contenidoCurricular
    )

    const mensajesOpenAI: { role: 'user' | 'assistant' | 'system'; content: string }[] = [
      { role: 'system', content: systemPrompt },
    ]

    if (historial?.length > 0) {
      historial.forEach((msg: { rol: string; contenido: string }) => {
        mensajesOpenAI.push({
          role: msg.rol === 'usuario' ? 'user' : 'assistant',
          content: msg.contenido,
        })
      })
    }

    mensajesOpenAI.push({ role: 'user', content: pregunta })

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: mensajesOpenAI,
      max_tokens: 600,
      temperature: 0.7,
    })

    const respuesta = completion.choices[0].message.content || 'No pude generar una respuesta.'
    const tokensUsados = completion.usage?.total_tokens || 0
    const costoUSD = tokensUsados * 0.00000015
    const sospechaCopia = detectarCopia(pregunta)

    await supabase.from('interacciones').insert({
      usuario_id: user.id,
      colegio_id: perfil.colegio_id,
      materia_id: materia_id || null,
      grado: gradoEfectivo,
      tema_detectado: pregunta.substring(0, 100),
      pregunta,
      respuesta,
      tokens_usados: tokensUsados,
      costo_usd: costoUSD,
      modelo_usado: 'gpt-4o-mini',
      documento_fuente: documentoFuente,
      sospecha_copia: sospechaCopia,
    })

    if (!contenidoCurricular && materia) {
      await registrarPendiente(supabase, perfil, materia, pregunta)
    }

    return NextResponse.json({ respuesta, tokens: tokensUsados, documento_fuente: documentoFuente })

  } catch (err) {
    console.error('Error en /api/preguntar:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

function construirSystemPrompt(colegio: string, grado: string, materia: string, contenido: string): string {
  const base = `Eres Owlaris, el tutor académico inteligente de ${colegio}.
ROL: Eres un tutor socrático — tu misión es GUIAR al alumno para que llegue a la respuesta, nunca dársela directamente.
ALUMNO: Estudiante de ${grado}, materia: ${materia}.
REGLAS:
1. NUNCA hagas la tarea del alumno.
2. Usa el método socrático: haz preguntas que lleven al alumno a pensar.
3. Celebra el esfuerzo.
4. Responde siempre en español, lenguaje apropiado para ${grado}.
5. Respuestas concisas (máximo 4-5 párrafos cortos).`

  if (contenido) {
    return `${base}\n\nCONTENIDO CURRICULAR:\n---\n${contenido.substring(0, 3000)}\n---`
  }
  return base
}

function detectarCopia(pregunta: string): boolean {
  const patrones = ['hazme la tarea', 'dame las respuestas', 'escribe el ensayo', 'resuelve todo']
  return patrones.some(p => pregunta.toLowerCase().includes(p))
}

async function registrarPendiente(
  supabase: ReturnType<typeof import('@/lib/supabase/server').createClient>,
  perfil: { colegio_id: string; grado: string | null },
  materia: { nombre: string },
  pregunta: string
) {
  const tema = pregunta.substring(0, 150)
  const { data: existente } = await supabase
    .from('pendientes')
    .select('id, veces_solicitado')
    .eq('colegio_id', perfil.colegio_id)
    .eq('materia', materia.nombre)
    .eq('tema_solicitado', tema)
    .single()

  if (existente) {
    await supabase.from('pendientes').update({ veces_solicitado: existente.veces_solicitado + 1 }).eq('id', existente.id)
  } else {
    await supabase.from('pendientes').insert({
      colegio_id: perfil.colegio_id,
      grado: perfil.grado || '',
      materia: materia.nombre,
      tema_solicitado: tema,
      veces_solicitado: 1,
      resuelto: false,
    })
  }
}
