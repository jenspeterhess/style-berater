import { HttpError, admin, api } from "../lib/http.js";

/** Löscht alle Bilder, alle Daten und das Konto selbst. Tabellenzeilen fallen über ON DELETE CASCADE mit dem Konto weg. */
export default api(
  (raw) => raw,
  async ({ userId }) => {
    const db = admin();
    for (;;) {
      const { data: files, error } = await db.storage.from("wardrobe").list(userId, { limit: 100 });
      if (error) throw new HttpError(500, "Deine Bilder konnten nicht gelöscht werden. Bitte versuche es erneut.");
      if (!files?.length) break;
      const { error: removeError } = await db.storage.from("wardrobe").remove(files.map((f) => `${userId}/${f.name}`));
      if (removeError) throw new HttpError(500, "Deine Bilder konnten nicht gelöscht werden. Bitte versuche es erneut.");
    }
    const { error } = await db.auth.admin.deleteUser(userId);
    if (error) throw new HttpError(500, "Dein Konto konnte nicht gelöscht werden. Bitte versuche es erneut.");
    return { ok: true };
  },
);
