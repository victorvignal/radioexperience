-- RadioeXperience RAG Schema (PostgreSQL / Supabase compatible)
-- Base canônica (livros) + camada incremental (artigos/guidelines)

create extension if not exists pgcrypto;

-- 1. Fontes cadastradas
create table if not exists sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('pubmed','europepmc','rss','guideline_site','manual','book_import')),
  base_url text,
  query_template text,
  specialty text,
  language text default 'pt-BR',
  priority integer default 50,
  is_active boolean default true,
  last_checked_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Itens descobertos pelo pipeline antes da ingestão final
create table if not exists article_candidates (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references sources(id) on delete set null,
  external_id text,
  doi text,
  pmid text,
  title text not null,
  abstract text,
  authors jsonb,
  journal text,
  url text,
  published_at date,
  language text,
  specialty_guess text,
  modality_guess text,
  document_type_guess text,
  relevance_score numeric(5,4),
  evidence_level text,
  inclusion_reason text,
  risk_flags jsonb default '[]'::jsonb,
  raw_payload jsonb,
  status text not null default 'new' check (status in ('new','scored','approved','rejected','duplicate','downloaded','error')),
  discovered_at timestamptz default now(),
  reviewed_at timestamptz,
  review_notes text,
  unique (doi),
  unique (pmid)
);

create index if not exists idx_article_candidates_status on article_candidates(status);
create index if not exists idx_article_candidates_published_at on article_candidates(published_at desc);
create index if not exists idx_article_candidates_specialty on article_candidates(specialty_guess);

-- 3. Documentos oficiais da base final
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references article_candidates(id) on delete set null,
  source_id uuid references sources(id) on delete set null,
  title text not null,
  canonical_url text,
  doi text,
  pmid text,
  isbn text,
  authors jsonb,
  publisher text,
  edition text,
  language text default 'pt-BR',
  specialty text,
  modality text,
  document_type text not null check (document_type in ('book','book_chapter','article','guideline','review','case_report','internal_material')),
  source_tier text not null check (source_tier in ('canonical','update')),
  evidence_level text,
  confidence_weight numeric(6,4) default 0.8000,
  published_at date,
  version_label text,
  supersedes_document_id uuid references documents(id) on delete set null,
  license_status text,
  status text not null default 'active' check (status in ('active','archived','superseded','error')),
  metadata jsonb default '{}'::jsonb,
  ingested_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_documents_type_tier on documents(document_type, source_tier);
create index if not exists idx_documents_specialty on documents(specialty);
create index if not exists idx_documents_published_at on documents(published_at desc);
create index if not exists idx_documents_status on documents(status);

-- 4. Estrutura lógica do documento (capítulos/seções)
create table if not exists document_sections (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  parent_section_id uuid references document_sections(id) on delete cascade,
  chapter_title text,
  section_title text,
  page_start integer,
  page_end integer,
  section_order integer,
  raw_text text,
  cleaned_text text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_document_sections_document_id on document_sections(document_id);

-- 5. Conteúdo bruto/limpo por documento
create table if not exists document_contents (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  content_type text not null check (content_type in ('abstract','full_text','pdf_extracted','manual_import')),
  raw_text text,
  cleaned_text text,
  parser_version text,
  created_at timestamptz default now()
);

create index if not exists idx_document_contents_document_id on document_contents(document_id);

-- 6. Chunks que alimentam o RAG
create table if not exists document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  section_id uuid references document_sections(id) on delete set null,
  chunk_index integer not null,
  chunk_type text,
  chapter_title text,
  section_title text,
  page_ref text,
  text text not null,
  token_count integer,
  specialty text,
  modality text,
  document_type text,
  source_tier text,
  evidence_level text,
  confidence_weight numeric(6,4) default 0.8000,
  published_at date,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  unique(document_id, chunk_index)
);

create index if not exists idx_document_chunks_document_id on document_chunks(document_id);
create index if not exists idx_document_chunks_specialty on document_chunks(specialty);
create index if not exists idx_document_chunks_type_tier on document_chunks(document_type, source_tier);

-- 7. Logs de execução do pipeline
create table if not exists ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null check (run_type in ('book_import','weekly_discovery','weekly_ingestion','reindex')),
  source_id uuid references sources(id) on delete set null,
  status text not null check (status in ('running','completed','failed','partial')),
  started_at timestamptz default now(),
  finished_at timestamptz,
  documents_found integer default 0,
  documents_approved integer default 0,
  documents_rejected integer default 0,
  documents_indexed integer default 0,
  notes text,
  errors_json jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_ingestion_runs_started_at on ingestion_runs(started_at desc);

-- 8. Fila de revisão humana/opcional
create table if not exists review_queue (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references article_candidates(id) on delete cascade,
  priority integer default 50,
  decision text check (decision in ('approved','rejected','pending')) default 'pending',
  reviewed_by text,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz default now()
);

create index if not exists idx_review_queue_decision on review_queue(decision);

-- 9. Catálogo inicial dos livros físicos/lógicos antes da ingestão
create table if not exists book_inventory (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  file_path text,
  authors jsonb,
  publisher text,
  edition text,
  year integer,
  language text default 'pt-BR',
  specialty text,
  modality text,
  isbn text,
  license_status text,
  import_status text default 'pending' check (import_status in ('pending','processing','imported','error')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_book_inventory_status on book_inventory(import_status);

-- Observação:
-- embeddings e índice vetorial ficam preferencialmente no Qdrant.
-- document_chunks é a fonte canônica do payload para o vetor.
