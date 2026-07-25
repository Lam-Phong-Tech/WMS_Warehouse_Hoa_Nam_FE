/**
 * Capture 08-12 screenshots (Task Actions) cho docs/evidence/tasks — dùng
 * role thật (không phải Super Admin), khớp dữ liệu tạo bởi
 * scripts (xem docs/E2E_TASK_PERMISSIONS_EVIDENCE.md để biết bối cảnh).
 *
 * Yêu cầu trước khi chạy: có sẵn file JSON setup (đường dẫn qua env
 * TASK_EVIDENCE_SETUP_JSON) chứa { staff: {email}, manager: {email}, password }
 * và 4 task với title bắt đầu "E2E Evid Start/Approve/Reject/Cancel" ở đúng
 * trạng thái: Start/Cancel = assigned, Approve/Reject = pending_approval.
 */
import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.SCREENSHOT_BASE_URL || 'http://localhost:5173';
const OUTPUT_DIR = path.join(__dirname, '..', 'docs', 'evidence', 'tasks');
const SETUP_PATH = process.env.TASK_EVIDENCE_SETUP_JSON;

if (!SETUP_PATH || !fs.existsSync(SETUP_PATH)) {
  console.error('Missing TASK_EVIDENCE_SETUP_JSON env pointing to setup JSON file');
  process.exit(1);
}
const setup = JSON.parse(fs.readFileSync(SETUP_PATH, 'utf8'));

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

async function gotoSpa(page) {
  await page.waitForSelector('.ant-menu-title-content', { timeout: 10000 });
  const ok = await clickByText(page, '.ant-menu-title-content', 'Giao việc', true);
  if (!ok) throw new Error('Không tìm thấy menu item "Giao việc"');
  await wait(600);
}

async function login(page, email, password) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
  const emailSel = 'input[placeholder="you@example.com"]';
  const pwSel = 'input[placeholder="••••••••"]';
  await page.waitForSelector(emailSel, { visible: true });
  await page.click(emailSel);
  await page.type(emailSel, email, { delay: 20 });
  await page.click(pwSel);
  await page.type(pwSel, password, { delay: 20 });
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {});
  await wait(1500);
}

async function openRowActionDropdown(page, rowTitleSubstring) {
  await page.keyboard.press('Escape').catch(() => {});
  await wait(200);
  const btnHandle = await page.evaluateHandle((titleSub) => {
    const rows = Array.from(document.querySelectorAll('tr.ant-table-row'));
    const row = rows.find((r) => r.textContent.includes(titleSub));
    if (!row) return null;
    const editIcon = row.querySelector('.anticon-edit');
    return editIcon ? editIcon.closest('button') : null;
  }, rowTitleSubstring);
  const btn = btnHandle.asElement();
  if (!btn) throw new Error(`Không tìm thấy dropdown action cho task "${rowTitleSubstring}"`);
  await btn.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await wait(200);
  await btn.click();
  await page.waitForFunction(
    () =>
      Array.from(document.querySelectorAll('.ant-dropdown-menu-item')).some(
        (el) => el.offsetParent !== null,
      ),
    { timeout: 8000 },
  );
  await wait(300);
}

async function clickMenuItem(page, label) {
  await page.waitForFunction(
    (lbl) =>
      Array.from(document.querySelectorAll('.ant-dropdown-menu-item')).some(
        (el) => el.offsetParent !== null && el.textContent && el.textContent.includes(lbl),
      ),
    { timeout: 5000 },
    label,
  );
  const handle = await page.evaluateHandle((lbl) => {
    const els = Array.from(document.querySelectorAll('.ant-dropdown-menu-item'));
    return els.find((el) => el.offsetParent !== null && el.textContent.includes(lbl)) || null;
  }, label);
  const el = handle.asElement();
  if (!el) throw new Error(`Không tìm thấy menu item "${label}"`);
  await el.click();
  await wait(800);
}

