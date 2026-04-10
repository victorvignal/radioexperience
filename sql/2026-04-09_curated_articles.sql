-- Editorial queue for curated external articles indexed by ARIA.
create extension if not exists pgcrypto;

create table if not exists public.curated_articles (
  id uuid primary key default gen_random_uuid(),
  source_url text not null unique,
  title text not null,
  summary text,
  specialty text,
  source text,
  indexed_at timestamptz not null default now(),
  published_to_feed_at timestamptz,
  status text not null default 'indexed' check (status in ('indexed', 'published', 'skipped')),
  qdrant_ref text,
  chunk_count integer,
  feed_post_id uuid references public.posts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_curated_articles_status on public.curated_articles(status);
create index if not exists idx_curated_articles_indexed_at on public.curated_articles(indexed_at asc);
create index if not exists idx_curated_articles_published_to_feed_at on public.curated_articles(published_to_feed_at desc);

create or replace function public.set_curated_articles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_curated_articles_updated_at on public.curated_articles;
create trigger trg_curated_articles_updated_at
before update on public.curated_articles
for each row
execute function public.set_curated_articles_updated_at();

alter table public.curated_articles enable row level security;

create policy "Service role manages curated articles" on public.curated_articles
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
