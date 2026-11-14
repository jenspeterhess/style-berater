// Im Artefakt gibt es keine KI-Bildaufträge.
export function runJob(): Promise<string> {
  return Promise.reject(new Error("KI-Bilder sind in dieser Version nicht verfügbar."));
}
export const useJobRunning = (_key: string | null) => false;
export const jobPromise = (_key: string) => undefined as Promise<string> | undefined;
