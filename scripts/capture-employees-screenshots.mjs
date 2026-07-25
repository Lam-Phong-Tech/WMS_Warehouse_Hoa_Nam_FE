// Chụp screenshot THẬT cho module Employees (List/Detail/Create/Edit) —
// tài khoản Super Admin, bổ sung evidence còn thiếu theo review ALE-82:
// list, detail drawer, create modal, validation error, edit modal,
// status badge, account status, permission view (403 giả lập qua route intercept).
//
// Usage: node scripts/capture-employees-screenshots.mjs [baseUrl]

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const baseUrl = process.argv[2] || 'http://localhost:5173';
const outDir = path.resolve('docs/evidence/employees');
mkdirSync(outDir, { recursive: true });

// Không hard-code credential trong repo — cấp qua biến môi trường.
const LOGIN_EMAIL = process.env.SCREENSHOT_LOGIN_EMAIL;
const LOGIN_PASSWORD = process.env.SCREENSHOT_LOGIN_PASSWORD;
if (!LOGIN_EMAIL || !LOGIN_PASSWORD) {
  console.error(
    'Thiếu biến môi trường SCREENSHOT_LOGIN_EMAIL / SCREENSHOT_LOGIN_PASSWORD. Ví dụ:\n' +
      '  SCREENSHOT_LOGIN_EMAIL=xxx SCREENSHOT_LOGIN_PASSWORD=xxx node scripts/capture-employees-screenshots.mjs',
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

// Access token chỉ lưu trong memory (không persist) — dùng pushState/popstate
// để điều hướng qua client-side router, tương tự capture-role-scopes-screenshots.mjs.
async function gotoEmployees(page, { wait = 1200 } = {}) {
  await page.evaluate(() => {
    window.history.pushState({}, '', '/employees');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  if (wait) await page.waitForTimeout(wait);
}

async function main() {
  const browser = await chromium.launch();
  console.log(`=== Base URL: ${baseUrl} ===`);

  // --- Phase 1: List + status badge + account status ---
  {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();

    console.log('Step 1: Login');
    await login(page);

    console.log('Step 2: Mở danh sách nhân sự');
    await gotoEmployees(page);
    await shot(page, '01_List');

    console.log('Step 3: Xem chi tiết (detail drawer)');
    const firstRow = page.locator('.ant-table-row').first();
    if (await firstRow.isVisible().catch(() => false)) {
      const viewBtn = firstRow.locator('button[aria-label^="Xem nhân sự"]').first();
      if (await viewBtn.isVisible().catch(() => false)) {
        await viewBtn.click();
        await page.waitForTimeout(900);
        await shot(page, '02_Detail_Drawer');
        // Đóng drawer
        await page.keyboard.press('Escape');
        await page.waitForTimeout(400);
      }
    }

    console.log('Step 4: Mở form Thêm nhân sự (create modal, trạng thái trống)');
    const addBtn = page.getByRole('button', { name: /thêm nhân sự/i }).first();
    if (await addBtn.isVisible().catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(700);
      await shot(page, '03_Create_Modal_Empty');

      console.log('Step 5: Submit rỗng để hiển thị validation error');
      // Nút OK nằm ở footer Modal (antd), không phải trong .ant-modal-body.
      const submitBtn = page.locator('.ant-modal-footer').getByRole('button', { name: /Lưu/ }).last();
      if (await submitBtn.isVisible().catch(() => false)) {
        await submitBtn.click();
        await page.waitForTimeout(600);
        await shot(page, '04_Create_Modal_Validation_Error');
      }

      // Đóng modal
      const closeBtn = page.locator('.ant-modal-close').first();
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click();
        await page.waitForTimeout(400);
      }
    }

    console.log('Step 6: Mở form Sửa nhân sự (edit modal)');
    const editTrigger = page.locator('.ant-table-row').first().locator('button[title="Thao tác"]').first();
    if (await editTrigger.isVisible().catch(() => false)) {
      await editTrigger.click();
      await page.waitForTimeout(500);
      const editItem = page.getByRole('menuitem', { name: /sửa/i }).first();
      if (await editItem.isVisible().catch(() => false)) {
        await editItem.click();
        await page.waitForTimeout(700);
        await shot(page, '05_Edit_Modal');
      }
    }

    await context.close();
  }

  // --- Phase 2: Permission-limited view (giả lập user không có EMP_CREATE/EMP_EDIT/EMP_INACTIVE) ---
  {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();

    console.log('Step 7: Giả lập user chỉ có EMP_VIEW (ẩn Thêm/Sửa/Xóa)');
    await page.route('**/auth/me', async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      const data = json.data ?? json;
      data.is_super_admin = false;
      if (data.active_context) {
        data.active_context.permission_codes = (
          data.active_context.permission_codes || []
        ).filter((c) => c === 'EMP_VIEW');
      }
      route.fulfill({
        status: response.status(),
        contentType: 'application/json',
        body: JSON.stringify(json.data ? { ...json, data } : data),
      });
    });

    await login(page);
    await gotoEmployees(page);
    await page.waitForTimeout(1000);
    await shot(page, '06_Permission_View_Only');
    await context.close();
  }

  await browser.close();
  console.log(`\n=== Done. Screenshots in ${outDir} ===`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
