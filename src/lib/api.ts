import { supabase } from "./supabase";

async function token() {
  const { data } = await supabase.auth.getSession();
  let session = data.session;
  // Kurz vor Ablauf erneuern, damit auch länger laufende Aufträge angemeldet bleiben.
  if (session?.expires_at && session.expires_at * 1000 - Date.now() < 5 * 60_000) session = (await supabase.auth.refreshSession()).data.session ?? session;
  if (!session) throw new Error("Bitte melde dich an.");
  return session.access_token;
}

export async function callApi<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${await token()}` },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Keine Verbindung. Bitte prüfe dein Internet und versuche es erneut.");
  }
  if (res.status === 202 || res.status === 204) return undefined as T;
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* keine JSON-Antwort */
  }
  if (!res.ok) throw new Error((data as { error?: string } | null)?.error ?? "Das hat gerade nicht geklappt. Bitte versuche es erneut.");
  return data as T;
}

export const errorMessage = (e: unknown) => (e instanceof Error && e.message ? e.message : "Das hat gerade nicht geklappt. Bitte versuche es erneut.");
