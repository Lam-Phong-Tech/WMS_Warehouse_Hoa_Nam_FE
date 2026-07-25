const BASE = process.env.API_BASE_URL || (() => { throw new Error('API_BASE_URL env var required'); })();

async function main() {
  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.QA_ADMIN_EMAIL ?? (() => { throw new Error('Set QA_ADMIN_EMAIL env var'); })(), password: (process.env.QA_ADMIN_PASSWORD ?? (() => { throw new Error('Set QA_ADMIN_PASSWORD env var'); })()) }),
  });
  const loginJson = await loginRes.json();
  const token = loginJson?.data?.token || loginJson?.data?.access_token;
  const auth = { Authorization: `Bearer ${token}` };

  // Lấy TẤT CẢ scopes (per_page lớn) để đếm distinct user theo role
  const scRes = await fetch(`${BASE}/user-role-scopes?per_page=1000`, {
    headers: auth,
  });
  const scJson = await scRes.json();
  const arr = scJson?.data?.data || scJson?.data || [];
  console.log('TOTAL scopes=', arr.length, 'meta=', JSON.stringify(scJson?.data?.meta || scJson?.meta));

  // Đếm distinct user_id theo role_id (chỉ bản ghi active, chưa revoked)
  const counts = {};
  for (const r of arr) {
    if (r.revoked_at) continue;
    if (r.status !== undefined && r.status === 0) continue;
    const rid = r.role_id;
    counts[rid] = counts[rid] || new Set();
    counts[rid].add(r.user_id);
  }
  const result = {};
  for (const k of Object.keys(counts)) result[k] = counts[k].size;
  console.log('DISTINCT USER COUNTS BY ROLE:', JSON.stringify(result));

  // So sánh với meta.total từng role (đếm bản ghi)
  const roleIds = [...new Set(arr.map((r) => r.role_id))];
  for (const rid of roleIds) {
    const recs = arr.filter((r) => r.role_id === rid && !r.revoked_at).length;
    console.log(`role ${rid}: records=${recs}, distinctUsers=${result[rid] || 0}`);
  }
}

main().catch((e) => console.error('ERR', e.message));