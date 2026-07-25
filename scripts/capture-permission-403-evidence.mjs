import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

const EVIDENCE_DIR = path.join(
  process.cwd(),
  'docs/evidence/api-client-error-handling-403',
);
if (!fs.existsSync(EVIDENCE_DIR)) fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

const EMAIL = process.env.QA_NOEMPEDIT_EMAIL;
const PASSWORD = process.env.QA_NOEMPEDIT_PASSWORD;
if (!EMAIL || !PASSWORD) {
  console.error('Missing QA_NOEMPEDIT_EMAIL / QA_NOEMPEDIT_PASSWORD env var.');
  process.exit(1);
}

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on('pageerror', (err) => console.log('[pageerror]', err.message));

  console.log('Navigating to /login...');
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle2' });
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '00-login-form.png') });

  await page.waitForSelector('input[placeholder="you@example.com"]', { timeout: 10000 });
  await page.type('input[placeholder="you@example.com"]', EMAIL, { delay: 20 });
  await page.type('input[type="password"]', PASSWORD, { delay: 20 });

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);

  await new Promise((r) => setTimeout(r, 1500));
  console.log('Current URL after login:', page.url());
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '01-after-login.png'), fullPage: true });

  console.log('Navigating to /roles (user thieu quyen ROLE_VIEW)...');
  await page.goto('http://localhost:5173/roles', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1000));
  console.log('URL after navigating to /roles:', page.url());
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '02-roles-403-nopermission.png'), fullPage: true });

  console.log('Navigating to /employees (user co EMP_VIEW nhung khong co EMP_EDIT)...');
  await page.goto('http://localhost:5173/employees', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '03-employees-list-view-only.png'), fullPage: true });

  try {
    await page.waitForSelector('[title="Thao tác"]', { timeout: 8000 });
    const triggers = await page.$$('[title="Thao tác"]');
    if (triggers.length > 0) {
      await triggers[0].click();
      await new Promise((r) => setTimeout(r, 500));
      await page.screenshot({ path: path.join(EVIDENCE_DIR, '04-employees-action-menu-no-edit.png'), fullPage: true });
    }
  } catch (e) {
    console.log('Khong tim thay action menu:', e.message);
  }

  await browser.close();
  console.log('Done. Evidence saved to', EVIDENCE_DIR);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
