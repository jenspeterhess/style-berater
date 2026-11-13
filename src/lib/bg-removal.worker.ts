import { removeBackground } from "@imgly/background-removal";

// Läuft vollständig auf dem Gerät. Die Original-Pixel des Teils bleiben erhalten; es wird nichts neu gezeichnet.
self.onmessage = async (event: MessageEvent<Blob>) => {
  try {
    const blob = await removeBackground(event.data, {
      model: "isnet_fp16",
      device: "cpu",
      output: { format: "image/png" },
      progress: (key: string, current: number, total: number) => self.postMessage({ progress: { key, current, total } }),
    });
    self.postMessage({ blob });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : "Freistellen fehlgeschlagen" });
  }
};
