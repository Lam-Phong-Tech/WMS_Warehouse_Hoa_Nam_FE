import { defineConfig, mergeConfig } from "vite";
import appConfig from "../../vite.config.ts";

export default defineConfig(async (env) =>
  mergeConfig(await appConfig(env), {
    cacheDir: "test-results/iam-audit/vite-cache",
    server: { hmr: false },
    optimizeDeps: { entries: ["e2e/fixtures/iam-audit.html"] },
  }),
);
