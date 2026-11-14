import { useRef } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, Check, ChevronRight, Images, RotateCw, X } from "lucide-react";
import { toast } from "sonner";
import { clearDone, dismiss, enqueue, retry, useCaptureQueue } from "@/lib/capture-queue";
import { ImportZone } from "@/components/ImportZone";
import { useActivePerson } from "@/lib/people";
import { FileInput, ItemImage, PageHeader, ProgressBar } from "@/components/ui";
import { cap, categoryLabel } from "@shared/wardrobe";

export default function Capture() {
  const qc = useQueryClient();
  const queue = useCaptureQueue();
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const done = queue.filter((e) => e.item).length;
  const { active } = useActivePerson();

  function add(files: File[]) {
    if (!enqueue(files, qc, active?.id ?? null)) toast.error("Bitte wähle Fotos aus (JPG, PNG oder WebP).");
  }

  const tile = "flex flex-1 flex-col items-center gap-3 rounded-(--radius-card) px-4 py-7 text-center shadow-soft transition active:scale-[0.98]";
  return (
    <div>
      <PageHeader title="Neues Teil" subtitle={active ? `Ein Foto genügt. Das Teil landet im Schrank von ${active.name}.` : "Ein Foto genügt. Freistellen, Erkennen und Speichern passieren von selbst."} />
      <div className="flex gap-3.5 px-5">
        <button type="button" className={`${tile} bg-primary text-primary-foreground`} onClick={() => camera.current?.click()}>
          <Camera className="size-7" strokeWidth={1.5} />
          <span className="font-semibold">Foto aufnehmen</span>
        </button>
        <button type="button" className={`${tile} bg-card`} onClick={() => gallery.current?.click()}>
          <Images className="size-7" strokeWidth={1.5} />
          <span className="font-semibold">Aus Galerie</span>
          <span className="-mt-2 text-xs text-muted-foreground">auch mehrere auf einmal</span>
        </button>
        <FileInput inputRef={camera} accept="image/*" capture="environment" onFiles={add} />
        <FileInput inputRef={gallery} accept="image/*" multiple onFiles={add} />
      </div>
      <p className="mt-3 px-7 text-xs leading-relaxed text-muted-foreground">Am besten liegt das Teil flach auf einem ruhigen, kontrastreichen Untergrund.</p>

      {queue.length > 0 && (
        <section className="mt-6 px-5" aria-live="polite">
          <div className="mb-2.5 flex items-baseline justify-between">
            <h2 className="text-2xl">{done === queue.length ? "Im Schrank" : `${done} von ${queue.length} fertig`}</h2>
            {done > 0 && (
              <button type="button" className="text-sm font-semibold text-muted-foreground" onClick={clearDone}>
                Liste leeren
              </button>
            )}
          </div>
          <ul className="flex flex-col gap-2.5">
            {queue.map((e) => (
              <li key={e.id} className="flex animate-rise items-center gap-3.5 rounded-(--radius-card) bg-card p-2.5 shadow-soft">
                {e.item ? (
                  <ItemImage item={e.item} padded={false} className="size-[4.5rem] shrink-0 rounded-2xl p-1.5" />
                ) : (
                  <div className="relative size-[4.5rem] shrink-0 overflow-hidden rounded-2xl bg-muted">
                    <img src={e.preview} alt="" className="size-full object-cover" />
                    {!e.error && <div className="shimmer-overlay absolute inset-0" aria-hidden />}
                  </div>
                )}
                {e.item ? (
                  <Link to={`/teil/${e.item.id}`} className="flex min-w-0 flex-1 items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-[15px] font-semibold">
                        <Check className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="truncate">{e.item.name}</span>
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{[categoryLabel(e.item.category), ...e.item.colors.map(cap), cap(e.item.style)].join(" · ")}</p>
                      <p className="mt-1 text-xs font-semibold">Angaben prüfen</p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                ) : e.error ? (
                  <>
                    <p className="min-w-0 flex-1 text-sm text-destructive">{e.error}</p>
                    <button type="button" aria-label="Erneut versuchen" className="grid size-10 place-items-center rounded-full bg-muted" onClick={() => retry(e.id, qc)}>
                      <RotateCw className="size-4" />
                    </button>
                    <button type="button" aria-label="Entfernen" className="grid size-10 place-items-center rounded-full bg-muted" onClick={() => dismiss(e.id)}>
                      <X className="size-4" />
                    </button>
                  </>
                ) : (
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="truncate text-sm font-semibold">{e.stage.label}</p>
                    <div className="mt-2">
                      <ProgressBar value={e.stage.progress} />
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-7 flex items-center gap-3 px-7 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
        <span className="h-px flex-1 bg-border" />
        oder
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="mt-5 px-5">
        <ImportZone />
      </div>
    </div>
  );
}
