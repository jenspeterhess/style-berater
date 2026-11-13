import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorMessage } from "./api";
import { useProfile, useTryonCache } from "./data";
import { runJob, useJobRunning } from "./jobs";
import { useSession } from "./session";
import { comboKey, type Mode } from "@shared/wardrobe";

/**
 * Anprobe einer Kombination am eigenen Avatar.
 * Schon erzeugte Bilder kommen sofort aus dem Zwischenspeicher; neue laufen als Hintergrundauftrag.
 */
export function useTryOn(itemIds: string[], mode: Mode) {
  const qc = useQueryClient();
  const session = useSession();
  const avatarPath = useProfile(session?.user.id).data?.avatar_path ?? null;
  const key = avatarPath && itemIds.length ? comboKey(itemIds, avatarPath, mode) : null;
  const cached = useTryonCache(key);
  const running = useJobRunning(key);

  function start() {
    if (!key || running) return;
    runJob(key, "tryon", { item_ids: itemIds, mode })
      .then((path) => qc.setQueryData(["tryon", key], path))
      .catch((e) => toast.error(errorMessage(e)));
  }

  return { avatarPath, key, imagePath: cached.data ?? null, checking: !!key && cached.isPending, running, start };
}
