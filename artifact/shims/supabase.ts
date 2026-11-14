import { uuid } from "@/lib/uuid";
// Ersatz für den Supabase-Client: dieselben Aufrufe, gespeichert wird aber im privaten Bereich des Artefakts
// (data/users/<konto>/…), den nur das jeweilige Claude-Konto lesen kann.
import { mustDb, userId } from "./claude";

export const BUCKET = "wardrobe";

const DEFAULTS: Record<string, Record<string, unknown>> = {
  items: { status: "wardrobe", source: "photo", colors: [], style: "casual", season: "ganzjährig", original_path: null, cutout_path: null, brand: null, store: null, price: null, currency: null, purchase_date: null, import_id: null },
  outfits: { reason: null, image_path: null, mode: "quality" },
  imports: { store: null, purchase_date: null, total: null, currency: null },
  profiles: { avatar_path: null, selfie_path: null, body_path: null, consent_at: null },
};

type Row = Record<string, unknown>;
type Result = { data: any; error: { message: string } | null };

class Builder implements PromiseLike<Result> {
  private op: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private payload: Row = {};
  private filters: [string, unknown][] = [];
  private sort?: { field: string; asc: boolean };
  private mode: "many" | "single" | "maybe" = "many";
  constructor(private table: string) {}

  select(_cols?: string) { return this; }
  insert(p: Row) { this.op = "insert"; this.payload = p; return this; }
  update(p: Row) { this.op = "update"; this.payload = p; return this; }
  upsert(p: Row) { this.op = "upsert"; this.payload = p; return this; }
  delete() { this.op = "delete"; return this; }
  eq(field: string, value: unknown) { this.filters.push([field, value]); return this; }
  order(field: string, o?: { ascending?: boolean }) { this.sort = { field, asc: o?.ascending ?? true }; return this; }
  single() { this.mode = "single"; return this; }
  maybeSingle() { this.mode = "maybe"; return this; }

  then<A = Result, B = never>(ok?: ((v: Result) => A | PromiseLike<A>) | null, fail?: ((e: unknown) => B | PromiseLike<B>) | null) {
    return this.run().then(ok, fail);
  }

  private async run(): Promise<Result> {
    try {
      const { db, id: uid, base } = await mustDb();
      const col = db.collection(`${base}/${this.table}`);
      const idFilter = this.filters.find(([f]) => f === "id")?.[1] as string | undefined;
      let rows: Row[] = [];
      if (this.op === "insert" || this.op === "upsert") {
        const id = (this.payload.id as string | undefined) ?? (this.table === "profiles" ? uid : uuid());
        const ref = col.doc(id);
        const old = this.op === "upsert" ? (await ref.get()).data() : undefined;
        const row = { ...DEFAULTS[this.table], created_at: new Date().toISOString(), ...old, ...this.payload, id, user_id: uid };
        await ref.set(row);
        rows = [row];
      } else if (this.op === "update") {
        if (!idFilter) throw new Error("update ohne id");
        await col.doc(idFilter).update(this.payload);
      } else if (this.op === "delete") {
        if (!idFilter) throw new Error("delete ohne id");
        await col.doc(idFilter).delete();
      } else {
        if (idFilter) {
          const snap = await col.doc(idFilter).get();
          rows = snap.exists && snap.data() ? [snap.data()!] : [];
        } else rows = (await col.limit(1000).get()).docs.map((d) => d.data()).filter((r): r is Row => !!r);
        rows = rows.filter((r) => this.filters.every(([f, v]) => r[f] === v));
        const s = this.sort;
        if (s) rows.sort((a, b) => (String(a[s.field] ?? "") < String(b[s.field] ?? "") ? -1 : 1) * (s.asc ? 1 : -1));
      }
      if (this.mode === "many") return { data: rows, error: null };
      if (!rows[0] && this.mode === "single") return { data: null, error: { message: "nicht gefunden" } };
      return { data: rows[0] ?? null, error: null };
    } catch (e) {
      console.error("[db]", this.table, this.op, e);
      return { data: null, error: { message: e instanceof Error ? e.message : "Speicherfehler" } };
    }
  }
}

export const supabase = {
  from: (table: string) => new Builder(table),
  auth: { signOut: async (_o?: unknown) => ({ error: null }) },
};

export async function currentUserId() {
  const id = await userId();
  if (!id) throw new Error("Bitte öffne die Seite angemeldet in Claude.");
  return id;
}
