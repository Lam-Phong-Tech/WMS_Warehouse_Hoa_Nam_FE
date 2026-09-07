#!/usr/bin/env node
/**
 * Sinh danh mục địa giới hành chính Việt Nam (2 cấp, sau sáp nhập) thành JSON
 * NẰM TRONG REPO, để app KHÔNG phụ thuộc dịch vụ ngoài lúc chạy.
 *
 *   yarn vn-address:sync            # tải mới, ghi đè, chỉ khi qua hết kiểm tra
 *   yarn vn-address:check           # chỉ kiểm tra file hiện có, không gọi mạng
 *
 * Nguồn: https://provinces.open-api.vn/api/v2 (CORS mở, không cần khoá).
 * Script CHỈ chạy lúc build/dev của lập trình viên — runtime của app không
 * bao giờ gọi tới đây. Khi địa giới đổi thì chạy lại lệnh trên và commit JSON.
 *
 * Bất biến được ép trước khi ghi (fail thì GIỮ NGUYÊN file cũ):
 *  - đủ số tỉnh tối thiểu, mỗi tỉnh có ít nhất 1 phường/xã
 *  - mã tỉnh & mã xã không trùng, tên không rỗng
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = resolve(ROOT, "src/shared/lib/vn-address/data");
const PROVINCES_FILE = resolve(DATA_DIR, "vn-provinces.json");
const WARDS_FILE = resolve(DATA_DIR, "vn-wards.json");

const BASE =
  process.env.VN_ADDRESS_SOURCE ?? "https://provinces.open-api.vn/api/v2";
const MIN_PROVINCES = 30;
const MIN_WARDS = 2500;
const RETRIES = 3;

const check = process.argv.includes("--check");

function fail(message) {
  console.error(`✗ vn-address: ${message}`);
  process.exit(1);
}

async function getJson(path) {
  let lastError;
  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    try {
      const response = await fetch(`${BASE}${path}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      await new Promise((done) => setTimeout(done, 400 * attempt));
    }
  }
  throw new Error(`${path}: ${lastError?.message ?? "unknown error"}`);
}

const text = (value) => (typeof value === "string" ? value.trim() : "");
const code = (value) => (Number.isFinite(Number(value)) ? Number(value) : null);

async function download() {
  const rawProvinces = await getJson("/p/");
  if (!Array.isArray(rawProvinces)) throw new Error("/p/ không trả về mảng");

  const provinces = [];
  const wardsByProvince = {};

  for (const row of rawProvinces) {
    const provinceCode = code(row?.code);
    const name = text(row?.name);
    if (provinceCode === null || !name)
      throw new Error(`tỉnh không hợp lệ: ${JSON.stringify(row)}`);

    const detail = await getJson(`/p/${provinceCode}?depth=2`);
    const rawWards = Array.isArray(detail?.wards) ? detail.wards : [];
    // Không chấp nhận tỉnh rỗng xã: đó là dấu hiệu proxy nuốt ?depth=2.
    if (rawWards.length === 0)
      throw new Error(`${name} (${provinceCode}) không có phường/xã nào`);

    const wards = rawWards.map((ward) => {
      const wardCode = code(ward?.code);
      const wardName = text(ward?.name);
      if (wardCode === null || !wardName)
        throw new Error(`xã không hợp lệ ở ${name}: ${JSON.stringify(ward)}`);
      return {
        code: wardCode,
        name: wardName,
        codename: text(ward?.codename),
        division_type: text(ward?.division_type),
      };
    });

    provinces.push({
      code: provinceCode,
      name,
      codename: text(row?.codename),
      division_type: text(row?.division_type),
      phone_code: code(row?.phone_code),
    });
    wardsByProvince[String(provinceCode)] = wards;
    process.stdout.write(`  ${name} — ${wards.length} phường/xã\n`);
  }

  const generatedAt = new Date().toISOString().slice(0, 10);
  return [
    { version: generatedAt, source: BASE, count: provinces.length, provinces },
    {
      version: generatedAt,
      source: BASE,
      count: Object.values(wardsByProvince).reduce(
        (sum, list) => sum + list.length,
        0,
      ),
      wardsByProvince,
    },
  ];
}

/** Bất biến chung cho cả lúc sinh mới lẫn lúc `--check` file đã commit. */
function validate(provincesDoc, wardsDoc) {
  const provinces = provincesDoc?.provinces;
  const byProvince = wardsDoc?.wardsByProvince;
  if (!Array.isArray(provinces))
    fail("vn-provinces.json: thiếu mảng `provinces`");
  if (!byProvince || typeof byProvince !== "object")
    fail("vn-wards.json: thiếu `wardsByProvince`");
  if (provinces.length < MIN_PROVINCES)
    fail(`chỉ có ${provinces.length} tỉnh (tối thiểu ${MIN_PROVINCES})`);

  const provinceCodes = new Set();
  for (const province of provinces) {
    if (!Number.isFinite(province.code))
      fail(`mã tỉnh không hợp lệ: ${JSON.stringify(province)}`);
    if (!text(province.name)) fail(`tỉnh ${province.code} thiếu tên`);
    if (provinceCodes.has(province.code))
      fail(`mã tỉnh trùng: ${province.code}`);
    provinceCodes.add(province.code);
  }

  const wardCodes = new Set();
  let wardTotal = 0;
  for (const [key, list] of Object.entries(byProvince)) {
    if (!provinceCodes.has(Number(key)))
      fail(`vn-wards.json có mã tỉnh lạ: ${key}`);
    if (!Array.isArray(list) || list.length === 0)
      fail(`tỉnh ${key} không có phường/xã`);
    for (const ward of list) {
      if (!Number.isFinite(ward.code) || !text(ward.name))
        fail(`xã không hợp lệ ở tỉnh ${key}: ${JSON.stringify(ward)}`);
      if (wardCodes.has(ward.code)) fail(`mã xã trùng: ${ward.code}`);
      wardCodes.add(ward.code);
      wardTotal += 1;
    }
  }
  for (const province of provinces) {
    if (!byProvince[String(province.code)])
      fail(`tỉnh ${province.name} (${province.code}) chưa có phường/xã`);
  }
  if (wardTotal < MIN_WARDS)
    fail(`chỉ có ${wardTotal} phường/xã (tối thiểu ${MIN_WARDS})`);
  return { provinceTotal: provinces.length, wardTotal };
}

function readDoc(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    fail(`không đọc được ${file}: ${error.message}`);
  }
}

if (check) {
  const stats = validate(readDoc(PROVINCES_FILE), readDoc(WARDS_FILE));
  console.log(
    `✓ vn-address: ${stats.provinceTotal} tỉnh / ${stats.wardTotal} phường/xã (không gọi mạng)`,
  );
  process.exit(0);
}

console.log(`vn-address: tải từ ${BASE}`);
const [provincesDoc, wardsDoc] = await download().catch((error) =>
  fail(`tải thất bại — giữ nguyên file cũ. ${error.message}`),
);
const stats = validate(provincesDoc, wardsDoc);
mkdirSync(DATA_DIR, { recursive: true });
writeFileSync(
  PROVINCES_FILE,
  `${JSON.stringify(provincesDoc, null, 2)}\n`,
  "utf8",
);
// Indent 2 = đúng đầu ra của prettier → `yarn format:check` xanh ngay sau khi sync.
writeFileSync(WARDS_FILE, `${JSON.stringify(wardsDoc, null, 2)}\n`, "utf8");
console.log(
  `✓ vn-address: ${stats.provinceTotal} tỉnh / ${stats.wardTotal} phường/xã → src/shared/lib/vn-address/data/`,
);
