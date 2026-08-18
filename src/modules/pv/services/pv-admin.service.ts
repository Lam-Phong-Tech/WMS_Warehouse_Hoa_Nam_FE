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
    ifMatch(version),
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
    ifMatch(version),
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
    ifMatch(version),
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
    ifMatch(version),
  );
}

/** REQ-SRS-020 — permission RIÊNG `pv.publish`, không phải pv.master.manage. */
export function setPvProductPublished(skuId: string, published: boolean) {
  return http.patch<{ published_to_app: boolean }>(
    PV_API_ENDPOINTS.PRODUCT_PUBLISH(skuId),
    { published },
  );
}
