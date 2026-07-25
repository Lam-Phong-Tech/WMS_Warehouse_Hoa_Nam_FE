// P0.2 — Evidence QA/network log cho 3 màn bắt buộc của task
// "[Cross][FE] Chuẩn hóa Table/List Pattern cho ERP": Employees, Departments,
// Org Units. Chụp ảnh MỖI thao tác filter/sort/page/page size + ghi lại network
// request thật (URL kèm query params) gửi lên BE, để QA có bằng chứng filter
// nào chạy server-side (query param) và filter nào chạy client-side.
//
// Usage: SCREENSHOT_LOGIN_EMAIL=xxx SCREENSHOT_LOGIN_PASSWORD=xxx \
//   node scripts/capture-table-pattern-qa-evidence.mjs [baseUrl]

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const baseUrl = process.argv[2] || 'http://localhost:5175';
const outDir = path.resolve('docs/evidence/table-pattern-qa');
mkdirSync(outDir, { recursive: true });

const LOGIN_EMAIL = process.env.SCREENSHOT_LOGIN_EMAIL;
const LOGIN_PASSWORD = process.env.SCREENSHOT_LOGIN_PASSWORD;
if (!LOGIN_EMAIL || !LOGIN_PASSWORD) {
  console.error(
    'Thiếu biến môi trường SCREENSHOT_LOGIN_EMAIL / SCREENSHOT_LOGIN_PASSWORD.',
  );
  process.exit(1);
}

const networkLog = [];
let currentLabel = '';

function trackNetwork(page) {
  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('astrodev.test8.io.vn/api') && req.method() === 'GET') {
      networkLog.push({ time: new Date().toISOString(), label: currentLabel, url });
    }
  });
}

function mark(label) {
  currentLabel = label;
}

