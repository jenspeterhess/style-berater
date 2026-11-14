import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, RefreshCw, Shirt, Sparkles, UserRound } from "lucide-react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/api";
import { byStatus, ofPerson, useItems } from "@/lib/data";
import { useActivePerson } from "@/lib/people";
import { useSuggest } from "@/lib/suggest";
import { LookCard } from "@/components/LookCard";
import { Button, Chip, ChipRow, Empty, ModeToggle, PageHeader, Spinner, useStoredMode } from "@/components/ui";
import { ARTIFACT } from "@/lib/target";
import { OCCASIONS, type OccasionId, type Suggestion } from "@shared/wardrobe";

type Stored = { day: string; occasion: OccasionId; suggestion: Suggestion; seen: string[][] };
const today = () => new Date().toISOString().slice(0, 10);

// Jede Person hat ihren eigenen Vorschlag des Tages.
const storeKey = (personId: string | undefined) => `heute-${personId ?? ""}`;

function loadStored(key: string, ids: Set<string>): Stored | null {
  try {
    const s = JSON.parse(localStorage.getItem(key) ?? "null") as Stored | null;
    // Nur der Vorschlag von heute zählt – und nur, wenn es alle Teile noch gibt.
    return s && s.day === today() && s.suggestion.item_ids.every((id) => ids.has(id)) ? s : null;
  } catch {
    return null;
  }
}

function greeting() {
  const h = new Date().getHours();
  return h < 11 ? "Guten Morgen" : h < 18 ? "Guten Tag" : "Guten Abend";
}

export default function Today() {
  const { active } = useActivePerson();
  const items = useItems();
  const wardrobe = ofPerson(items.data, active?.id, "wardrobe");
  const inbox = byStatus(items.data, "inbox").length;
  const suggest = useSuggest();
  const [mode, setMode] = useStoredMode();
  // Frisch erzeugte Vorschläge je Person; sonst gilt der gespeicherte von heute.
  const key = storeKey(active?.id);
  const [fresh, setFresh] = useState<Record<string, Stored>>({});
  const current = fresh[key] ?? loadStored(key, new Set(wardrobe.map((i) => i.id)));
  const [occasion, setOccasion] = useState<OccasionId | null>(null);
  const chosen = occasion ?? current?.occasion ?? "freizeit";

  function ask(another: boolean) {
    const seen = another && current?.occasion === chosen ? current.seen : [];
    suggest.mutate(
      { items: wardrobe, occasion: OCCASIONS.find((o) => o.id === chosen)!.label, count: 1, exclude: seen },
      {
        onSuccess: ([s]) => {
          if (!s) return toast.message("Für diesen Anlass findet sich gerade keine Kombination in deinem Schrank.");
          const next: Stored = { day: today(), occasion: chosen, suggestion: s, seen: [...seen, s.item_ids].slice(-8) };
          localStorage.setItem(key, JSON.stringify(next));
          setFresh((f) => ({ ...f, [key]: next }));
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  }

  const date = new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });
  return (
    <div>
      <PageHeader
        title={active ? `${greeting()}, ${active.name}` : greeting()}
        subtitle={date}
        action={
          <Link to="/einstellungen" aria-label="Einstellungen und Schrank wählen" className="grid size-11 shrink-0 place-items-center rounded-full border border-border bg-card text-[15px] font-bold">
            {active?.name.charAt(0).toUpperCase() ?? "?"}
          </Link>
        }
      />

      <div className="flex flex-col gap-3 px-5">
        {inbox > 0 && (
          <Link to="/eingang" className="flex animate-rise items-center gap-3.5 rounded-(--radius-card) bg-card p-3.5">
            <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-accent font-serif text-xl font-bold text-accent-foreground">{inbox}</span>
            <span className="flex-1">
              <span className="block text-[15px] font-semibold">{inbox === 1 ? "Neues Teil im Eingang" : "Neue Teile im Eingang"}</span>
              <span className="block text-[13px] text-muted-foreground">Noch nicht einsortiert</span>
            </span>
            <ChevronRight className="size-4" />
          </Link>
        )}
        {active && !active.avatar_path && (
          <Link to="/avatar" className="flex animate-rise items-center gap-3.5 rounded-(--radius-card) bg-card p-3.5">
            <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-muted">
              <UserRound className="size-5" strokeWidth={1.5} />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-semibold">{ARTIFACT ? "Eigenes Foto hinzufügen" : `Avatar für ${active.name} erstellen`}</span>
              <span className="block text-xs text-muted-foreground">Damit die Outfits an der Person selbst zu sehen sind</span>
            </span>
            <ChevronRight className="size-4" />
          </Link>
        )}
      </div>

      {items.isPending ? (
        <div className="grid place-items-center py-20">
          <Spinner />
        </div>
      ) : wardrobe.length < 2 ? (
        <div className="mt-4">
          <Empty icon={Shirt} title={wardrobe.length ? "Noch ein Teil" : "Dein Schrank wartet"} text={wardrobe.length ? "Ab zwei Teilen im Schrank schlage ich dir jeden Tag ein Outfit vor." : "Erfasse deine ersten Teile – dann schlage ich dir jeden Tag ein Outfit vor."}>
            <Link to="/erfassen" className="flex h-13 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">
              Teil erfassen
            </Link>
          </Empty>
        </div>
      ) : (
        <section className="mt-6">
          <div className="flex items-end justify-between gap-3 px-5">
            <h2 className="text-2xl leading-tight">Was ziehe ich heute an?</h2>
          </div>
          <div className="mt-3 px-5">
            <ChipRow label="Anlass">
              {OCCASIONS.map((o) => (
                <Chip key={o.id} active={chosen === o.id} onClick={() => setOccasion(o.id)}>
                  {o.label}
                </Chip>
              ))}
            </ChipRow>
          </div>
          {current && current.occasion === chosen ? (
            <div className="mt-4 px-5">
              <div className="mb-3 flex items-center justify-between">
                {ARTIFACT ? <span /> : <ModeToggle mode={mode} onChange={setMode} />}
                <Button size="sm" variant="ghost" busy={suggest.isPending} onClick={() => ask(true)}>
                  {!suggest.isPending && <RefreshCw className="size-4" />} Anderer Vorschlag
                </Button>
              </div>
              <LookCard key={current.suggestion.item_ids.join()} suggestion={current.suggestion} items={wardrobe} mode={mode} occasion={current.occasion} className="animate-rise" />
            </div>
          ) : (
            <div className="mt-4 px-5">
              <Button block busy={suggest.isPending} onClick={() => ask(false)}>
                {!suggest.isPending && <Sparkles className="size-4" />}
                {suggest.isPending ? "Deine Stylistin überlegt" : "Outfit vorschlagen"}
              </Button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
