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

      await navigator.serviceWorker.register("/service-worker.js", { scope: "/" });
      await navigator.serviceWorker.ready;
    });

    await expect
      .poll(
        () =>
          page.evaluate(
            () => Boolean(navigator.serviceWorker.controller),
          ),
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
    expect(cachedUrls.some((url) => /\/api(?:\/|$)/i.test(new URL(url).pathname))).toBe(
      false,
    );

    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));

    await expect(page.getByRole("status")).toContainText("Đang ngoại tuyến");
    await expect(page.getByRole("status")).toContainText("mọi thao tác ghi đã bị khóa");
  });
});
