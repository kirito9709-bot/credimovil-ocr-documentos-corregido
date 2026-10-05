-- CrediMóvil: folios únicos y seguros
-- Ejecuta este bloque UNA SOLA VEZ en Supabase > SQL Editor.

create sequence if not exists public.credimovil_folio_seq
  minvalue 1001
  start 1001;

do $$
declare
  max_num bigint;
begin
  select coalesce(
    max((substring(folio from 'EXP-2026-(\d+)$'))::bigint),
    1000
  )
  into max_num
  from public.expedientes;

  if max_num < 1000 then
    max_num := 1000;
  end if;

  perform setval('public.credimovil_folio_seq', max_num, true);
end
$$;

create or replace function public.next_credimovil_folio()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_number bigint;
begin
  next_number := nextval('public.credimovil_folio_seq');
  return 'EXP-' || to_char(current_date, 'YYYY') || '-' || next_number::text;
end;
$$;

revoke all on function public.next_credimovil_folio() from public;
grant execute on function public.next_credimovil_folio() to service_role;

-- Garantía adicional: jamás puede existir el mismo folio dos veces.
create unique index if not exists expedientes_folio_unique_idx
  on public.expedientes(folio);
