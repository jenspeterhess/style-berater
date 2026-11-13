import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ChevronRight, LogOut, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { callApi, errorMessage } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { Button, Field, PageHeader, Sheet, inputClass } from "@/components/ui";

export default function Settings() {
  const session = useSession();
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);

  async function removeAll() {
    setBusy(true);
    try {
      await callApi("/api/delete-account", {});
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
      <div className="mx-5 mt-2 divide-y divide-border overflow-hidden rounded-(--radius-card) bg-card shadow-soft">
        <Link to="/avatar" className={row}>
          <UserRound className="size-5" strokeWidth={1.5} />
          <span className="flex-1">Avatar ansehen oder neu erstellen</span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
        <button type="button" className={row} onClick={() => supabase.auth.signOut()}>
          <LogOut className="size-5" strokeWidth={1.5} />
          <span className="flex-1">Abmelden</span>
        </button>
      </div>
      <div className="mx-5 mt-5 overflow-hidden rounded-(--radius-card) bg-card shadow-soft">
        <button type="button" className={`${row} text-destructive`} onClick={() => setOpen(true)}>
          <Trash2 className="size-5" strokeWidth={1.5} />
          <span className="flex-1">Alle meine Daten löschen</span>
        </button>
      </div>
      <p className="mx-7 mt-4 text-xs leading-relaxed text-muted-foreground">Deine Fotos und Daten sind privat und nur für dein Konto sichtbar. Zur Erkennung und Anprobe werden Bilder an KI-Modelle von Anthropic und OpenAI gesendet.</p>

      <Sheet open={open} onClose={() => !busy && setOpen(false)} title="Wirklich alles löschen?">
        <p className="text-sm leading-relaxed text-muted-foreground">Das entfernt alle Fotos, Teile, Outfits, importierten E-Mails und dein Konto. Das lässt sich nicht rückgängig machen.</p>
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
