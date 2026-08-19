import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getPvIndustries,
  getPvProduct,
  getPvProducts,
  getPvRecommendations,
} from "@/modules/pv/services/pv-public.service";
import {
  createPvIndustry,
  createPvProfile,
  createPvRule,
  createPvTag,
  listPvAdminResources,
  setPvProductPublished,
  updatePvIndustry,
  updatePvProfile,
  updatePvRule,
  updatePvTag,
} from "@/modules/pv/services/pv-admin.service";
import type {
  PvAdminProfile,
  PvAdminProfilePayload,
  PvAdminRule,
  PvAdminRulePayload,
  PvAdminSimpleMaster,
  PvAdminSimpleMasterPayload,
  PvProductQuery,
} from "@/modules/pv/types/pv.types";
import type { PublicApiError } from "@/shared/api/public-http";

export const pvKeys = {
  all: ["pv"] as const,
  products: (query: PvProductQuery) =>
    [...pvKeys.all, "products", query] as const,
  product: (skuId: string) => [...pvKeys.all, "product", skuId] as const,
  industries: () => [...pvKeys.all, "industries"] as const,
  recommendations: (industryId: string) =>
    [...pvKeys.all, "recommendations", industryId] as const,
  admin: (resource: string, params: Record<string, unknown>) =>
    [...pvKeys.all, "admin", resource, params] as const,
};

/**
 * WWHN-289/WWHN-252: 429 RATE_LIMIT_EXCEEDED nằm trong error set của mọi
 * operation PV ẩn danh. Retry một request đã bị khoá chỉ làm cửa sổ khoá dài
 * thêm, nên tuyệt đối không retry 429; 4xx khác cũng không đáng retry vì chúng
 * là lỗi tham số/không tìm thấy, gọi lại vẫn cho cùng kết quả.
 */
function shouldRetryPublic(failureCount: number, error: unknown): boolean {
  const status = (error as PublicApiError)?.status;
  if (status !== undefined && status >= 400 && status < 500) return false;
  return failureCount < 2;
}

export function usePvProducts(query: PvProductQuery) {
  return useQuery({
    queryKey: pvKeys.products(query),
    queryFn: () => getPvProducts(query),
    retry: shouldRetryPublic,
    // NFR-SRS-016: read model tồn kho có max staleness <= 60s. Giữ staleTime
    // dưới ngưỡng đó để cache của client không tự tạo ra dữ liệu quá hạn.
    staleTime: 30_000,
  });
}

export function usePvProduct(skuId: string | undefined) {
  return useQuery({
    queryKey: pvKeys.product(skuId ?? ""),
    queryFn: () => getPvProduct(skuId as string),
    enabled: Boolean(skuId),
    retry: shouldRetryPublic,
    staleTime: 30_000,
  });
}

export function usePvIndustries() {
  return useQuery({
    queryKey: pvKeys.industries(),
    queryFn: getPvIndustries,
    retry: shouldRetryPublic,
    staleTime: 5 * 60_000,
  });
}

export function usePvRecommendations(industryId: string | undefined) {
  return useQuery({
    queryKey: pvKeys.recommendations(industryId ?? ""),
    queryFn: () => getPvRecommendations(industryId as string),
    enabled: Boolean(industryId),
    retry: shouldRetryPublic,
    staleTime: 60_000,
  });
}

// ---------------------------------------------------------------------------
// PV Admin
// ---------------------------------------------------------------------------

export function usePvAdminIndustries(params: Record<string, string> = {}) {
  return useQuery({
    queryKey: pvKeys.admin("industries", params),
    queryFn: () =>
      listPvAdminResources<PvAdminSimpleMaster>("industries", params),
  });
}

export function usePvAdminTags(params: Record<string, string> = {}) {
  return useQuery({
    queryKey: pvKeys.admin("tags", params),
    queryFn: () => listPvAdminResources<PvAdminSimpleMaster>("tags", params),
  });
}

export function usePvAdminRules(params: Record<string, string> = {}) {
  return useQuery({
    queryKey: pvKeys.admin("recommendation-rules", params),
    queryFn: () =>
      listPvAdminResources<PvAdminRule>("recommendation-rules", params),
  });
}

export function usePvAdminProfiles(params: Record<string, string> = {}) {
  return useQuery({
    queryKey: pvKeys.admin("product-profiles", params),
    queryFn: () =>
      listPvAdminResources<PvAdminProfile>("product-profiles", params),
  });
}

/**
 * Bốn hook lưu master PV trước đây rơi về `?? 1` khi thiếu version. Điều đó
 * biến If-Match thành số bịa và làm optimistic lock mất tác dụng đúng vào lúc
 * cần nhất (bản ghi vừa bị người khác sửa). Thiếu version là lỗi lập trình của
 * màn hình, phải nổ ngay chứ không được im lặng ghi đè.
 */
function requiredVersion(version: number | undefined): number {
  if (typeof version !== "number") {
    throw new Error(
      "Thiếu version bản ghi đang mở. Hãy tải lại danh sách rồi thử lại.",
    );
  }
  return version;
}

function useInvalidatePv() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: pvKeys.all });
}

export function useSavePvIndustry() {
  const invalidate = useInvalidatePv();
  return useMutation({
    mutationFn: (input: {
      id?: string;
      version?: number;
      payload: PvAdminSimpleMasterPayload;
    }) =>
      input.id
        ? updatePvIndustry(
            input.id,
            requiredVersion(input.version),
            input.payload,
          )
        : createPvIndustry(input.payload),
    onSuccess: invalidate,
  });
}

export function useSavePvTag() {
  const invalidate = useInvalidatePv();
  return useMutation({
    mutationFn: (input: {
      id?: string;
      version?: number;
      payload: PvAdminSimpleMasterPayload;
    }) =>
      input.id
        ? updatePvTag(input.id, requiredVersion(input.version), input.payload)
        : createPvTag(input.payload),
    onSuccess: invalidate,
  });
}

export function useSavePvRule() {
  const invalidate = useInvalidatePv();
  return useMutation({
    mutationFn: (input: {
      id?: string;
      version?: number;
      payload: PvAdminRulePayload;
    }) =>
      input.id
        ? updatePvRule(input.id, requiredVersion(input.version), input.payload)
        : createPvRule(input.payload),
    onSuccess: invalidate,
  });
}

export function useSavePvProfile() {
  const invalidate = useInvalidatePv();
  return useMutation({
    mutationFn: (input: {
      id?: string;
      version?: number;
      payload: PvAdminProfilePayload;
    }) =>
      input.id
        ? updatePvProfile(
            input.id,
            requiredVersion(input.version),
            input.payload,
          )
        : createPvProfile(input.payload),
    onSuccess: invalidate,
  });
}

/**
 * FE252-P1-08 — `profileVersion` là version hồ sơ App PV của đúng dòng người
 * dùng đang bấm (`PvAdminProfile.version`). Hook KHÔNG có giá trị mặc định:
 * không có version thì không có precondition, và một precondition bịa ra còn
 * nguy hiểm hơn là không gửi gì.
 *
 * Sau khi thành công phải invalidate để version mới (`pv_profile_version`) thay
 * chỗ version cũ trong cache — lần bấm kế tiếp phải dùng số mới, nếu không
 * chính FE tự tạo ra 412 STALE_VERSION cho mình.
 */
export function useSetPvPublished() {
  const invalidate = useInvalidatePv();
  return useMutation({
    mutationFn: (input: {
      skuId: string;
      published: boolean;
      profileVersion: number;
    }) =>
      setPvProductPublished(input.skuId, input.published, input.profileVersion),
    onSuccess: invalidate,
  });
}
