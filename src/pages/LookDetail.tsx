import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/api";
import { useDeleteOutfit, useItems, useOutfits, useUpdateOutfit } from "@/lib/data";
import { Collage } from "@/components/LookCard";
import { Button, Confirm, IconButton, ItemImage, Spinner, StorageImage } from "@/components/ui";
import { formatDate, type Item } from "@shared/wardrobe";

export default function LookDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const outfits = useOutfits();
  const items = useItems().data ?? [];
  const look = outfits.data?.find((o) => o.id === id);
  const update = useUpdateOutfit();
  const remove = useDeleteOutfit();
  const [confirm, setConfirm] = useState(false);
  const [title, setTitle] = useState("");
  useEffect(() => setTitle(look?.title ?? ""), [look?.title]);

  if (outfits.isPending)
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner />
      </div>
    );
  if (!look)
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-8 text-center">
        <h1 className="text-3xl">Look nicht gefunden</h1>
        <Button className="mt-6" onClick={() => navigate("/lookbook")}>
          Zum Lookbook
        </Button>
      </div>
    );

  const parts = look.item_ids.map((i) => items.find((x) => x.id === i)).filter((i): i is Item => !!i);
  const missing = look.item_ids.length - parts.length;
  return (
    <div className="pb-[calc(env(safe-area-inset-bottom)+2.5rem)]">
      <div className="relative">
        {look.image_path ? <StorageImage path={look.image_path} alt={look.title} fit="cover" className="studio-bg aspect-[2/3] w-full" /> : <Collage items={parts} className="aspect-[2/3] w-full" />}
        <div className="absolute inset-x-4 top-[calc(env(safe-area-inset-top)+0.75rem)] flex justify-between">
          <IconButton label="Zurück" onClick={() => navigate("/lookbook")}>
            <ArrowLeft className="size-5" />
          </IconButton>
          <IconButton label="Look löschen" onClick={() => setConfirm(true)}>
            <Trash2 className="size-[18px]" />
          </IconButton>
        </div>
      </div>
      <div className="px-5 pt-5">
        <input
          aria-label="Titel"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && title.trim() !== look.title && update.mutate({ id: look.id, patch: { title: title.trim() } }, { onError: (e) => toast.error(errorMessage(e)) })}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className="w-full bg-transparent font-serif text-[2rem] leading-tight focus:outline-none"
        />
        {look.reason && <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{look.reason}</p>}
        <p className="mt-2 text-xs text-muted-foreground">Gespeichert am {formatDate(look.created_at)}</p>

        <h2 className="mt-7 mb-2.5 font-sans text-xs font-semibold tracking-wide text-muted-foreground uppercase">Teile in diesem Look</h2>
        <ul className="flex flex-col gap-2.5">
          {parts.map((i) => (
            <li key={i.id}>
              <Link to={`/teil/${i.id}`} className="flex items-center gap-3.5 rounded-(--radius-card) bg-card p-2.5 shadow-soft">
                <ItemImage item={i} padded={false} className="size-16 shrink-0 rounded-2xl p-1.5" />
                <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{i.name}</span>
              </Link>
            </li>
          ))}
        </ul>
        {missing > 0 && <p className="mt-2.5 text-xs text-muted-foreground">{missing === 1 ? "1 Teil dieses Looks ist nicht mehr im Schrank." : `${missing} Teile dieses Looks sind nicht mehr im Schrank.`}</p>}

        {parts.length > 0 && (
          <Link to={`/anprobe?teile=${parts.map((i) => i.id).join(",")}`} className="mt-6 flex h-13 items-center justify-center gap-2 rounded-full bg-primary font-semibold text-primary-foreground shadow-soft">
            <Sparkles className="size-4" /> In der Anprobe öffnen
          </Link>
        )}
      </div>
      <Confirm
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Look löschen?"
        text={`„${look.title}“ wird aus deinem Lookbook entfernt. Die Teile bleiben im Schrank.`}
        action="Löschen"
        busy={remove.isPending}
        onConfirm={() => remove.mutate(look.id, { onSuccess: () => navigate("/lookbook", { replace: true }), onError: (e) => toast.error(errorMessage(e)) })}
      />
    </div>
  );
}
