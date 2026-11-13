import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ArrowLeft, MailCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { Button, Field, inputClass } from "@/components/ui";

type Mode = "login" | "signup" | "forgot" | "reset";

const COPY: Record<Mode, { title: string; sub: string; action: string }> = {
  login: { title: "Willkommen zurück", sub: "Melde dich an, um deinen Schrank zu öffnen.", action: "Anmelden" },
  signup: { title: "Konto erstellen", sub: "Dein Schrank gehört nur dir. Fotos und Daten sind privat.", action: "Konto erstellen" },
  forgot: { title: "Passwort vergessen", sub: "Wir schicken dir einen Link, mit dem du ein neues Passwort festlegst.", action: "Link senden" },
  reset: { title: "Neues Passwort", sub: "Lege ein neues Passwort für dein Konto fest.", action: "Passwort speichern" },
};

/** Übersetzt die häufigsten Fehlermeldungen der Anmeldung. */
function authError(message: string) {
  if (/invalid login/i.test(message)) return "E-Mail oder Passwort stimmen nicht.";
  if (/already registered|already been registered/i.test(message)) return "Zu dieser E-Mail gibt es schon ein Konto. Melde dich einfach an.";
  if (/not confirmed/i.test(message)) return "Bitte bestätige zuerst deine E-Mail-Adresse über den Link in unserer Nachricht.";
  if (/at least|weak|password should/i.test(message)) return "Das Passwort braucht mindestens 8 Zeichen.";
  if (/rate limit|too many|security purposes/i.test(message)) return "Zu viele Versuche. Bitte warte einen Moment.";
  if (/different from the old/i.test(message)) return "Bitte wähle ein anderes Passwort als bisher.";
  if (/valid email|invalid format/i.test(message)) return "Bitte gib eine gültige E-Mail-Adresse ein.";
  return "Das hat nicht geklappt. Bitte versuche es erneut.";
}

export default function Auth({ mode }: { mode: Mode }) {
  const session = useSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState<"confirm" | "reset" | null>(null);
  const copy = COPY[mode];

  if (session && mode !== "reset") return <Navigate to="/heute" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (mode !== "forgot" && password.length < 8) return setError("Das Passwort braucht mindestens 8 Zeichen.");
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${location.origin}/heute` } });
        if (error) throw error;
        if (!data.session) setSent("confirm");
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}/passwort-neu` });
        if (error) throw error;
        setSent("reset");
      } else {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        navigate("/heute", { replace: true });
      }
    } catch (err) {
      setError(authError(err instanceof Error ? err.message : ""));
    } finally {
      setBusy(false);
    }
  }

  if (sent)
    return (
      <div className="flex min-h-dvh flex-col justify-center px-7">
        <span className="grid size-16 animate-rise place-items-center rounded-full bg-muted">
          <MailCheck className="size-7" strokeWidth={1.5} />
        </span>
        <h1 className="mt-6 text-4xl">Schau in dein Postfach</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          {sent === "confirm" ? `Wir haben einen Bestätigungslink an ${email.trim()} geschickt. Danach kannst du dich anmelden.` : `Wenn es zu ${email.trim()} ein Konto gibt, ist der Link zum Zurücksetzen unterwegs.`}
        </p>
        <Link to="/anmelden" className="mt-8 flex h-13 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">
          Zur Anmeldung
        </Link>
      </div>
    );

  if (mode === "reset" && session === null)
    return (
      <div className="flex min-h-dvh flex-col justify-center px-7">
        <h1 className="text-4xl">Link abgelaufen</h1>
        <p className="mt-3 text-[15px] text-muted-foreground">Dieser Link ist nicht mehr gültig. Fordere einfach einen neuen an.</p>
        <Link to="/passwort-vergessen" className="mt-8 flex h-13 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">
          Neuen Link anfordern
        </Link>
      </div>
    );

  return (
    <div className="flex min-h-dvh flex-col px-7 pt-[calc(env(safe-area-inset-top)+1rem)] pb-8">
      {mode !== "reset" && (
        <Link to={mode === "forgot" ? "/anmelden" : "/"} aria-label="Zurück" className="-ml-2 grid size-11 place-items-center rounded-full">
          <ArrowLeft className="size-5" />
        </Link>
      )}
      <form onSubmit={submit} className="mt-8 flex flex-1 animate-rise flex-col" noValidate>
        <h1 className="text-[2.6rem] leading-none">{copy.title}</h1>
        <p className="mt-3 text-[15px] text-muted-foreground">{copy.sub}</p>
        <div className="mt-8 flex flex-col gap-4">
          {mode !== "reset" && (
            <Field label="E-Mail">
              <input className={inputClass} type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="du@beispiel.de" />
            </Field>
          )}
          {mode !== "forgot" && (
            <Field label={mode === "reset" ? "Neues Passwort" : "Passwort"}>
              <input className={inputClass} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "login" ? "Dein Passwort" : "Mindestens 8 Zeichen"} />
            </Field>
          )}
        </div>
        {mode === "login" && (
          <Link to="/passwort-vergessen" className="mt-3 self-end text-sm font-semibold text-muted-foreground">
            Passwort vergessen?
          </Link>
        )}
        {error && (
          <p role="alert" className="mt-4 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" block busy={busy} disabled={(mode !== "reset" && !email.trim()) || (mode !== "forgot" && !password)} className="mt-6">
          {copy.action}
        </Button>
        {(mode === "login" || mode === "signup") && (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "login" ? "Noch kein Konto? " : "Schon ein Konto? "}
            <Link to={mode === "login" ? "/registrieren" : "/anmelden"} className="font-semibold text-foreground">
              {mode === "login" ? "Kostenlos starten" : "Anmelden"}
            </Link>
          </p>
        )}
      </form>
    </div>
  );
}
