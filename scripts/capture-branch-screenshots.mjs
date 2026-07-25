// Chụp screenshot THẬT cho task [M1][FE] Branch Management List + Create/Edit/Detail
// (branch-mode của module src/modules/org-units/, route `/org-units?mode=branch`).
//
// Review đã chỉ ra P1: chưa có evidence riêng cho branch-mode gồm: menu "Chi nhánh",
// list mặc định chỉ chi nhánh, filter company/status, create branch locked chi_nhanh,
// edit branch locked chi_nhanh, detail branch, inactive/restore branch.
//
// Tài khoản: Super Admin, môi trường: https://astrodev.test8.io.vn (qua FE chạy local).
// Cùng ràng buộc như scripts/capture-company-screenshots.mjs: access token chỉ lưu trong
// memory (auth.store.ts, cố ý không persist), nên chỉ page.goto() một lần tới /login,
// phần còn lại điều hướng bằng click nội bộ (không dùng page.reload() sau khi đã login).
//
// Usage: node scripts/capture-branch-screenshots.mjs [baseUrl]

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const baseUrl = process.argv[2] || 'http://localhost:5173';
const outDir = path.resolve('docs/evidence/branch-management');
mkdirSync(outDir, { recursive: true });

const shots = [];

async function shot(page, name) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  shots.push(name);
  console.log(`  [OK] ${name}.png`);
}

