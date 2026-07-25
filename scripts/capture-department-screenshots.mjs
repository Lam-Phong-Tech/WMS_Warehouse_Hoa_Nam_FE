// Chụp screenshot THẬT cho chức năng Department Tree/List + Create/Edit
// (module src/modules/departments/), bổ sung phần "Preview/screenshot evidence" mà review
// P1.4 chỉ ra là còn thiếu so với bộ docs/evidence/company-legal-entity/.
//
// Tài khoản: Super Admin, môi trường: https://astrodev.test8.io.vn (qua FE chạy local).
// Cùng ràng buộc như scripts/capture-company-screenshots.mjs: access token chỉ lưu trong
// memory (auth.store.ts, cố ý không persist để giảm rủi ro XSS) — page.reload() xóa mất
// session, nên loading/error state phải mount lần đầu trên context/login riêng.
//
// Usage: node scripts/capture-department-screenshots.mjs [baseUrl]

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const baseUrl = process.argv[2] || 'http://localhost:5173';
const outDir = path.resolve('docs/evidence/departments');
mkdirSync(outDir, { recursive: true });

const shots = [];

async function shot(page, name) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  shots.push(name);
  console.log(`  [OK] ${name}.png`);
}

async function login(page) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  const email = process.env.QA_ADMIN_EMAIL;
  if (!email) throw new Error('Set QA_ADMIN_EMAIL env var');
  await page.locator('input[type="email"], input[name="email"]').first().fill(email);
  await page.locator('input[type="password"], input[name="password"]').first().fill((process.env.QA_ADMIN_PASSWORD ?? (() => { throw new Error('Set QA_ADMIN_PASSWORD env var'); })()));
  await page.getByRole('button', { name: /đăng nhập/i }).first().click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1200);
}

async function gotoDepartments(page) {
  const link = page
    .locator('aside, nav, [class*="sider"], [class*="menu"]')
    .first()
    .getByText('Phòng ban', { exact: true })
    .first();
  await link.click();
  await page.waitForTimeout(900);
}

