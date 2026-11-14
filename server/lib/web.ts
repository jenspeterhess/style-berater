import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// Abruf fremder Adressen aus importierten E-Mails und PDFs. Die Adressen stammen aus Dokumenten, also aus
// nicht vertrauenswürdiger Quelle: nur öffentliche https-Ziele, begrenzte Größe, begrenzte Weiterleitungen.

const UA = "StyleBerater/1.0 (privater Kleiderschrank; Produktbild-Import)";

function isPrivate(ip: string) {
  if (ip.includes(":")) return /^(::1|::|f[cd]|fe80|::ffff:)/i.test(ip);
  const [a = 0, b = 0] = ip.split(".").map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224 || (a === 100 && b >= 64 && b <= 127);
}

async function allowed(url: URL) {
  if (url.protocol !== "https:" || url.username || url.password || isIP(url.hostname)) return false;
  try {
    const addrs = await lookup(url.hostname, { all: true });
    return addrs.length > 0 && !addrs.some((a) => isPrivate(a.address));
  } catch {
    return false;
  }
}

/** Folgt bis zu fünf Weiterleitungen und prüft jedes Ziel erneut. Liefert die Antwort samt endgültiger Adresse. */
async function safeFetch(raw: string, accept: string, timeoutMs: number) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const signal = AbortSignal.timeout(timeoutMs);
  for (let hop = 0; hop < 6; hop++) {
    if (!(await allowed(url))) return null;
    let res: Response;
    try {
      res = await fetch(url, { redirect: "manual", signal, headers: { accept, "user-agent": UA, "accept-language": "de-DE,de;q=0.9" } });
    } catch {
      return null;
    }
    const next = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
    if (!next) return res.ok ? { res, url } : null;
    try {
      url = new URL(next, url);
    } catch {
      return null;
    }
  }
  return null;
}

async function readLimited(res: Response, max: number) {
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > max || !res.body) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    size += chunk.length;
    if (size > max) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export type WebImage = { mediaType: "image/jpeg" | "image/png" | "image/webp"; bytes: Buffer };

/**
 * Viele Shops liefern dasselbe Bild in jeder Größe aus und steuern das über Parameter in der Adresse.
 * Liefert eine Adresse für eine große Variante – oder null, wenn die Adresse keine erkennbare Größenangabe hat.
 */
export function enlarge(raw: string, width = 1200): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  let changed = false;
  for (const key of ["width", "w", "wid", "imwidth"]) if (url.searchParams.has(key)) (url.searchParams.set(key, String(width)), (changed = true));
  for (const key of ["height", "h", "hei"]) if (url.searchParams.has(key)) (url.searchParams.delete(key), (changed = true));
  // ABOUT YOU: der Bildserver nimmt die Breite auch dann an, wenn die Adresse bisher keine oder nur eine Höhe nennt.
  if (url.hostname.endsWith("aboutstatic.com") && url.pathname.startsWith("/file/")) {
    url.search = "";
    url.searchParams.set("width", String(width));
    url.searchParams.set("quality", "85");
    changed = true;
  }
  return changed ? url.toString() : null;
}

/** Lädt ein Bild; Zählpixel und Symbole (unter 6 kB) fallen weg. */
export async function fetchImage(raw: string, maxBytes = 4_000_000): Promise<WebImage | null> {
  const hit = await safeFetch(raw, "image/jpeg,image/png,image/webp;q=0.9", 8000);
  if (!hit) return null;
  const type = (hit.res.headers.get("content-type") ?? "").split(";")[0]!.trim();
  if (type !== "image/jpeg" && type !== "image/png" && type !== "image/webp") return null;
  const bytes = await readLimited(hit.res, maxBytes).catch(() => null);
  return bytes && bytes.length >= 6000 ? { mediaType: type, bytes } : null;
}

/** Erst die große Variante versuchen, sonst das Bild so, wie es verlinkt ist. */
export async function fetchBest(raw: string): Promise<(WebImage & { variant: "groß" | "wie verlinkt" }) | null> {
  const big = enlarge(raw);
  const large = big ? await fetchImage(big) : null;
  if (large) return { ...large, variant: "groß" };
  const plain = await fetchImage(raw);
  return plain ? { ...plain, variant: "wie verlinkt" } : null;
}

/** Kurzform einer Adresse für Protokoll und Diagnose: Host und Ende des Pfads, ohne Parameter. */
export function shortUrl(raw: string) {
  try {
    const u = new URL(raw);
    return `${u.hostname}${u.pathname.length > 34 ? "/…" + u.pathname.slice(-30) : u.pathname}${u.search ? "?…" : ""}`;
  } catch {
    return "ungültige Adresse";
  }
}

/** Liest Titel und Hauptbild (og:image) aus dem HTML einer Produktseite. */
export function productMeta(html: string, base: string) {
  const meta = (name: string) => {
    const tag = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*>`, "i").exec(html)?.[0];
    const value = tag && /content=["']([^"']+)["']/i.exec(tag)?.[1];
    return value ? value.replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').trim() : null;
  };
  const image = meta("og:image") ?? meta("twitter:image");
  const title = meta("og:title") ?? /<title[^>]*>([^<]+)/i.exec(html)?.[1]?.trim() ?? null;
  if (!image) return null;
  // Preis aus den Shop-Angaben der Seite: Meta-Tags oder die strukturierten Produktdaten (JSON-LD).
  const raw = meta("product:price:amount") ?? meta("og:price:amount") ?? /itemprop=["']price["'][^>]*content=["'](\d{1,6}(?:[.,]\d{1,2})?)["']/i.exec(html)?.[1] ?? /"(?:price|lowPrice)"\s*:\s*"?(\d{1,6}(?:[.,]\d{1,2})?)"?/.exec(html)?.[1] ?? null;
  const amount = raw ? Number(raw.replace(",", ".")) : NaN;
  const price = Number.isFinite(amount) && amount > 0 && amount < 100000 ? amount : null;
  const currency = meta("product:price:currency") ?? meta("og:price:currency") ?? /"priceCurrency"\s*:\s*"([A-Z]{3})"/.exec(html)?.[1] ?? null;
  try {
    return { image: new URL(image, base).toString(), title: title?.slice(0, 150) ?? null, price, currency };
  } catch {
    return null;
  }
}

/** Produktseite hinter einem Link (auch hinter Weiterleitungen aus Newsletter-Links) → großes Produktbild. */
export async function fetchProductImage(link: string): Promise<(WebImage & { title: string | null; page: string; price: number | null; currency: string | null }) | null> {
  const hit = await safeFetch(link, "text/html", 9000);
  if (!hit || hit.url.pathname === "/" || !(hit.res.headers.get("content-type") ?? "").includes("text/html")) return null;
  const html = await readLimited(hit.res, 3_000_000).catch(() => null);
  const meta = html && productMeta(html.toString("utf8"), hit.url.toString());
  if (!meta) return null;
  const img = await fetchBest(meta.image);
  return img ? { ...img, title: meta.title, page: `${hit.url.origin}${hit.url.pathname}`, price: meta.price, currency: meta.currency } : null;
}
