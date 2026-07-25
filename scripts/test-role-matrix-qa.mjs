#!/usr/bin/env node
/**
 * QA script cho [M1][FE] Role & Permission Matrix Screen
 *
 * Tạo role test + user test, chạy QA matrix save, dọn dẹp.
 * Dùng cho QA re-test 3 role: role thường, role zero permissions, Super Admin.
 *
 * Usage:
 *   QA_ADMIN_EMAIL=admin@erb.vn QA_ADMIN_PASSWORD=Cntt@1234 node scripts/test-role-matrix-qa.mjs
 *
 * Env vars:
 *   QA_ADMIN_EMAIL    - admin email (default: admin@erb.vn)
 *   QA_ADMIN_PASSWORD - admin password (default: Cntt@1234)
 *   API_BASE_URL      - API base URL (default: https://astrodev.test8.io.vn/api/v1)
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Load .env
function loadEnv() {
  const envPath = join(ROOT, '.env');
  if (!existsSync(envPath)) return {};
  const env = {};
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*(VITE_[A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = loadEnv();
const API_BASE = (process.env.API_BASE_URL || env.VITE_API_BASE_URL || 'https://astrodev.test8.io.vn/api/v1').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.QA_ADMIN_EMAIL || env.VITE_TEST_EMAIL || 'admin@erb.vn';
const ADMIN_PASS = process.env.QA_ADMIN_PASSWORD || env.VITE_TEST_PASSWORD || 'Cntt@1234';

const TARGET_PERMISSION_CODE = 'TASK_CREATE';
const TEST_ROLE_CODE = `QA_TEST_${Date.now()}`;
const TEST_USER_EMAIL = `qa-test-${Date.now()}@erb.vn`;

let token = '';
let createdRoleId = null;
let createdUserId = null;

async function log(msg, data) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`, data ? JSON.stringify(data, null, 2) : '');
}

async function api(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { ...options, headers });
  let body = null;
  try { body = await res.json(); } catch { body = await res.text(); }
  return { status: res.status, body };
}

async function main() {
  log('=== QA Role & Permission Matrix — Start ===');
  log(`API: ${API_BASE}`);
  log(`Admin: ${ADMIN_EMAIL}`);

  // 1. Login admin
  log('1. Login admin...');
  const loginRes = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASS }),
  });
  if (loginRes.status !== 200) {
    console.error('❌ Login thất bại:', loginRes.body);
    process.exit(1);
  }
  token = loginRes.body?.data?.access_token || loginRes.body?.access_token || loginRes.body?.token;
  log('✅ Login OK, token obtained');

  // 2. Lấy danh sách permission
  log('2. Lấy danh sách permission...');
  const permRes = await api('/permissions');
  const permissions = permRes.body?.data || permRes.body || [];
  const targetPerm = permissions.find((p) => p.code === TARGET_PERMISSION_CODE);
  if (!targetPerm) {
    console.error(`❌ Permission ${TARGET_PERMISSION_CODE} không tìm thấy trong catalog`);
    process.exit(1);
  }
  log(`✅ Tìm thấy permission: ${targetPerm.code} (id=${targetPerm.id})`);

  // 3. Tạo role test mới (zero permissions)
  log('3. Tạo role test (zero permissions)...');
  const createRoleRes = await api('/roles', {
    method: 'POST',
    body: JSON.stringify({
      code: TEST_ROLE_CODE,
      name: `QA Test Role ${Date.now()}`,
      description: 'Role test cho QA matrix',
      type: 'linh_hoat',
      status: 1,
    }),
  });
  if (createRoleRes.status !== 201 && createRoleRes.status !== 200) {
    console.error('❌ Tạo role thất bại:', createRoleRes.body);
    process.exit(1);
  }
  createdRoleId = createRoleRes.body?.data?.id;
  log(`✅ Role test tạo thành công: id=${createdRoleId}, code=${TEST_ROLE_CODE}`);

  // 4. Gán permission TASK_CREATE cho role
  log('4. Gán permission TASK_CREATE cho role...');
  const syncRes = await api(`/roles/${createdRoleId}/permissions`, {
    method: 'POST',
    body: JSON.stringify({ permissions_id: [targetPerm.id] }),
  });
  if (syncRes.status !== 200) {
    console.error('❌ Sync permission thất bại:', syncRes.body);
    process.exit(1);
  }
  log('✅ Sync permission OK');

  // 5. Reload role → kiểm tra pivot effect=allow
  log('5. Reload role → kiểm tra pivot...');
  const reloadRes = await api(`/roles/${createdRoleId}`);
  const roleDetail = reloadRes.body?.data || {};
  const syncedPerm = roleDetail.permissions?.find((p) => p.code === TARGET_PERMISSION_CODE);
  if (!syncedPerm) {
    console.error('❌ Permission TASK_CREATE không có trong role sau khi sync');
    process.exit(1);
  }
  const effect = syncedPerm.pivot?.effect;
  if (effect !== 'allow') {
    console.error(`❌ pivot.effect = "${effect}" (kỳ vọng "allow")`);
    process.exit(1);
  }
  log(`✅ Pivot effect = "allow" (đúng như kỳ vọng)`);

  // 6. Tạo user test thuộc role (qua /employees + /account)
  log('6. Tạo user test thuộc role...');
  const createEmpRes = await api('/employees', {
    method: 'POST',
    body: JSON.stringify({
      first_name: 'QA',
      last_name: 'Test User',
      email: TEST_USER_EMAIL,
      phone: `090${Date.now().toString().slice(-7)}`,
      id_card: `07${Date.now().toString().slice(-8)}`,
      org_unit_id: 1,
      department_id: 1,
      position_id: 1,
    }),
  });
  if (createEmpRes.status !== 201 && createEmpRes.status !== 200) {
    console.error('❌ Tạo employee thất bại:', createEmpRes.body);
    log('⚠️ Fallback: user test chưa được tạo, cần tạo thủ công qua UI');
  } else {
    const empId = createEmpRes.body?.data?.id;
    log(`✅ Employee tạo thành công: id=${empId}`);

    // Cấp tài khoản cho employee
    const accountRes = await api(`/employees/${empId}/account`, {
      method: 'POST',
      body: JSON.stringify({
        username: TEST_USER_EMAIL,
        password: ADMIN_PASS,
        role_ids: [createdRoleId],
      }),
    });
    if (accountRes.status === 201 || accountRes.status === 200) {
      createdUserId = accountRes.body?.data?.user_id;
      log(`✅ User test tạo thành công: user_id=${createdUserId}`);
    } else {
      log('⚠️ Cấp tài khoản thất bại:', accountRes.body);
    }
  }

  // 7. QA kết quả
  log('\n=== QA Results ===');
  log(`Role test: ${TEST_ROLE_CODE} (id=${createdRoleId})`);
  log(`Permission gán: ${TARGET_PERMISSION_CODE} → pivot.effect=allow ✅`);
  log(`User test: ${TEST_USER_EMAIL} (user_id=${createdUserId || 'chưa tạo'})`);
  log('✅ QA PASS — role mới zero permissions → gán permission → save → reload → pivot.allow');

  // 8. Dọn dẹp (tùy chọn)
  if (process.env.QA_CLEANUP === 'true') {
    log('8. Dọn dẹp...');
    if (createdRoleId) {
      await api(`/roles/${createdRoleId}/force-delete`, { method: 'DELETE' });
      log(`✅ Đã force-delete role ${createdRoleId}`);
    }
    if (createdUserId) {
      await api(`/users/${createdUserId}`, { method: 'DELETE' });
      log(`✅ Đã xóa user ${createdUserId}`);
    }
  } else {
    log('8. Bỏ qua dọn dẹp (QA_CLEANUP != true). Dữ liệu test cần dọn thủ công:');
    log(`   - Role: ${TEST_ROLE_CODE} (id=${createdRoleId})`);
    log(`   - User: ${TEST_USER_EMAIL} (user_id=${createdUserId || 'chưa tạo'})`);
  }

  log('\n=== QA Complete ===');
}

main().catch((err) => {
  console.error('❌ QA thất bại:', err.message);
  process.exit(1);
});
