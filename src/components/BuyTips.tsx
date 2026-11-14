import { ExternalLink, Search } from "lucide-react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/api";
import { useSearchTips, useTips, type TipQuery } from "@/lib/tips";
import { Button } from "./ui";
import { formatDate, formatPrice } from "@shared/wardrobe";

/** Kauftipps aus dem Web zu einem fehlenden Teil: Suche auf Knopfdruck, Ergebnis mit Shop, Preis und Link. */
export function BuyTips({ query }: { query: TipQuery }) {
  const tips = useTips(query.id).data;
  const search = useSearchTips();
  const start = () => search.mutate(query, { onError: (e) => toast.error(errorMessage(e)) });
  return (
    <div className="flex flex-col gap-2">
      {tips && tips.tips.length > 0 && (
        <>
          <ul className="flex flex-col gap-1.5">
            {tips.tips.map((t) => (
              <li key={t.url}>
                <a href={t.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-2.5 transition active:scale-[0.99]">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{t.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{t.shop}</span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold">{t.price != null ? formatPrice(t.price, t.currency) : "Preis im Shop"}</span>
                  <ExternalLink className="size-4 shrink-0 text-muted-foreground" aria-label="öffnet den Shop" />
                </a>
              </li>
            ))}
          </ul>
          <p className="text-xs leading-relaxed text-muted-foreground">Gesucht am {formatDate(tips.searched_at)}. Preise und Verfügbarkeit können sich geändert haben – bitte im Shop prüfen.</p>
        </>
      )}
      <Button size="sm" variant="soft" className="self-start" busy={search.isPending} onClick={start}>
        {!search.isPending && <Search className="size-4" />}
        {search.isPending ? "Suche läuft, etwa eine Minute" : tips ? "Neu suchen" : "Kauftipps suchen"}
      </Button>
    </div>
  );
}
