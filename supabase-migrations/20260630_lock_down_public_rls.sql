-- Owlaris: cerrar exposición pública y normalizar políticas RLS.
-- Ejecutar en Supabase SQL Editor del proyecto Owlaris.

begin;

create or replace function public.sede_por_email(email text)
returns text
language sql
immutable
as $$
  select case lower(split_part(coalesce(email, ''), '-', 1))
    when 'cortijo' then 'cortijo'
    when 'pla' then 'pla'
    else 'principal'
  end
$$;

create or replace function public.current_usuario_rol()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select rol from public.usuarios where id = auth.uid()
$$;

create or replace function public.current_usuario_colegio_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select colegio_id from public.usuarios where id = auth.uid()
$$;

create or replace function public.current_usuario_email()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select email from public.usuarios where id = auth.uid()
$$;

create or replace function public.can_access_alumno(alumno_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  actor_id uuid;
  actor_rol text;
  actor_colegio_id uuid;
  actor_email text;
  alumno_rol text;
  alumno_colegio_id uuid;
  alumno_email text;
  alumno_grado text;
begin
  if auth.uid() is null then
    return false;
  end if;

  select id, rol, colegio_id, email
    into actor_id, actor_rol, actor_colegio_id, actor_email
    from public.usuarios
   where id = auth.uid();

  if actor_id is null then
    return false;
  end if;

  if alumno_id = actor_id then
    return true;
  end if;

  if actor_rol = 'superadmin' then
    return true;
  end if;

  select rol, colegio_id, email, grado
    into alumno_rol, alumno_colegio_id, alumno_email, alumno_grado
    from public.usuarios
   where id = alumno_id;

  if alumno_rol is null or alumno_rol <> 'alumno' then
    return false;
  end if;

  if actor_rol = 'admin' then
    return alumno_colegio_id = actor_colegio_id;
  end if;

  if actor_rol = 'director' then
    return alumno_colegio_id = actor_colegio_id
      and public.sede_por_email(alumno_email) = public.sede_por_email(actor_email);
  end if;

  if actor_rol = 'maestro' then
    return alumno_colegio_id = actor_colegio_id
      and exists (
        select 1
          from public.guia_asignaciones ga
         where ga.guia_id = actor_id
           and ga.activo = true
           and ga.colegio_id = actor_colegio_id
           and (
             (ga.tipo = 'alumno' and ga.alumno_id = alumno_id)
             or (ga.tipo = 'grado' and ga.grado = alumno_grado)
           )
      );
  end if;

  return false;
end;
$$;

grant execute on function public.sede_por_email(text) to authenticated;
grant execute on function public.current_usuario_rol() to authenticated;
grant execute on function public.current_usuario_colegio_id() to authenticated;
grant execute on function public.current_usuario_email() to authenticated;
grant execute on function public.can_access_alumno(uuid) to authenticated;

do $$
declare
  r record;
begin
  for r in
    select tablename
      from pg_tables
     where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', r.tablename);
  end loop;
end $$;

revoke all on all tables in schema public from anon;
revoke insert, update, delete on public.colegios from authenticated;
revoke insert, update, delete on public.materias from authenticated;
revoke insert, update, delete on public.configuracion from authenticated;
revoke insert, update, delete on public.guia_asignaciones from authenticated;
revoke insert, update, delete on public.alertas from authenticated;
revoke insert, update, delete on public.metricas_diarias from authenticated;
revoke insert, update, delete on public.permisos from authenticated;
revoke insert, update, delete on public.pendientes from authenticated;
revoke insert, update, delete on public.usuarios from authenticated;
revoke update, delete on public.interacciones from authenticated;

grant select on public.colegios to authenticated;
grant select on public.usuarios to authenticated;
grant select on public.materias to authenticated;
grant select on public.interacciones to authenticated;
grant select on public.pendientes to authenticated;
grant select on public.metricas_diarias to authenticated;
grant select on public.permisos to authenticated;
grant select on public.configuracion to authenticated;
grant select on public.guia_asignaciones to authenticated;
grant select on public.alertas to authenticated;
grant insert on public.interacciones to authenticated;
grant update (grado, ultimo_acceso) on public.usuarios to authenticated;
grant update (op_estado, op_evaluada_en, op_respuesta_alumno) on public.interacciones to authenticated;

drop policy if exists "usuarios_ver_propio" on public.usuarios;
drop policy if exists "interacciones_ver_propias" on public.interacciones;
drop policy if exists "interacciones_insertar" on public.interacciones;
drop policy if exists "materias_ver_activas" on public.materias;
drop policy if exists "colegios_ver_activos" on public.colegios;
drop policy if exists "configuracion_ver_colegio" on public.configuracion;
drop policy if exists "guia_asignaciones_ver_colegio" on public.guia_asignaciones;
drop policy if exists "alertas_ver_staff_colegio" on public.alertas;
drop policy if exists "alertas_insertar_alumno" on public.alertas;
drop policy if exists "alertas_actualizar_staff_colegio" on public.alertas;

drop policy if exists "colegios_select_scope" on public.colegios;
drop policy if exists "usuarios_select_scope" on public.usuarios;
drop policy if exists "usuarios_update_self_learning_fields" on public.usuarios;
drop policy if exists "materias_select_scope" on public.materias;
drop policy if exists "interacciones_select_scope" on public.interacciones;
drop policy if exists "interacciones_insert_own" on public.interacciones;
drop policy if exists "interacciones_update_own_eval" on public.interacciones;
drop policy if exists "pendientes_select_admin_scope" on public.pendientes;
drop policy if exists "metricas_select_admin_scope" on public.metricas_diarias;
drop policy if exists "permisos_select_scope" on public.permisos;
drop policy if exists "configuracion_select_scope" on public.configuracion;
drop policy if exists "guia_asignaciones_select_scope" on public.guia_asignaciones;
drop policy if exists "alertas_select_staff_scope" on public.alertas;

create policy "colegios_select_scope" on public.colegios
  for select to authenticated
  using (
    public.current_usuario_rol() = 'superadmin'
    or id = public.current_usuario_colegio_id()
  );

create policy "usuarios_select_scope" on public.usuarios
  for select to authenticated
  using (
    id = auth.uid()
    or public.current_usuario_rol() = 'superadmin'
    or (
      public.current_usuario_rol() = 'admin'
      and colegio_id = public.current_usuario_colegio_id()
    )
    or (
      rol = 'alumno'
      and public.can_access_alumno(id)
    )
  );

create policy "usuarios_update_self_learning_fields" on public.usuarios
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "materias_select_scope" on public.materias
  for select to authenticated
  using (
    public.current_usuario_rol() = 'superadmin'
    or (
      activa = true
      and colegio_id = public.current_usuario_colegio_id()
    )
  );

create policy "interacciones_select_scope" on public.interacciones
  for select to authenticated
  using (
    usuario_id = auth.uid()
    or public.current_usuario_rol() = 'superadmin'
    or (
      public.current_usuario_rol() = 'admin'
      and colegio_id = public.current_usuario_colegio_id()
    )
    or (
      public.current_usuario_rol() in ('maestro', 'director')
      and colegio_id = public.current_usuario_colegio_id()
      and public.can_access_alumno(usuario_id)
    )
  );

create policy "interacciones_insert_own" on public.interacciones
  for insert to authenticated
  with check (
    usuario_id = auth.uid()
    and (
      colegio_id is null
      or colegio_id = public.current_usuario_colegio_id()
    )
  );

create policy "interacciones_update_own_eval" on public.interacciones
  for update to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

create policy "pendientes_select_admin_scope" on public.pendientes
  for select to authenticated
  using (
    public.current_usuario_rol() = 'superadmin'
    or (
      public.current_usuario_rol() = 'admin'
      and colegio_id = public.current_usuario_colegio_id()
    )
  );

create policy "metricas_select_admin_scope" on public.metricas_diarias
  for select to authenticated
  using (
    public.current_usuario_rol() = 'superadmin'
    or (
      public.current_usuario_rol() = 'admin'
      and colegio_id = public.current_usuario_colegio_id()
    )
  );

create policy "permisos_select_scope" on public.permisos
  for select to authenticated
  using (
    usuario_id = auth.uid()
    or public.current_usuario_rol() = 'superadmin'
    or (
      public.current_usuario_rol() = 'admin'
      and exists (
        select 1
          from public.usuarios u
         where u.id = permisos.usuario_id
           and u.colegio_id = public.current_usuario_colegio_id()
      )
    )
  );

create policy "configuracion_select_scope" on public.configuracion
  for select to authenticated
  using (
    public.current_usuario_rol() = 'superadmin'
    or (
      public.current_usuario_rol() = 'admin'
      and colegio_id = public.current_usuario_colegio_id()
    )
  );

create policy "guia_asignaciones_select_scope" on public.guia_asignaciones
  for select to authenticated
  using (
    public.current_usuario_rol() = 'superadmin'
    or guia_id = auth.uid()
    or (
      public.current_usuario_rol() = 'admin'
      and colegio_id = public.current_usuario_colegio_id()
    )
  );

create policy "alertas_select_staff_scope" on public.alertas
  for select to authenticated
  using (
    public.current_usuario_rol() = 'superadmin'
    or (
      public.current_usuario_rol() = 'admin'
      and colegio_id = public.current_usuario_colegio_id()
    )
    or (
      public.current_usuario_rol() in ('maestro', 'director')
      and colegio_id = public.current_usuario_colegio_id()
      and public.can_access_alumno(alumno_id)
    )
  );

commit;
