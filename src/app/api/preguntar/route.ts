import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// Límite de preguntas por día por alumno (control de costos)
const LIMITE_DIARIO = 50

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { pregunta, materia_id, historial } = await req.json()
    if (!pregunta?.trim()) return NextResponse.json({ error: 'Pregunta vacía' }, { status: 400 })

    // 1. Obtener perfil del alumno
    const { data: perfil } = await supabase
      .from('usuarios')
      .select('*, colegio:colegios(*)')
      .eq('id', user.id)
      .single()

    if (!perfil) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })

    // 2. Verificar límite diario
    const hoy = new Date().toISOString().split('T')[0]
    const { count } = await supabase
      .from('interacciones')
      .select('*', { count: 'exact', head: true })
      .eq('usuario_id', user.id)
      .gte('creado_en', `${hoy}T00:00:00`)

    if ((count || 0) >= LIMITE_DIARIO) {
      return NextResponse.json({
        error: 'Alcanzaste el límite de preguntas del día. ¡Vuelve mañana!'
      }, { status: 429 })
    }

    // 3. Obtener materia
    const { data: materia } = await supabase
      .from('materias')
      .select('*')
      .eq('id', materia_id)
      .single()

    // 4. Buscar contenido en SharePoint
    let contenidoCurricular = ''
    let documentoFuente = null

    try {
      const resContenido = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/contenido`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': req.headers.get('cookie') || '' },
        body: JSON.stringify({
          colegio_slug: perfil.colegio?.sharepoint_folder,
          grado: perfil.grado,
          materia: materia?.slug || materia?.nombre?.toLowerCase(),
          pregunta,
        }),
      })

      if (resContenido.ok) {
        const dataContenido = await resContenido.json()
        contenidoCurricular = dataContenido.contenido || ''
        documentoFuente = dataContenido.archivo || null
      }
    } catch {
      // Si SharePoint falla, continuamos sin contenido específico
      console.log('SharePoint no disponible, continuando sin contenido curricular')
    }

    // 5. Construir el prompt
    const systemPrompt = construirSystemPrompt(
      perfil.colegio?.nombre || 'tu colegio',
      perfil.grado || 'tu grado',
      materia?.nombre || 'la materia',
      contenidoCurricular
    )

    // 6. Construir historial de conversación
    const mensajesOpenAI: { role: 'user' | 'assistant' | 'system'; content: string }[] = [
      { role: 'system', content: systemPrompt },
    ]

    if (historial && historial.length > 0) {
      historial.forEach((msg: { rol: string; contenido: string }) => {
        mensajesOpenAI.push({
          role: msg.rol === 'usuario' ? 'user' : 'assistant',
          content: msg.contenido,
        })
      })
    }

    mensajesOpenAI.push({ role: 'user', content: pregunta })

    // 7. Elegir modelo según complejidad de la pregunta
    const modelo = elegirModelo(pregunta, contenidoCurricular)

    // 8. Llamar a OpenAI
    const completion = await openai.chat.completions.create({
      model: modelo,
      messages: mensajesOpenAI,
      max_tokens: 600,
      temperature: 0.7,
    })

    const respuesta = completion.choices[0].message.content || 'No pude generar una respuesta.'
    const tokensUsados = completion.usage?.total_tokens || 0
    const costoUSD = calcularCosto(modelo, tokensUsados)

    // 9. Detectar posible intento de copia
    const sospechaCopia = detectarCopia(pregunta)

    // 10. Guardar interacción en Supabase
    await supabase.from('interacciones').insert({
      usuario_id: user.id,
      colegio_id: perfil.colegio_id,
      materia_id: materia_id || null,
      grado: perfil.grado,
      tema_detectado: extraerTema(pregunta),
      pregunta,
      respuesta,
      tokens_usados: tokensUsados,
      costo_usd: costoUSD,
      modelo_usado: modelo,
      documento_fuente: documentoFuente,
      sospecha_copia: sospechaCopia,
    })

    // 11. Si no había contenido, guardar como pendiente
    if (!contenidoCurricular && materia) {
      await registrarPendiente(supabase, perfil, materia, pregunta)
    }

    return NextResponse.json({
      respuesta,
      tokens: tokensUsados,
      documento_fuente: documentoFuente,
    })

  } catch (err) {
    console.error('Error en /api/preguntar:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// ================================
// Funciones auxiliares
// ================================

function construirSystemPrompt(
  colegio: string,
  grado: string,
  materia: string,
  contenido: string
): string {
  const base = `Eres Owlaris, el tutor académico inteligente de ${colegio}.

ROL: Eres un tutor socrático — tu misión es GUIAR al alumno para que llegue a la respuesta, nunca dársela directamente.

ALUMNO: Estudiante de ${grado}, materia: ${materia}.

REGLAS ABSOLUTAS:
1. NUNCA hagas la tarea del alumno. Si te piden "resuelve este ejercicio", guíalos con preguntas.
2. Usa el método socrático: haz preguntas que lleven al alumno a pensar.
3. Celebra el esfuerzo, no solo los resultados correctos.
4. Si el alumno está frustrado, sé empático antes de continuar.
5. Responde siempre en español, con lenguaje apropiado para ${grado}.
6. Mantén respuestas concisas (máximo 4-5 párrafos cortos).
7. Usa emojis con moderación para hacer la conversación amigable.`

  if (contenido) {
    return `${base}

CONTENIDO CURRICULAR (basa tus respuestas en esto):
---
${contenido.substring(0, 3000)}
---

IMPORTANTE: Si la pregunta no está relacionada con este contenido curricular, indícalo amablemente y sugiere consultar al maestro.`
  }

  return `${base}

NOTA: No tengo el material curricular específico para este tema. Responde con conocimiento general apropiado para el nivel, y sugiere al alumno que consulte su libro de texto o al maestro para información específica del curso.`
}

function elegirModelo(pregunta: string, contenido: string): string {
  // Usar modelo avanzado para preguntas complejas
  const esCompleja = pregunta.length > 200 || contenido.length > 2000
  return esCompleja ? 'gpt-4o-mini' : 'gpt-4o-mini'
  // Para fase 2: return esCompleja ? 'gpt-4o' : 'gpt-4o-mini'
}

function calcularCosto(modelo: string, tokens: number): number {
  const precios: Record<string, number> = {
    'gpt-4o-mini': 0.00000015,
    'gpt-4o':      0.0000025,
  }
  return (precios[modelo] || 0.00000015) * tokens
}

function detectarCopia(pregunta: string): boolean {
  const patrones = [
    'hazme la tarea',
    'dame las respuestas',
    'escribe el ensayo',
    'resuelve todo',
    'dame todo el examen',
    'cópiame',
    'escríbeme todo',
  ]
  const preguntaLower = pregunta.toLowerCase()
  return patrones.some(p => preguntaLower.includes(p))
}

function extraerTema(pregunta: string): string {
  // Extracción simple del tema — en Fase 3 usaremos IA para esto
  return pregunta.substring(0, 100)
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
    await supabase
      .from('pendientes')
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
