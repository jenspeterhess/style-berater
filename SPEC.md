# Style Berater – Design & Funktionen
Stand: 13. November 2026

Virtueller Kleiderschrank mit KI-Avatar-Anprobe. Mobile-first Web-App mit deutscher Oberfläche, installierbar als App (PWA). Fotos und Daten sind privat und nur für das eigene Konto sichtbar.

## Design
### Grundstil
- Edel, ruhig, modern – inspiriert von Doji
- Viel Weißraum, warme Off-White-Töne, eine dunkle Akzentfarbe
- Bildzentriert: große Bilder, keine Listen- oder Formular-Optik
- Weiche Karten mit dezenten Schatten, abgerundete Ecken (ca. 20 px)
- Flüssige Übergänge und Mikroanimationen (Shimmer-Ladeeffekte, sanftes Einblenden)

### Farben
| Rolle | Farbe |
|---|---|
| Hintergrund | Warmes Off-White |
| Karten | Fast weiß, leicht warm |
| Akzent / Buttons | Dunkles, warmes Anthrazit-Braun |
| Gedämpfte Flächen | Helles Beige |
| Text | Dunkles Warmgrau |

### Schriften
- Überschriften: Cormorant Garamond (elegante Serifen)
- Fließtext & Bedienelemente: Manrope (klare Sans-Serif)

### Navigation
Untere Navigationsleiste (Bottom-Nav) mit fünf Einträgen:
Heute · Schrank · + (Erfassen, hervorgehoben) · Anprobe · Lookbook

## Funktionen
### 1. Konto & Datenschutz
- Registrierung und Anmeldung per E-Mail und Passwort
- „Passwort vergessen“-Funktion mit Link per E-Mail
- Hinweis im Onboarding, dass Bilder zur Verarbeitung an ein KI-Modell gesendet werden
- Option „Alle meine Daten löschen“ in den Einstellungen (entfernt Fotos, Teile, Outfits, E-Mail-Notizen und das Konto)

### 2. Avatar-Onboarding
- Einmalig: Selfie + Ganzkörperfoto hochladen
- KI erzeugt daraus einen fotorealistischen Ganzkörper-Avatar (neutrale Pose, heller Studio-Hintergrund)
- Neutrale Grundkleidung: eng anliegendes hellgraues T-Shirt, kurze hellgraue Shorts, schlichte weiße Sneaker
- Avatar jederzeit neu erstellbar (Einstellungen)

### 3. Teil erfassen
- Foto aufnehmen (Kamera) oder aus der Galerie wählen – ein Schritt
- Echtes Freistellen im Browser: Die Hintergrundentfernung läuft lokal auf dem Gerät und erhält die Original-Pixel des Teils (Logos, Muster, Knöpfe bleiben unverändert). Ergebnis: transparentes PNG, zentriert und zugeschnitten
- Schöne Ladeanimation mit Fortschritt während des Freistellens
- KI erkennt automatisch: Name, Kategorie, Hauptfarben, Stil, Saison
- Nutzer kann alle Angaben per Chip korrigieren
- Originalfoto und Freistellung werden beide gespeichert
- Optionaler Button „Als Produktfoto aufhübschen“ in der Detailansicht: KI erzeugt einen Shop-Look (ersetzt nur das Freistellbild, das Original bleibt erhalten)

### 4. Kleiderschrank
- Raster freigestellter Teile als schöne Karten
- Filter-Chips nach Kategorie, Farbe und Anlass
- Detailansicht pro Teil mit Korrektur-Chips und Outfit-Vorschlägen

### 5. Outfit-Vorschläge
- Zu jedem Teil 3–4 Kombinationen nur aus dem eigenen Schrank, mit kurzer Begründung
- Als Anprobe-Bild am eigenen Avatar, horizontal wischbar wie ein Story-Karussell
- Qualitäts-Umschalter „Schnell / Beste Qualität“ (Standard: Beste Qualität); beide Varianten werden getrennt zwischengespeichert

### 6. Mix & Match / Anprobe
- Avatar groß in der Mitte
- Darunter horizontale Slider je Kategorie: Jacke, Oberteil, Hose/Rock/Kleid, Schuhe, Accessoires
- Tippen tauscht das Teil; Button „Anprobieren“ rendert neu (mit eleganter Shimmer-Ladeanimation)
- Nicht ausgewählte Kategorien behalten die neutralen Basics des Avatars
- Qualitäts-Umschalter „Schnell / Beste Qualität“ (Standard: Beste Qualität)
- Ergebnisbilder werden zwischengespeichert – gleiche Kombinationen werden nicht doppelt erzeugt (spart Guthaben)

### 7. Favoriten / Lookbook
- Outfits speichern (Teile + gerendertes Bild)
- Lookbook-Galerie mit gespeicherten Looks und Detailansicht

### 8. „Was ziehe ich heute an?“
- Ein-Klick-Vorschlag auf der Startseite (Heute)
- Anlass-Auswahl: Büro, Freizeit, Abend, Sport

### 9. E-Mail-Eingang (Käufe & Wünsche)
- E-Mail-Texte per Einfügen, Datei-Upload oder Drag-and-drop-Fläche importieren (.txt, .eml, .pdf)
- Kein Titel nötig – wird automatisch aus dem Inhalt übernommen
- Alles landet zuerst im Eingang; später entscheidbar: in den Schrank, als Kaufwunsch oder zurück in den Eingang
- KI erkennt automatisch Kaufdatum, Preis, Währung, Store und Marke; Angaben lassen sich manuell korrigieren
- E-Mail-HTML wird nie dargestellt; aus reinem Text werden keine Kleidungsbilder erzeugt

### 10. Einstellungen
- Avatar neu erstellen
- Abmelden
- Alle meine Daten löschen

## Technik (Überblick)
| Bereich | Lösung |
|---|---|
| Plattform | Web-App (React, TanStack Start), installierbar als PWA |
| Backend | Lovable Cloud (Anmeldung, Datenbank, privater Speicher) |
| KI-Bilder | Lovable AI Gateway – zwei Qualitätsstufen (schnell / beste Qualität) |
| KI-Text | Outfit-Vorschläge und Erkennung der Kaufangaben |
| Freistellen | Lokal im Browser (WASM), pixelgenau, ohne KI-Neuzeichnung |
| Speicher | Alle Fotos privat, nur für das eigene Konto zugänglich |
