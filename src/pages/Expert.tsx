import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, BookHeart, Check, Heart, RefreshCw, Shirt, Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorMessage } from "@/lib/api";
import { ofPerson, useItems, useSaveOutfit } from "@/lib/data";
import { loadAdvice, saveAdvice, useExpert, type StoredAdvice } from "@/lib/expert";
import { ageOf, useActivePerson } from "@/lib/people";
import { supabase } from "@/lib/supabase";
import { BuyTips } from "@/components/BuyTips";
import { Button, Chip, ChipRow, ItemImage, Spinner } from "@/components/ui";
import { OCCASIONS, cap, type Item, type MissingPiece, type OccasionId } from "@shared/wardrobe";

const STYLES: Record<string, string> = Object.fromEntries(OCCASIONS.map((o) => [o.id, o.style]));

function Missing({ piece, occasion, saved, onSaved }: { piece: MissingPiece; occasion: OccasionId; saved: boolean; onSaved: () => void }) {
  const { active } = useActivePerson();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function wish() {
    setBusy(true);
    // Der Wunsch bekommt dieselbe Kennung wie die Empfehlung – so bleiben die Kauftipps am Teil hängen.
    const { error } = await supabase.from("items").insert({
      id: piece.id,
      name: piece.name,
      category: piece.category,
      colors: piece.colors,
      style: STYLES[occasion] ?? "casual",
      season: "ganzjährig",
      status: "wishlist",
      source: "import",
      audience: active?.audience ?? null,
      person_id: active?.id ?? null,
      note: piece.reason,
    });
    setBusy(false);
    if (error) return toast.error("Der Wunsch konnte nicht gespeichert werden. Bitte versuche es erneut.");
    await qc.invalidateQueries({ queryKey: ["items"] });
    onSaved();
    toast.success(active ? `Auf der Wunschliste von ${active.name}` : "Auf der Wunschliste");
  }

  return (
    <article className="flex flex-col gap-3 rounded-(--radius-card) bg-card p-4">
      <div>
        <h3 className="font-sans text-[15px] font-semibold tracking-normal">{piece.name}</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
          {piece.colors.length > 0 && `In ${piece.colors.map(cap).join(" oder ")}. `}
          {piece.reason}
        </p>
      </div>
      <BuyTips query={{ id: piece.id, name: piece.name, colors: piece.colors, note: piece.reason, audience: active?.audience, age: active ? ageOf(active) : null }} />
      <Button size="sm" variant="soft" className="self-start" busy={busy} disabled={saved} onClick={wish}>
        {saved ? <Check className="size-4" /> : !busy && <Heart className="size-4" />}
        {saved ? "Auf der Wunschliste" : "Auf die Wunschliste"}
      </Button>
    </article>
  );
}

