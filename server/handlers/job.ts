import { z } from "zod";
import { HttpError, admin, json, mock, requireUser } from "../lib/http";
import { editImages } from "../lib/openai";
import { categoryLabel, comboKey, rowOf, type Mode } from "../../shared/wardrobe";

const BUCKET = "wardrobe";
const AVATAR_BASICS = "a plain fitted light grey t-shirt, plain short light grey shorts, and simple white sneakers";

type Out = { bytes: Uint8Array; type: string };

async function download(userId: string, path: unknown) {
  if (typeof path !== "string" || !path.startsWith(`${userId}/`) || path.includes("..")) throw new HttpError(400, "Ungültiger Pfad.");
  const { data, error } = await admin().storage.from(BUCKET).download(path);
  if (error || !data) throw new HttpError(404, "Ein Bild konnte nicht geladen werden.");
  return data;
}
async function upload(userId: string, out: Out, name: string) {
  const ext = out.type === "image/jpeg" ? "jpg" : "png";
  const path = `${userId}/${name}-${crypto.randomUUID()}.${ext}`;
  const { error } = await admin().storage.from(BUCKET).upload(path, new Blob([out.bytes as Uint8Array<ArrayBuffer>], { type: out.type }), { contentType: out.type });
  if (error) throw new HttpError(500, "Das Bild konnte nicht gespeichert werden.");
  return path;
}
/** Ohne KI-Schlüssel (AI_MOCK=1) wird einfach ein Eingangsbild zurückgegeben. */
async function passthrough(blob: Blob): Promise<Out> {
  await new Promise((r) => setTimeout(r, 1500));
  return { bytes: new Uint8Array(await blob.arrayBuffer()), type: blob.type || "image/png" };
}
const png = (bytes: Uint8Array): Out => ({ bytes, type: "image/png" });

async function avatar(userId: string, input: unknown) {
  const { selfie_path, body_path } = z.object({ selfie_path: z.string(), body_path: z.string() }).parse(input);
  const [selfie, body] = await Promise.all([download(userId, selfie_path), download(userId, body_path)]);
  const out = mock()
    ? await passthrough(body)
    : png(
        await editImages(
          [{ blob: selfie, name: "selfie.jpg" }, { blob: body, name: "body.jpg" }],
          `Create a photorealistic full-body fashion avatar of this exact person. Image 1 shows the face, image 2 shows the body shape. Preserve face, skin tone, hair and body proportions faithfully. Standing straight, relaxed neutral pose, arms slightly away from the body, facing the camera, whole body visible from head to feet with some margin. Wearing simple gender-neutral basics: ${AVATAR_BASICS}. Clean bright warm off-white seamless studio background, soft even studio lighting, high-end e-commerce look. No text.`,
          { mode: "quality", size: "1024x1536" },
        ),
      );
  const path = await upload(userId, out, "avatar");
  const { error } = await admin().from("profiles").upsert({ id: userId, avatar_path: path, selfie_path, body_path, updated_at: new Date().toISOString() });
  if (error) throw new HttpError(500, "Der Avatar konnte nicht gespeichert werden.");
  return path;
}

async function tryon(userId: string, input: unknown) {
  const { item_ids, mode } = z.object({ item_ids: z.array(z.string().uuid()).min(1).max(6), mode: z.enum(["fast", "quality"]) }).parse(input);
  const db = admin();
  const { data: profile } = await db.from("profiles").select("avatar_path").eq("id", userId).maybeSingle();
  const avatarPath = profile?.avatar_path as string | undefined;
  if (!avatarPath) throw new HttpError(400, "Bitte erstelle zuerst deinen Avatar.");

  const key = comboKey(item_ids, avatarPath, mode as Mode);
  const { data: cached } = await db.from("tryon_cache").select("image_path").eq("user_id", userId).eq("combo_key", key).maybeSingle();
  if (cached?.image_path) return cached.image_path as string;

  const { data: rows } = await db.from("items").select("id,name,category,cutout_path,original_path").eq("user_id", userId).in("id", item_ids);
  const list = ((rows ?? []) as { id: string; name: string; category: string; cutout_path: string | null; original_path: string | null }[]).filter((i) => i.cutout_path ?? i.original_path);
  if (!list.length) throw new HttpError(400, "Die gewählten Teile haben noch kein Foto.");

  const person = await download(userId, avatarPath);
  let out: Out;
  if (mock()) out = await passthrough(person);
  else {
    const garments = await Promise.all(list.map((i) => download(userId, i.cutout_path ?? i.original_path)));
    const desc = list.map((i, n) => `image ${n + 2}: ${categoryLabel(i.category)} – ${i.name}`).join("; ");
    const rows = new Set(list.map((i) => rowOf(i.category)));
    const keep = [
      !rows.has("oberteil") && "the plain light grey t-shirt",
      !rows.has("unten") && "the plain light grey shorts",
      !rows.has("schuhe") && "the white sneakers",
    ].filter(Boolean);
    const dress = list.some((i) => i.category === "rock_kleid") && !rows.has("oberteil");
    out = png(
      await editImages(
        [{ blob: person, name: "person.png" }, ...garments.map((b, n) => ({ blob: b, name: `garment${n + 1}.png` }))],
        `Virtual try-on. Image 1 is the person: keep exactly the same face, hair, body, pose, framing, lighting and the plain off-white studio background. Dress this person in the clothing shown in the other images: ${desc}. ${keep.length ? `Keep ${keep.join(", ")} from image 1 unchanged${dress ? " (if the selected garment is a full dress, it replaces the t-shirt as well)" : ""}.` : ""} Do not add any jacket, accessory or other garment that is not shown in the reference images. Each garment must keep its exact colour, logos, pattern, texture and cut, fitted naturally with realistic drape and shadows. Full body visible from head to feet. Photorealistic high-end fashion e-commerce photo. No text.`,
        { mode: mode as Mode, size: "1024x1536" },
      ),
    );
  }
  const path = await upload(userId, out, "tryon");
  await db.from("tryon_cache").upsert({ user_id: userId, combo_key: key, image_path: path }, { onConflict: "user_id,combo_key" });
  return path;
}

