// Script test thực tế API org_units (chức năng Company/Legal Entity) trên BE production.
//
// Khác với phiên bản cũ: script này ASSERT thật (throw + process.exit(1) khi có bước sai kỳ
// vọng) thay vì chỉ console.log status/body — nếu không thì script "xanh" ngay cả khi API trả
// lỗi, không có giá trị nghiệm thu.
//
// Toàn bộ update/inactive/restore chạy trên record TỰ TẠO trong lần chạy này (không đụng vào
// dữ liệu production có sẵn như id=1 "Tổng Công Ty ERB" — bản cũ của script này mutate thẳng
// record đó, rất rủi ro nếu chạy nhầm môi trường).
//
// Usage: node scripts/test-companies-api.mjs

import https from 'https';

const BASE = process.env.API_BASE_URL || (() => { throw new Error('API_BASE_URL env var required'); })();

let passCount = 0;
let failCount = 0;
const failures = [];

function assert(condition, message) {
  if (condition) {
    passCount++;
    console.log(`  [PASS] ${message}`);
  } else {
    failCount++;
    failures.push(message);
    console.log(`  [FAIL] ${message}`);
  }
}

function fetch(method, path, body = null, token = '') {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const opts = {
      method,
      hostname: url.hostname,
      path: url.pathname + url.search,
      port: 443,
      headers: { 'Content-Type': 'application/json' },
    };
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data.substring(0, 500) });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // 1. Login
  console.log('=== LOGIN ===');
  const login = await fetch('POST', '/auth/login', { email: process.env.QA_ADMIN_EMAIL ?? (() => { throw new Error('Set QA_ADMIN_EMAIL env var'); })(), password: (process.env.QA_ADMIN_PASSWORD ?? (() => { throw new Error('Set QA_ADMIN_PASSWORD env var'); })()) });
  assert(login.status === 200, `POST /auth/login → 200 (got ${login.status})`);
  const token = login.body?.data?.access_token;
  assert(typeof token === 'string' && token.length > 0, 'login response has data.access_token');
  if (!token) {
    console.error('Không có token, dừng test.');
    process.exit(1);
  }
  console.log('');

  // 2. List
  console.log('=== GET /org_units?page=1&limit=5 ===');
  const list = await fetch('GET', '/org_units?page=1&limit=5', null, token);
  assert(list.status === 200, `GET /org_units → 200 (got ${list.status})`);
  assert(Array.isArray(list.body?.data), 'list response data is an array');
  console.log('');

  // 3. Create — payload đầy đủ, bao gồm `address` (BE validation bắt buộc, xem org_units.md)
  console.log('=== POST /org_units (create) ===');
  const uniqueSuffix = Date.now().toString().slice(-6);
  // unit_type: 'cong_ty_me' — tạo dưới parent_id có sẵn (cong_ty_con/chi_nhanh) bị BE trả 403
  // "Bạn không có quyền thao tác trên đơn vị tổ chức cha này" cho tài khoản QA trong
  // môi trường test này: JWT của admin chỉ có 1 context sẵn (scope_type=phong_ban,
  // department_id=4, org_unit_id=null) nên tự động nhúng context đó vào JWT (theo đúng luồng mô
  // tả ở docs/INVALID_ACTIVE_CONTEXT_ANALYSIS.md) — context này KHÔNG có org_unit scope nên mọi
  // thao tác cần kiểm tra quyền theo org_unit cha cụ thể đều bị từ chối. Tạo 'cong_ty_me' (không
  // có cha) né được check này.
  const createPayload = {
    name: 'Test Công ty ' + uniqueSuffix,
    code: 'TEST-' + uniqueSuffix,
    unit_type: 'cong_ty_me',
    address: 'Số 1 Đường Test, Test API Script',
    tax_code: null,
    status: 1,
  };
  const create = await fetch('POST', '/org_units', createPayload, token);
  assert(create.status === 201, `POST /org_units → 201 (got ${create.status}, body: ${JSON.stringify(create.body).slice(0, 300)})`);
  const createdId = create.body?.data?.id;
  assert(typeof createdId === 'number', 'create response data.id is a number');
  assert(create.body?.data?.address === createPayload.address, 'create response address matches submitted address');
  console.log('');

  if (!createdId) {
    console.error('Không tạo được record test, dừng các bước phụ thuộc id.');
    printSummary();
    process.exit(1);
  }

  // 3b. Create với payload thiếu `address` (bắt buộc) — kỳ vọng 422 VALIDATION_FAILED
  console.log('=== POST /org_units (create, thiếu address) ===');
  const invalidPayload = {
    name: 'Test Công ty thiếu address ' + uniqueSuffix,
    code: 'TEST-INVALID-' + uniqueSuffix,
    unit_type: 'cong_ty_me',
    status: 1,
  };
  const invalidCreate = await fetch('POST', '/org_units', invalidPayload, token);
  assert(invalidCreate.status === 422, `POST /org_units (thiếu address) → 422 (got ${invalidCreate.status})`);
  assert(
    invalidCreate.body?.error_code === 'VALIDATION_FAILED',
    `error_code === VALIDATION_FAILED (got ${invalidCreate.body?.error_code})`,
  );
  assert(
    Array.isArray(invalidCreate.body?.errors?.address),
    'errors.address chứa message validation cho field address',
  );
  console.log('');

  // 4. Detail của record vừa tạo
  console.log(`=== GET /org_units/${createdId} ===`);
  const detail = await fetch('GET', `/org_units/${createdId}`, null, token);
  assert(detail.status === 200, `GET /org_units/${createdId} → 200 (got ${detail.status})`);
  assert(detail.body?.data?.id === createdId, 'detail response id matches created id');
  console.log('');

  // 5. Update (PUT) — record tự tạo, không đụng dữ liệu production.
  // LƯU Ý: bước này đã tái hiện (2026-07-12, xác minh 2 lần) một lỗi thật trên BE:
  // PUT /org_units/{id} trả 404 "Không tìm thấy đơn vị tổ chức" cho record 'cong_ty_me' vừa
  // tạo, dù GET /org_units/{id} ngay trước đó trả 200 cho đúng id này. Nghi vấn: mỗi
  // 'cong_ty_me' mới tạo tự sinh tenant_id riêng (= chính id vừa tạo), còn active context của
  // token admin lại không có org_unit/tenant scope (xem comment ở bước tạo phía trên) — PUT có
  // thể đang lọc theo tenant của active context nên không thấy record ở tenant khác, còn GET
  // thì không lọc theo tenant. Đây là bug/limitation ở BE hoặc ở seed data môi trường test, cần
  // BE xác nhận — xem `docs/tickets/BE_COMPANY_API_FIX_TICKET.md` mục "Vấn đề 7". Assertion vẫn
  // giữ nguyên (không che giấu lỗi) vì đây chính là giá trị của bộ test: bắt được vấn đề thật.
  console.log(`=== PUT /org_units/${createdId} (update) ===`);
  const updatePayload = {
    name: 'Test Công ty (Updated) ' + uniqueSuffix,
    code: createPayload.code,
    unit_type: 'cong_ty_me',
    address: createPayload.address,
    status: 1,
  };
  const update = await fetch('PUT', `/org_units/${createdId}`, updatePayload, token);
  assert(update.status === 200, `PUT /org_units/${createdId} → 200 (got ${update.status}, body: ${JSON.stringify(update.body).slice(0, 300)})`);
  assert(update.body?.data?.name === updatePayload.name, 'update response name reflects the change');
  console.log('');

  // 6. Inactive — FE dùng DELETE /soft-delete (KHÔNG PHẢI PATCH /status, xem org_units.md mục 4)
  console.log(`=== DELETE /org_units/${createdId}/soft-delete (inactive) ===`);
  const inactive = await fetch('DELETE', `/org_units/${createdId}/soft-delete`, null, token);
  assert([200, 204].includes(inactive.status), `DELETE /org_units/${createdId}/soft-delete → 200/204 (got ${inactive.status})`);
  console.log('');

  // 7. Restore — phải thành công vì soft-delete (không phải PATCH /status) đã set deleted_at đúng
  console.log(`=== PATCH /org_units/${createdId}/restore ===`);
  const restore = await fetch('PATCH', `/org_units/${createdId}/restore`, null, token);
  assert(restore.status === 200, `PATCH /org_units/${createdId}/restore → 200 (got ${restore.status}, body: ${JSON.stringify(restore.body).slice(0, 300)})`);
  console.log('');

  // 8. Tree
  console.log('=== GET /org_units/tree ===');
  const tree = await fetch('GET', '/org_units/tree', null, token);
  assert(tree.status === 200, `GET /org_units/tree → 200 (got ${tree.status})`);
  console.log('');

  // 9. Cleanup — record test đã được restore ở bước 7 nên đang active trong danh sách thật.
  // Soft-delete lại để không để rác trong dữ liệu production mỗi lần chạy script. Không assert
  // (best-effort dọn dẹp, không phải một bước nghiệp vụ cần verify).
  console.log(`=== Cleanup: DELETE /org_units/${createdId}/soft-delete ===`);
  const cleanup = await fetch('DELETE', `/org_units/${createdId}/soft-delete`, null, token);
  console.log(`  Cleanup status: ${cleanup.status}`);
  console.log('');

  printSummary();
  if (failCount > 0) process.exit(1);
}

function printSummary() {
  console.log('=== SUMMARY ===');
  console.log(`Pass: ${passCount}  Fail: ${failCount}`);
  if (failures.length) {
    console.log('Failures:');
    failures.forEach((f) => console.log(`  - ${f}`));
  }
}

main().catch((err) => {
  console.error('Script crashed:', err);
  process.exit(1);
});
