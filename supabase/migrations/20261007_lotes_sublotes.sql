-- CrediMóvil: jerarquía de lote principal -> sublotes/sucursales
-- Ejecutar una sola vez en Supabase > SQL Editor.

alter table public.lotes
  add column if not exists parent_lote_id uuid null;

alter table public.lotes
  drop constraint if exists lotes_parent_lote_id_fkey;

alter table public.lotes
  add constraint lotes_parent_lote_id_fkey
  foreign key (parent_lote_id)
  references public.lotes(id)
  on delete set null;

create index if not exists idx_lotes_parent_lote_id
  on public.lotes(parent_lote_id);

alter table public.lotes
  drop constraint if exists lotes_no_self_parent;

alter table public.lotes
  add constraint lotes_no_self_parent
  check (parent_lote_id is null or parent_lote_id <> id);

-- Vista útil para revisar la jerarquía.
create or replace view public.lotes_con_sublotes as
select
  p.id as lote_principal_id,
  p.nombre as lote_principal,
  s.id as sublote_id,
  s.nombre as sublote,
  s.activo,
  s.ciudad,
  s.direccion,
  s.telefono,
  s.correo
from public.lotes p
left join public.lotes s
  on s.parent_lote_id = p.id
where p.parent_lote_id is null
order by p.nombre, s.nombre;