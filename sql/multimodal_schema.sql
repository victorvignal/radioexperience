-- Extensão multimodal do schema base

create table if not exists document_images (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  section_id uuid references document_sections(id) on delete set null,
  page_number integer,
  image_index integer,
  caption text,
  figure_label text,
  file_path text not null,
  mime_type text default 'image/png',
  width integer,
  height integer,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_document_images_document_id on document_images(document_id);
create index if not exists idx_document_images_page_number on document_images(page_number);

create table if not exists image_links (
  id uuid primary key default gen_random_uuid(),
  chunk_id uuid references document_chunks(id) on delete cascade,
  image_id uuid references document_images(id) on delete cascade,
  link_type text default 'figure_reference',
  created_at timestamptz default now()
);

create index if not exists idx_image_links_chunk_id on image_links(chunk_id);
create index if not exists idx_image_links_image_id on image_links(image_id);
