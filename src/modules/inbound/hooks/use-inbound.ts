import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  invalidateMasterDerived,
  invalidateStockDerived,
} from "@/shared/cache/invalidation";
import {
  cancelInboundDocument,
  completeInboundCartonScan,
  completeInboundLineSku,
  createInboundDocument,
  ensureComponentLine,
  fetchInboundDetail,
  fetchInboundDocuments,
  fetchInboundScanEntries,
  postInboundReceipt,
  registerInboundBox,
  scanInboundDocument,
  unscanInboundEntry,
  updateInboundDocument,
} from "@/modules/inbound/services/inboundService";
import type {
  CompleteInboundLineSkuPayload,
  CreateInboundPayload,
  PostReceiptRequest,
  UpdateInboundPayload,
} from "@/modules/inbound/types";

type InboundListParams = {
  search?: string;
  status?: string;
  page?: number;
  per_page?: number;
};
export const inboundKeys = {
  all: ["inbound"] as const,
  list: (params: InboundListParams) =>
    [...inboundKeys.all, "list", params] as const,
  detail: (id: string) => [...inboundKeys.all, "detail", id] as const,
  scanEntries: (id: string, status: "ACTIVE" | "ALL") =>
    [...inboundKeys.all, "scan-entries", id, status] as const,
};
export function useInboundDocuments(params: InboundListParams) {
  return useQuery({
    queryKey: inboundKeys.list(params),
    queryFn: () => fetchInboundDocuments(params),
  });
}
export function useInboundDetail(id: string | null | undefined) {
  return useQuery({
    queryKey: inboundKeys.detail(id ?? ""),
    queryFn: () => fetchInboundDetail(id ?? ""),
    enabled: Boolean(id),
  });
}
/**
 * Annex D SCR-IN-01: bảng mã đã quét phải đọc lại được sau khi tải lại trang, nên
 * nó là query server chứ không phải state trong phiên thao tác.
 */
export function useInboundScanEntries(
  id: string | null | undefined,
  status: "ACTIVE" | "ALL" = "ACTIVE",
) {
  return useQuery({
    queryKey: inboundKeys.scanEntries(id ?? "", status),
    queryFn: () => fetchInboundScanEntries(id ?? "", status),
    enabled: Boolean(id),
  });
}

/**
 * `onError` khai RỖNG có chủ đích: mọi component gọi các hook dưới đây đã tự
 * xử lý lỗi theo đúng ngữ cảnh của mình (toast + refetch lại query, có nơi còn
 * ghi vào nhật ký quét hiển thị trong modal, có nơi phải NGĂN toast để mở
 * dialog khác thay vào đó — vd NEW_SKU_TYPE_REQUIRED ở MvpInboundScreens.tsx).
 * Nếu để trống hoàn toàn (không khai onError), global `MutationCache` trong
 * query-client.ts sẽ TỰ bắn thêm một toast chung chung nữa mỗi khi mutation
 * lỗi, chồng lên toast/luồng riêng của component → thấy 2 thông báo cho cùng
 * một lỗi. Khai `onError` rỗng ở đây chỉ để CHẶN lưới an toàn đó, không đảm
 * nhận việc hiển thị (nơi gọi lo hết).
 */
function useInvalidateInboundMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    // Ghi sổ phiếu nhập làm đổi SỐ TỒN, bảng điều khiển và mọi báo cáo XNT —
    // những khoá đó nằm ngoài `inboundKeys.all` nên trước đây không ai làm mới,
    // và màn hình tồn kho tiếp tục hiện số cũ. Xem @/shared/cache/invalidation.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: inboundKeys.all }),
        invalidateStockDerived(queryClient),
      ]),
    onError: () => {
      // Im lặng có chủ đích — xem docblock ở trên.
    },
  });
}
export function useCreateInbound() {
  return useInvalidateInboundMutation((payload: CreateInboundPayload) =>
    createInboundDocument(payload),
  );
}
export function useUpdateInbound() {
  return useInvalidateInboundMutation(
    ({
      id,
      payload,
      ifMatch,
    }: {
      id: string;
      payload: UpdateInboundPayload;
      ifMatch: number;
    }) => updateInboundDocument(id, payload, ifMatch),
  );
}
export function useCancelInbound() {
  return useInvalidateInboundMutation(
    ({
      id,
      reason,
      ifMatch,
    }: {
      id: string;
      reason: string;
      ifMatch: number;
    }) => cancelInboundDocument(id, reason, ifMatch),
  );
}
/**
 * GĐ1 COMPONENT theo Box: materialize dòng linh kiện theo SKU thực nhận —
 * idempotent, không nhập số lượng dự kiến.
 */
