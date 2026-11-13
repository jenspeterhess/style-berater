import { useSyncExternalStore } from "react";
import { callApi } from "./api";
import { supabase } from "./supabase";
import type { Job, JobKind } from "@shared/wardrobe";

// Laufende KI-Bildaufträge. Sie überleben Seitenwechsel innerhalb der App, damit niemand vor dem Ladebild warten muss.
const inflight = new Map<string, Promise<string>>();
const listeners = new Set<() => void>();
let version = 0;
const notify = () => {
  version++;
  listeners.forEach((l) => l());
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function poll(jobId: string): Promise<string> {
  const started = Date.now();
  // Bildaufträge dauern je nach Qualität 20 Sekunden bis wenige Minuten.
  while (Date.now() - started < 8 * 60_000) {
    await wait(Date.now() - started < 20_000 ? 1500 : 3000);
    const { data } = await supabase.from("jobs").select("status,result,error").eq("id", jobId).maybeSingle();
    const job = data as Pick<Job, "status" | "result" | "error"> | null;
    if (job?.status === "done" && job.result?.path) return job.result.path;
    if (job?.status === "error") throw new Error(job.error ?? "Das hat gerade nicht geklappt. Bitte versuche es erneut.");
  }
  throw new Error("Das dauert ungewöhnlich lange. Bitte versuche es später erneut.");
}

/**
 * Startet einen Bildauftrag (oder hängt sich an einen laufenden mit demselben Schlüssel) und liefert den Speicherpfad des Ergebnisses.
 */
export function runJob(key: string, kind: JobKind, input: Record<string, unknown>): Promise<string> {
  const existing = inflight.get(key);
  if (existing) return existing;
  const promise = (async () => {
    const { data, error } = await supabase.from("jobs").insert({ kind, input }).select("id").single();
    if (error || !data) throw new Error("Der Auftrag konnte nicht gestartet werden. Bitte versuche es erneut.");
    await callApi("/.netlify/functions/job-background", { jobId: data.id });
    return poll(data.id as string);
  })().finally(() => {
    inflight.delete(key);
    notify();
  });
  inflight.set(key, promise);
  notify();
  return promise;
}

/** Läuft gerade ein Auftrag mit diesem Schlüssel? */
export function useJobRunning(key: string | null) {
  useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => version,
  );
  return key ? inflight.has(key) : false;
}
export const jobPromise = (key: string) => inflight.get(key);
