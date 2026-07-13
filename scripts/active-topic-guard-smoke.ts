import assert from 'node:assert/strict'
import { buildTemaActivoInstruction, detectActiveTopic, detectExplicitTopicSwitch } from '../src/lib/activeTopicGuard'

function main() {
  const temasMate = [
    'Productos notables, factorización y fracciones algebraicas',
    'Figuras planas, círculo y cuerpos sólidos',
    'Razones trigonométricas, ley de senos y ley de cosenos',
    'Operaciones entre conjuntos y producto cartesiano',
  ]
  const temasLenguaje = [
    'Comprensión literal: localizar información explícita',
    'Comprensión inferencial: relaciones implícitas',
    'Comprensión crítica: juicios y argumentos',
  ]

  // detectActiveTopic: encuentra el tema mencionado más reciente en el
  // historial, buscando de más nuevo a más viejo (el tema más reciente
  // gana si se mencionó más de uno).
  const historialFracciones = [
    { rol: 'usuario', contenido: 'quiero practicar factorización' },
    { rol: 'asistente', contenido: 'Claro, trabajemos productos notables y fracciones algebraicas. Aquí tienes un ejercicio...' },
  ]
  assert.equal(detectActiveTopic(historialFracciones, temasMate), 'Productos notables, factorización y fracciones algebraicas')

  const historialDosTemas = [
    { rol: 'asistente', contenido: 'Trabajemos figuras planas y círculo.' },
    { rol: 'usuario', contenido: 'ok' },
    { rol: 'asistente', contenido: 'Ahora veamos razones trigonométricas y ley de senos.' },
  ]
  assert.equal(detectActiveTopic(historialDosTemas, temasMate), 'Razones trigonométricas, ley de senos y ley de cosenos', 'debe ganar la mención MÁS RECIENTE')

  assert.equal(detectActiveTopic([], temasMate), null)
  assert.equal(detectActiveTopic(undefined, temasMate), null)
  assert.equal(detectActiveTopic(historialFracciones, []), null)
  assert.equal(detectActiveTopic([{ rol: 'usuario', contenido: 'hola, como estas' }], temasMate), null, 'sin mención a ningún tema, no debe inventar uno')

  // detectExplicitTopicSwitch: frase de cambio explícita + nombre de otro tema.
  const cambio1 = detectExplicitTopicSwitch(
    'mejor cambiemos a razones trigonométricas',
    temasMate,
    'Productos notables, factorización y fracciones algebraicas'
  )
  assert.equal(cambio1.detectado, true)
  assert.equal(cambio1.temaMencionado, 'Razones trigonométricas, ley de senos y ley de cosenos')

  // Mensaje corto que nombra directamente otro tema, sin frase de cambio.
  const cambio2 = detectExplicitTopicSwitch('figuras planas', temasMate, 'Operaciones entre conjuntos y producto cartesiano')
  assert.equal(cambio2.detectado, true)
  assert.equal(cambio2.temaMencionado, 'Figuras planas, círculo y cuerpos sólidos')

  // Mencionar el TEMA ACTIVO mismo no cuenta como cambio (sigue en el mismo tema).
  const sinCambio = detectExplicitTopicSwitch(
    'no entendí bien la parte de fracciones algebraicas, me explicas de nuevo',
    temasMate,
    'Productos notables, factorización y fracciones algebraicas'
  )
  assert.equal(sinCambio.detectado, false)

  // Un mensaje largo que no nombra ningún tema de la lista y no tiene frase
  // de cambio no debe activar nada — sigue en el tema activo.
  const sinMencion = detectExplicitTopicSwitch(
    'no entiendo por qué el resultado da negativo en este paso, puedes explicarme otra vez',
    temasMate,
    'Productos notables, factorización y fracciones algebraicas'
  )
  assert.equal(sinMencion.detectado, false)

  // Sin tema activo conocido (ej. inicio de conversación), un mensaje largo
  // que solo de casualidad comparte palabras con otro tema no debe disparar
  // — el requisito de frase de cambio o mensaje corto evita falsos positivos.
  const sinTemaActivoLargo = detectExplicitTopicSwitch(
    'estoy confundido con la comprensión de este texto tan largo que me pusieron para leer hoy',
    temasLenguaje,
    null
  )
  assert.equal(sinTemaActivoLargo.detectado, false)

  // buildTemaActivoInstruction: sin tema activo no genera ninguna instrucción.
  assert.equal(buildTemaActivoInstruction({ temaActivo: null, cambioExplicito: false }), '')

  const instruccionFija = buildTemaActivoInstruction({
    temaActivo: 'Figuras planas, círculo y cuerpos sólidos',
    cambioExplicito: false,
  })
  assert.match(instruccionFija, /tema activo declarado/i)
  assert.match(instruccionFija, /Figuras planas/)

  const instruccionCambio = buildTemaActivoInstruction({
    temaActivo: 'Razones trigonométricas, ley de senos y ley de cosenos',
    cambioExplicito: true,
  })
  assert.match(instruccionCambio, /pidió explícitamente cambiar/i)

  const instruccionIngles = buildTemaActivoInstruction({ temaActivo: 'Fractions', cambioExplicito: false, idiomaIngles: true })
  assert.match(instruccionIngles, /active declared topic/i)

  console.log('active-topic-guard smoke passed')
}

main()
