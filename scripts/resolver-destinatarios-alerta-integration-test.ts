// Hallazgo real (revisión 2026-07-11): la cascada de respaldo (guía → staff
// del colegio → superadmin) solo estaba implementada para alertas de
// seguridad de contenido — las alertas académicas automáticas (baja
// comprensión) y las alertas manuales (/api/alertas) solo buscaban un guía
// asignado, y si el colegio no tenía guías configurados, la alerta quedaba
// sin notificar a nadie. Este test ejercita resolverDestinatariosAlerta
// (la función que ahora centraliza esa cascada) con un cliente Supabase
// simulado mínimo, para verificar los 4 escenarios reales sin depender de
// credenciales reales.
import assert from 'node:assert/strict'
import { resolverDestinatariosAlerta } from '../src/lib/alertaEmergencia'

type FilaAlumno = { guia_id: string; guia: { email: string; nombre_completo: string } } | null
type FilaStaff = { email: string; nombre_completo: string }

// buscarStaffColegio y buscarSuperadmins ambos consultan la tabla
// 'usuarios' pero con filtros distintos (colegio_id+rol in [...] vs solo
// rol=superadmin) — se distinguen aquí por orden de invocación: la primera
// llamada a 'usuarios' es siempre buscarStaffColegio (solo se invoca si no
// hay guía asignado), la segunda es siempre buscarSuperadmins (solo si
// tampoco hay staff).
function crearAdminFalso(input: {
  asignacionAlumno: FilaAlumno
  asignacionGrado: FilaAlumno
  staff: FilaStaff[]
  superadmins: FilaStaff[]
}) {
  let llamadasUsuarios = 0
  return {
    from(tabla: string) {
      if (tabla === 'guia_asignaciones') {
        let tipoFiltro: 'alumno' | 'grado' | null = null
        const self = {
          select: () => self,
          eq: (campo: string, valor: unknown) => {
            if (campo === 'tipo') tipoFiltro = valor as 'alumno' | 'grado'
            return self
          },
          limit: () => self,
          maybeSingle: async () => ({
            data: tipoFiltro === 'alumno' ? input.asignacionAlumno : tipoFiltro === 'grado' ? input.asignacionGrado : null,
          }),
        }
        return self
      }
      if (tabla === 'usuarios') {
        llamadasUsuarios += 1
        const esPrimeraLlamada = llamadasUsuarios === 1
        const self = {
          select: () => self,
          eq: () => self,
          in: () => self,
          limit: async () => ({ data: esPrimeraLlamada ? input.staff : input.superadmins }),
        }
        return self
      }
      throw new Error(`tabla no simulada: ${tabla}`)
    },
  }
}

async function main() {
  const guiaEjemplo = { guia_id: 'g1', guia: { email: 'guia@colegio.com', nombre_completo: 'Guía Ejemplo' } }

  // Caso 1: hay guía asignado directamente al alumno.
  const admin1 = crearAdminFalso({ asignacionAlumno: guiaEjemplo, asignacionGrado: null, staff: [], superadmins: [] })
  const r1 = await resolverDestinatariosAlerta(admin1 as never, { colegioId: 'c1', alumnoId: 'a1', grado: '5to Primaria' })
  assert.equal(r1.fuente, 'guia_asignado')
  assert.equal(r1.destinatarios[0]?.email, 'guia@colegio.com')

  // Caso 2: no hay guía por alumno, pero sí por grado.
  const admin2 = crearAdminFalso({ asignacionAlumno: null, asignacionGrado: guiaEjemplo, staff: [], superadmins: [] })
  const r2 = await resolverDestinatariosAlerta(admin2 as never, { colegioId: 'c1', alumnoId: 'a1', grado: '5to Primaria' })
  assert.equal(r2.fuente, 'guia_asignado')

  // Caso 3: sin ningún guía asignado, pero SÍ hay staff del colegio — este
  // es exactamente el hallazgo real: antes esto no se intentaba en absoluto
  // para alertas académicas/manuales, y la alerta quedaba sin notificar.
  const admin3 = crearAdminFalso({
    asignacionAlumno: null,
    asignacionGrado: null,
    staff: [{ email: 'director@colegio.com', nombre_completo: 'Director Ejemplo' }],
    superadmins: [],
  })
  const r3 = await resolverDestinatariosAlerta(admin3 as never, { colegioId: 'c1', alumnoId: 'a1', grado: '5to Primaria' })
  assert.equal(r3.fuente, 'staff_colegio')
  assert.equal(r3.destinatarios[0]?.email, 'director@colegio.com')

  // Caso 4: ni guía ni staff — cae a superadmin.
  const admin4 = crearAdminFalso({
    asignacionAlumno: null,
    asignacionGrado: null,
    staff: [],
    superadmins: [{ email: 'super@owlaris.app', nombre_completo: 'Superadmin' }],
  })
  const r4 = await resolverDestinatariosAlerta(admin4 as never, { colegioId: 'c1', alumnoId: 'a1', grado: '5to Primaria' })
  assert.equal(r4.fuente, 'superadmin')

  // Caso 5: nada de nada — no debe reventar, solo devolver "ninguno".
  const admin5 = crearAdminFalso({ asignacionAlumno: null, asignacionGrado: null, staff: [], superadmins: [] })
  const r5 = await resolverDestinatariosAlerta(admin5 as never, { colegioId: 'c1', alumnoId: 'a1', grado: null })
  assert.equal(r5.fuente, 'ninguno')
  assert.equal(r5.destinatarios.length, 0)

  console.log('resolver-destinatarios-alerta integration test passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
