// Cubre la lógica pura de src/lib/pronunciationSignal.ts: agrupar tokens
// BPE de gpt-4o-mini-transcribe en palabras y elegir la más débil como
// señal de pronunciación dirigida (en vez de solo un promedio global).
import assert from 'node:assert/strict'
import { agruparPorPalabra, palabraMasDebil } from '../src/lib/pronunciationSignal'

function logprob(p: number): number {
  return Math.log(p)
}

function main() {
  // Tokens BPE que arman "I think so" — "think" llega partido en dos
  // fragmentos ("th" + "ink") con baja confianza, simulando una palabra
  // que costó transcribir.
  const tokens = [
    { token: 'I', logprob: logprob(0.98) },
    { token: ' th', logprob: logprob(0.4) },
    { token: 'ink', logprob: logprob(0.5) },
    { token: ' so', logprob: logprob(0.95) },
  ]

  const palabras = agruparPorPalabra(tokens)
  assert.deepEqual(palabras.map(p => p.palabra), ['I', 'think', 'so'])
  const think = palabras.find(p => p.palabra === 'think')!
  const confianzaEsperada = Math.exp((logprob(0.4) + logprob(0.5)) / 2)
  assert.ok(Math.abs(think.confianza - confianzaEsperada) < 1e-9, 'confianza de palabra multi-token debe ser el promedio de sus tokens')

  const debil = palabraMasDebil(tokens)
  assert.equal(debil?.palabra, 'think', 'debe señalar la palabra multi-token de baja confianza, no un promedio genérico')

  // Sin ninguna palabra por debajo del umbral: no hay nada que señalar.
  const todoClaro = [
    { token: 'Nice', logprob: logprob(0.95) },
    { token: ' work', logprob: logprob(0.9) },
  ]
  assert.equal(palabraMasDebil(todoClaro), null, 'no debe inventar una palabra débil cuando todo se transcribió con confianza alta')

  // Palabras función cortas (a, to, in) no califican aunque su confianza
  // sea baja — son ruido esperado, no señal real de pronunciación.
  const conPalabraCorta = [
    { token: 'I', logprob: logprob(0.98) },
    { token: ' go', logprob: logprob(0.9) },
    { token: ' to', logprob: logprob(0.2) },
    { token: ' school', logprob: logprob(0.85) },
  ]
  assert.equal(palabraMasDebil(conPalabraCorta), null, 'palabras función de 2 letras no deben calificar como palabra débil')

  // Puntuación pegada a la palabra no debe impedir que califique, y debe
  // reportarse limpia (sin la coma).
  const conPuntuacion = [
    { token: 'Well', logprob: logprob(0.95) },
    { token: ',', logprob: logprob(0.9) },
    { token: ' actually', logprob: logprob(0.3) },
    { token: '.', logprob: logprob(0.9) },
  ]
  assert.equal(palabraMasDebil(conPuntuacion)?.palabra, 'actually')

  // Cuando hay varias candidatas por debajo del umbral, gana la más débil,
  // no la primera en aparecer.
  const variasDebiles = [
    { token: 'Through', logprob: logprob(0.55) },
    { token: ' thought', logprob: logprob(0.3) },
  ]
  assert.equal(palabraMasDebil(variasDebiles)?.palabra, 'thought')

  // Sin logprobs (undefined o vacío): no debe reventar, solo devolver null.
  assert.equal(palabraMasDebil(undefined), null)
  assert.deepEqual(agruparPorPalabra([]), [])

  console.log('pronunciation-signal smoke passed')
}

main()
