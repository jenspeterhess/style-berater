// Fügt das gebaute Skript und die Styles zu einer einzigen HTML-Seite für ein Claude-Artefakt zusammen.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";

const dir = new URL("../dist-artifact/", import.meta.url);
const js = readFileSync(new URL("app.js", dir), "utf8")
  .replaceAll("</script", "<\\/script")
  // Bibliotheken enthalten das Unicode-Ersatzzeichen wörtlich; als Escape geschrieben bleibt die Datei sauberes UTF-8.
  .replaceAll("\uFFFD", "\\uFFFD");
const css = readdirSync(dir).filter((f) => f.endsWith(".css")).map((f) => readFileSync(new URL(f, dir), "utf8")).join("\n");

const html = `<title>Style Berater</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Manrope:wght@400;500;600;700&display=swap">
<style>${css}</style>
<div id="root"></div>
<script>${js}</script>
`;
writeFileSync(new URL("style-berater.html", dir), html);
console.log(`style-berater.html: ${(html.length / 1024).toFixed(0)} KB`);
