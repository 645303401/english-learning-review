create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public)
values ('word-captures', 'word-captures', false)
on conflict (id) do nothing;

create table if not exists public.capture_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  storage_path text not null,
  source_name text,
  status text not null default 'uploaded',
  ocr_text text,
  extracted_words jsonb not null default '[]'::jsonb,
  error text
);

create table if not exists public.word_candidates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  word_key text not null unique,
  word text not null,
  pronunciation text,
  meaning text,
  part_of_speech text,
  example text,
  collocations text,
  theme text,
  difficulty text,
  error_point text,
  source_capture_id uuid references public.capture_items(id),
  status text not null default 'pending'
);

alter table public.capture_items enable row level security;
alter table public.word_candidates enable row level security;

create policy "public can create capture records" on public.capture_items for insert to anon with check (true);
create policy "public can read own pending queue by id" on public.capture_items for select to anon using (true);
create policy "public can read pending candidates" on public.word_candidates for select to anon using (status = 'pending');

create policy "public can upload capture images" on storage.objects for insert to anon with check (bucket_id = 'word-captures');
