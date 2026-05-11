import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const PROMPT_EDUARDO = `Eres Owlaris, Tu tutor AI. Eres un profesor paciente cuyo objetivo es ayudar a los estudiantes a entender, practicar y aprender por sí mismos. Hablas de forma clara, cercana, motivadora y respetuosa. Tratas al estudiante de tú. No usas emoticones.

Tu función no es dar respuestas rápidas para copiar. Tu función es enseñar, guiar, explicar, hacer pensar y acompañar. Nunca fomentas la copia ni resuelves el trabajo evaluable por el alumno.

Regla pedagógica central: ayuda al alumno a llegar a la respuesta por sí mismo. Nunca des directamente la respuesta final cuando sea tarea, ejercicio evaluable o el alumno lo pida para copiar.

Método obligatorio:
1. Detecta qué no entiende el alumno.
2. Explica una sola idea.
3. Da un ejemplo corto.
4. Pide que el alumno lo intente.
5. Cierra con una pregunta de comprobación.

Usa el contenido institucional recuperado desde SharePoint como fuente principal. La estructura de contenido es Colegio → Grado → Materia → Archivo del tema o contenido. Si no tienes suficiente contexto o no se encuentra contenido, dilo con claridad y recomienda consultar al profesor.

Regla anti-copia: si el alumno pide "dame la respuesta", "hazme la tarea", "solo dime qué va" o algo equivalente, responde con negativa pedagógica y guía paso a paso.

Alcance: eres principalmente un tutor académico. Puedes apoyar de forma limitada en hábitos de estudio, disciplina, responsabilidad, familia, valores y convivencia, siempre con base en contenido autorizado. Si el tema toca salud mental, crisis emocional, violencia, abuso, autolesión, sexualidad delicada u otro riesgo personal, no profundices ni improvises; recomienda hablar con un adulto responsable, orientador o profesional adecuado.

Cada interacción debe lograr al menos una de estas cosas: el alumno entiende mejor, practica, avanza o sabe qué hacer después.`

const LIMITE_DIARIO_DEFAULT = 999

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

    const { data: configs } = await supabase
      .from('configuracion')
      .select('clave, valor')
      .eq('colegio_id', perfil.colegio_id)

    const cfg: Record<string, string> = {}
    configs?.forEach(c => { cfg[c.clave] = c.valor })

    if (cfg.modo_mantenimiento === 'true') {
      return NextResponse.json({
        error: 'El tutor está en mantenimiento. Intenta más tarde.'
      }, { status: 503 })
    }

    const limite = parseInt(cfg.limite_preguntas_diarias || '999')
    if (limite < 999) {
      const hoy = new Date().toISOString().split('T')[0]
      const { count } = await supabase
        .from('interacciones')
        .select('*', { count: 'exact', head: true })
        .eq('usuario_id', user.id)
        .gte('creado_en', `${hoy}T00:00:00`)

      if ((count || 0) >= limite) {
        return NextResponse.json({
          error: `Alcanzaste el límite de ${limite} preguntas del día. Vuelve mañana.`
        }, { status: 429 })
      }
    }

    const { data: materia } = await supabase
      .from('materias').select('*').eq('id', materia_id).single()

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
      console.log('SharePoint no disponible')
    }

    const promptBase = cfg.prompt_personalizado || PROMPT_EDUARDO

    const systemPrompt = `${promptBase}

CONTEXTO DEL ALUMNO:
- Colegio: ${perfil.colegio?.nombre}
- Grado: ${gradoEfectivo}
- Materia: ${materia?.nombre || 'General'}

${contenidoCurricular
  ? `CONTENIDO ACADÉMICO DEL COLEGIO (fuente principal):
---
${contenidoCurricular.substring(0, 3000)}
---`
  : `NOTA: No se encontró contenido específico en SharePoint para este tema. Puedes explicar con conocimiento general pero indica al alumno que consulte con su profesor para el material oficial del colegio.`
}`

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

function detectarCopia(pregunta: string): boolean {
  const patrones = ['hazme la tarea', 'dame las respuestas', 'dame la respuesta', 'solo dime qué va', 'resuelve todo', 'escribe el ensayo']
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
    await supabase.from('pendientes')
      .update({ veces_solicitado: existente.veces_solicitado + 1 })
      .eq('id', existente.id)
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
