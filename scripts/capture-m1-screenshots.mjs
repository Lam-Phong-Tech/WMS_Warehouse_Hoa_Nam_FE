// Chụp screenshot THẬT cho M1 Demo (tài khoản QA, 1 phiên trình duyệt).
//
// QUAN TRỌNG: app lưu access token CHỈ trong memory (auth.store.ts, cố ý không persist
// để giảm rủi ro XSS) - một full page navigation (page.goto) sẽ làm mất session và văng
// về /login. Vì vậy script này chỉ dùng page.goto() MỘT LẦN duy nhất (tới /login), sau đó
// điều hướng nội bộ bằng cách click vào sidebar/menu (client-side routing của React Router).
//
// Không thay thế toàn bộ 22 screenshots trong checklist (những bước cần đổi tài khoản
// trvanb@example.com / lethic@example.com để test workflow duyệt/từ chối phải chụp thủ công).
//
// Usage: node scripts/capture-m1-screenshots.mjs [baseUrl]

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const baseUrl = process.argv[2] || 'http://localhost:5173';
const outDir = path.resolve('docs/evidence/m1-demo');
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

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  console.log(`=== Base URL: ${baseUrl} ===`);

  console.log('Step 1: Login (page.goto duy nhất trong toàn bộ script)');
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await page.locator('input[type="email"], input[name="email"]').first().fill(process.env.QA_ADMIN_EMAIL ?? (() => { throw new Error('Set QA_ADMIN_EMAIL env var'); })());
  await page.locator('input[type="password"], input[name="password"]').first().fill((process.env.QA_ADMIN_PASSWORD ?? (() => { throw new Error('Set QA_ADMIN_PASSWORD env var'); })()));
  await shot(page, '01_Login_Form');
  await page.getByRole('button', { name: /đăng nhập/i }).first().click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await shot(page, '01b_Login_Success_Dashboard');

  console.log('Step 2: Org Units');
  await clickMenu(page, 'Đơn vị tổ chức');
  await page.waitForTimeout(800);
  await shot(page, '02_OrgUnit_List');
  const addOrgBtn = page.getByRole('button', { name: /thêm đơn vị|thêm mới|\+ thêm/i }).first();
  if (await addOrgBtn.count()) {
    await addOrgBtn.click();
    await page.waitForTimeout(700);
    await shot(page, '03_OrgUnit_Create_Form');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
  const treeTab = page.getByRole('tab', { name: /cây tổ chức|sơ đồ|tree/i }).first();
  if (await treeTab.count()) {
    await treeTab.click();
    await page.waitForTimeout(900);
    await shot(page, '04_OrgUnit_Tree');
  } else {
    const treeToggle = page.getByRole('button', { name: /cây tổ chức|dạng cây|tree view/i }).first();
    if (await treeToggle.count()) {
      await treeToggle.click();
      await page.waitForTimeout(900);
      await shot(page, '04_OrgUnit_Tree');
    } else {
      console.log('  [SKIP] 04_OrgUnit_Tree: không tìm thấy tab/nút tree view');
    }
  }

  console.log('Step 3: Departments');
  await clickMenu(page, 'Phòng ban');
  await page.waitForTimeout(800);
  await shot(page, '05_Department_List');
  const addDeptBtn = page.getByRole('button', { name: /thêm phòng ban|thêm mới|\+ thêm/i }).first();
  if (await addDeptBtn.count()) {
    await addDeptBtn.click();
    await page.waitForTimeout(700);
    await shot(page, '06_Department_Create_Form');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  console.log('Step 4: Positions');
  await clickMenu(page, 'Chức vụ');
  await page.waitForTimeout(800);
  await shot(page, '07_Position_List');

  console.log('Step 5: Employees');
  await clickMenu(page, 'Nhân viên');
  await page.waitForTimeout(800);
  await shot(page, '08_Employee_List');
  const addEmpBtn = page.getByRole('button', { name: /thêm nhân sự|thêm mới|\+ thêm/i }).first();
  if (await addEmpBtn.count()) {
    await addEmpBtn.click();
    await page.waitForTimeout(700);
    await shot(page, '09_Employee_Create_Form');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
  const accountIcon = page.locator('table tbody tr').first()
    .locator('button[title*="tài khoản" i], button[aria-label*="tài khoản" i], [class*="key" i]').first();
  if (await accountIcon.count()) {
    await accountIcon.click();
    await page.waitForTimeout(700);
    await shot(page, '10_Employee_Account');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  } else {
    console.log('  [SKIP] 10_Employee_Account: không tìm thấy icon cấp tài khoản trên dòng đầu tiên');
  }

  console.log('Step 6: Roles & Permission Matrix');
  await clickMenu(page, 'Vai trò & quyền');
  await page.waitForTimeout(800);
  await shot(page, '11_Role_List');
  const addRoleBtn = page.getByRole('button', { name: /thêm vai trò|\+ vai trò|thêm mới/i }).first();
  if (await addRoleBtn.count()) {
    await addRoleBtn.click();
    await page.waitForTimeout(700);
    await shot(page, '13_Role_Create');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  } else {
    console.log('  [SKIP] 13_Role_Create: không tìm thấy nút thêm vai trò');
  }
  await clickMenu(page, 'Ma trận quyền');
  await page.waitForTimeout(1000);
  await shot(page, '12_Role_Matrix');

  console.log('Step 7: User Role Scopes');
  await clickMenu(page, 'Phân quyền người dùng');
  await page.waitForTimeout(800);
  await shot(page, '15_Scope_List');
  const assignScopeBtn = page.getByRole('button', { name: /gán quyền|gán vai trò|\+ thêm|thêm mới/i }).first();
  if (await assignScopeBtn.count()) {
    await assignScopeBtn.click();
    await page.waitForTimeout(700);
    await shot(page, '14_Scope_Assign');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  } else {
    console.log('  [SKIP] 14_Scope_Assign: không tìm thấy nút gán role+scope');
  }

  console.log('Step 8: Org Chart');
  await clickMenu(page, 'Sơ đồ tổ chức');
  await page.waitForTimeout(1200);
  await shot(page, '16_OrgChart_Full');

  console.log('Step 9: Tasks');
  await clickMenu(page, 'Giao việc');
  await page.waitForTimeout(800);
  await shot(page, '18_Task_List');
  const addTaskBtn = page.getByRole('button', { name: /giao việc|thêm mới|\+ giao/i }).first();
  if (await addTaskBtn.count()) {
    await addTaskBtn.click();
    await page.waitForTimeout(700);
    await shot(page, '19_Task_Create_Form');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
  const firstTaskRow = page.locator('table tbody tr').first();
  if (await firstTaskRow.count()) {
    await firstTaskRow.click();
    await page.waitForTimeout(900);
    await shot(page, '22_Task_Detail_Timeline');
  }

  await browser.close();

  console.log(`\n=== DONE: ${shots.length} screenshots saved to ${outDir} ===`);
  console.log(shots.map((s) => `  - ${s}.png`).join('\n'));
}

main().catch((err) => {
  console.error('CAPTURE FAILED:', err);
  process.exit(1);
});
