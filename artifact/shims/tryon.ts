import { useProfile } from "@/lib/data";
import { useSession } from "@/lib/session";
import type { Mode } from "@shared/wardrobe";

/** Im Artefakt entsteht die Anprobe sofort als Vorschau aus den freigestellten Teilen – ohne KI-Bild. */
export function useTryOn(itemIds: string[], _mode: Mode) {
  const session = useSession();
  const avatarPath = useProfile(session?.user.id).data?.avatar_path ?? null;
  return { avatarPath, key: itemIds.length ? [...itemIds].sort().join("|") : null, imagePath: null as string | null, checking: false, running: false, start() {} };
}
