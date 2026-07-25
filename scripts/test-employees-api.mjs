import http from 'axios';

// BASE_URL / TOKEN phải được cấp qua biến môi trường, không hard-code trong repo.
// Sử dụng: API_BASE_URL=https://... API_TOKEN=eyJ... node scripts/test-employees-api.mjs
const BASE_URL = process.env.API_BASE_URL;
const TOKEN = process.env.API_TOKEN;

if (!BASE_URL || !TOKEN) {
  console.error(
    'Thiếu biến môi trường API_BASE_URL / API_TOKEN. Ví dụ:\n' +
      '  API_BASE_URL=https://astrodev.test8.io.vn/api/v1 API_TOKEN=xxx node scripts/test-employees-api.mjs',
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
  console.log('=== BẮT ĐẦU TEST EMPLOYEES API ===\n');

  // 1. GET /employees - danh sách
  await testEndpoint('GET /employees (list)', 'GET', '/employees');

  // 2. GET /employees/{id} - chi tiết (lấy id=6 từ tài liệu)
  await testEndpoint('GET /employees/6 (detail)', 'GET', '/employees/6');

  // 3. PUT /employees/{id} - cập nhật (test với id=6)
  await testEndpoint(
    'PUT /employees/6 (update)',
    'PUT',
    '/employees/6',
    {
      full_name: 'Nguyễn Văn A Updated',
      gender: 0,
      birthday: '1995-10-15',
      cccd: '012345678901',
      phone: '0987654321',
      email: 'test.update@erb.vn',
      address: 'Hà Nội',
      manager_id: 1,
    }
  );

  // 4. PUT /employees/{id}/status - đổi trạng thái (nếu có endpoint riêng)
  // Hoặc dùng PUT /employees/{id} với employee_status
  await testEndpoint(
    'PUT /employees/6 (change status)',
    'PUT',
    '/employees/6',
    {
      employee_status: 3,
      reason: 'Test đổi trạng thái',
      effective_date: '2026-07-11',
    }
  );

  // 5. GET /employees/export-excel
  await testEndpoint('GET /employees/export-excel', 'GET', '/employees/export-excel');

  // 6. POST /employees/import-excel - test với file rỗng để xem lỗi
  console.log('\n=== TEST IMPORT EXCEL (sẽ fail 500) ===');
  try {
    const FormData = (await import('form-data')).default;
    const form = new FormData();
    form.append('file', Buffer.from(''), 'test.xlsx');
    
    const response = await http.post(`${BASE_URL}/employees/import-excel`, form, {
      headers: {
        ...headers,
        'Content-Type': 'multipart/form-data',
      },
    });
    console.log('\n✅ POST /employees/import-excel - Status:', response.status);
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('\n❌ POST /employees/import-excel - Status:', error.response?.status || 500);
    console.log(JSON.stringify(error.response?.data || { message: error.message }, null, 2));
  }

  console.log('\n=== HOÀN THÀNH TEST ===');
}

runTests().catch(console.error);