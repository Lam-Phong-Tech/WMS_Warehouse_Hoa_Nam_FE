import { runtimeConfig } from "@/shared/config/env";

/**
 * NAMESPACE CHO CACHE GHI XUỐNG MÁY NGƯỜI DÙNG.
 *
 * Persisted cache tuyệt đối không được dùng chung một "xô". Máy trong kho là máy
 * DÙNG CHUNG: ca sáng và ca chiều đăng nhập hai tài khoản khác nhau trên cùng
 * trình duyệt. Nếu khoá lưu trữ không phân biệt được danh tính thì dữ liệu của
 * người trước sẽ hiện ra cho người sau.
 *
 * Khoá lưu trữ gồm 6 phần, mỗi phần đóng đúng một rủi ro:
 *   s{schema}  — đổi khi CẤU TRÚC bản ghi persisted đổi (bản cũ bị bỏ, không parse).
 *   {env}      — local/dev/uat/prod không dùng chung dữ liệu (cùng origin khi test).
 *   {build}    — deploy mới thì cache của build cũ hết hiệu lực (chống lệch shape API).
 *   {userId}   — nguyên văn, KHÔNG băm: hai user khác nhau không thể va khoá.
 *   {scope}    — băm warehouse scope + context đang chọn.
 *   {perms}    — băm danh sách permission code: quyền đổi -> namespace đổi -> cache cũ
 *                lập tức không còn được đọc, không cần chờ TTL.
 */
export const CACHE_SCHEMA_VERSION = 1;

/** Định danh build, do vite inject (xem vite.config.ts + src/vite-env.d.ts). */
export const APP_BUILD_ID: string =
  typeof __APP_BUILD_ID__ === "string" && __APP_BUILD_ID__.length > 0
    ? __APP_BUILD_ID__
    : "dev";

export interface CacheIdentity {
  readonly userId: string;
  readonly warehouseScopeIds: readonly string[];
  readonly contextRef: string | null;
  readonly permissionCodes: readonly string[];
  readonly isSuperAdmin: boolean;
}

/**
 * FNV-1a 32-bit. KHÔNG phải hàm băm mật mã và không cần phải là: nó chỉ rút gọn
 * phần scope/permission cho khoá lưu trữ. Định danh người dùng nằm NGUYÊN VĂN
 * trong khoá nên va chạm băm không thể trộn dữ liệu giữa hai tài khoản; xấu nhất
 * là hai bộ quyền khác nhau của CÙNG một người dùng chia sẻ khoá, và hai bộ đó
 * vốn đã nhìn thấy cùng tập dữ liệu hay không thì `perms` khác nhau sẽ tách ra.
 */
function hash32(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function sanitize(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64) || "anon";
}

export function buildCacheNamespace(identity: CacheIdentity): string {
  const scope = [
    identity.isSuperAdmin ? "sa" : "u",
    identity.contextRef ?? "-",
    [...identity.warehouseScopeIds].sort().join(","),
  ].join("|");
  const perms = [...identity.permissionCodes].sort().join(",");

  return [
    `s${CACHE_SCHEMA_VERSION}`,
    sanitize(runtimeConfig.envName),
    sanitize(APP_BUILD_ID),
    sanitize(identity.userId),
    hash32(scope),
    hash32(perms),
  ].join(":");
}

/** Tiền tố dùng để dọn mọi bản ghi cũ (build khác, user khác, scope khác). */
export const CACHE_KEY_PREFIX = `s${CACHE_SCHEMA_VERSION}:`;
