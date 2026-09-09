/**
 * Danh mục địa giới hành chính Việt Nam sau sáp nhập (2 cấp: Tỉnh/Thành →
 * Phường/Xã) — ĐỌC TỪ JSON TRONG REPO, không gọi dịch vụ ngoài lúc chạy.
 *
 *   src/shared/lib/vn-address/data/vn-provinces.json   34 tỉnh   (~5 KB)
 *   src/shared/lib/vn-address/data/vn-wards.json       3321 xã   (~294 KB)
 *
 * Vì sao bỏ gọi API lúc chạy: bản cũ tải trực tiếp provinces.open-api.vn nên
 * ô "Tỉnh/Thành" phụ thuộc mạng ngoài + CORS + thời gian sống của dịch vụ đó,
 * và nhánh phường/xã nuốt lỗi im lặng — payload thiếu `wards` (proxy/CDN cắt
 * `?depth=2`) bị cache là danh sách RỖNG cho tới hết phiên, người dùng chỉ
 * thấy "Không có lựa chọn" mà không có cảnh báo hay nút tải lại.
 *
 * Nay:
 * - Tỉnh/thành nạp TĨNH theo bundle → có ngay ở lần render đầu, không loading,
 *   không bao giờ lỗi, chạy được offline.
 * - Phường/xã nằm ở chunk riêng, nạp bằng dynamic import (cùng origin, HTTP
 *   cache) và được hâm sẵn ngay khi ô địa chỉ mount.
 * - Danh sách xã RỖNG bị coi là LỖI, không bao giờ được cache.
 *
 * Cập nhật khi địa giới đổi: `yarn vn-address:sync` rồi commit JSON.
 * `yarn vn-address:check` kiểm tra tính toàn vẹn mà không cần mạng.
 */

import provincesDoc from "./data/vn-provinces.json";
import { tStatic } from "@/shared/i18n";

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

interface RawWard {
  code: number;
  name: string;
  codename: string;
  division_type: string;
}

interface WardsDoc {
  version: string;
  source: string;
  count: number;
  wardsByProvince: Record<string, RawWard[]>;
}

/** Ngày sinh dữ liệu (YYYY-MM-DD) — hiện ở gợi ý lỗi và log kiểm tra. */
export const VN_ADDRESS_DATA_VERSION: string = provincesDoc.version;

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

const provincesCache: VnProvince[] = sortByBareName(
  provincesDoc.provinces.map((row) => ({
    code: row.code,
    name: row.name,
    codename: row.codename,
    division_type: row.division_type,
  })),
);

const wardsCache = new Map<number, VnWard[]>();
let wardsDocPromise: Promise<WardsDoc> | null = null;

function loadWardsDoc(): Promise<WardsDoc> {
  // Chunk riêng: chỉ tải khi thực sự có ô địa chỉ trên màn hình.
  wardsDocPromise ??= import("./data/vn-wards.json")
    .then((module) => (module.default ?? module) as unknown as WardsDoc)
    .catch((error: unknown) => {
      // Chunk lỗi (deploy mới xoá file cũ, mạng rớt giữa chừng) → cho thử lại.
      wardsDocPromise = null;
      throw error instanceof Error
        ? error
        : new Error(tStatic("shared.address.wardsLoadError"));
    });
  return wardsDocPromise;
}

/**
 * Hâm sẵn chunk phường/xã ngay khi ô địa chỉ mount, để lúc người dùng chọn
 * xong tỉnh thì danh sách xã đã nằm trong bộ nhớ (không nháy spinner).
 * Nuốt lỗi có chủ đích: đây chỉ là tối ưu, `fetchWards` mới là đường thật.
 */
export function preloadVnWards(): void {
  void loadWardsDoc().catch(() => undefined);
}

function selectWards(doc: WardsDoc, provinceCode: number): VnWard[] {
  const rows = doc.wardsByProvince[String(provinceCode)];
  // Rỗng = dữ liệu hỏng, KHÔNG cache. Đây chính là bẫy của bản gọi API cũ.
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(tStatic("shared.address.provinceHasNoWards", { code: provinceCode }));
  }
  return sortByBareName(
    rows.map((row) => ({
      code: row.code,
      name: row.name,
      codename: row.codename,
      division_type: row.division_type,
      province_code: provinceCode,
    })),
  );
}

/** Danh sách tỉnh/thành — luôn sẵn sàng, đồng bộ, không bao giờ null. */
export function peekProvinces(): VnProvince[] {
  return provincesCache;
}

/** Xã của một tỉnh nếu chunk đã nạp; null = chưa nạp xong (hiện spinner). */
export function peekWards(provinceCode: number | null): VnWard[] | null {
  if (provinceCode === null) return null;
  return wardsCache.get(provinceCode) ?? null;
}

export function fetchProvinces(): Promise<VnProvince[]> {
  return Promise.resolve(provincesCache);
}

export function fetchWards(provinceCode: number): Promise<VnWard[]> {
  const cached = wardsCache.get(provinceCode);
  if (cached) return Promise.resolve(cached);
  return loadWardsDoc().then((doc) => {
    const wards = selectWards(doc, provinceCode);
    wardsCache.set(provinceCode, wards);
    return wards;
  });
}

/** Chỉ dùng trong test — xoá cache bộ nhớ để mỗi case bắt đầu sạch. */
export function __resetVnAddressCache(): void {
  wardsCache.clear();
  wardsDocPromise = null;
}
