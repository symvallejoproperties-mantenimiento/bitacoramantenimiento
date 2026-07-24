-- Bitácora Digital de Mantenimiento · Vallejo Properties
-- Ejecutar una sola vez en Supabase > Editor SQL.

create sequence if not exists public.bitacora_folio_seq start 1;

create table if not exists public.bitacoras (
  id uuid primary key,
  folio text not null unique default (
    'VP-' || lpad(nextval('public.bitacora_folio_seq')::text, 6, '0')
  ),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_state (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists bitacoras_created_at_idx
  on public.bitacoras (created_at desc);

alter table public.bitacoras enable row level security;
alter table public.app_state enable row level security;

create policy "bitacoras_lectura"
  on public.bitacoras for select to anon using (true);
create policy "bitacoras_creacion"
  on public.bitacoras for insert to anon with check (true);
create policy "bitacoras_actualizacion"
  on public.bitacoras for update to anon using (true) with check (true);
create policy "bitacoras_eliminacion"
  on public.bitacoras for delete to anon using (true);

create policy "estado_lectura"
  on public.app_state for select to anon using (true);
create policy "estado_creacion"
  on public.app_state for insert to anon with check (true);
create policy "estado_actualizacion"
  on public.app_state for update to anon using (true) with check (true);

grant usage on schema public to anon;
grant select, insert, update, delete on public.bitacoras to anon;
grant select, insert, update on public.app_state to anon;
grant usage, select on sequence public.bitacora_folio_seq to anon;
