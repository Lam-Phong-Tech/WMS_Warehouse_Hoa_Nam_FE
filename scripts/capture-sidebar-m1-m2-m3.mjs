// Chụp screenshot sidebar M1/M2/M3 cho evidence Jira.
// Dựa trên mẫu scripts/capture-m1-screenshots.mjs
//
// Usage: node scripts/capture-sidebar-m1-m2-m3.mjs [baseUrl]
// baseUrl mặc định: http://localhost:5173

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const baseUrl = process.argv[2] || 'http://localhost:5173';
const outDir = path.resolve('docs/evidence/sidebar-m1-m2-m3');
mkdirSync(outDir, { recursive: true });

const shots = [];

async function shot(page, name) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  shots.push(name);
  console.log(`  [OK] ${name}.png`);
}

async function clickMenu(page, text) {
  const link = page.locator('aside, nav, [class*="sider"], [class*="menu"]').first()
    .getByText(text, { exact: true }).first();
  await link.click();
  await page.waitForTimeout(900);
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  console.log(`=== Base URL: ${baseUrl} ===`);

  // Step 1: Login
  console.log('Step 1: Login');
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await page.locator('input[type="email"], input[name="email"]').first().fill(process.env.QA_ADMIN_EMAIL ?? (() => { throw new Error('Set QA_ADMIN_EMAIL env var'); })());
  await page.locator('input[type="password"], input[name="password"]').first().fill((process.env.QA_ADMIN_PASSWORD ?? (() => { throw new Error('Set QA_ADMIN_PASSWORD env var'); })()));
  await shot(page, '01_Login_Form');
  await page.getByRole('button', { name: /đăng nhập/i }).first().click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await shot(page, '02_Login_Success');

  // Step 2: Sidebar M1 (Organization)
  console.log('Step 2: Sidebar M1 - Organization');
  await clickMenu(page, 'Đơn vị tổ chức');
  await page.waitForTimeout(800);
  await shot(page, '03_Sidebar_M1_OrgUnits_Active');

  // Step 3: Sidebar M2 (Warehouse)
  console.log('Step 3: Sidebar M2 - Warehouse');
  await clickMenu(page, 'Kho hàng');
  await page.waitForTimeout(800);
  await shot(page, '04_Sidebar_M2_Warehouses_Active');

  // Step 4: M2 Placeholder page
  console.log('Step 4: M2 Placeholder page');
  await clickMenu(page, 'Quản lý kho');
  await page.waitForTimeout(800);
  await shot(page, '05_M2_Warehouse_Placeholder');

  // Step 5: Sidebar M3 (Business) - nếu permission cho phép
  console.log('Step 5: Sidebar M3 - Business');
  try {
    await clickMenu(page, 'Sản phẩm');
    await page.waitForTimeout(800);
    await shot(page, '06_Sidebar_M3_Products_Active');

    // M3 Placeholder page
    console.log('Step 6: M3 Placeholder page');
    await clickMenu(page, 'Quản lý kinh doanh');
    await page.waitForTimeout(800);
    await shot(page, '07_M3_Business_Placeholder');
  } catch (error) {
    console.log('  [SKIP] M3 screenshots: Module 3 không hiển thị (thiếu permission BUSINESS_VIEW/PRODUCT_VIEW)');
    console.log(`  Chi tiết: ${error.message}`);
  }

  // Step 7: Full sidebar view (collapse state)
  console.log('Step 7: Full sidebar view');
  await clickMenu(page, 'Đơn vị tổ chức');
  await page.waitForTimeout(800);
  
  // Collapse sidebar nếu có thể
  const collapseBtn = page.locator('[class*="trigger"], [class*="collapse"], .ant-layout-sider-trigger').first();
  if (await collapseBtn.count()) {
    await collapseBtn.click();
    await page.waitForTimeout(500);
    await shot(page, '08_Sidebar_Collapsed');
  } else {
    console.log('  [SKIP] 08_Sidebar_Collapsed: không tìm thấy nút collapse');
  }

  await browser.close();

  console.log(`\n=== DONE: ${shots.length} screenshots saved to ${outDir} ===`);
  console.log(shots.map((s) => `  - ${s}.png`).join('\n'));
}

main().catch((err) => {
  console.error('CAPTURE FAILED:', err);
  process.exit(1);
});