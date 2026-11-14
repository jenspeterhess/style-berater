import { useState } from "react";
import { ExternalLink, Search, Shirt } from "lucide-react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/api";
import { useSearchTips, useTips, type TipQuery } from "@/lib/tips";
import { Button, StorageImage } from "./ui";
import { formatDate, formatPrice, type ShopTip } from "@shared/wardrobe";

/** Produktfoto eines Tipps – aus dem eigenen Speicher, sonst direkt vom Shop, sonst ein ruhiger Platzhalter. */
function TipPhoto({ tip }: { tip: ShopTip }) {
  const [broken, setBroken] = useState(false);
  const box = "size-16 shrink-0 overflow-hidden rounded-xl bg-muted";
  if (tip.image_path) return <StorageImage path={tip.image_path} alt={tip.title} fit="cover" className={box} />;
  if (tip.image_url && !broken) return <img src={tip.image_url} alt={tip.title} loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} className={`${box} object-cover object-top`} />;
  return (
    <span className={`${box} grid place-items-center`} aria-hidden>
      <Shirt className="size-6 text-muted-foreground" strokeWidth={1.25} />
    </span>
  );
}

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
                <a href={t.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-2xl border border-border bg-card p-2 pr-3 transition active:scale-[0.99]">
                  <TipPhoto tip={t} />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-sm leading-snug font-semibold">{t.title}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {t.shop} · {t.price != null ? formatPrice(t.price, t.currency) : "Preis im Shop"}
                    </span>
                  </span>
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
