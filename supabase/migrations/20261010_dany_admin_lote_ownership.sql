-- CrediMóvil: promoción segura del usuario DANY y aislamiento por propietario de lotes.
-- Ejecutar en Supabase SQL Editor ANTES de desplegar el código que depende de estas columnas.
-- Las filas antiguas de lotes quedan con owner_username NULL porque la versión anterior
-- no guardaba quién las creó. Así no se asignan por error datos de otro asesor a DANY.
-- Los lotes sin propietario solo serán administrables por cuentas admin hasta asignar propietario.

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

-- Ensure there is exactly one account whose login username is DANY/dany.
do $$
declare
  dany_count integer;
begin
  select count(*) into dany_count
  from public.asesores
  where lower(username) = 'dany';

  if dany_count = 0 then
    raise exception 'No se encontró un usuario asesor con username DANY. Verifica el nombre de usuario antes de ejecutar esta migración.';
  end if;

  if dany_count > 1 then
    raise exception 'Hay más de un usuario cuyo username coincide con DANY ignorando mayúsculas. Corrige el duplicado antes de ejecutar esta migración.';
  end if;
end $$;

-- Normalize the login name so it matches the server's normalized usernames.
update public.asesores
set username = lower(username)
where lower(username) = 'dany';

-- Promote DANY to admin. Existing password_hash remains unchanged.
update public.asesores
set rol = 'admin'
where username = 'dany';

commit;

-- Verify the result after execution:
select id, username, nombre, rol, activo
from public.asesores
where lower(username) = 'dany';

select id, nombre, owner_username, parent_lote_id, created_at
from public.lotes
order by created_at;
