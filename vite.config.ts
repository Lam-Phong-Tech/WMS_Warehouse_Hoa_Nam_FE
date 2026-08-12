import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      "@": path.resolve(rootDir, "./src"),
    },
  },

  build: {
    chunkSizeWarningLimit: 1000,

    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return;

          if (
            /[\\/]node_modules[\\/](react|react-dom|react-router-dom)[\\/]/.test(
              id,
            )
          ) {
            return "vendor-react";
          }

          if (
            /[\\/]node_modules[\\/](@tanstack[\\/]react-query|axios)[\\/]/.test(
              id,
            )
          ) {
            return "vendor-data";
          }

          if (
            /[\\/]node_modules[\\/](react-hook-form|@hookform[\\/]resolvers|zod)[\\/]/.test(
              id,
            )
          ) {
            return "vendor-form";
          }

          if (/[\\/]node_modules[\\/]dayjs[\\/]/.test(id)) {
            return "vendor-dayjs";
          }

          // XLSX is large and only needed by import/export flows. Isolating it
          // prevents login and ordinary navigation from downloading it.
          if (/[\\/]node_modules[\\/]xlsx[\\/]/.test(id)) {
            return "vendor-xlsx";
          }

          // Do not force Ant Design, rc-* and every remaining dependency into
          // monolithic vendor chunks. Rollup can then keep modules that are only
          // used by lazy pages out of the initial login/shell request graph.
          return undefined;
        },
      },
    },
  },
});