async function captureFreshState(browser, { routePattern, routeHandler, waitBeforeShot, shotName }) {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  await login(page);
  await page.route(routePattern, routeHandler);
  await gotoDepartments(page);
  await page.waitForTimeout(waitBeforeShot);
  await shot(page, shotName);
  await context.close();
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  console.log(`=== Base URL: ${baseUrl} ===`);

  let createdDeptId;
  let authToken;
  page.on('request', (req) => {
    const auth = req.headers()['authorization'];
    if (auth?.startsWith('Bearer ')) authToken = auth.slice('Bearer '.length);
  });
  page.on('response', async (res) => {
    if (res.request().method() === 'POST' && /\/departments$/.test(new URL(res.url()).pathname)) {
      try {
        const json = await res.json();
        if (json?.data?.id) createdDeptId = json.data.id;
      } catch {
        /* ignore non-JSON responses */
      }
    }
  });

  console.log('Step 1: Login');
  await login(page);

  console.log('Step 2: Navigate to Phòng ban (bảng "Danh sách" mặc định)');
  await gotoDepartments(page);
  await page.waitForSelector('table tbody tr.ant-table-row', { timeout: 10000 });
  await page.waitForTimeout(600);

  // ── 01: Filter result (theo đơn vị tổ chức) ──────────────────────────────
  console.log('Step 3: Filter result (theo đơn vị tổ chức)');
  const orgSelect = page.locator('.ant-select', { hasText: 'Tất cả đơn vị' }).first();
  if (await orgSelect.count()) {
    await orgSelect.click();
    await page.waitForTimeout(400);
    const option = page.locator('.ant-select-item-option').nth(1);
    if (await option.count()) {
      await option.click();
      await page.waitForTimeout(800);
      await shot(page, '01_Filter_Result_DonVi');
      // reset filter
      const orgSelectAfter = page.locator('.ant-select', { hasText: /.*/ }).first();
      await orgSelectAfter.click();
      await page.waitForTimeout(300);
      const allOption = page.locator('.ant-select-item-option').getByText('Tất cả đơn vị', { exact: true }).first();
      if (await allOption.count()) await allOption.click();
      await page.waitForTimeout(600);
    } else {
      console.log('  [SKIP] không có option để chọn');
    }
  } else {
    console.log('  [SKIP] không tìm thấy select "Tất cả đơn vị"');
  }

  // ── 02: Tree view + detail panel/drawer ──────────────────────────────────
  console.log('Step 4: Chế độ "Dạng cây" + click node để xem chi tiết');
  const treeSegment = page.locator('.ant-segmented-item', { hasText: 'Dạng cây' }).first();
  if (await treeSegment.count()) {
    await treeSegment.click();
    await page.waitForTimeout(1000);
    await shot(page, '02_Tree_View');
    const treeNode = page
      .locator('.ant-tree-treenode:not([aria-hidden="true"]) .ant-tree-node-content-wrapper')
      .first();
    if (await treeNode.count()) {
      await treeNode.click();
      await page.waitForTimeout(900);
      await shot(page, '03_Detail_Drawer_TreeView');
    } else {
      console.log('  [SKIP] không tìm thấy node nào trong cây phòng ban');
    }
    const drawerMask = page.locator('.ant-drawer-mask').first();
    if (await drawerMask.count()) {
      await drawerMask.click({ position: { x: 10, y: 10 } });
      await page.waitForTimeout(500);
    } else {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
    const stalePopup = page.locator('.ant-modal-wrap, .ant-drawer-open').first();
    if (await stalePopup.count()) {
      console.log('  [WARN] popup lạ còn mở, đóng bằng nút Huỷ/Đóng');
      const cancelBtn = page.locator('.ant-modal').getByRole('button', { name: /huỷ|hủy|đóng/i }).first();
      if (await cancelBtn.count()) {
        await cancelBtn.click({ force: true });
      } else {
        await page.keyboard.press('Escape');
      }
      await page.waitForTimeout(500);
      const drawerLeft = page.locator('.ant-drawer-close').first();
      if (await drawerLeft.count()) {
        await drawerLeft.click({ force: true });
        await page.waitForTimeout(500);
      }
    }
    const listSegmentBack = page.locator('.ant-segmented-item', { hasText: 'Danh sách' }).first();
    if (await listSegmentBack.count()) {
      await listSegmentBack.click();
      await page.waitForSelector('table tbody tr.ant-table-row', { timeout: 10000 });
      await page.waitForTimeout(600);
    }
  } else {
    console.log('  [SKIP] không tìm thấy nút chuyển "Dạng cây"');
  }

  // ── 04: Detail drawer ở chế độ bảng ───────────────────────────────────────
  console.log('Step 5: Detail drawer (chế độ Danh sách, nút xem chi tiết)');
  const firstRow = page.locator('table tbody tr.ant-table-row').first();
  const viewBtn = firstRow.locator('button').first();
  if (await viewBtn.count()) {
    await viewBtn.click();
    await page.waitForTimeout(800);
    await shot(page, '04_Detail_Drawer_TableView');
    const closeMask = page.locator('.ant-drawer-mask').first();
    if (await closeMask.count()) {
      await closeMask.click({ position: { x: 10, y: 10 } });
      await page.waitForTimeout(400);
    }
  } else {
    console.log('  [SKIP] không tìm thấy nút xem chi tiết trên dòng đầu');
  }

  // ── 05: Create form ───────────────────────────────────────────────────────
  console.log('Step 6: Create form (Thêm phòng ban)');
  const addBtn = page.getByRole('button', { name: /thêm phòng ban/i }).first();
  const suffix = Date.now().toString().slice(-6);
  const testName = 'Test Screenshot Dept ' + suffix;
  let createdOk = false;
  if (await addBtn.count()) {
    await addBtn.click();
    await page.waitForTimeout(700);
    await shot(page, '05_Create_Form');

    const nameInput = page.locator('.ant-modal').getByPlaceholder('Ví dụ: Phòng Kế toán').first();
    if (await nameInput.count()) {
      await nameInput.fill(testName);
    }
    // Chọn đơn vị trực thuộc (select bắt buộc duy nhất trong form)
    const orgUnitSelect = page.locator('.ant-modal input[role="combobox"]').first();
    if (await orgUnitSelect.count()) {
      await orgUnitSelect.click();
      await page.waitForTimeout(400);
      const opt = page.locator('.ant-select-item-option').first();
      if (await opt.count()) {
        await opt.click();
        await page.waitForTimeout(400);
      }
    }
    const saveBtn = page.locator('[role="dialog"]').getByRole('button', { name: /lưu/i }).last();
    if (await saveBtn.count()) {
      await saveBtn.click();
      await page.waitForTimeout(1500);
      const stillOpen = await page.locator('.ant-modal-wrap').first().isVisible().catch(() => false);
      if (stillOpen) {
        await shot(page, 'DEBUG_create_after_save');
        console.log('  [WARN] modal vẫn mở sau khi Lưu — có thể lỗi validation, đóng lại');
        const cancelBtn2 = page.locator('.ant-modal').getByRole('button', { name: /huỷ|hủy/i }).first();
        if (await cancelBtn2.count()) await cancelBtn2.click({ force: true });
        await page.waitForTimeout(500);
      } else {
        createdOk = true;
      }
    }
  } else {
    console.log('  [SKIP] không tìm thấy nút "Thêm phòng ban"');
  }

  // ── 06: Edit form ─────────────────────────────────────────────────────────
  console.log('Step 7: Edit form');
  const searchInput = page.getByPlaceholder('Tìm theo mã, tên, trưởng phòng').first();
  if (createdOk && (await searchInput.count())) {
    await searchInput.fill('Test Screenshot Dept');
    await page.waitForTimeout(900);
  }
  const editRow = page.locator('table tbody tr.ant-table-row').first();
  const actionBtn = editRow.locator('button').nth(1);
  if (await actionBtn.count()) {
    await actionBtn.click();
    await page.waitForTimeout(400);
    const editItem = page.locator('.ant-dropdown-menu-item').getByText('Sửa', { exact: true }).first();
    if (await editItem.count()) {
      await editItem.click();
      await page.waitForTimeout(800);
      await shot(page, '06_Edit_Form');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    } else {
      console.log('  [SKIP] không tìm thấy menu item "Sửa"');
    }
  } else {
    console.log('  [SKIP] không tìm thấy nút "Thao tác" trên dòng đầu');
  }

  // ── 07/08: Ngừng hoạt động (inactive) + Kích hoạt lại ────────────────────
  console.log('Step 8: Ngừng hoạt động + Kích hoạt lại (trên record test tự tạo)');
  if (createdOk) {
    const row = page.locator('table tbody tr.ant-table-row').first();
    const actionBtn2 = row.locator('button').nth(1);
    if (await actionBtn2.count()) {
      await actionBtn2.click();
      await page.waitForTimeout(400);
      const inactiveItem = page.locator('.ant-dropdown-menu-item').getByText('Ngừng hoạt động', { exact: true }).first();
      if (await inactiveItem.count()) {
        await inactiveItem.click();
        await page.waitForTimeout(700);
        await shot(page, '07_Inactive_Confirm_Modal');
        const confirmBtn = page.locator('.ant-modal').getByRole('button', { name: /đồng ý|ok|xác nhận/i }).last();
        if (await confirmBtn.count()) {
          await confirmBtn.click();
          await page.waitForTimeout(1200);
          await shot(page, '08_Inactive_Status');
        }
      } else {
        console.log('  [SKIP] không tìm thấy menu item "Ngừng hoạt động"');
      }
    }

    const row2 = page.locator('table tbody tr.ant-table-row').first();
    const actionBtn3 = row2.locator('button').nth(1);
    if (await actionBtn3.count()) {
      await actionBtn3.click();
      await page.waitForTimeout(400);
      const activateItem = page.locator('.ant-dropdown-menu-item').getByText('Kích hoạt lại', { exact: true }).first();
      if (await activateItem.count()) {
        await activateItem.click();
        await page.waitForTimeout(700);
        const okBtn = page.locator('.ant-modal').getByRole('button', { name: /đồng ý|ok|xác nhận/i }).last();
        if (await okBtn.count()) {
          await okBtn.click();
          await page.waitForTimeout(1000);
        }
      }
    }

    // ── 09/10: Xóa mềm + Khôi phục ──────────────────────────────────────
    console.log('Step 9: Xóa mềm + Khôi phục');
    const row3 = page.locator('table tbody tr.ant-table-row').first();
    const actionBtn4 = row3.locator('button').nth(1);
    if (await actionBtn4.count()) {
      await actionBtn4.click();
      await page.waitForTimeout(400);
      const softDeleteItem = page.locator('.ant-dropdown-menu-item').getByText('Xóa', { exact: true }).first();
      if (await softDeleteItem.count()) {
        await softDeleteItem.click();
        await page.waitForTimeout(700);
        await shot(page, '09_SoftDelete_Confirm_Modal');
        const ruleCheckbox = page.locator('.ant-modal').getByText('Tôi đã đọc và hiểu quy định xóa 14 ngày.').first();
        if (await ruleCheckbox.count()) {
          await ruleCheckbox.click();
          await page.waitForTimeout(300);
        }
        const confirmBtn2 = page.locator('.ant-modal').getByRole('button', { name: 'Xóa', exact: true }).last();
        if (await confirmBtn2.count()) {
          await confirmBtn2.click();
          await page.waitForTimeout(1200);
          await shot(page, '10_SoftDeleted_Status');
        }
      } else {
        console.log('  [SKIP] không tìm thấy menu item "Xóa"');
      }
    }

    // Dọn dẹp: xóa search để tránh empty-state giả ở các bước sau (record
    // test vừa xóa mềm nên biến mất khỏi bảng — không cần dọn dẹp gì thêm,
    // BE tự động archive các bản ghi xóa mềm quá 14 ngày).
    const searchClear = page.getByPlaceholder('Tìm theo mã, tên, trưởng phòng').first();
    if (await searchClear.count()) {
      await searchClear.fill('');
      await page.waitForTimeout(600);
    }
  } else {
    console.log('  [SKIP] không tạo được record test cho inactive/soft-delete/restore');
  }

  // ── 11/12: Khôi phục ────────────────────────────────────────────────────
  // GET /departments (bảng) và GET /departments/tree đều KHÔNG trả về bản ghi
  // soft_deleted (đã verify thật bằng curl) — nút "Khôi phục" (trong
  // DepartmentDetailDrawer) do đó không có dữ liệu thật nào để bấm vào qua
  // luồng UI bình thường. Dùng route-mock (cùng kỹ thuật với Loading/Error
  // state bên dưới) để chèn 1 node soft_deleted vào response cây, chỉ để
  // chụp lại đúng UI thật (nút, dropdown, toast) — không phải vẽ tay.
  console.log('Step 9b: Khôi phục (context riêng, mock 1 node soft_deleted trong /departments/tree)');
  {
    const restoreContext = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const restorePage = await restoreContext.newPage();
    await login(restorePage);
    await restorePage.route('**/departments/tree**', async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      json.data = [
        {
          id: 999999,
          org_unit_id: 5,
          code: 'EVDEPT_RESTORE',
          department_type: 'phong_ban',
          name: 'Test Screenshot Restore',
          status: 1,
          deleted_at: '2026-07-15T00:00:00.000000Z',
          employees_count: 0,
          children: [],
        },
        ...(json.data ?? []),
      ];
      await route.fulfill({ response, json });
    });
    await restorePage.route('**/departments/999999/restore', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          status: 'success',
          message: 'Khôi phục phòng ban thành công',
          data: { id: 999999, status: 1, deleted_at: null },
        }),
      }),
    );
    // onRestore (DepartmentsPage) đọc từ useDepartment(detailId) — GET /departments/{id} —
    // bất kể đang ở view nào, nên phải mock luôn endpoint chi tiết, không chỉ /tree.
    await restorePage.route('**/departments/999999', (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          status: 'success',
          data: {
            id: 999999,
            org_unit_id: 5,
            code: 'EVDEPT_RESTORE',
            department_type: 'phong_ban',
            name: 'Test Screenshot Restore',
            status: 1,
            deleted_at: '2026-07-15T00:00:00.000000Z',
            employees_count: 0,
          },
        }),
      });
    });
    await gotoDepartments(restorePage);
    const treeSegmentRestore = restorePage.locator('.ant-segmented-item', { hasText: 'Dạng cây' }).first();
    if (await treeSegmentRestore.count()) {
      await treeSegmentRestore.click();
      await restorePage.waitForTimeout(1000);
      const deletedNode = restorePage
        .locator('.ant-tree-node-content-wrapper')
        .getByText('Test Screenshot Restore', { exact: false })
        .first();
      if (await deletedNode.count()) {
        await deletedNode.click();
        await restorePage.waitForTimeout(1500);
        const restoreBtn = restorePage.locator('.ant-drawer').getByRole('button', { name: /khôi phục/i }).first();
        if (await restoreBtn.count()) {
          await restoreBtn.click();
          await restorePage.waitForSelector('.ant-modal-wrap', { timeout: 5000 }).catch(() => {});
          await restorePage.waitForTimeout(500);
          await shot(restorePage, '11_Restore_Confirm_Modal');
          const okBtn2 = restorePage.locator('.ant-modal').getByRole('button', { name: /đồng ý|ok|khôi phục/i }).last();
          if (await okBtn2.count()) {
            await okBtn2.click();
            await restorePage.waitForTimeout(1200);
            await shot(restorePage, '12_Restored_Status');
          }
        } else {
          console.log('  [SKIP] không tìm thấy nút "Khôi phục" trong detail drawer/panel');
        }
      } else {
        console.log('  [SKIP] không tìm thấy node soft_deleted (mock) trong cây');
      }
    } else {
      console.log('  [SKIP] không tìm thấy nút chuyển "Dạng cây"');
    }
    await restoreContext.close();
  }

  // Dọn dẹp: bản ghi test tạo ở Step 6 đã bị xóa mềm ở Step 9 (vào thùng
  // rác 14 ngày) — xóa vĩnh viễn ngay để không giữ mã (vd PB-0001) làm kẹt
  // lần chạy script sau (auto-gen code không tự biết bỏ qua mã đã dùng bởi
  // bản ghi trong thùng rác).
  if (createdDeptId && authToken) {
    console.log(`Step 9c: Dọn dẹp — force-delete bản ghi test id=${createdDeptId}`);
    const apiBase = process.env.API_BASE_URL || (() => { throw new Error('API_BASE_URL env var required'); })();
    const cleanupRes = await page.request.delete(
      `${apiBase}/departments/${createdDeptId}/force-delete`,
      { headers: { Authorization: `Bearer ${authToken}` } },
    );
    console.log(`  [OK] force-delete status: ${cleanupRes.status()}`);
  } else if (createdDeptId) {
    console.log(`  [WARN] không lấy được token để dọn dẹp id=${createdDeptId} — cần xóa thủ công`);
  }

  // ── 13: Empty state (filter không khớp) ──────────────────────────────────
  console.log('Step 10: Empty state (filtered)');
  const searchInput3 = page.getByPlaceholder('Tìm theo mã, tên, trưởng phòng').first();
  if (await searchInput3.count()) {
    await searchInput3.fill('zzz_khong_ton_tai_zzz');
    await page.waitForTimeout(900);
    await shot(page, '13_Empty_State_Filtered');
    await searchInput3.fill('');
    await page.waitForTimeout(700);
  } else {
    console.log('  [SKIP] không tìm thấy ô tìm kiếm');
  }

  // ── 14/15: Loading + Error state (context/login riêng) ───────────────────
  console.log('Step 11: Loading state (context riêng, delay API response)');
  await captureFreshState(browser, {
    routePattern: '**/departments**',
    routeHandler: async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    },
    waitBeforeShot: 400,
    shotName: '14_Loading_State',
  });

  console.log('Step 12: Error state (context riêng, mocked 500 response)');
  await captureFreshState(browser, {
    routePattern: '**/departments**',
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
    shotName: '15_Error_State',
  });

  await browser.close();

  console.log(`\n=== DONE: ${shots.length} screenshots saved to ${outDir} ===`);
  console.log(shots.map((s) => `  - ${s}.png`).join('\n'));
}

main().catch((err) => {
  console.error('CAPTURE FAILED:', err);
  process.exit(1);
});
