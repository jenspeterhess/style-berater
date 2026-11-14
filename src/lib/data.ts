import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { removeImages } from "./storage";
import type { ImportRecord, Item, ItemStatus, Mode, Outfit } from "@shared/wardrobe";

export type Profile = { id: string; avatar_path: string | null; selfie_path: string | null; body_path: string | null; consent_at: string | null };

function must<T>(res: { data: T | null; error: unknown }, msg = "Daten konnten nicht geladen werden.") {
  if (res.error || res.data == null) throw new Error(msg);
  return res.data;
}

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const res = await supabase.from("profiles").select("id,avatar_path,selfie_path,body_path,consent_at").eq("id", userId!).maybeSingle();
      if (res.error) throw new Error("Profil konnte nicht geladen werden.");
      return (res.data as Profile | null) ?? { id: userId!, avatar_path: null, selfie_path: null, body_path: null, consent_at: null };
    },
  });
}

/** Alle Teile des Kontos. Schrank, Wunschliste und Eingang filtern daraus – so bleibt alles nach einem Tippen sofort stimmig. */
export function useItems() {
  return useQuery({
    queryKey: ["items"],
    queryFn: async () => must(await supabase.from("items").select("*").order("created_at", { ascending: false })) as Item[],
  });
}
export const byStatus = (items: Item[] | undefined, status: ItemStatus) => (items ?? []).filter((i) => i.status === status);
/**
 * Teile einer Person in einem Status. Der Eingang ist gemeinsam, deshalb zählt dort die Person nicht.
 * Teile ohne Zuordnung (aus der Zeit vor den zwei Schränken) erscheinen bei allen.
 */
export const ofPerson = (items: Item[] | undefined, personId: string | null | undefined, status: ItemStatus) =>
  byStatus(items, status).filter((i) => status === "inbox" || !i.person_id || i.person_id === personId);
/** Für die Anprobe taugen nur Teile im Schrank der Person, die ein Bild haben. */
export const wearable = (items: Item[] | undefined, personId?: string | null) => ofPerson(items, personId, "wardrobe").filter((i) => i.cutout_path ?? i.original_path);
export const imagePath = (item: Pick<Item, "cutout_path" | "original_path">) => item.cutout_path ?? item.original_path;

export function useImports() {
  return useQuery({
    queryKey: ["imports"],
    queryFn: async () => must(await supabase.from("imports").select("id,title,content,store,purchase_date,total,currency,created_at").order("created_at", { ascending: false })) as ImportRecord[],
  });
}

export function useOutfits() {
  return useQuery({
    queryKey: ["outfits"],
    queryFn: async () => must(await supabase.from("outfits").select("*").order("created_at", { ascending: false })) as Outfit[],
  });
}

export function useTryonCache(key: string | null) {
  return useQuery({
    queryKey: ["tryon", key],
    enabled: !!key,
    staleTime: Infinity,
    queryFn: async () => {
      const res = await supabase.from("tryon_cache").select("image_path").eq("combo_key", key!).maybeSingle();
      return (res.data?.image_path as string | undefined) ?? null;
    },
  });
}

const patchItems = (qc: QueryClient, fn: (items: Item[]) => Item[]) => qc.setQueryData<Item[]>(["items"], (old) => (old ? fn(old) : old));

/** Angaben eines Teils ändern. Die Oberfläche reagiert sofort; bei einem Fehler wird zurückgerollt. */
export function useUpdateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Item> }) => {
      const { error } = await supabase.from("items").update(patch).eq("id", id);
      if (error) throw new Error("Die Änderung konnte nicht gespeichert werden.");
    },
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: ["items"] });
      const before = qc.getQueryData<Item[]>(["items"]);
      patchItems(qc, (items) => items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
      return { before };
    },
    onError: (_e, _v, ctx) => ctx?.before && qc.setQueryData(["items"], ctx.before),
    onSettled: () => qc.invalidateQueries({ queryKey: ["items"] }),
  });
}

export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: Item) => {
      const { error } = await supabase.from("items").delete().eq("id", item.id);
      if (error) throw new Error("Das Teil konnte nicht gelöscht werden.");
      await removeImages([item.original_path, item.cutout_path]);
    },
    onSuccess: (_d, item) => patchItems(qc, (items) => items.filter((i) => i.id !== item.id)),
    onSettled: () => qc.invalidateQueries({ queryKey: ["items"] }),
  });
}

export function useDeleteImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("imports").delete().eq("id", id);
      if (error) throw new Error("Der Import konnte nicht gelöscht werden.");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["imports"] }),
  });
}

export function useSaveOutfit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (o: { title: string; reason?: string | null; item_ids: string[]; image_path: string | null; mode: Mode; person_id: string | null; occasion?: string | null }) =>
      must(await supabase.from("outfits").insert(o).select().single(), "Der Look konnte nicht gespeichert werden.") as Outfit,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["outfits"] }),
  });
}
export function useUpdateOutfit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Outfit> }) => {
      const { error } = await supabase.from("outfits").update(patch).eq("id", id);
      if (error) throw new Error("Die Änderung konnte nicht gespeichert werden.");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["outfits"] }),
  });
}
export function useDeleteOutfit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("outfits").delete().eq("id", id);
      if (error) throw new Error("Der Look konnte nicht gelöscht werden.");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["outfits"] }),
  });
}
