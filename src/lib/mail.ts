import { resizeImage, toBitmap } from "./images";
import { ARTIFACT } from "./target";

export type ParsedDoc = { text: string; images: Blob[]; imageUrls: string[]; links: string[] };

const MAX_TEXT = 60_000;
// Im Artefakt werden Bilder in mehreren Durchgängen zugeordnet, deshalb dürfen es dort mehr sein.
const MAX_IMAGES = ARTIFACT ? 20 : 8;
// Produktbilder in Bestellmails sind oft nur kleine Vorschaubilder.
const MIN_SIDE = 80;
const NOT_PRODUCT = /logo|icon|pixel|track|spacer|banner|facebook|instagram|twitter|pinterest|youtube|tiktok|badge|rating|star|open\.|beacon|footer|header|app-?store|google-?play/i;

const NOT_PRODUCT_LINK = /unsubscribe|abmelden|abbestellen|impressum|datenschutz|privacy|agb|terms|kontakt|hilfe|help|facebook\.|instagram\.|twitter\.|x\.com|pinterest\.|youtube\.|tiktok\.|apps\.apple|play\.google|mailto:/i;
/** Links, hinter denen eine Produktseite stecken könnte – ohne Doppelte und ohne Abmelde-, Rechts- und Social-Media-Links. */
function productLinks(urls: (string | null | undefined)[]) {
  const out: string[] = [];
  for (const u of urls) if (u && u.startsWith("https://") && u.length < 2000 && !NOT_PRODUCT_LINK.test(u) && !out.includes(u)) out.push(u);
  return out.slice(0, 30);
}

function finish(text: string, images: Blob[] = [], imageUrls: string[] = [], links: string[] = []): ParsedDoc {
  const clean = text.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) throw new Error("In dieser Datei wurde kein Text gefunden.");
  if (clean.length > MAX_TEXT) throw new Error("Dieser Text ist zu lang. Bitte füge nur die Bestellübersicht ein.");
  return { text: clean, images, imageUrls, links };
}

