/** AGY-01 hover regression: node scripts/verify-agency-row-hover.mjs [output-dir] */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = resolve(
  process.argv[2] ?? resolve(root, "test-results/agency-row-hover"),
);
const styles = await Promise.all(
  [
    "src/shared/ui/tokens/css-vars.css",
    "src/shared/ui/tokens/css-vars-dark.css",
    "src/shared/ui/tokens/operations.css",
    "src/modules/master-data/components/agency-list.css",
  ].map((path) => readFile(resolve(root, path), "utf8")),
);
await mkdir(output, { recursive: true });

// The screen renders these same eleven cells; its CSS reflows them into a
// six-column grid on tablet and a card on mobile, leaving gaps between cells.
const row = (id) => `<tr data-row="${id}">
  <td class="stt-col">${id}</td><td>KHDA-00${id}</td>
  <td>Hợp tác xã lúa gạo Thới Lai</td><td>Khách công trình</td>
  <td>Miền Nam</td><td>Cần Thơ</td><td>Trần Văn Bé Tư</td>
  <td>0901234512</td><td>Ấp Thới Thuận, xã Thới Tân, Thới Lai, Cần Thơ</td>
  <td class="agy-status-active"><span>Đang sử dụng</span></td>
  <td><button type="button" aria-label="Sửa đại lý ${id}">Sửa</button></td>
</tr>`;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const results = [];
try {
  for (const theme of ["light", "dark"]) {
    for (const width of [360, 619, 620, 900, 1250, 1251, 1440]) {
      const errors = [];
      await page.setViewportSize({ width, height: 1100 });
      await page.setContent(`<!doctype html><html data-theme="${theme}"><head>
        <style>body{margin:0}*{box-sizing:border-box}${styles.join("\n")}</style>
        </head><body><main class="hn-agency-screen">
        <div class="agy-table-wrap"><table class="agy-table"><tbody>
        ${row(1)}${row(2)}</tbody></table></div></main></body></html>`);
      const first = page.locator('[data-row="1"]');
      const second = page.locator('[data-row="2"]');
      const background = (locator) =>
        locator.evaluate(
          (element) => getComputedStyle(element).backgroundColor,
        );
      const idle = await background(second);
      const badge = await background(first.locator(".agy-status-active span"));
      for (const target of [
        "td:nth-child(2)",
        "td:nth-child(7)",
        ".agy-status-active span",
        "button",
      ]) {
        await first.locator(target).hover();
        const rowColor = await background(first);
        const cells = await first
          .locator("td")
          .evaluateAll((elements) =>
            elements.map(
              (element) => getComputedStyle(element).backgroundColor,
            ),
          );
        if (rowColor === "rgba(0, 0, 0, 0)")
          errors.push(`${target}: row background is transparent`);
        if (!cells.every((color) => color === "rgba(0, 0, 0, 0)"))
          errors.push(`${target}: cell backgrounds split the highlight`);
        if ((await background(second)) !== idle)
          errors.push(`${target}: adjacent row highlighted`);
        if (
          (await background(first.locator(".agy-status-active span"))) !== badge
        )
          errors.push(`${target}: status badge changed`);
      }
      // Hover the row padding itself, outside all cells, as in the screenshot.
      if (width <= 1250) {
        await first.hover({ position: { x: 2, y: 2 } });
        if ((await background(first)) === "rgba(0, 0, 0, 0)")
          errors.push("row padding is not highlighted");
      }
      await first.locator("button").click();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Shift+Tab");
      assert.equal(
        await first
          .locator("button")
          .evaluate((element) => element === document.activeElement),
        true,
        "edit action remains keyboard focusable",
      );
      await first.locator("td:nth-child(2)").hover();
      await page.screenshot({
        path: resolve(output, `${theme}-${width}.png`),
        fullPage: true,
      });
      await page.mouse.move(width - 1, 1099);
      if ((await background(first)) !== idle)
        errors.push("highlight remains after leaving the row");
      results.push({ theme, width, passed: errors.length === 0, errors });
    }
  }
} finally {
  await browser.close();
  await writeFile(
    resolve(output, "results.json"),
    JSON.stringify(results, null, 2),
  );
}
const failures = results.filter((result) => !result.passed);
console.log(
  `${results.length - failures.length}/${results.length} agency hover cases passed`,
);
for (const failure of failures)
  console.error(
    `${failure.theme} ${failure.width}: ${failure.errors.join("; ")}`,
  );
assert.equal(
  failures.length,
  0,
  "the entire agency row must highlight as one block",
);
