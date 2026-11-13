# Style Berater

Virtueller Kleiderschrank mit KI-Avatar-Anprobe. Mobile-first Web-App (PWA) mit deutscher Oberfläche.
Die fachliche Beschreibung steht in [`SPEC.md`](SPEC.md).

## Aufbau

| Bereich | Lösung |
|---|---|
| Oberfläche | React, Vite, Tailwind (`src/`) |
| Anmeldung, Datenbank, privater Bildspeicher | Supabase (`supabase/migrations/`) |
| KI-Text: Teile erkennen, Outfits vorschlagen, Kaufangaben lesen | Claude (`server/lib/claude.ts`) |
| KI-Bilder: Avatar, Anprobe, Produktfoto | OpenAI Images (`server/lib/openai.ts`) |
| Freistellen | lokal im Browser (`src/lib/cutout.ts`), keine KI-Neuzeichnung |
| Server-Funktionen und Hosting | Netlify Functions (`netlify/functions/` → `server/handlers/`) |

Bildaufträge (Avatar, Anprobe, Produktfoto) dauern bis zu wenigen Minuten. Sie laufen deshalb als
Netlify Background Function: Der Browser legt eine Zeile in der Tabelle `jobs` an, die Funktion trägt das
Ergebnis ein, der Browser fragt die Zeile ab.

Alle Tabellen und der Bildspeicher sind per Row Level Security auf das eigene Konto beschränkt.
Die geheimen Schlüssel liegen nur auf dem Server, nie im Browser.

## Lokal starten

```bash
npm install
npx supabase start        # lokale Datenbank (braucht Docker)
cp .env.example .env      # Werte aus der Ausgabe von "supabase start" eintragen
npm run dev
```

Mit `AI_MOCK=1` in `.env` werden alle KI-Aufrufe simuliert. So lässt sich die App ohne Schlüssel und ohne Kosten ausprobieren.

## Veröffentlichen

1. **Supabase-Projekt** anlegen und den Inhalt von `supabase/migrations/20261113000000_init.sql` im SQL-Editor ausführen.
2. In Supabase unter *Authentication → URL Configuration* die Adresse der App als **Site URL** eintragen
   und `https://<deine-adresse>/**` als **Redirect URL** erlauben (nötig für „Passwort vergessen“).
3. **Netlify-Site** aus diesem Repository erstellen und diese Umgebungsvariablen setzen:

   | Variable | Wert |
   |---|---|
   | `VITE_SUPABASE_URL` | Project URL aus Supabase |
   | `VITE_SUPABASE_ANON_KEY` | anon/publishable key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role/secret key (geheim) |
   | `ANTHROPIC_API_KEY` | Claude-API-Schlüssel (geheim) |
   | `OPENAI_API_KEY` | OpenAI-API-Schlüssel (geheim) |

Optional: `CLAUDE_MODEL` (Standard `claude-opus-5-5`), `OPENAI_IMAGE_MODEL` (Standard `gpt-image-1.5`),
`OPENAI_IMAGE_MODEL_FAST` (eigenes Modell für „Schnell“; sonst dasselbe Modell mit niedriger Qualitätsstufe).