async function selectAntdOption(page, currentLabelText, optionText) {
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

async function expandAllRows(page) {
  for (let i = 0; i < 5; i++) {
    const expandIcon = page.locator('.ant-table-row-expand-icon-collapsed').first();
    if (!(await expandIcon.count())) break;
    await expandIcon.click();
    await page.waitForTimeout(400);
  }
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

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  console.log(`=== Base URL: ${baseUrl} ===`);

  console.log('Step 1: Login');
  await login(page);

  // ── 00: Menu "Chi nhánh" hiển thị + active state ─────────────────────
  // Submenu "Module 1 · Tổ chức" đã mở sẵn mặc định sau login — không cần click để mở.
  console.log('Step 2: Menu "Chi nhánh" — click từ sider');
  const menuLink = page
    .locator('aside, nav, [class*="sider"], [class*="menu"]')
    .first()
    .getByText('Chi nhánh', { exact: true })
    .first();
  await menuLink.waitFor({ state: 'visible', timeout: 10000 });
  await menuLink.click();
  await page.waitForTimeout(1000);
  await page.waitForSelector('table tbody tr.ant-table-row', { timeout: 10000 }).catch(() => {});
  await shot(page, '00_Menu_ChiNhanh_Active');

  // Xác nhận URL đúng branch-mode
  console.log(`  URL hiện tại: ${page.url()}`);

  // ── 01: List mặc định chỉ hiện chi nhánh (chế độ "Danh sách") ────────────
  // Bảng ở branch-mode dùng expandable rows (antd `children` lồng cấp) để giữ
  // ngữ cảnh công ty cha/công ty con — dòng gốc hiển thị là công ty (context),
  // các dòng Chi nhánh thực sự nằm lồng bên trong, mở bằng icon "+". Đây là
  // hành vi CHỦ ĐỊNH (xem comment `filteredTreeForTable` trong OrgUnitsPage.tsx:
  // "sổ/thu bằng dấu + ở dòng công ty mẹ/công ty con thay vì liệt kê phẳng"),
  // không phải bug — nên mở rộng hết trước khi chụp để evidence rõ ràng.
  console.log('Step 3: Chuyển sang "Danh sách" rồi chụp list mặc định — chỉ chi nhánh');
  const listSegment = page.locator('.ant-segmented-item', { hasText: 'Danh sách' }).first();
  if (await listSegment.count()) {
    await listSegment.click();
    await page.waitForSelector('table tbody tr.ant-table-row', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(600);
  }
  // Mở tất cả các dòng có thể mở rộng (icon "+") để lộ ra các dòng Chi nhánh lồng bên trong
  await expandAllRows(page);
  await shot(page, '01_List_Default_OnlyBranch');

  // ── 02: Filter theo Công ty cha ───────────────────────────────────────
  console.log('Step 4: Filter theo Công ty cha');
  let filteredCompanyOk = false;
  const companySelect = page.locator('.ant-select-content', { hasText: 'Tất cả công ty' }).first();
  if (await companySelect.count()) {
    await companySelect.click();
    await page.waitForTimeout(400);
    const companyOption = page.locator('.ant-select-item-option').first();
    if (await companyOption.count()) {
      await companyOption.click();
      await page.waitForTimeout(800);
      filteredCompanyOk = true;
    } else {
      await page.keyboard.press('Escape');
    }
  }
  if (filteredCompanyOk) {
    await expandAllRows(page);
    await shot(page, '02_Filter_Company');
    // Reset lại toàn bộ filter bằng cách điều hướng lại qua menu (SPA nav, không
    // reload — giữ nguyên session) thay vì click lại từng option, vì nhiều select
    // trên toolbar có label tương tự nhau (fragile nếu click theo vị trí `.first()`).
    await menuLink.click();
    await page.waitForTimeout(1000);
    const listSegmentReset = page.locator('.ant-segmented-item', { hasText: 'Danh sách' }).first();
    if (await listSegmentReset.count()) {
      await listSegmentReset.click();
      await page.waitForSelector('table tbody tr.ant-table-row', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(600);
    }
    await expandAllRows(page);
  } else {
    console.log('  [SKIP] không lọc được theo "Công ty cha"');
  }

  // ── 03: Filter theo Trạng thái ────────────────────────────────────────
  console.log('Step 5: Filter theo Trạng thái = Hoạt động');
  const filteredStatusOk = await selectAntdOption(page, 'Tất cả trạng thái', 'Hoạt động');
  if (filteredStatusOk) {
    await expandAllRows(page);
    await shot(page, '03_Filter_Status');
    await selectAntdOption(page, 'Hoạt động', 'Tất cả trạng thái');
    await expandAllRows(page);
  } else {
    console.log('  [SKIP] không lọc được theo "Trạng thái"');
  }

  // ── 04: Create branch form — locked unitType = chi_nhanh ─────────────
  // Chỉ cần chụp trạng thái form vừa mở (radio "Loại đơn vị" đã khoá ở "Chi nhánh",
  // 2 lựa chọn còn lại disabled) — không cần submit thật, tránh phải điền cascading
  // select Tỉnh/Phường phức tạp không cần thiết cho mục đích evidence.
  console.log('Step 6: Create branch form (locked chi_nhanh)');
  const addBtn = page.getByRole('button', { name: /thêm chi nhánh/i }).first();
  if (await addBtn.count()) {
    await addBtn.click();
    await page.waitForTimeout(700);
    await shot(page, '04_Create_Branch_Form_Locked');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  } else {
    console.log('  [SKIP] không tìm thấy nút "Thêm chi nhánh"');
  }

  // Dùng 1 chi nhánh có sẵn từ seed data (không tạo record mới) cho edit/detail/
  // inactive/restore — sau khi vô hiệu sẽ khôi phục lại ngay để không đổi trạng thái
  // dữ liệu demo dùng chung.
  await expandAllRows(page);
  const targetRow = page.locator('table tbody tr.ant-table-row', { hasText: 'Chi Nhánh Hà Nội' }).first();
  const targetRowExists = await targetRow.count();
  if (!targetRowExists) {
    console.log('  [SKIP] không tìm thấy dòng "Chi Nhánh Hà Nội" — bỏ qua edit/detail/inactive/restore');
  } else {
    // ── 05: Edit branch form — locked unitType = chi_nhanh ──────────────
    console.log('Step 7: Edit branch form (locked chi_nhanh)');
    const actionBtn = targetRow.locator('button[title="Thao tác"]').first();
    if (await actionBtn.count()) {
      await actionBtn.click();
      await page.waitForTimeout(400);
      const editItem = page.locator('.ant-dropdown-menu-item').getByText('Sửa', { exact: true }).first();
      if (await editItem.count()) {
        await editItem.click();
        await page.waitForTimeout(800);
        await shot(page, '05_Edit_Branch_Form_Locked');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(400);
      } else {
        console.log('  [SKIP] không tìm thấy menu item "Sửa"');
      }
    }

    // ── 06: Detail branch (Drawer từ "Xem chi tiết") ────────────────────
    console.log('Step 8: Detail branch');
    const actionBtn2 = targetRow.locator('button[title="Thao tác"]').first();
    if (await actionBtn2.count()) {
      await actionBtn2.click();
      await page.waitForTimeout(400);
      const viewItem = page.locator('.ant-dropdown-menu-item').getByText('Xem chi tiết', { exact: true }).first();
      if (await viewItem.count()) {
        await viewItem.click();
        await page.waitForTimeout(800);
        await shot(page, '06_Detail_Branch');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(400);
      } else {
        console.log('  [SKIP] không tìm thấy menu item "Xem chi tiết"');
      }
    }

    // ── 07/08: Inactive branch ────────────────────────────────────────────
    console.log('Step 9: Inactive branch');
    const actionBtn3 = targetRow.locator('button[title="Thao tác"]').first();
    if (await actionBtn3.count()) {
      await actionBtn3.click();
      await page.waitForTimeout(400);
      const deactivateItem = page.locator('.ant-dropdown-menu-item').getByText('Vô hiệu', { exact: true }).first();
      if (await deactivateItem.count()) {
        await deactivateItem.click();
        await page.waitForTimeout(800);
        await shot(page, '07_Deactivate_Confirm_Modal');
        // Checkbox "Tôi đã đọc và hiểu..." mặc định checked=false (P2 fix — người
        // dùng phải chủ động xác nhận), nên phải click trước khi submit.
        // `orgUnitsService.inactive()` gửi kèm `force_soft_delete_confirm: true`
        // (fix bug BE trả 409 CONFIRM_REQUIRED cho đơn vị còn nhân sự active).
        const confirmCheckbox = page.getByRole('checkbox').first();
        if (await confirmCheckbox.count()) {
          await confirmCheckbox.click();
          await page.waitForTimeout(300);
        }
        const confirmBtn = page.getByRole('button', { name: /xác nhận vô hiệu/i }).last();
        if (await confirmBtn.count()) {
          await confirmBtn.click();
          await page.waitForTimeout(1200);
          await shot(page, '08_Deactivated_Status');
        }
      } else {
        console.log('  [SKIP] không tìm thấy menu item "Vô hiệu"');
      }
    }

    // ── 09/10: Restore branch (đưa về đúng trạng thái ban đầu) ────────────
    // Sau khi vô hiệu hoá, đơn vị chuyển status "soft_deleted" ("Đã xóa chờ khôi
    // phục") — nằm trong HIDDEN_BY_DEFAULT_STATUSES nên biến mất khỏi list mặc
    // định. Phải lọc đúng trạng thái đó mới thấy lại dòng để khôi phục.
    console.log('Step 10: Restore branch');
    await selectAntdOption(page, 'Tất cả trạng thái', 'Đã xóa chờ khôi phục');
    await expandAllRows(page);
    const rowForRestore = page.locator('table tbody tr.ant-table-row', { hasText: 'Chi Nhánh Hà Nội' }).first();
    const actionBtn4 = rowForRestore.locator('button[title="Thao tác"]').first();
    if (await actionBtn4.count()) {
      await actionBtn4.click();
      await page.waitForTimeout(400);
      const restoreItem = page.locator('.ant-dropdown-menu-item').getByText('Khôi phục', { exact: true }).first();
      if (await restoreItem.count()) {
        await restoreItem.click();
        await page.waitForTimeout(700);
        await shot(page, '09_Restore_Confirm_Modal');
        const okBtn = page.getByRole('button', { name: /^khôi phục$|ok/i }).last();
        if (await okBtn.count()) {
          await okBtn.click();
          await page.waitForTimeout(1200);
          await shot(page, '10_Restored_Status');
        }
      } else {
        console.log('  [SKIP] không tìm thấy menu item "Khôi phục" — cần khôi phục thủ công để không để lại dữ liệu bẩn');
      }
    }
  }

  await browser.close();

  console.log(`\n=== DONE: ${shots.length} screenshots saved to ${outDir} ===`);
  console.log(shots.map((s) => `  - ${s}.png`).join('\n'));
}

main().catch((err) => {
  console.error('CAPTURE FAILED:', err);
  process.exit(1);
});
