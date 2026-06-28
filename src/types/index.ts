// ================================
// OWLARIS - Tipos principales
// ================================

export type Rol = 'alumno' | 'maestro' | 'padre' | 'director' | 'admin' | 'superadmin'

export interface Colegio {
  id: string
  nombre: string
  slug: string
  color_primario: string
  color_secundario: string
  sharepoint_folder: string
  activo: boolean
  creado_en: string
}

export interface Usuario {
  id: string
  colegio_id: string
  nombre_completo: string
  email: string
  rol: Rol
  grado: string | null
  activo: boolean
  ultimo_acceso: string | null
  colegio?: Colegio
}

export interface Materia {
  id: string
  colegio_id: string
  nombre: string
  slug: string
  activa: boolean
}

export interface Interaccion {
  id: string
  usuario_id: string
  colegio_id: string
  materia_id: string | null
  grado: string | null
  tema_detectado: string | null
  pregunta: string
  respuesta: string
  tokens_usados: number
  costo_usd: number
  modelo_usado: string
  documento_fuente: string | null
  sospecha_copia: boolean
  creado_en: string
}

export interface Pendiente {
  id: string
  colegio_id: string
  grado: string
  materia: string
  tema_solicitado: string
  veces_solicitado: number
  resuelto: boolean
  creado_en: string
}

export interface MetricaDiaria {
  id: string
  colegio_id: string
  fecha: string
  total_preguntas: number
  costo_total_usd: number
  alumnos_activos: number
  materia_mas_consultada: string | null
  temas_sin_contenido: number
}

export interface MensajeChat {
  id: string
  rol: 'usuario' | 'asistente'
  contenido: string
  timestamp: Date
  tokens?: number
  documento_fuente?: string
}
