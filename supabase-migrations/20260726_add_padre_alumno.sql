-- Owlaris: vínculo padre-alumno.
--
-- Hallazgo real (2026-07-26): el rol "padre" existe (ROLES_PERMITIDOS en
-- /api/usuarios y /api/signup) pero no hay NINGÚN dato que conecte una
-- cuenta padre con un alumno real — el chat de padres (/padres,
-- preguntar-padres) es solo un consejero general sin acceso a informes.
-- Se agrega esta tabla para que el admin pueda vincular un padre con su(s)
-- hijo(s), habilitando que vea el mismo "Informe Pedagógico Familiar" que
-- ya usan guía/director (vía canParentAccessStudent en guideAccess.ts).
--
-- Mismo patrón de acceso que guia_asignaciones: sin políticas RLS públicas,
-- solo se consulta desde el servidor con el cliente admin (service_role).
-- Ejecutar una sola vez en Supabase SQL Editor.

create table if not exists padre_alumno (
  id uuid primary key default gen_random_uuid(),
  padre_id uuid not null references usuarios(id) on delete cascade,
  alumno_id uuid not null references usuarios(id) on delete cascade,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  unique (padre_id, alumno_id)
);

alter table padre_alumno enable row level security;

create index if not exists padre_alumno_padre_id_idx on padre_alumno(padre_id) where activo;
create index if not exists padre_alumno_alumno_id_idx on padre_alumno(alumno_id) where activo;
