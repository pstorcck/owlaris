-- ================================================
-- OWLARIS - Script de base de datos
-- Ejecutar en Supabase > SQL Editor
-- ================================================

-- 1. COLEGIOS
create table if not exists colegios (
  id                uuid primary key default gen_random_uuid(),
  nombre            text not null,
  slug              text not null unique,
  color_primario    text default '#6C3FC5',
  color_secundario  text default '#4ECDC4',
  sharepoint_folder text,
  activo            boolean default true,
  creado_en         timestamptz default now()
);

-- 2. USUARIOS (extiende auth.users de Supabase)
create table if not exists usuarios (
  id               uuid primary key references auth.users(id) on delete cascade,
  colegio_id       uuid references colegios(id),
  nombre_completo  text not null,
  email            text not null,
  rol              text not null check (rol in ('alumno','maestro','padre','admin','superadmin')),
  grado            text,
  activo           boolean default true,
  ultimo_acceso    timestamptz,
  creado_en        timestamptz default now()
);

alter table usuarios drop constraint if exists usuarios_rol_check;
alter table usuarios add constraint usuarios_rol_check
  check (rol in ('alumno','maestro','padre','admin','superadmin'));

-- 3. MATERIAS
create table if not exists materias (
  id          uuid primary key default gen_random_uuid(),
  colegio_id  uuid references colegios(id) on delete cascade,
  nombre      text not null,
  slug        text not null,
  activa      boolean default true,
  creado_en   timestamptz default now()
);

-- 4. INTERACCIONES
create table if not exists interacciones (
  id               uuid primary key default gen_random_uuid(),
  usuario_id       uuid references usuarios(id) on delete cascade,
  colegio_id       uuid references colegios(id),
  materia_id       uuid references materias(id),
  grado            text,
  tema_detectado   text,
  pregunta         text not null,
  respuesta        text not null,
  tokens_usados    integer default 0,
  costo_usd        numeric(10,6) default 0,
  modelo_usado     text default 'gpt-4o-mini',
  documento_fuente text,
  sospecha_copia   boolean default false,
  creado_en        timestamptz default now()
);

-- 5. PENDIENTES (temas sin contenido)
create table if not exists pendientes (
  id               uuid primary key default gen_random_uuid(),
  colegio_id       uuid references colegios(id),
  grado            text not null,
  materia          text not null,
  tema_solicitado  text not null,
  veces_solicitado integer default 1,
  resuelto         boolean default false,
  creado_en        timestamptz default now()
);

-- 6. MÉTRICAS DIARIAS
create table if not exists metricas_diarias (
  id                      uuid primary key default gen_random_uuid(),
  colegio_id              uuid references colegios(id),
  fecha                   date not null,
  total_preguntas         integer default 0,
  costo_total_usd         numeric(10,4) default 0,
  alumnos_activos         integer default 0,
  materia_mas_consultada  text,
  temas_sin_contenido     integer default 0,
  unique(colegio_id, fecha)
);

-- 7. PERMISOS
create table if not exists permisos (
  id                    uuid primary key default gen_random_uuid(),
  usuario_id            uuid references usuarios(id) on delete cascade unique,
  puede_ver_dashboard   boolean default false,
  puede_ver_alumnos     boolean default false,
  puede_editar_materias boolean default false,
  puede_exportar        boolean default false
);

-- 8. CONFIGURACIÓN POR COLEGIO
create table if not exists configuracion (
  id              uuid primary key default gen_random_uuid(),
  colegio_id      uuid references colegios(id) on delete cascade,
  clave           text not null,
  valor           text not null,
  actualizado_en  timestamptz default now(),
  unique(colegio_id, clave)
);

-- 9. ASIGNACIONES DE GUÍAS
create table if not exists guia_asignaciones (
  id          uuid primary key default gen_random_uuid(),
  guia_id     uuid references usuarios(id) on delete cascade,
  colegio_id  uuid references colegios(id) on delete cascade,
  tipo        text not null check (tipo in ('grado','alumno')),
  grado       text,
  alumno_id   uuid references usuarios(id) on delete cascade,
  activo      boolean default true,
  creado_en   timestamptz default now()
);

