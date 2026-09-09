import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invalidateMasterDerived } from "@/shared/cache/invalidation";
import {
  createMvpAgency,
  createMvpDefect,
  createMvpSku,
  getMvpAgencies,
  getMvpDefects,
  getMvpProductCatalogs,
  getMvpSkus,
  hasMvpSkuStock,
  setMvpSkuPublished,
  updateMvpAgency,
  updateMvpDefect,
  updateMvpSku,
} from "@/modules/master-data/services/mvp-master.service";
import type {
  AgencyPayload,
  DefectPayload,
  MasterListParams,
  SkuPayload,
} from "@/modules/master-data/types/mvp-master.types";

export const mvpMasterKeys = {
  all: ["mvp-master"] as const,
  skus: (params: MasterListParams) =>
    [...mvpMasterKeys.all, "skus", params] as const,
  agencies: (params: MasterListParams) =>
    [...mvpMasterKeys.all, "agencies", params] as const,
  defects: (params: MasterListParams) =>
    [...mvpMasterKeys.all, "defects", params] as const,
  productCatalogs: () => [...mvpMasterKeys.all, "product-catalogs"] as const,
};

export function useMvpSkus(
  params: MasterListParams,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: mvpMasterKeys.skus(params),
    queryFn: () => getMvpSkus(params),
    ...options,
  });
}

export function useMvpAgencies(params: MasterListParams) {
  return useQuery({
    queryKey: mvpMasterKeys.agencies(params),
    queryFn: () => getMvpAgencies(params),
  });
}

export function useMvpDefects(params: MasterListParams) {
  return useQuery({
    queryKey: mvpMasterKeys.defects(params),
    queryFn: () => getMvpDefects(params),
  });
}

// MST-01: danh mục Brand/Category/Model đổi ít, cache lâu để mỗi lần đổi trang
// SKU không phải nạp lại 3 danh mục.
export function useMvpProductCatalogs() {
  return useQuery({
    queryKey: mvpMasterKeys.productCatalogs(),
    queryFn: getMvpProductCatalogs,
  });
}

/**
 * Root `inventory` chứ KHÔNG phải `mvp-master`: đây là câu hỏi về TỒN KHO của
 * SKU, không phải thuộc tính master của SKU. Để dưới `mvp-master` thì nó thừa
 * hưởng chính sách master (stale 10 phút, persist xuống đĩa) — sai hoàn toàn cho
 * dữ liệu tồn. Dưới `inventory` nó nhận stale 15s và không bao giờ chạm đĩa.
 */
export function useMvpSkuHasStock(skuId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["inventory", "sku-has-stock", skuId],
    queryFn: () => hasMvpSkuStock(skuId),
    enabled: enabled && Boolean(skuId),
  });
}

/**
 * `onError` khai RỖNG có chủ đích: mọi component gọi các hook dưới đây
 * (ApiMasterScreens.tsx) đã tự toast + hiện banner lỗi cục bộ (setFormError/
 * setPublishError) cho cả create lẫn update. Không khai onError thì global
 * `MutationCache` (query-client.ts) sẽ tự bắn thêm một toast chung chung nữa
 * → thấy 2 thông báo cho cùng một lỗi. Khai rỗng ở đây chỉ để chặn lưới an
 * toàn đó, không đảm nhận việc hiển thị.
 */
function useInvalidateMasterMutation<TResult, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: mvpMasterKeys.all }),
        // Danh mục dùng chung nằm ở root `ref`; không làm mới ở đây thì mọi
        // dropdown khác giữ tên/mã cũ tới hết TTL của nhóm reference.
        invalidateMasterDerived(queryClient),
      ]),
    onError: () => {
      // Im lặng có chủ đích — xem docblock ở trên.
    },
  });
}

export function useCreateMvpSku() {
  return useInvalidateMasterMutation((payload: SkuPayload) =>
    createMvpSku(payload),
  );
}

export function useUpdateMvpSku() {
  return useInvalidateMasterMutation(
    ({
      id,
      version,
      payload,
    }: {
      id: string;
      version: number;
      payload: SkuPayload;
    }) => updateMvpSku(id, version, payload),
  );
}

export function useSetMvpSkuPublished() {
  return useInvalidateMasterMutation(
    ({
      id,
      version,
      publishedToApp,
    }: {
      id: string;
      version: number;
      publishedToApp: boolean;
    }) => setMvpSkuPublished(id, version, publishedToApp),
  );
}

export function useCreateMvpAgency() {
  return useInvalidateMasterMutation((payload: AgencyPayload) =>
    createMvpAgency(payload),
  );
}

export function useUpdateMvpAgency() {
  return useInvalidateMasterMutation(
    ({
      id,
      payload,
      version,
    }: {
      id: string;
      payload: AgencyPayload;
      version?: number | null;
    }) => updateMvpAgency(id, payload, version),
  );
}

export function useCreateMvpDefect() {
  return useInvalidateMasterMutation((payload: DefectPayload) =>
    createMvpDefect(payload),
  );
}

export function useUpdateMvpDefect() {
  return useInvalidateMasterMutation(
    ({
      id,
      payload,
      version,
    }: {
      id: string;
      payload: DefectPayload;
      version?: number | null;
    }) => updateMvpDefect(id, payload, version),
  );
}
