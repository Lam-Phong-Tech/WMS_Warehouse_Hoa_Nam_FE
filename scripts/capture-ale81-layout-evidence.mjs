// Chụp evidence THẬT cho ALE-81 (Stabilize ERP Admin Layout).
// Khác với các script capture-*-screenshots.mjs khác (nhắm vào nghiệp vụ module),
// script này chỉ nhắm vào chính layout: desktop full, Sider collapsed, Drawer
// mobile/tablet, menu dài M1/M2/M3, breadcrumb sub-route, user menu.
//
// Lý do cần script riêng: review trước đó của ALE-81 bị đánh giá "chưa có evidence
// đúng task layout" vì repo chỉ có evidence M1 (nghiệp vụ Organization module),
// không có bộ ảnh riêng cho các trạng thái layout.
//
// Session lưu token trong memory (auth.store.ts không persist) nên chỉ page.goto()
// một lần duy nhất tới /login; các bước sau dùng navigation nội bộ (click) hoặc
// page.setViewportSize() (không phải page.goto) để giữ session.
//
// Usage: node scripts/capture-ale81-layout-evidence.mjs [baseUrl]

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const baseUrl = process.argv[2] || 'http://localhost:5173';
const outDir = path.resolve('docs/evidence/ale81-layout');
mkdirSync(outDir, { recursive: true });

const shots = [];

async function shot(page, name, opts = {}) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false, ...opts });
  shots.push(name);
  console.log(`  [OK] ${name}.png`);
}

