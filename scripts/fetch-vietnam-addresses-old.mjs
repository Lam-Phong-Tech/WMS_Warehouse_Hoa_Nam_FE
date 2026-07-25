// Sinh lại public/vietnam-addresses-old.json từ dữ liệu thật của
// provinces.open-api.vn (API v1 — dữ liệu trước sáp nhập 07/2025, đủ 3 cấp
// Tỉnh/Quận-Huyện/Phường-Xã) để hỗ trợ tra cứu "biết tên cũ" trong form đơn vị.
//
// Chạy: node scripts/fetch-vietnam-addresses-old.mjs

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BASE = 'https://provinces.open-api.vn/api/v1';
const OUT_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'public',
  'vietnam-addresses-old.json',
);

async function main() {
  const provincesRes = await fetch(`${BASE}/p/`);
  const provinces = await provincesRes.json();

  const result = [];
  for (const p of provinces) {
    const res = await fetch(`${BASE}/p/${p.code}?depth=3`);
    const full = await res.json();
    result.push({
      code: full.code,
      name: full.name,
      districts: (full.districts ?? []).map((d) => ({
        code: d.code,
        name: d.name,
        wards: (d.wards ?? []).map((w) => ({ code: w.code, name: w.name })),
      })),
    });
  }

  result.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  writeFileSync(OUT_PATH, JSON.stringify(result, null, 2) + '\n', 'utf-8');
  console.log(`Đã ghi ${OUT_PATH}`);
  console.log('provinces:', result.length);
  console.log(
    'total districts:',
    result.reduce((s, p) => s + p.districts.length, 0),
  );
  console.log(
    'total wards:',
    result.reduce(
      (s, p) => s + p.districts.reduce((s2, d) => s2 + d.wards.length, 0),
      0,
    ),
  );
}

main();
