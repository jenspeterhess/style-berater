import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Footprints, Gem, Loader2, Shirt, X, type LucideIcon } from "lucide-react";
import { useImageUrl } from "@/lib/storage";
import { imagePath } from "@/lib/data";
import { COLOR_SWATCH, MODES, cap, categoryLabel, formatPrice, type Item, type Mode } from "@shared/wardrobe";

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "soft" | "ghost" | "danger"; size?: "md" | "sm"; busy?: boolean; block?: boolean };
export function Button({ variant = "primary", size = "md", busy, block, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || busy}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition active:scale-[0.98] disabled:opacity-45 disabled:active:scale-100",
        size === "md" ? "h-13 px-5 text-[15px]" : "h-10 px-4 text-sm",
        block && "w-full",
        variant === "primary" && "bg-primary text-primary-foreground shadow-soft",
        variant === "soft" && "bg-muted text-foreground",
        variant === "ghost" && "text-foreground hover:bg-muted",
        variant === "danger" && "bg-destructive/10 text-destructive",
        className,
      )}
      {...rest}
    >
      {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function IconButton({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" aria-label={label} title={label} className={cx("grid size-11 shrink-0 place-items-center rounded-full bg-card/90 text-foreground shadow-soft backdrop-blur transition active:scale-95", className)} {...rest}>
      {children}
    </button>
  );
}

export function Chip({ active, onClick, children, swatch }: { active?: boolean; onClick?: () => void; children: ReactNode; swatch?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition active:scale-95",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground",
      )}
    >
      {swatch && <span className="size-3.5 rounded-full border border-black/10" style={{ background: swatch }} aria-hidden />}
      {children}
    </button>
  );
}

/** Eine horizontal wischbare Chip-Zeile, die bis an den Bildschirmrand läuft. */
export function ChipRow({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div role="group" aria-label={label} className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 py-0.5">
      {children}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx("size-5 animate-spin text-muted-foreground", className)} aria-label="Lädt" />;
}

