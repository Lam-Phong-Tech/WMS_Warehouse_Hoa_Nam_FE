/** Isolated CSS regression, not an authenticated application/API test.
 * node scripts/verify-inbound-apply-color.mjs [--chromium /usr/bin/chromium]
 * Uses real inbound CSS and operation tokens with a small button/form harness.
 */
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../", import.meta.url));
const css = await readFile(resolve(root, "src/modules/inbound/pages/inbound-list.css"), "utf8");
const tokens = await readFile(resolve(root, "src/shared/ui/tokens/operations.css"), "utf8");
const selector = ".hn-inbound-list .MuiButton-root.hn-inbound-apply:not(:disabled):not(.Mui-disabled)";
const rule = `${selector} {\n  color: var(--wms-on-primary);\n}`;
assert.ok(css.includes(rule), "scoped enabled-only foreground rule exists");
const original = css.replace(rule, "");
const out = resolve(root, "test-results/inbound-apply");
await mkdir(out, { recursive: true });
const index = process.argv.indexOf("--chromium");
const browser = await chromium.launch({ headless: true, executablePath: index < 0 ? undefined : process.argv[index + 1] });
const page = await browser.newPage();
const records = [];
// Approximate generated MUI rules to exercise both injection orders. The actual
// ActionButton component is source-reviewed separately; it is not mounted here.
const mui = `.MuiButton-root { font:inherit; padding:8px 16px; border:0; }
.css-action { color:var(--ops-link); background:var(--ops-pale); }
.css-action:hover { color:var(--ops-link); }
.css-action.Mui-disabled { color:var(--ops-inactive); background:var(--ops-line); pointer-events:none; }`;
const setup = `body { margin:24px; background:var(--ops-canvas); font-family:Arial,sans-serif; }
  .harness { display:flex; flex-wrap:wrap; gap:14px; padding:18px; background:var(--ops-surface); }
  .MuiButton-root { min-width:130px; }`;
async function mount(patched, width, theme, lateMui) {
  await page.setViewportSize({ width, height:600 });
  const source = patched ? css : original;
  await page.setContent(`<html data-theme="${theme}"><head><style>${tokens}${setup}${lateMui ? source + mui : mui + source}</style></head>
    <body><main class="hn-inbound-list"><form class="harness">
      <button id="apply" type="submit" class="MuiButton-root css-action hn-inbound-apply" data-action-kind="filter">Áp dụng</button>
      <button id="reset" type="button" class="MuiButton-root css-action hn-inbound-reset">Đặt lại</button>
      <button id="create" type="button" class="MuiButton-root css-action hn-inbound-create">Tạo phiếu nhập</button>
      <button id="disabled" type="submit" class="MuiButton-root css-action hn-inbound-apply Mui-disabled" disabled>Áp dụng</button>
      <button id="loading" type="submit" class="MuiButton-root css-action hn-inbound-apply Mui-disabled" disabled aria-busy="true">Đang áp dụng</button>
    </form></main><button id="outside" class="MuiButton-root css-action hn-inbound-apply">Other page</button></body></html>`);
  await page.evaluate(() => {
    window.submissions = 0;
    document.querySelector("form").addEventListener("submit", (event) => { event.preventDefault(); window.submissions++; });
  });
  await page.mouse.move(0, 0);
}
async function styles(id) {
  return page.locator(`#${id}`).evaluate((el) => {
    const s = getComputedStyle(el), b = el.getBoundingClientRect();
    return { color:s.color, background:s.backgroundColor, width:b.width, height:b.height,
      border:s.border, opacity:s.opacity, pointer:s.pointerEvents, disabled:el.disabled };
  });
}
async function white(state) {
  assert.equal((await styles("apply")).color, "rgb(255, 255, 255)", `${state} label must be white`);
}
try {
  for (const width of [1581, 800, 375]) for (const theme of ["light", "dark"]) for (const lateMui of [false, true]) {
    await mount(false, width, theme, lateMui);
    const before = await styles("apply");
    assert.notEqual(before.color, "rgb(255, 255, 255)", "reproduce neutral-text specificity conflict");
    const controls = Object.fromEntries(await Promise.all(["reset", "create", "disabled", "loading", "outside"].map(async (id) => [id, await styles(id)])));
    await mount(true, width, theme, lateMui);
    const after = await styles("apply");
    await white("default");
    assert.deepEqual({ ...after, color:before.color }, before, "only foreground changes; dimensions and background remain unchanged");
    for (const [id, value] of Object.entries(controls)) assert.deepEqual(await styles(id), value, `${id} must be unchanged`);
    await page.locator("#apply").hover(); await white("hover");
    await page.mouse.down(); await white("pressed"); await page.mouse.up();
    assert.equal(await page.evaluate(() => window.submissions), 1, "mouse submits once");
    await page.mouse.move(0, 0);
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    assert.equal(await page.locator("#apply").evaluate((el) => el.matches(":focus-visible")), true, "keyboard focus visible");
    await white("keyboard focus");
    await page.keyboard.press("Enter");
    assert.equal(await page.evaluate(() => window.submissions), 2, "Enter submits once");
    await page.evaluate(() => { document.querySelector("#disabled").click(); document.querySelector("#loading").click(); });
    assert.equal(await page.evaluate(() => window.submissions), 2, "disabled and loading remain locked");
    records.push({ width, theme, lateMui, before:before.color, after:after.color });
  }
  await mount(true, 1581, "light", false);
  await page.screenshot({ path:resolve(out, "button-states-1581.png") });
  await writeFile(resolve(out, "results.json"), JSON.stringify({ status:"passed", scope:"isolated CSS/browser harness", scenarios:records.length, records }, null, 2));
  console.log(`PASS ${records.length} viewport/theme/injection-order scenarios: default, hover, press, keyboard focus, disabled, loading, unrelated controls and form semantics.`);
} finally { await browser.close(); }
