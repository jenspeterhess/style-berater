import { waitUntil } from "@vercel/functions";
import handler from "../server/handlers/job.js";

/**
 * Lang laufender Auftrag: sofort mit 202 antworten, die Arbeit läuft danach weiter (bis zur Höchstlaufzeit der Funktion).
 * Das Ergebnis holt sich der Browser später ab.
 */
export default {
  async fetch(req: Request): Promise<Response> {
    const body = await req.text();
    const copy = new Request(req.url, { method: req.method, headers: req.headers, body: req.method === "GET" ? undefined : body });
    waitUntil(handler(copy).catch((e) => console.error("[job] Hintergrundauftrag", e)));
    return new Response(null, { status: 202 });
  },
};
