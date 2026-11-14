import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { callApi } from "./api";
import { supabase } from "./supabase";
import type { ShopTips } from "@shared/wardrobe";

const BUCKET = "wardrobe";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function pathOf(id: string) {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Bitte melde dich an.");
  return `${data.session.user.id}/tips-${id}.json`;
}

async function load(id: string): Promise<ShopTips | null> {
  const { data } = await supabase.storage.from(BUCKET).download(await pathOf(id));
  if (!data) return null;
  try {
    return JSON.parse(await data.text()) as ShopTips;
  } catch {
    return null;
  }
}

/** Gespeicherte Kauftipps zu einem Teil (oder null, wenn noch nie gesucht wurde). */
export function useTips(id: string) {
  return useQuery({ queryKey: ["tips", id], queryFn: async () => ((await load(id))?.status === "done" ? load(id) : null), staleTime: Infinity, retry: false });
}

export type TipQuery = { id: string; name: string; colors: string[]; note?: string; audience?: string | null; age?: number | null };

/** Startet die Websuche im Hintergrund und wartet auf das Ergebnis. */
export function useSearchTips() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (q: TipQuery) => {
      // Altes Ergebnis entfernen, damit beim Warten nur das neue zählt.
      await supabase.storage.from(BUCKET).remove([await pathOf(q.id)]);
      await callApi("/api/shop-background", q);
      const started = Date.now();
      while (Date.now() - started < 3 * 60_000) {
        await wait(2500);
        const res = await load(q.id);
        if (res?.status === "done") return res;
        if (res?.status === "error") throw new Error(res.error ?? "Die Suche hat gerade nicht geklappt. Bitte versuche es erneut.");
      }
      throw new Error("Die Suche dauert ungewöhnlich lange. Bitte versuche es später erneut.");
    },
    onSuccess: (res, q) => qc.setQueryData(["tips", q.id], res),
  });
}