export function useEnsureComponentLine() {
  return useInvalidateInboundMutation(
    ({ id, skuId }: { id: string; skuId: string }) =>
      ensureComponentLine(id, skuId),
  );
}
export function useRegisterInboundBox() {
  return useInvalidateInboundMutation(
    ({
      id,
      lineId,
      boxCode,
    }: {
      id: string;
      lineId: string;
      boxCode: string;
    }) => registerInboundBox(id, lineId, boxCode),
  );
}
export function useScanInbound() {
  return useInvalidateInboundMutation(
    ({
      id,
      code,
      lineId,
      ifMatch,
      includeCodeValue,
      quantity,
      containerId,
      newSkuType,
      idempotencyKey,
    }: {
      id: string;
      code: string;
      /**
       * Change Pack QR/SKU (DEC-QR-001): bỏ trống với scan PRODUCT — server tự
       * match dòng theo SKU embedded trong QR composite.
       */
      lineId?: string;
      ifMatch: number;
      includeCodeValue: boolean;
      quantity?: number;
      containerId?: string;
      /**
       * Loại người dùng chọn cho SKU mới khi quét mã item lần đầu (PRODUCT/
       * COMPONENT). Bỏ trống với SKU đã tồn tại.
       */
      newSkuType?: "PRODUCT" | "COMPONENT";
      /**
       * WWHN-187 (DEV187-P1-07): caller giữ key của hành động quét và truyền lại
       * đúng key đó khi gửi lại, để BE replay thay vì cộng đôi `scanned_qty`.
       */
      idempotencyKey?: string;
    }) =>
      scanInboundDocument(id, [code], {
        lineId,
        ifMatch,
        includeCodeValue,
        quantity,
        containerId,
        newSkuType,
        idempotencyKey,
      }),
  );
}
/**
 * Inbound Carton Scan v1.0 §3.3/§4.5: mốc "Đã quét xong thùng" — audit-only,
 * stock-neutral. Invalidate inbound queries để count theo carton luôn đúng.
 */
export function useCompleteInboundCartonScan() {
  return useInvalidateInboundMutation(
    ({ id, containerId }: { id: string; containerId: string }) =>
      completeInboundCartonScan(id, containerId),
  );
}
export function useUnscanInbound() {
  return useInvalidateInboundMutation(
    ({
      id,
      entryId,
      ifMatch,
      reason,
    }: {
      id: string;
      entryId: string;
      ifMatch: number;
      reason?: string;
    }) => unscanInboundEntry(id, entryId, ifMatch, reason),
  );
}

/**
 * Bổ sung thông tin cho SKU mới ngay trong phiếu nhập. Ngoài cache phiếu nhập
 * còn phải làm mới cache MASTER: thao tác này sửa chính bản ghi SKU, nên màn
 * Danh mục SKU và bộ lọc "SKU chờ điền thông tin" đang mở phải thấy ngay.
 */
export function useCompleteInboundLineSku() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      lineId,
      payload,
    }: {
      id: string;
      lineId: string;
      payload: CompleteInboundLineSkuPayload;
    }) => completeInboundLineSku(id, lineId, payload),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: inboundKeys.all }),
        invalidateMasterDerived(queryClient),
      ]),
    onError: () => {
      // Im lặng có chủ đích — xem docblock của useInvalidateInboundMutation.
    },
  });
}

export function usePostInboundReceipt() {
  return useInvalidateInboundMutation((payload: PostReceiptRequest) =>
    postInboundReceipt(payload),
  );
}
