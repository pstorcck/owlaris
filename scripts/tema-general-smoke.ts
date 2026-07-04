import assert from 'node:assert/strict'
import { limpiarTemaGeneral } from '../src/lib/temaGeneral'

function main() {
  // Bug real: el reporte mostraba el texto crudo del alumno como si fuera
  // el tema estudiado (ej. "Science Grade 8: sobre la celula").
  assert.equal(limpiarTemaGeneral('sobre la celula'), 'La celula')
  assert.equal(limpiarTemaGeneral('que es la fotosintesis?'), 'La fotosintesis')
  assert.equal(limpiarTemaGeneral('¿qué es un sustantivo?'), 'Un sustantivo')
  assert.equal(limpiarTemaGeneral('puedes explicarme la revolucion francesa'), 'La revolucion francesa')
  assert.equal(limpiarTemaGeneral('cuentame sobre el imperio romano'), 'El imperio romano')
  assert.equal(limpiarTemaGeneral('what is photosynthesis?', true), 'Photosynthesis')
  assert.equal(limpiarTemaGeneral('tell me about the roman empire', true), 'The roman empire')

  // Preguntas que ya son un tema razonable no deben mutilarse de más.
  assert.equal(limpiarTemaGeneral('la guerra fria'), 'La guerra fria')

  // Texto sin contenido real (solo un número o una letra suelta) no debe
  // mostrarse como si fuera un tema — mismo principio que esTemaValido en
  // el reporte, pero aplicado en el momento de guardar la interacción.
  assert.equal(limpiarTemaGeneral('22'), 'Pregunta abierta')
  assert.equal(limpiarTemaGeneral('a'), 'Pregunta abierta')
  assert.equal(limpiarTemaGeneral('22', true), 'Open question')
  assert.equal(limpiarTemaGeneral(''), 'Pregunta abierta')

  console.log('tema-general smoke passed')
}

main()
