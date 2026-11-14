export const CATEGORIES = [
  { id: "jacke", label: "Jacke/Mantel", short: "Jacke" },
  { id: "oberteil", label: "Oberteil", short: "Oberteil" },
  { id: "hose", label: "Hose", short: "Hose" },
  { id: "rock_kleid", label: "Rock/Kleid", short: "Rock/Kleid" },
  { id: "schuhe", label: "Schuhe", short: "Schuhe" },
  { id: "accessoire", label: "Accessoire", short: "Accessoire" },
] as const;
export type CategoryId = (typeof CATEGORIES)[number]["id"];
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as [CategoryId, ...CategoryId[]];

export const STYLES = ["casual", "business", "sportlich", "elegant"] as const;
export const SEASONS = ["frühling", "sommer", "herbst", "winter", "ganzjährig"] as const;
export const COLORS = [
  "schwarz", "weiß", "grau", "beige", "braun", "navy", "blau", "grün", "rot", "rosa", "gelb", "orange", "lila", "creme", "denim",
] as const;

/** Für wen ein Teil gedacht ist. Bleibt leer, wenn es sich nicht erkennen lässt. */
export const AUDIENCES = [
  { id: "damen", label: "Damen" },
  { id: "herren", label: "Herren" },
  { id: "kinder", label: "Kinder" },
  { id: "unisex", label: "Unisex" },
] as const;
export type AudienceId = (typeof AUDIENCES)[number]["id"];
export const AUDIENCE_IDS = AUDIENCES.map((a) => a.id) as [AudienceId, ...AudienceId[]];

/** Anlass ↔ Stil: Der Anlass-Filter im Schrank nutzt den Stil des Teils. */
export const OCCASIONS = [
  { id: "büro", label: "Büro", style: "business" },
  { id: "freizeit", label: "Freizeit", style: "casual" },
  { id: "abend", label: "Abend", style: "elegant" },
  { id: "sport", label: "Sport", style: "sportlich" },
] as const;
export type OccasionId = (typeof OCCASIONS)[number]["id"];

export const COLOR_SWATCH: Record<string, string> = {
  schwarz: "oklch(0.2 0 0)", weiß: "oklch(0.99 0 0)", grau: "oklch(0.65 0 0)", beige: "oklch(0.86 0.04 80)",
  braun: "oklch(0.45 0.07 55)", navy: "oklch(0.3 0.08 260)", blau: "oklch(0.6 0.13 250)", grün: "oklch(0.55 0.12 150)",
  rot: "oklch(0.55 0.2 27)", rosa: "oklch(0.82 0.08 0)", gelb: "oklch(0.88 0.15 95)", orange: "oklch(0.72 0.16 55)",
  lila: "oklch(0.55 0.15 310)", creme: "oklch(0.95 0.03 90)", denim: "oklch(0.5 0.08 250)",
};

export const categoryLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.label ?? id;
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const MODES = [{ id: "fast", label: "Schnell" }, { id: "quality", label: "Beste Qualität" }] as const;
export type Mode = (typeof MODES)[number]["id"];
export const DEFAULT_MODE: Mode = "quality";

/** Zeilen der Anprobe. Hose und Rock/Kleid teilen sich eine Zeile. */
export const TRYON_ROWS = [
  { id: "jacke", label: "Jacke", categories: ["jacke"] },
  { id: "oberteil", label: "Oberteil", categories: ["oberteil"] },
  { id: "unten", label: "Hose · Rock · Kleid", categories: ["hose", "rock_kleid"] },
  { id: "schuhe", label: "Schuhe", categories: ["schuhe"] },
  { id: "accessoire", label: "Accessoires", categories: ["accessoire"] },
] as const;
export const rowOf = (category: string) => TRYON_ROWS.find((r) => (r.categories as readonly string[]).includes(category))?.id ?? "accessoire";

/** Schlüssel für den Bild-Zwischenspeicher: gleiche Kombination + gleicher Avatar + gleiche Qualität = gleiches Bild. */
export function comboKey(itemIds: string[], avatarPath: string, mode: Mode) {
  return ["v1", mode, avatarPath, ...[...new Set(itemIds)].sort()].join("|");
}

export type ItemStatus = "inbox" | "wardrobe" | "wishlist";

export type Item = {
  id: string;
  user_id: string;
  status: ItemStatus;
  source: "photo" | "import";
  name: string;
  category: CategoryId;
  colors: string[];
  style: string;
  season: string;
  audience?: AudienceId | null;
  original_path: string | null;
  cutout_path: string | null;
  brand: string | null;
  store: string | null;
  price: number | null;
  currency: string | null;
  purchase_date: string | null;
  import_id: string | null;
  created_at: string;
};

export type Outfit = {
  id: string;
  title: string;
  reason: string | null;
  item_ids: string[];
  image_path: string | null;
  mode: Mode;
  created_at: string;
};

export type Suggestion = { title: string; reason: string; item_ids: string[] };

export type JobKind = "avatar" | "tryon" | "beautify";
export type Job = {
  id: string;
  kind: JobKind;
  status: "pending" | "done" | "error";
  input: Record<string, unknown>;
  result: { path?: string } | null;
  error: string | null;
  created_at: string;
};

export type ImportRecord = {
  id: string;
  title: string;
  content: string;
  store: string | null;
  purchase_date: string | null;
  total: number | null;
  currency: string | null;
  created_at: string;
};

export function formatPrice(price: number | null, currency: string | null) {
  if (price == null) return null;
  try {
    return new Intl.NumberFormat("de-DE", { style: "currency", currency: currency || "EUR" }).format(price);
  } catch {
    return `${price.toFixed(2)} ${currency ?? ""}`.trim();
  }
}
export function formatDate(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });
}
