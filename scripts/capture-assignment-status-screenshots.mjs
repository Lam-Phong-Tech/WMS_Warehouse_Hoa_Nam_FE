// Chụp screenshot THẬT cho module Employee Assignment & Status Lifecycle —
// tài khoản Super Admin, dữ liệu thật trên astrodev.test8.io.vn (qua BE thật,
// FE chạy local tại localhost:5173 trỏ VITE_API_BASE_URL=astrodev.test8.io.vn).
//
// Bổ sung evidence còn thiếu theo review P1 [M1][FE] Employee Assignment &
// Status Lifecycle: assignment list, create modal, current assignment alert,
// confirm step, missing effective date validation, department filtered by
// org unit, status modal, deactivate confirm, role/data scope revoke result,
// permission-limited view.
//
// Usage: SCREENSHOT_LOGIN_EMAIL=... SCREENSHOT_LOGIN_PASSWORD=... node scripts/capture-assignment-status-screenshots.mjs [baseUrl]

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const baseUrl = process.argv[2] || 'http://localhost:5173';
const outDir = path.resolve('docs/evidence/employee-assignment-status');
mkdirSync(outDir, { recursive: true });

const LOGIN_EMAIL = process.env.SCREENSHOT_LOGIN_EMAIL;
const LOGIN_PASSWORD = process.env.SCREENSHOT_LOGIN_PASSWORD;
if (!LOGIN_EMAIL || !LOGIN_PASSWORD) {
  console.error(
    'Thiếu biến môi trường SCREENSHOT_LOGIN_EMAIL / SCREENSHOT_LOGIN_PASSWORD. Ví dụ:\n' +
      '  SCREENSHOT_LOGIN_EMAIL=xxx SCREENSHOT_LOGIN_PASSWORD=xxx node scripts/capture-assignment-status-screenshots.mjs',
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

  // --- Phase 1: Assignment flow (Super Admin) ---
  {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();

    console.log('Step 1: Login');
    await login(page);

    console.log('Step 2: Mở danh sách điều chuyển/phân công');
    await gotoRoute(page, '/employee-assignments');
    await shot(page, '01_Assignment_List');

    console.log('Step 3: Mở modal Điều chuyển (create)');
    const createBtn = page.getByRole('button', { name: /điều chuyển/i }).first();
    if (await createBtn.isVisible().catch(() => false)) {
      await createBtn.click();
      await page.waitForTimeout(700);
      await shot(page, '02_Create_Assignment_Modal_Empty');

      console.log('Step 4: Chọn nhân sự -> current assignment alert (nếu có)');
      const empSelect = page.locator('.ant-modal').getByLabel('Nhân sự');
      const empSelectBox = page.locator('.ant-modal .ant-select').first();
      if (await empSelectBox.isVisible().catch(() => false)) {
        await empSelectBox.click();
        await page.waitForTimeout(400);
        const firstOption = page.locator('.ant-select-item-option').first();
        if (await firstOption.isVisible().catch(() => false)) {
          await firstOption.click();
          await page.waitForTimeout(900);
          await shot(page, '03_Current_Assignment_Alert');
        }
      }

      console.log('Step 5: Submit thiếu ngày bắt đầu -> validation error');
      const okBtn = page.locator('.ant-modal-footer').getByRole('button', { name: /tạo mới|lưu thay đổi/i }).first();
      if (await okBtn.isVisible().catch(() => false)) {
        await okBtn.click();
        await page.waitForTimeout(600);
        await shot(page, '04_Missing_Effective_Date_Validation');
      }

      // Dùng keyboard thay vì mouse click để né lỗi "element not stable" khi
      // antd Select re-render liên tục do react-query background refetch.
      async function selectByLabel(labelText) {
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const formItem = page
              .locator('.ant-modal .ant-form-item')
              .filter({ hasText: labelText })
              .first();
            const selector = formItem.locator('.ant-select-selection-search-input, input').first();
            await selector.focus({ timeout: 5000 });
            await page.keyboard.press('ArrowDown');
            await page.waitForTimeout(400);
            await page.keyboard.press('Enter');
            await page.waitForTimeout(400);
            return true;
          } catch (e) {
            console.log(`  [WARN] Thử lại chọn "${labelText}" (lần ${attempt + 1}):`, e.message.split('\n')[0]);
            await page.waitForTimeout(500);
          }
        }
        return false;
      }

      console.log('Step 6: Chọn đơn vị -> phòng ban lọc theo đơn vị');
      await page.waitForTimeout(1000);
      await selectByLabel('Đơn vị');
      await page.waitForTimeout(500);

      const deptFormItem = page
        .locator('.ant-modal .ant-form-item')
        .filter({ hasText: 'Phòng ban' })
        .first();
      await deptFormItem
        .locator('.ant-select-selection-search-input, input')
        .first()
        .focus({ timeout: 4000 })
        .catch(() => null);
      await page.keyboard.press('ArrowDown').catch(() => null);
      await page.waitForTimeout(400);
      await shot(page, '05_Department_Filtered_By_OrgUnit');

      console.log('Step 7: Điền đủ form -> confirm step');
      await page.keyboard.press('Enter').catch(() => null);
      await page.waitForTimeout(400);

      await selectByLabel('Chức vụ');

      try {
        const startDateFormItem = page
          .locator('.ant-modal .ant-form-item')
          .filter({ hasText: 'Ngày bắt đầu' })
          .first();
        const startDateInput = startDateFormItem.locator('input');
        await startDateInput.click({ force: true, timeout: 5000 });
        await page.waitForTimeout(300);
        const today = page.locator('.ant-picker-cell-today').first();
        if (await today.isVisible().catch(() => false)) {
          await today.click();
          await page.waitForTimeout(300);
        }
      } catch (e) {
        console.log('  [WARN] Không chọn được ngày bắt đầu:', e.message.split('\n')[0]);
      }

      try {
        const okBtn2 = page.locator('.ant-modal-footer').getByRole('button', { name: /tạo mới|lưu thay đổi/i }).first();
        await okBtn2.click({ force: true, timeout: 5000 });
        await page.waitForTimeout(700);
        await shot(page, '06_Confirm_Assignment_Step');
      } catch (e) {
        console.log('  [WARN] Không submit được form:', e.message.split('\n')[0]);
      }

      // Đóng modal không submit thật (tránh tạo rác data demo)
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      const cancelBtn = page.locator('.ant-modal-close').first();
      if (await cancelBtn.isVisible().catch(() => false)) {
        await cancelBtn.click();
        await page.waitForTimeout(400);
      }
    }

    await context.close();
  }

  // --- Phase 2: Employee Status flow (Super Admin) ---
  {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();

    console.log('Step 8: Login lại cho phần Status');
    await login(page);

    console.log('Step 9: Mở trang Vòng đời trạng thái nhân sự');
    await gotoRoute(page, '/employee-status');
    await shot(page, '07_Status_History_List');

    console.log('Step 10: Chọn 1 nhân sự để mở modal đổi trạng thái');
    try {
      const empFilterSelect = page
        .locator('.ant-select')
        .filter({ hasText: 'Tất cả nhân sự' })
        .first();
      const empFilterInput = empFilterSelect.locator(
        '.ant-select-selection-search-input, input',
      );
      await empFilterInput.focus({ timeout: 5000 });
      await page.keyboard.type('NV', { delay: 80 });
      await page.waitForTimeout(500);
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(200);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(800);
    } catch (e) {
      console.log('  [WARN] Không chọn được nhân sự:', e.message.split('\n')[0]);
    }

    await shot(page, '07b_After_Select_Employee_Debug');
    const changeStatusBtn = page.getByRole('button', { name: /đổi trạng thái/i }).first();
    const changeStatusVisible = await changeStatusBtn.isVisible({ timeout: 5000 }).catch(() => false);
    console.log('  [DEBUG] changeStatusBtn visible:', changeStatusVisible);
    if (changeStatusVisible) {
      await changeStatusBtn.click();
      await page.waitForTimeout(700);
      await shot(page, '08_Status_Modal');

      console.log('Step 11: Chọn trạng thái Tạm ngưng/Nghỉ việc nếu có -> confirm step');
      const statusSelect = page.locator('.ant-modal .ant-select').first();
      if (await statusSelect.isVisible().catch(() => false)) {
        await statusSelect.click();
        await page.waitForTimeout(400);
        const options = page.locator('.ant-select-item-option');
        const count = await options.count();
        for (let i = 0; i < count; i++) {
          const text = (await options.nth(i).innerText()).toLowerCase();
          if (text.includes('tạm ngưng') || text.includes('nghỉ việc')) {
            await options.nth(i).click();
            await page.waitForTimeout(400);
            break;
          }
        }
      }

      const dateInput = page.locator('.ant-modal input[placeholder="dd/mm/yyyy"]').first();
      if (await dateInput.isVisible().catch(() => false)) {
        await dateInput.click();
        await page.waitForTimeout(300);
        const today = page.locator('.ant-picker-cell-today').first();
        if (await today.isVisible().catch(() => false)) {
          await today.click();
        }
        await page.waitForTimeout(300);
      }
      const noteInput = page.locator('.ant-modal textarea').first();
      if (await noteInput.isVisible().catch(() => false)) {
        await noteInput.fill('Test evidence — QA capture, không phải thay đổi thật');
      }

      const continueBtn = page.locator('.ant-modal').getByRole('button', { name: /tiếp tục|xác nhận/i }).last();
      if (await continueBtn.isVisible().catch(() => false)) {
        await continueBtn.click();
        await page.waitForTimeout(700);
        await shot(page, '09_Deactivate_Confirm_Modal');
      }

      // Không submit thật — đóng modal để tránh làm sai lệch dữ liệu demo
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }

    await context.close();
  }

  // --- Phase 3: Permission-limited view (giả lập user không có quyền EMP_ASSIGNMENT_CREATE/EMP_STATUS) ---
  {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();

    console.log('Step 12: Giả lập user thiếu quyền (chỉ EMP_VIEW)');
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
    await gotoRoute(page, '/employee-assignments');
    await page.waitForTimeout(1000);
    await shot(page, '10_Assignment_List_No_Permission');

    await gotoRoute(page, '/employee-status');
    await page.waitForTimeout(1000);
    await shot(page, '11_Status_History_No_Permission');

    await context.close();
  }

  await browser.close();
  console.log(`\n=== Done. Screenshots in ${outDir} ===`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
