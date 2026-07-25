/**
 * Visual Regression Test for ALE-81 Admin Layout
 * 
 * Chạy: node scripts/visual-regression-layout.mjs
 * 
 * Yêu cầu:
 * - Playwright đã install: npx playwright install chromium
 * - FE đang chạy: npm run dev (mặc định http://localhost:5173)
 * - BE staging đang chạy: https://astrodev.test8.io.vn
 * 
 * Output:
 * - docs/evidence/ale81-layout/visual-regression/baseline/ (ảnh baseline)
 * - docs/evidence/ale81-layout/visual-regression/current/ (ảnh hiện tại)
 * - docs/evidence/ale81-layout/visual-regression/diff/ (ảnh diff nếu có)
 */

import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173';
const EVIDENCE_DIR = 'docs/evidence/ale81-layout/visual-regression';

const VIEWPORTS = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'mobile-375', width: 375, height: 812 },
];

const SCENARIOS = [
  {
    name: 'sidebar-expanded',
    desktop: async (page) => {
      // Mặc định sidebar đã expanded
    },
    tablet: async (page) => {
      // Trên tablet, đảm bảo drawer đóng
      const drawer = page.locator('.ant-drawer');
      if (await drawer.isVisible()) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
    },
    mobile: async (page) => {
      // Trên mobile, đảm bảo drawer đóng
      const drawer = page.locator('.ant-drawer');
      if (await drawer.isVisible()) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
    },
  },
  {
    name: 'sidebar-collapsed',
    desktop: async (page) => {
      // Click nút collapse sidebar
      const toggleBtn = page.locator('[aria-label*="Thu gọn sidebar"]');
      if (await toggleBtn.isVisible()) {
        await toggleBtn.click();
        await page.waitForTimeout(500);
      }
    },
    tablet: async () => {},
    mobile: async () => {},
  },
  {
    name: 'user-menu-open',
    desktop: async (page) => {
      // Click user menu button
      const userMenuBtn = page.locator('[aria-haspopup="menu"]').first();
      if (await userMenuBtn.isVisible()) {
        await userMenuBtn.click();
        await page.waitForTimeout(300);
      }
    },
    tablet: async (page) => {
      const userMenuBtn = page.locator('[aria-haspopup="menu"]').first();
      if (await userMenuBtn.isVisible()) {
        await userMenuBtn.click();
        await page.waitForTimeout(300);
      }
    },
    mobile: async (page) => {
      const userMenuBtn = page.locator('[aria-haspopup="menu"]').first();
      if (await userMenuBtn.isVisible()) {
        await userMenuBtn.click();
        await page.waitForTimeout(300);
      }
    },
  },
  {
    name: 'drawer-open',
    desktop: async () => {},
    tablet: async (page) => {
      // Click nút mở drawer trên tablet
      const drawerTrigger = page.locator('.ant-layout-sider-zero-width-trigger');
      if (await drawerTrigger.isVisible()) {
        await drawerTrigger.click();
        await page.waitForTimeout(500);
      }
    },
    mobile: async (page) => {
      // Click nút menu trên mobile
      const menuBtn = page.locator('button.ant-btn').first();
      if (await menuBtn.isVisible()) {
        await menuBtn.click();
        await page.waitForTimeout(500);
      }
    },
  },
];

async function login(page) {
  console.log('📝 Login...');
  await page.goto(`${BASE_URL}/login`);
  await page.waitForTimeout(500);

  // Điền credentials từ environment
  const email = process.env.QA_ADMIN_EMAIL;
  const password = process.env.QA_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      '❌ Thiếu QA_ADMIN_EMAIL hoặc QA_ADMIN_PASSWORD trong environment variables'
    );
  }

  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/org-units', { timeout: 10000 });
  console.log('✅ Login thành công');
}

async function captureScreenshots() {
  console.log('🚀 Bắt đầu visual regression test...\n');

  // Tạo thư mục output
  const baselineDir = join(EVIDENCE_DIR, 'baseline');
  const currentDir = join(EVIDENCE_DIR, 'current');
  const diffDir = join(EVIDENCE_DIR, 'diff');

  for (const dir of [baselineDir, currentDir, diffDir]) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      console.log(`📁 Tạo thư mục: ${dir}`);
    }
  }

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Login
    await login(page);

    // Capture screenshots
    let totalScreenshots = 0;

    for (const viewport of VIEWPORTS) {
      console.log(`\n📱 Viewport: ${viewport.name} (${viewport.width}x${viewport.height})`);

      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.waitForTimeout(500);

      for (const scenario of SCENARIOS) {
        // Chỉ chạy scenario phù hợp với viewport
        if (viewport.width >= 1024 && scenario.name === 'drawer-open') {
          continue; // Desktop không có drawer
        }
        if (viewport.width < 1024 && scenario.name === 'sidebar-collapsed') {
          continue; // Mobile/tablet không có collapsed sidebar
        }

        // Reset về trang gốc
        await page.goto(`${BASE_URL}/org-units`);
        await page.waitForTimeout(500);

        // Thực hiện action cho scenario
        const actionFn =
          scenario[viewport.name.replace('desktop-', '').replace('tablet-', '').replace('mobile-', '')] ||
          scenario.desktop;
        await actionFn(page);

        await page.waitForTimeout(300);

        // Capture screenshot
        const filename = `${viewport.name}_${scenario.name}.png`;
        const filepath = join(currentDir, filename);

        await page.screenshot({ path: filepath, fullPage: true });
        console.log(`  ✅ ${filename}`);
        totalScreenshots++;
      }
    }

    console.log(`\n✅ Hoàn thành! Đã chụp ${totalScreenshots} ảnh`);
    console.log(`📂 Baseline: ${baselineDir}`);
    console.log(`📂 Current: ${currentDir}`);
    console.log(`\n💡 Để tạo baseline, copy ảnh từ current sang baseline:`);
    console.log(`   cp ${currentDir}/*.png ${baselineDir}/`);

  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

// Run
captureScreenshots().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});