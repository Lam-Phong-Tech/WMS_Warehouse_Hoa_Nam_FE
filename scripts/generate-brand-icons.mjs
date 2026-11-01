import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const publicDir = fileURLToPath(new URL("../public/", import.meta.url));
const svg = await readFile(new URL("../public/favicon.svg", import.meta.url));
const brandMarkUrl = `data:image/svg+xml;base64,${svg.toString("base64")}`;

const browser = await chromium.launch({ headless: true });
try {
  for (const size of [192, 512]) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    const markSize = Math.round(size * 0.62);
    await page.setContent(`
      <!doctype html>
      <html>
        <body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;background:#07395e">
          <img src="${brandMarkUrl}" width="${markSize}" height="${markSize}" alt="" />
        </body>
      </html>
    `);
    await page.locator("img").evaluate((image) => image.decode());
    await page.screenshot({ path: join(publicDir, `pwa-icon-${size}.png`) });
    await page.close();
  }
} finally {
  await browser.close();
}
