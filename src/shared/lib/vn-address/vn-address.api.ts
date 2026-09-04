/**
 * Danh mục địa giới hành chính Việt Nam sau sáp nhập (2 cấp) — nguồn
 * https://provinces.open-api.vn/ (API v2, CORS mở, không cần khoá).
 *
 * - GET /api/v2/p/            → 34 tỉnh/thành (mảng, `wards: []`)
 * - GET /api/v2/p/{code}?depth=2 → 1 tỉnh kèm danh sách phường/xã
 *
 * Cache 2 lớp: bộ nhớ module (promise dedupe trong phiên) + localStorage
 * (TTL 30 ngày) để app dùng ngoài kho/offline PWA vẫn có danh mục sau lần
 * tải đầu. Không dùng axios `api` của dự án vì đây là dịch vụ ngoài, không
 * được gắn Bearer token nội bộ.
 */

export interface VnProvince {
  code: number;
  name: string;
  codename: string;
  division_type: string;
}

export interface VnWard {
  code: number;
  name: string;
  codename: string;
  division_type: string;
  province_code: number;
}

const DEFAULT_BASE_URL = "https://provinces.open-api.vn/api/v2";
const STORAGE_PREFIX = "wms.vn-address.v2";
const STORAGE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12_000;

export function vnAddressBaseUrl(): string {
  const override = import.meta.env?.VITE_VN_ADDRESS_API_URL;
  const base =
    typeof override === "string" && override.trim()
      ? override.trim()
      : DEFAULT_BASE_URL;
  return base.replace(/\/+$/, "");
}

interface StoredEntry<T> {
  savedAt: number;
  data: T;
}

function readStorage<T>(key: string): T | null {
  try {
    const raw = globalThis.localStorage?.getItem(`${STORAGE_PREFIX}.${key}`);
    if (!raw) return null;
    const entry = JSON.parse(raw) as StoredEntry<T>;
    if (
      !entry ||
      typeof entry.savedAt !== "number" ||
      Date.now() - entry.savedAt > STORAGE_TTL_MS
    ) {
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

function writeStorage<T>(key: string, data: T): void {
  try {
    const entry: StoredEntry<T> = { savedAt: Date.now(), data };
    globalThis.localStorage?.setItem(
      `${STORAGE_PREFIX}.${key}`,
      JSON.stringify(entry),
    );
  } catch {
    // quota / private mode — cache chỉ là tối ưu, không phải yêu cầu
  }
}

async function fetchJson<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${vnAddressBaseUrl()}${path}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`vn-address: HTTP ${response.status} for ${path}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function toProvince(row: Record<string, unknown>): VnProvince | null {
  const code = Number(row.code);
  const name = typeof row.name === "string" ? row.name.trim() : "";
  if (!Number.isFinite(code) || !name) return null;
  return {
    code,
    name,
    codename: typeof row.codename === "string" ? row.codename : "",
    division_type:
      typeof row.division_type === "string" ? row.division_type : "",
  };
}

function toWard(
  row: Record<string, unknown>,
  provinceCode: number,
): VnWard | null {
  const code = Number(row.code);
  const name = typeof row.name === "string" ? row.name.trim() : "";
  if (!Number.isFinite(code) || !name) return null;
  return {
    code,
    name,
    codename: typeof row.codename === "string" ? row.codename : "",
    division_type:
      typeof row.division_type === "string" ? row.division_type : "",
    province_code: Number(row.province_code ?? provinceCode) || provinceCode,
  };
}

const collator = new Intl.Collator("vi", { sensitivity: "base" });

/**
 * Sắp xếp tên đơn vị theo phần TÊN RIÊNG (bỏ tiền tố "Thành phố"/"Tỉnh"/
 * "Phường"/"Xã"/"Đặc khu") để danh sách dễ dò mắt: "Hà Nội" đứng cạnh
 * "Hà Tĩnh" thay vì bị gom theo tiền tố.
 */
export function stripDivisionPrefix(name: string): string {
  return name
    .replace(/^(thành phố|tỉnh|phường|xã|thị trấn|đặc khu)\s+/i, "")
    .trim();
}

function sortByBareName<T extends { name: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) =>
    collator.compare(stripDivisionPrefix(a.name), stripDivisionPrefix(b.name)),
  );
}

let provincesPromise: Promise<VnProvince[]> | null = null;
let provincesCache: VnProvince[] | null = null;
const wardsPromise = new Map<number, Promise<VnWard[]>>();
const wardsCache = new Map<number, VnWard[]>();

/** Đọc cache đồng bộ (bộ nhớ → localStorage) để render ngay không nháy. */
export function peekProvinces(): VnProvince[] | null {
  if (provincesCache) return provincesCache;
  const stored = readStorage<VnProvince[]>("provinces");
  if (stored && stored.length > 0) {
    provincesCache = stored;
    return stored;
  }
  return null;
}

export function peekWards(provinceCode: number | null): VnWard[] | null {
  if (provinceCode === null) return null;
  const cached = wardsCache.get(provinceCode);
  if (cached) return cached;
  const stored = readStorage<VnWard[]>(`wards.${provinceCode}`);
  if (stored && stored.length > 0) {
    wardsCache.set(provinceCode, stored);
    return stored;
  }
  return null;
}

export function fetchProvinces(): Promise<VnProvince[]> {
  const cached = peekProvinces();
  if (cached) return Promise.resolve(cached);
  if (provincesPromise) return provincesPromise;
  provincesPromise = fetchJson<Array<Record<string, unknown>>>("/p/")
    .then((rows) => {
      const provinces = sortByBareName(
        (Array.isArray(rows) ? rows : [])
          .map(toProvince)
          .filter((row): row is VnProvince => row !== null),
      );
      if (provinces.length === 0) {
        throw new Error("vn-address: empty province list");
      }
      provincesCache = provinces;
      writeStorage("provinces", provinces);
      return provinces;
    })
    .finally(() => {
      provincesPromise = null;
    });
  return provincesPromise;
}

export function fetchWards(provinceCode: number): Promise<VnWard[]> {
  const cached = peekWards(provinceCode);
  if (cached) return Promise.resolve(cached);
  const inflight = wardsPromise.get(provinceCode);
  if (inflight) return inflight;
  const promise = fetchJson<Record<string, unknown>>(
    `/p/${provinceCode}?depth=2`,
  )
    .then((row) => {
      const rawWards = Array.isArray(row?.wards)
        ? (row.wards as Array<Record<string, unknown>>)
        : [];
      const wards = sortByBareName(
        rawWards
          .map((ward) => toWard(ward, provinceCode))
          .filter((ward): ward is VnWard => ward !== null),
      );
      wardsCache.set(provinceCode, wards);
      writeStorage(`wards.${provinceCode}`, wards);
      return wards;
    })
    .finally(() => {
      wardsPromise.delete(provinceCode);
    });
  wardsPromise.set(provinceCode, promise);
  return promise;
}

/** Chỉ dùng trong test — xoá cache bộ nhớ để mỗi case bắt đầu sạch. */
export function __resetVnAddressCache(): void {
  provincesPromise = null;
  provincesCache = null;
  wardsPromise.clear();
  wardsCache.clear();
}
