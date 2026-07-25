// Chụp screenshot THẬT cho chức năng Company/Legal Entity List + Create/Edit/Detail
// (cài đặt trong module src/modules/org-units/), bổ sung các mục còn thiếu so với bộ
// docs/evidence/m1-demo/ (chỉ có list + create form): detail, edit, inactive/restore,
// error/empty/loading, filter result.
//
// Tài khoản: Super Admin, môi trường: https://astrodev.test8.io.vn (qua FE chạy local).
// Cùng ràng buộc như scripts/capture-m1-screenshots.mjs: access token chỉ lưu trong memory,
// nên chỉ page.goto() một lần tới /login, phần còn lại điều hướng bằng click nội bộ.
//
// Thứ tự cố ý: chụp các state "sạch" (filter/detail/edit/inactive/restore) TRƯỚC, các bước
// mock lỗi/loading (route interception) làm SAU CÙNG vì chúng thay đổi network behaviour.
//
// Usage: node scripts/capture-company-screenshots.mjs [baseUrl]

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const baseUrl = process.argv[2] || 'http://localhost:5173';
const outDir = path.resolve('docs/evidence/company-legal-entity');
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

async function selectAntdOption(page, currentLabelText, optionText) {
  // AntD v6 dùng class `.ant-select-content` (không phải `.ant-select-selector` như v5).
  const select = page.locator('.ant-select-content', { hasText: currentLabelText }).first();
  if (!(await select.count())) return false;
  await select.click();
  await page.waitForTimeout(400);
  const option = page.locator('.ant-select-item-option').getByText(optionText, { exact: true }).first();
  if (!(await option.count())) {
    await page.keyboard.press('Escape');
    return false;
  }
  await option.click();
  await page.waitForTimeout(800);
  return true;
}

async function login(page) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  const email = process.env.QA_ADMIN_EMAIL ?? (() => { throw new Error('Set QA_ADMIN_EMAIL env var'); })();
  await page.locator('input[type="email"], input[name="email"]').first().fill(email);
  const qaPassword = process.env.QA_ADMIN_PASSWORD;
  if (!qaPassword) throw new Error('Missing env var QA_ADMIN_PASSWORD');
  await page.locator('input[type="password"], input[name="password"]').first().fill(qaPassword);
  await page.getByRole('button', { name: /đăng nhập/i }).first().click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1200);
}

