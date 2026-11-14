import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Camera, Heart, ImagePlus, Shirt, Sparkles, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/api";
import { byStatus, useDeleteItem, useItems, useUpdateItem } from "@/lib/data";
import { runJob, useJobRunning } from "@/lib/jobs";
import { replacePhoto, type Stage } from "@/lib/pipelines";
import { useSuggest } from "@/lib/suggest";
import { LookCard } from "@/components/LookCard";
import { Button, Chip, Confirm, Field, FileInput, IconButton, ItemImage, ModeToggle, ProgressBar, RenderOverlay, Spinner, StorageImage, cx, inputClass, useStoredMode } from "@/components/ui";
import { ARTIFACT } from "@/lib/target";
import { AUDIENCES, CATEGORIES, COLORS, COLOR_SWATCH, SEASONS, STYLES, cap, type Item, type Suggestion } from "@shared/wardrobe";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2.5 font-sans text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>
      {children}
    </section>
  );
}

/** Textfeld, das beim Verlassen speichert. */
function Saved({ value, onSave, ...rest }: { value: string; onSave: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return <input {...rest} value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v.trim() !== value && onSave(v.trim())} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} />;
}

function Outfits({ item, wardrobe }: { item: Item; wardrobe: Item[] }) {
  const suggest = useSuggest();
  const [mode, setMode] = useStoredMode();
  const [list, setList] = useState<Suggestion[] | null>(null);
  const enough = wardrobe.length >= 2;

  function load() {
    suggest.mutate({ items: wardrobe, anchorId: item.id, count: 4 }, { onSuccess: setList, onError: (e) => toast.error(errorMessage(e)) });
  }

  return (
    <section className="mt-8">
      <h2 className="px-5 text-2xl">Outfits mit diesem Teil</h2>
      {list && list.length > 0 && !ARTIFACT && (
        <div className="mt-2.5 flex items-center justify-between gap-3 px-5">
          <span className="text-xs text-muted-foreground">Bildqualität am Avatar</span>
          <ModeToggle mode={mode} onChange={setMode} />
        </div>
      )}
      {!list ? (
        <div className="mt-3 px-5">
          {enough ? (
            <Button variant="soft" block busy={suggest.isPending} onClick={load}>
              {!suggest.isPending && <Sparkles className="size-4" />}
              {suggest.isPending ? "Deine Stylistin überlegt" : "Vorschläge zeigen"}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">Sobald mindestens zwei Teile im Schrank sind, bekommst du hier passende Kombinationen.</p>
          )}
        </div>
      ) : list.length === 0 ? (
        <p className="mt-2 px-5 text-sm text-muted-foreground">Zu diesem Teil gibt es noch keine passende Kombination im Schrank. Erfasse ein paar weitere Teile.</p>
      ) : (
        <div className="no-scrollbar mt-3 flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-5 pb-2">
          {list.map((s, i) => (
            <LookCard key={i} suggestion={s} items={wardrobe} mode={mode} className="w-[78%] shrink-0 snap-center" />
          ))}
        </div>
      )}
    </section>
  );
}

