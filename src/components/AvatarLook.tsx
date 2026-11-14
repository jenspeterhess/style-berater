import { useState } from "react";
import { useImageUrl } from "@/lib/storage";
import { imagePath } from "@/lib/data";
import { cx } from "./ui";
import type { Item } from "@shared/wardrobe";

type Box = { left: number; top: number; width: number; height: number; z: number };
// Lage je Kategorie in Prozent der Fläche (Hochformat 2:3), abgestimmt auf eine stehende Figur von Kopf bis Fuß.
const BOXES: Record<string, Box> = {
  hose: { left: 30, top: 45, width: 40, height: 46, z: 1 },
  rock: { left: 28, top: 45, width: 44, height: 24, z: 2 },
  kleid: { left: 24, top: 17, width: 52, height: 58, z: 2 },
  oberteil: { left: 24, top: 16, width: 52, height: 31, z: 3 },
  jacke: { left: 20, top: 15, width: 60, height: 40, z: 4 },
  schuhe: { left: 33, top: 88, width: 34, height: 9, z: 5 },
  accessoire: { left: 71, top: 5, width: 24, height: 18, z: 6 },
};

function Layer({ item }: { item: Item }) {
  const url = useImageUrl(imagePath(item));
  const [ratio, setRatio] = useState<number | null>(null);
  if (!url) return null;
  // Rock oder Kleid? Das verrät das Seitenverhältnis des freigestellten Teils.
  const key = item.category === "rock_kleid" ? (ratio != null && ratio > 1.25 ? "kleid" : "rock") : item.category;
  const b = BOXES[key] ?? BOXES.accessoire!;
  return (
    <img
      src={url}
      alt={item.name}
      draggable={false}
      onLoad={(e) => setRatio(e.currentTarget.naturalHeight / e.currentTarget.naturalWidth)}
      className={cx("absolute object-contain object-top drop-shadow-[0_6px_10px_rgba(60,40,25,0.18)] transition-opacity duration-500", item.category === "rock_kleid" && ratio == null ? "opacity-0" : "opacity-100")}
      style={{ left: `${b.left}%`, top: `${b.top}%`, width: `${b.width}%`, height: `${b.height}%`, zIndex: b.z }}
    />
  );
}

/**
 * Anprobe als Vorschau: die freigestellten Teile liegen passend über dem eigenen Foto.
 * Ohne Foto erscheinen sie als ordentlich gelegtes Outfit.
 */
export function AvatarLook({ avatarPath, items, className }: { avatarPath: string | null | undefined; items: Item[]; className?: string }) {
  const avatar = useImageUrl(avatarPath);
  return (
    <div className={cx("studio-bg relative overflow-hidden", className)} role="img" aria-label={items.length ? `Vorschau: ${items.map((i) => i.name).join(", ")}` : "Dein Foto"}>
      {avatar && <img src={avatar} alt="" draggable={false} className="absolute inset-[3%] size-[94%] object-contain" />}
      {items.map((i) => (
        <Layer key={i.id} item={i} />
      ))}
    </div>
  );
}
