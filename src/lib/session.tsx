import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";

/** undefined = wird noch geprüft, null = abgemeldet */
const Ctx = createContext<Session | null | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const qc = useQueryClient();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      // Beim Abmelden alle zwischengespeicherten Daten und Bildadressen verwerfen.
      if (event === "SIGNED_OUT") qc.clear();
    });
    return () => data.subscription.unsubscribe();
  }, [qc]);
  return <Ctx.Provider value={session}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);
