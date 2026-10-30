import { defineConfig, mergeConfig } from "vite";
import appConfig from "../../vite.config.ts";

export default defineConfig(async (env) =>
  mergeConfig(await appConfig(env), {
    cacheDir: "test-results/auth-restore/vite-cache",
    build: { outDir: "test-results/auth-restore/dist" },
  }),
);
