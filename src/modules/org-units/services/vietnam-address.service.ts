// Dữ liệu tỉnh/thành lấy hoàn toàn từ file tĩnh `public/vietnam-addresses.json`
// (đóng gói sẵn cùng app). Không còn gọi API công cộng ngoài (open-api.vn) để
// tránh phụ thuộc dịch vụ bên thứ ba — nếu API đó sập, hệ thống vẫn hoạt động.

export interface Province {
  code: number;
  name: string;
  districts: District[];
}

export interface District {
  code: number;
  name: string;
  province_code: number;
}

/**
 * Đọc và parse file dữ liệu địa chỉ Việt Nam đóng gói cùng app (public/).
 * File được sinh từ dữ liệu thật của provinces.open-api.vn (API v2, chuẩn
 * sau sáp nhập 07/2025 — chỉ 2 cấp Tỉnh/Thành phố + Phường/Xã), giữ nguyên
 * code thật thay vì tự sinh code giả như trước — xem script tại
 * scripts/fetch-vietnam-addresses.mjs.
 */
async function loadLocalAddressData(): Promise<{
  provinces: Province[];
  districtsByProvince: Map<number, District[]>;
}> {
  const response = await fetch('/vietnam-addresses.json');
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  const localData = (await response.json()) as {
    code: number;
    name: string;
    wards: { code: number; name: string }[];
  }[];
  const provinces: Province[] = [];
  const districtsByProvince = new Map<number, District[]>();

  localData.forEach((item) => {
    const districts: District[] = item.wards.map((ward) => ({
      code: ward.code,
      name: ward.name,
      province_code: item.code,
    }));
    districtsByProvince.set(item.code, districts);
    provinces.push({ code: item.code, name: item.name, districts });
  });

  return { provinces, districtsByProvince };
}

// Cache promise ở cấp module — chỉ đọc file local 1 lần cho cả phiên làm việc.
let cachedLocalData: Promise<{
  provinces: Province[];
  districtsByProvince: Map<number, District[]>;
}> | null = null;

function getLocalData() {
  if (!cachedLocalData) {
    cachedLocalData = loadLocalAddressData();
  }
  return cachedLocalData;
}

/** Lấy danh sách tỉnh/thành từ dữ liệu local. */
export async function fetchProvinces(): Promise<Province[]> {
  const data = await getLocalData();
  return data.provinces;
}

/** Lấy 1 tỉnh/thành kèm quận/huyện theo code, từ dữ liệu local. */
export async function fetchProvinceByCode(
  code: number,
): Promise<Province | null> {
  const data = await getLocalData();
  return data.provinces.find((p) => p.code === code) ?? null;
}

/** Lấy danh sách quận/huyện theo code tỉnh/thành. */
export async function fetchDistrictsByProvince(
  provinceCode: number,
): Promise<District[]> {
  const province = await fetchProvinceByCode(provinceCode);
  return province?.districts ?? [];
}

export interface LegacyDistrict {
  code: number;
  name: string;
  wards: string[];
}

export interface LegacyProvince {
  code: number;
  name: string;
  districts: LegacyDistrict[];
}

/**
 * Dữ liệu địa chỉ cũ (trước sáp nhập 07/2025) — 3 cấp thật Tỉnh/Quận/Phường,
 * lấy từ provinces.open-api.vn (API v1, giữ nguyên trước khi bị gộp) — xem
 * script tại scripts/fetch-vietnam-addresses-old.mjs. File cũ trước đây chỉ
 * có 2 cấp phẳng (Tỉnh + list Phường) nên không lọc được theo Quận/Huyện.
 */
type LegacyAddressFile = {
  code: number;
  name: string;
  districts: {
    code: number;
    name: string;
    wards: { code: number; name: string }[];
  }[];
}[];

// Cache promise ở cấp module — chỉ đọc file local 1 lần cho cả phiên làm việc.
let cachedLegacyAddressData: Promise<LegacyProvince[]> | null = null;

