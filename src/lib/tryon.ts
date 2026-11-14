import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorMessage } from "./api";
import { useTryonCache } from "./data";
import { runJob, useJobRunning } from "./jobs";
import { useActivePerson } from "./people";
import { comboKey, type Mode } from "@shared/wardrobe";

/**
 * Anprobe einer Kombination am Avatar der Person, deren Schrank offen ist.
 * Schon erzeugte Bilder kommen sofort aus dem Zwischenspeicher; neue laufen als Hintergrundauftrag.
 */
export function useTryOn(itemIds: string[], mode: Mode) {
  const qc = useQueryClient();
  const { active } = useActivePerson();
  const avatarPath = active?.avatar_path ?? null;
  const key = avatarPath && itemIds.length ? comboKey(itemIds, avatarPath, mode) : null;
  const cached = useTryonCache(key);
  const running = useJobRunning(key);

  function start() {
    if (!key || running || !active) return;
    runJob(key, "tryon", { item_ids: itemIds, mode, person_id: active.id })
      .then((path) => qc.setQueryData(["tryon", key], path))
      .catch((e) => toast.error(errorMessage(e)));
  }

  return { avatarPath, personId: active?.id ?? null, key, imagePath: cached.data ?? null, checking: !!key && cached.isPending, running, start };
}
