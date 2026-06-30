-- Owlaris: agregar rol director y permisos de lectura institucional.
-- Ejecutar una sola vez en Supabase SQL Editor antes de crear usuarios director.

alter table usuarios drop constraint if exists usuarios_rol_check;
alter table usuarios add constraint usuarios_rol_check
  check (rol in ('alumno','maestro','padre','director','admin','superadmin'));

drop policy if exists "alertas_ver_staff_colegio" on alertas;
create policy "alertas_ver_staff_colegio" on alertas
  for select using (
    exists (
      select 1 from usuarios u
      where u.id = auth.uid()
        and u.rol in ('maestro','director','admin','superadmin')
        and (u.rol = 'superadmin' or u.colegio_id = alertas.colegio_id)
    )
  );

drop policy if exists "alertas_actualizar_staff_colegio" on alertas;
create policy "alertas_actualizar_staff_colegio" on alertas
  for update using (
    exists (
      select 1 from usuarios u
      where u.id = auth.uid()
        and u.rol in ('maestro','director','admin','superadmin')
        and (u.rol = 'superadmin' or u.colegio_id = alertas.colegio_id)
    )
  );
