import type { Plugin } from "vite";
import type { IncomingMessage } from "node:http";

/** Lokaler Ersatz für Netlify Functions: bedient /api/* direkt aus server/handlers. */
const ROUTES: Record<string, string> = {
  "/api/classify": "/server/handlers/classify.ts",
  "/api/suggest": "/server/handlers/suggest.ts",
  "/api/expert": "/server/handlers/expert.ts",
  "/api/shop-background": "/server/handlers/shop.ts",
  "/api/import": "/server/handlers/import.ts",
  "/api/delete-account": "/server/handlers/delete-account.ts",
  "/api/job-background": "/server/handlers/job.ts",
};

function readBody(req: IncomingMessage) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export function devApi(): Plugin {
  return {
    name: "dev-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = (req.url ?? "").split("?")[0] ?? "";
        const file = ROUTES[path];
        if (!file) return next();
        try {
          const mod = (await server.ssrLoadModule(file)) as { default: (r: Request) => Promise<Response> };
          const body = req.method === "GET" ? undefined : await readBody(req);
          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
          const request = new Request(`http://localhost${req.url}`, { method: req.method, headers, body: body ? new Uint8Array(body) : undefined });
          const background = path.endsWith("-background");
          if (background) {
            // Wie bei Netlify: sofort 202, Arbeit läuft weiter.
            res.statusCode = 202;
            res.setHeader("content-length", "0");
            res.end();
            mod.default(request).catch((e) => console.error("[job]", e));
            return;
          }
          const response = await mod.default(request);
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (e) {
          console.error("[api]", e);
          res.statusCode = 500;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: "Interner Fehler" }));
        }
      });
    },
  };
}
