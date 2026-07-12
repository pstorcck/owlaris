// Hallazgo real (verificación posterior al instructivo, 2026-07-12): el
// contenido curricular enviado al modelo siempre tomaba los primeros 3000
// caracteres del documento (substring(0, 3000)), sin importar de qué
// tratara la pregunta del alumno. Si el documento empieza con un índice de
// temas o una introducción general y la pregunta real es sobre un tema
// que aparece más adelante, el modelo solo tenía ese contenido inicial
// disponible — y terminaba citando/resumiendo ese fragmento inicial antes
// de responder, lo que se percibe como "contexto de otro tema pegado al
// inicio de la respuesta" (hallazgo recurrente reportado en la
// verificación externa).
import assert from 'node:assert/strict'
import { extractRelevantContentWindow } from '../src/lib/relevantContentWindow'

type Failure = { name: string; message: string }
const failures: Failure[] = []
let total = 0

function test(name: string, fn: () => void) {
  total += 1
  try {
    fn()
  } catch (error) {
    failures.push({ name, message: error instanceof Error ? error.message : String(error) })
  }
}

function buildDocumentoLargo(): string {
  const indice = '## Índice de temas\n' + Array.from({ length: 20 }, (_, i) => `${i + 1}. Tema genérico número ${i + 1} sobre relleno sin relación`).join('\n')
  const genetica = '\n\n## Genética\nLa genética estudia la herencia. Un genotipo es la composición genética de un organismo, y el fenotipo es su expresión observable en el ambiente.'
  const relleno = '\n\n## Otro tema\n' + 'contenido de relleno sin relación '.repeat(50)
  return indice + genetica + relleno
}

function main() {
  const documento = buildDocumentoLargo()

  test('un documento más corto que el máximo se devuelve completo sin cambios', () => {
    const corto = 'Contenido breve sin necesidad de recorte.'
    assert.equal(extractRelevantContentWindow(corto, '¿qué es esto?', 3000), corto)
  })

  test('con una palabra clave presente en el documento, la ventana se centra en esa sección real (no en el índice inicial)', () => {
    const ventana = extractRelevantContentWindow(documento, '¿qué es el genotipo?', 250)
    assert.match(ventana, /genotipo/i)
    assert.match(ventana, /gen[eé]tica/i)
  })

  test('sin ninguna palabra clave del documento en la pregunta, cae de regreso al encabezado (comportamiento anterior)', () => {
    const ventana = extractRelevantContentWindow(documento, '¿qué es la fotosíntesis?', 250)
    assert.match(ventana, /[ií]ndice de temas/i)
  })

  test('el documento completo (sin recortar) contiene tanto el índice como la sección de genética, confirmando que el recorte es lo que antes ocultaba la sección relevante', () => {
    assert.match(documento, /[ií]ndice de temas/i)
    assert.match(documento, /genotipo/i)
  })

  if (failures.length > 0) {
    console.error(`relevant-content-window smoke failed: ${failures.length}/${total}`)
    for (const failure of failures) {
      console.error(`- ${failure.name}: ${failure.message}`)
    }
    process.exit(1)
  }

  console.log(`relevant-content-window smoke passed: ${total}/${total}`)
}

main()
