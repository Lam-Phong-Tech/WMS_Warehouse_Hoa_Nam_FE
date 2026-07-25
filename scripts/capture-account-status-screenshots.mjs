// Chụp screenshot THẬT cho checklist "tag trạng thái tài khoản" (P2 review,
// [M1][FE] Employee List + Detail + Create/Edit) — tài khoản Super Admin,
// môi trường astrodev.test8.io.vn.
//
// Usage: SCREENSHOT_LOGIN_EMAIL=... SCREENSHOT_LOGIN_PASSWORD=... node scripts/capture-account-status-screenshots.mjs [baseUrl]

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const baseUrl = process.argv[2] || 'http://localhost:5173';
const outDir = path.resolve('docs/evidence/employees');
mkdirSync(outDir, { recursive: true });

const LOGIN_EMAIL = process.env.SCREENSHOT_LOGIN_EMAIL;
const LOGIN_PASSWORD = process.env.SCREENSHOT_LOGIN_PASSWORD;
if (!LOGIN_EMAIL || !LOGIN_PASSWORD) {
  console.error(
    'Thiếu biến môi trường SCREENSHOT_LOGIN_EMAIL / SCREENSHOT_LOGIN_PASSWORD.',
  );
  process.exit(1);
}

async function shot(page, name) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  [OK] ${name}.png`);
}

async function login(page) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await page.locator('input[type="email"], input[name="email"]').first().fill(LOGIN_EMAIL);
  await page.locator('input[type="password"], input[name="password"]').first().fill(LOGIN_PASSWORD);
  await page.getByRole('button', { name: /đăng nhập/i }).first().click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
}

async function gotoEmployees(page, { wait = 1200 } = {}) {
  await page.evaluate(() => {
    window.history.pushState({}, '', '/employees');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  if (wait) await page.waitForTimeout(wait);
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  console.log('Step 1: Login');
  await login(page);

  console.log('Step 2: Mở danh sách nhân sự, tìm NV0099 (chưa cấp tài khoản)');
  await gotoEmployees(page);
  const searchInput = page.locator('input[placeholder*="Tìm" i], input[placeholder*="tìm kiếm" i]').first();
  if (await searchInput.isVisible().catch(() => false)) {
    await searchInput.fill('NV0099');
    await page.waitForTimeout(900);
  }
  const tableScroll = page.locator('.ant-table-body, .ant-table-content').first();
  if (await tableScroll.isVisible().catch(() => false)) {
    await tableScroll.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
    await page.waitForTimeout(400);
  }
  await shot(page, '07_List_Chua_Cap_Tai_Khoan');

  console.log('Step 3: Mở detail drawer của NV0099');
  const firstRow = page.locator('.ant-table-row').first();
  if (await firstRow.isVisible().catch(() => false)) {
    const viewBtn = firstRow.locator('button[aria-label^="Xem nhân sự"]').first();
    if (await viewBtn.isVisible().catch(() => false)) {
      await viewBtn.click();
      await page.waitForTimeout(900);
      await shot(page, '08_Detail_Chua_Cap_Tai_Khoan');
    }
  }

  await context.close();
  await browser.close();
  console.log(`\n=== Done. Screenshots in ${outDir} ===`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
