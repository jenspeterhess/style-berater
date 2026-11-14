import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Heart, Inbox, Shirt, SlidersHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/api";
import { ofPerson, useDeleteImport, useDeleteItem, useImports, useItems, useUpdateItem } from "@/lib/data";
import { ImportZone } from "@/components/ImportZone";
import { suggestOwner, useActivePerson, type Person } from "@/lib/people";
import { Button, Chip, ChipRow, Confirm, Empty, ItemCard, PageHeader, Sheet, Spinner, cx } from "@/components/ui";
import { AUDIENCES, CATEGORIES, COLORS, COLOR_SWATCH, OCCASIONS, cap, formatDate, formatPrice, type ImportRecord, type Item, type ItemStatus } from "@shared/wardrobe";

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
  const [audience, setAudience] = useState<string | null>(null);
  const audiences = AUDIENCES.filter((a) => items.some((i) => i.audience === a.id));

  const categories = CATEGORIES.filter((c) => items.some((i) => i.category === c.id));
  const colors = COLORS.filter((c) => items.some((i) => i.colors.includes(c)));
  const style = OCCASIONS.find((o) => o.id === occasion)?.style;
  const shown = useMemo(
    () => items.filter((i) => (!category || i.category === category) && (!color || i.colors.includes(color)) && (!style || i.style === style) && (!audience || i.audience === audience)),
    [items, category, color, style, audience],
  );
  const extra = (color ? 1 : 0) + (occasion ? 1 : 0) + (audience ? 1 : 0);

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
            {audiences.length > 0 && (
              <ChipRow label="Zielgruppe">
                {audiences.map((a) => (
                  <Chip key={a.id} active={audience === a.id} onClick={() => setAudience(audience === a.id ? null : a.id)}>
                    {a.label}
                  </Chip>
                ))}
              </ChipRow>
            )}
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
          <Button size="sm" variant="soft" className="mt-3" onClick={() => (setCategory(null), setColor(null), setOccasion(null), setAudience(null))}>
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
  const [details, setDetails] = useState(false);
  const detailLines = useMemo(() => {
    try {
      return record ? (JSON.parse(localStorage.getItem(`import-details-${record.id}`) ?? "null") as string[] | null) : null;
    } catch {
      return null;
    }
  }, [record]);
  const { people, active } = useActivePerson();
  const meta = record ? [record.store, formatDate(record.purchase_date), formatPrice(record.total, record.currency)].filter(Boolean).join(" · ") : "";

  // Der Eingang ist gemeinsam: Erst beim Einsortieren entscheidet sich, in wessen Schrank ein Teil kommt.
  function move(item: Item, status: ItemStatus, person: Person | null) {
    update.mutate(
      { id: item.id, patch: { status, person_id: person?.id ?? null } },
      {
        onSuccess: () =>
          toast.success(status === "wardrobe" ? (person ? `Im Schrank von ${person.name}` : "Im Schrank") : person ? `Auf der Wunschliste von ${person.name}` : "Auf der Wunschliste", {
            action: { label: "Rückgängig", onClick: () => update.mutate({ id: item.id, patch: { status: "inbox", person_id: null } }) },
          }),
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
          {detailLines && (
            <button type="button" className="mt-1 text-xs font-semibold underline underline-offset-2" onClick={() => setDetails(true)}>
              Details zu den Bildern
            </button>
          )}
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
            {items.map((i) => {
              // Vorschlag nach erkannter Zielgruppe; die andere Person bleibt einen Tipp entfernt.
              const owner = suggestOwner(people, active, i.audience);
              const others = people.filter((p) => p.id !== owner?.id);
              return (
                <ItemCard
                  key={i.id}
                  item={i}
                  onClick={() => navigate(`/teil/${i.id}`)}
                  footer={
                    <div className="flex gap-1.5 px-2.5 pb-2.5">
                      <button type="button" aria-label={`${i.name} in den Schrank von ${owner?.name ?? ""}`} className="h-10 min-w-0 flex-1 truncate rounded-full bg-primary px-2 text-xs font-semibold text-primary-foreground transition active:scale-95" onClick={() => move(i, "wardrobe", owner)}>
                        {owner?.name ?? "In den Schrank"}
                      </button>
                      {others.map((p) => (
                        <button key={p.id} type="button" aria-label={`${i.name} in den Schrank von ${p.name}`} title={p.name} className="grid size-10 shrink-0 place-items-center rounded-full border border-border bg-card text-xs font-bold transition active:scale-95" onClick={() => move(i, "wardrobe", p)}>
                          {p.name.charAt(0).toUpperCase()}
                        </button>
                      ))}
                      <button type="button" aria-label={`${i.name} als Wunsch von ${owner?.name ?? ""} merken`} className="grid size-10 shrink-0 place-items-center rounded-full bg-muted transition active:scale-95" onClick={() => move(i, "wishlist", owner)}>
                        <Heart className="size-4" />
                      </button>
                    </div>
                  }
                />
              );
            })}
          </div>
          {items.length > 1 && (
            <div className="mt-3 px-5">
              <Button size="sm" variant="soft" block onClick={() => items.forEach((i) => update.mutate({ id: i.id, patch: { status: "wardrobe", person_id: suggestOwner(people, active, i.audience)?.id ?? null } }))}>
                Alle {items.length} wie vorgeschlagen einsortieren
              </Button>
            </div>
          )}
        </>
      ) : (
        <p className="mt-2 px-5 text-sm text-muted-foreground">Alle Teile aus diesem Import sind einsortiert.</p>
      )}
      <Sheet open={details} onClose={() => setDetails(false)} title="Bilder dieses Imports">
        <p className="text-xs text-muted-foreground">Woher jedes Bild kam und welche Adressen sich laden ließen.</p>
        <ul className="mt-3 flex flex-col gap-1.5 text-xs leading-snug break-all">
          {detailLines?.map((line, i) => (line ? <li key={i}>{line}</li> : <li key={i} className="my-1.5 h-px bg-border" aria-hidden />))}
        </ul>
      </Sheet>
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

function InboxView({ items: all }: { items: Item[] }) {
  const imports = useImports().data ?? [];
  // Zielgruppen-Filter: nur anbieten, wenn im Eingang überhaupt Teile mit erkannter Zielgruppe liegen.
  const [audience, setAudience] = useState<string | null>(() => {
    try {
      return localStorage.getItem("eingang-zielgruppe");
    } catch {
      return null;
    }
  });
  const audiences = AUDIENCES.filter((a) => all.some((i) => i.audience === a.id));
  const active = audiences.some((a) => a.id === audience) ? audience : null;
  const items = active ? all.filter((i) => i.audience === active) : all;
  const choose = (id: string | null) => {
    setAudience(id);
    try {
      if (id) localStorage.setItem("eingang-zielgruppe", id);
      else localStorage.removeItem("eingang-zielgruppe");
    } catch {
      /* nur eine Bequemlichkeit */
    }
  };
  const loose = items.filter((i) => !i.import_id || !imports.some((r) => r.id === i.import_id));
  // Erledigte Importe (alles einsortiert) verschwinden nach einer Woche aus der Ansicht.
  const groups = imports
    .map((record) => ({ record, items: items.filter((i) => i.import_id === record.id) }))
    // Mit aktivem Filter nur Importe zeigen, die passende Teile enthalten.
    .filter((g) => g.items.length || (!active && Date.now() - new Date(g.record.created_at).getTime() < 7 * 86_400_000));
  return (
    <div className="flex flex-col gap-7">
      <div className="px-5">
        <ImportZone compact />
      </div>
      {audiences.length > 0 && (
        <div className="-mt-3 px-5">
          <ChipRow label="Zielgruppe">
            <Chip active={!active} onClick={() => choose(null)}>
              Alle
            </Chip>
            {audiences.map((a) => (
              <Chip key={a.id} active={active === a.id} onClick={() => choose(active === a.id ? null : a.id)}>
                {a.label} · {all.filter((i) => i.audience === a.id).length}
              </Chip>
            ))}
          </ChipRow>
          {active && all.length > items.length && <p className="mt-2 text-xs text-muted-foreground">{all.length - items.length} weitere Teile im Eingang sind ausgeblendet.</p>}
        </div>
      )}
      {!groups.length && !loose.length && (
        <Empty icon={Inbox} title="Eingang ist leer" text="Importierte Käufe landen zuerst hier. Dann entscheidest du mit einem Tippen, in wessen Schrank ein Teil kommt." />
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
  const { active } = useActivePerson();
  const of = (status: ItemStatus) => ofPerson(items.data, active?.id, status);
  const counts = { wardrobe: of("wardrobe").length, wishlist: of("wishlist").length, inbox: of("inbox").length };
  const list = of(tab);
  return (
    <div>
      <PageHeader
        title={tab === "inbox" ? "Eingang" : "Schrank"}
        subtitle={tab === "inbox" ? "Gemeinsam für beide Schränke" : [active?.name, counts.wardrobe === 1 ? "1 Teil" : `${counts.wardrobe} Teile`].filter(Boolean).join(" · ")}
        action={
          <Link to="/einstellungen" aria-label="Einstellungen und Schrank wählen" className="grid size-11 shrink-0 place-items-center rounded-full border border-border bg-card text-[15px] font-bold">
            {active?.name.charAt(0).toUpperCase() ?? "?"}
          </Link>
        }
      />
      <div className="mx-5 mb-4 flex rounded-full bg-muted p-1" role="tablist">
        {TABS.map((t) => (
          <Link key={t.id} to={t.to} replace role="tab" aria-selected={tab === t.id} className={cx("flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full text-sm font-semibold transition", tab === t.id ? "bg-card shadow-soft" : "text-muted-foreground")}>
            {t.label}
            {t.id !== "wardrobe" && counts[t.id] > 0 && <span className={cx("grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px]", t.id === "inbox" ? "bg-accent text-accent-foreground" : "bg-border")}>{counts[t.id]}</span>}
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
