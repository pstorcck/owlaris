// Hallazgo real (QA, bug del selector de grado): normalizarGrado() en
// preguntar/route.ts usaba ".*" (cualquier carácter) entre el número y la
// palabra de nivel ("4.*prim"), así que un número sin relación en la misma
// oración (la edad del alumno: "tengo 14 años y estoy en primero básico")
// se colaba y activaba el grado equivocado ("4to Primaria" en vez de
// "1ero Básico", solo porque "14" contiene un "4" seguido, en algún punto
// posterior de la oración, de "prim" dentro de "primero"). Este script
// replica la misma lógica ya corregida en route.ts (sin depender de
// credenciales de Supabase/OpenAI, que route.ts necesita a nivel de
// módulo) para verificar que el bug no reaparezca.
import assert from 'node:assert/strict'

function normalizarGrado(texto: string): string {
  const t = texto.toLowerCase()
    .replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i').replace(/ó/g,'o').replace(/ú/g,'u')
    .replace(/°/g,'').replace(/\.$/g,'').trim()
  if (/\b4(?:to)?\.?\s*prim|cuarto\s*prim/i.test(t)) return '4to Primaria'
  if (/\b5(?:to)?\.?\s*prim|quinto\s*prim/i.test(t)) return '5to Primaria'
  if (/\b6(?:to)?\.?\s*prim|sexto\s*prim/i.test(t)) return '6to Primaria'
  if (/\b1(?:ero|er)?\.?\s*bas|primer\s*bas|primero\s*bas/i.test(t)) return '1ero Básico'
  if (/\b2(?:do)?\.?\s*bas|segundo\s*bas/i.test(t)) return '2do Básico'
  if (/\b3(?:ero|er)?\.?\s*bas|tercer(?:o)?\s*bas/i.test(t)) return '3ero Básico'
  if (/\b4(?:to)?\.?\s*bach|cuarto\s*bach/i.test(t)) return '4to Bachillerato'
  if (/\b5(?:to)?\.?\s*bach|quinto\s*bach/i.test(t)) return '5to Bachillerato'
  return ''
}

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

function main() {
  // Casos reales del hallazgo: un número sin relación (edad) no debe
  // secuestrar la detección del grado real mencionado.
  const casosBug: Array<[string, string]> = [
    ['tengo 14 años y estoy en primero básico', '1ero Básico'],
    ['tengo 15 años, estoy en primero básico', '1ero Básico'],
    ['tengo 16 años y voy en segundo básico', '2do Básico'],
    ['tengo 17 años, estudio quinto bachillerato', '5to Bachillerato'],
    ['tengo 14 años y curso sexto primaria', '6to Primaria'],
  ]
  casosBug.forEach(([texto, esperado], i) => {
    test(`no-secuestra-por-edad-${i}: ${texto}`, () => {
      assert.equal(normalizarGrado(texto), esperado, texto)
    })
  })

  // Casos normales (sin ruido) deben seguir funcionando igual.
  const casosNormales: Array<[string, string]> = [
    ['4to primaria', '4to Primaria'],
    ['cuarto primaria', '4to Primaria'],
    ['5to primaria', '5to Primaria'],
    ['quinto primaria', '5to Primaria'],
    ['6to primaria', '6to Primaria'],
    ['sexto primaria', '6to Primaria'],
    ['1ero básico', '1ero Básico'],
    ['primero básico', '1ero Básico'],
    ['2do básico', '2do Básico'],
    ['segundo básico', '2do Básico'],
    ['3ero básico', '3ero Básico'],
    ['tercero básico', '3ero Básico'],
    ['4to bachillerato', '4to Bachillerato'],
    ['cuarto bachillerato', '4to Bachillerato'],
    ['5to bachillerato', '5to Bachillerato'],
    ['quinto bachillerato', '5to Bachillerato'],
    ['estoy en 6to primaria', '6to Primaria'],
  ]
  casosNormales.forEach(([texto, esperado], i) => {
    test(`caso-normal-${i}: ${texto}`, () => {
      assert.equal(normalizarGrado(texto), esperado, texto)
    })
  })

  test('texto irreconocible devuelve cadena vacía', () => {
    assert.equal(normalizarGrado('no se que grado tengo'), '')
  })

  if (failures.length > 0) {
    console.error(`grado-parsing-guard smoke failed: ${failures.length}/${total}`)
    for (const failure of failures) {
      console.error(`- ${failure.name}: ${failure.message}`)
    }
    process.exit(1)
  }

  console.log(`grado-parsing-guard smoke passed: ${total}/${total}`)
}

main()
