import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, MemoryRouter } from "react-router-dom";
import { ARTIFACT } from "@/lib/target";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { SessionProvider } from "@/lib/session";
import App from "./App";
import "./styles.css";

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } } });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        {/* Im Artefakt gibt es keine eigenen Adressen – dort merkt sich die App die Seite selbst. */}
        {ARTIFACT ? (
          <MemoryRouter initialEntries={["/heute"]}>
            <App />
          </MemoryRouter>
        ) : (
          <BrowserRouter>
            <App />
          </BrowserRouter>
        )}
        <Toaster position="top-center" toastOptions={{ style: { borderRadius: "1rem", fontFamily: "var(--font-sans)", background: "var(--color-card)", color: "var(--color-foreground)", border: "1px solid var(--color-border)" } }} />
      </SessionProvider>
    </QueryClientProvider>
  </StrictMode>,
);

if (!ARTIFACT && "serviceWorker" in navigator && import.meta.env.PROD) void navigator.serviceWorker.register("/sw.js");
