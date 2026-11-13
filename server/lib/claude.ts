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
