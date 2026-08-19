import { expect, test } from "@playwright/test";

test.describe("WWHN-325 PWA/cache/offline runtime evidence", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.setOffline(false);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await page.evaluate(async () => {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((item) => item.unregister()));
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
    });
  });

  test.afterEach(async ({ context }) => {
    await context.setOffline(false);
  });

  test("manifest and required PWA icons are reachable", async ({ request }) => {
    const manifestResponse = await request.get("/manifest.webmanifest");
    expect(manifestResponse.ok()).toBeTruthy();

    const manifest = (await manifestResponse.json()) as {
      start_url?: string;
      scope?: string;
      display?: string;
      icons?: Array<{ src?: string; sizes?: string; type?: string }>;
    };

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

    for (const icon of manifest.icons ?? []) {
      if (!icon.src) continue;
      const iconResponse = await request.get(icon.src);
      expect(iconResponse.ok()).toBeTruthy();
      expect(iconResponse.headers()["content-type"]).toContain("image/png");
    }
  });

  test("service worker caches only shell/static resources and offline UX is fail-safe", async ({
    context,
    page,
  }) => {
    await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) {
        throw new Error("SERVICE_WORKER_UNSUPPORTED");
      }

      await navigator.serviceWorker.register("/service-worker.js", {
        scope: "/",
      });
      await navigator.serviceWorker.ready;
    });

    await expect
      .poll(
        () => page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
        { timeout: 10_000 },
      )
      .toBe(true);

    const cachedUrls = await page.evaluate(async () => {
      const cacheNames = await caches.keys();
      const urls: string[] = [];
      for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const requests = await cache.keys();
        urls.push(...requests.map((request) => request.url));
      }
      return urls;
    });

    expect(cachedUrls.length).toBeGreaterThan(0);
    expect(
      cachedUrls.some((url) => /\/api(?:\/|$)/i.test(new URL(url).pathname)),
    ).toBe(false);

    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));

    await expect(page.getByRole("status")).toContainText("Đang ngoại tuyến");
    await expect(page.getByRole("status")).toContainText(
      "mọi thao tác ghi đã bị khóa",
    );
  });

  // FE325-P1-12: mutation offline (receipt/issue/reversal/adjustment) không được
  // gửi, không được queue (không Background Sync) và không được replay sau khi
  // online lại. Adjustment không có FE surface (WWHN-236 DEFERRED/NO-CODE) nên
  // path adjustment ở đây là bằng chứng mức endpoint/method.
  test("offline mutations are not sent, not queued, and never replayed after reconnect", async ({
    context,
    page,
  }) => {
    await page.evaluate(async () => {
      await navigator.serviceWorker.register("/service-worker.js", {
        scope: "/",
      });
      await navigator.serviceWorker.ready;
    });

    // Chỉ theo dõi MUTATION tới /api: GET refetch sau reconnect (ví dụ
    // TanStack Query refetchOnReconnect) là read hợp lệ, không phải replay.
    const apiMutationRequests: string[] = [];
    context.on("request", (request) => {
      const url = new URL(request.url());
      if (request.method() !== "GET" && /^\/api(?:\/|$)/i.test(url.pathname)) {
        apiMutationRequests.push(`${request.method()} ${url.pathname}`);
      }
    });

    await context.setOffline(true);

    const offlineResults = await page.evaluate(async () => {
      const targets: Array<[string, string]> = [
        ["POST", "/api/v1/inbound-documents/e2e-325/post-receipt"],
        ["POST", "/api/v1/outbound-documents/e2e-325/post-issue"],
        ["POST", "/api/v1/reversal-documents/e2e-325/post"],
        ["POST", "/api/v1/adjustments/apply"],
        ["PUT", "/api/v1/adjustments/e2e-325"],
        ["PATCH", "/api/v1/adjustments/e2e-325"],
        ["DELETE", "/api/v1/adjustments/e2e-325"],
      ];
      const results: Array<{ method: string; url: string; outcome: string }> =
        [];
      for (const [method, url] of targets) {
        try {
          const response = await fetch(url, { method });
          results.push({ method, url, outcome: `response:${response.status}` });
        } catch {
          results.push({ method, url, outcome: "network-error" });
        }
      }
      return results;
    });

    // Không mutation nào nhận được response khi offline: service worker không
    // handle non-GET nên không thể trả cache, cũng không nuốt lỗi để queue.
    for (const result of offlineResults) {
      expect(result, `${result.method} ${result.url}`).toMatchObject({
        outcome: "network-error",
      });
    }

    // Không Background Sync: registration không có tag chờ replay. Nếu engine
    // tắt hẳn API (getTags ném "Background Sync is disabled") thì đó là bằng
    // chứng còn mạnh hơn — không tồn tại kênh queue nào; kết hợp với static
    // guard trong pwa-assets.test.ts (SW không đăng ký handler "sync").
    const syncState = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      const sync = (
        registration as unknown as {
          sync?: { getTags(): Promise<string[]> };
        }
      ).sync;
      if (!sync) return { tags: [], apiAvailable: false };
      try {
        return { tags: await sync.getTags(), apiAvailable: true };
      } catch (error) {
        return {
          tags: [],
          apiAvailable: false,
          disabledReason: String(error),
        };
      }
    });
    expect(syncState.tags).toEqual([]);

    // Online trở lại: nếu có bất kỳ queue/replay nào thì mutation /api sẽ
    // xuất hiện trong cửa sổ chờ này.
    const observedBeforeReconnect = apiMutationRequests.length;
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await page.waitForTimeout(3_000);

    expect(apiMutationRequests.slice(observedBeforeReconnect)).toEqual([]);
  });

  // FE325-P1-12: SW update flow runtime thật — bản SW mới chỉ được kích hoạt
  // sau SKIP_WAITING (đúng message mà nút "Cập nhật ngay" của PwaStatus gửi);
  // nửa UI của flow này được chốt ở src/shared/pwa/PwaStatus.test.tsx vì
  // registerPwa chỉ chạy trên production build.
  test("service worker update flow activates the waiting worker only after SKIP_WAITING", async ({
    page,
  }) => {
    await page.evaluate(async () => {
      await navigator.serviceWorker.register("/service-worker.js", {
        scope: "/",
      });
      await navigator.serviceWorker.ready;
    });

    await expect
      .poll(
        () => page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
        { timeout: 10_000 },
      )
      .toBe(true);

    // Script URL khác trên cùng scope = browser cài bản cập nhật; bản cũ vẫn
    // giữ quyền điều khiển cho tới khi người dùng chủ động kích hoạt.
    await page.evaluate(async () => {
      await navigator.serviceWorker.register(
        "/service-worker.js?wwhn325=update",
        {
          scope: "/",
        },
      );
    });

    await expect
      .poll(
        () =>
          page.evaluate(async () => {
            const registration =
              await navigator.serviceWorker.getRegistration("/");
            return Boolean(registration?.waiting);
          }),
        { timeout: 15_000 },
      )
      .toBe(true);

    const controllerBefore = await page.evaluate(
      () => navigator.serviceWorker.controller?.scriptURL ?? "",
    );
    expect(controllerBefore).not.toContain("wwhn325=update");

    const controllerAfter = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const waiting = registration?.waiting;
      if (!waiting) throw new Error("NO_WAITING_WORKER");

      const controllerChanged = new Promise<void>((resolve) => {
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => resolve(),
          { once: true },
        );
      });
      waiting.postMessage({ type: "SKIP_WAITING" });
      await controllerChanged;
      return navigator.serviceWorker.controller?.scriptURL ?? "";
    });
    expect(controllerAfter).toContain("wwhn325=update");
  });
});
