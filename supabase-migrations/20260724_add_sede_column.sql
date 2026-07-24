-- Owlaris: columna explícita "sede" en usuarios, en vez de adivinar la sede
-- (Cortijo / Portal Los Álamos / Colegio Montano) desde el prefijo del
-- correo en tiempo de ejecución (detectarSedePorEmail en src/lib/sedes.ts).
--
-- Hallazgo real (2026-07-24): el patrón de correo real tiene muchas
-- variantes/typos que la detección por texto no reconocía de forma
-- confiable (cortijo2019-00353 sin guion, cor-2018-00240, c-2018-00146,
-- p-2024-00104, pla-2025-0014 con un dígito de menos, pla-00101-2026 con
-- el orden invertido, etc.) — diagnóstico confirmado sobre datos reales
-- antes de aplicar este backfill (87 Cortijo, 58 Portal Los Álamos, 42
-- Colegio Montano principal, más 2 typos reclasificados a mano; 61
-- Escolaris + 4 con dominio ajeno quedan en NULL porque la sede no les
-- aplica — no son Colegio Montano).
--
-- Ejecutar una sola vez en Supabase SQL Editor.

alter table usuarios add column if not exists sede text;

update usuarios
set sede = case
  when email ~* '^cortijo[-.]?\d' then 'Cortijo'
  when email ~* '^cor-\d' then 'Cortijo'
  when email ~* '^c-\d{4}-\d+@colegiomontano' then 'Cortijo'
  when email ~* '^pla[-.]?\d' then 'Portal Los Álamos'
  when email ~* '^p-\d{4}-\d+@colegiomontano' then 'Portal Los Álamos'
  when email ilike '%@colegiomontano.edu.gt' then 'Colegio Montano'
  else null
end
where rol = 'alumno';

comment on column usuarios.sede is 'Sede/campus dentro de un colegio con múltiples sedes (ej. Colegio Montano: Cortijo, Portal Los Álamos, o la sede principal). NULL = no aplica (otro colegio) o, para un director/guía, alcance de TODO el colegio sin filtrar por sede.';

-- Hallazgo real (QA en vivo, 2026-07-24): "Colegio Montano Cortijo" y
-- "Colegio Montano Portal Los Álamos" existen como filas SEPARADAS en la
-- tabla colegios (colegio_id distinto de "Colegio Montano"), pero el
-- diseño real es un solo colegio ("Colegio Montano") con sedes internas
-- distinguidas por esta nueva columna. Dos cuentas quedaron apuntando a
-- esas filas separadas por error, dejándolas sin alumnos visibles (ya que
-- casi todos los alumnos reales viven bajo colegio_id = Colegio Montano):
-- la cuenta de maestro/director de Paul Storck, y la alumna Paula Nahomy
-- Garrido Lorenzana. Se corrige su colegio_id para que coincida con el
-- resto de la población real; su sede (Portal Los Álamos, ya detectada
-- arriba) se conserva. Para Paul Storck se deja sede en NULL a propósito:
-- como director, eso significa "todo el colegio", no una sede específica.
update usuarios
set colegio_id = '1ed08641-9611-425f-96da-02a67bf9bc54'
where email = 'pstorck@hotmail.es';

update usuarios
set colegio_id = '1ed08641-9611-425f-96da-02a67bf9bc54'
where email = 'pla-2021-00052@colegiomontano.edu.gt';
