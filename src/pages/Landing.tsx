import { Link, Navigate } from "react-router-dom";
import { useSession } from "@/lib/session";

export default function Landing() {
  const session = useSession();
  if (session) return <Navigate to="/heute" replace />;
  return (
    <div className="studio-bg relative flex min-h-dvh flex-col overflow-hidden px-7 pt-[calc(env(safe-area-inset-top)+1.75rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)]">
      {/* Ruhige Kleiderbügel-Silhouette statt Stockfoto: bleibt scharf und lädt sofort. */}
      <svg viewBox="0 0 400 320" className="pointer-events-none absolute top-16 left-1/2 w-[92%] -translate-x-1/2 animate-fade text-foreground/[0.09]" aria-hidden>
        <path d="M200 96c0-22 16-34 32-34s30 13 30 30c0 15-9 24-24 31-10 5-16 11-16 22v12L46 262c-14 8-9 28 7 28h294c16 0 21-20 7-28L222 185" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p className="relative animate-rise text-xs font-semibold tracking-[0.3em] text-muted-foreground uppercase">Style Berater</p>
      <div className="relative mt-auto animate-rise [animation-delay:120ms]">
        <h1 className="text-[3.4rem] leading-[0.95]">
          Dein Schrank.
          <br />
          <em className="text-muted-foreground">Neu gesehen.</em>
        </h1>
        <p className="mt-5 max-w-[19rem] text-[15px] leading-relaxed text-muted-foreground">Fotografiere deine Lieblingsteile, erschaffe deinen Avatar und probiere jedes Outfit an – bevor du dich anziehst.</p>
        <Link to="/registrieren" className="mt-9 flex h-14 items-center justify-center rounded-full bg-primary text-[15px] font-semibold text-primary-foreground shadow-lift transition active:scale-[0.98]">
          Kostenlos starten
        </Link>
        <Link to="/anmelden" className="mt-2 flex h-12 items-center justify-center text-sm font-semibold">
          Ich habe schon ein Konto
        </Link>
      </div>
    </div>
  );
}
