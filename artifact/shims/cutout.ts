import { cropToContent, toBitmap } from "@/lib/images";

/**
 * Freistellen ohne KI-Modell, komplett auf dem Gerät: Der Hintergrund wird vom Bildrand her erkannt
 * und transparent gemacht. Die Pixel des Teils bleiben unverändert.
 * Funktioniert, wenn das Teil auf einem ruhigen, kontrastreichen Untergrund liegt; sonst `null`.
 */
export async function cutout(photo: Blob, onProgress?: (p: number, phase: "laden" | "freistellen") => void): Promise<Blob | null> {
  try {
    onProgress?.(0.1, "freistellen");
    const bmp = await toBitmap(photo);
    const scale = Math.min(1, 1100 / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const img = ctx.getImageData(0, 0, w, h);
    const px = img.data;

    // 1) Hintergrundfarben = häufige Farben am Bildrand (auch mehrere, z. B. Holzdielen).
    const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
    let border = 0;
    const sample = (x: number, y: number) => {
      const i = (y * w + x) * 4;
      const key = ((px[i]! >> 4) << 8) | ((px[i + 1]! >> 4) << 4) | (px[i + 2]! >> 4);
      const b = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
      b.n++; b.r += px[i]!; b.g += px[i + 1]!; b.b += px[i + 2]!;
      buckets.set(key, b);
      border++;
    };
    const rim = Math.max(2, Math.round(Math.min(w, h) * 0.02));
    for (let x = 0; x < w; x += 2) for (let d = 0; d < rim; d++) (sample(x, d), sample(x, h - 1 - d));
    for (let y = 0; y < h; y += 2) for (let d = 0; d < rim; d++) (sample(d, y), sample(w - 1 - d, y));
    const palette = [...buckets.values()].filter((b) => b.n / border > 0.015).sort((a, b) => b.n - a.n).slice(0, 10).map((b) => [b.r / b.n, b.g / b.n, b.b / b.n] as const);
    if (!palette.length) return null;
    const TOL = 46 * 46;
    const isBg = (i: number) => {
      const r = px[i]!, g = px[i + 1]!, b = px[i + 2]!;
      for (const [pr, pg, pb] of palette) if ((r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2 < TOL) return true;
      return false;
    };
    onProgress?.(0.4, "freistellen");

    // 2) Vom Rand her alles Zusammenhängende in Hintergrundfarbe markieren.
    const mask = new Uint8Array(w * h); // 1 = Hintergrund
    const stack = new Int32Array(w * h);
    let top = 0;
    const push = (p: number) => {
      if (!mask[p] && isBg(p * 4)) {
        mask[p] = 1;
        stack[top++] = p;
      }
    };
    for (let x = 0; x < w; x++) (push(x), push((h - 1) * w + x));
    for (let y = 0; y < h; y++) (push(y * w), push(y * w + w - 1));
    while (top) {
      const p = stack[--top]!;
      const x = p % w;
      if (x > 0) push(p - 1);
      if (x < w - 1) push(p + 1);
      if (p >= w) push(p - w);
      if (p < w * (h - 1)) push(p + w);
    }
    onProgress?.(0.8, "freistellen");

    // 3) Kanten weich machen: Deckkraft = Anteil der Nicht-Hintergrund-Nachbarn.
    let kept = 0;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        let fg = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx, yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
            n++;
            if (!mask[yy * w + xx]) fg++;
          }
        const a = mask[p] ? 0 : Math.round((fg / n) * 255);
        px[p * 4 + 3] = a;
        if (a) kept++;
      }
    const share = kept / (w * h);
    // Fast alles oder fast nichts übrig: Der Untergrund war nicht eindeutig genug.
    if (share < 0.02 || share > 0.9) return null;
    ctx.putImageData(img, 0, 0);
    const png = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
    onProgress?.(1, "freistellen");
    return png ? await cropToContent(png, 900) : null;
  } catch (e) {
    console.warn("Freistellen nicht möglich", e);
    return null;
  }
}
