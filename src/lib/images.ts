/** Bild laden und – auch bei Handyfotos mit EXIF-Drehung – richtig herum als Bitmap liefern. */
export async function toBitmap(blob: Blob) {
  try {
    return await createImageBitmap(blob, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Dieses Bildformat kann nicht gelesen werden. Bitte nutze JPG, PNG oder WebP.");
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Bild konnte nicht verarbeitet werden."))), type, quality));
}

/** Verkleinert auf höchstens `max` Pixel Kantenlänge. JPEG bekommt weißen Hintergrund. */
export async function resizeImage(blob: Blob, max: number, type: "image/jpeg" | "image/png" = "image/jpeg", quality = 0.88) {
  const bmp = await toBitmap(blob);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bmp.width * scale));
  canvas.height = Math.max(1, Math.round(bmp.height * scale));
  const ctx = canvas.getContext("2d")!;
  if (type === "image/jpeg") {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return canvasToBlob(canvas, type, quality);
}

/** Grenzen aller nicht transparenten Pixel. */
export function alphaBounds(pixels: Uint8ClampedArray, width: number, height: number) {
  let left = width, top = height, right = -1, bottom = -1, count = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if ((pixels[(y * width + x) * 4 + 3] ?? 0) > 12) {
        count++;
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
  if (right < left) return null;
  return { left, top, width: right - left + 1, height: bottom - top + 1, coverage: count / (width * height) };
}

/** Freigestelltes PNG auf das Teil zuschneiden, zentrieren und mit etwas Rand auf höchstens `max` Pixel bringen. */
export async function cropToContent(png: Blob, max = 1024, pad = 0.06) {
  const bmp = await toBitmap(png);
  const src = document.createElement("canvas");
  src.width = bmp.width;
  src.height = bmp.height;
  const sctx = src.getContext("2d", { willReadFrequently: true })!;
  sctx.drawImage(bmp, 0, 0);
  bmp.close();
  const b = alphaBounds(sctx.getImageData(0, 0, src.width, src.height).data, src.width, src.height);
  // Fast nichts übrig: Das Freistellen hat kein Kleidungsstück gefunden.
  if (!b || b.coverage < 0.01) return null;
  const scale = Math.min(1, (max * (1 - 2 * pad)) / Math.max(b.width, b.height));
  const w = Math.round(b.width * scale), h = Math.round(b.height * scale);
  const m = Math.round(Math.max(w, h) * pad);
  const out = document.createElement("canvas");
  out.width = w + 2 * m;
  out.height = h + 2 * m;
  const octx = out.getContext("2d")!;
  octx.imageSmoothingQuality = "high";
  octx.drawImage(src, b.left, b.top, b.width, b.height, m, m, w, h);
  return canvasToBlob(out, "image/png");
}

export function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("Datei konnte nicht gelesen werden."));
    r.readAsDataURL(blob);
  });
}
export async function dataUrlToBlob(url: string) {
  return (await fetch(url)).blob();
}
