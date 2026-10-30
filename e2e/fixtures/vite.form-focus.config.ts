import { defineConfig, mergeConfig } from "vite";
import appConfig from "../../vite.config.ts";

export default defineConfig(async (env) =>
  mergeConfig(await appConfig(env), {
    // A worktree can share node_modules with a running developer server.
    // Keep its dependency optimizer cache separate to avoid invalidating either.
    cacheDir: "test-results/form-focus/vite-cache",
    optimizeDeps: { entries: ["e2e/fixtures/outlined-fields.html"] },
  }),
);
