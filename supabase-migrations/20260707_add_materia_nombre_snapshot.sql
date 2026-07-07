-- Owlaris: registrar el nombre real de materia usado en cada turno,
-- independiente del FK materia_id (que no siempre resuelve contra la tabla
-- materias, porque el selector de materia usa nombres de carpetas de
-- SharePoint). Sin esto, el reporte para padres etiquetaba TODA la sesion
-- con la ultima materia activa al momento de generar el PDF, en vez de la
-- materia real de cada interaccion (hallazgo de auditoria QA 2026-07-07).
-- Ejecutar una sola vez en Supabase SQL Editor.

alter table interacciones add column if not exists materia_nombre_snapshot text;
