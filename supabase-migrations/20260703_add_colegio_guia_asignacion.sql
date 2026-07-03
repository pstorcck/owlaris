-- Owlaris: permitir un guia "colegio" (contacto tecnico) ademas de "grado" y "alumno".
-- Se usa para las alertas tecnicas (fallas de OpenAI, errores internos), que no
-- pertenecen a un alumno ni a un grado especifico.
-- Ejecutar una sola vez en Supabase SQL Editor.

alter table guia_asignaciones drop constraint if exists guia_asignaciones_tipo_check;
alter table guia_asignaciones add constraint guia_asignaciones_tipo_check
  check (tipo in ('grado','alumno','colegio'));
