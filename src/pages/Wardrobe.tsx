import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Heart, Inbox, Shirt, SlidersHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/api";
import { byStatus, useDeleteImport, useDeleteItem, useImports, useItems, useUpdateItem } from "@/lib/data";
import { ImportZone } from "@/components/ImportZone";
import { Button, Chip, ChipRow, Confirm, Empty, ItemCard, PageHeader, Spinner, cx } from "@/components/ui";
import { CATEGORIES, COLORS, COLOR_SWATCH, OCCASIONS, cap, formatDate, formatPrice, type ImportRecord, type Item, type ItemStatus } from "@shared/wardrobe";

const TABS = [
  { id: "wardrobe", to: "/schrank", label: "Schrank" },
  { id: "wishlist", to: "/wunschliste", label: "Wünsche" },
  { id: "inbox", to: "/eingang", label: "Eingang" },
] as const;

function Grid({ items, tab }: { items: Item[]; tab: "wardrobe" | "wishlist" }) {
  const navigate = useNavigate();
  const [category, setCategory] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [occasion, setOccasion] = useState<string | null>(null);
  const [more, setMore] = useState(false);

  const categories = CATEGORIES.filter((c) => items.some((i) => i.category === c.id));
  const colors = COLORS.filter((c) => items.some((i) => i.colors.includes(c)));
  const style = OCCASIONS.find((o) => o.id === occasion)?.style;
  const shown = useMemo(
    () => items.filter((i) => (!category || i.category === category) && (!color || i.colors.includes(color)) && (!style || i.style === style)),
    [items, category, color, style],
  );
  const extra = (color ? 1 : 0) + (occasion ? 1 : 0);

  if (!items.length)
    return tab === "wardrobe" ? (
      <Empty icon={Shirt} title="Noch leer" text="Fotografiere dein erstes Teil – es landet freigestellt und sortiert hier im Schrank.">
        <Link to="/erfassen" className="flex h-13 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">
          Erstes Teil erfassen
        </Link>
      </Empty>
    ) : (
      <Empty icon={Heart} title="Keine Wünsche" text="Teile aus importierten E-Mails kannst du im Eingang als Kaufwunsch merken." />
    );

  return (
    <>
      <div className="flex flex-col gap-2 px-5">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <ChipRow label="Kategorie">
              <Chip active={!category} onClick={() => setCategory(null)}>
                Alle
              </Chip>
              {categories.map((c) => (
                <Chip key={c.id} active={category === c.id} onClick={() => setCategory(category === c.id ? null : c.id)}>
                  {c.short}
                </Chip>
              ))}
            </ChipRow>
          </div>
          <button
            type="button"
            aria-expanded={more}
            aria-label="Weitere Filter: Farbe und Anlass"
            onClick={() => setMore(!more)}
            className={cx("relative grid size-9 shrink-0 place-items-center rounded-full border transition", more || extra ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card")}
          >
            <SlidersHorizontal className="size-4" />
            {extra > 0 && <span className="absolute -top-1 -right-1 grid size-4 place-items-center rounded-full bg-card text-[10px] font-bold text-foreground shadow-soft">{extra}</span>}
          </button>
        </div>
        {more && (
          <div className="flex animate-rise flex-col gap-2">
            <ChipRow label="Anlass">
              {OCCASIONS.map((o) => (
                <Chip key={o.id} active={occasion === o.id} onClick={() => setOccasion(occasion === o.id ? null : o.id)}>
                  {o.label}
                </Chip>
              ))}
            </ChipRow>
            {colors.length > 0 && (
              <ChipRow label="Farbe">
                {colors.map((c) => (
                  <Chip key={c} swatch={COLOR_SWATCH[c]} active={color === c} onClick={() => setColor(color === c ? null : c)}>
                    {cap(c)}
                  </Chip>
                ))}
              </ChipRow>
            )}
          </div>
        )}
      </div>
      {shown.length ? (
        <div className="mt-4 grid grid-cols-2 gap-3.5 px-5">
          {shown.map((i) => (
            <ItemCard key={i.id} item={i} onClick={() => navigate(`/teil/${i.id}`)} />
          ))}
        </div>
      ) : (
        <div className="mt-10 px-8 text-center">
          <p className="text-sm text-muted-foreground">Zu dieser Auswahl gibt es kein Teil.</p>
          <Button size="sm" variant="soft" className="mt-3" onClick={() => (setCategory(null), setColor(null), setOccasion(null))}>
            Filter zurücksetzen
          </Button>
        </div>
      )}
    </>
  );
}

function InboxGroup({ record, items }: { record: ImportRecord | null; items: Item[] }) {
  const navigate = useNavigate();
  const update = useUpdateItem();
  const removeItem = useDeleteItem();
  const removeImport = useDeleteImport();
  const [confirm, setConfirm] = useState(false);
  const meta = record ? [record.store, formatDate(record.purchase_date), formatPrice(record.total, record.currency)].filter(Boolean).join(" · ") : "";

  function move(item: Item, status: ItemStatus) {
    update.mutate(
      { id: item.id, patch: { status } },
      {
        onSuccess: () => toast.success(status === "wardrobe" ? "Im Schrank" : "Auf der Wunschliste", { action: { label: "Rückgängig", onClick: () => update.mutate({ id: item.id, patch: { status: "inbox" } }) } }),
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  }

  return (
    <section className="animate-rise">
      <div className="flex items-start gap-2 px-5">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-2xl">{record?.title ?? "Weitere Teile"}</h2>
          {meta && <p className="mt-0.5 text-xs text-muted-foreground">{meta}</p>}
        </div>
        {record && (
          <button type="button" aria-label="Import löschen" className="grid size-9 shrink-0 place-items-center rounded-full bg-muted" onClick={() => setConfirm(true)}>
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
      {items.length ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3.5 px-5">
            {items.map((i) => (
              <ItemCard
                key={i.id}
                item={i}
                onClick={() => navigate(`/teil/${i.id}`)}
                footer={
                  <div className="flex gap-1.5 px-2.5 pb-2.5">
                    <button type="button" className="h-9 flex-1 rounded-full bg-primary text-xs font-semibold text-primary-foreground transition active:scale-95" onClick={() => move(i, "wardrobe")}>
                      In den Schrank
                    </button>
                    <button type="button" aria-label={`${i.name} als Wunsch merken`} className="grid size-9 shrink-0 place-items-center rounded-full bg-muted transition active:scale-95" onClick={() => move(i, "wishlist")}>
                      <Heart className="size-4" />
                    </button>
                  </div>
                }
              />
            ))}
          </div>
          {items.length > 1 && (
            <div className="mt-3 px-5">
              <Button size="sm" variant="soft" block onClick={() => items.forEach((i) => update.mutate({ id: i.id, patch: { status: "wardrobe" } }))}>
                Alle {items.length} in den Schrank
              </Button>
            </div>
          )}
        </>
      ) : (
        <p className="mt-2 px-5 text-sm text-muted-foreground">Alle Teile aus diesem Import sind einsortiert.</p>
      )}
      <Confirm
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Import löschen?"
        text={items.length ? "Der gespeicherte E-Mail-Text und die noch nicht einsortierten Teile dieses Imports werden gelöscht. Teile im Schrank und auf der Wunschliste bleiben." : "Der gespeicherte E-Mail-Text wird gelöscht. Einsortierte Teile bleiben erhalten."}
        action="Löschen"
        busy={removeImport.isPending}
        onConfirm={async () => {
          try {
            await Promise.all(items.map((i) => removeItem.mutateAsync(i)));
            await removeImport.mutateAsync(record!.id);
            setConfirm(false);
          } catch (e) {
            toast.error(errorMessage(e));
          }
        }}
      />
    </section>
  );
}

function InboxView({ items }: { items: Item[] }) {
  const imports = useImports().data ?? [];
  const loose = items.filter((i) => !i.import_id || !imports.some((r) => r.id === i.import_id));
  // Erledigte Importe (alles einsortiert) verschwinden nach einer Woche aus der Ansicht.
  const groups = imports
    .map((record) => ({ record, items: items.filter((i) => i.import_id === record.id) }))
    .filter((g) => g.items.length || Date.now() - new Date(g.record.created_at).getTime() < 7 * 86_400_000);
  return (
    <div className="flex flex-col gap-7">
      <div className="px-5">
        <ImportZone compact />
      </div>
      {!groups.length && !loose.length && (
        <Empty icon={Inbox} title="Eingang ist leer" text="Importierte Käufe landen zuerst hier. Dann entscheidest du mit einem Tippen: in den Schrank oder auf die Wunschliste." />
      )}
      {groups.map((g) => (
        <InboxGroup key={g.record.id} record={g.record} items={g.items} />
      ))}
      {loose.length > 0 && <InboxGroup record={null} items={loose} />}
    </div>
  );
}

export default function Wardrobe({ tab }: { tab: ItemStatus }) {
  const items = useItems();
  const counts = { wardrobe: byStatus(items.data, "wardrobe").length, wishlist: byStatus(items.data, "wishlist").length, inbox: byStatus(items.data, "inbox").length };
  const list = byStatus(items.data, tab);
  return (
    <div>
      <PageHeader title="Schrank" subtitle={counts.wardrobe === 1 ? "1 Teil" : `${counts.wardrobe} Teile`} />
      <div className="mx-5 mb-4 flex rounded-full bg-muted p-1" role="tablist">
        {TABS.map((t) => (
          <Link key={t.id} to={t.to} replace role="tab" aria-selected={tab === t.id} className={cx("flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full text-sm font-semibold transition", tab === t.id ? "bg-card shadow-soft" : "text-muted-foreground")}>
            {t.label}
            {t.id !== "wardrobe" && counts[t.id] > 0 && <span className={cx("grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px]", t.id === "inbox" ? "bg-primary text-primary-foreground" : "bg-border")}>{counts[t.id]}</span>}
          </Link>
        ))}
      </div>
      {items.isPending ? (
        <div className="grid place-items-center py-20">
          <Spinner />
        </div>
      ) : items.isError ? (
        <p className="px-8 py-16 text-center text-sm text-muted-foreground">Dein Schrank konnte nicht geladen werden. Bitte prüfe deine Verbindung.</p>
      ) : tab === "inbox" ? (
        <InboxView items={list} />
      ) : (
        <Grid key={tab} items={list} tab={tab} />
      )}
    </div>
  );
}
