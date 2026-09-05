import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("WWHN-325 PWA static security contract", () => {
  it("ships an installable manifest with required icons", () => {
    const manifest = JSON.parse(
      readFileSync("public/manifest.webmanifest", "utf8"),
    ) as {
      name?: string;
      short_name?: string;
      start_url?: string;
      scope?: string;
      display?: string;
      icons?: Array<{ src?: string; sizes?: string; type?: string }>;
    };

    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: "/pwa-icon-192.png",
          sizes: "192x192",
          type: "image/png",
        }),
        expect.objectContaining({
          src: "/pwa-icon-512.png",
          sizes: "512x512",
          type: "image/png",
        }),
      ]),
    );
    expect(existsSync("public/pwa-icon-192.png")).toBe(true);
    expect(existsSync("public/pwa-icon-512.png")).toBe(true);
  });

  it("keeps API/auth/mutations outside service-worker cache and has no background sync", () => {
    const worker = readFileSync("public/service-worker.js", "utf8");

    expect(worker).toContain('if (request.method !== "GET") return;');
    expect(worker).toContain("API_PATH.test(url.pathname)");
    expect(worker).toContain('request.headers.has("authorization")');
    expect(worker).toContain("url.origin !== self.location.origin");
    expect(worker).not.toMatch(/addEventListener\(["']sync["']/);
    expect(worker).not.toContain("SyncManager");
  });

  it("documents network-first navigation and explicit versioned cache cleanup", () => {
    const worker = readFileSync("public/service-worker.js", "utf8");

    expect(worker).toContain('request.mode === "navigate"');
    expect(worker).toContain("fetch(request)");
    expect(worker).toContain("CACHE_PREFIX");
    expect(worker).toContain("caches.delete(key)");
  });

  it("gắn tên CacheStorage với build id thay vì hằng số v1", () => {
    const worker = readFileSync("public/service-worker.js", "utf8");

    // Ghim cứng "-v1" chính là nguyên nhân chunk của mọi build cũ nằm lại vĩnh
    // viễn: tên file có hash nên URL mới không bao giờ ghi đè URL cũ, mà cũng
    // không có gì xoá URL cũ đi.
    // Khớp trên PHÉP GÁN chứ không trên chuỗi bất kỳ: tài liệu trong file vẫn
    // được phép nhắc tên cũ để giải thích vì sao nó sai.
    expect(worker).not.toMatch(
      /STATIC_CACHE\s*=\s*`\$\{CACHE_PREFIX\}-static-v\d+`/,
    );
    expect(worker).toContain('searchParams.get("v")');
    expect(worker).toMatch(
      /STATIC_CACHE\s*=\s*`\$\{CACHE_PREFIX\}-static-\$\{BUILD_ID\}`/,
    );
  });

  it("đăng ký service worker kèm build id để deploy mới thay được SW cũ", () => {
    const register = readFileSync("src/shared/pwa/register-pwa.ts", "utf8");

    expect(register).toContain("/service-worker.js?v=");
    expect(register).toContain("__APP_BUILD_ID__");
  });

  it("cache-first cho asset có hash nội dung, SWR cho asset không hash", () => {
    const worker = readFileSync("public/service-worker.js", "utf8");

    expect(worker).toContain("CONTENT_HASHED");
    expect(worker).toContain("cacheFirst(request)");
    expect(worker).toContain("staleWhileRevalidate(request)");
  });
});
