-- Style Berater: Datenmodell. Alle Tabellen sind per Row Level Security auf das eigene Konto beschränkt.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  avatar_path text,
  selfie_path text,
  body_path text,
  consent_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  content text not null,
  store text,
  purchase_date date,
  total numeric(10, 2),
  currency text,
  created_at timestamptz not null default now()
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  status text not null default 'wardrobe' check (status in ('inbox', 'wardrobe', 'wishlist')),
  source text not null default 'photo' check (source in ('photo', 'import')),
  name text not null,
  category text not null check (category in ('jacke', 'oberteil', 'hose', 'rock_kleid', 'schuhe', 'accessoire')),
  colors text[] not null default '{}',
  style text not null default 'casual',
  season text not null default 'ganzjährig',
  original_path text,
  cutout_path text,
  brand text,
  store text,
  price numeric(10, 2),
  currency text,
  purchase_date date,
  import_id uuid references public.imports (id) on delete set null,
  created_at timestamptz not null default now()
);
create index items_user_status on public.items (user_id, status, created_at desc);

create table public.outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  reason text,
  item_ids uuid[] not null,
  image_path text,
  mode text not null default 'quality',
  created_at timestamptz not null default now()
);

create table public.tryon_cache (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  combo_key text not null,
  image_path text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, combo_key)
);

-- Lang laufende KI-Bildaufträge. Der Browser legt den Auftrag an, die Server-Funktion trägt das Ergebnis ein.
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('avatar', 'tryon', 'beautify')),
  status text not null default 'pending' check (status in ('pending', 'done', 'error')),
  input jsonb not null default '{}',
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index jobs_user on public.jobs (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.imports enable row level security;
alter table public.items enable row level security;
alter table public.outfits enable row level security;
alter table public.tryon_cache enable row level security;
alter table public.jobs enable row level security;

create policy "own profile" on public.profiles for all to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "own imports" on public.imports for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own items" on public.items for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own outfits" on public.outfits for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "read own cache" on public.tryon_cache for select to authenticated using (user_id = auth.uid());
create policy "read own jobs" on public.jobs for select to authenticated using (user_id = auth.uid());
-- Aufträge darf man nur im Zustand "pending" anlegen; Ergebnisse schreibt ausschließlich der Server.
create policy "create own jobs" on public.jobs for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending' and result is null);

-- Privater Bildspeicher: jede Person sieht nur den Ordner mit ihrer eigenen Konto-ID.
insert into storage.buckets (id, name, public) values ('wardrobe', 'wardrobe', false) on conflict (id) do nothing;
create policy "own files read" on storage.objects for select to authenticated
  using (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own files insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own files update" on storage.objects for update to authenticated
  using (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);

-- Zugriffsrechte ausdrücklich vergeben, damit die App unabhängig von der Projekt-Einstellung
-- "Neue Tabellen automatisch anzeigen" funktioniert. Was ein Konto sehen darf, regeln weiterhin die Policies oben.
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on public.profiles, public.imports, public.items, public.outfits to authenticated;
grant select on public.tryon_cache to authenticated;
grant select, insert on public.jobs to authenticated;
grant all on public.profiles, public.imports, public.items, public.outfits, public.tryon_cache, public.jobs to service_role;
