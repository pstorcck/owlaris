// Hallazgo real (auditoría 2026-07-07): una crisis real (autolesión, abuso,
// violencia) sin guía asignado no generaba ninguna notificación humana, solo
// quedaba en la tabla `alertas`. Este test cubre la decisión pura de a quién
// notificar en cascada: guía asignado -> staff del colegio -> superadmin ->
// ninguno (las consultas a la BD no son unit-testeables aquí).
import assert from 'node:assert/strict'
import { elegirFuenteDestinatariosAlerta } from '../src/lib/alertaEmergencia'

function main() {
  assert.equal(
    elegirFuenteDestinatariosAlerta({ hayGuiaAsignado: true, hayStaffColegio: true, haySuperadmin: true }),
    'guia_asignado'
  )
  assert.equal(
    elegirFuenteDestinatariosAlerta({ hayGuiaAsignado: true, hayStaffColegio: false, haySuperadmin: false }),
    'guia_asignado'
  )
  assert.equal(
    elegirFuenteDestinatariosAlerta({ hayGuiaAsignado: false, hayStaffColegio: true, haySuperadmin: true }),
    'staff_colegio'
  )
  assert.equal(
    elegirFuenteDestinatariosAlerta({ hayGuiaAsignado: false, hayStaffColegio: true, haySuperadmin: false }),
    'staff_colegio'
  )
  assert.equal(
    elegirFuenteDestinatariosAlerta({ hayGuiaAsignado: false, hayStaffColegio: false, haySuperadmin: true }),
    'superadmin'
  )
  assert.equal(
    elegirFuenteDestinatariosAlerta({ hayGuiaAsignado: false, hayStaffColegio: false, haySuperadmin: false }),
    'ninguno'
  )

  console.log('alerta-emergencia smoke passed')
}

main()