-- 10. ALERTAS PEDAGÓGICAS
create table if not exists alertas (
  id            uuid primary key default gen_random_uuid(),
  colegio_id    uuid references colegios(id) on delete cascade,
  alumno_id     uuid references usuarios(id) on delete cascade,
  guia_id       uuid references usuarios(id),
  tipo          text not null,
  descripcion   text,
  contexto      text,
  resuelta      boolean default false,
  resuelta_en   timestamptz,
  creado_en     timestamptz default now()
);

alter table interacciones add column if not exists operacion_canonica text;
alter table interacciones add column if not exists op_estado text;
alter table interacciones add column if not exists op_evaluada_en timestamptz;
alter table interacciones add column if not exists op_respuesta_alumno text;
alter table interacciones add column if not exists estado_evaluacion text;
alter table interacciones add column if not exists guard_activado boolean default false;

-- ================================================
-- ÍNDICES para rendimiento
-- ================================================
create index if not exists idx_interacciones_usuario    on interacciones(usuario_id);
create index if not exists idx_interacciones_colegio    on interacciones(colegio_id);
create index if not exists idx_interacciones_fecha      on interacciones(creado_en);
create index if not exists idx_pendientes_colegio       on pendientes(colegio_id);
create index if not exists idx_metricas_colegio_fecha   on metricas_diarias(colegio_id, fecha);
create index if not exists idx_configuracion_colegio    on configuracion(colegio_id);
create index if not exists idx_guia_asignaciones_guia   on guia_asignaciones(guia_id);
create index if not exists idx_guia_asignaciones_alumno on guia_asignaciones(alumno_id);
create index if not exists idx_alertas_colegio          on alertas(colegio_id);
create index if not exists idx_alertas_alumno           on alertas(alumno_id);

-- ================================================
-- TRIGGER: actualizar ultimo_acceso automáticamente
-- ================================================
create or replace function actualizar_ultimo_acceso()
returns trigger as $$
begin
  update usuarios set ultimo_acceso = now() where id = new.usuario_id;
  return new;
end;
$$ language plpgsql;

create or replace trigger trg_ultimo_acceso
  after insert on interacciones
  for each row execute function actualizar_ultimo_acceso();

-- ================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================
alter table colegios      enable row level security;
alter table usuarios      enable row level security;
alter table materias      enable row level security;
alter table interacciones enable row level security;
alter table pendientes    enable row level security;
alter table metricas_diarias enable row level security;
alter table configuracion enable row level security;
alter table guia_asignaciones enable row level security;
alter table alertas enable row level security;

-- Políticas: cada usuario solo ve datos de su colegio
create policy "usuarios_ver_propio" on usuarios
  for select using (id = auth.uid());

create policy "interacciones_ver_propias" on interacciones
  for select using (usuario_id = auth.uid());

create policy "interacciones_insertar" on interacciones
  for insert with check (usuario_id = auth.uid());

create policy "materias_ver_activas" on materias
  for select using (activa = true);

create policy "colegios_ver_activos" on colegios
  for select using (activo = true);

create policy "configuracion_ver_colegio" on configuracion
  for select using (
    exists (
      select 1 from usuarios u
      where u.id = auth.uid()
        and (u.rol = 'superadmin' or u.colegio_id = configuracion.colegio_id)
    )
  );

create policy "guia_asignaciones_ver_colegio" on guia_asignaciones
  for select using (
    exists (
      select 1 from usuarios u
      where u.id = auth.uid()
        and (u.rol = 'superadmin' or u.colegio_id = guia_asignaciones.colegio_id)
    )
  );

create policy "alertas_ver_staff_colegio" on alertas
  for select using (
    exists (
      select 1 from usuarios u
      where u.id = auth.uid()
        and u.rol in ('maestro','admin','superadmin')
        and (u.rol = 'superadmin' or u.colegio_id = alertas.colegio_id)
    )
  );

create policy "alertas_insertar_alumno" on alertas
  for insert with check (alumno_id = auth.uid());

create policy "alertas_actualizar_staff_colegio" on alertas
  for update using (
    exists (
      select 1 from usuarios u
      where u.id = auth.uid()
        and u.rol in ('maestro','admin','superadmin')
        and (u.rol = 'superadmin' or u.colegio_id = alertas.colegio_id)
    )
  );

-- ================================================
-- DATOS INICIALES DE PRUEBA
-- ================================================

-- Insertar colegio de prueba
insert into colegios (nombre, slug, sharepoint_folder, color_primario)
values ('Colegio Escolaris', 'escolaris', 'colegio-escolaris', '#6C3FC5')
on conflict (slug) do nothing;
