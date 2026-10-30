import { chromium, expect, type FullConfig } from "@playwright/test";

export default async function warmFixture(config: FullConfig) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    // A fresh optimizer cache can take longer than an individual test. Warm
    // the real component graph once before measuring any hover/focus behavior.
    await page.goto(
      `${config.projects[0].use.baseURL}/e2e/fixtures/outlined-fields.html`,
      { timeout: 180_000 },
    );
    await expect(page.getByTestId("filled")).toBeVisible();
  } finally {
    await browser.close();
  }
}
