import { useState } from "react";
import { Link } from "react-router-dom";
import { BookHeart, Check, SlidersHorizontal, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/api";
import { useSaveOutfit } from "@/lib/data";
import { useTryOn } from "@/lib/tryon";
import { Button, ItemImage, RenderOverlay, StorageImage, cx } from "./ui";
import { AvatarLook } from "./AvatarLook";
import { ARTIFACT } from "@/lib/target";
import type { Item, Mode, Suggestion } from "@shared/wardrobe";

/** Teile eines Looks als ruhige Collage – solange es noch kein Bild am Avatar gibt. */
export function Collage({ items, className }: { items: Item[]; className?: string }) {
  const n = Math.min(items.length, 4);
  return (
    <div className={cx("studio-bg grid gap-1 p-3", n <= 1 ? "grid-cols-1" : "grid-cols-2", className)}>
      {items.slice(0, 4).map((i, idx) => (
        <ItemImage key={i.id} item={i} padded={false} className={cx("min-h-0 bg-none!", n === 3 && idx === 0 && "row-span-2")} />
      ))}
    </div>
  );
}

/**
 * Ein Outfit-Vorschlag: erst als Collage, auf Wunsch als Anprobe-Bild am Avatar, mit Speichern ins Lookbook.
 * Das Bild wird erst auf Tippen erzeugt, damit kein Guthaben für ungesehene Vorschläge verbraucht wird.
 */
export function LookCard({ suggestion, items, mode, occasion, className }: { suggestion: Suggestion; items: Item[]; mode: Mode; occasion?: string; className?: string }) {
  const parts = suggestion.item_ids.map((id) => items.find((i) => i.id === id)).filter((i): i is Item => !!i);
  const wearableIds = parts.filter((i) => i.cutout_path ?? i.original_path).map((i) => i.id);
  const tryOn = useTryOn(wearableIds, mode);
  const save = useSaveOutfit();
  const [saved, setSaved] = useState(false);

  return (
    <article className={cx("flex flex-col overflow-hidden rounded-(--radius-card) bg-card shadow-soft", className)}>
      <div className={cx("relative w-full", ARTIFACT || tryOn.imagePath || tryOn.running ? "aspect-[2/3]" : "aspect-[4/5]")}>
        {ARTIFACT ? <AvatarLook avatarPath={tryOn.avatarPath} items={parts} className="size-full" /> : tryOn.imagePath ? <StorageImage path={tryOn.imagePath} alt={`${suggestion.title} an deinem Avatar`} fit="cover" className="studio-bg size-full" /> : <Collage items={parts} className="size-full" />}
        {tryOn.running && <RenderOverlay label="Dein Look entsteht" hint={mode === "quality" ? "etwa eine Minute" : "etwa 20 Sekunden"} />}
      </div>
      <div className="flex flex-1 flex-col px-4 pt-3.5 pb-4">
        <h3 className="text-2xl leading-tight">{suggestion.title}</h3>
        <p className="mt-1 text-sm leading-snug text-muted-foreground">{suggestion.reason}</p>
        <div className="mt-auto flex gap-2 pt-4">
          {ARTIFACT || tryOn.imagePath ? (
            <Button
              size="sm"
              variant={saved ? "soft" : "primary"}
              className="flex-1"
              busy={save.isPending}
              disabled={saved}
              onClick={() =>
                save.mutate(
                  { title: suggestion.title, reason: suggestion.reason, item_ids: suggestion.item_ids, image_path: tryOn.imagePath, mode, person_id: tryOn.personId, occasion: occasion ?? null },
                  { onSuccess: () => (setSaved(true), toast.success("Im Lookbook gespeichert")), onError: (e) => toast.error(errorMessage(e)) },
                )
              }
            >
              {saved ? <Check className="size-4" /> : <BookHeart className="size-4" />}
              {saved ? "Gespeichert" : "Speichern"}
            </Button>
          ) : !tryOn.avatarPath ? (
            <Link to="/avatar" className="flex h-10 flex-1 items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground">
              Erst Avatar erstellen
            </Link>
          ) : (
            <Button size="sm" className="flex-1" busy={tryOn.running} disabled={!wearableIds.length || tryOn.checking} onClick={tryOn.start}>
              {!tryOn.running && <Sparkles className="size-4" />}
              {tryOn.running ? "Wird erstellt" : "Am Avatar zeigen"}
            </Button>
          )}
          <Link to={`/anprobe?teile=${wearableIds.join(",")}`} aria-label="In der Anprobe anpassen" title="In der Anprobe anpassen" className="grid size-10 shrink-0 place-items-center rounded-full bg-muted">
            <SlidersHorizontal className="size-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}
