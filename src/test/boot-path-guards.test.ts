/**
 * HÀNG RÀO ĐƯỜNG TỚI HẠN CỦA F5 — chống tái diễn đúng bốn thứ đã sửa 07/09/2026.
 *
 * Bối cảnh: người dùng báo "F5 mất hơn 2 giây". Đo phân rã từng chặng
 * (`scripts/perf/measure-reload.mjs` + CDP Profiler) tìm ra bốn nguyên nhân, mỗi
 * cái là một lớp lỗi rất dễ vô tình dựng lại khi thêm màn hoặc thêm thư viện:
 *
 *  1. `React.lazy` treo dù chunk đã nạp trước, và React 19 hoãn commit thêm
 *     300 ms (fallback throttle) → khoảng chết 325–400 ms giữa lúc `/auth/refresh`
 *     trả về và lúc trang bắt đầu gọi API. Đã thay bằng `lazyRoute`.
 *  2. `laravel-echo` + `pusher-js` (~110 KB) nằm trong đồ thị TẢI NGAY của mọi
 *     lần tải trang, kể cả màn đăng nhập, chỉ vì `auth.store` import
 *     `disconnectEcho`. Đã chuyển sang `import()` bên trong `connectEcho()`.
 *  3. Router và lớp nạp trước giữ HAI danh sách `import()` song song — thêm màn
 *     mà quên một bên là mất nạp trước trong im lặng. Nay dùng chung
 *     `route-components.ts`.
 *  4. Hiệu ứng chuyển trang chạy từ opacity 0 ngay ở lần tải đầu → nội dung đã
 *     sẵn sàng nhưng người dùng phải chờ thêm gần 0,3 giây.
 *
 * Bốn luật dưới đây kiểm TĨNH trên mã nguồn nên chạy được ở mọi môi trường, kể
 * cả khi chưa có bản build.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

describe("đường tới hạn F5 — hàng rào tĩnh", () => {
  it("router KHÔNG dùng React.lazy trực tiếp (phải qua lazyRoute)", () => {
    const router = read("src/app/router/index.tsx");
    // `lazy(` trần làm mất cả hai thứ: render thẳng khi đã nạp trước, và việc
    // dùng chung một đối tượng với route-preload.
    expect(router).not.toMatch(/\blazy\s*\(/);
    expect(router).toContain('from "@/app/router/route-components"');
  });

  it("mọi màn khai báo MỘT LẦN ở route-components (preload dùng lại, không lặp import)", () => {
    const preload = read("src/app/router/route-preload.ts");
    // Lớp nạp trước không được tự khai `import("...")` nữa — đó chính là chỗ hai
    // danh sách trôi khỏi nhau.
    expect(preload).not.toMatch(/import\(\s*["']@\//);
    expect(preload).toContain('from "@/app/router/route-components"');

    const components = read("src/app/router/route-components.ts");
    const declared = [
      ...components.matchAll(/^export const (\w+) = lazyRoute/gm),
    ].map((m) => m[1]);
    // Ngưỡng thấp có chủ đích: chỉ để bắt trường hợp file bị rút ruột, không
    // phải để đếm chính xác số màn (số đó còn tăng).
    expect(declared.length).toBeGreaterThan(30);

    // Mọi màn router render phải đến TỪ file đó.
    // `[^}]*` chứ không phải `[\s\S]*?`: dấu `{` đầu tiên trong file là của
    // `import { Suspense } from "react"`, và một pattern lười vẫn nhảy qua được
    // nó để chạm tới `} from ".../route-components"` — khối bắt được khi đó gộp
    // cả import khác.
    const imported = read("src/app/router/index.tsx").match(
      /import \{([^}]*)\} from "@\/app\/router\/route-components";/,
    );
    expect(imported).not.toBeNull();
    const names = imported![1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const name of names) expect(declared).toContain(name);
  });

  it("laravel-echo/pusher-js chỉ được nạp động, không import tĩnh", () => {
    const echo = read("src/shared/lib/echo.ts");
    // `import type` được phép (TypeScript xoá lúc biên dịch, không sinh runtime).
    expect(echo).not.toMatch(/^import\s+Echo\s+from\s+["']laravel-echo["']/m);
    expect(echo).not.toMatch(/^import\s+Pusher\s+from\s+["']pusher-js["']/m);
    expect(echo).toMatch(/import\(\s*["']laravel-echo["']\s*\)/);
    expect(echo).toMatch(/import\(\s*["']pusher-js["']\s*\)/);

    // Và không nơi nào khác kéo chúng vào tĩnh.
    for (const file of [
      "src/shared/store/auth.store.ts",
      "src/modules/notifications/hooks/useNotificationSocket.ts",
    ]) {
      const src = read(file);
      expect(src).not.toContain('from "laravel-echo"');
      expect(src).not.toContain('from "pusher-js"');
    }
  });

  it("màn đầu tiên sau khi tải trang không chạy hiệu ứng chuyển trang", () => {
    // main.tsx đặt cờ, MainLayout gỡ sau khung hình đầu, CSS tắt animation khi
    // cờ còn đó. Thiếu một trong ba là hiệu ứng quay lại chặn nội dung lúc F5.
    expect(read("src/main.tsx")).toContain('setAttribute("data-hn-first-load"');
    expect(read("src/app/layouts/MainLayout.tsx")).toContain(
      'removeAttribute("data-hn-first-load")',
    );
    const css = read("src/styles/hn-motion.css");
    expect(css).toContain("html[data-hn-first-load] .hn-page-transition");
    expect(css).toMatch(/animation:\s*none/);
  });

  it("IndexedDB được mở song song với vòng mạng xác thực, không nối tiếp sau nó", () => {
    const main = read("src/main.tsx");
    expect(main).toContain("warmIdb()");
    expect(read("src/shared/cache/idb.ts")).toContain(
      "export function warmIdb",
    );
  });

  it("persisted cache được ghi khi rời trang, không chỉ theo debounce", () => {
    const persister = read("src/shared/cache/query-persister.ts");
    expect(persister).toContain('addEventListener("pagehide"');
    expect(persister).toContain("ensureFlushOnLeave");
  });
});
