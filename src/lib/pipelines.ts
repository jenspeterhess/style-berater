import { callApi } from "./api";
import { cutout } from "./cutout";
import { blobToDataUrl, dataUrlToBlob, resizeImage } from "./images";
import type { ParsedDoc } from "./mail";
import { removeImages, uploadImage } from "./storage";
import { BUCKET, supabase } from "./supabase";
import { ARTIFACT } from "./target";
import type { CategoryId, Item } from "@shared/wardrobe";

export type Stage = { label: string; progress?: number };
type Classification = { name: string; category: CategoryId; colors: string[]; style: string; season: string };

/** Foto → verkleinern → freistellen → hochladen. Gibt die Speicherpfade zurück. */
async function storePhoto(photo: Blob, onStage: (s: Stage) => void) {
  onStage({ label: "Foto wird vorbereitet" });
  const original = await resizeImage(photo, 1600);
  const cut = await cutout(original, (p, phase) =>
    onStage(phase === "laden" ? { label: "Freisteller wird geladen (nur beim ersten Mal)", progress: p } : { label: "Teil wird freigestellt", progress: p }),
  );
  onStage({ label: "Wird gespeichert" });
  const [original_path, cutout_path] = await Promise.all([uploadImage(original, "original"), cut ? uploadImage(cut, "cutout") : Promise.resolve(null)]);
  return { original, original_path, cutout_path };
}

/** Ein fotografiertes Teil in einem Durchgang erfassen: freistellen, erkennen, im Schrank speichern. */
export async function captureItem(photo: Blob, onStage: (s: Stage) => void): Promise<Item> {
  const { original, original_path, cutout_path } = await storePhoto(photo, onStage);
  try {
    onStage({ label: "Teil wird erkannt" });
    let info: Classification;
    try {
      info = await callApi<Classification>("/api/classify", { image: await blobToDataUrl(await resizeImage(original, 768, "image/jpeg", 0.8)) });
    } catch {
      // Erkennung fehlgeschlagen: trotzdem speichern, Angaben lassen sich per Chip setzen.
      info = { name: "Neues Teil", category: "oberteil", colors: [], style: "casual", season: "ganzjährig" };
    }
    const { data, error } = await supabase.from("items").insert({ ...info, original_path, cutout_path, status: "wardrobe", source: "photo" }).select().single();
    if (error || !data) throw new Error("Das Teil konnte nicht gespeichert werden. Bitte versuche es erneut.");
    return data as Item;
  } catch (e) {
    await removeImages([original_path, cutout_path]);
    throw e;
  }
}

/** Einem vorhandenen Teil (z. B. aus einem Import) ein eigenes Foto geben oder das Foto ersetzen. */
export async function replacePhoto(item: Item, photo: Blob, onStage: (s: Stage) => void) {
  const { original_path, cutout_path } = await storePhoto(photo, onStage);
  const { error } = await supabase.from("items").update({ original_path, cutout_path }).eq("id", item.id);
  if (error) {
    await removeImages([original_path, cutout_path]);
    throw new Error("Das Foto konnte nicht gespeichert werden. Bitte versuche es erneut.");
  }
  await removeImages([item.original_path, item.cutout_path]);
}

type ImportResult = {
  title: string;
  store: string | null;
  purchase_date: string | null;
  total: number | null;
  currency: string;
  web_images?: number;
  web_sources?: number;
  /** `image` (Bild als data-Adresse, Artefakt) oder `image_path` (bereits im Speicher abgelegt, Server). */
  articles: (Classification & { brand: string | null; price: number | null; image?: string | null; image_path?: string | null })[];
};

/**
 * E-Mail-/PDF-Inhalt auslesen und als Eingang speichern: ein Import-Eintrag plus je Artikel ein Teil im Status „inbox“.
 * Liefert die Anzahl der erkannten Artikel.
 */
export async function runImport(doc: ParsedDoc, onStage: (s: Stage) => void) {
  onStage({ label: "Kaufangaben werden gelesen" });
  const images = await Promise.all(doc.images.slice(0, ARTIFACT ? 20 : 8).map(blobToDataUrl));
  const result = await callApi<ImportResult>("/api/import", { text: doc.text, images, imageUrls: doc.imageUrls, links: doc.links });

  const { data: record, error } = await supabase
    .from("imports")
    .insert({ title: result.title, content: doc.text, store: result.store, purchase_date: result.purchase_date, total: result.total, currency: result.currency, ...(ARTIFACT ? { found_images: doc.images.length, matched_images: result.articles.filter((a) => a.image ?? a.image_path).length } : {}) })
    .select("id")
    .single();
  if (error || !record) throw new Error("Der Import konnte nicht gespeichert werden. Bitte versuche es erneut.");

  let n = 0, withImage = 0;
  for (const a of result.articles) {
    n++;
    let original_path: string | null = null, cutout_path: string | null = null;
    if (a.image || a.image_path) {
      try {
        onStage({ label: `Produktbild ${n} von ${result.articles.length} wird freigestellt` });
        let source: Blob;
        if (a.image_path) {
          const { data } = await supabase.storage.from(BUCKET).download(a.image_path);
          if (!data) throw new Error("Bild fehlt");
          source = data;
        } else source = await dataUrlToBlob(a.image!);
        const original = await resizeImage(source, 1600);
        const cut = await cutout(original, (p, phase) => onStage({ label: phase === "laden" ? "Freisteller wird geladen (nur beim ersten Mal)" : `Produktbild ${n} von ${result.articles.length} wird freigestellt`, progress: p }));
        [original_path, cutout_path] = await Promise.all([a.image_path ? Promise.resolve(a.image_path) : uploadImage(original, "original"), cut ? uploadImage(cut, "cutout") : Promise.resolve(null)]);
      } catch {
        // Freistellen gescheitert: das abgelegte Bild trotzdem verwenden.
        original_path ??= a.image_path ?? null;
      }
    }
    const { image: _image, image_path: _path, ...fields } = a;
    const { error: itemError } = await supabase.from("items").insert({
      ...fields, original_path, cutout_path, status: "inbox", source: "import", import_id: record.id,
      store: result.store, currency: result.currency, purchase_date: result.purchase_date,
    });
    if (itemError) await removeImages([original_path, cutout_path]);
    else if (original_path) withImage++;
  }
  return { importId: record.id as string, count: result.articles.length, withImage, title: result.title, webImages: result.web_images, webSources: result.web_sources };
}
