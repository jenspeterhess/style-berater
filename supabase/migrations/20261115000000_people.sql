-- Zwei Kleiderschränke in einem Konto: Personen (z. B. Katharina und Jens-Peter) mit eigenem Schrank,
-- eigenem Avatar und eigenem Lookbook. Teile ohne Person liegen im gemeinsamen Eingang.

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  birth_year int check (birth_year between 1900 and 2100),
  audience text check (audience in ('damen', 'herren', 'kinder', 'unisex')),
  avatar_path text,
  selfie_path text,
  body_path text,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.people enable row level security;
drop policy if exists "own people" on public.people;
create policy "own people" on public.people for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.people to authenticated;
grant all on public.people to service_role;

-- Zielgruppe (falls das frühere Skript noch nicht gelaufen ist), Besitzer und Notiz je Teil.
alter table public.items add column if not exists audience text check (audience in ('damen', 'herren', 'kinder', 'unisex'));
alter table public.items add column if not exists person_id uuid references public.people (id) on delete set null;
alter table public.items add column if not exists note text;

-- Looks gehören einer Person, haben einen Anlass und merken sich, wann sie zuletzt getragen wurden.
alter table public.outfits add column if not exists person_id uuid references public.people (id) on delete cascade;
alter table public.outfits add column if not exists occasion text;
alter table public.outfits add column if not exists last_worn date;

create index if not exists items_person on public.items (person_id);
create index if not exists outfits_person on public.outfits (person_id);
