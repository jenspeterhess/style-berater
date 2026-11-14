// Zugriff auf die Laufzeit-Fähigkeiten eines Claude-Artefakts. Jede kann fehlen (null) – die App muss damit umgehen.
type Doc = { id: string; exists: boolean; data(): Record<string, unknown> | undefined };
type DocRef = { get(): Promise<Doc>; set(d: Record<string, unknown>): Promise<void>; update(d: Record<string, unknown>): Promise<void>; delete(): Promise<void> };
type Col = { doc(id?: string): DocRef; limit(n: number): { get(): Promise<{ docs: Doc[] }> } };
export type Db = { doc(path: string): DocRef; collection(path: string): Col };
export type Assets = { upload(blob: Blob): Promise<{ id: string; url: string }>; delete(id: string): Promise<unknown> };
export type User = { id(): Promise<string | null>; name(): Promise<string> };
export type Sample = {
  json<T>(input: string, options?: { images?: Blob[]; modelTier?: "quick" | "default" | "complex"; cache?: boolean }): Promise<T>;
  limits(): Promise<{ images?: { maxCount: number; maxInputBytes: number; mediaTypes: string[] } }>;
};
type Caps = { db: Db; assets: Assets; user: User; sample: Sample };

const cache = new Map<string, Promise<unknown>>();
export function cap<K extends keyof Caps>(name: K): Promise<Caps[K] | null> {
  let p = cache.get(name);
  if (!p) {
    const claude = (window as unknown as { claude?: { use(n: string): Promise<unknown> } }).claude;
    p = claude ? claude.use(name).catch(() => null) : Promise.resolve(null);
    cache.set(name, p);
  }
  return p as Promise<Caps[K] | null>;
}

let uid: Promise<string | null> | undefined;
export function userId() {
  uid ??= cap("user").then((u) => (u ? u.id() : null)).catch(() => null);
  return uid;
}

export async function mustDb() {
  const [db, id] = await Promise.all([cap("db"), userId()]);
  if (!db || !id) throw new Error("Der Speicher ist gerade nicht erreichbar. Bitte öffne die Seite angemeldet in Claude.");
  // Pfade wechseln zwischen Sammlung und Dokument: data/users/<konto> ist eine Sammlung, "schrank" ein Dokument darin,
  // und darunter liegen die Sammlungen items, outfits, imports, profiles und blobs.
  return { db, id, base: `data/users/${id}/schrank` };
}
