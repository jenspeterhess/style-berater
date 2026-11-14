import { useMutation } from "@tanstack/react-query";
import { callApi } from "./api";
import { ageOf, type Person } from "./people";
import type { Advice, Item, OccasionId } from "@shared/wardrobe";

type Args = { person: Person; occasion: string; items: Item[]; wishlist: Item[]; exclude?: string[][] };

/** Den Styling-Experten um einen Look für einen Anlass bitten. */
export function useExpert() {
  return useMutation({
    mutationFn: ({ person, occasion, items, wishlist, exclude }: Args) =>
      callApi<Advice>("/api/expert", {
        person: { name: person.name, age: ageOf(person), audience: person.audience },
        occasion,
        items: items.map(({ id, name, category, colors, style, season }) => ({ id, name, category, colors, style, season })),
        wishlist: wishlist.map((i) => i.name).slice(0, 60),
        exclude,
      }),
  });
}

/** Die Empfehlung des Tages bleibt je Person und Anlass auf dem Gerät gespeichert. */
export type StoredAdvice = { day: string; advice: Advice; seen: string[][] };
const today = () => new Date().toISOString().slice(0, 10);
const key = (personId: string, occasion: OccasionId) => `experte-${personId}-${occasion}`;

export function loadAdvice(personId: string | undefined, occasion: OccasionId, ids: Set<string>): StoredAdvice | null {
  if (!personId) return null;
  try {
    const s = JSON.parse(localStorage.getItem(key(personId, occasion)) ?? "null") as StoredAdvice | null;
    // Nur die Empfehlung von heute zählt – und nur, wenn es alle Teile noch gibt.
    return s && s.day === today() && s.advice.item_ids.every((id) => ids.has(id)) ? s : null;
  } catch {
    return null;
  }
}
export function saveAdvice(personId: string, occasion: OccasionId, advice: Advice, seen: string[][]): StoredAdvice {
  const stored = { day: today(), advice, seen: [...seen, advice.item_ids].slice(-8) };
  try {
    localStorage.setItem(key(personId, occasion), JSON.stringify(stored));
  } catch {
    /* ohne Speicher gilt die Empfehlung nur bis zum Neuladen */
  }
  return stored;
}
