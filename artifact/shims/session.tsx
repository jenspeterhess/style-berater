import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { cap } from "./claude";

type Session = { user: { id: string; email?: string } };
/** undefined = wird noch geprüft, null = nicht angemeldet bzw. außerhalb von Claude geöffnet */
const Ctx = createContext<Session | null | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    (async () => {
      const user = await cap("user");
      const id = user ? await user.id().catch(() => null) : null;
      const name = id && user ? await user.name().catch(() => "") : "";
      if (alive) setSession(id ? { user: { id, email: name || undefined } } : null);
    })();
    return () => {
      alive = false;
    };
  }, []);
  return <Ctx.Provider value={session}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);
