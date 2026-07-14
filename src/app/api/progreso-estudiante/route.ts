import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calcularPuntos, calcularRachaDiasActivos } from '@/lib/progresoEstudiante'

// Rediseño premium (instructivo 2026-07-14): racha de días activos y puntos
// para el header del chat, con datos reales de `interacciones` — no
// inventados. Si algo falla, se devuelven ceros en vez de un error: es un
// elemento decorativo del header, no debe romper el chat.
export async function GET(_req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ racha_dias_activos: 0, puntos: 0 })

    // 60 días es más que suficiente para cualquier racha realista y evita
    // escanear todo el historial del alumno en cada carga del chat.
    const desde = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
    const { data: fechasActividad } = await supabase
      .from('interacciones')
      .select('creado_en')
      .eq('usuario_id', user.id)
      .gte('creado_en', desde.toISOString())

    const { count: totalCorrectas } = await supabase
      .from('interacciones')
      .select('id', { count: 'exact', head: true })
      .eq('usuario_id', user.id)
      .in('estado_evaluacion', ['correcto', 'equivalente'])

    const racha = calcularRachaDiasActivos((fechasActividad || []).map((r) => r.creado_en as string))
    const puntos = calcularPuntos(totalCorrectas || 0)

    return NextResponse.json({ racha_dias_activos: racha, puntos })
  } catch (e) {
    console.error('Error calculando progreso del estudiante:', e)
    return NextResponse.json({ racha_dias_activos: 0, puntos: 0 })
  }
}