async function shot(page, name) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  [OK] ${name}.png`);
}

async function login(page) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await page
    .locator('input[type="email"], input[name="email"]')
    .first()
    .fill(LOGIN_EMAIL);
  await page
    .locator('input[type="password"], input[name="password"]')
    .first()
    .fill(LOGIN_PASSWORD);
  await page
    .getByRole('button', { name: /đăng nhập/i })
    .first()
    .click();
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

async function selectFirstNonAll(page, selectIndex) {
  const combos = page.locator('.ant-select');
  await combos.nth(selectIndex).click();
  await page.waitForTimeout(300);
  const option = page
    .locator('.ant-select-item-option')
    .filter({ hasNotText: /Tất cả/ })
    .first();
  if (await option.isVisible().catch(() => false)) {
    await option.click();
    await page.waitForTimeout(900);
  } else {
    await page.keyboard.press('Escape');
  }
}

async function clickColumnSort(page, columnText) {
  const header = page.locator('.ant-table-column-sorters', {
    hasText: columnText,
  });
  if (await header.first().isVisible().catch(() => false)) {
    await header.first().click();
    await page.waitForTimeout(900);
  }
}

async function changePageSize(page) {
  const sizeChanger = page.locator('.ant-pagination-options-size-changer');
  if (await sizeChanger.isVisible().catch(() => false)) {
    await sizeChanger.click();
    await page.waitForTimeout(300);
    const option = page.locator('.ant-select-item-option').last();
    await option.click();
    await page.waitForTimeout(900);
  }
}

async function captureEmployees(browser) {
  console.log('\n=== Employees ===');
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();
  trackNetwork(page);
  await login(page);
  mark('employees:initial');
  await gotoRoute(page, '/employees');
  await shot(page, '01_employees_list');

  mark('employees:keyword');
  const keywordInput = page.getByPlaceholder(/Tìm tên, mã, email/i);
  await keywordInput.fill('a');
  await page.waitForTimeout(900);
  await shot(page, '02_employees_keyword');

  await keywordInput.fill('');
  await page.waitForTimeout(900);

  mark('employees:org_filter');
  await selectFirstNonAll(page, 0); // org
  await shot(page, '03_employees_org_filter');
  mark('employees:department_filter');
  await selectFirstNonAll(page, 1); // department
  await shot(page, '04_employees_department_filter');
  mark('employees:position_filter');
  await selectFirstNonAll(page, 2); // position
  await shot(page, '05_employees_position_filter');
  mark('employees:employee_status_filter');
  await selectFirstNonAll(page, 3); // employee status
  await shot(page, '06_employees_status_filter');
  mark('employees:account_status_filter');
  await selectFirstNonAll(page, 4); // account status
  await shot(page, '07_employees_account_status_filter');

  mark('employees:sort');
  await clickColumnSort(page, 'Họ tên');
  await shot(page, '08_employees_sort');

  mark('employees:page2');
  const page2 = page.locator('.ant-pagination-item-2');
  if (await page2.isVisible().catch(() => false)) {
    await page2.click();
    await page.waitForTimeout(900);
    await shot(page, '09_employees_page2');
  }

  mark('employees:page_size');
  await changePageSize(page);
  await shot(page, '10_employees_page_size');

  await context.close();
}

async function captureDepartments(browser) {
  console.log('\n=== Departments ===');
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();
  trackNetwork(page);
  await login(page);
  mark('departments:initial');
  await gotoRoute(page, '/departments');
  await shot(page, '11_departments_list');

  mark('departments:keyword');
  const keywordInput = page.getByPlaceholder(/Tìm theo mã, tên/i);
  await keywordInput.fill('a');
  await page.waitForTimeout(900);
  await shot(page, '12_departments_keyword');
  await keywordInput.fill('');
  await page.waitForTimeout(900);

  mark('departments:org_filter');
  await selectFirstNonAll(page, 0); // org
  await shot(page, '13_departments_org_filter');
  mark('departments:status_filter');
  await selectFirstNonAll(page, 1); // status
  await shot(page, '14_departments_status_filter');

  mark('departments:sort');
  await clickColumnSort(page, 'Tên');
  await shot(page, '15_departments_sort');

  mark('departments:page2');
  const page2 = page.locator('.ant-pagination-item-2');
  if (await page2.isVisible().catch(() => false)) {
    await page2.click();
    await page.waitForTimeout(900);
    await shot(page, '16_departments_page2');
  }

  mark('departments:page_size');
  await changePageSize(page);
  await shot(page, '17_departments_page_size');

  await context.close();
}

async function captureOrgUnits(browser) {
  console.log('\n=== Org Units ===');
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();
  trackNetwork(page);
  await login(page);
  mark('org_units:tree_initial');
  await gotoRoute(page, '/org-units');
  await shot(page, '18_org_units_tree');

  mark('org_units:table_view');
  await page.getByText('Danh sách').click();
  await page.waitForTimeout(900);
  await shot(page, '19_org_units_table');

  mark('org_units:keyword');
  const keywordInput = page.getByPlaceholder(/Tìm theo tên, mã/i);
  await keywordInput.fill('a');
  await page.waitForTimeout(900);
  await shot(page, '20_org_units_keyword');
  mark('org_units:filtered_empty_state');
  await keywordInput.fill('không tồn tại đơn vị nào khớp xyz123');
  await page.waitForTimeout(900);
  await shot(page, '21_org_units_filtered_empty_state');
  await keywordInput.fill('');
  await page.waitForTimeout(900);

  mark('org_units:unit_type_filter');
  await selectFirstNonAll(page, 1); // loại đơn vị (index 0 là công ty cha)
  await shot(page, '22_org_units_unit_type_filter');
  mark('org_units:province_filter');
  await selectFirstNonAll(page, 2); // tỉnh/thành
  await shot(page, '23_org_units_province_filter');
  mark('org_units:status_filter');
  await selectFirstNonAll(page, 3); // trạng thái
  await shot(page, '24_org_units_status_filter');
  mark('org_units:company_filter');
  await selectFirstNonAll(page, 0); // công ty cha
  await shot(page, '25_org_units_company_filter');

  mark('org_units:sort');
  await clickColumnSort(page, 'Tên đơn vị');
  await shot(page, '26_org_units_sort');

  mark('org_units:page_size');
  try {
    await changePageSize(page);
    await shot(page, '27_org_units_page_size');
  } catch (err) {
    console.warn(`  [SKIP] page_size cho Org Units: ${err.message.split('\n')[0]}`);
  }

  await context.close();
}

async function main() {
  const browser = await chromium.launch();
  console.log(`=== Base URL: ${baseUrl} ===`);

  await captureEmployees(browser);
  await captureDepartments(browser);
  await captureOrgUnits(browser);

  await browser.close();

  const logFile = path.join(outDir, 'network-log.json');
  writeFileSync(logFile, JSON.stringify(networkLog, null, 2), 'utf-8');
  console.log(`\n[OK] Network log: ${logFile} (${networkLog.length} requests)`);
  console.log('\n=== DONE ===');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
