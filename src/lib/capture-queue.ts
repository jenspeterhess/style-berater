import { useSyncExternalStore } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { errorMessage } from "./api";
import { captureItem, type Stage } from "./pipelines";
import type { Item } from "@shared/wardrobe";

export type Entry = { id: string; file: File; preview: string; stage: Stage; item?: Item; error?: string };

// Die Warteschlange lebt außerhalb der Seite: Fotos werden weiterverarbeitet, auch wenn man kurz woanders hinschaut.
let entries: Entry[] = [];
let working = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const update = (id: string, patch: Partial<Entry>) => {
  entries = entries.map((e) => (e.id === id ? { ...e, ...patch } : e));
  emit();
};

async function work(qc: QueryClient) {
  if (working) return;
  working = true;
  try {
    for (;;) {
      const next = entries.find((e) => !e.item && !e.error);
      if (!next) break;
      try {
        const item = await captureItem(next.file, (stage) => update(next.id, { stage }));
        qc.setQueryData<Item[]>(["items"], (old) => (old ? [item, ...old] : old));
        update(next.id, { item });
      } catch (e) {
        update(next.id, { error: errorMessage(e) });
      }
    }
  } finally {
    working = false;
    void qc.invalidateQueries({ queryKey: ["items"] });
  }
}

export function enqueue(files: File[], qc: QueryClient) {
  const images = files.filter((f) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name));
  entries = [...images.map((file) => ({ id: crypto.randomUUID(), file, preview: URL.createObjectURL(file), stage: { label: "Wartet" } })), ...entries];
  emit();
  void work(qc);
  return images.length;
}
export function retry(id: string, qc: QueryClient) {
  update(id, { error: undefined, stage: { label: "Wartet" } });
  void work(qc);
}
export function dismiss(id: string) {
  const e = entries.find((x) => x.id === id);
  if (e) URL.revokeObjectURL(e.preview);
  entries = entries.filter((x) => x.id !== id);
  emit();
}
export function clearDone() {
  entries.filter((e) => e.item).forEach((e) => URL.revokeObjectURL(e.preview));
  entries = entries.filter((e) => !e.item);
  emit();
}
export function useCaptureQueue() {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => entries,
  );
}
