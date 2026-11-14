import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Shirt, Sparkles, UserRound } from "lucide-react";
import { byStatus, ofPerson, useItems } from "@/lib/data";
import { useActivePerson } from "@/lib/people";
import { loadAdvice } from "@/lib/expert";
import { LookCard } from "@/components/LookCard";
import { Chip, ChipRow, ModeToggle, PageHeader, Spinner, cx, useStoredMode } from "@/components/ui";
import { ARTIFACT } from "@/lib/target";
import { OCCASIONS, type OccasionId, type Suggestion } from "@shared/wardrobe";

function greeting() {
  const h = new Date().getHours();
  return h < 11 ? "Guten Morgen" : h < 18 ? "Guten Tag" : "Guten Abend";
}

export default function Today() {
  const { active } = useActivePerson();
  const items = useItems();
  const wardrobe = ofPerson(items.data, active?.id, "wardrobe");
  const inbox = byStatus(items.data, "inbox").length;
  const [mode, setMode] = useStoredMode();
  const [occasion, setOccasion] = useState<OccasionId>("freizeit");
  // Die Empfehlung des Experten von heute, falls es für diesen Anlass schon eine gibt.
  const advice = loadAdvice(active?.id, occasion, new Set(wardrobe.map((i) => i.id)))?.advice;
  const look: Suggestion | null = advice && advice.item_ids.length >= 1 ? { title: advice.title, reason: advice.headline, item_ids: advice.item_ids } : null;

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

      <section className="mt-6">
        <div className="px-5">
          <h2 className="text-2xl leading-tight">Was ziehe ich heute an?</h2>
          <div className="mt-3">
            <ChipRow label="Anlass">
              {OCCASIONS.map((o) => (
                <Chip key={o.id} active={occasion === o.id} onClick={() => setOccasion(o.id)}>
                  {o.label}
                </Chip>
              ))}
            </ChipRow>
          </div>
        </div>
        {items.isPending ? (
          <div className="grid place-items-center py-16">
            <Spinner />
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3 px-5">
            {look && (
              <>
                {!ARTIFACT && <ModeToggle mode={mode} onChange={setMode} />}
                <LookCard key={look.item_ids.join()} suggestion={look} items={wardrobe} mode={mode} occasion={occasion} className="animate-rise" />
              </>
            )}
            <Link to={`/experte?anlass=${occasion}`} className={cx("flex h-13 items-center justify-center gap-2 rounded-full text-[15px] font-semibold", look ? "border border-border bg-card" : "bg-primary text-primary-foreground")}>
              <Sparkles className="size-4" /> {look ? "Empfehlung und fehlende Teile ansehen" : "Styling-Experten fragen"}
            </Link>
            {wardrobe.length === 0 && (
              <Link to="/erfassen" className="flex h-13 items-center justify-center gap-2 rounded-full border border-border bg-card text-[15px] font-semibold">
                <Shirt className="size-4" /> Erstes Teil erfassen
              </Link>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
