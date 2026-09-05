import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Định danh build — nguồn sự thật cho CẢ persisted query cache (IndexedDB) lẫn
 * tên CacheStorage của service worker. Deploy mới đổi giá trị này nên hai lớp
 * cache phía client tự hết hiệu lực, thay vì phục vụ chunk/shape của bản cũ.
 *
 * Thứ tự ưu tiên: SHA do CI cấp -> SHA git tại chỗ -> timestamp. Không bao giờ
 * để rỗng: chuỗi rỗng làm mọi build trông giống nhau với client.
 */
function resolveBuildId(): string {
  const fromCi =
    process.env.WMS_BUILD_ID ??
    process.env.SOURCE_SHA ??
    process.env.WMS_SOURCE_SHA ??
    process.env.GITHUB_SHA;
  if (fromCi) return fromCi.slice(0, 12);

  try {
    return execSync("git rev-parse --short=12 HEAD", {
      cwd: rootDir,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return `t${Date.now().toString(36)}`;
  }
}

export default defineConfig({
  plugins: [react()],

  define: {
    __APP_BUILD_ID__: JSON.stringify(resolveBuildId()),
  },

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