/** HTML nur als Daten lesen: Es wird nichts dargestellt und nichts nachgeladen. */
function readHtml(html: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script,style,head,noscript").forEach((n) => n.remove());
  const urls: string[] = [];
  doc.querySelectorAll("img[src]").forEach((img) => {
    const src = img.getAttribute("src") ?? "";
    const w = Number(img.getAttribute("width")), h = Number(img.getAttribute("height"));
    if (!src.startsWith("https://") || NOT_PRODUCT.test(src) || NOT_PRODUCT.test(img.getAttribute("alt") ?? "")) return;
    if ((w && w < 60) || (h && h < 60)) return;
    if (!urls.includes(src)) urls.push(src);
  });
  // Links um Bilder herum führen meist zur Produktseite – die zuerst.
  const links = productLinks([...[...doc.querySelectorAll("a[href]")].filter((a) => a.querySelector("img")), ...doc.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")));
  doc.querySelectorAll("br").forEach((n) => n.replaceWith("\n"));
  doc.querySelectorAll("p,div,tr,li,h1,h2,h3,h4,table").forEach((n) => n.append("\n"));
  doc.querySelectorAll("td,th").forEach((n) => n.append(" "));
  return { text: doc.body?.textContent ?? "", urls: urls.slice(0, 30), links };
}

/** Bilder auf Produktbild-Größe prüfen und verkleinern. Zu kleine oder unlesbare Bilder fallen weg. */
async function usable(blobs: Blob[]) {
  const out: Blob[] = [];
  for (const blob of blobs) {
    if (out.length >= MAX_IMAGES) break;
    try {
      const bmp = await toBitmap(blob);
      const ok = Math.min(bmp.width, bmp.height) >= MIN_SIDE && Math.max(bmp.width, bmp.height) / Math.min(bmp.width, bmp.height) <= 3;
      bmp.close();
      if (ok) out.push(await resizeImage(blob, 1024, "image/jpeg", 0.85));
    } catch {
      /* kein lesbares Bild */
    }
  }
  return out;
}

async function parseEml(file: File): Promise<ParsedDoc> {
  const { default: PostalMime } = await import("postal-mime");
  const mail = await PostalMime.parse(await file.arrayBuffer());
  const html = mail.html ? readHtml(mail.html) : null;
  const body = mail.text?.trim() ? mail.text : (html?.text ?? "");
  const head = [mail.subject && `Betreff: ${mail.subject}`, mail.from?.name || mail.from?.address ? `Von: ${mail.from?.name ?? ""} ${mail.from?.address ?? ""}`.trim() : "", mail.date && `Datum: ${mail.date}`].filter(Boolean).join("\n");
  const attached = (mail.attachments ?? [])
    .filter((a) => /^image\/(jpeg|png|webp)$/.test(a.mimeType) && typeof a.content !== "string" && a.content.byteLength > 8000)
    .map((a) => new Blob([a.content as ArrayBuffer], { type: a.mimeType }));
  return finish(`${head}\n\n${body}`, await usable(attached), html?.urls ?? [], html?.links ?? []);
}

async function parsePdf(file: File): Promise<ParsedDoc> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  let workerSrc = (await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url")).default;
  // Ist der Worker ins Skript eingebettet (Artefakt), wird er als Blob gestartet.
  if (workerSrc.startsWith("data:")) workerSrc = URL.createObjectURL(new Blob([Uint8Array.from(atob(workerSrc.slice(workerSrc.indexOf(",") + 1)), (c) => c.charCodeAt(0))], { type: "text/javascript" }));
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  let pdf;
  try {
    pdf = await task.promise;
  } catch {
    throw new Error("Diese PDF-Datei kann nicht gelesen werden. Ist sie vielleicht passwortgeschützt?");
  }
  let text = "";
  const images: Blob[] = [];
  const links: string[] = [];
  try {
    for (let n = 1; n <= Math.min(pdf.numPages, 12); n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      for (const item of content.items) if ("str" in item) text += item.str + (item.hasEOL ? "\n" : " ");
      text += "\n\n";
      // Anklickbare Links der Seite (in gedruckten E-Mails führen sie zu den Produktseiten).
      for (const a of await page.getAnnotations().catch(() => [])) if (a.subtype === "Link" && typeof a.url === "string") links.push(a.url);
      if (n <= 8 && images.length < 60) images.push(...(await pdfPageImages(pdfjs, page)));
    }
  } finally {
    void task.destroy();
  }
  if (!text.trim()) throw new Error("In dieser PDF wurde kein Text gefunden. Gescannte Dokumente können nicht gelesen werden.");
  return finish(text, await usable(images), [], productLinks(links));
}

type PdfImage = { bitmap?: ImageBitmap; data?: Uint8ClampedArray | Uint8Array; width: number; height: number };

/** Eingebettete Bilder einer PDF-Seite (z. B. Produktfotos auf einer Rechnung). */
async function pdfPageImages(pdfjs: typeof import("pdfjs-dist/legacy/build/pdf.mjs"), page: import("pdfjs-dist/legacy/build/pdf.mjs").PDFPageProxy) {
  const out: Blob[] = [];
  try {
    const ops = await page.getOperatorList();
    const names = new Set<string>();
    ops.fnArray.forEach((fn, i) => {
      if (fn === pdfjs.OPS.paintImageXObject) names.add((ops.argsArray[i] as unknown[])[0] as string);
    });
    for (const name of names) {
      const store = name.startsWith("g_") ? page.commonObjs : page.objs;
      const img = await new Promise<PdfImage | null>((resolve) => {
        const t = setTimeout(() => resolve(null), 2000);
        try {
          store.get(name, (o: unknown) => (clearTimeout(t), resolve(o as PdfImage)));
        } catch {
          clearTimeout(t);
          resolve(null);
        }
      });
      if (!img || Math.min(img.width, img.height) < MIN_SIDE) continue;
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      if (img.bitmap) ctx.drawImage(img.bitmap, 0, 0);
      else if (img.data && img.data.length === img.width * img.height * 4) ctx.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
      else if (img.data && img.data.length === img.width * img.height * 3) {
        // Manche Browser liefern die Pixel ohne Deckkraft-Kanal (RGB statt RGBA).
        const rgba = new Uint8ClampedArray(img.width * img.height * 4);
        for (let s = 0, d = 0; s < img.data.length; s += 3, d += 4) {
          rgba[d] = img.data[s]!;
          rgba[d + 1] = img.data[s + 1]!;
          rgba[d + 2] = img.data[s + 2]!;
          rgba[d + 3] = 255;
        }
        ctx.putImageData(new ImageData(rgba, img.width, img.height), 0, 0);
      } else continue;
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.9));
      if (blob) out.push(blob);
    }
  } catch (e) {
    console.warn("PDF-Bilder konnten nicht gelesen werden", e);
  }
  return out;
}

export const ACCEPTED_IMPORT = ".txt,.eml,.pdf,text/plain,message/rfc822,application/pdf";

export async function parseImportFile(file: File): Promise<ParsedDoc> {
  const name = file.name.toLowerCase();
  if (file.size > 15_000_000) throw new Error("Diese Datei ist zu groß (höchstens 15 MB).");
  if (name.endsWith(".pdf") || file.type === "application/pdf") return parsePdf(file);
  if (name.endsWith(".eml") || file.type === "message/rfc822") return parseEml(file);
  if (name.endsWith(".txt") || file.type.startsWith("text/")) return finish(await file.text());
  throw new Error("Bitte nutze eine .eml-, .pdf- oder .txt-Datei.");
}

export const parseImportText = (text: string) => finish(text);

/** Lesbarer Text aus kopiertem E-Mail-HTML – für den Fall, dass die Zwischenablage keinen reinen Text mitliefert. */
export const htmlToText = (html: string) => readHtml(html).text.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

/**
 * Aus einer E-Mail kopierter Inhalt: Der Zwischenablage liegt neben dem Text auch das HTML bei.
 * Daraus kommen die Adressen der Produktbilder und die Produkt-Links – der sichtbare Text bleibt maßgeblich.
 */
export function parseImportPaste(text: string, html: string | null) {
  if (!html) return finish(text);
  const parsed = readHtml(html);
  return finish(text.trim() ? text : parsed.text, [], parsed.urls, parsed.links);
}
