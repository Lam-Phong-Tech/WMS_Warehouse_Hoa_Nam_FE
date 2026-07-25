import http from 'axios';

// BASE_URL / TOKEN phải được cấp qua biến môi trường, không hard-code trong repo.
// Sử dụng: API_BASE_URL=https://... API_TOKEN=eyJ... node scripts/test-employees-errors.mjs
const BASE_URL = process.env.API_BASE_URL;
const TOKEN = process.env.API_TOKEN;

if (!BASE_URL || !TOKEN) {
  console.error(
    'Thiếu biến môi trường API_BASE_URL / API_TOKEN. Ví dụ:\n' +
      '  API_BASE_URL=https://astrodev.test8.io.vn/api/v1 API_TOKEN=xxx node scripts/test-employees-errors.mjs',
  );
  process.exit(1);
}

const headers = {
  'Authorization': `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

async function testEndpoint(name, method, path, body = null) {
  try {
    const config = { method, url: `${BASE_URL}${path}`, headers };
    if (body) config.data = body;
    
    const response = await http(config);
    console.log(`\n✅ ${name} - Status: ${response.status}`);
    console.log(JSON.stringify(response.data, null, 2));
    return { success: true, status: response.status, data: response.data };
  } catch (error) {
    const status = error.response?.status || 500;
    const data = error.response?.data || { message: error.message };
    console.log(`\n❌ ${name} - Status: ${status}`);
    console.log(JSON.stringify(data, null, 2));
    return { success: false, status, data };
  }
}

async function runTests() {
  console.log('=== TEST EMPLOYEES API - ERROR CASES ===\n');

  // 1. GET /employees/99999 - 404 Not Found
  await testEndpoint('GET /employees/99999 (404)', 'GET', '/employees/99999');

  // 2. PUT /employees/99999 - 404 Not Found
  await testEndpoint(
    'PUT /employees/99999 (404)',
    'PUT',
    '/employees/99999',
    { full_name: 'Test', gender: 0, birthday: '1995-10-15', cccd: '012345678901', phone: '0987654321', email: 'test@test.com', address: 'Test', manager_id: 1 }
  );

  // 3. POST /employees - thiếu field bắt buộc (422)
  await testEndpoint(
    'POST /employees (422 - missing fields)',
    'POST',
    '/employees',
    {
      full_name: 'Test',
      // Thiếu gender, birthday, cccd, phone, email, address, manager_id
    }
  );

  // 4. POST /employees - duplicate email (409)
  await testEndpoint(
    'POST /employees (409 - duplicate email)',
    'POST',
    '/employees',
    {
      full_name: 'Test Duplicate',
      gender: 0,
      birthday: '1995-10-15',
      cccd: '999999999999',
      phone: '0987654322',
      email: 'multi.role@erb.vn', // Email đã tồn tại
      address: 'Test',
      manager_id: 1,
    }
  );

  // 5. DELETE /employees/6/soft-delete - thành công (đã test trong tài liệu)
  await testEndpoint('DELETE /employees/6/soft-delete', 'DELETE', '/employees/6/soft-delete');

  // 6. GET /employees/6 sau khi soft-delete - 404
  await testEndpoint('GET /employees/6 after delete (404)', 'GET', '/employees/6');

  // 7. PATCH /employees/6/restore - khôi phục
  await testEndpoint('PATCH /employees/6/restore', 'PATCH', '/employees/6/restore');

  // 8. GET /employees/6 sau khi restore - 200
  await testEndpoint('GET /employees/6 after restore', 'GET', '/employees/6');

  // 9. DELETE /employees/99999/force-delete - 404
  await testEndpoint('DELETE /employees/99999/force-delete (404)', 'DELETE', '/employees/99999/force-delete');

  // 10. POST /employees/99999/account - 404
  await testEndpoint('POST /employees/99999/account (404)', 'POST', '/employees/99999/account', { password: (process.env.QA_ADMIN_PASSWORD ?? (() => { throw new Error('Set QA_ADMIN_PASSWORD env var'); })()) });

  console.log('\n=== HOÀN THÀNH TEST ERROR CASES ===');
}

runTests().catch(console.error);