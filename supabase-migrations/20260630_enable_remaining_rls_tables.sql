-- Owlaris: fix directo para tablas que aun aparecen sin RLS en Supabase Advisor.
-- Ejecutar en Supabase SQL Editor si el check lista usuarios, guia_asignaciones o alertas.

begin;

alter table if exists public.usuarios enable row level security;
alter table if exists public.guia_asignaciones enable row level security;
alter table if exists public.alertas enable row level security;

commit;

select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('usuarios', 'guia_asignaciones', 'alertas');

select schemaname, tablename
from pg_tables
where schemaname = 'public'
  and rowsecurity = false;
