import { useQuery } from "@tanstack/react-query";
import { BUCKET, currentUserId, supabase } from "./supabase";

export async function uploadImage(blob: Blob, name: string) {
  const uid = await currentUserId();
  const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
  const path = `${uid}/${name}-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || "image/jpeg" });
  if (error) throw new Error("Das Bild konnte nicht gespeichert werden. Bitte versuche es erneut.");
  return path;
}

export async function removeImages(paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => !!p);
  if (list.length) await supabase.storage.from(BUCKET).remove(list);
}

// Private Bilder brauchen signierte Adressen. Anfragen eines Bildschirms werden zu einer einzigen gebündelt.
let pending = new Map<string, { resolve: (u: string) => void; reject: (e: Error) => void }[]>();
let timer: ReturnType<typeof setTimeout> | undefined;

function flush() {
  const batch = pending;
  pending = new Map();
  timer = undefined;
  const paths = [...batch.keys()];
  supabase.storage
    .from(BUCKET)
    .createSignedUrls(paths, 60 * 60)
    .then(({ data, error }) => {
      for (const path of paths) {
        const url = data?.find((d) => d.path === path)?.signedUrl;
        for (const w of batch.get(path) ?? []) (url && !error ? w.resolve(url) : w.reject(new Error("Bild nicht verfügbar")));
      }
    });
}

function sign(path: string) {
  return new Promise<string>((resolve, reject) => {
    const list = pending.get(path) ?? [];
    list.push({ resolve, reject });
    pending.set(path, list);
    timer ??= setTimeout(flush, 15);
  });
}

/** Signierte Adresse zu einem Speicherpfad (50 Minuten zwischengespeichert). */
export function useImageUrl(path: string | null | undefined) {
  return useQuery({ queryKey: ["img", path], queryFn: () => sign(path!), enabled: !!path, staleTime: 50 * 60_000, gcTime: 55 * 60_000, retry: 1 }).data;
}