async function clickMenu(page, text, timeout = 30000, groupLabel) {
  // Trên mobile, menu thật đang hiển thị nằm trong antd Drawer (portal riêng,
  // không phải bên trong <aside> desktop — <aside> vẫn ở DOM nhưng bị ẩn qua
  // CSS breakpoint). Dùng :visible để luôn trỏ đúng menu đang hiển thị, bất kể
  // là Sider desktop hay Drawer mobile/tablet.
  const escaped = (s) => s.replace(/"/g, '\\"');
  const link = page.locator(`:text-is("${escaped(text)}"):visible`).first();
  if (groupLabel) {
    const group = page.locator(`:text-is("${escaped(groupLabel)}"):visible`).first();
    if (await group.count()) {
      // Chỉ click mở group nếu mục con hiện đang ẩn (không toggle đóng group
      // đang mở sẵn, vì click lần 2 vào group title sẽ đóng nó lại).
      const alreadyVisible = (await link.count()) > 0 && (await link.isVisible().catch(() => false));
      if (!alreadyVisible) {
        await group.click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(500);
      }
    }
  }
  await link.waitFor({ state: 'visible', timeout });
  await link.click({ timeout });
  await page.waitForTimeout(800);
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  console.log(`=== Base URL: ${baseUrl} ===`);

  console.log('Step 0: Login (page.goto duy nhất trong toàn bộ script)');
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  const email = process.env.QA_ADMIN_EMAIL;
  if (!email) throw new Error('Set QA_ADMIN_EMAIL env var');
  await page.locator('input[type="email"], input[name="email"]').first().fill(email);
  const pwd = process.env.QA_ADMIN_PASSWORD;
  if (!pwd) throw new Error('Set QA_ADMIN_PASSWORD env var');
  await page.locator('input[type="password"], input[name="password"]').first().fill(pwd);
  await page.getByRole('button', { name: /đăng nhập/i }).first().click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  // ===== 1. Desktop full, Sider mở rộng =====
  console.log('Step 1: Desktop full, Sider expanded');
  await shot(page, '01_Desktop_Full_Sider_Expanded');

  // ===== 2. Desktop, Sider collapsed =====
  console.log('Step 2: Desktop, Sider collapsed');
  const collapseBtn = page.locator('[aria-label*="Thu gọn"]').first();
  if (await collapseBtn.count()) {
    await collapseBtn.click();
    await page.waitForTimeout(500);
    await shot(page, '02_Desktop_Sider_Collapsed');
    // mở lại để các bước sau không bị ảnh hưởng
    await page.locator('[aria-label*="Mở rộng"]').first().click();
    await page.waitForTimeout(500);
  } else {
    console.log('  [SKIP] không tìm thấy nút collapse (aria-label)');
  }

  // ===== 3. Menu dài M1/M2/M3 =====
  console.log('Step 3: Menu dài — module M1 (Tổ chức)');
  await clickMenu(page, 'Đơn vị tổ chức');
  await shot(page, '03_Menu_M1_Organization_Active');

  console.log('Step 4: Menu dài — module M2 (Kho)');
  try {
    await clickMenu(page, 'Kho hàng', 8000, 'Module 2 · Kho');
    await shot(page, '04_Menu_M2_Warehouse_Active');
  } catch (err) {
    console.log(`  [SKIP] M2 menu không có (không tìm thấy mục "Kho hàng" — có thể do quyền hoặc chưa scroll tới): ${err.message.split('\n')[0]}`);
  }

  console.log('Step 5: Menu dài — module M3 (Kinh doanh)');
  try {
    await clickMenu(page, 'Sản phẩm', 8000, 'Module 3 · Kinh doanh');
    await shot(page, '05_Menu_M3_Business_Active');
  } catch (err) {
    console.log(`  [SKIP] M3 menu không có (thiếu quyền BUSINESS_VIEW/PRODUCT_VIEW): ${err.message.split('\n')[0]}`);
  }

  // ===== 6. Breadcrumb sub-route (query-based: /org-units?mode=branch) =====
  console.log('Step 6: Breadcrumb sub-route — Chi nhánh (con của Đơn vị tổ chức)');
  await clickMenu(page, 'Đơn vị tổ chức', 30000, 'Module 1 · Tổ chức');
  try {
    await clickMenu(page, 'Chi nhánh', 30000, 'Module 1 · Tổ chức');
    await shot(page, '06_Breadcrumb_SubRoute_Branches');
  } catch (err) {
    console.log(`  [SKIP] Không tìm thấy submenu "Chi nhánh": ${err.message}`);
  }

  // ===== 7. User menu mở (desktop) =====
  console.log('Step 7: User menu (desktop)');
  const avatarTrigger = page.locator('[class*="avatar"], [class*="user-menu"]').first();
  if (await avatarTrigger.count()) {
    await avatarTrigger.click();
    await page.waitForTimeout(500);
    await shot(page, '07_Desktop_UserMenu_Open');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  } else {
    console.log('  [SKIP] không tìm thấy avatar/user menu trigger');
  }

  // ===== 8. Tablet — Drawer mode (md–lg, < lg = 992px) =====
  console.log('Step 8: Tablet (768px) — Drawer mode, đóng');
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForTimeout(500);
  await shot(page, '08_Tablet_768_Drawer_Closed');

  console.log('Step 9: Tablet (768px) — Drawer mở');
  const toggleBtnTablet = page.locator('[aria-label*="Mở/đóng menu"]').first();
  if (await toggleBtnTablet.count()) {
    await toggleBtnTablet.click();
    await page.waitForTimeout(500);
    await shot(page, '09_Tablet_768_Drawer_Open');
    // Đóng lại bằng cách click mask (Escape không đáng tin cậy để đóng antd Drawer
    // ở mọi phiên bản) — chờ mask biến mất trước khi qua bước tiếp theo.
    const maskTablet = page.locator('.ant-drawer-mask').first();
    if (await maskTablet.count()) {
      await maskTablet.click({ force: true });
      await maskTablet.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    }
    await page.waitForTimeout(300);
  } else {
    console.log('  [SKIP] không tìm thấy nút toggle Drawer trên tablet');
  }

  // ===== 10. Mobile — Drawer full overlay =====
  console.log('Step 10: Mobile (375x812) — Drawer đóng, header không vỡ dòng');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(500);
  await shot(page, '10_Mobile_375_Header_Closed');

  console.log('Step 11: Mobile (375x812) — Drawer mở full overlay');
  // Đảm bảo không còn mask nào sót lại từ bước tablet trước khi click toggle.
  const leftoverMask = page.locator('.ant-drawer-mask').first();
  if (await leftoverMask.count()) {
    await leftoverMask.click({ force: true }).catch(() => {});
    await leftoverMask.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  }
  const toggleBtnMobile = page.locator('[aria-label*="Mở/đóng menu"]').first();
  if (await toggleBtnMobile.count()) {
    await toggleBtnMobile.click({ force: true });
    await page.waitForTimeout(500);
    await shot(page, '11_Mobile_375_Drawer_Open_FullOverlay');

    console.log('Step 12: Mobile — click "Nhân viên" trong Drawer → Drawer tự đóng (onNavigate)');
    // Submenu cha "Module 1 · Tổ chức" có thể đang thu gọn trong Drawer (không tự
    // đồng bộ trạng thái open từ trang trước) — mở group ra trước khi tìm mục
    // con, nếu không "Nhân viên" sẽ không visible trong DOM để click.
    await clickMenu(page, 'Nhân viên', 10000, 'Module 1 · Tổ chức');

    const drawerMask = page.locator('.ant-drawer-mask').first();
    await drawerMask.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);
    await shot(page, '12_Mobile_375_Drawer_Closed_After_Navigate');

    console.log('Step 13: Mobile — bảng nhiều cột (Nhân viên) tự cuộn ngang, không tràn ra ngoài viewport');
    const tableWrapper = page.locator('.ant-table-content, .ant-table-body, [class*="table"]').first();
    if (await tableWrapper.count()) {
      const box = await tableWrapper.boundingBox();
      const viewportWidth = page.viewportSize().width;
      if (box && box.x + box.width > viewportWidth + 5) {
        console.log(
          `  [WARN] Table content width (${Math.round(box.x + box.width)}px) vượt viewport (${viewportWidth}px) — kiểm tra lại overflow-x`,
        );
      } else {
        console.log('  [OK] Table không tràn ra ngoài viewport (cuộn ngang trong container)');
      }
    }
    await shot(page, '13_Mobile_375_Table_HorizontalScroll');
  } else {
    console.log('  [SKIP] không tìm thấy nút toggle Drawer trên mobile');
  }

  await page.setViewportSize({ width: 1920, height: 1080 });

  await browser.close();

  console.log(`\n=== DONE: ${shots.length} screenshots saved to ${outDir} ===`);
  console.log(shots.map((s) => `  - ${s}.png`).join('\n'));
}

main().catch((err) => {
  console.error('CAPTURE FAILED:', err);
  process.exit(1);
});
