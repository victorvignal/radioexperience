-- Vacancy sync support for escala uploads
-- Run in Supabase SQL editor before deploying the new upload flow.

create extension if not exists pgcrypto;

alter table public.shifts
  add column if not exists identity_key text,
  add column if not exists is_active boolean not null default true,
  add column if not exists last_seen_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists source_batch_id uuid;

update public.shifts
set
  specialty = coalesce(nullif(trim(specialty), ''), 'USG'),
  identity_key = encode(
    digest(
      upper(trim(coalesce(location, ''))) || '|' ||
      upper(trim(coalesce(room, ''))) || '|' ||
      upper(trim(coalesce(day_of_week, ''))) || '|' ||
      replace(replace(replace(replace(upper(trim(coalesce(time_slot, ''))), ' ÀS ', '-'), ' AS ', '-'), ' ', ''), '–', '-') || '|' ||
      upper(trim(coalesce(specialty, 'USG'))),
      'sha256'
    ),
    'hex'
  ),
  last_seen_at = coalesce(last_seen_at, updated_at, created_at, now()),
  is_active = coalesce(is_active, true)
where identity_key is null
   or last_seen_at is null
   or is_active is null
   or specialty is null
   or specialty = '';

create index if not exists idx_shifts_identity_key on public.shifts(identity_key);
create index if not exists idx_shifts_active on public.shifts(is_active);
create index if not exists idx_shifts_last_seen_at on public.shifts(last_seen_at desc);

create unique index if not exists uq_shifts_identity_key_active
  on public.shifts(identity_key)
  where is_active = true;
