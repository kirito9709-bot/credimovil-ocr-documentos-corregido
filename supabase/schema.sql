-- CrediMóvil / Supabase
-- Run this entire file in Supabase -> SQL Editor -> New query.
-- Sensitive documents remain in a PRIVATE Storage bucket.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  rol text not null default 'asesor' check (rol in ('admin','asesor')),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.lotes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  contacto text not null default '',
  telefono text not null default '',
  correo text not null default '',
  direccion text not null default '',
  ciudad text not null default 'México',
  cuenta_clabe_default text not null default '',
  banco_default text not null default '',
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists lotes_nombre_unique_idx
  on public.lotes (lower(nombre));

create table if not exists public.expedientes (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique,
  pin_fondeo text not null,
  estatus text not null default 'NUEVO',
  lote_id uuid references public.lotes(id) on delete set null,
  asesor_id uuid references public.profiles(id) on delete set null,
  cliente_nombre text not null default '',
  cliente_curp text not null default '',
  cliente_rfc text not null default '',
  telefono text not null default '',
  correo text not null default '',
  auto_marca text not null default '',
  auto_modelo text not null default '',
  auto_ano integer,
  monto_financiar numeric(14,2) not null default 0,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists expedientes_lote_id_idx on public.expedientes(lote_id);
create index if not exists expedientes_asesor_id_idx on public.expedientes(asesor_id);
create index if not exists expedientes_estatus_idx on public.expedientes(estatus);
create index if not exists expedientes_folio_idx on public.expedientes(folio);

create table if not exists public.documentos (
  id uuid primary key default gen_random_uuid(),
  expediente_id uuid not null references public.expedientes(id) on delete cascade,
  tipo text not null,
  nombre text not null,
  storage_path text not null unique,
  mime_type text not null default 'application/octet-stream',
  tamano bigint not null default 0,
  estatus text not null default 'SUBIDO',
  observaciones text not null default '',
  subido_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists documentos_expediente_id_idx on public.documentos(expediente_id);
create index if not exists documentos_estatus_idx on public.documentos(estatus);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists expedientes_touch_updated_at on public.expedientes;
create trigger expedientes_touch_updated_at
before update on public.expedientes
for each row execute function public.touch_updated_at();

-- Lock tables behind RLS. Our server will use the Supabase secret/service key.
alter table public.profiles enable row level security;
alter table public.lotes enable row level security;
alter table public.expedientes enable row level security;
alter table public.documentos enable row level security;

-- Private Storage bucket for INE, comprobantes and other client documents.
insert into storage.buckets (id, name, public)
values ('credimovil-documentos', 'credimovil-documentos', false)
on conflict (id) do update set public = false;

-- No public read policies are created intentionally.
-- The server will generate time-limited signed URLs for private documents.


create table if not exists public.lote_usuarios (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references public.lotes(id) on delete cascade,
  nombre text not null,
  username text not null unique,
  password_hash text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists lote_usuarios_lote_id_idx on public.lote_usuarios(lote_id);
alter table public.lote_usuarios enable row level security;

