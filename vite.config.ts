import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { devApi } from "./dev/api-plugin";

export default defineConfig(({ mode }) => {
  // Server-Schlüssel (ohne VITE_-Präfix) nur für die lokalen API-Funktionen laden.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));
  return {
    plugins: [react(), tailwindcss(), devApi()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
        "@shared": fileURLToPath(new URL("./shared", import.meta.url)),
      },
    },
    worker: { format: "es" as const },
    server: { port: 5173, host: true },
  };
});
