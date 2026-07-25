// Chụp screenshot THẬT cho màn "User Role Scope / Data Scope" (ALE-82 review) —
// tài khoản QA, bổ sung các state còn thiếu evidence theo review:
// warehouse role-scope, 403/no-permission, API error/retry, save-failed, loading.
//
// Usage: node scripts/capture-role-scopes-screenshots.mjs [baseUrl]

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const baseUrl = process.argv[2] || 'http://localhost:5173';
const outDir = path.resolve('docs/evidence/user-role-scopes');
mkdirSync(outDir, { recursive: true });

async function shot(page, name) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  [OK] ${name}.png`);
}

async function login(page) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await page.locator('input[type="email"], input[name="email"]').first().fill(process.env.QA_ADMIN_EMAIL ?? (() => { throw new Error('Set QA_ADMIN_EMAIL env var'); })());
  await page.locator('input[type="password"], input[name="password"]').first().fill((process.env.QA_ADMIN_PASSWORD ?? (() => { throw new Error('Set QA_ADMIN_PASSWORD env var'); })()));
  await page.getByRole('button', { name: /đăng nhập/i }).first().click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
}

// Access token chỉ lưu trong memory (không persist) — page.goto (full reload)
// sau khi login sẽ mất session. Phải điều hướng qua client-side router
// (pushState + popstate) để react-router chuyển route mà không reload trang,
// tương tự cách scripts/capture-orgchart-screenshots.mjs click menu — nhưng
// dùng pushState để không phụ thuộc menu item còn hiển thị hay không (case
// 403 ẩn menu vì thiếu quyền).
async function gotoRoleScopes(page, { wait = 900 } = {}) {
  await page.evaluate(() => {
    window.history.pushState({}, '', '/user-role-scopes');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  if (wait) await page.waitForTimeout(wait);
}

async function main() {
  const browser = await chromium.launch();
  console.log(`=== Base URL: ${baseUrl} ===`);

  // --- Phase 1: state bình thường (loading + warehouse role-scope) ---
  {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();

    console.log('Step 1: Login');
    await login(page);

    console.log('Step 2: Mở "Vai trò & phạm vi" — chụp loading');
    await gotoRoleScopes(page, { wait: 0 });
    // Chụp ngay sau navigate, trước khi bảng render xong (best-effort race).
    await shot(page, '01_Loading');
    await page.waitForTimeout(900);

    console.log('Step 3: Gán vai trò theo phạm vi Kho → chụp modal + bảng');
    const assignBtn = page.getByRole('button', { name: /Gán vai trò/i }).first();
    if (await assignBtn.isVisible().catch(() => false)) {
      await assignBtn.click();
      await page.waitForTimeout(500);

      const userSelect = page.locator('.ant-modal-body').getByLabel('Người dùng');
      if (await userSelect.isVisible().catch(() => false)) {
        await userSelect.click();
        await page.waitForTimeout(400);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(300);
      }

      const roleSelect = page.locator('.ant-modal-body').getByLabel('Vai trò');
      if (await roleSelect.isVisible().catch(() => false)) {
        await roleSelect.click();
        await page.waitForTimeout(400);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(300);
      }

      const scopeTypeSelect = page.locator('.ant-modal-body').getByLabel('Phạm vi');
      if (await scopeTypeSelect.isVisible().catch(() => false)) {
        await scopeTypeSelect.click();
        await page.waitForTimeout(400);
        await page.getByTitle('Kho', { exact: true }).last().click();
        await page.waitForTimeout(400);
      }

      await shot(page, '02_Assign_Warehouse_Scope_Modal');

      // Lưu ý: ScopeSelector không forward id prop, nên label[for="scope_id"]
      // trỏ tới id không tồn tại trong DOM thật (bug nhỏ, không phải lỗi test)
      // — phải định vị theo cấu trúc form-item chứa label title="Kho" thay vì
      // getByLabel/id.
      const warehouseSelect = page
        .locator('.ant-modal-body .ant-form-item')
        .filter({ has: page.locator('label[title="Kho"]') })
        .locator('.ant-select');
      if (await warehouseSelect.isVisible().catch(() => false)) {
        // Query danh sách kho có thể chưa xong lúc vừa mở dropdown → select
        // còn disabled ("Đang tải..."), chờ thêm trước khi click.
        await page.waitForTimeout(1200);
        await warehouseSelect.click();
        await page.waitForTimeout(600);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(300);
      }

      const submitBtn = page.locator('.ant-modal-body').getByRole('button', { name: /Gán vai trò|Cập nhật/ });
      if (await submitBtn.isVisible().catch(() => false)) {
        await submitBtn.click();
        await page.waitForTimeout(1200);
      }
    }

    await shot(page, '03_Warehouse_Role_Scope_In_Table');
    await context.close();
  }

  // --- Phase 2: API error + retry (chặn GET /user-role-scopes trả 500) ---
  {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();
    await login(page);

    console.log('Step 4: Giả lập lỗi API khi tải danh sách phạm vi');
    await page.route('**/user-role-scopes**', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Internal Server Error' }),
        });
      } else {
        route.continue();
      }
    });

    await gotoRoleScopes(page);
    await page.waitForTimeout(400);
    const userFilter = page.getByPlaceholder('Lọc theo người dùng');
    if (await userFilter.isVisible().catch(() => false)) {
      await userFilter.click();
      await page.waitForTimeout(400);
      await page.keyboard.press('Enter');
    }
    // react-query mặc định retry=1 với backoff (~1s) trước khi set error —
    // đợi đủ để hết retry rồi mới chụp, tránh chụp nhầm state loading.
    await page.waitForTimeout(4000);
    await shot(page, '04_API_Error_With_Retry');
    await context.close();
  }

  // --- Phase 3: save failed (chặn PUT /users/{id}/role-scopes trả 400) ---
  {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();
    await login(page);

    console.log('Step 5: Giả lập lỗi khi lưu (gán vai trò)');
    await page.route('**/users/*/role-scopes', (route) => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'VALIDATION_FAILED: dữ liệu không hợp lệ' }),
      });
    });

    await gotoRoleScopes(page);
    await page.waitForTimeout(600);

    const assignBtn = page.getByRole('button', { name: /Gán vai trò/i }).first();
    if (await assignBtn.isVisible().catch(() => false)) {
      await assignBtn.click();
      await page.waitForTimeout(500);

      const userSelect = page.locator('.ant-modal-body').getByLabel('Người dùng');
      if (await userSelect.isVisible().catch(() => false)) {
        await userSelect.click();
        await page.waitForTimeout(400);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(300);
      }
      const roleSelect = page.locator('.ant-modal-body').getByLabel('Vai trò');
      if (await roleSelect.isVisible().catch(() => false)) {
        await roleSelect.click();
        await page.waitForTimeout(400);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(300);
      }
      const scopeTypeSelect = page.locator('.ant-modal-body').getByLabel('Phạm vi');
      if (await scopeTypeSelect.isVisible().catch(() => false)) {
        await scopeTypeSelect.click();
        await page.waitForTimeout(400);
        await page.getByTitle('Toàn hệ thống', { exact: true }).last().click();
        await page.waitForTimeout(300);
      }
      const submitBtn = page.locator('.ant-modal-body').getByRole('button', { name: /Gán vai trò|Cập nhật/ });
      if (await submitBtn.isVisible().catch(() => false)) {
        await submitBtn.click();
        await page.waitForTimeout(1200);
      }
    }
    await shot(page, '05_Save_Failed_Toast');
    await context.close();
  }

  // --- Phase 4: 403 / no permission (giả lập /auth/me không có ROLE_ASSIGN/SCOPE_CONFIG) ---
  {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();

    console.log('Step 6: Giả lập user không có quyền ROLE_ASSIGN/SCOPE_CONFIG');
    await page.route('**/auth/me', async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      const data = json.data ?? json;
      data.is_super_admin = false;
      if (data.active_context) {
        data.active_context.permission_codes = (
          data.active_context.permission_codes || []
        ).filter((c) => c !== 'ROLE_ASSIGN' && c !== 'SCOPE_CONFIG');
      }
      route.fulfill({
        status: response.status(),
        contentType: 'application/json',
        body: JSON.stringify(json.data ? { ...json, data } : data),
      });
    });

    await login(page);
    await gotoRoleScopes(page);
    await page.waitForTimeout(1000);
    await shot(page, '06_403_No_Permission');
    await context.close();
  }

  await browser.close();
  console.log(`\n=== Done. Screenshots in ${outDir} ===`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
