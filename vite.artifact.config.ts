import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const root = fileURLToPath(new URL(".", import.meta.url));

/** Tauscht die Server-Anbindung (src/lib/*) gegen die Artefakt-Varianten (artifact/shims/*) aus. */
function shims(): Plugin {
  return {
    name: "artifact-shims",
    enforce: "pre",
    async resolveId(source, importer, options) {
      if (!importer) return null;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      const m = resolved && /\/src\/lib\/([\w-]+)\.tsx?$/.exec(resolved.id);
      if (!m) return null;
      for (const ext of ["ts", "tsx"]) {
        const shim = `${root}artifact/shims/${m[1]}.${ext}`;
        // Eine Variante darf ihr eigenes Original nicht auf sich selbst umleiten.
        if (existsSync(shim)) return shim === importer ? null : shim;
      }
      return null;
    },
  };
}

// Baut die ganze App als eine einzige Skript-Datei plus eine CSS-Datei; scripts/build-artifact.mjs fügt beides in eine HTML-Seite ein.
export default defineConfig({
  plugins: [shims(), react(), tailwindcss()],
  resolve: { alias: { "@": `${root}src`, "@shared": `${root}shared` } },
  define: { "import.meta.env.VITE_TARGET": JSON.stringify("artifact"), "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    outDir: "dist-artifact",
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: { entry: `${root}src/main.tsx`, formats: ["iife"], name: "StyleBerater", fileName: () => "app.js" },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
