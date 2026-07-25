/**
 * Capture video evidence cho Branch Management actions
 * Chạy: node scripts/capture-branch-actions-video.mjs
 *
 * Yêu cầu:
 * - Playwright đã install: npm install -D @playwright/test
 * - Backend đang chạy trên https://astrodev.test8.io.vn
 * - Tài khoản test đã được tạo (xem docs/QA_TEST_PLAN_BRANCH_ROW_SCOPE.md)
 */

import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = 'https://astrodev.test8.io.vn';
const ADMIN_EMAIL = '<QA_ADMIN_EMAIL>';
const ADMIN_PASSWORD = 'Cntt@1234';

// Tạo thư mục evidence nếu chưa có
import fs from 'fs';
const evidenceDir = path.join(__dirname, '../docs/evidence/branch-management-actions');
if (!fs.existsSync(evidenceDir)) {
  fs.mkdirSync(evidenceDir, { recursive: true });
}

async function login(page) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
}

async function captureVideo(actionName, captureFn) {
  console.log(`\n🎬 Capturing: ${actionName}...`);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: path.join(evidenceDir, `${actionName}`),
      size: { width: 1920, height: 1080 },
    },
  });

  const page = await context.newPage();

  try {
    await login(page);
    await captureFn(page);
    console.log(`✅ Completed: ${actionName}`);
  } catch (error) {
    console.error(`❌ Failed: ${actionName}`, error.message);
  } finally {
    await context.close();
    await browser.close();

    // Rename video file to meaningful name
    const videoDir = path.join(evidenceDir, actionName);
    const files = fs.readdirSync(videoDir);
    const videoFile = files.find(f => f.endsWith('.webm'));
    if (videoFile) {
      const newName = path.join(evidenceDir, `${actionName}.webm`);
      fs.renameSync(path.join(videoDir, videoFile), newName);
      fs.rmdirSync(videoDir);
      console.log(`   📹 Video saved: ${newName}`);
    }
  }
}

async function main() {
  console.log('🚀 Starting Branch Management video evidence capture...\n');

  // 1. Create Branch
  await captureVideo('01-create-branch', async (page) => {
    await page.goto(`${BASE_URL}/org-units?mode=branch`);
    await page.waitForTimeout(2000);

    // Click "Thêm chi nhánh" button
    await page.click('button:has-text("Thêm chi nhánh")');
    await page.waitForTimeout(1000);

    // Fill form
    await page.fill('input[name="code"]', 'CN-TEST-VIDEO');
    await page.fill('input[name="name"]', 'Chi nhánh Test Video');
    await page.selectOption('select[name="unitType"]', 'chi_nhanh');
    await page.fill('input[name="province"]', 'Thành phố Hà Nội');

    // Submit
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
  });

  // 2. Edit Branch
  await captureVideo('02-edit-branch', async (page) => {
    await page.goto(`${BASE_URL}/org-units?mode=branch`);
    await page.waitForTimeout(2000);

    // Click edit button on first row
    await page.click('table tbody tr:first-child button:has(.anticon-edit)');
    await page.waitForTimeout(1000);

    // Modify name
    const nameInput = await page.locator('input[name="name"]');
    await nameInput.clear();
    await nameInput.fill('Chi nhánh Test Video (Đã sửa)');

    // Submit
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
  });

  // 3. View Detail
  await captureVideo('03-view-detail', async (page) => {
    await page.goto(`${BASE_URL}/org-units?mode=branch`);
    await page.waitForTimeout(2000);

    // Click view button (eye icon)
    await page.click('table tbody tr:first-child button:has(.anticon-eye)');
    await page.waitForTimeout(3000);
  });

  // 4. Deactivate Branch
  await captureVideo('04-deactivate-branch', async (page) => {
    await page.goto(`${BASE_URL}/org-units?mode=branch`);
    await page.waitForTimeout(2000);

    // Click deactivate button
    await page.click('table tbody tr:first-child button:has(.anticon-stop)');
    await page.waitForTimeout(1000);

    // Confirm in modal
    await page.click('button:has-text("Vô hiệu")');
    await page.waitForTimeout(2000);
  });

  // 5. Restore Branch
  await captureVideo('05-restore-branch', async (page) => {
    await page.goto(`${BASE_URL}/org-units?mode=branch&status=inactive`);
    await page.waitForTimeout(2000);

    // Click restore button
    await page.click('table tbody tr:first-child button:has(.anticon-undo)');
    await page.waitForTimeout(1000);

    // Confirm in modal
    await page.click('button:has-text("Khôi phục")');
    await page.waitForTimeout(2000);
  });

  console.log('\n🎉 All videos captured successfully!');
  console.log(`📁 Evidence directory: ${evidenceDir}`);
}

main().catch(console.error);