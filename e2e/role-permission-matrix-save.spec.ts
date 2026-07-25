/**
 * E2E: Role & Permission Matrix — Save matrix (real actor)
 *
 * Flow: tick permission → save → reload role → pivot.effect=allow
 *       → login user thuộc role → quyền effective đúng
 *
 * Ticket: [M1][FE] Role & Permission Matrix Screen
 * Actor: <QA_ADMIN_EMAIL> / <QA_ADMIN_PASSWORD>
 */
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL ?? 'https://astrodev.test8.io.vn';
const ADMIN_USER = process.env.QA_ADMIN_EMAIL ?? 'admin@placeholder.test';
const ADMIN_PASS = process.env.QA_ADMIN_PASSWORD ?? 'password_placeholder';

// Permission code dùng để tick/verify (cần có trong danh sách permission của BE)
const TARGET_PERMISSION_CODE = 'TASK_CREATE';

test.describe('Role Permission Matrix — Save & Effective', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]', ADMIN_USER);
    await page.fill('input[name="password"]', ADMIN_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/roles', { timeout: 15000 });
  });

  test('tick → save → reload → pivot.allow → user effective', async ({
    page,
  }) => {
    // 1. Chọn role đầu tiên trong danh sách
    await page.click('[data-testid="role-row"]:first-child');
    await page.waitForSelector('[data-testid="role-permission-matrix"]', {
      timeout: 10000,
    });

    // 2. Tick permission TASK_CREATE
    const targetCheckbox = page.locator(
      `[data-testid="permission-checkbox"][data-code="${TARGET_PERMISSION_CODE}"]`,
    );
    await targetCheckbox.check();

    // 3. Click "Lưu" → xuất hiện confirm dialog
    await page.click('[data-testid="save-matrix-btn"]');
    await expect(page.locator('.ant-modal-confirm')).toBeVisible();
    await page.click('.ant-modal-confirm .ant-btn-primary');

    // 4. Đợi mutation thành công (toast success)
    await expect(page.locator('.ant-message-success')).toContainText(
      'Đã cập nhật ma trận quyền',
      { timeout: 10000 },
    );

    // 5. Reload role detail (click lại role để load lại)
    await page.click('[data-testid="role-row"]:first-child');
    await page.waitForSelector('[data-testid="role-permission-matrix"]');

    // 6. Kiểm tra pivot vẫn được tick (effect=allow)
    await expect(targetCheckbox).toBeChecked();

    // 7. Lấy role ID để tạo user test
    const roleId = await page
      .locator('[data-testid="role-row"]:first-child')
      .getAttribute('data-role-id');

    // 8. Tạo user test thuộc role này (qua API trực tiếp)
    const tempUserEmail = `e2e-test-${Date.now()}@placeholder.test`;
    const userRes = await page.request.post(`${BASE_URL}/api/v1/users`, {
      data: {
        email: tempUserEmail,
        password: ADMIN_PASS, // Using the same placeholder pass
        full_name: 'E2E Test User',
        role_id: Number(roleId),
      },
    });

    // Nếu endpoint /api/v1/users trả 404, fallback sang /api/v1/employees
    let userId: string | number | undefined;
    if (userRes.status() === 404) {
      const empRes = await page.request.post(`${BASE_URL}/api/v1/employees`, {
        data: {
          email: tempUserEmail,
          full_name: 'E2E Test User',
          role_id: Number(roleId),
        },
      });
      const empBody = await empRes.json();
      userId = empBody.id ?? empBody.data?.id;
    } else {
      const userBody = await userRes.json();
      userId = userBody.id ?? userBody.data?.id;
    }

    // 9. Đăng xuất admin
    await page.click('[data-testid="user-menu"]');
    await page.click('text=Đăng xuất');
    await page.waitForURL('**/login');

    // 10. Đăng nhập user test
    await page.fill('input[name="email"]', tempUserEmail);
    await page.fill('input[name="password"]', ADMIN_PASS);
    await page.click('button[type="submit"]');

    // 11. Truy cập trang Tasks → thấy nút "Tạo mới" (có quyền TASK_CREATE)
    await page.goto(`${BASE_URL}/tasks`);
    await expect(page.locator('[data-testid="create-task-btn"]')).toBeVisible({
      timeout: 10000,
    });

    // 12. Dọn dẹp: xóa user test
    if (userId) {
      await page.request.delete(`${BASE_URL}/api/v1/users/${userId}`);
    }
  });
});
