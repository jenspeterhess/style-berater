import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Lock, ScanFace, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { useProfile } from "@/lib/data";
import { Button } from "@/components/ui";

const POINTS = [
  { icon: Lock, title: "Privat", text: "Deine Fotos, Teile und Looks sieht nur dein Konto." },
  { icon: Sparkles, title: "KI-Verarbeitung", text: "Damit Teile erkannt und Outfits an deinem Avatar gezeigt werden können, senden wir deine Bilder zur Verarbeitung an KI-Modelle von Anthropic (Claude) und OpenAI." },
  { icon: ScanFace, title: "Deine Entscheidung", text: "Du kannst jederzeit alle Daten samt Konto in den Einstellungen löschen." },
];

export default function Welcome() {
  const session = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const profile = useProfile(session?.user.id);
  const [busy, setBusy] = useState(false);
  if (profile.data?.consent_at) return <Navigate to={profile.data.avatar_path ? "/heute" : "/avatar"} replace />;

  async function agree() {
    setBusy(true);
    const { error } = await supabase.from("profiles").upsert({ id: session!.user.id, consent_at: new Date().toISOString() });
    if (error) {
      setBusy(false);
      return toast.error("Das hat nicht geklappt. Bitte versuche es erneut.");
    }
    await qc.invalidateQueries({ queryKey: ["profile"] });
    navigate("/avatar", { replace: true });
  }

  return (
    <div className="flex min-h-dvh flex-col px-7 pt-[calc(env(safe-area-inset-top)+3rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)]">
      <p className="text-xs font-semibold tracking-[0.3em] text-muted-foreground uppercase">Willkommen</p>
      <h1 className="mt-3 animate-rise text-[2.6rem] leading-none">Bevor es losgeht</h1>
      <ul className="mt-9 flex flex-col gap-6">
        {POINTS.map((p, i) => (
          <li key={p.title} className="flex animate-rise gap-4" style={{ animationDelay: `${100 + i * 80}ms` }}>
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-muted">
              <p.icon className="size-5" strokeWidth={1.5} />
            </span>
            <div>
              <p className="font-semibold">{p.title}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{p.text}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-10">
        <Button block busy={busy} onClick={agree}>
          Einverstanden, weiter
        </Button>
        <button type="button" onClick={() => supabase.auth.signOut()} className="mt-2 h-12 w-full text-sm font-semibold text-muted-foreground">
          Abbrechen und abmelden
        </button>
      </div>
    </div>
  );
}
