import { chromium } from 'playwright';

const BASE = 'http://localhost:5175';
const OUT = 'c:/LAM_PHONG/ERP-Frontend/docs/evidence/positions';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (msg) => {
  if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text());
});

async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log('shot:', name);
}

// --- Login ---
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1000);

const emailInput = page.locator('input[type="email"], input[name="email"]').first();
await emailInput.waitFor({ timeout: 15000 });
await emailInput.fill(process.env.QA_ADMIN_EMAIL ?? (() => { throw new Error('Set QA_ADMIN_EMAIL env var'); })());
const pwInput = page.locator('input[type="password"], input[name="password"]').first();
await pwInput.fill((process.env.QA_ADMIN_PASSWORD ?? (() => { throw new Error('Set QA_ADMIN_PASSWORD env var'); })()));
await shot('00-login-form');

await page.locator('button[type="submit"]').first().click();
await page.waitForTimeout(2500);
console.log('URL after login:', page.url());

// --- Navigate to Positions via sidebar menu (avoid full reload auth race) ---
const posMenu = page.getByText('Chức vụ', { exact: true }).first();
await posMenu.waitFor({ timeout: 10000 }).catch(() => {});
if (await posMenu.count()) {
  await posMenu.click({ force: true });
} else {
  await page.goto(`${BASE}/positions`, { waitUntil: 'domcontentloaded' });
}
await page.waitForTimeout(2000);
console.log('URL positions:', page.url());
await shot('01-positions-list');

// --- Create modal: open + validation error ---
const addBtn = page.locator('button:has-text("Thêm chức vụ")').first();
if (await addBtn.count()) {
  await addBtn.click();
  await page.waitForTimeout(700);
  await shot('02-create-modal-empty');

  const okBtn = page
    .locator(
      '.ant-modal button:has-text("Lưu"), .ant-modal button:has-text("Tạo"), .ant-drawer button:has-text("Lưu")',
    )
    .first();
  if (await okBtn.count()) {
    await okBtn.click();
    await page.waitForTimeout(600);
    await shot('03-create-validation-error');
  }

  // Fill valid data (unique code by timestamp to avoid duplicate-code 422)
  const stamp = Date.now().toString().slice(-6);
  const codeInput = page.locator('.ant-modal input[placeholder*="GD"]').first();
  const nameInput = page.locator('.ant-modal input[placeholder*="Giám đốc"]').first();
  const gradeInput = page.locator('.ant-modal input[placeholder*="L1"]').first();
  if (await codeInput.count()) await codeInput.fill(`EVD${stamp}`);
  if (await nameInput.count()) await nameInput.fill(`Evidence Test ${stamp}`);
  if (await gradeInput.count()) await gradeInput.fill('C9');
  await shot('04-create-form-filled');

  if (await okBtn.count()) {
    await okBtn.click();
    await page.waitForTimeout(1500);
    await shot('05-after-create-success');
  }
}

// --- Open row action dropdown (edit / delete) on the row we just created ---
const targetRow = page.locator('tr', { hasText: 'EVD' }).first();
const firstDropdownTrigger = targetRow.locator('button').last();
console.log('targetRow count:', await targetRow.count(), 'buttons in row:', await targetRow.locator('button').count());
if (await firstDropdownTrigger.count()) {
  await firstDropdownTrigger.click();
  await page.waitForTimeout(500);
  await shot('06-row-actions-dropdown');

  const editItem = page.locator('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("Sửa")').first();
  if (await editItem.count()) {
    await editItem.click();
    await page.waitForTimeout(800);
    await shot('07-edit-modal');

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const cancelBtn = page.locator('.ant-modal-wrap:visible button:has-text("Hủy")').first();
    if (await cancelBtn.count()) await cancelBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
    await page.locator('.ant-modal-wrap').first().waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
  }
}

// --- Inactive flow: open dropdown again, click Xóa, capture confirm dialog (employeeCount warning) ---
if (await firstDropdownTrigger.count()) {
  await page.mouse.move(10, 10);
  await page.waitForTimeout(300);
  await firstDropdownTrigger.click();
  await page.waitForTimeout(600);
  await shot('07b-dropdown-reopened-debug');
  const deleteItem = page.locator('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("Xóa")').first();
  console.log('deleteItem count:', await deleteItem.count());
  if (await deleteItem.count()) {
    await deleteItem.click();
    await page.waitForTimeout(600);
    await shot('08-inactive-confirm-dialog-no-employees');

    // Confirm the delete for real on our own test row (employeeCount=0, safe)
    const confirmOk = page.locator('.ant-modal-confirm button:has-text("Xóa")').first();
    if (await confirmOk.count()) await confirmOk.click();
    await page.waitForTimeout(1200);
    await shot('08b-after-inactive-success');
  }
}

// --- employeeCount > 0 warning variant: open dropdown on a seeded row that has staff ---
const staffedRow = page.locator('tr', { hasText: 'Trưởng Phòng' }).first();
const staffedTrigger = staffedRow.locator('button').last();
if (await staffedTrigger.count()) {
  await staffedTrigger.click();
  await page.waitForTimeout(500);
  const deleteItem2 = page
    .locator('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("Xóa")')
    .first();
  if (await deleteItem2.count()) {
    await deleteItem2.click();
    await page.waitForTimeout(600);
    await shot('09-inactive-confirm-dialog-with-employees');

    const confirmCancel = page.locator('.ant-modal-confirm button:has-text("Hủy")').first();
    if (await confirmCancel.count()) await confirmCancel.click();
    await page.waitForTimeout(400);
  }
}

// --- Filter by Vô hiệu to show restore flow (our just-deleted test row shows up here) ---
const statusFilter = page.getByText('Trạng thái: Tất cả', { exact: true }).first();
console.log('statusFilter count:', await statusFilter.count());
if (await statusFilter.count()) {
  await statusFilter.click({ force: true });
  await page.waitForTimeout(400);
  const inactiveOption = page.locator('.ant-select-item:has-text("Vô hiệu")').first();
  if (await inactiveOption.count()) {
    await inactiveOption.click();
    await page.waitForTimeout(1500);
    await shot('10-inactive-list-view');

    const restoreTrigger = page.locator('tr', { hasText: 'EVD' }).first().locator('button').last();
    if (await restoreTrigger.count()) {
      await restoreTrigger.click();
      await page.waitForTimeout(500);
      await shot('11-row-actions-restore-dropdown');

      const restoreItem = page
        .locator('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:has-text("Khôi phục")')
        .first();
      if (await restoreItem.count()) {
        await restoreItem.click();
        await page.waitForTimeout(1200);
        await shot('12-after-restore-success');
      }
    }
  }
}

await browser.close();
console.log('DONE');
