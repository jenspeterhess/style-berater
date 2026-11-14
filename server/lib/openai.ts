import { HttpError, env } from "./http.js";
import type { Mode } from "../../shared/wardrobe.js";

const MODEL = () => process.env.OPENAI_IMAGE_MODEL || "gpt-image-1.5";

/**
 * Bild aus Referenzbildern erzeugen (OpenAI Images Edit).
 * "Schnell" und "Beste Qualität" nutzen dasselbe Modell mit unterschiedlicher Qualitätsstufe.
 */
export async function editImages(images: { blob: Blob; name: string }[], prompt: string, opts: { mode: Mode; size: string }): Promise<Uint8Array> {
  const model = (opts.mode === "fast" && process.env.OPENAI_IMAGE_MODEL_FAST) || MODEL();
  const form = new FormData();
  form.set("model", model);
  form.set("prompt", prompt);
  form.set("size", opts.size);
  form.set("quality", opts.mode === "fast" ? "low" : "high");
  for (const img of images) form.append("image[]", img.blob, img.name);

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${env("OPENAI_API_KEY")}` },
      body: form,
      signal: AbortSignal.timeout(600_000),
    });
  } catch (e) {
    console.error("[openai] Netzwerkfehler", e);
    throw new HttpError(502, "Die Bild-KI war nicht erreichbar. Bitte versuche es erneut.");
  }
  if (!res.ok) {
    let msg = "";
    let code = "";
    try {
      const j = (await res.json()) as { error?: { message?: string; code?: string } };
      msg = j.error?.message ?? "";
      code = j.error?.code ?? "";
    } catch {
      /* Antwort ohne JSON */
    }
    console.error("[openai]", res.status, code, msg);
    if (res.status === 429 && code === "insufficient_quota") throw new HttpError(402, "Das Guthaben für die Bild-KI ist aufgebraucht.");
    if (res.status === 429) throw new HttpError(429, "Die Bild-KI ist gerade sehr gefragt. Bitte versuche es in einem Moment erneut.");
    if (res.status === 401) throw new HttpError(500, "Der Zugang zur Bild-KI ist nicht richtig eingerichtet.");
    if (code === "moderation_blocked") throw new HttpError(422, "Die Bild-KI hat dieses Bild abgelehnt. Bitte versuche ein anderes Foto.");
    if (res.status === 400) throw new HttpError(400, "Das Bild konnte nicht verarbeitet werden. Versuche ein anderes Foto.");
    throw new HttpError(502, "Die Bild-KI hat gerade nicht geantwortet. Bitte versuche es erneut.");
  }
  const body = (await res.json()) as { data?: { b64_json?: string }[] };
  const b64 = body.data?.[0]?.b64_json;
  if (!b64) throw new HttpError(502, "Die Bild-KI hat kein Bild geliefert. Bitte versuche es erneut.");
  return new Uint8Array(Buffer.from(b64, "base64"));
}
