import { useEffect, useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import type { AudienceId } from "@shared/wardrobe";

/** Eine Person mit eigenem Kleiderschrank, Avatar und Lookbook innerhalb des gemeinsamen Kontos. */
export type Person = {
  id: string;
  name: string;
  birth_year: number | null;
  audience: AudienceId | null;
  avatar_path: string | null;
  selfie_path: string | null;
  body_path: string | null;
  sort: number;
};

/** Startbelegung für ein neues Konto. Namen und Geburtsjahr lassen sich in den Einstellungen ändern. */
const DEFAULT_PEOPLE = [
  { name: "Katharina", birth_year: 1980, audience: "damen", sort: 0 },
  { name: "Jens-Peter", birth_year: 1965, audience: "herren", sort: 1 },
] as const;

// Wessen Schrank offen ist, merkt sich das Gerät – so bleibt jedes Handy bei „seiner“ Person.
const KEY = "person";
const listeners = new Set<() => void>();
const read = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};
export function setActivePerson(id: string) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* ohne Speicher gilt die Auswahl nur bis zum Neuladen */
  }
  listeners.forEach((l) => l());
}

export function usePeople() {
  return useQuery({
    queryKey: ["people"],
    queryFn: async () => {
      const { data, error } = await supabase.from("people").select("*").order("sort", { ascending: true });
      if (error || !data) throw new Error("Die Kleiderschränke konnten nicht geladen werden.");
      return data as Person[];
    },
  });
}

/** Alle Personen und die, deren Schrank gerade offen ist. */
export function useActivePerson() {
  const people = usePeople().data ?? [];
  const id = useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), read);
  const active = people.find((p) => p.id === id) ?? people[0] ?? null;
  return { people, active };
}

/** Wem ein neues Teil vermutlich gehört: der Person mit passender Zielgruppe, sonst der aktiven. */
export function suggestOwner(people: Person[], active: Person | null, audience: string | null | undefined) {
  return (audience ? people.find((p) => p.audience === audience) : undefined) ?? active ?? people[0] ?? null;
}

export const ageOf = (p: Pick<Person, "birth_year">) => (p.birth_year ? new Date().getFullYear() - p.birth_year : null);

/**
 * Legt beim ersten Start die beiden Kleiderschränke an und ordnet schon vorhandene Teile zu:
 * Herren-Teile der Person mit Zielgruppe „Herren“, alles andere der ersten Person.
 */
export function useEnsurePeople(enabled: boolean) {
  const qc = useQueryClient();
  const people = usePeople();
  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("people").insert([...DEFAULT_PEOPLE]).select();
      if (error || !data?.length) throw new Error("Die Kleiderschränke konnten nicht angelegt werden.");
      const list = (data as Person[]).sort((a, b) => a.sort - b.sort);
      const first = list[0]!;
      const men = list.find((p) => p.audience === "herren");
      if (men) await supabase.from("items").update({ person_id: men.id }).is("person_id", null).in("status", ["wardrobe", "wishlist"]).eq("audience", "herren");
      await supabase.from("items").update({ person_id: first.id }).is("person_id", null).in("status", ["wardrobe", "wishlist"]);
      await supabase.from("outfits").update({ person_id: first.id }).is("person_id", null);
    },
    onSettled: () => Promise.all([qc.invalidateQueries({ queryKey: ["people"] }), qc.invalidateQueries({ queryKey: ["items"] }), qc.invalidateQueries({ queryKey: ["outfits"] })]),
  });
  const needed = enabled && people.isSuccess && people.data.length === 0;
  const { mutate, isIdle } = create;
  useEffect(() => {
    if (needed && isIdle) mutate();
  }, [needed, isIdle, mutate]);
  return { ready: !enabled || (people.isSuccess && people.data.length > 0), failed: create.isError || people.isError };
}

export function useUpdatePerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Person> }) => {
      const { error } = await supabase.from("people").update(patch).eq("id", id);
      if (error) throw new Error("Die Änderung konnte nicht gespeichert werden.");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["people"] }),
  });
}