async function run() {
  console.log('🚀 Capturing Task Action screenshots (08-12)...', BASE_URL);
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1920, height: 1080 },
  });

  try {
    // ===== Session Admin: Start (08) + Submit (09) + Cancel modal (12) =====
    // Dùng task assign trực tiếp cho chính admin (assignee_id=1) vì menu
    // "Giao việc" yêu cầu permission TASK_VIEW — permission này chưa được
    // BE seed vào catalog (xem docs/E2E_TASK_PERMISSIONS_EVIDENCE.md mục 1),
    // nên chỉ Super Admin (bypass RBAC) mới truy cập được trang. Business
    // rule thật (assignee/approver theo role) đã có evidence riêng qua API
    // thật ở docs/E2E_TASK_PERMISSIONS_EVIDENCE.md — ảnh ở đây chỉ chứng
    // minh UI/modal của 5 action thực thi đúng, không lặp lại P1.1.
    {
      const page = await browser.newPage();
      await login(page, setup.admin.email, setup.admin.password);
      await gotoSpa(page);
      await wait(1500);

      console.log('📸 08-start-task.png (Bắt đầu)');
      await openRowActionDropdown(page, 'E2E Evid Admin Start6');
      await clickMenuItem(page, 'Bắt đầu');
      await wait(1200); // toast + row status update
      await page.screenshot({ path: path.join(OUTPUT_DIR, '08-start-task.png') });
      console.log('✅ Saved 08-start-task.png');

      console.log('📸 12-cancel-task.png (Hủy)');
      await openRowActionDropdown(page, 'E2E Evid Admin Cancel');
      await clickMenuItem(page, 'Hủy');
      await wait(600);
      await page.type('.ant-modal textarea', 'Không còn cần thiết do trùng công việc khác', {
        delay: 15,
      });
      await wait(300);
      await page.screenshot({ path: path.join(OUTPUT_DIR, '12-cancel-task.png') });
      console.log('✅ Saved 12-cancel-task.png');
      await clickByText(page, '.ant-modal button', 'Xác nhận hủy', true);
      await wait(1000);

      console.log('📸 09-submit-review.png (Gửi duyệt, task vừa Bắt đầu ở trên)');
      await openRowActionDropdown(page, 'E2E Evid Admin Start');
      await clickMenuItem(page, 'Gửi duyệt');
      await wait(1200);
      await page.screenshot({ path: path.join(OUTPUT_DIR, '09-submit-review.png') });
      console.log('✅ Saved 09-submit-review.png');

      console.log('📸 10-approve-task.png (Duyệt)');
      await openRowActionDropdown(page, 'E2E Evid Admin Approve2');
      await clickMenuItem(page, 'Duyệt');
      await wait(600);
      await page.screenshot({ path: path.join(OUTPUT_DIR, '10-approve-task.png') });
      console.log('✅ Saved 10-approve-task.png');
      await clickByText(page, '.ant-modal-confirm-btns button', 'Duyệt', true);
      await wait(1000);

      console.log('📸 11-reject-task.png (Từ chối)');
      await openRowActionDropdown(page, 'E2E Evid Admin Reject2');
      await clickMenuItem(page, 'Từ chối');
      await wait(600);
      await page.type(
        '.ant-modal textarea',
        'Báo cáo thiếu phụ lục chi tiết, cần bổ sung số liệu trước khi duyệt lại',
        { delay: 12 },
      );
      await wait(300);
      await page.screenshot({ path: path.join(OUTPUT_DIR, '11-reject-task.png') });
      console.log('✅ Saved 11-reject-task.png');
      await clickByText(page, '.ant-modal button', 'Từ chối', true);
      await wait(1000);

      await page.close();
    }

    console.log('\n✅ Done. Output:', OUTPUT_DIR);
  } catch (err) {
    console.error('❌ Error:', err);
    const pages = await browser.pages();
    const last = pages[pages.length - 1];
    if (last) {
      await last.screenshot({ path: path.join(OUTPUT_DIR, '_debug-error.png') }).catch(() => {});
    }
    throw err;
  } finally {
    await browser.close();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
