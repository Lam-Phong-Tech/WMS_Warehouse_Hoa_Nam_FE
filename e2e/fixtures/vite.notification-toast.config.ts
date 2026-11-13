import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vite";
import appConfig from "../../vite.config.ts";

const fixtureDir = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig(async (env) =>
  mergeConfig(await appConfig(env), {
    cacheDir: "test-results/notification-toast/vite-cache",
    server: { hmr: false },
    optimizeDeps: { entries: ["e2e/fixtures/notification-toast.html"] },
    resolve: {
      alias: [
        {
          find: "@/shared/lib/echo",
          replacement: path.join(fixtureDir, "notification-toast-echo.ts"),
        },
      ],
    },
  }),
);