async function beautify(userId: string, input: unknown) {
  const { item_id } = z.object({ item_id: z.string().uuid() }).parse(input);
  const db = admin();
  const { data: item } = await db.from("items").select("original_path,cutout_path").eq("id", item_id).eq("user_id", userId).maybeSingle();
  const src = (item?.original_path ?? item?.cutout_path) as string | undefined;
  if (!src) throw new HttpError(404, "Dieses Teil hat noch kein Foto.");
  const original = await download(userId, src);
  const out = mock()
    ? await passthrough(original)
    : png(
        await editImages(
          [{ blob: original, name: "item.jpg" }],
          "Extract only the main clothing item as a clean e-commerce product shot: the garment alone, laid flat or ghost-mannequin style, centered, fully visible, on a pure white background with a soft subtle shadow. No person, hanger, other objects or added text. Preserve the exact logos, lettering, buttons, colour, pattern, material and details of the reference garment.",
          { mode: "quality", size: "1024x1024" },
        ),
      );
  const path = await upload(userId, out, "product");
  // Nur das Freistellbild wird ersetzt – das Originalfoto bleibt erhalten.
  const { error } = await db.from("items").update({ cutout_path: path }).eq("id", item_id).eq("user_id", userId);
  if (error) throw new HttpError(500, "Das Produktfoto konnte nicht gespeichert werden.");
  return path;
}

/**
 * Führt einen KI-Bildauftrag aus (Avatar, Anprobe, Produktfoto) und trägt das Ergebnis in die Tabelle jobs ein.
 * Läuft bei Netlify als Background Function; der Browser wartet über die Tabelle auf das Ergebnis.
 */
export default async function handler(req: Request): Promise<Response> {
  let jobId: string | undefined;
  let userId: string | undefined;
  try {
    if (req.method !== "POST") throw new HttpError(405, "Nicht erlaubt.");
    userId = (await requireUser(req)).id;
    jobId = z.object({ jobId: z.string().uuid() }).parse(await req.json()).jobId;
    const db = admin();
    const { data: job } = await db.from("jobs").select("kind,status,input").eq("id", jobId).eq("user_id", userId).maybeSingle();
    if (!job) throw new HttpError(404, "Auftrag nicht gefunden.");
    if (job.status !== "pending") return json({ ok: true });

    const path = job.kind === "avatar" ? await avatar(userId, job.input) : job.kind === "tryon" ? await tryon(userId, job.input) : await beautify(userId, job.input);
    await db.from("jobs").update({ status: "done", result: { path }, finished_at: new Date().toISOString() }).eq("id", jobId).eq("user_id", userId);
    return json({ ok: true });
  } catch (e) {
    const message = e instanceof HttpError ? e.message : "Das hat gerade nicht geklappt. Bitte versuche es erneut.";
    if (!(e instanceof HttpError)) console.error("[job] unerwarteter Fehler", e);
    if (jobId && userId)
      await admin().from("jobs").update({ status: "error", error: message, finished_at: new Date().toISOString() }).eq("id", jobId).eq("user_id", userId).eq("status", "pending");
    return json({ error: message }, e instanceof HttpError ? e.status : 500);
  }
}