// Loading/Error state cần mount ĐẦU TIÊN của trang (query org_units/tree chưa có cache) để
// Skeleton/ApiErrorAlert hiển thị đúng — và vì token chỉ lưu trong memory, không thể dùng
// page.reload() trên page đã có dữ liệu (sẽ mất session, văng về /login). Nên mỗi state này
// dùng một context + login RIÊNG, áp route interception TRƯỚC khi lần đầu vào trang.
async function captureFreshState(browser, { routePattern, routeHandler, waitBeforeShot, shotName }) {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  await login(page);
  await page.route(routePattern, routeHandler);
  const link = page
    .locator('aside, nav, [class*="sider"], [class*="menu"]')
    .first()
    .getByText('Đơn vị tổ chức', { exact: true })
    .first();
  await link.click();
  await page.waitForTimeout(waitBeforeShot);
  await shot(page, shotName);
  await context.close();
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  console.log(`=== Base URL: ${baseUrl} ===`);

  console.log('Step 1: Login');
  await login(page);

  console.log('Step 2: Navigate to Company/Legal Entity (Đơn vị tổ chức) → Danh sách (bảng)');
  await clickMenu(page, 'Đơn vị tổ chức');
  await page.waitForTimeout(1000);
  const listSegment = page.getByText('Danh sách', { exact: true }).first();
  if (await listSegment.count()) {
    await listSegment.click();
    await page.waitForSelector('table tbody tr.ant-table-row', { timeout: 10000 });
    await page.waitForTimeout(600);
  }

  // ── 01: Filter result ─────────────────────────────────────────────────
  console.log('Step 3: Filter result (Loại đơn vị = Chi nhánh)');
  const filteredOk = await selectAntdOption(page, 'Tất cả loại', 'Chi nhánh');
  if (filteredOk) {
    await shot(page, '01_Filter_Result_ChiNhanh');
    await selectAntdOption(page, 'Chi nhánh', 'Tất cả loại');
  } else {
    console.log('  [SKIP] không lọc được theo "Loại đơn vị"');
  }

  // ── 02: Detail panel ─────────────────────────────────────────────────
  // Panel chi tiết chỉ render ở chế độ "Dạng cây" (OrgUnitsPage.tsx chỉ gắn detailPanel trong
  // nhánh viewMode === 'tree') — bảng ("Danh sách") không có panel chi tiết bên phải.
  console.log('Step 4: Detail panel (switch to tree view, click a node)');
  const treeSegment = page.locator('.ant-segmented-item', { hasText: 'Dạng cây' }).first();
  if (await treeSegment.count()) {
    await treeSegment.click();
    await page.waitForTimeout(1000);
    const treeNode = page
      .locator('.ant-tree-treenode:not([aria-hidden="true"]) .ant-tree-node-content-wrapper')
      .first();
    if (await treeNode.count()) {
      await treeNode.click();
      await page.waitForTimeout(900);
      await shot(page, '02_Detail_Panel');
    } else {
      console.log('  [SKIP] không tìm thấy node nào trong cây tổ chức');
    }
    // Quay lại chế độ Danh sách cho các bước tiếp theo (edit/inactive/restore dùng bảng)
    const listSegmentBack = page.locator('.ant-segmented-item', { hasText: 'Danh sách' }).first();
    if (await listSegmentBack.count()) {
      await listSegmentBack.click();
      await page.waitForSelector('table tbody tr.ant-table-row', { timeout: 10000 });
      await page.waitForTimeout(600);
    }
  } else {
    console.log('  [SKIP] không tìm thấy nút chuyển "Dạng cây"');
  }

  const firstRow = page.locator('table tbody tr.ant-table-row').first();

  // ── 03: Edit form (mở form sửa từ dropdown thao tác) ────────────────────
  console.log('Step 5: Edit form');
  const actionBtn = firstRow.locator('button[title="Thao tác"]').first();
  if (await actionBtn.count()) {
    await actionBtn.click();
    await page.waitForTimeout(400);
    const editItem = page.locator('.ant-dropdown-menu-item').getByText('Sửa', { exact: true }).first();
    if (await editItem.count()) {
      await editItem.click();
      await page.waitForTimeout(800);
      await shot(page, '03_Edit_Form');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    } else {
      console.log('  [SKIP] không tìm thấy menu item "Sửa"');
    }
  } else {
    console.log('  [SKIP] không tìm thấy nút "Thao tác" trên dòng đầu');
  }

  // ── 04/05: Inactive (deactivate) + Restore trên một record TỰ TẠO ──────
  // Dùng record tự tạo qua chính UI (không đụng dữ liệu seed có sẵn) để tránh làm bẩn dữ liệu
  // hiển thị demo cho người khác.
  console.log('Step 6: Create throwaway record for inactive/restore screenshots');
  const addBtn = page.getByRole('button', { name: /thêm đơn vị/i }).first();
  let createdOk = false;
  const suffix = Date.now().toString().slice(-6);
  const testName = 'Test Screenshot ' + suffix;
  if (await addBtn.count()) {
    await addBtn.click();
    await page.waitForTimeout(700);
    // Chọn "Công ty mẹ" — loại đơn vị duy nhất KHÔNG bắt buộc chọn Đơn vị cha/Tỉnh/Phường,
    // nên chỉ cần điền Tên đơn vị + Địa chỉ cụ thể là submit được (Mã/MST đã có giá trị mặc
    // định/placeholder do form tự sinh).
    const parentTypeRadio = page
      .locator('[role="dialog"]')
      .getByText('Công ty mẹ', { exact: true })
      .first();
    if (await parentTypeRadio.count()) {
      await parentTypeRadio.click();
      await page.waitForTimeout(400);
    }
    // Công ty mẹ/con bắt buộc có MST hoặc mã tạm (xem OrgUnitFormModal.tsx dòng ~890-902) —
    // chọn tab "Chưa có (Mã tạm)" để hệ thống tự sinh mã TMP-XXXXXX qua generate-tmp-code.
    const tmpCodeTab = page.locator('[role="dialog"]').getByText('Chưa có (Mã tạm)', { exact: true }).first();
    if (await tmpCodeTab.count()) {
      await tmpCodeTab.click();
      await page.waitForTimeout(1200);
    }
    const nameInput = page.locator('#name, input[name="name"]').first();
    if (await nameInput.count()) {
      await nameInput.fill(testName);
      const addressInput = page
        .locator('#address, input[name="address"], textarea#address, textarea[name="address"]')
        .first();
      if (await addressInput.count()) {
        await addressInput.fill('Số 1 Đường Test Screenshot');
      }
      const saveBtn = page.locator('[role="dialog"]').getByRole('button', { name: /lưu/i }).last();
      if (await saveBtn.count()) {
        await saveBtn.click();
        await page.waitForTimeout(1500);
        createdOk = true;
      }
    } else {
      await page.keyboard.press('Escape');
    }
  }

  if (createdOk) {
    const searchInput = page.getByPlaceholder('Tìm theo tên, mã...').first();
    if (await searchInput.count()) {
      await searchInput.fill('Test Screenshot');
      await page.waitForTimeout(900);
    }
    const newRow = page.locator('table tbody tr.ant-table-row').first();
    const actionBtn2 = newRow.locator('button[title="Thao tác"]').first();
    if (await actionBtn2.count()) {
      await actionBtn2.click();
      await page.waitForTimeout(400);
      const deactivateItem = page.locator('.ant-dropdown-menu-item').getByText('Vô hiệu', { exact: true }).first();
      if (await deactivateItem.count()) {
        await deactivateItem.click();
        await page.waitForTimeout(800);
        await shot(page, '04_Deactivate_Confirm_Modal');
        const confirmBtn = page.getByRole('button', { name: /xác nhận|vô hiệu/i }).last();
        if (await confirmBtn.count()) {
          await confirmBtn.click();
          await page.waitForTimeout(1200);
          await shot(page, '05_Deactivated_Status');
        }
      } else {
        console.log('  [SKIP] không tìm thấy menu item "Vô hiệu"');
      }
    }

    const rowAfterDeactivate = page.locator('table tbody tr.ant-table-row').first();
    const actionBtn3 = rowAfterDeactivate.locator('button[title="Thao tác"]').first();
    if (await actionBtn3.count()) {
      await actionBtn3.click();
      await page.waitForTimeout(400);
      const restoreItem = page.locator('.ant-dropdown-menu-item').getByText('Khôi phục', { exact: true }).first();
      if (await restoreItem.count()) {
        await restoreItem.click();
        await page.waitForTimeout(700);
        await shot(page, '06_Restore_Confirm_Modal');
        const okBtn = page.getByRole('button', { name: /^khôi phục$|ok/i }).last();
        if (await okBtn.count()) {
          await okBtn.click();
          await page.waitForTimeout(1200);
          await shot(page, '07_Restored_Status');
        }
      } else {
        console.log('  [SKIP] không tìm thấy menu item "Khôi phục"');
      }
    }

    // Dọn dẹp: vô hiệu hóa lại record test để không để rác trong danh sách demo
    const cleanupRow = page.locator('table tbody tr.ant-table-row').first();
    const cleanupActionBtn = cleanupRow.locator('button[title="Thao tác"]').first();
    if (await cleanupActionBtn.count()) {
      await cleanupActionBtn.click();
      await page.waitForTimeout(400);
      const deactivateAgain = page.locator('.ant-dropdown-menu-item').getByText('Vô hiệu', { exact: true }).first();
      if (await deactivateAgain.count()) {
        await deactivateAgain.click();
        await page.waitForTimeout(600);
        const confirmBtn2 = page.getByRole('button', { name: /xác nhận|vô hiệu/i }).last();
        if (await confirmBtn2.count()) {
          await confirmBtn2.click();
          await page.waitForTimeout(800);
        }
      }
    }
    const searchInputClear = page.getByPlaceholder('Tìm theo tên, mã...').first();
    if (await searchInputClear.count()) {
      await searchInputClear.fill('');
      await page.waitForTimeout(600);
    }
  } else {
    console.log('  [SKIP] không tạo được record test cho inactive/restore — cần chụp thủ công');
  }

  // ── 08: Empty state (filter không khớp) ─────────────────────────────────
  console.log('Step 7: Empty state (filtered)');
  const searchInput3 = page.getByPlaceholder('Tìm theo tên, mã...').first();
  if (await searchInput3.count()) {
    await searchInput3.fill('zzz_khong_ton_tai_zzz');
    await page.waitForTimeout(900);
    await shot(page, '08_Empty_State_Filtered');
    await searchInput3.fill('');
    await page.waitForTimeout(700);
  } else {
    console.log('  [SKIP] không tìm thấy ô tìm kiếm');
  }

  // ── 09/10: Loading + Error state (mỗi state một context/login riêng — xem captureFreshState)
  console.log('Step 8: Loading state (context riêng, delay API response)');
  await captureFreshState(browser, {
    routePattern: '**/org_units/tree**',
    routeHandler: async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    },
    waitBeforeShot: 400,
    shotName: '09_Loading_State',
  });

  console.log('Step 9: Error state (context riêng, mocked 500 response)');
  await captureFreshState(browser, {
    routePattern: '**/org_units/tree**',
    routeHandler: (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          status: 'error',
          error_code: 'INTERNAL_ERROR',
          message: 'Lỗi hệ thống, vui lòng thử lại sau',
          errors: [],
        }),
      }),
    waitBeforeShot: 1200,
    shotName: '10_Error_State',
  });

  await browser.close();

  console.log(`\n=== DONE: ${shots.length} screenshots saved to ${outDir} ===`);
  console.log(shots.map((s) => `  - ${s}.png`).join('\n'));
}

main().catch((err) => {
  console.error('CAPTURE FAILED:', err);
  process.exit(1);
});
