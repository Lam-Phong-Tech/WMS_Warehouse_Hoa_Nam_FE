import type { QueryKey } from "@tanstack/react-query";

/**
 * CHÍNH SÁCH CACHE TOÀN DỰ ÁN — nguồn sự thật DUY NHẤT cho staleTime/gcTime/persist.
 *
 * Vì sao tồn tại file này: trước đây mọi query dùng chung một mặc định
 * `staleTime 60s / gcTime 5 phút`, còn ~60/112 call site không khai gì và 0 call
 * site khai `gcTime`. Hệ quả: danh mục kho (đổi vài tháng một lần) và số tồn kho
 * (đổi từng phút) được đối xử y hệt nhau — vừa gọi lại API thừa cho dữ liệu tĩnh,
 * vừa giữ dữ liệu tồn kho lâu hơn mức nghiệp vụ cho phép.
 *
 * NGUYÊN TẮC ĐỘ TƯƠI (đọc cùng docs/cache/CACHE_POLICY.md):
 *   staleness tối đa mà người dùng có thể thấy
 *     = staleTime của FE + TTL cache của BE (config/wms_cache.php).
 * Với nhóm `inventory`: 15s (FE) + 20s (BE `stock_short`) = 35s < 60s, vẫn nằm
 * trong NFR-SRS-016 ("read model tồn kho có max staleness <= 60s"). ĐỪNG nới
 * staleTime của nhóm này mà không nới NFR tương ứng.
 *
 * Với nhóm master/reference, TTL chỉ là TRẦN cho thay đổi do NGƯỜI KHÁC tạo ra.
 * Thay đổi do chính người dùng thực hiện được phản ánh tức thì qua mutation
 * invalidation (@/shared/cache/invalidation) — không phụ thuộc TTL.
 */
export type CacheClass =
  | "static"
  | "reference"
  | "master"
  | "rbac"
  | "search"
  | "list"
  | "detail"
  | "report"
  | "dashboard"
  | "inventory"
  | "realtime"
  | "volatile";

