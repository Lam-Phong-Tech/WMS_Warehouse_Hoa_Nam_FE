import { defineConfig, mergeConfig } from "vite";
import appConfig from "../../vite.config.ts";

export default defineConfig(async (env) =>
  mergeConfig(await appConfig(env), {
    cacheDir: "test-results/profile-account/vite-cache",
    server: { hmr: false },
    optimizeDeps: { entries: ["e2e/fixtures/profile-account.html"] },
  }),
);
