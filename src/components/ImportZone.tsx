import { useRef, useState, type DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ClipboardPaste, FileUp, MailOpen } from "lucide-react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/api";
import { ACCEPTED_IMPORT, parseImportFile, parseImportPaste, parseImportText } from "@/lib/mail";
import { ARTIFACT } from "@/lib/target";
import { runImport, type Stage } from "@/lib/pipelines";
import { Button, FileInput, ProgressBar, Sheet, cx } from "./ui";

/** Ablagefläche für Bestellbestätigungen: Datei ablegen, Datei wählen oder Text einfügen. Ein Titel ist nicht nötig. */
export function ImportZone({ compact }: { compact?: boolean }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [stage, setStage] = useState<Stage | null>(null);
  const [paste, setPaste] = useState(false);
  const [text, setText] = useState("");
  // HTML der zuletzt eingefügten E-Mail: enthält die Adressen der Produktbilder.
  const [pasted, setPasted] = useState<{ html: string; images: number } | null>(null);

  async function run(load: () => ReturnType<typeof parseImportFile>) {
    setStage({ label: "Datei wird gelesen" });
    try {
      const doc = await load();
      const { count, withImage } = await runImport(doc, setStage);
      await Promise.all([qc.invalidateQueries({ queryKey: ["items"] }), qc.invalidateQueries({ queryKey: ["imports"] })]);
      if (count === 0) toast.message("Gespeichert, aber keine Kleidungsstücke gefunden.", { description: "Der Import liegt im Eingang." });
      else toast.success(count === 1 ? "1 Teil liegt jetzt im Eingang." : `${count} Teile liegen jetzt im Eingang.`, { description: withImage === count ? "Alle mit Produktbild." : withImage ? `${withImage} davon mit Produktbild.` : "Produktbilder ließen sich nicht übernehmen. Du kannst je Teil ein Foto ergänzen." });
      navigate("/eingang");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setStage(null);
    }
  }

  async function files(list: File[]) {
    // Mehrere Dateien nacheinander, damit jede ihren eigenen Eingang-Eintrag bekommt.
    for (const f of list) await run(() => parseImportFile(f));
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    if (stage) return;
    const dropped = [...e.dataTransfer.files];
    const plain = e.dataTransfer.getData("text/plain");
    if (dropped.length) void files(dropped);
    else if (plain.trim()) void run(async () => parseImportText(plain));
  }

  return (
    <>
      <div
        onDragOver={(e) => (e.preventDefault(), setOver(true))}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={cx("rounded-(--radius-card) border-2 border-dashed bg-card text-center transition", compact ? "px-4 py-5" : "px-5 py-7", over ? "border-primary bg-accent" : "border-border")}
      >
        {stage ? (
          <div className="py-2" role="status">
            <p className="animate-breathe text-sm font-semibold">{stage.label}</p>
            <div className="mx-auto mt-3 max-w-56">
              <ProgressBar value={stage.progress} />
            </div>
          </div>
        ) : (
          <>
            {!compact && (
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-muted">
                <MailOpen className="size-5" strokeWidth={1.5} />
              </span>
            )}
            <p className={cx("font-semibold", !compact && "mt-3")}>Kauf aus E-Mail oder PDF</p>
            <p className="mx-auto mt-1 max-w-64 text-xs leading-relaxed text-muted-foreground">Bestellbestätigung hier ablegen. Kaufdatum, Preis, Store, Marke und Produktbilder werden automatisch erkannt.</p>
            <div className="mt-4 flex justify-center gap-2">
              <Button size="sm" variant="soft" onClick={() => fileRef.current?.click()}>
                <FileUp className="size-4" /> Datei wählen
              </Button>
              <Button size="sm" variant="soft" onClick={() => setPaste(true)}>
                <ClipboardPaste className="size-4" /> Text einfügen
              </Button>
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">.eml · .pdf · .txt</p>
          </>
        )}
        <FileInput inputRef={fileRef} accept={ACCEPTED_IMPORT} multiple onFiles={files} />
      </div>

      <Sheet open={paste} onClose={() => setPaste(false)} title="E-Mail-Text einfügen">
        <textarea
          value={text}
          onChange={(e) => (setText(e.target.value), !e.target.value && setPasted(null))}
          onPaste={(e) => {
            const html = e.clipboardData.getData("text/html");
            setPasted(html ? { html, images: (html.match(/<img\b/gi) ?? []).length } : null);
          }}
          rows={9}
          autoFocus
          placeholder="Text der Bestellbestätigung hier einfügen …"
          className="w-full resize-none rounded-2xl border border-border bg-background p-4 text-[15px] leading-relaxed focus:border-primary focus:outline-none"
        />
        <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
          {pasted?.images && !ARTIFACT
            ? `${pasted.images} Bilder in der E-Mail erkannt. Die Produktfotos werden in groß nachgeladen.`
            : ARTIFACT
              ? "Tipp: In der E-Mail alles markieren, kopieren und hier einfügen."
              : "Tipp: In der E-Mail alles markieren, kopieren und hier einfügen. So kommen auch die großen Produktfotos mit."}
        </p>
        <Button
          block
          className="mt-3"
          disabled={!text.trim()}
          onClick={() => {
            const value = text, html = pasted?.html ?? null;
            setPaste(false);
            setText("");
            setPasted(null);
            void run(async () => parseImportPaste(value, html));
          }}
        >
          Importieren
        </Button>
      </Sheet>
    </>
  );
}
