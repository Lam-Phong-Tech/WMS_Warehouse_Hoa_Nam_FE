// Chụp screenshot THẬT cho Org Chart Screen (ALE-82) — tài khoản QA,
// 1 phiên trình duyệt (access token chỉ lưu trong memory, page.goto lần 2 sẽ mất session).
//
// Trạng thái cần bằng chứng theo review: normal tree, filter theo đơn vị, click org
// node (panel chi tiết), click department node (panel chi tiết), 403 (không quyền),
// loading, empty (không có dữ liệu trong phạm vi lọc).
//
// Usage: node scripts/capture-orgchart-screenshots.mjs [baseUrl]

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const baseUrl = process.argv[2] || 'http://localhost:5173';
const outDir = path.resolve('docs/evidence/org-chart');
mkdirSync(outDir, { recursive: true });

const shots = [];

async function shot(page, name) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  shots.push(name);
  console.log(`  [OK] ${name}.png`);
}

async function clickMenu(page, text) {
  const link = page
    .locator('aside, nav, [class*="sider"], [class*="menu"]')
    .first()
    .getByText(text, { exact: true })
    .first();
  await link.click();
  await page.waitForTimeout(900);
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  console.log(`=== Base URL: ${baseUrl} ===`);

  console.log('Step 1: Login');
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await page.locator('input[type="email"], input[name="email"]').first().fill(process.env.QA_ADMIN_EMAIL ?? (() => { throw new Error('Set QA_ADMIN_EMAIL env var'); })());
  await page.locator('input[type="password"], input[name="password"]').first().fill((process.env.QA_ADMIN_PASSWORD ?? (() => { throw new Error('Set QA_ADMIN_PASSWORD env var'); })()));
  await page.getByRole('button', { name: /đăng nhập/i }).first().click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  console.log('Step 2: Mở Sơ đồ tổ chức');
  await clickMenu(page, 'Sơ đồ tổ chức');

  // Loading state: chụp ngay khi vừa điều hướng, trước khi data trả về.
  // Vì client-side navigation quá nhanh nên dùng route riêng để né race —
  // ở đây chấp nhận best-effort: chụp ngay sau click, network có thể đã xong.
  await shot(page, '01_Loading_or_Initial');

  await page.waitForTimeout(1200);
  await shot(page, '02_Normal_Tree');

  console.log('Step 3: Filter theo đơn vị');
  const filterSelect = page.locator('.ant-select').first();
  if (await filterSelect.count()) {
    await filterSelect.click();
    await page.waitForTimeout(400);
    const firstOption = page.locator('.ant-select-item-option').nth(1);
    if (await firstOption.count()) {
      await firstOption.click();
      await page.waitForTimeout(900);
      await shot(page, '03_Filter_By_OrgUnit');
    } else {
      console.log('  [SKIP] 03_Filter_By_OrgUnit: không tìm thấy option');
    }
  } else {
    console.log('  [SKIP] 03_Filter_By_OrgUnit: không tìm thấy select filter');
  }

  console.log('Step 4: Click org node → panel chi tiết');
  // Reset filter về "Tất cả đơn vị" trước khi click node để đảm bảo cây đầy đủ.
  if (await filterSelect.count()) {
    await filterSelect.click();
    await page.waitForTimeout(300);
    const allOption = page.locator('.ant-select-item-option').first();
    if (await allOption.count()) {
      await allOption.click();
      await page.waitForTimeout(900);
    }
  }
  const orgNode = page
    .locator('[class*="org"], div')
    .filter({ hasText: /Công ty|Chi nhánh|Khối|Phòng/ })
    .first();
  const treeNode = page.locator('div[role="button"], div').filter({ hasText: /^(Công ty|Tập đoàn)/ }).first();
  const clickable = (await treeNode.count()) ? treeNode : orgNode;
  if (await clickable.count()) {
    await clickable.click();
    await page.waitForTimeout(900);
    await shot(page, '04_Click_OrgUnit_Node_Detail');
  } else {
    console.log('  [SKIP] 04_Click_OrgUnit_Node_Detail: không tìm thấy node để click');
  }

  console.log('Step 5: Click department node → panel chi tiết');
  const deptNode = page.locator('div').filter({ hasText: /Phòng|Ban/ }).last();
  if (await deptNode.count()) {
    await deptNode.click();
    await page.waitForTimeout(900);
    await shot(page, '05_Click_Department_Node_Detail');
  } else {
    console.log('  [SKIP] 05_Click_Department_Node_Detail: không tìm thấy node phòng ban');
  }

  console.log('Step 6: Empty state (lọc đơn vị không có con)');
  // Best-effort: giữ nguyên filter hiện có, ghi chú thủ công nếu không dựng được empty thật.
  console.log('  [NOTE] Empty/403 states cần dữ liệu/tài khoản riêng — xem ghi chú trong docs.');

  await browser.close();

  console.log(`\n=== DONE: ${shots.length} screenshots saved to ${outDir} ===`);
  console.log(shots.map((s) => `  - ${s}.png`).join('\n'));
}

main().catch((err) => {
  console.error('CAPTURE FAILED:', err);
  process.exit(1);
});
