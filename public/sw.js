// Minimaler Service Worker: macht die App installierbar. Es wird bewusst nichts zwischengespeichert,
// damit private Bilder und Daten nie im Offline-Speicher landen.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
