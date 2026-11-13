import { cropToContent, resizeImage } from "./images";

type Msg = { progress?: { key: string; current: number; total: number }; blob?: Blob; error?: string };

/**
 * Stellt ein Kleidungsstück frei. Gibt `null` zurück, wenn kein Teil erkannt wurde oder das Freistellen
 * auf diesem Gerät nicht möglich ist – das Foto kann dann trotzdem gespeichert werden.
 * `onProgress` liefert 0…1: erst das Laden des Modells (einmalig), dann die Berechnung.
 */
export async function cutout(photo: Blob, onProgress?: (p: number, phase: "laden" | "freistellen") => void): Promise<Blob | null> {
  const input = await resizeImage(photo, 1280, "image/jpeg", 0.92);
  const worker = new Worker(new URL("./bg-removal.worker.ts", import.meta.url), { type: "module" });
  try {
    const raw = await new Promise<Blob>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("timeout")), 120_000);
      worker.onmessage = (e: MessageEvent<Msg>) => {
        const { progress, blob, error } = e.data;
        if (progress && progress.total > 0) {
          const loading = progress.key.startsWith("fetch");
          onProgress?.(Math.min(1, progress.current / progress.total), loading ? "laden" : "freistellen");
        }
        if (blob) (clearTimeout(timeout), resolve(blob));
        if (error) (clearTimeout(timeout), reject(new Error(error)));
      };
      worker.onerror = () => (clearTimeout(timeout), reject(new Error("worker")));
      worker.postMessage(input);
    });
    return await cropToContent(raw);
  } catch (e) {
    console.warn("Freistellen nicht möglich", e);
    return null;
  } finally {
    worker.terminate();
  }
}
