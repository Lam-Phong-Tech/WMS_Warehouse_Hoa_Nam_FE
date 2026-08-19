import { http } from "@/shared/api/http";
import { PV_API_ENDPOINTS } from "@/modules/pv/services/pv-endpoints";
import type {
  PvAdminProfile,
  PvAdminProfilePayload,
  PvAdminResourceType,
  PvAdminRule,
  PvAdminRulePayload,
  PvAdminSimpleMaster,
  PvAdminSimpleMasterPayload,
  PvPage,
  PvPublishResult,
} from "@/modules/pv/types/pv.types";

/**
 * WWHN-252 — Annex C listPvAdminResources / createPvAdminResource /
 * updatePvAdminResource. Đi qua `http` (đã xác thực) vì nhóm này gate bằng
 * `pv.master.manage`.
 *
 * PATCH BẮT BUỘC header `If-Match` chứa version hiện tại: BE trả 428
 * PRECONDITION_REQUIRED nếu thiếu và 412 STALE_VERSION nếu lệch (§8.2). FE phải
 * gửi version lấy từ chính bản ghi đang mở, KHÔNG được tự đoán hay gửi "*".
 */

function ifMatch(version: number) {
  return { headers: { "If-Match": String(version) } };
}

/**
 * FE252-P1-08: chặn ngay tại tầng service việc gửi một version "đoán". Trước
 * đây hook rơi về `?? 1` khi thiếu version — nghĩa là FE tự bịa precondition và
 * biến 412 STALE_VERSION thành một lần ghi đè im lặng đúng lúc dữ liệu đã đổi.
 * Thà hỏng ngay ở client với thông điệp rõ ràng còn hơn ghi sai lên server.
 */
function assertVersion(version: number | undefined, action: string): number {
  if (typeof version !== "number" || !Number.isInteger(version) || version < 0) {
    throw new Error(
      `Thiếu version hiện tại để ${action}. Hãy tải lại danh sách rồi thử lại.`,
    );
  }
  return version;
}

export async function listPvAdminResources<T>(
  resourceType: PvAdminResourceType,
  params: Record<string, string | number | undefined> = {},
): Promise<PvPage<T>> {
  const clean = Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== "",
    ),
  );
  const result = await http.getPage<T[]>(
    PV_API_ENDPOINTS.ADMIN_RESOURCES(resourceType),
    { params: clean },
  );
  return { data: result.data ?? [], meta: result.meta };
}

export function createPvIndustry(payload: PvAdminSimpleMasterPayload) {
  return http.post<PvAdminSimpleMaster>(
    PV_API_ENDPOINTS.ADMIN_RESOURCES("industries"),
    {
      industry_code: payload.code.trim(),
      industry_name: payload.name.trim(),
      status: payload.status,
      sort_order: payload.sort_order,
    },
  );
}

export function updatePvIndustry(
  id: string,
  version: number,
  payload: PvAdminSimpleMasterPayload,
) {
  return http.patch<PvAdminSimpleMaster>(
    PV_API_ENDPOINTS.ADMIN_RESOURCE("industries", id),
    {
      industry_code: payload.code.trim(),
      industry_name: payload.name.trim(),
      status: payload.status,
      sort_order: payload.sort_order,
    },
    ifMatch(assertVersion(version, "cập nhật master App PV")),
  );
}

export function createPvTag(payload: PvAdminSimpleMasterPayload) {
  return http.post<PvAdminSimpleMaster>(
    PV_API_ENDPOINTS.ADMIN_RESOURCES("tags"),
    {
      tag_code: payload.code.trim(),
      tag_name: payload.name.trim(),
      status: payload.status,
      sort_order: payload.sort_order,
      tag_type: payload.tag_type ?? null,
    },
  );
}

export function updatePvTag(
  id: string,
  version: number,
  payload: PvAdminSimpleMasterPayload,
) {
  return http.patch<PvAdminSimpleMaster>(
    PV_API_ENDPOINTS.ADMIN_RESOURCE("tags", id),
    {
      tag_code: payload.code.trim(),
      tag_name: payload.name.trim(),
      status: payload.status,
      sort_order: payload.sort_order,
      tag_type: payload.tag_type ?? null,
    },
    ifMatch(assertVersion(version, "cập nhật master App PV")),
  );
}

export function createPvRule(payload: PvAdminRulePayload) {
  return http.post<PvAdminRule>(
    PV_API_ENDPOINTS.ADMIN_RESOURCES("recommendation-rules"),
    payload,
  );
}

export function updatePvRule(
  id: string,
  version: number,
  payload: PvAdminRulePayload,
) {
  return http.patch<PvAdminRule>(
    PV_API_ENDPOINTS.ADMIN_RESOURCE("recommendation-rules", id),
    payload,
    ifMatch(assertVersion(version, "cập nhật master App PV")),
  );
}

export function createPvProfile(payload: PvAdminProfilePayload) {
  return http.post<PvAdminProfile>(
    PV_API_ENDPOINTS.ADMIN_RESOURCES("product-profiles"),
    payload,
  );
}

/**
 * `published` KHÔNG có trong payload — BE trả 422 BUSINESS_RULE_VIOLATION nếu
 * client gửi kèm, vì bật/tắt publish là quyền `pv.publish` ở endpoint riêng.
 */
export function updatePvProfile(
  id: string,
  version: number,
  payload: PvAdminProfilePayload,
) {
  return http.patch<PvAdminProfile>(
    PV_API_ENDPOINTS.ADMIN_RESOURCE("product-profiles", id),
    {
      display_name: payload.display_name,
      description: payload.description ?? null,
      sort_order: payload.sort_order,
      industry_ids: payload.industry_ids,
      tag_ids: payload.tag_ids,
    },
    ifMatch(assertVersion(version, "cập nhật master App PV")),
  );
}

/**
 * REQ-SRS-020 — permission RIÊNG `pv.publish`, không phải pv.master.manage.
 *
 * FE252-P1-08: publish là hành động đổi trạng thái mặt CÔNG KHAI nên Annex C
 * khai `If-Match` bắt buộc. Version phải là version HỒ SƠ App PV của đúng dòng
 * đang mở trên SCR-PV-ADM-01 (`PvAdminProfile.version`, do
 * `GET /pv-admin/resources/product-profiles` trả về) — không phải version SKU,
 * không phải hằng số đoán trước. Thiếu header BE trả 428 PRECONDITION_REQUIRED,
 * lệch version trả 412 STALE_VERSION.
 *
 * `profileVersion = 0` là giá trị hợp lệ, nghĩa là "SKU chưa có hồ sơ App PV"
 * (lần publish đầu tiên) — xem BE `docs/decision-records/DEC-API-IFMATCH-002-pv-publish-precondition.md`.
 */
export function setPvProductPublished(
  skuId: string,
  published: boolean,
  profileVersion: number,
) {
  return http.patch<PvPublishResult>(
    PV_API_ENDPOINTS.PRODUCT_PUBLISH(skuId),
    { published },
    ifMatch(assertVersion(profileVersion, "publish App PV")),
  );
}
