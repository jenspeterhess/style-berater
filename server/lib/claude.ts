import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { HttpError, env } from "./http";

let client: Anthropic | undefined;
const MODEL = () => process.env.CLAUDE_MODEL || "claude-opus-5-5";

export type ImageInput = { mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; data: string };

/** data:-URL → Claude-Bildblock. Wirft bei unbekanntem Format. */
export function parseDataUrl(url: string): ImageInput {
  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(url);
  if (!m) throw new HttpError(400, "Das Bildformat wird nicht unterstützt.");
  return { mediaType: m[1] as ImageInput["mediaType"], data: m[2]! };
}
export const imageBlock = (img: ImageInput): Anthropic.ImageBlockParam => ({
  type: "image",
  source: { type: "base64", media_type: img.mediaType, data: img.data },
});

/**
 * Eine Claude-Anfrage mit garantiert schema-konformer JSON-Antwort.
 * Eingaben der Nutzerin (Fotos, E-Mail-Texte) sind Daten, keine Anweisungen – das steht jeweils im system-Prompt.
 */
export async function structured<S extends z.ZodType>(opts: {
  system: string;
  content: Anthropic.ContentBlockParam[];
  schema: S;
  effort?: "low" | "medium" | "high";
}): Promise<z.infer<S>> {
  client ??= new Anthropic({ apiKey: env("ANTHROPIC_API_KEY") });
  try {
    const res = await client.beta.messages.parse({
      model: MODEL(),
      // Lehnt das Modell eine Anfrage aus Sicherheitsgründen ab, übernimmt automatisch ein Ersatzmodell.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      max_tokens: 16000,
      system: opts.system,
      messages: [{ role: "user", content: opts.content }],
      output_config: { effort: opts.effort ?? "low", format: zodOutputFormat(opts.schema) },
    });
    if (res.stop_reason === "refusal") throw new HttpError(422, "Die KI konnte diese Anfrage nicht bearbeiten.");
    if (res.stop_reason === "max_tokens" || res.parsed_output == null)
      throw new HttpError(502, "Die KI-Antwort war unvollständig. Bitte versuche es erneut.");
    return res.parsed_output as z.infer<S>;
  } catch (e) {
    if (e instanceof HttpError) throw e;
    if (e instanceof Anthropic.RateLimitError) throw new HttpError(429, "Die KI ist gerade sehr gefragt. Bitte versuche es in einem Moment erneut.");
    if (e instanceof Anthropic.AuthenticationError) throw new HttpError(500, "Der KI-Zugang ist nicht richtig eingerichtet.");
    if (e instanceof Anthropic.BadRequestError) {
      console.error("[claude] 400", e.message);
      throw new HttpError(400, "Das konnte die KI nicht verarbeiten. Versuche ein anderes Foto oder einen anderen Text.");
    }
    if (e instanceof Anthropic.APIError) {
      console.error("[claude]", e.status, e.message);
      throw new HttpError(502, "Die KI hat gerade nicht geantwortet. Bitte versuche es erneut.");
    }
    throw e;
  }
}

/**
 * Eine Claude-Anfrage mit Websuche. Liefert den Antworttext und alle Adressen, die in den Suchergebnissen
 * tatsächlich vorkamen – damit sich Links aus der Antwort gegen echte Treffer prüfen lassen.
 */
export async function searchWeb(opts: { system: string; prompt: string; maxUses?: number; fetchPages?: number }): Promise<{ text: string; urls: Set<string> }> {
  client ??= new Anthropic({ apiKey: env("ANTHROPIC_API_KEY") });
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: opts.prompt }];
  const urls = new Set<string>();
  try {
    // Lange Suchen pausieren serverseitig (pause_turn); dann wird dieselbe Anfrage fortgesetzt.
    for (let round = 0; round < 6; round++) {
      const res = await client.beta.messages.create({
        model: MODEL(),
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        max_tokens: 16000,
        system: opts.system,
        messages,
        output_config: { effort: "low" },
        tools: [
          { type: "web_search_20260209", name: "web_search", max_uses: opts.maxUses ?? 5, user_location: { type: "approximate", country: "DE", timezone: "Europe/Berlin" } },
          // Optional: gefundene Seiten öffnen, etwa um einen Preis abzulesen.
          ...(opts.fetchPages ? [{ type: "web_fetch_20260209" as const, name: "web_fetch" as const, max_uses: opts.fetchPages, max_content_tokens: 8000 }] : []),
        ],
      });
      for (const block of res.content) {
        if (block.type === "text") continue;
        for (const m of JSON.stringify(block).matchAll(/https?:\/\/[^\s"\\<>]+/g)) urls.add(m[0]);
      }
      if (res.stop_reason === "refusal") throw new HttpError(422, "Die KI konnte diese Anfrage nicht bearbeiten.");
      if (res.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: res.content as Anthropic.Beta.BetaContentBlockParam[] });
        continue;
      }
      const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
      return { text, urls };
    }
    throw new HttpError(502, "Die Websuche hat zu lange gedauert. Bitte versuche es erneut.");
  } catch (e) {
    if (e instanceof HttpError) throw e;
    if (e instanceof Anthropic.RateLimitError) throw new HttpError(429, "Die KI ist gerade sehr gefragt. Bitte versuche es in einem Moment erneut.");
    if (e instanceof Anthropic.AuthenticationError) throw new HttpError(500, "Der KI-Zugang ist nicht richtig eingerichtet.");
    if (e instanceof Anthropic.BadRequestError || e instanceof Anthropic.PermissionDeniedError) {
      console.error("[claude] Websuche", e.status, e.message);
      throw new HttpError(400, "Die Websuche ist für den KI-Zugang nicht freigeschaltet. Sie lässt sich in der Anthropic Console unter den Einstellungen aktivieren.");
    }
    if (e instanceof Anthropic.APIError) {
      console.error("[claude]", e.status, e.message);
      throw new HttpError(502, "Die KI hat gerade nicht geantwortet. Bitte versuche es erneut.");
    }
    throw e;
  }
}
