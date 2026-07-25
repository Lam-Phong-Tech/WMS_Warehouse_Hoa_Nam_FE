/**
 * Setup script cho việc chụp screenshots Tasks module
 * 
 * Script này sẽ:
 * 1. Check dev server có chạy không
 * 2. Check puppeteer đã install chưa
 * 3. Tạo test data (tasks với các trạng thái khác nhau)
 * 4. Hướng dẫn chụp screenshots
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = 'http://localhost:5173';
const OUTPUT_DIR = path.join(__dirname, '..', 'docs', 'evidence', 'tasks');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkDevServer() {
  return new Promise((resolve) => {
    log('\n🔍 Checking dev server...', 'cyan');
    
    const req = http.get(BASE_URL, (res) => {
      if (res.statusCode === 200) {
        log('✅ Dev server is running at ' + BASE_URL, 'green');
        resolve(true);
      } else {
        log('❌ Dev server returned status: ' + res.statusCode, 'red');
        resolve(false);
      }
    });

    req.on('error', () => {
      log('❌ Dev server is not running at ' + BASE_URL, 'red');
      log('   Please start dev server: npm run dev', 'yellow');
      resolve(false);
    });

    req.setTimeout(3000, () => {
      log('❌ Dev server timeout (3s)', 'red');
      req.destroy();
      resolve(false);
    });
  });
}

async function checkPuppeteer() {
  log('\n🔍 Checking puppeteer...', 'cyan');
  
  try {
    // Try to require puppeteer
    const puppeteer = await import('puppeteer');
    log('✅ Puppeteer is installed', 'green');
    return true;
  } catch (error) {
    log('⚠️  Puppeteer is not installed', 'yellow');
    log('   Install with: npm install puppeteer', 'yellow');
    log('   Or use manual screenshot method', 'yellow');
    return false;
  }
}

function createOutputDir() {
  log('\n📁 Creating output directory...', 'cyan');
  
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    log('✅ Created: ' + OUTPUT_DIR, 'green');
  } else {
    log('✅ Directory already exists: ' + OUTPUT_DIR, 'green');
  }
}

function createTestDataGuide() {
  log('\n📋 Test Data Guide', 'cyan');
  log('==================', 'cyan');
  
  log('\nCần tạo các tasks với trạng thái khác nhau:', 'yellow');
  log('1. Task `assigned` - Chưa bắt đầu', 'white');
  log('   Title: "TEST - Assigned Task"', 'white');
  log('   Status: assigned', 'white');
  
  log('\n2. Task `processing` - Đang xử lý', 'white');
  log('   Title: "TEST - Processing Task"', 'white');
  log('   Status: processing', 'white');
  
  log('\n3. Task `pending_approval` - Chờ duyệt', 'white');
  log('   Title: "TEST - Pending Approval Task"', 'white');
  log('   Status: pending_approval', 'white');
  
  log('\n4. Task `completed` - Hoàn thành', 'white');
  log('   Title: "TEST - Completed Task"', 'white');
  log('   Status: completed', 'white');
  
  log('\n5. Task `rejected` - Từ chối', 'white');
  log('   Title: "TEST - Rejected Task"', 'white');
  log('   Status: rejected', 'white');
  
  log('\n6. Task quá hạn - Overdue', 'white');
  log('   Title: "TEST - Overdue Task"', 'white');
  log('   Due date: Trước ngày hôm nay', 'white');
  log('   Status: assigned hoặc processing', 'white');
}

function printScreenshotsChecklist() {
  log('\n📸 Screenshots Checklist', 'cyan');
  log('========================', 'cyan');
  
  const screenshots = [
    { name: '01-empty-state.png', desc: 'Empty state (không có data)' },
    { name: '02-list-with-data.png', desc: 'List có data + filters' },
    { name: '03-loading-state.png', desc: 'Loading state (skeleton)' },
    { name: '04-error-state.png', desc: 'Error state (API lỗi)' },
    { name: '05-overdue-filter.png', desc: 'Overdue tasks filter' },
    { name: '06-create-modal.png', desc: 'Form tạo công việc' },
    { name: '07-create-validation.png', desc: 'Form validation errors' },
    { name: '08-start-task.png', desc: 'Start task action' },
    { name: '09-submit-review.png', desc: 'Submit for review' },
    { name: '10-approve-task.png', desc: 'Approve task' },
    { name: '11-reject-task.png', desc: 'Reject task' },
    { name: '12-cancel-task.png', desc: 'Cancel task' },
    { name: '13-detail-info.png', desc: 'Detail drawer - Info tab' },
    { name: '14-detail-timeline.png', desc: 'Detail drawer - Timeline tab' },
    { name: '15-timeline-component.png', desc: 'Timeline component' }
  ];
  
  log('\nMinimum cần chụp (5-6):', 'yellow');
  screenshots.forEach((s, i) => {
    const marker = i < 6 ? '❌' : '  ';
    log(`${marker} ${s.name} - ${s.desc}`, i < 6 ? 'white' : 'gray');
  });
  
  log('\nLưu vào: ' + OUTPUT_DIR, 'blue');
}

function printManualInstructions() {
  log('\n📝 Hướng dẫn chụp thủ công', 'cyan');
  log('============================', 'cyan');
  
  log('\n1. Mở browser và đăng nhập:', 'yellow');
  log('   - URL: ' + BASE_URL + '/login', 'white');
  log('   - Email: <set QA_ADMIN_EMAIL env var>', 'white');
  log('   - Password: (lấy từ biến môi trường QA_ADMIN_PASSWORD, không in ra đây)', 'white');
  
  log('\n2. Vào trang Tasks:', 'yellow');
  log('   - URL: ' + BASE_URL + '/tasks', 'white');
  
  log('\n3. Chụp screenshots:', 'yellow');
  log('   - Dùng Windows Snipping Tool (Win + Shift + S)', 'white');
  log('   - Hoặc Lightshot', 'white');
  log('   - Hoặc DevTools (F12) → Device Toolbar → Capture screenshot', 'white');
  
  log('\n4. Lưu vào:', 'yellow');
  log('   ' + OUTPUT_DIR, 'white');
  
  log('\n5. Verify:', 'yellow');
  log('   - Rõ nét, không mờ', 'white');
  log('   - Text đọc được', 'white');
  log('   - Đúng state mô tả', 'white');
}

function printNextSteps() {
  log('\n🎯 Next Steps', 'cyan');
  log('==============', 'cyan');
  
  log('\n1. Chụp screenshots (30 phút):', 'yellow');
  log('   - Làm theo checklist ở trên', 'white');
  log('   - Lưu vào docs/evidence/tasks/', 'white');
  
  log('\n2. Cập nhật docs (10 phút):', 'yellow');
  log('   - Edit docs/ALE-82_TASK_AUDIT_REPORT.md', 'white');
  log('   - Đánh dấu P1.1 là completed', 'white');
  
  log('\n3. Test permissions (2 giờ - chờ BE fix):', 'yellow');
  log('   - Chờ BE fix INVALID_ACTIVE_CONTEXT', 'white');
  log('   - Execute test plan trong docs/E2E_TEST_PLAN_TASK_PERMISSIONS.md', 'white');
  
  log('\n4. Finalize (10 phút):', 'yellow');
  log('   - Cập nhật test plan với results', 'white');
  log('   - Commit và push', 'white');
}

async function main() {
  log('🚀 ALE-82 Screenshots Setup', 'cyan');
  log('============================\n', 'cyan');
  
  // Check dev server
  const serverRunning = await checkDevServer();
  
  if (!serverRunning) {
    log('\n⚠️  Please start dev server first: npm run dev', 'yellow');
    log('   Then run this script again\n', 'yellow');
    process.exit(1);
  }
  
  // Check puppeteer
  const hasPuppeteer = await checkPuppeteer();
  
  // Create output directory
  createOutputDir();
  
  // Print guides
  createTestDataGuide();
  printScreenshotsChecklist();
  printManualInstructions();
  printNextSteps();
  
  log('\n✅ Setup complete!', 'green');
  log('\n📚 Documentation:', 'cyan');
  log('   - Main guide: docs/ALE-82_README.md', 'white');
  log('   - Completion: docs/ALE-82_COMPLETION_GUIDE.md', 'white');
  log('   - Test plan: docs/E2E_TEST_PLAN_TASK_PERMISSIONS.md', 'white');
  
  if (hasPuppeteer) {
    log('\n💡 Tip: Run automated capture:', 'cyan');
    log('   node scripts/capture-task-screenshots.mjs', 'white');
  } else {
    log('\n💡 Tip: Install puppeteer for automated capture:', 'cyan');
    log('   npm install puppeteer', 'white');
  }
  
  log('\n');
}

main().catch((error) => {
  log('\n❌ Error: ' + error.message, 'red');
  process.exit(1);
});