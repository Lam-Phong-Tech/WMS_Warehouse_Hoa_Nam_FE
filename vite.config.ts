import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import {
  transportViolation,
  type TransportEnvName,
} from "./src/shared/config/transport-security";

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

/**
 * Chèn `preconnect` tới origin của API vào <head>.
 *
 * VÌ SAO: `POST /auth/refresh` là request đầu tiên và nằm trên đường tới hạn
 * của MỌI lần F5, nhưng nó chỉ khởi động sau khi bundle chạy. Lúc đó trình
 * duyệt mới bắt đầu phân giải DNS + bắt tay TCP (+ TLS ở môi trường thật) với
 * origin API — mấy vòng mạng nối tiếp trước khi byte đầu tiên được gửi đi.
 * `preconnect` khai trong <head> cho phép làm việc đó NGAY khi trình duyệt
 * phân tích HTML, song song với việc tải JS/CSS.
 *
 * Origin lấy từ chính `VITE_API_BASE_URL` của bản build nên không thể lệch với
 * cấu hình runtime; nếu API cùng origin với FE thì tag chỉ là vô hại.
 */
function apiPreconnect(apiBaseUrl: string | undefined) {
  return {
    name: "wms-api-preconnect",
    transformIndexHtml(html: string) {
      if (!apiBaseUrl) return html;
      let origin: string;
      try {
        origin = new URL(apiBaseUrl).origin;
      } catch {
        return html;
      }
      const tags = [
        `<link rel="preconnect" href="${origin}" crossorigin />`,
        `<link rel="dns-prefetch" href="${origin}" />`,
      ].join("\n    ");
      return html.replace("</head>", `  ${tags}\n  </head>`);
    },
  };
}

/**
 * WWHN-SEC-04 — chặn bản dựng trỏ tới host thật qua http://.
 *
 * `env.ts` đã chặn lúc SPA khởi động, nhưng lúc đó artifact sai ĐÃ tồn tại và
 * có thể đã được đẩy lên máy chủ. Chặn thêm ở đây để lỗi cấu hình chết ngay
 * trong pipeline, trước khi có gì để deploy. Cùng dùng chung một luật với
 * runtime nên hai tầng không thể nói khác nhau.
 */
function assertSecureBuildConfig(env: Record<string, string>) {
  const envName = (env.VITE_APP_ENV || "local").toLowerCase() as TransportEnvName;

  for (const key of ["VITE_API_BASE_URL", "VITE_STORAGE_URL"] as const) {
    const value = env[key];
    if (!value) continue;

    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      // Hình dạng URL sai là việc của env.ts (câu lỗi ở đó chi tiết hơn).
      continue;
    }

    const violation = transportViolation(parsed, key, envName);
    if (violation) {
      throw new Error(`[vite] Bản dựng bị chặn vì cấu hình không an toàn: ${violation}`);
    }
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, "VITE_");
  assertSecureBuildConfig(env);
  return {
  plugins: [react(), apiPreconnect(env.VITE_API_BASE_URL)],

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
  };
});
