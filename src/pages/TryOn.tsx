import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BookHeart, Check, RotateCcw, Shirt, Sparkles, UserRound } from "lucide-react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/api";
import { byStatus, useItems, useSaveOutfit, wearable } from "@/lib/data";
import { useTryOn } from "@/lib/tryon";
import { Button, Empty, ItemImage, ModeToggle, PageHeader, RenderOverlay, Spinner, StorageImage, cx, useStoredMode } from "@/components/ui";
import { TRYON_ROWS, formatDate, rowOf, type Item } from "@shared/wardrobe";

type Selection = Record<string, string | undefined>;

export default function TryOn() {
  const items = useItems();
  const list = useMemo(() => wearable(items.data), [items.data]);
  const [params] = useSearchParams();
  const [mode, setMode] = useStoredMode();
  const [picked, setPicked] = useState<Selection | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const save = useSaveOutfit();

  // Vorauswahl aus einem Vorschlag oder Look (?teile=…), sobald der Schrank geladen ist.
  const selection: Selection = useMemo(() => {
    if (picked) return picked;
    const initial: Selection = {};
    for (const id of (params.get("teile") ?? "").split(",")) {
      const item = list.find((i) => i.id === id);
      if (item) initial[rowOf(item.category)] = item.id;
    }
    return initial;
  }, [picked, params, list]);

  const ids = TRYON_ROWS.map((r) => selection[r.id]).filter((id): id is string => !!id && list.some((i) => i.id === id));
  const tryOn = useTryOn(ids, mode);
  const without = byStatus(items.data, "wardrobe").length - list.length;

  const toggle = (item: Item) => {
    const row = rowOf(item.category);
    setPicked({ ...selection, [row]: selection[row] === item.id ? undefined : item.id });
  };

  if (items.isPending)
    return (
      <div className="grid min-h-[70dvh] place-items-center">
        <Spinner />
      </div>
    );

  if (!tryOn.avatarPath)
    return (
      <div>
        <PageHeader title="Anprobe" />
        <Empty icon={UserRound} title="Erst dein Avatar" text="Mit einem Selfie und einem Ganzkörperfoto entsteht dein Avatar. An ihm probierst du dann jedes Outfit an.">
          <Link to="/avatar" className="flex h-13 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">
            Avatar erstellen
          </Link>
        </Empty>
      </div>
    );

  const shown = tryOn.imagePath;
  const saved = !!shown && savedKey === tryOn.key;
  return (
    <div className="pb-20">
      <PageHeader title="Anprobe" action={<ModeToggle mode={mode} onChange={setMode} />} />
      <div className="relative mx-5 overflow-hidden rounded-(--radius-card) shadow-soft">
        <StorageImage path={shown ?? tryOn.avatarPath} alt={shown ? "Deine Auswahl an deinem Avatar" : "Dein Avatar"} fit="cover" className="studio-bg aspect-[2/3] max-h-[58dvh] w-full" />
        {tryOn.running && <RenderOverlay label="Dein Look entsteht" hint={mode === "quality" ? "etwa eine Minute – du kannst solange weiterstöbern" : "etwa 20 Sekunden"} />}
        {ids.length > 0 && !shown && !tryOn.running && !tryOn.checking && <p className="absolute inset-x-0 bottom-3 mx-auto w-fit rounded-full bg-card/90 px-3.5 py-1.5 text-xs font-semibold shadow-soft backdrop-blur">Auswahl noch nicht anprobiert</p>}
      </div>

      {list.length === 0 ? (
        <div className="mt-6">
          <Empty icon={Shirt} title="Noch nichts zum Anprobieren" text={without > 0 ? "Deine Teile im Schrank haben noch kein Foto. Ergänze eines in der Detailansicht." : "Erfasse dein erstes Teil, dann kannst du es hier anprobieren."}>
            <Link to="/erfassen" className="flex h-13 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">
              Teil erfassen
            </Link>
          </Empty>
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-4">
          {TRYON_ROWS.map((row) => {
            const rowItems = list.filter((i) => (row.categories as readonly string[]).includes(i.category));
            if (!rowItems.length) return null;
            return (
              <section key={row.id}>
                <h2 className="px-5 font-sans text-xs font-semibold tracking-wide text-muted-foreground uppercase">{row.label}</h2>
                <div className="no-scrollbar mt-2 flex gap-2.5 overflow-x-auto px-5 py-1">
                  {rowItems.map((i) => {
                    const active = selection[row.id] === i.id;
                    return (
                      <button key={i.id} type="button" aria-pressed={active} aria-label={i.name} onClick={() => toggle(i)} className={cx("relative size-20 shrink-0 overflow-hidden rounded-2xl bg-card shadow-soft transition active:scale-95", active && "ring-2 ring-primary ring-offset-2 ring-offset-background")}>
                        <ItemImage item={i} padded={false} className="size-full p-1.5" />
                        {active && (
                          <span className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
                            <Check className="size-3" strokeWidth={3} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
          <p className="px-5 text-xs leading-relaxed text-muted-foreground">
            Was du nicht auswählst, bleibt bei den neutralen Basics deines Avatars.{without > 0 && ` ${without === 1 ? "1 Teil" : `${without} Teile`} ohne Foto ${without === 1 ? "ist" : "sind"} hier nicht dabei.`}
          </p>
        </div>
      )}

      {ids.length > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-30 mx-auto flex w-full max-w-md animate-rise gap-2 bg-gradient-to-t from-background via-background/95 to-transparent px-5 pt-6 pb-3">
          <button type="button" aria-label="Auswahl zurücksetzen" className="grid size-13 shrink-0 place-items-center rounded-full bg-card shadow-soft" onClick={() => setPicked({})}>
            <RotateCcw className="size-[18px]" />
          </button>
          {shown ? (
            <Button
              block
              variant={saved ? "soft" : "primary"}
              busy={save.isPending}
              disabled={saved}
              onClick={() =>
                save.mutate(
                  { title: `Look vom ${formatDate(new Date().toISOString())}`, item_ids: ids, image_path: shown, mode },
                  { onSuccess: () => (setSavedKey(tryOn.key), toast.success("Im Lookbook gespeichert")), onError: (e) => toast.error(errorMessage(e)) },
                )
              }
            >
              {saved ? <Check className="size-4" /> : <BookHeart className="size-4" />}
              {saved ? "Im Lookbook" : "Im Lookbook speichern"}
            </Button>
          ) : (
            <Button block busy={tryOn.running} disabled={tryOn.checking} onClick={tryOn.start}>
              {!tryOn.running && <Sparkles className="size-4" />}
              {tryOn.running ? "Wird erstellt" : `Anprobieren (${ids.length} ${ids.length === 1 ? "Teil" : "Teile"})`}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
