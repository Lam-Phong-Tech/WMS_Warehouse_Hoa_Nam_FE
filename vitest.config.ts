import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Cùng hằng số build mà vite.config.ts inject. Test phải thấy một giá trị CỐ
  // ĐỊNH: để nó rơi về nhánh timestamp thì khoá persisted cache đổi giữa hai lần
  // chạy và test namespace sẽ nhấp nháy.
  define: {
    __APP_BUILD_ID__: JSON.stringify("test-build"),
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: true,
    testTimeout: 20000,
    reporters: ["default", "junit", "json"],
    outputFile: {
      junit: "test-results/vitest-junit.xml",
      json: "test-results/vitest-results.json",
    },
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage",
      reporter: ["text-summary", "html", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.{test,spec}.{ts,tsx}", "src/test/**"],
    },
    include: [
      "src/**/*.{test,spec}.{js,ts,jsx,tsx}",
      "src/**/__tests__/**/*.{js,ts,jsx,tsx}",
    ],
    exclude: ["node_modules", "dist", "e2e"],
    env: {
      VITE_APP_ENV: "test",
      VITE_APP_TITLE: "WMS Hoa Nam",
      VITE_APP_VERSION: "1.0.0",
      VITE_API_BASE_URL: "https://astrodev.test8.io.vn/api/v1",
      VITE_API_HEALTH_PATH: "/health",
      VITE_API_TIMEOUT_MS: "10000",
      VITE_API_WITH_CREDENTIALS: "true",
      VITE_STORAGE_URL: "",
      VITE_ENABLE_ANALYTICS: "false",
      VITE_ENABLE_DEBUG: "false",
      VITE_ENABLE_PERF_MONITOR: "false",
      // Bộ test khẳng định hợp đồng MẶC ĐỊNH (fail-closed, có nút Thử lại).
      // Ghim tắt ở đây để .env của máy đang bật chế độ máy quét không làm đỏ
      // test — muốn kiểm chế độ đó thì mock runtimeConfig trong chính test.
      VITE_SCANNER_KIOSK_MODE: "false",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "./src"),
    },
  },
});
