import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ARTIFACT } from "@/lib/target";
import { ArrowLeft, Check, ChevronRight, LogOut, Pencil, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { callApi, errorMessage } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { ageOf, setActivePerson, useActivePerson, useUpdatePerson, type Person } from "@/lib/people";
import { byStatus, useItems } from "@/lib/data";
import { AUDIENCES, type AudienceId } from "@shared/wardrobe";
import { Button, Chip, Field, PageHeader, Sheet, cx, inputClass } from "@/components/ui";

/** Name, Geburtsjahr und Zielgruppe einer Person. Das Alter fließt in die Stilberatung ein. */
function PersonSheet({ person, onClose }: { person: Person; onClose: () => void }) {
  const update = useUpdatePerson();
  const [name, setName] = useState(person.name);
  const [year, setYear] = useState(person.birth_year ? String(person.birth_year) : "");
  const [audience, setAudience] = useState<AudienceId | null>(person.audience);
  const y = year.trim() ? Number(year) : null;
  const yearOk = y === null || (Number.isInteger(y) && y >= 1900 && y <= new Date().getFullYear());
  return (
    <Sheet open onClose={onClose} title="Person bearbeiten">
      <div className="flex flex-col gap-4">
        <Field label="Name">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={30} autoComplete="off" />
        </Field>
        <Field label="Geburtsjahr">
          <input className={inputClass} value={year} onChange={(e) => setYear(e.target.value)} inputMode="numeric" placeholder="z. B. 1980" autoComplete="off" />
        </Field>
        {!yearOk && <p className="-mt-2 text-xs text-destructive">Bitte gib ein Jahr mit vier Ziffern ein, z. B. 1980.</p>}
        <div>
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Neue Teile vorschlagen für</p>
          <div className="flex flex-wrap gap-2">
            {AUDIENCES.map((a) => (
              <Chip key={a.id} active={audience === a.id} onClick={() => setAudience(audience === a.id ? null : a.id)}>
                {a.label}
              </Chip>
            ))}
          </div>
        </div>
        <Button
          block
          busy={update.isPending}
          disabled={!name.trim() || !yearOk}
          onClick={() => update.mutate({ id: person.id, patch: { name: name.trim(), birth_year: y, audience } }, { onSuccess: () => (toast.success("Gespeichert"), onClose()), onError: (e) => toast.error(errorMessage(e)) })}
        >
          Speichern
        </Button>
      </div>
    </Sheet>
  );
}

export default function Settings() {
  const { people, active } = useActivePerson();
  const items = useItems().data;
  const [editing, setEditing] = useState<Person | null>(null);
  const session = useSession();
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function removeAll() {
    setBusy(true);
    try {
      await callApi("/api/delete-account", {});
      if (ARTIFACT) {
        toast.success("Alle deine Daten wurden gelöscht.");
        localStorage.removeItem("heute");
        qc.clear();
        navigate("/willkommen", { replace: true });
        return;
      }
      toast.success("Alle Daten und dein Konto wurden gelöscht.");
      await supabase.auth.signOut({ scope: "local" });
    } catch (e) {
      toast.error(errorMessage(e));
      setBusy(false);
    }
  }

  const row = "flex h-16 w-full items-center gap-3.5 px-4 text-left text-[15px] font-semibold";
  return (
    <div className="min-h-dvh">
      <PageHeader
        title="Einstellungen"
        subtitle={session?.user.email}
        back={
          <Link to="/heute" aria-label="Zurück" className="-ml-2 grid size-11 place-items-center rounded-full">
            <ArrowLeft className="size-5" />
          </Link>
        }
      />
      {people.length > 0 && (
        <section className="mx-5 mt-2 mb-5">
          <h2 className="font-sans text-xs font-semibold tracking-wide text-muted-foreground uppercase">Wessen Schrank ist offen?</h2>
          <div className="mt-2.5 flex flex-col gap-2.5" role="radiogroup" aria-label="Schrank wählen">
            {people.map((p) => {
              const on = p.id === active?.id;
              const count = byStatus(items, "wardrobe").filter((i) => i.person_id === p.id).length;
              const age = ageOf(p);
              return (
                <div key={p.id} className={cx("flex items-center gap-1 rounded-(--radius-card) bg-card pr-2 shadow-soft", on && "ring-2 ring-primary")}>
                  <button type="button" role="radio" aria-checked={on} className="flex min-w-0 flex-1 items-center gap-3.5 p-3.5 text-left" onClick={() => (setActivePerson(p.id), toast.success(`Schrank von ${p.name} ist offen`))}>
                    <span className={cx("grid size-11 shrink-0 place-items-center rounded-full text-[15px] font-bold", on ? "bg-primary text-primary-foreground" : "bg-muted")}>{on ? <Check className="size-5" /> : p.name.charAt(0).toUpperCase()}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{p.name}</span>
                      <span className="block text-xs text-muted-foreground">{[age ? `${age} Jahre` : null, count === 1 ? "1 Teil" : `${count} Teile`].filter(Boolean).join(" · ")}</span>
                    </span>
                  </button>
                  <button type="button" aria-label={`${p.name} bearbeiten`} className="grid size-11 shrink-0 place-items-center rounded-full" onClick={() => setEditing(p)}>
                    <Pencil className="size-4" />
                  </button>
                </div>
              );
            })}
          </div>
          <p className="mt-2.5 px-1 text-xs leading-relaxed text-muted-foreground">Die Auswahl gilt auf diesem Gerät für Schrank, Anprobe, Lookbook und Vorschläge. Der Eingang für neue Teile ist gemeinsam.</p>
        </section>
      )}
      <div className="mx-5 mt-2 divide-y divide-border overflow-hidden rounded-(--radius-card) bg-card shadow-soft">
        <Link to="/avatar" className={row}>
          <UserRound className="size-5" strokeWidth={1.5} />
          <span className="flex-1">{ARTIFACT ? "Mein Foto für die Anprobe" : active ? `Avatar von ${active.name}` : "Avatar ansehen oder neu erstellen"}</span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
        {!ARTIFACT && (
          <button type="button" className={row} onClick={() => supabase.auth.signOut()}>
            <LogOut className="size-5" strokeWidth={1.5} />
            <span className="flex-1">Abmelden</span>
          </button>
        )}
      </div>
      <div className="mx-5 mt-5 overflow-hidden rounded-(--radius-card) bg-card shadow-soft">
        <button type="button" className={`${row} text-destructive`} onClick={() => setOpen(true)}>
          <Trash2 className="size-5" strokeWidth={1.5} />
          <span className="flex-1">Alle meine Daten löschen</span>
        </button>
      </div>
      <p className="mx-7 mt-4 text-xs leading-relaxed text-muted-foreground">{ARTIFACT ? "Deine Fotos und Daten liegen privat in deinem Claude-Konto. Zur Erkennung werden Bilder und importierte Texte an Claude gesendet." : "Deine Fotos und Daten sind privat und nur für dein Konto sichtbar. Zur Erkennung und Anprobe werden Bilder an KI-Modelle von Anthropic und OpenAI gesendet."}</p>

      {editing && <PersonSheet key={editing.id} person={editing} onClose={() => setEditing(null)} />}
      <Sheet open={open} onClose={() => !busy && setOpen(false)} title="Wirklich alles löschen?">
        <p className="text-sm leading-relaxed text-muted-foreground">{ARTIFACT ? "Das entfernt alle Fotos, Teile, Outfits und importierten E-Mails. Das lässt sich nicht rückgängig machen." : "Das entfernt alle Fotos, Teile, Outfits, importierten E-Mails und dein Konto. Das lässt sich nicht rückgängig machen."}</p>
        <div className="mt-5">
          <Field label="Tippe LÖSCHEN zur Bestätigung">
            <input className={inputClass} value={word} onChange={(e) => setWord(e.target.value)} autoCapitalize="characters" autoComplete="off" />
          </Field>
        </div>
        <div className="mt-5 flex flex-col gap-2">
          <Button variant="danger" block busy={busy} disabled={word.trim().toUpperCase() !== "LÖSCHEN"} onClick={removeAll}>
            Endgültig löschen
          </Button>
          <Button variant="ghost" block disabled={busy} onClick={() => setOpen(false)}>
            Abbrechen
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
