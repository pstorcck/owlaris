-- Owlaris: columna explícita "sede" en usuarios, en vez de adivinar la sede
-- (Cortijo / Portal Los Álamos / Colegio Montano) desde el prefijo del
-- correo en tiempo de ejecución (detectarSedePorEmail en src/lib/sedes.ts),
-- y consolidación de un colegio dividido en 3 filas distintas por error.
--
-- Hallazgo real (2026-07-24): "Colegio Montano Cortijo" y "Colegio Montano
-- Portal Los Álamos" existen como colegio_id SEPARADOS de "Colegio
-- Montano" en la tabla colegios — pero son la MISMA escuela. Diagnóstico
-- confirmado sobre datos reales antes de aplicar este backfill:
--   146 alumnos ya viven bajo colegio_id = Colegio Montano (82 con correo
--     cortijo-, 44 sin prefijo, 20 con correo pla- — el patrón dominante,
--     probablemente el import masivo original).
--   41 alumnos viven bajo los colegio_id separados de Cortijo/Portal Los
--     Álamos (4 y 37 respectivamente) — el formulario de auto-registro
--     (src/app/signup/page.tsx) los ofrecía como colegios independientes.
--   2 anomalías puntuales: correo @colegiomontano.edu.gt bajo colegio_id
--     de Escolaris/eScholaris (error de captura, no un caso real).
-- Se consolida todo bajo un único colegio_id (Colegio Montano) + esta
-- columna para distinguir la sede — que es exactamente el modelo que ya
-- asume el panel de director/guía (api/director/stats/route.ts).
--
-- Ejecutar una sola vez en Supabase SQL Editor.

alter table usuarios add column if not exists sede text;

-- Cualquier usuario con correo @colegiomontano.edu.gt que no esté ya en el
-- colegio_id único de Colegio Montano se consolida aquí — el dominio del
-- correo es la señal confiable de a qué escuela pertenecen realmente,
-- sin importar en qué colegio_id haya quedado su cuenta por error o por
-- el formulario de auto-registro.
update usuarios
set colegio_id = '1ed08641-9611-425f-96da-02a67bf9bc54'
where email ilike '%@colegiomontano.edu.gt'
  and colegio_id <> '1ed08641-9611-425f-96da-02a67bf9bc54';

-- Backfill de sede para todos los alumnos de Colegio Montano, ya
-- consolidados bajo el mismo colegio_id.
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

-- Cuenta de maestro/director de Paul Storck: su correo personal
-- (@hotmail.es) no coincide con el dominio @colegiomontano.edu.gt, así
-- que el UPDATE de consolidación de arriba no lo alcanza — se corrige su
-- colegio_id aquí de forma explícita. Se deja sede en NULL a propósito:
-- como director, eso significa alcance de TODO el colegio, no una sede
-- específica.
update usuarios
set colegio_id = '1ed08641-9611-425f-96da-02a67bf9bc54', sede = null
where email = 'pstorck@hotmail.es';
