-- Zielgruppe eines Teils (Damen, Herren, Kinder, Unisex) – für den Filter in Schrank und Eingang.
alter table public.items
  add column if not exists audience text check (audience in ('damen', 'herren', 'kinder', 'unisex'));
