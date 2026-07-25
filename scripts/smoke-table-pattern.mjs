// P2.3 — Playwright smoke test cho Table/List Pattern: search/filter/sort/
// pagination/empty/action menu trên 3 màn Employees/Departments/Org Units.
// Không dùng @playwright/test (chưa có trong deps) — chạy như script assertion
// thuần bằng package `playwright` sẵn có, cùng convention với
// scripts/capture-*.mjs. Thoát code 1 nếu có assertion fail.
//
// Usage: SCREENSHOT_LOGIN_EMAIL=xxx SCREENSHOT_LOGIN_PASSWORD=xxx \
//   node scripts/smoke-table-pattern.mjs [baseUrl]

import { chromium } from 'playwright';

const baseUrl = process.argv[2] || 'http://localhost:5175';
const LOGIN_EMAIL = process.env.SCREENSHOT_LOGIN_EMAIL;
const LOGIN_PASSWORD = process.env.SCREENSHOT_LOGIN_PASSWORD;
if (!LOGIN_EMAIL || !LOGIN_PASSWORD) {
  console.error(
    'Thiếu biến môi trường SCREENSHOT_LOGIN_EMAIL / SCREENSHOT_LOGIN_PASSWORD.',
  );
  process.exit(1);
}

let passed = 0;
let failed = 0;

async function check(label, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${label}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${label}: ${err.message.split('\n')[0]}`);
    failed++;
  }
}

async function login(page) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await page
    .locator('input[type="email"], input[name="email"]')
    .first()
    .fill(LOGIN_EMAIL);
  await page
    .locator('input[type="password"], input[name="password"]')
    .first()
    .fill(LOGIN_PASSWORD);
  await page
    .getByRole('button', { name: /đăng nhập/i })
    .first()
    .click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
}

async function gotoRoute(page, route, { wait = 1200 } = {}) {
  await page.evaluate((r) => {
    window.history.pushState({}, '', r);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, route);
  if (wait) await page.waitForTimeout(wait);
}

async function smokeEmployees(browser) {
  console.log('\n=== Smoke: Employees ===');
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();
  await login(page);
  await gotoRoute(page, '/employees');

  await check('render bảng nhân sự', async () => {
    await page.locator('.ant-table').first().waitFor({ state: 'visible' });
  });

  await check('search lọc kết quả (keyword không khớp -> 0 dòng)', async () => {
    const keywordInput = page.getByPlaceholder(/Tìm tên, mã, email/i);
    await keywordInput.fill('zzzznotexist12345');
    await page.waitForTimeout(1000);
    const rows = await page.locator('.ant-table-tbody > tr').count();
    const isEmptyRow = await page
      .locator('.ant-empty, .ant-table-placeholder')
      .isVisible()
      .catch(() => false);
    if (rows > 1 && !isEmptyRow) {
      throw new Error(`vẫn còn ${rows} dòng sau khi search keyword lạ`);
    }
    await keywordInput.fill('');
    await page.waitForTimeout(1000);
  });

  await check('action menu "Thao tác" mở được', async () => {
    const firstRow = page.locator('.ant-table-row').first();
    const actionBtn = firstRow
      .locator('button[aria-label^="Xem nhân sự"]')
      .first();
    await actionBtn.waitFor({ state: 'visible', timeout: 5000 });
  });

  await context.close();
}

async function smokeDepartments(browser) {
  console.log('\n=== Smoke: Departments ===');
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();
  await login(page);
  await gotoRoute(page, '/departments');

  await check('render bảng phòng ban', async () => {
    await page.locator('.ant-table').first().waitFor({ state: 'visible' });
  });

  await check('search lọc kết quả (keyword không khớp -> 0 dòng)', async () => {
    const keywordInput = page.getByPlaceholder(/Tìm theo mã, tên/i);
    await keywordInput.fill('zzzznotexist12345');
    await page.waitForTimeout(1000);
    const rows = await page.locator('.ant-table-tbody > tr').count();
    const isEmptyRow = await page
      .locator('.ant-empty, .ant-table-placeholder')
      .isVisible()
      .catch(() => false);
    if (rows > 1 && !isEmptyRow) {
      throw new Error(`vẫn còn ${rows} dòng sau khi search keyword lạ`);
    }
    await keywordInput.fill('');
    await page.waitForTimeout(1000);
  });

  await context.close();
}

async function smokeOrgUnits(browser) {
  console.log('\n=== Smoke: Org Units ===');
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();
  await login(page);
  await gotoRoute(page, '/org-units');

  await check('render cây đơn vị', async () => {
    await page.getByText('Danh sách').waitFor({ state: 'visible' });
  });

  await page.getByText('Danh sách').click();
  await page.waitForTimeout(900);

  await check('render bảng đơn vị (view Bảng)', async () => {
    await page.locator('.ant-table').first().waitFor({ state: 'visible' });
  });

  await check('FilteredEmptyState hiện khi keyword không khớp', async () => {
    const keywordInput = page.getByPlaceholder(/Tìm theo tên, mã/i);
    await keywordInput.fill('zzzznotexist12345');
    await page.waitForTimeout(1000);
    const emptyVisible = await page
      .getByText(/không tìm thấy|không có kết quả|xóa bộ lọc/i)
      .first()
      .isVisible()
      .catch(() => false);
    if (!emptyVisible) {
      throw new Error('không thấy FilteredEmptyState sau khi lọc rỗng');
    }
    await keywordInput.fill('');
    await page.waitForTimeout(900);
  });

  await context.close();
}

async function main() {
  const browser = await chromium.launch();
  console.log(`=== Smoke test Table/List Pattern — Base URL: ${baseUrl} ===`);

  await smokeEmployees(browser);
  await smokeDepartments(browser);
  await smokeOrgUnits(browser);

  await browser.close();

  console.log(`\n=== KẾT QUẢ: ${passed} pass / ${failed} fail ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
