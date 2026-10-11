-- CrediMóvil: migración para roles y aislamiento por propietario de lotes.
-- Ejecutar en Supabase SQL Editor ANTES de desplegar el código que usa estas columnas.
-- IMPORTANTE: el administrador principal puede estar configurado en Render mediante
-- CREDIMOVIL_ADMIN_USER y CREDIMOVIL_ADMIN_PASSWORD. En ese caso NO necesita existir
-- como fila en public.asesores. Esta migración no crea ni cambia contraseñas.
-- Los lotes antiguos quedan con owner_username NULL porque antes no se guardaba
-- quién los creó; así no se atribuyen datos históricos al asesor equivocado.

begin;

alter table public.asesores
  add column if not exists rol text not null default 'asesor';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'asesores_rol_check'
      and conrelid = 'public.asesores'::regclass
  ) then
    alter table public.asesores
      add constraint asesores_rol_check check (rol in ('admin', 'asesor'));
  end if;
end $$;

alter table public.lotes
  add column if not exists owner_username text;

create index if not exists lotes_owner_username_idx
  on public.lotes (lower(owner_username));

-- Si Dany también existe como asesor de base de datos, promuévelo.
-- Si no existe, se conserva el administrador configurado en Render.
do $$
declare
  dany_count integer;
begin
  select count(*) into dany_count
  from public.asesores
  where lower(username) = 'dany';

  if dany_count > 1 then
    raise exception 'Hay más de un usuario cuyo username coincide con DANY ignorando mayúsculas. Corrige el duplicado antes de ejecutar esta migración.';
  elsif dany_count = 1 then
    update public.asesores
    set username = lower(username),
        rol = 'admin'
    where lower(username) = 'dany';
  else
    raise notice 'No existe DANY en public.asesores. Es correcto si el administrador principal está configurado en Render mediante CREDIMOVIL_ADMIN_USER y CREDIMOVIL_ADMIN_PASSWORD.';
  end if;
end $$;

commit;

-- Verificación: devuelve un estado claro aunque Dany no tenga fila en public.asesores.
select case
  when exists (select 1 from public.asesores where lower(username) = 'dany')
    then 'DANY tiene una fila en public.asesores y fue promovido a admin'
  else 'DANY no tiene fila en public.asesores; el administrador debe autenticarse con las variables CREDIMOVIL_ADMIN_USER y CREDIMOVIL_ADMIN_PASSWORD de Render'
end as estado_administrador;

select
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'asesores' and column_name = 'rol'
  ) as columna_rol_creada,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'lotes' and column_name = 'owner_username'
  ) as columna_owner_username_creada;

select id, nombre, owner_username, parent_lote_id, created_at
from public.lotes
order by created_at;
