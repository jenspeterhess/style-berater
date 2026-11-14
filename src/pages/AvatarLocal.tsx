import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, PersonStanding } from "lucide-react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/api";
import { cutout } from "@/lib/cutout";
import { useProfile } from "@/lib/data";
import { resizeImage } from "@/lib/images";
import { useSession } from "@/lib/session";
import { removeImages, uploadImage } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import { AvatarLook } from "@/components/AvatarLook";
import { Button, FileInput, RenderOverlay } from "@/components/ui";

/** Artefakt-Variante: Das eigene Ganzkörperfoto dient als Figur für die Anprobe-Vorschau. Es wird kein KI-Bild erzeugt. */
export default function AvatarLocal() {
  const session = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const profile = useProfile(session?.user.id).data;
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const has = !!profile?.avatar_path;

  async function pick(files: File[]) {
    setBusy(true);
    try {
      const photo = await resizeImage(files[0]!, 1400);
      const cut = await cutout(photo);
      const path = await uploadImage(cut ?? photo, "avatar");
      const { error } = await supabase.from("profiles").upsert({ id: session!.user.id, avatar_path: path });
      if (error) throw new Error("Das Foto konnte nicht gespeichert werden. Bitte versuche es erneut.");
      await removeImages([profile?.avatar_path]);
      await qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success(cut ? "Foto gespeichert und freigestellt" : "Foto gespeichert", cut ? undefined : { description: "Der Hintergrund ließ sich nicht entfernen. Vor einer ruhigen, hellen Wand klappt es am besten." });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col px-6 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
      {has ? (
        <Link to="/einstellungen" aria-label="Zurück" className="-ml-2 grid size-11 place-items-center rounded-full">
          <ArrowLeft className="size-5" />
        </Link>
      ) : (
        <div className="h-11" />
      )}
      <h1 className="mt-2 text-[2.4rem] leading-none">Dein Foto</h1>
      <p className="mt-2.5 text-[15px] text-muted-foreground">Ein Ganzkörperfoto genügt. In der Anprobe legst du deine Teile als Vorschau darüber.</p>

      <div className="relative mt-6 overflow-hidden rounded-(--radius-card) shadow-soft">
        {has ? (
          <AvatarLook avatarPath={profile?.avatar_path} items={[]} className="aspect-[2/3] w-full" />
        ) : (
          <button type="button" onClick={() => input.current?.click()} className="flex aspect-[2/3] w-full flex-col items-center justify-center bg-card p-6 text-center">
            <span className="grid size-16 place-items-center rounded-full bg-muted">
              <PersonStanding className="size-7" strokeWidth={1.5} />
            </span>
            <span className="mt-4 font-semibold">Ganzkörperfoto wählen</span>
            <span className="mt-1 max-w-52 text-xs leading-relaxed text-muted-foreground">Von Kopf bis Fuß, gerade stehend, vor einer ruhigen, hellen Wand</span>
          </button>
        )}
        {busy && <RenderOverlay label="Foto wird vorbereitet" />}
      </div>
      <FileInput inputRef={input} accept="image/*" onFiles={pick} />

      <div className="mt-auto flex flex-col gap-1 pt-6">
        {has ? (
          <>
            <Button block onClick={() => navigate("/heute")}>
              Fertig
            </Button>
            <Button variant="ghost" block disabled={busy} onClick={() => input.current?.click()}>
              Anderes Foto wählen
            </Button>
          </>
        ) : (
          <Button variant="ghost" block disabled={busy} onClick={() => navigate("/heute")}>
            Später
          </Button>
        )}
      </div>
    </div>
  );
}