export default function Expert() {
  const { active } = useActivePerson();
  const items = useItems();
  const wardrobe = ofPerson(items.data, active?.id, "wardrobe");
  const wishlist = ofPerson(items.data, active?.id, "wishlist");
  const [params, setParams] = useSearchParams();
  const occasion = (OCCASIONS.find((o) => o.id === params.get("anlass"))?.id ?? "freizeit") as OccasionId;
  const label = OCCASIONS.find((o) => o.id === occasion)!.label;
  const expert = useExpert();
  const save = useSaveOutfit();
  const [fresh, setFresh] = useState<Record<string, StoredAdvice>>({});
  const [savedLook, setSavedLook] = useState<string | null>(null);
  const slot = `${active?.id}-${occasion}`;
  const current = fresh[slot] ?? loadAdvice(active?.id, occasion, new Set(wardrobe.map((i) => i.id)));
  const wished = new Set(wishlist.map((i) => i.id));

  function ask(another: boolean) {
    if (!active) return;
    const seen = another && current ? current.seen : [];
    expert.mutate(
      { person: active, occasion: label, items: wardrobe, wishlist, exclude: seen },
      { onSuccess: (advice) => setFresh((f) => ({ ...f, [slot]: saveAdvice(active.id, occasion, advice, seen) })), onError: (e) => toast.error(errorMessage(e)) },
    );
  }

  const advice = current?.advice;
  const parts = (advice?.item_ids ?? []).map((id) => wardrobe.find((i) => i.id === id)).filter((i): i is Item => !!i);
  const age = active ? ageOf(active) : null;
  const lookKey = advice?.item_ids.join();
  return (
    <div className="flex flex-col gap-5 px-5 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-[calc(env(safe-area-inset-bottom)+2.5rem)]">
      <header className="flex items-center gap-3">
        <Link to="/heute" aria-label="Zurück" className="grid size-11 shrink-0 place-items-center rounded-full border border-border bg-card">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-muted-foreground">{active ? `Für ${active.name}${age ? ` · ${age}` : ""}` : ""}</p>
          <h1 className="text-[1.75rem] leading-[1.05]">Styling-Experte</h1>
        </div>
      </header>

      <ChipRow label="Anlass">
        {OCCASIONS.map((o) => (
          <Chip key={o.id} active={occasion === o.id} onClick={() => setParams({ anlass: o.id }, { replace: true })}>
            {o.label}
          </Chip>
        ))}
      </ChipRow>

      {items.isPending ? (
        <div className="grid place-items-center py-16">
          <Spinner />
        </div>
      ) : !advice ? (
        <section className="flex flex-col gap-4 rounded-(--radius-card) bg-card p-5">
          <div>
            <h2 className="text-xl leading-tight">Was trage ich: {label}?</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {wardrobe.length ? "Der Experte stellt einen Look aus dem Schrank zusammen und sagt, welche Teile dafür noch fehlen." : "Der Schrank ist noch leer. Der Experte sagt dir trotzdem, welche Teile sich für diesen Anlass lohnen."}
            </p>
          </div>
          <Button block busy={expert.isPending} onClick={() => ask(false)}>
            {!expert.isPending && <Sparkles className="size-4" />}
            {expert.isPending ? "Der Experte überlegt" : "Empfehlung holen"}
          </Button>
        </section>
      ) : (
        <>
          <section className="flex animate-rise flex-col gap-2 rounded-3xl bg-primary px-5 py-[1.125rem] text-primary-foreground">
            <p className="text-xs font-semibold tracking-wider text-[#c9c5bc] uppercase">Die Empfehlung</p>
            <p className="font-serif text-[1.2rem] leading-snug font-medium">{advice.headline}</p>
            <p className="text-sm leading-relaxed text-[#d9d5cc]">{advice.advice}</p>
          </section>

          <section className="flex flex-col gap-2.5">
            <h2 className="font-sans text-[13px] font-semibold tracking-wider text-muted-foreground uppercase">Aus deinem Schrank</h2>
            {parts.length ? (
              <>
                <div className="grid grid-cols-3 gap-2.5">
                  {parts.map((i) => (
                    <Link key={i.id} to={`/teil/${i.id}`} className="flex flex-col items-center gap-1.5 rounded-[18px] bg-card p-2.5">
                      <ItemImage item={i} padded={false} className="aspect-square w-full rounded-xl p-1" />
                      <span className="w-full truncate text-center text-xs font-semibold">{i.name}</span>
                    </Link>
                  ))}
                </div>
                <div className="flex gap-2.5">
                  <Link to={`/anprobe?teile=${parts.map((i) => i.id).join(",")}`} className="flex h-13 flex-1 items-center justify-center gap-2 rounded-full bg-primary text-[15px] font-semibold text-primary-foreground">
                    <Sparkles className="size-4" /> Anprobieren
                  </Link>
                  <Button
                    variant="soft"
                    aria-label="Im Lookbook speichern"
                    className="w-13 px-0!"
                    busy={save.isPending}
                    disabled={savedLook === lookKey}
                    onClick={() =>
                      save.mutate(
                        { title: advice.title, reason: advice.advice, item_ids: parts.map((i) => i.id), image_path: null, mode: "fast", person_id: active?.id ?? null, occasion },
                        { onSuccess: () => (setSavedLook(lookKey ?? null), toast.success("Im Lookbook gespeichert")), onError: (e) => toast.error(errorMessage(e)) },
                      )
                    }
                  >
                    {savedLook === lookKey ? <Check className="size-[18px] text-accent" /> : !save.isPending && <BookHeart className="size-[18px]" />}
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3 rounded-(--radius-card) bg-card p-4 text-sm text-muted-foreground">
                <Shirt className="size-5 shrink-0" strokeWidth={1.5} /> Für diesen Anlass ist noch nichts Passendes im Schrank.
              </div>
            )}
          </section>

          {advice.missing.length > 0 && (
            <section className="flex flex-col gap-2.5">
              <h2 className="font-sans text-[13px] font-semibold tracking-wider text-muted-foreground uppercase">Das fehlt noch</h2>
              {advice.missing.map((m) => (
                <Missing key={m.id} piece={m} occasion={occasion} saved={wished.has(m.id)} onSaved={() => {}} />
              ))}
            </section>
          )}

          <Button variant="soft" block busy={expert.isPending} onClick={() => ask(true)}>
            {!expert.isPending && <RefreshCw className="size-4" />} Anderer Vorschlag
          </Button>
        </>
      )}
    </div>
  );
}
