import { defineConfig, loadEnv, type ConfigEnv } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import path from "path";

const TRUTHY = ["1", "true", "yes", "on"];

/**
 * Local/dev relay for the Cline backup (`src/lib/llm.ts` → `completeViaCline`).
 *
 * api.cline.bot sends no `Access-Control-Allow-Origin`, so the browser cannot
 * call it directly even with a key; the dev server therefore relays
 * `/cline-api/*` same-origin. With `CLINE_API_KEY` in the dev-server
 * environment (shell or `.env` — never a `VITE_` var), the relay injects the
 * Authorization header server-side and the key never reaches the browser
 * bundle. Enable with `VITE_CLINE_RELAY=true`.
 */
function clineRelay(env: Record<string, string>) {
  const enabled = TRUTHY.includes((env.VITE_CLINE_RELAY ?? "").trim().toLowerCase());
  if (!enabled) return undefined;

  const apiKey = (env.CLINE_API_KEY ?? "").trim();
  return {
    "/cline-api": {
      target: "https://api.cline.bot",
      changeOrigin: true,
      rewrite: (requestPath: string) => requestPath.replace(/^\/cline-api/, ""),
      // Server-side auth: the browser sends no key at all in relay mode.
      ...(apiKey ? { headers: { Authorization: `Bearer ${apiKey}` } } : {}),
    },
  };
}

export default defineConfig(({ mode }: ConfigEnv) => {
  // Prefix "" so non-VITE runner vars (e.g. CLINE_API_KEY) are visible here
  // without ever being inlined into the client bundle.
  const env = loadEnv(mode, import.meta.dirname, "");

  return {
    base: "./",
    plugins: [
      react(),
      svgr({
        svgrOptions: {
          icon: true,
          exportType: "named",
          namedExport: "ReactComponent",
        },
      }),
    ],
    build: {
      outDir: "bundle",
      emptyOutDir: true,
    },
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
      },
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
    },
    server: {
      proxy: clineRelay(env),
    },
  };
});
