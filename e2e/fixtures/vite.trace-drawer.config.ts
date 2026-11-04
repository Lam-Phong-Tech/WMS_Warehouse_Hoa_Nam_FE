import { defineConfig, mergeConfig } from "vite";
import appConfig from "../../vite.config.ts";

export default defineConfig(async (env) =>
  mergeConfig(await appConfig(env), {
    cacheDir: "test-results/trace-drawer/vite-cache",
    optimizeDeps: { entries: ["e2e/fixtures/trace-drawer.html"] },
  }),
);
