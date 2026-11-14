import { Link } from "react-router-dom";
import { BookHeart } from "lucide-react";
import { useItems, useOutfits } from "@/lib/data";
import { useActivePerson } from "@/lib/people";
import { AvatarLook } from "@/components/AvatarLook";
import { ARTIFACT } from "@/lib/target";
import { Collage } from "@/components/LookCard";
import { Empty, PageHeader, Spinner, StorageImage } from "@/components/ui";
import type { Item } from "@shared/wardrobe";

export default function Lookbook() {
  const outfits = useOutfits();
  const items = useItems().data ?? [];
  const { active } = useActivePerson();
  // Looks ohne Zuordnung (aus der Zeit vor den zwei Schränken) erscheinen bei beiden.
  const looks = (outfits.data ?? []).filter((o) => !o.person_id || o.person_id === active?.id);
  const count = looks.length;
  const avatarPath = active?.avatar_path;
  const partsOf = (ids: string[]) => ids.map((id) => items.find((i) => i.id === id)).filter((i): i is Item => !!i);
  return (
    <div>
      <PageHeader title="Lookbook" subtitle={outfits.data ? [active?.name, count === 1 ? "1 Look" : `${count} Looks`].filter(Boolean).join(" · ") : undefined} />
      {outfits.isPending ? (
        <div className="grid place-items-center py-20">
          <Spinner />
        </div>
      ) : outfits.isError ? (
        <p className="px-8 py-16 text-center text-sm text-muted-foreground">Dein Lookbook konnte nicht geladen werden. Bitte prüfe deine Verbindung.</p>
      ) : !count ? (
        <Empty icon={BookHeart} title="Noch keine Looks" text="Speichere Outfits aus der Anprobe oder aus den Vorschlägen – hier findest du sie wieder.">
          <Link to="/anprobe" className="flex h-13 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">
            Zur Anprobe
          </Link>
        </Empty>
      ) : (
        <div className="grid grid-cols-2 gap-3.5 px-5">
          {looks.map((o) => (
            <Link key={o.id} to={`/lookbook/${o.id}`} className="animate-rise overflow-hidden rounded-(--radius-card) bg-card shadow-soft transition active:scale-[0.985]">
              {o.image_path ? (
                <StorageImage path={o.image_path} alt={o.title} fit="cover" className="studio-bg aspect-[2/3] w-full" />
              ) : ARTIFACT ? (
                <AvatarLook avatarPath={avatarPath} items={partsOf(o.item_ids)} className="aspect-[2/3] w-full" />
              ) : (
                <Collage items={partsOf(o.item_ids)} className="aspect-[2/3] w-full" />
              )}
              <p className="truncate px-3.5 py-3 text-sm font-semibold">{o.title}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