async function loadLegacyAddressData(): Promise<LegacyProvince[]> {
  const response = await fetch('/vietnam-addresses-old.json');
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  const raw = (await response.json()) as LegacyAddressFile;
  return raw.map((province) => ({
    code: province.code,
    name: province.name.trim(),
    districts: province.districts.map((district) => ({
      code: district.code,
      name: district.name.trim(),
      wards: district.wards.map((w) => w.name.trim()),
    })),
  }));
}

function getLegacyAddressData() {
  if (!cachedLegacyAddressData) {
    cachedLegacyAddressData = loadLegacyAddressData();
  }
  return cachedLegacyAddressData;
}

/** Lấy danh sách tỉnh/thành cũ (trước sáp nhập 2025), kèm quận/huyện cũ. */
export async function fetchLegacyProvinces(): Promise<LegacyProvince[]> {
  return getLegacyAddressData();
}

/** Lấy danh sách quận/huyện cũ theo tên tỉnh cũ. */
export async function fetchLegacyDistrictsByProvinceName(
  provinceName: string,
): Promise<LegacyDistrict[]> {
  const data = await getLegacyAddressData();
  const found = data.find(
    (p) => p.name.trim().toLowerCase() === provinceName.trim().toLowerCase(),
  );
  return found?.districts ?? [];
}

/** Lấy danh sách phường/xã cũ theo tên tỉnh cũ + tên quận/huyện cũ. */
export async function fetchLegacyWardsByDistrictName(
  provinceName: string,
  districtName: string,
): Promise<string[]> {
  const districts = await fetchLegacyDistrictsByProvinceName(provinceName);
  const found = districts.find(
    (d) => d.name.trim().toLowerCase() === districtName.trim().toLowerCase(),
  );
  return found?.wards ?? [];
}

export interface LegacyWardCandidate {
  new_ward_name: string;
  new_province_name: string;
}

export interface LegacyWardMappingEntry {
  legacy_ward_code: number;
  legacy_ward_name: string;
  legacy_province_name: string;
  candidates: LegacyWardCandidate[];
}

// Cache promise ở cấp module — chỉ đọc file mapping 1 lần cho cả phiên làm việc.
let cachedLegacyMapping: Promise<LegacyWardMappingEntry[]> | null = null;

async function loadLegacyMapping(): Promise<LegacyWardMappingEntry[]> {
  const response = await fetch('/legacy-address-mapping.json');
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return (await response.json()) as LegacyWardMappingEntry[];
}

function getLegacyMapping() {
  if (!cachedLegacyMapping) {
    cachedLegacyMapping = loadLegacyMapping();
  }
  return cachedLegacyMapping;
}

/**
 * Tra phường/xã cũ (trước sáp nhập 2025) theo tên, trả về phường/xã mới
 * tương ứng. Một phường/xã cũ có thể tách vào nhiều phường/xã mới khác nhau
 * (điều chỉnh ranh giới khi sáp nhập) nên trả về mảng ứng viên.
 */
export async function lookupNewWardFromLegacyName(
  legacyWardName: string,
  legacyProvinceName?: string,
): Promise<LegacyWardCandidate[]> {
  const mapping = await getLegacyMapping();
  const normalized = legacyWardName.trim().toLowerCase();
  const matches = mapping.filter(
    (m) => m.legacy_ward_name.trim().toLowerCase() === normalized,
  );
  const filtered = legacyProvinceName
    ? matches.filter(
        (m) =>
          m.legacy_province_name.trim().toLowerCase() ===
          legacyProvinceName.trim().toLowerCase(),
      )
    : matches;
  const source = filtered.length > 0 ? filtered : matches;
  const candidates = source.flatMap((m) => m.candidates);
  const seen = new Set<string>();
  return candidates.filter((c) => {
    const key = `${c.new_province_name}|${c.new_ward_name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
