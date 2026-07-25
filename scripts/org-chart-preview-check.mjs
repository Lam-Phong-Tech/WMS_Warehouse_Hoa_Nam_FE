// Script Playwright độc lập (chạy bằng: node scripts/org-chart-preview-check.mjs)
// Mục đích: verify "xem tất cả phòng ban" / "xem tất cả đơn vị" trên Sơ đồ tổ chức
// với dữ liệu thật (đã seed thêm qua API để vượt ngưỡng preview) —
// phục vụ retest feedback QA task [M1][FE] Org Chart Screen P0.
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5176';
const EMAIL = process.env.QA_ADMIN_EMAIL ?? (() => { throw new Error('Set QA_ADMIN_EMAIL env var'); })();
const PASSWORD = (process.env.QA_ADMIN_PASSWORD ?? (() => { throw new Error('Set QA_ADMIN_PASSWORD env var'); })());

const results = [];
function check(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
}

const browser = await chromium.launch();
const page = await browser.newPage();

try {
  await page.goto(`${BASE_URL}/login`);
  await page.getByPlaceholder('you@example.com').fill(EMAIL);
  await page.getByPlaceholder('••••••••').fill(PASSWORD);
  await page.getByRole('button', { name: /đăng nhập/i }).click();
  await page.waitForFunction(() => !location.pathname.includes('/login'), {
    timeout: 15000,
  });
  check('Đăng nhập thành công', true, page.url());

  await page.getByText('Sơ đồ tổ chức', { exact: true }).click();
  await page.waitForSelector('#org-chart-card', { timeout: 15000 });
  await page.waitForTimeout(1000);

  // Chỉ tìm trong vùng cây sơ đồ — tránh trùng với bảng nhân viên ở
  // detail panel bên dưới (cùng chứa tên đơn vị/phòng ban dạng text).
  const card = page.locator('#org-chart-card');

  // ══════════════════════════════════════════════
  // 1) Đơn vị con: "Tổng Công Ty ERB" có 13 con, ngưỡng preview = 8
  // ══════════════════════════════════════════════
  await card.getByText('Tổng Công Ty ERB', { exact: true }).click();
  await page.waitForTimeout(500);

  const viewAllUnitsBtn = card.getByText(/đơn vị khác — xem tất cả/);
  const hasViewAllUnits = await viewAllUnitsBtn.count();
  check(
    'Hiện nút "+N đơn vị khác — xem tất cả" khi > 8 đơn vị con',
    hasViewAllUnits > 0,
    hasViewAllUnits > 0 ? await viewAllUnitsBtn.first().innerText() : 'không thấy nút',
  );

  if (hasViewAllUnits > 0) {
    await viewAllUnitsBtn.first().click();
    await page.waitForTimeout(500);
  }

  // API trả /org-units theo id giảm dần → 8 đơn vị đầu tiên là QA10..QA03,
  // các đơn vị THỰC SỰ bị ẩn sau ngưỡng preview=8 là QA02, QA01, Chi Nhánh
  // Hà Nội, Chi Nhánh TP.HCM, Công Ty Con ERB Tech (5 đơn vị, khớp "+5").
  const hiddenUnitNames = [
    'Chi Nhanh Test QA 01',
    'Chi Nhanh Test QA 02',
    'Chi Nhánh TP.HCM',
  ];

  for (const name of hiddenUnitNames) {
    const nodeText = card.getByText(name, { exact: true }).first();
    const visible = await nodeText.isVisible().catch(() => false);
    if (!visible) {
      check(`"${name}" hiển thị sau khi bấm xem tất cả`, false, 'không tìm thấy trong DOM');
      continue;
    }
    await nodeText.scrollIntoViewIfNeeded();
    await nodeText.click();
    await page.waitForTimeout(800);
    const headerLocator = page.locator('div[style*="font-weight: 700"][style*="font-size: 20"]').first();
    const headerText = await headerLocator.innerText().catch(() => '');
    check(
      `Click "${name}" (đơn vị ẩn) → mở đúng detail`,
      headerText.trim() === name,
      `panel hiện: "${headerText.trim()}"`,
    );
  }

  // ══════════════════════════════════════════════
  // 2) Phòng ban: "Chi Nhánh Hà Nội" có 8 phòng ban, ngưỡng preview = 4
  // ══════════════════════════════════════════════
  const hanoiNode = card.getByText('Chi Nhánh Hà Nội', { exact: true });
  await hanoiNode.scrollIntoViewIfNeeded();
  await hanoiNode.click();
  await page.waitForTimeout(1200);

  const viewAllDeptsBtn = card.getByText(/phòng ban khác — xem tất cả/);
  const hasViewAllDepts = await viewAllDeptsBtn.count();
  check(
    'Hiện nút "+N phòng ban khác — xem tất cả" khi > 4 phòng ban',
    hasViewAllDepts > 0,
    hasViewAllDepts > 0 ? await viewAllDeptsBtn.first().innerText() : 'không thấy nút',
  );

  if (hasViewAllDepts > 0) {
    await viewAllDeptsBtn.first().click();
    await page.waitForTimeout(500);
  }

  const hiddenDeptNames = [
    'Phong Ban Test QA 01',
    'Phong Ban Test QA 03',
    'Phong Ban Test QA 05',
  ];

  for (const name of hiddenDeptNames) {
    const deptChip = card.getByText(name, { exact: false }).first();
    const visible = await deptChip.isVisible().catch(() => false);
    if (!visible) {
      check(`"${name}" hiển thị sau khi bấm xem tất cả`, false, 'không tìm thấy trong DOM');
      continue;
    }
    await deptChip.scrollIntoViewIfNeeded();
    await deptChip.click();
    await page.waitForTimeout(800);
    const headerLocator = page.locator('div[style*="font-weight: 700"][style*="font-size: 20"]').first();
    const headerText = await headerLocator.innerText().catch(() => '');
    check(
      `Click "${name}" (phòng ban ẩn) → mở đúng detail`,
      headerText.trim() === name,
      `panel hiện: "${headerText.trim()}"`,
    );
  }
} catch (e) {
  console.error('LỖI KHÔNG MONG MUỐN:', e);
  results.push({ name: 'Script chạy hết không lỗi', pass: false, detail: String(e) });
} finally {
  await browser.close();
}

console.log('\n──────── TỔNG KẾT ────────');
const failed = results.filter((r) => !r.pass);
console.log(`${results.length - failed.length}/${results.length} PASS`);
if (failed.length) {
  console.log('CÁC MỤC FAIL:');
  failed.forEach((f) => console.log(`  - ${f.name}: ${f.detail}`));
  process.exitCode = 1;
}