export default function ItemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const items = useItems();
  const item = items.data?.find((i) => i.id === id);
  const update = useUpdateItem();
  const remove = useDeleteItem();
  const [confirm, setConfirm] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [stage, setStage] = useState<Stage | null>(null);
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const beautifyKey = id ? `beautify:${id}` : null;
  const beautifying = useJobRunning(beautifyKey);

  if (items.isPending)
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner />
      </div>
    );
  if (!item)
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-8 text-center">
        <h1 className="text-3xl">Teil nicht gefunden</h1>
        <Button className="mt-6" onClick={() => navigate("/schrank")}>
          Zum Schrank
        </Button>
      </div>
    );

  const patch = (p: Partial<Item>) => update.mutate({ id: item.id, patch: p }, { onError: (e) => toast.error(errorMessage(e)) });
  const hasPhoto = !!(item.cutout_path ?? item.original_path);
  const back = () => (history.length > 1 ? navigate(-1) : navigate("/schrank"));

  async function newPhoto(files: File[]) {
    try {
      await replacePhoto(item!, files[0]!, setStage);
      await qc.invalidateQueries({ queryKey: ["items"] });
      toast.success("Foto gespeichert");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setStage(null);
    }
  }

  function beautify() {
    runJob(beautifyKey!, "beautify", { item_id: item!.id })
      .then(() => (qc.invalidateQueries({ queryKey: ["items"] }), toast.success("Produktfoto ist fertig")))
      .catch((e) => toast.error(errorMessage(e)));
  }

  function toggleColor(c: string) {
    if (item!.colors.includes(c)) return patch({ colors: item!.colors.filter((x) => x !== c) });
    if (item!.colors.length >= 3) return toast.message("Höchstens drei Farben – tippe erst eine an, um sie zu entfernen.");
    patch({ colors: [...item!.colors, c] });
  }

  return (
    <div className="pb-[calc(env(safe-area-inset-bottom)+2.5rem)]">
      <div className="relative">
        {showOriginal && item.original_path ? <StorageImage path={item.original_path} alt={`${item.name} – Originalfoto`} fit="cover" className="aspect-[4/5] w-full bg-muted" /> : <ItemImage item={item} className="aspect-[4/5] w-full p-8" />}
        {(stage || beautifying) && <RenderOverlay label={stage?.label ?? "Produktfoto entsteht"} hint={beautifying ? "etwa eine Minute" : undefined} />}
        <div className="absolute inset-x-4 top-[calc(env(safe-area-inset-top)+0.75rem)] flex justify-between">
          <IconButton label="Zurück" onClick={back}>
            <ArrowLeft className="size-5" />
          </IconButton>
          <IconButton label="Teil löschen" onClick={() => setConfirm(true)}>
            <Trash2 className="size-[18px]" />
          </IconButton>
        </div>
        {item.original_path && item.cutout_path && (
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 rounded-full bg-card/90 p-1 text-xs font-semibold shadow-soft backdrop-blur">
            {[false, true].map((o) => (
              <button key={String(o)} type="button" aria-pressed={showOriginal === o} onClick={() => setShowOriginal(o)} className={cx("h-7 rounded-full px-3 transition", showOriginal === o ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
                {o ? "Original" : "Freigestellt"}
              </button>
            ))}
          </div>
        )}
      </div>
      {stage?.progress != null && (
        <div className="px-5 pt-3">
          <ProgressBar value={stage.progress} />
        </div>
      )}

      <div className="px-5 pt-5">
        <Saved aria-label="Name" value={item.name} onSave={(name) => name && patch({ name })} className="w-full bg-transparent font-serif text-[2rem] leading-tight focus:outline-none" />

        {item.status !== "wardrobe" && (
          <div className="mt-4 rounded-(--radius-card) bg-accent p-4">
            <p className="text-sm font-semibold">{item.status === "inbox" ? "Dieses Teil liegt noch im Eingang." : "Dieses Teil steht auf deiner Wunschliste."}</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" className="flex-1" onClick={() => (patch({ status: "wardrobe" }), toast.success("Im Schrank"))}>
                <Shirt className="size-4" /> In den Schrank
              </Button>
              {item.status === "inbox" && (
                <Button size="sm" variant="soft" className="flex-1 bg-card" onClick={() => (patch({ status: "wishlist" }), toast.success("Auf der Wunschliste"))}>
                  <Heart className="size-4" /> Als Wunsch
                </Button>
              )}
            </div>
          </div>
        )}

        <Section title="Kategorie">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <Chip key={c.id} active={item.category === c.id} onClick={() => patch({ category: c.id })}>
                {c.label}
              </Chip>
            ))}
          </div>
        </Section>
        <Section title="Für">
          <div className="flex flex-wrap gap-2">
            {AUDIENCES.map((a) => (
              <Chip key={a.id} active={item.audience === a.id} onClick={() => patch({ audience: item.audience === a.id ? null : a.id })}>
                {a.label}
              </Chip>
            ))}
          </div>
        </Section>
        <Section title="Farben (bis zu drei)">
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <Chip key={c} swatch={COLOR_SWATCH[c]} active={item.colors.includes(c)} onClick={() => toggleColor(c)}>
                {cap(c)}
              </Chip>
            ))}
          </div>
        </Section>
        <Section title="Stil">
          <div className="flex flex-wrap gap-2">
            {STYLES.map((s) => (
              <Chip key={s} active={item.style === s} onClick={() => patch({ style: s })}>
                {cap(s)}
              </Chip>
            ))}
          </div>
        </Section>
        <Section title="Saison">
          <div className="flex flex-wrap gap-2">
            {SEASONS.map((s) => (
              <Chip key={s} active={item.season === s} onClick={() => patch({ season: s })}>
                {cap(s)}
              </Chip>
            ))}
          </div>
        </Section>

        <Section title="Kaufangaben">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Marke">
              <Saved className={inputClass} value={item.brand ?? ""} onSave={(v) => patch({ brand: v || null })} placeholder="–" />
            </Field>
            <Field label="Store">
              <Saved className={inputClass} value={item.store ?? ""} onSave={(v) => patch({ store: v || null })} placeholder="–" />
            </Field>
            <Field label={`Preis (${item.currency || "EUR"})`}>
              <Saved
                className={inputClass}
                inputMode="decimal"
                value={item.price != null ? String(item.price).replace(".", ",") : ""}
                placeholder="–"
                onSave={(v) => {
                  if (!v) return patch({ price: null });
                  const n = Number(v.replace(/\s/g, "").replace(",", "."));
                  if (Number.isFinite(n) && n >= 0) patch({ price: Math.round(n * 100) / 100, currency: item.currency || "EUR" });
                  else toast.error("Bitte gib den Preis als Zahl ein, z. B. 49,90.");
                }}
              />
            </Field>
            <Field label="Kaufdatum">
              <input type="date" className={inputClass} value={item.purchase_date ?? ""} max={new Date().toISOString().slice(0, 10)} onChange={(e) => patch({ purchase_date: e.target.value || null })} />
            </Field>
          </div>
        </Section>

        <Section title="Foto">
          <div className="flex flex-col gap-2.5">
            <div className="flex gap-2.5">
              <Button variant="soft" className="flex-1" disabled={!!stage || beautifying} onClick={() => camera.current?.click()}>
                <Camera className="size-4" /> Kamera
              </Button>
              <Button variant="soft" className="flex-1" disabled={!!stage || beautifying} onClick={() => gallery.current?.click()}>
                <ImagePlus className="size-4" /> Galerie
              </Button>
            </div>
            {hasPhoto && !ARTIFACT && (
              <Button variant="soft" block busy={beautifying} disabled={!!stage} onClick={beautify}>
                {!beautifying && <Wand2 className="size-4" />} Als Produktfoto aufhübschen
              </Button>
            )}
            <p className="text-xs leading-relaxed text-muted-foreground">
              {hasPhoto ? (ARTIFACT ? "Ein neues Foto ersetzt das bisherige. Auf ruhigem, kontrastreichem Untergrund gelingt das Freistellen am besten." : "Aufhübschen erzeugt per KI einen Shop-Look und ersetzt nur das Freistellbild. Dein Originalfoto bleibt erhalten.") : "Mit einem eigenen Foto kannst du dieses Teil auch anprobieren."}
            </p>
          </div>
          <FileInput inputRef={camera} accept="image/*" capture="environment" onFiles={newPhoto} />
          <FileInput inputRef={gallery} accept="image/*" onFiles={newPhoto} />
        </Section>
      </div>

      {item.status === "wardrobe" && <Outfits key={item.id} item={item} wardrobe={byStatus(items.data, "wardrobe")} />}

      <Confirm
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Teil löschen?"
        text={`„${item.name}“ wird samt Fotos gelöscht. Gespeicherte Looks behalten ihr Bild.`}
        action="Löschen"
        busy={remove.isPending}
        onConfirm={() => remove.mutate(item, { onSuccess: () => navigate("/schrank", { replace: true }), onError: (e) => toast.error(errorMessage(e)) })}
      />
    </div>
  );
}
