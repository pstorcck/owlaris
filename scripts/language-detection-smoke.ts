// Hallazgo real (QA amplia 2026-07-08): un mensaje en un idioma distinto al
// configurado en la sesión se trataba como cambio de tema. Este test cubre
// la heurística pura que detecta el caso (sin llamadas a OpenAI ni red).
import assert from 'node:assert/strict'
import { pareceIdiomaDistinto } from '../src/lib/languageDetection'

function main() {
  // Sesión en español, mensaje en inglés -> debe detectarse.
  assert.equal(
    pareceIdiomaDistinto('Can you explain what a cell membrane does?', false),
    true
  )
  assert.equal(
    pareceIdiomaDistinto('What is the water cycle and how does it work?', false),
    true
  )

  // Sesión en español, mensaje en español -> no debe dispararse.
  assert.equal(pareceIdiomaDistinto('¿Qué es la fotosíntesis?', false), false)
  assert.equal(pareceIdiomaDistinto('¿Puedes explicarme las fracciones?', false), false)

  // Sesión en inglés, mensaje en español -> debe detectarse.
  assert.equal(pareceIdiomaDistinto('¿Puedes explicarme cómo funciona esto?', true), true)

  // Sesión en inglés, mensaje en inglés -> no debe dispararse.
  assert.equal(pareceIdiomaDistinto('Can you explain how this works?', true), false)

  // Un solo término técnico compartido entre idiomas no debe disparar un
  // falso positivo (menos de 2 coincidencias de idioma).
  assert.equal(pareceIdiomaDistinto('Membrane', false), false)
  assert.equal(pareceIdiomaDistinto('', false), false)

  console.log('language-detection smoke passed')
}

main()
