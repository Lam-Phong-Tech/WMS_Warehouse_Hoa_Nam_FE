/**
 * Cấu hình Vite RIÊNG cho bàn đo (bench) — KHÔNG dính vào bản build của app.
 *
 * Vì sao đặt ngoài `src/`: mọi guard UI (`yarn ui:guards`), ESLint và Prettier
 * của dự án chỉ quét `src/`. Bàn đo cần import trực tiếp `@mui/material` và
 * dựng `ThemeProvider` riêng — nếu nằm trong `src/` nó sẽ vi phạm guard
 * "provider ngoài composition root" dù chỉ là công cụ đo.
 *
 * Bàn đo import ĐÚNG component thật (`@/shared/components/data-display/...`),
 * không phải bản chép — số đo mới nói được điều gì về app.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const benchDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(benchDir, "../../..");

export default defineConfig({
  root: benchDir,
  plugins: [react()],
  define: { __APP_BUILD_ID__: JSON.stringify("bench") },
  resolve: { alias: { "@": path.resolve(repoRoot, "src") } },
  build: {
    outDir: path.resolve(benchDir, "dist"),
    emptyOutDir: true,
    // Bàn đo cần số đo ổn định giữa hai lần chạy: một chunk duy nhất loại bỏ
    // nhiễu do thứ tự tải chunk khác nhau.
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
