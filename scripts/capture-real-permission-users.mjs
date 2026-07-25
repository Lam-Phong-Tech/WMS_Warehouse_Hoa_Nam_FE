// Chụp screenshot THẬT bằng 2 tài khoản thật vừa tạo trên astrodev.test8.io.vn
// (không mock/intercept response) để trả lời review P1:
// "chưa có evidence bằng user HR thật/user thiếu quyền thật".
//
// - QA_NOPERM_EMAIL -> role "Nhân Viên" (id=3, chỉ EMP_VIEW)
// - QA_HRPERM_EMAIL -> role "Nhân Sự (HR)" (id=9, có EMP_ASSIGNMENT_CREATE, EMP_STATUS, ...)
//
// Usage: QA_NOPERM_EMAIL=... QA_NOPERM_PASSWORD=... QA_HRPERM_EMAIL=... QA_HRPERM_PASSWORD=... \
//   node scripts/capture-real-permission-users.mjs [baseUrl]

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const baseUrl = process.argv[2] || 'http://localhost:5173';
const outDir = path.resolve('docs/evidence/employee-assignment-status');
mkdirSync(outDir, { recursive: true });

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name} env var`);
  return value;
}

const NOPERM_EMAIL = requireEnv('QA_NOPERM_EMAIL');
const NOPERM_PASSWORD = requireEnv('QA_NOPERM_PASSWORD');
const HRPERM_EMAIL = requireEnv('QA_HRPERM_EMAIL');
const HRPERM_PASSWORD = requireEnv('QA_HRPERM_PASSWORD');

async function shot(page, name) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  [OK] ${name}.png`);
}

async function login(page, email, password) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await page.locator('input[type="email"], input[name="email"]').first().fill(email);
  await page.locator('input[type="password"], input[name="password"]').first().fill(password);
  await page.getByRole('button', { name: /đăng nhập/i }).first().click();
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

async function main() {
  const browser = await chromium.launch();
  console.log(`=== Base URL: ${baseUrl} ===`);

  // --- User thật chỉ có EMP_VIEW (role "Nhân Viên") ---
  {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();

    console.log('Login QA_NOPERM_EMAIL (role Nhân Viên, chỉ EMP_VIEW)');
    await login(page, NOPERM_EMAIL, NOPERM_PASSWORD);

    await gotoRoute(page, '/employee-assignments');
    await shot(page, '15_Real_NoPermission_Assignment_List');

    await gotoRoute(page, '/employee-status');
    await shot(page, '16_Real_NoPermission_Status_History');

    console.log('  Chọn 1 nhân sự để kiểm tra nút Đổi trạng thái (kỳ vọng: ẨN)');
    try {
      const empFilterSelect = page.locator('.ant-select').filter({ hasText: 'Tất cả nhân sự' }).first();
      const empFilterInput = empFilterSelect.locator('.ant-select-selection-search-input, input');
      await empFilterInput.focus({ timeout: 5000 });
      await page.keyboard.type('NV', { delay: 80 });
      await page.waitForTimeout(500);
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(200);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(800);
    } catch (e) {
      console.log('  [WARN]', e.message.split('\n')[0]);
    }
    await shot(page, '16b_Real_NoPermission_Status_ChangeButton_Hidden');

    await context.close();
  }

  // --- User thật có quyền HR đầy đủ (role "Nhân Sự (HR)") ---
  {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();

    console.log('Login QA_HRPERM_EMAIL (role Nhân Sự (HR))');
    await login(page, HRPERM_EMAIL, HRPERM_PASSWORD);

    await gotoRoute(page, '/employee-assignments');
    await shot(page, '17_Real_HR_Assignment_List');

    await gotoRoute(page, '/employee-status');
    await shot(page, '18_Real_HR_Status_History');

    console.log('  Chọn 1 nhân sự để kiểm tra nút Đổi trạng thái (kỳ vọng: HIỆN)');
    try {
      const empFilterSelect = page.locator('.ant-select').filter({ hasText: 'Tất cả nhân sự' }).first();
      const empFilterInput = empFilterSelect.locator('.ant-select-selection-search-input, input');
      await empFilterInput.focus({ timeout: 5000 });
      await page.keyboard.type('NV', { delay: 80 });
      await page.waitForTimeout(500);
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(200);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(800);
    } catch (e) {
      console.log('  [WARN]', e.message.split('\n')[0]);
    }
    await shot(page, '18b_Real_HR_Status_ChangeButton_Visible');

    await context.close();
  }

  await browser.close();
  console.log(`\n=== Done. Screenshots in ${outDir} ===`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
