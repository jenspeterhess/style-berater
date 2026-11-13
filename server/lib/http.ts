import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8" } });

export function env(name: string) {
  const v = process.env[name];
  if (!v) throw new HttpError(500, `Der Server ist nicht vollständig eingerichtet (${name} fehlt).`);
  return v;
}
export const mock = () => process.env.AI_MOCK === "1";

let adminClient: SupabaseClient | undefined;
/** Server-Client mit vollen Rechten. Jede Abfrage MUSS selbst auf user_id bzw. den Ordner des Kontos einschränken. */
export function admin() {
  adminClient ??= createClient(process.env.SUPABASE_URL ?? env("VITE_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}

export async function requireUser(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "Bitte melde dich an.");
  const { data, error } = await admin().auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Deine Anmeldung ist abgelaufen. Bitte melde dich erneut an.");
  return data.user;
}

type Ctx<B> = { req: Request; userId: string; body: B };

/** Rahmen für alle API-Funktionen: nur POST, nur angemeldet, Fehler als verständliche deutsche Meldung. */
export function api<B>(parse: (raw: unknown) => B, fn: (ctx: Ctx<B>) => Promise<unknown>) {
  return async (req: Request): Promise<Response> => {
    try {
      if (req.method !== "POST") throw new HttpError(405, "Nicht erlaubt.");
      const user = await requireUser(req);
      let raw: unknown;
      try {
        raw = await req.json();
      } catch {
        throw new HttpError(400, "Ungültige Anfrage.");
      }
      let body: B;
      try {
        body = parse(raw);
      } catch {
        throw new HttpError(400, "Ungültige Anfrage.");
      }
      return json(await fn({ req, userId: user.id, body }));
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error("[api] unerwarteter Fehler", e);
      return json({ error: "Das hat gerade nicht geklappt. Bitte versuche es erneut." }, 500);
    }
  };
}
