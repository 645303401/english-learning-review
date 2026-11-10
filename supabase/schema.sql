create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public)
values ('word-captures', 'word-captures', false)
on conflict (id) do nothing;

create table if not exists public.capture_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
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
  user_id uuid not null references auth.users(id),
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

drop policy if exists "authenticated can create capture records" on public.capture_items;
drop policy if exists "authenticated can read capture records" on public.capture_items;
drop policy if exists "authenticated can read pending candidates" on public.word_candidates;
drop policy if exists "authenticated can upload capture images" on storage.objects;

create policy "authenticated can create own capture records" on public.capture_items for insert to authenticated with check (auth.uid() = user_id);
create policy "authenticated can read own capture records" on public.capture_items for select to authenticated using (auth.uid() = user_id);
create policy "authenticated can read own approved candidates" on public.word_candidates for select to authenticated using (auth.uid() = user_id and status = 'approved');
create policy "authenticated can upload own capture images" on storage.objects for insert to authenticated with check (bucket_id = 'word-captures' and (storage.foldername(name))[1] = 'captures' and (storage.foldername(name))[2] = auth.uid()::text);
