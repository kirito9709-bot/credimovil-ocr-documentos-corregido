-- CrediMóvil OCR 2.0
-- Ejecutar manualmente en Supabase SQL Editor.

create table if not exists public.ocr_jobs (
  id uuid primary key default gen_random_uuid(),
  expediente_id uuid not null references public.expedientes(id) on delete cascade,
  tipos jsonb not null default '[]'::jsonb,
  estado text not null default 'PENDIENTE' check (estado in ('PENDIENTE','PROCESANDO','COMPLETADO','REVISAR','ERROR')),
  progreso integer not null default 0 check (progreso >= 0 and progreso <= 100),
  proveedor text not null default '',
  resumen jsonb not null default '{}'::jsonb,
  resultado jsonb not null default '{}'::jsonb,
  error text not null default '',
  solicitado_por text not null default '',
  intentos integer not null default 0,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists ocr_jobs_expediente_idx on public.ocr_jobs(expediente_id, created_at desc);
create index if not exists ocr_jobs_estado_idx on public.ocr_jobs(estado, created_at);
alter table public.ocr_jobs enable row level security;

create or replace function public.touch_ocr_job_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists ocr_jobs_touch_updated_at on public.ocr_jobs;
create trigger ocr_jobs_touch_updated_at before update on public.ocr_jobs
for each row execute function public.touch_ocr_job_updated_at();

create extension if not exists pgmq;
-- En Supabase Dashboard > Queues crea una cola llamada credimovil-ocr.