export interface CachePolicy {
  /** Bao lâu dữ liệu còn được coi là tươi (không refetch khi mount lại). */
  readonly staleTime: number;
  /** Bao lâu giữ trong RAM sau khi không còn observer nào. */
  readonly gcTime: number;
  /** Có được ghi xuống IndexedDB của máy người dùng không. */
  readonly persist: boolean;
  /** Tuổi tối đa của bản ghi persisted; quá hạn thì bỏ, không hydrate. */
  readonly persistTtl: number;
  /**
   * Nạp từ đĩa xong có BẮT BUỘC gọi lại máy chủ ngay không.
   *
   * `true` cho dữ liệu nghiệp vụ đọc-nhanh (báo cáo, bảng điều khiển): người
   * dùng thấy số của lần xem trước NGAY LẬP TỨC thay vì màn hình chờ, còn số
   * đúng về ngay sau đó. Không có cờ này thì một bản ghi mới ghi vài giây trước
   * vẫn nằm trong staleTime, React Query coi là tươi và KHÔNG gọi lại — tức là
   * người dùng có thể nhìn số cũ suốt cả phiên.
   *
   * `false` cho master/reference: chúng chỉ đổi qua mutation của chính app (đã
   * có invalidation lo) nên gọi lại mỗi lần mở là lãng phí thuần tuý.
   */
  readonly revalidateOnRestore: boolean;
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const CACHE_POLICIES: Readonly<Record<CacheClass, CachePolicy>> = {
  /** Hằng số vòng đời phiên: cấu hình public, version. */
  static: {
    staleTime: 12 * HOUR,
    gcTime: DAY,
    persist: true,
    persistTtl: 7 * DAY,
    revalidateOnRestore: false,
    // Chỉ đổi khi deploy; build id đã nằm trong namespace cache.
  },
  /** Danh mục tra cứu hiếm đổi: nhóm hàng, thương hiệu, nguồn điện, quy cách, máy in. */
  reference: {
    staleTime: 30 * MINUTE,
    gcTime: 4 * HOUR,
    persist: true,
    persistTtl: DAY,
    revalidateOnRestore: false,
    // BE cache 3600s. Đổi rất hiếm và luôn qua mutation của chính app ->
    // invalidation lo phần tức thì.
  },
  /** Master data nghiệp vụ: SKU, kho, đại lý, danh mục lỗi, product master. */
  master: {
    staleTime: 10 * MINUTE,
    gcTime: 2 * HOUR,
    persist: true,
    persistTtl: 12 * HOUR,
    revalidateOnRestore: false,
    // BE cache 1800s. Là nguồn cho mọi dropdown -> persist để F5 không gọi lại.
  },
  /** Hồ sơ/quyền của chính người đăng nhập. KHÔNG persist. */
  rbac: {
    staleTime: 5 * MINUTE,
    gcTime: 30 * MINUTE,
    persist: false,
    persistTtl: 0,
    revalidateOnRestore: false,
    // Thu hồi quyền phải có hiệu lực nhanh; ghi xuống đĩa sẽ kéo dài cửa sổ
    // quyền cũ trên máy dùng chung.
  },
  /** Gợi ý tìm kiếm/typeahead. */
  search: {
    staleTime: 2 * MINUTE,
    gcTime: 10 * MINUTE,
    persist: false,
    persistTtl: 0,
    revalidateOnRestore: false,
    // BE cache 120s. Không gian khoá không giới hạn (theo từ khoá) -> persist sẽ
    // phình đĩa vô ích.
  },
  /** Danh sách chứng từ nghiệp vụ (nhập/xuất/bảo hành/đảo). */
  list: {
    staleTime: 30 * 1000,
    gcTime: 15 * MINUTE,
    persist: false,
    persistTtl: 0,
    revalidateOnRestore: false,
    // Trạng thái chứng từ đổi theo thao tác của nhiều người; giữ RAM lâu để quay
    // lại danh sách không giật, nhưng không ghi đĩa.
  },
  /** Chi tiết một chứng từ. */
  detail: {
    staleTime: 30 * 1000,
    gcTime: 15 * MINUTE,
    persist: false,
    persistTtl: 0,
    revalidateOnRestore: false,
    // Optimistic lock đi qua ETag/If-Match: hiển thị bản cũ thì lần ghi kế tiếp
    // nhận 412 chứ không ghi sai.
  },
  /**
   * Báo cáo tổng hợp. GHI XUỐNG ĐĨA có kèm hai chốt chặn:
   *  - `revalidateOnRestore`: nạp xong là gọi lại máy chủ ngay, bản cũ chỉ để
   *    lấp chỗ màn hình chờ chứ không bao giờ là câu trả lời cuối cùng;
   *  - trần dung lượng theo TỪNG query trong query-persister.ts: báo cáo khổng lồ
   *    (movement-trace đo được 2,1 MB) tự động bị loại, chỉ những payload nhỏ và
   *    hay mở (dashboard 5-20 KB, xnt 159 KB) mới nằm lại trên máy.
   */
  report: {
    staleTime: 5 * MINUTE,
    gcTime: 30 * MINUTE,
    persist: true,
    persistTtl: 10 * MINUTE,
    revalidateOnRestore: true,
    // BE cache 300s. Payload phụ thuộc scope người xem -> namespace persisted
    // cache đã có user + scope + permission nên không dùng chung được giữa hai
    // người; xem cache-namespace.ts.
  },
  dashboard: {
    staleTime: 60 * 1000,
    gcTime: 15 * MINUTE,
    persist: true,
    persistTtl: 10 * MINUTE,
    revalidateOnRestore: true,
    // BE cache 60s; có auto-refresh riêng khi người dùng bật.
  },
  /** Số tồn kho và mọi thứ suy ra từ nó. */
  inventory: {
    staleTime: 15 * 1000,
    gcTime: 5 * MINUTE,
    persist: false,
    persistTtl: 0,
    revalidateOnRestore: false,
    // 15s (FE) + 20s (BE stock_short) = 35s < 60s trần NFR-SRS-016. TUYỆT ĐỐI
    // không persist.
  },
  /** Chuông thông báo — có Echo đẩy realtime, query chỉ là bootstrap badge. */
  realtime: {
    staleTime: 30 * 1000,
    gcTime: 5 * MINUTE,
    persist: false,
    persistTtl: 0,
    revalidateOnRestore: false,
    // Kênh cập nhật thật là Echo (WebSocket), query chỉ dựng số ban đầu -> 30s
    // là đủ, không cần hỏi lại dày hơn.
  },
  /** Không bao giờ tái sử dụng: trạng thái job export, health, tải file. */
  volatile: {
    staleTime: 0,
    gcTime: 30 * 1000,
    persist: false,
    persistTtl: 0,
    revalidateOnRestore: false,
    // Kết quả chỉ đúng tại thời điểm gọi.
  },
};

/**
 * ĐĂNG KÝ 100% QUERY KEY ROOT CỦA DỰ ÁN.
 *
 * Mỗi entry là một tiền tố queryKey -> nhóm chính sách. Guard
 * `scripts/check-query-cache-policy.mjs` quét toàn bộ src/ và FAIL nếu tồn tại
 * một queryKey root chưa có mặt ở đây — nên bảng này không thể trôi khỏi mã nguồn.
 *
 * Tiền tố dài hơn KHÔNG được lồng trong tiền tố ngắn hơn: TanStack
 * `getQueryDefaults` cảnh báo khi nhiều defaults cùng khớp. Query nào là ngoại lệ
 * của nhóm cha thì phải ĐỔI ROOT (ví dụ `sku-has-stock` đã chuyển từ
 * `mvp-master` sang `inventory`), chứ không khai tiền tố lồng nhau ở đây.
 */
export const QUERY_CACHE_REGISTRY: ReadonlyArray<
  readonly [root: string, cacheClass: CacheClass]
> = [
  // --- Dữ liệu tra cứu dùng chung toàn app (đích đến của việc gộp trùng lặp) ---
  ["ref", "reference"],

  // --- Auth / RBAC ---
  ["auth", "rbac"],
  // `iam` là các màn QUẢN TRỊ (danh sách user/role/permission/phòng ban đang
  // được sửa), không phải hồ sơ RBAC của chính người đăng nhập — nên dùng nhóm
  // `list` (30s) chứ không phải `rbac` (5 phút): admin vừa sửa xong phải thấy ngay.
  ["iam", "list"],

  // --- Master/reference còn nằm ở module riêng ---
  ["mvp-master", "master"],
  ["catalog-master", "master"],
  // Chỉ còn màn Cấu hình kho dùng root này; danh mục kho dùng chung đã về root "ref".
  ["warehouse", "master"],
  ["sku-import-constraints", "reference"],

  // --- Nghiệp vụ: danh sách + chi tiết ---
  ["inbound", "list"],
  ["mvp-outbound", "list"],
  ["warranty", "list"],
  ["reversal", "list"],
  ["putaway", "list"],
  ["scan", "list"],
  ["document-attachments", "detail"],
  ["sku-import-report", "detail"],

  // --- Tồn kho ---
  ["inventory", "inventory"],

  // --- Báo cáo ---
  ["reports", "report"],
  ["rpt-ops", "report"],
  ["rpt-xnt-01", "report"],
  ["rpt-io-01", "report"],
  ["rpt-mov-01", "report"],
  ["rpt-05", "report"],
  ["rpt-06", "report"],

  // --- Bảng điều khiển ---
  ["dashboard", "dashboard"],

  // --- Khác ---
  ["notifications", "realtime"],
  ["audit-logs", "list"],
  // PV đọc tồn kho: `use-pv.ts` ghi rõ NFR-SRS-016 (max staleness tồn <= 60s).
  // KHÔNG được xếp vào `reference` (30 phút) dù nghe như danh mục sản phẩm.
  ["pv", "list"],
  ["autocomplete", "search"],
];

/**
 * CHẶN GHI ĐĨA THEO TỪNG KHOÁ — thắng cả chính sách của nhóm.
 *
 * Dùng cho những query mà nhóm cho phép persist nhưng NỘI DUNG thì không nên nằm
 * trên đĩa máy dùng chung. Hiện có một mục: danh bạ người dùng (tên, email,
 * phòng ban) tuy được trang báo cáo dùng như một bảng tra cứu, nhưng đó là dữ
 * liệu cá nhân — khác hẳn danh mục SKU hay kho.
 *
 * Khớp theo TIỀN TỐ khoá: khai `["rpt-ops", "user-directory"]` là chặn mọi biến
 * thể tham số của nó.
 */
export const PERSIST_DENYLIST: ReadonlyArray<readonly string[]> = [
  ["rpt-ops", "user-directory"],
];

/** Khoá này có bị chặn ghi đĩa theo danh sách trên không. */
export function isPersistDenied(queryKey: QueryKey): boolean {
  if (!Array.isArray(queryKey)) return false;

  return PERSIST_DENYLIST.some((denied) =>
    denied.every((segment, index) => queryKey[index] === segment),
  );
}

const DEFAULT_CLASS: CacheClass = "list";

/** Nhóm chính sách của một queryKey. Không bao giờ ném lỗi ở runtime. */
export function classOfQueryKey(queryKey: QueryKey): CacheClass {
  const root = Array.isArray(queryKey) ? queryKey[0] : queryKey;
  if (typeof root !== "string") return DEFAULT_CLASS;
  for (const [registeredRoot, cacheClass] of QUERY_CACHE_REGISTRY) {
    if (registeredRoot === root) return cacheClass;
  }
  return DEFAULT_CLASS;
}

export function policyOfQueryKey(queryKey: QueryKey): CachePolicy {
  return CACHE_POLICIES[classOfQueryKey(queryKey)];
}

/** Root nào được phép ghi xuống IndexedDB — suy ra từ chính bảng trên, không khai tay. */
export const PERSISTABLE_ROOTS: ReadonlySet<string> = new Set(
  QUERY_CACHE_REGISTRY.filter(
    ([, cacheClass]) => CACHE_POLICIES[cacheClass].persist,
  ).map(([root]) => root),
);
