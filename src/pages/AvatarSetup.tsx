import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Camera, Check, PersonStanding, ScanFace } from "lucide-react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/api";
import { useProfile } from "@/lib/data";
import { resizeImage } from "@/lib/images";
import { jobPromise, runJob, useJobRunning } from "@/lib/jobs";
import { useSession } from "@/lib/session";
import { uploadImage } from "@/lib/storage";
import { Button, FileInput, RenderOverlay, StorageImage, cx } from "@/components/ui";

function PhotoTile({ title, hint, icon: Icon, file, onPick }: { title: string; hint: string; icon: typeof Camera; file: File | null; onPick: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <button type="button" onClick={() => ref.current?.click()} className="relative flex aspect-[3/4] flex-1 flex-col items-center justify-center overflow-hidden rounded-(--radius-card) bg-card p-4 text-center shadow-soft transition active:scale-[0.98]">
      {preview ? (
        <>
          <img src={preview} alt={title} className="absolute inset-0 size-full object-cover" />
          <span className="absolute top-3 right-3 grid size-7 place-items-center rounded-full bg-primary text-primary-foreground shadow-soft">
            <Check className="size-4" />
          </span>
          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-3 pt-8 pb-3 text-sm font-semibold text-white">{title} · ändern</span>
        </>
      ) : (
        <>
          <span className="grid size-14 place-items-center rounded-full bg-muted">
            <Icon className="size-6" strokeWidth={1.5} />
          </span>
          <span className="mt-3 font-semibold">{title}</span>
          <span className="mt-1 text-xs leading-snug text-muted-foreground">{hint}</span>
        </>
      )}
      <FileInput inputRef={ref} accept="image/*" onFiles={(f) => onPick(f[0]!)} />
    </button>
  );
}

const JOB = "avatar";

export default function AvatarSetup() {
  const session = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const profile = useProfile(session?.user.id).data;
  const [selfie, setSelfie] = useState<File | null>(null);
  const [body, setBody] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fresh, setFresh] = useState(false);
  const running = useJobRunning(JOB);
  const busy = uploading || running;
  const hasAvatar = !!profile?.avatar_path;
  const [editing, setEditing] = useState(false);
  const showForm = !hasAvatar || editing;

  // Kommt man während der Erstellung zurück auf die Seite, wird das Ergebnis trotzdem übernommen.
  useEffect(() => {
    const p = jobPromise(JOB);
    if (!p) return;
    let alive = true;
    p.then(() => {
      if (alive) void done();
    }).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function done() {
    await qc.invalidateQueries({ queryKey: ["profile"] });
    setEditing(false);
    setFresh(true);
    setSelfie(null);
    setBody(null);
  }

  async function create() {
    if (!selfie || !body) return;
    setUploading(true);
    try {
      const [selfie_path, body_path] = await Promise.all([uploadImage(await resizeImage(selfie, 1536), "selfie"), uploadImage(await resizeImage(body, 1536), "body")]);
      setUploading(false);
      await runJob(JOB, "avatar", { selfie_path, body_path });
      await done();
    } catch (e) {
      setUploading(false);
      toast.error(errorMessage(e));
    }
  }

  return (
    <div className="flex min-h-dvh flex-col px-6 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
      {hasAvatar && !fresh ? (
        <Link to="/einstellungen" aria-label="Zurück" className="-ml-2 grid size-11 place-items-center rounded-full">
          <ArrowLeft className="size-5" />
        </Link>
      ) : (
        <div className="h-11" />
      )}
      <h1 className="mt-2 text-[2.4rem] leading-none">{fresh ? "Das bist du" : hasAvatar && !editing ? "Dein Avatar" : "Dein Avatar entsteht"}</h1>
      <p className="mt-2.5 text-[15px] text-muted-foreground">
        {fresh ? "An diesem Avatar probierst du ab jetzt jedes Outfit an." : showForm ? "Zwei Fotos genügen. Daraus entsteht ein fotorealistischer Avatar in neutraler Kleidung." : "An diesem Avatar probierst du deine Outfits an."}
      </p>

      {showForm ? (
        <>
          <div className="relative mt-7">
            <div className={cx("flex gap-3.5 transition", busy && "pointer-events-none opacity-60")}>
              <PhotoTile title="Selfie" hint="Gesicht von vorn, gutes Licht" icon={ScanFace} file={selfie} onPick={setSelfie} />
              <PhotoTile title="Ganzkörper" hint="Von Kopf bis Fuß, anliegende Kleidung" icon={PersonStanding} file={body} onPick={setBody} />
            </div>
            {busy && (
              <div className="absolute inset-0 overflow-hidden rounded-(--radius-card)">
                <RenderOverlay label={uploading ? "Fotos werden hochgeladen" : "Dein Avatar wird erstellt"} hint="Das dauert etwa ein bis zwei Minuten" />
              </div>
            )}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Tipp: heller, ruhiger Hintergrund und keine Sonnenbrille. Du kannst den Avatar später jederzeit neu erstellen.</p>
          <div className="mt-auto flex flex-col gap-1 pt-8">
            <Button block busy={busy} disabled={!selfie || !body} onClick={create}>
              {busy ? "Einen Moment" : "Avatar erstellen"}
            </Button>
            {hasAvatar ? (
              <Button variant="ghost" block disabled={busy} onClick={() => setEditing(false)}>
                Abbrechen
              </Button>
            ) : (
              <Button variant="ghost" block onClick={() => navigate("/heute")}>
                {busy ? "Im Hintergrund weitermachen" : "Später erstellen"}
              </Button>
            )}
          </div>
        </>
      ) : (
        <>
          <StorageImage path={profile?.avatar_path} alt="Dein Avatar" fit="cover" className="studio-bg mt-6 aspect-[2/3] w-full animate-rise rounded-(--radius-card) shadow-soft" />
          <div className="mt-auto flex flex-col gap-1 pt-6">
            {fresh ? (
              <Button block onClick={() => navigate("/heute")}>
                Los geht’s
              </Button>
            ) : null}
            <Button variant={fresh ? "ghost" : "soft"} block onClick={() => (setEditing(true), setFresh(false))}>
              Neu erstellen
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
