import { useMutation } from "@tanstack/react-query";
import { callApi } from "./api";
import type { Item, Suggestion } from "@shared/wardrobe";

type Args = { items: Item[]; anchorId?: string; occasion?: string; count: number; exclude?: string[][] };

/** Outfit-Vorschläge aus dem eigenen Schrank holen. */
export function useSuggest() {
  return useMutation({
    mutationFn: async ({ items, ...rest }: Args) =>
      (
        await callApi<{ suggestions: Suggestion[] }>("/api/suggest", {
          items: items.map(({ id, name, category, colors, style, season }) => ({ id, name, category, colors, style, season })),
          ...rest,
        })
      ).suggestions,
  });
}
