// Sinh lại public/vietnam-addresses.json từ dữ liệu thật của
// provinces.open-api.vn (API v2 — chuẩn sau sáp nhập 07/2025, chỉ 2 cấp
// Tỉnh/Thành phố + Phường/Xã, không còn Quận/Huyện).
//
// Chạy: node scripts/fetch-vietnam-addresses.mjs

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BASE = 'https://provinces.open-api.vn/api/v2';
const OUT_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'public',
  'vietnam-addresses.json',
);

async function main() {
  const provincesRes = await fetch(`${BASE}/p/`);
  const provinces = await provincesRes.json();

  const result = [];
  for (const p of provinces) {
    const res = await fetch(`${BASE}/p/${p.code}?depth=2`);
    const full = await res.json();
    result.push({
      code: full.code,
      name: full.name,
      wards: (full.wards ?? []).map((w) => ({ code: w.code, name: w.name })),
    });
  }

  result.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  writeFileSync(OUT_PATH, JSON.stringify(result, null, 2) + '\n', 'utf-8');
  console.log(`Đã ghi ${OUT_PATH}`);
  console.log('provinces:', result.length);
  console.log('total wards:', result.reduce((s, p) => s + p.wards.length, 0));
}

main();
