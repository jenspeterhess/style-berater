import { uuid } from "@/lib/uuid";
import { useQuery } from "@tanstack/react-query";
import { cap, mustDb } from "./claude";
import { resizeImage, blobToDataUrl } from "@/lib/images";

/**
 * Bilder liegen im Datei-Speicher des Artefakts ("a:<id>"). Wer dort nicht hochladen darf,
 * bekommt das Bild verkleinert in seinem privaten Datenbereich abgelegt ("d:<id>").
 */
export async function uploadImage(blob: Blob, _name: string) {
  const assets = await cap("assets");
  if (assets) {
    try {
      return `a:${(await assets.upload(blob)).id}`;
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code && !["not_uploader", "not_granted", "capability_disabled", "quota_or_state"].includes(code)) throw new Error("Das Bild konnte nicht gespeichert werden. Bitte versuche es erneut.");
    }
  }
  const { db, base } = await mustDb();
  const png = blob.type === "image/png" || blob.type === "image/webp";
  let small = blob;
  // Ein Datensatz fasst rund 250 KB – deshalb schrittweise verkleinern, bis es passt.
  for (const max of [900, 700, 520, 400]) {
    if (small.size < 170_000) break;
    small = await resizeImage(blob, max, png ? "image/png" : "image/jpeg", 0.8);
  }
  if (small.size >= 185_000) throw new Error("Dieses Bild ist zu groß für den Speicher. Bitte versuche ein anderes Foto.");
  const id = uuid();
  await db.doc(`${base}/blobs/${id}`).set({ data: await blobToDataUrl(small) });
  return `d:${id}`;
}

export async function removeImages(paths: (string | null | undefined)[]) {
  for (const p of paths) {
    if (!p) continue;
    try {
      if (p.startsWith("a:")) await (await cap("assets"))?.delete(p.slice(2));
      else if (p.startsWith("d:")) {
        const { db, base } = await mustDb();
        await db.doc(`${base}/blobs/${p.slice(2)}`).delete();
      }
    } catch {
      /* ein verwaistes Bild ist harmlos */
    }
  }
}

async function load(path: string) {
  const { db, base } = await mustDb();
  const data = (await db.doc(`${base}/blobs/${path.slice(2)}`).get()).data()?.data;
  if (typeof data !== "string") throw new Error("Bild nicht verfügbar");
  return data;
}

export function useImageUrl(path: string | null | undefined) {
  const inDb = !!path?.startsWith("d:");
  const q = useQuery({ queryKey: ["img", path], queryFn: () => load(path!), enabled: inDb, staleTime: Infinity, retry: 1 });
  if (!path) return undefined;
  return inDb ? q.data : `/_blob/${path.slice(2)}`;
}
