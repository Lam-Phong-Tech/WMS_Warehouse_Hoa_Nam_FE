/**
 * Script tự động capture screenshots cho Tasks module
 *
 * Usage:
 * 1. Đảm bảo dev server đang chạy (mặc định http://localhost:5173, override qua SCREENSHOT_BASE_URL)
 * 2. Đăng nhập với tài khoản QA
 * 3. Chạy: node scripts/capture-task-screenshots.mjs
 * 4. Screenshots sẽ được lưu vào docs/evidence/tasks/
 *
 * Lưu ý: token auth chỉ lưu trong memory (không persist), nên navigation
 * sang /tasks phải là client-side (click link sidebar), không được dùng
 * page.goto() sau khi login vì full reload sẽ mất session.
 *
 * Yêu cầu: npm install puppeteer (đã có trong devDependencies)
 */

import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.SCREENSHOT_BASE_URL || 'http://localhost:5173';
const OUTPUT_DIR = path.join(__dirname, '..', 'docs', 'evidence', 'tasks');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function clickByText(page, selector, text, exact = false) {
  const handle = await page.evaluateHandle(
    (sel, txt, ex) => {
      const els = Array.from(document.querySelectorAll(sel));
      return (
        els.find((el) => {
          const t = el.textContent && el.textContent.trim();
          return ex ? t === txt : t && t.includes(txt);
        }) || null
      );
    },
    selector,
    text,
    exact,
  );
  const el = handle.asElement();
  if (el) {
    await el.click();
    return true;
  }
  return false;
}

// Sidebar là antd <Menu> với onClick={navigate(key)} - không có <a href>.
// Điều hướng bằng cách click item "Giao việc" trong menu (client-side, giữ session).
async function gotoSpa(page) {
  await page.waitForSelector('.ant-menu-title-content', { timeout: 10000 });
  const ok = await clickByText(page, '.ant-menu-title-content', 'Giao việc', true);
  if (!ok) {
    throw new Error('Không tìm thấy menu item "Giao việc"');
  }
  await wait(400);
}

async function login(page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
  const emailSel = 'input[placeholder="you@example.com"]';
  const pwSel = 'input[placeholder="••••••••"]';
  await page.waitForSelector(emailSel, { visible: true });
  await page.click(emailSel);
  await page.type(emailSel, process.env.QA_ADMIN_EMAIL ?? (() => { throw new Error('Set QA_ADMIN_EMAIL env var'); })(), { delay: 30 });
  await page.click(pwSel);
  await page.type(pwSel, (process.env.QA_ADMIN_PASSWORD ?? (() => { throw new Error('Set QA_ADMIN_PASSWORD env var'); })()), { delay: 30 });
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {});
  await wait(1500);
}

async function captureScreenshots() {
  console.log('🚀 Starting screenshot capture...', BASE_URL);

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1920, height: 1080 },
  });

  try {
    // --- Session 1: error state (abort request khi vào /tasks lần đầu) ---
    {
      const page = await browser.newPage();
      await login(page);
      await page.setRequestInterception(true);
      const handler = (req) => {
        if (req.url().includes('/tasks') && ['fetch', 'xhr'].includes(req.resourceType())) {
          req.abort('failed');
        } else {
          req.continue();
        }
      };
      page.on('request', handler);
      console.log('📸 Capturing: 04-error-state.png');
      await gotoSpa(page);
      await wait(2000);
      await page.screenshot({ path: path.join(OUTPUT_DIR, '04-error-state.png') });
      console.log('✅ Saved: 04-error-state.png');
      page.off('request', handler);
      await page.close();
    }

    // --- Session 2: loading state (throttle network khi vào /tasks lần đầu) ---
    {
      const page = await browser.newPage();
      await login(page);
      const client = await page.target().createCDPSession();
      await client.send('Network.enable');
      await client.send('Network.emulateNetworkConditions', {
        offline: false,
        downloadThroughput: (200 * 1024) / 8,
        uploadThroughput: (200 * 1024) / 8,
        latency: 400,
      });
      console.log('📸 Capturing: 03-loading-state.png');
      gotoSpa(page).catch(() => {});
      await wait(700);
      await page.screenshot({ path: path.join(OUTPUT_DIR, '03-loading-state.png') });
      console.log('✅ Saved: 03-loading-state.png');
      await client.send('Network.emulateNetworkConditions', {
        offline: false,
        downloadThroughput: -1,
        uploadThroughput: -1,
        latency: 0,
      });
      await page.close();
    }

    // --- Session 3: các state còn lại với data thật ---
    {
      const page = await browser.newPage();
      await login(page);
      await gotoSpa(page);
      await wait(2000);

      console.log('📸 Capturing: 02-list-with-data.png');
      await page.screenshot({ path: path.join(OUTPUT_DIR, '02-list-with-data.png') });
      console.log('✅ Saved: 02-list-with-data.png');

      console.log('📸 Capturing: 13-detail-info.png (task đã qua workflow duyệt)');
      const viewBtn = await page.evaluateHandle(() => {
        const rows = Array.from(document.querySelectorAll('tr.ant-table-row'));
        const row = rows.find((r) => r.textContent.includes('Hoàn thành')) || rows[0];
        return row ? row.querySelector('.anticon-eye') : null;
      });
      const viewBtnEl = viewBtn.asElement();
      if (viewBtnEl) {
        await viewBtnEl.click();
        await wait(1000);
        await page.screenshot({ path: path.join(OUTPUT_DIR, '13-detail-info.png') });
        console.log('✅ Saved: 13-detail-info.png');

        console.log('📸 Capturing: 14-detail-timeline.png');
        await clickByText(page, '.ant-drawer .ant-tabs-tab', 'Lịch sử');
        await wait(800);
        await page.screenshot({ path: path.join(OUTPUT_DIR, '14-detail-timeline.png') });
        console.log('✅ Saved: 14-detail-timeline.png');
        await page.keyboard.press('Escape');
        await wait(500);
      } else {
        console.warn('⚠️ Không có task nào trong danh sách để mở detail drawer');
      }

      console.log('📸 Capturing: 05-overdue-filter.png');
      await clickByText(page, '.ant-select', 'Trạng thái');
      await wait(600);
      await clickByText(page, '.ant-select-item-option', 'Quá hạn', true);
      await wait(1500);
      await page.screenshot({ path: path.join(OUTPUT_DIR, '05-overdue-filter.png') });
      console.log('✅ Saved: 05-overdue-filter.png');

      console.log('📸 Capturing: 06-create-modal.png');
      await clickByText(page, 'button', 'Tạo công việc');
      await wait(1000);
      await page.screenshot({ path: path.join(OUTPUT_DIR, '06-create-modal.png') });
      console.log('✅ Saved: 06-create-modal.png');

      console.log('📸 Capturing: 07-create-validation.png');
      await clickByText(page, '.ant-modal button', 'Tạo công việc');
      await wait(800);
      await page.screenshot({ path: path.join(OUTPUT_DIR, '07-create-validation.png') });
      console.log('✅ Saved: 07-create-validation.png');

      await page.close();
    }

    console.log('\n✅ Screenshot capture completed!');
    console.log(`📁 Output directory: ${OUTPUT_DIR}`);
  } catch (error) {
    console.error('❌ Error during capture:', error);
  } finally {
    await browser.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  captureScreenshots().catch(console.error);
}

export { captureScreenshots };
