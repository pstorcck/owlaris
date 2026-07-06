export type FilaConfiguracion = {
  colegio_id: string
  clave: string
  valor: string
  actualizado_en: string
}

// Construye las filas para upsert masivo de una misma clave/valor de
// configuración a todos los colegios — evita tener que guardar el mismo
// número colegio por colegio (bug real: un colegio del mismo grupo quedó
// con un límite de preguntas distinto al que se creía ya aplicado a todos).
export function construirFilasConfiguracionParaTodos(
  colegioIds: string[],
  clave: string,
  valor: string,
  ahora: string
): FilaConfiguracion[] {
  return (colegioIds || [])
    .filter((id) => !!id)
    .map((colegio_id) => ({ colegio_id, clave, valor, actualizado_en: ahora }))
}
