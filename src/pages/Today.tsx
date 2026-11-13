import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Inbox, RefreshCw, Settings, Shirt, Sparkles, UserRound } from "lucide-react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/api";
import { byStatus, useItems, useProfile } from "@/lib/data";
import { useSession } from "@/lib/session";
import { useSuggest } from "@/lib/suggest";
import { LookCard } from "@/components/LookCard";
import { Button, Chip, ChipRow, Empty, ModeToggle, PageHeader, Spinner, useStoredMode } from "@/components/ui";
import { OCCASIONS, type OccasionId, type Suggestion } from "@shared/wardrobe";

type Stored = { day: string; occasion: OccasionId; suggestion: Suggestion; seen: string[][] };
const today = () => new Date().toISOString().slice(0, 10);

function loadStored(ids: Set<string>): Stored | null {
  try {
    const s = JSON.parse(localStorage.getItem("heute") ?? "null") as Stored | null;
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
  const session = useSession();
  const profile = useProfile(session?.user.id).data;
  const items = useItems();
  const wardrobe = byStatus(items.data, "wardrobe");
  const inbox = byStatus(items.data, "inbox").length;
  const suggest = useSuggest();
  const [mode, setMode] = useStoredMode();
  const [stored, setStored] = useState<Stored | null | undefined>(undefined);
  const current = stored === undefined ? loadStored(new Set(wardrobe.map((i) => i.id))) : stored;
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
          localStorage.setItem("heute", JSON.stringify(next));
          setStored(next);
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  }

  const date = new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });
  return (
    <div>
      <PageHeader
        title={greeting()}
        subtitle={date}
        action={
          <Link to="/einstellungen" aria-label="Einstellungen" className="grid size-11 place-items-center rounded-full bg-card shadow-soft">
            <Settings className="size-5" strokeWidth={1.5} />
          </Link>
        }
      />

      <div className="flex flex-col gap-3 px-5">
        {inbox > 0 && (
          <Link to="/eingang" className="flex animate-rise items-center gap-3.5 rounded-(--radius-card) bg-accent p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-card">
              <Inbox className="size-5" strokeWidth={1.5} />
            </span>
            <span className="flex-1 text-sm font-semibold">{inbox === 1 ? "1 neues Teil wartet im Eingang" : `${inbox} neue Teile warten im Eingang`}</span>
            <ChevronRight className="size-4" />
          </Link>
        )}
        {profile && !profile.avatar_path && (
          <Link to="/avatar" className="flex animate-rise items-center gap-3.5 rounded-(--radius-card) bg-card p-4 shadow-soft">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted">
              <UserRound className="size-5" strokeWidth={1.5} />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-semibold">Avatar erstellen</span>
              <span className="block text-xs text-muted-foreground">Damit du Outfits an dir selbst siehst</span>
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
            <h2 className="text-[1.7rem] leading-tight">Was ziehe ich heute an?</h2>
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
                <ModeToggle mode={mode} onChange={setMode} />
                <Button size="sm" variant="ghost" busy={suggest.isPending} onClick={() => ask(true)}>
                  {!suggest.isPending && <RefreshCw className="size-4" />} Anderer Vorschlag
                </Button>
              </div>
              <LookCard key={current.suggestion.item_ids.join()} suggestion={current.suggestion} items={wardrobe} mode={mode} className="animate-rise" />
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
