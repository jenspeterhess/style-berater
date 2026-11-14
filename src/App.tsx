import { lazy, Suspense } from "react";
import { Navigate, NavLink, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { BookHeart, Plus, Shirt, Sparkles, Sun } from "lucide-react";
import { useSession } from "@/lib/session";
import { byStatus, useItems, useProfile } from "@/lib/data";
import { useEnsurePeople } from "@/lib/people";
import { Spinner, cx } from "@/components/ui";
import Landing from "@/pages/Landing";
import Auth from "@/pages/Auth";
import { ARTIFACT } from "@/lib/target";

const Welcome = lazy(() => import("@/pages/Welcome"));
const AvatarSetup = lazy(() => (ARTIFACT ? import("@/pages/AvatarLocal") : import("@/pages/AvatarSetup")));
const Today = lazy(() => import("@/pages/Today"));
const Wardrobe = lazy(() => import("@/pages/Wardrobe"));
const ItemDetail = lazy(() => import("@/pages/ItemDetail"));
const Capture = lazy(() => import("@/pages/Capture"));
const TryOn = lazy(() => import("@/pages/TryOn"));
const Lookbook = lazy(() => import("@/pages/Lookbook"));
const LookDetail = lazy(() => import("@/pages/LookDetail"));
const Expert = lazy(() => import("@/pages/Expert"));
const Settings = lazy(() => import("@/pages/Settings"));

const Loading = () => (
  <div className="grid min-h-dvh place-items-center">
    <Spinner />
  </div>
);

/** Schmale, zentrierte Spalte: Die App ist fürs Handy gebaut und sieht am Desktop wie ein Handy aus. */
function Frame() {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-md bg-background">
      <Suspense fallback={<Loading />}>
        <Outlet />
      </Suspense>
    </div>
  );
}

function Protected() {
  const session = useSession();
  const location = useLocation();
  const profile = useProfile(session?.user.id);
  const people = useEnsurePeople(!ARTIFACT && !!profile.data?.consent_at);
  if (session === undefined) return <Loading />;
  if (!session)
    return ARTIFACT ? (
      <div className="flex min-h-dvh flex-col justify-center px-8 text-center">
        <h1 className="text-4xl">Style Berater</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">Bitte öffne diese Seite angemeldet in Claude. Dein Schrank wird privat in deinem Claude-Konto gespeichert.</p>
      </div>
    ) : (
      <Navigate to="/anmelden" replace />
    );
  if (profile.isPending) return <Loading />;
  if (people.failed)
    return (
      <div className="flex min-h-dvh flex-col justify-center px-8 text-center">
        <h1 className="text-3xl">Das hat nicht geklappt</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">Die Kleiderschränke konnten nicht geladen werden. Bitte prüfe deine Verbindung und lade die Seite neu.</p>
      </div>
    );
  if (!people.ready) return <Loading />;
  // Ohne Einwilligung in die KI-Verarbeitung geht es nicht weiter.
  if (!profile.data?.consent_at && location.pathname !== "/willkommen") return <Navigate to="/willkommen" replace />;
  return <Outlet />;
}

const NAV = [
  { to: "/heute", label: "Heute", icon: Sun },
  { to: "/schrank", label: "Schrank", icon: Shirt, also: ["/wunschliste", "/eingang", "/teil"] },
  { to: "/erfassen", label: "Erfassen", icon: Plus, primary: true },
  { to: "/anprobe", label: "Anprobe", icon: Sparkles },
  { to: "/lookbook", label: "Looks", icon: BookHeart },
] as const;

function WithNav() {
  const { pathname } = useLocation();
  const inbox = byStatus(useItems().data, "inbox").length;
  return (
    <>
      <main className="pb-[calc(env(safe-area-inset-bottom)+7.5rem)]">
        <Suspense fallback={<Loading />}>
          <Outlet />
        </Suspense>
      </main>
      {/* Schwebende dunkle Leiste: Der aktive Bereich steht als helle Pille mit Namen, die anderen nur als Symbol. */}
      <nav aria-label="Hauptnavigation" className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+0.875rem)] z-40 mx-auto w-full max-w-md px-4">
        <ul className="flex h-[4.25rem] items-center justify-between rounded-full bg-primary px-2.5 shadow-lift">
          {NAV.map((n) => {
            const active = pathname.startsWith(n.to) || ("also" in n && n.also.some((a) => pathname.startsWith(a)));
            if ("primary" in n)
              return (
                <li key={n.to}>
                  <NavLink to={n.to} aria-label="Teil erfassen" className={cx("grid size-[3.25rem] place-items-center rounded-full bg-card text-foreground transition active:scale-95", active && "ring-2 ring-card ring-offset-2 ring-offset-primary")}>
                    <n.icon className="size-[22px]" strokeWidth={2.4} />
                  </NavLink>
                </li>
              );
            return (
              <li key={n.to}>
                <NavLink to={n.to} aria-label={n.label} className={cx("relative flex h-12 items-center justify-center gap-2 rounded-full text-sm font-semibold transition", active ? "bg-card px-4 text-foreground" : "w-12 text-[#b8b4ac]")}>
                  <n.icon className={active ? "size-[18px]" : "size-[22px]"} strokeWidth={active ? 2 : 1.8} />
                  {active && n.label}
                  {n.to === "/schrank" && inbox > 0 && (
                    <span className={cx("grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[10px] text-accent-foreground", !active && "absolute top-1 right-0.5")} aria-label={`${inbox} neu im Eingang`}>
                      {inbox}
                    </span>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Frame />}>
        <Route path="/" element={ARTIFACT ? <Navigate to="/heute" replace /> : <Landing />} />
        <Route path="/anmelden" element={<Auth mode="login" />} />
        <Route path="/registrieren" element={<Auth mode="signup" />} />
        <Route path="/passwort-vergessen" element={<Auth mode="forgot" />} />
        <Route path="/passwort-neu" element={<Auth mode="reset" />} />
        <Route element={<Protected />}>
          <Route path="/willkommen" element={<Welcome />} />
          <Route path="/avatar" element={<AvatarSetup />} />
          <Route path="/teil/:id" element={<ItemDetail />} />
          <Route path="/lookbook/:id" element={<LookDetail />} />
          <Route path="/einstellungen" element={<Settings />} />
          <Route path="/experte" element={<Expert />} />
          <Route element={<WithNav />}>
            <Route path="/heute" element={<Today />} />
            <Route path="/schrank" element={<Wardrobe tab="wardrobe" />} />
            <Route path="/wunschliste" element={<Wardrobe tab="wishlist" />} />
            <Route path="/eingang" element={<Wardrobe tab="inbox" />} />
            <Route path="/erfassen" element={<Capture />} />
            <Route path="/anprobe" element={<TryOn />} />
            <Route path="/lookbook" element={<Lookbook />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