export function PageHeader({ title, subtitle, action, back }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; back?: ReactNode }) {
  return (
    <header className="flex items-start gap-3 px-5 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-4">
      {back}
      <div className="min-w-0 flex-1">
        <h1 className="text-[2rem] leading-[1.05]">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function Empty({ icon: Icon, title, text, children }: { icon: LucideIcon; title: string; text: string; children?: ReactNode }) {
  return (
    <div className="mx-5 flex animate-rise flex-col items-center rounded-(--radius-card) bg-card px-6 py-10 text-center shadow-soft">
      <span className="grid size-14 place-items-center rounded-full bg-muted">
        <Icon className="size-6 text-muted-foreground" aria-hidden />
      </span>
      <h2 className="mt-4 text-2xl">{title}</h2>
      <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">{text}</p>
      {children && <div className="mt-6 flex w-full flex-col gap-2.5">{children}</div>}
    </div>
  );
}

/** Privates Bild aus dem Speicher, mit sanftem Einblenden. */
export function StorageImage({ path, alt, className, fit = "contain" }: { path: string | null | undefined; alt: string; className?: string; fit?: "contain" | "cover" }) {
  const url = useImageUrl(path);
  // Geladen ist ein Bild nur für genau diese Adresse – so blendet auch ein neues Bild wieder sanft ein.
  const [loadedUrl, setLoadedUrl] = useState<string>();
  const loaded = !!url && loadedUrl === url;
  return (
    <div className={cx("relative overflow-hidden", className)}>
      {url && (
        <img
          src={url}
          alt={alt}
          draggable={false}
          onLoad={() => setLoadedUrl(url)}
          className={cx("size-full transition-opacity duration-500", fit === "contain" ? "object-contain" : "object-cover object-top", loaded ? "opacity-100" : "opacity-0")}
        />
      )}
      {path && !loaded && <div className="shimmer-overlay absolute inset-0" aria-hidden />}
    </div>
  );
}

const CATEGORY_ICON: Record<string, LucideIcon> = { schuhe: Footprints, accessoire: Gem };

/** Bild eines Teils auf Studio-Hintergrund – oder ein ruhiger Platzhalter in der Farbe des Teils, wenn es noch kein Foto gibt. */
export function ItemImage({ item, className, padded = true }: { item: Item; className?: string; padded?: boolean }) {
  const path = imagePath(item);
  if (path) return <StorageImage path={path} alt={item.name} className={cx("studio-bg", padded && "p-3", className)} />;
  const Icon = CATEGORY_ICON[item.category] ?? Shirt;
  const color = COLOR_SWATCH[item.colors[0] ?? ""] ?? "var(--color-accent)";
  return (
    <div className={cx("studio-bg grid place-items-center", className)} role="img" aria-label={`${item.name} (noch ohne Foto)`}>
      <span className="grid size-[46%] max-h-24 max-w-24 place-items-center rounded-full border border-black/5 shadow-soft" style={{ background: color }}>
        <Icon className="size-1/2 text-white mix-blend-difference" strokeWidth={1.25} aria-hidden />
      </span>
    </div>
  );
}

export function ItemCard({ item, onClick, footer, selected }: { item: Item; onClick?: () => void; footer?: ReactNode; selected?: boolean }) {
  return (
    <div className={cx("animate-rise overflow-hidden rounded-(--radius-card) bg-card shadow-soft transition", selected && "ring-2 ring-primary")}>
      <button type="button" onClick={onClick} className="block w-full text-left transition active:scale-[0.985]">
        <ItemImage item={item} className="aspect-[4/5] w-full" />
        <div className="px-3.5 pt-3 pb-3.5">
          <p className="truncate text-sm font-semibold">{item.name}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{[categoryLabel(item.category), item.status === "wardrobe" ? null : formatPrice(item.price, item.currency)].filter(Boolean).join(" · ")}</p>
        </div>
      </button>
      {footer}
    </div>
  );
}

export function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div role="radiogroup" aria-label="Bildqualität" className="inline-flex shrink-0 rounded-full bg-muted p-1">
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          role="radio"
          aria-checked={mode === m.id}
          onClick={() => onChange(m.id)}
          className={cx("h-8 rounded-full px-3.5 text-xs font-semibold whitespace-nowrap transition", mode === m.id ? "bg-card text-foreground shadow-soft" : "text-muted-foreground")}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

export function useStoredMode(): [Mode, (m: Mode) => void] {
  const [mode, setMode] = useState<Mode>(() => (localStorage.getItem("mode") === "fast" ? "fast" : "quality"));
  return [mode, (m) => (localStorage.setItem("mode", m), setMode(m))];
}

/** Ladezustand für KI-Bilder: das bisherige Bild bleibt sichtbar, darüber läuft ein Schimmer mit Statuszeile. */
export function RenderOverlay({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="absolute inset-0 flex animate-fade flex-col items-center justify-end bg-background/35 pb-8 backdrop-blur-[2px]" role="status">
      <div className="shimmer-overlay absolute inset-0" aria-hidden />
      <div className="relative rounded-full bg-card/95 px-5 py-2.5 text-sm font-semibold shadow-lift">
        <span className="animate-breathe">{label}</span>
      </div>
      {hint && <p className="relative mt-2 rounded-full bg-card/80 px-3 py-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function ProgressBar({ value }: { value?: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={value != null ? Math.round(value * 100) : undefined}>
      <div className={cx("h-full rounded-full bg-primary transition-[width] duration-300", value == null && "w-1/3 animate-breathe")} style={value != null ? { width: `${Math.max(4, value * 100)}%` } : undefined} />
    </div>
  );
}

/** Von unten einfahrendes Blatt für Auswahl, Bearbeiten und Rückfragen. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  // onClose wird bei jedem Neuzeichnen neu erzeugt. Über eine Referenz bleibt der Effekt unten trotzdem
  // nur ans Öffnen gebunden – sonst würde das Blatt bei jeder Eingabe den Fokus aus dem Textfeld ziehen.
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close.current();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    // Nur beim Öffnen fokussieren, und nur, wenn noch kein Feld im Blatt den Fokus hat (z. B. per autoFocus).
    if (!ref.current?.contains(document.activeElement)) ref.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 animate-fade bg-foreground/30 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="safe-bottom relative max-h-[88dvh] w-full max-w-md animate-sheet overflow-y-auto rounded-t-[1.75rem] bg-card shadow-lift outline-none">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-card/95 px-5 pt-5 pb-3 backdrop-blur">
          <h2 className="text-2xl">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Schließen" className="grid size-9 place-items-center rounded-full bg-muted">
            <X className="size-4" />
          </button>
        </div>
        <div className="px-5 pb-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function Confirm({ open, onClose, title, text, action, onConfirm, busy }: { open: boolean; onClose: () => void; title: string; text: string; action: string; onConfirm: () => void; busy?: boolean }) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <p className="text-sm text-muted-foreground">{text}</p>
      <div className="mt-6 flex flex-col gap-2.5">
        <Button variant="danger" block busy={busy} onClick={onConfirm}>{action}</Button>
        <Button variant="ghost" block onClick={onClose}>Abbrechen</Button>
      </div>
    </Sheet>
  );
}

/** Unsichtbares Dateifeld, das über `ref.current?.click()` geöffnet wird. */
export function FileInput({ inputRef, accept, multiple, capture, onFiles }: { inputRef: React.RefObject<HTMLInputElement | null>; accept: string; multiple?: boolean; capture?: "environment" | "user"; onFiles: (files: File[]) => void }) {
  return (
    <input
      ref={inputRef}
      type="file"
      accept={accept}
      multiple={multiple}
      capture={capture}
      className="sr-only"
      tabIndex={-1}
      aria-hidden
      onChange={(e) => {
        const files = [...(e.target.files ?? [])];
        e.target.value = "";
        if (files.length) onFiles(files);
      }}
    />
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</span>
      {children}
    </label>
  );
}
export const inputClass = "h-13 w-full rounded-2xl border border-border bg-card px-4 text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none";

export const label = { cap, categoryLabel };
