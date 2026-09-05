import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { invalidateStockDerived } from "@/shared/cache/invalidation";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/shared/api/api-error";
import {
  classifyConcurrencyError,
  isRetryableAfterReload,
} from "@/shared/api/concurrency-contract";
import { useT } from "@/shared/i18n/useT";
import type { MessageKey } from "@/shared/i18n/messages";
import {
  createWarrantyCase,
  deleteWarrantyAttachment,
  fetchWarrantyAttachments,
  fetchWarrantyCase,
  fetchWarrantyCaseEvents,
  fetchWarrantyCases,
  updateWarrantyCase,
  uploadWarrantyAttachment,
} from "@/modules/warranty/services/warrantyService";
import {
  cancelComponentIssue,
  createComponentIssue,
  fetchComponentIssueDocument,
  fetchComponentIssueDocuments,
  postComponentIssue,
  scanComponentIssue,
  type ComponentIssueCreateRequest,
  type ComponentIssueListParams,
} from "@/modules/warranty/services/componentIssueService";
import type {
  CreateWarrantyCaseRequest,
  UpdateWarrantyCaseRequest,
  WarrantyAttachmentType,
  WarrantyListParams,
} from "@/modules/warranty/types";

export const warrantyKeys = {
  all: ["warranty"] as const,
  list: (params: WarrantyListParams) =>
    [...warrantyKeys.all, "list", params] as const,
  detail: (id: string) => [...warrantyKeys.all, "detail", id] as const,
  events: (id: string) => [...warrantyKeys.all, "events", id] as const,
  attachments: (id: string) =>
    [...warrantyKeys.all, "attachments", id] as const,
  componentIssues: (params: ComponentIssueListParams) =>
    [...warrantyKeys.all, "component-issues", params] as const,
  componentIssueDetail: (id: string) =>
    [...warrantyKeys.all, "component-issue", id] as const,
};

export function useWarrantyCases(params: WarrantyListParams) {
  return useQuery({
    queryKey: warrantyKeys.list(params),
    queryFn: () => fetchWarrantyCases(params),
  });
}

export function useWarrantyCase(id: string | null | undefined) {
  return useQuery({
    queryKey: warrantyKeys.detail(id ?? ""),
    queryFn: () => fetchWarrantyCase(id ?? ""),
    enabled: Boolean(id),
  });
}

export function useWarrantyEvents(id: string | null | undefined) {
  return useQuery({
    queryKey: warrantyKeys.events(id ?? ""),
    queryFn: () => fetchWarrantyCaseEvents(id ?? ""),
    enabled: Boolean(id),
  });
}

export function useWarrantyAttachments(id: string | null | undefined) {
  return useQuery({
    queryKey: warrantyKeys.attachments(id ?? ""),
    queryFn: () => fetchWarrantyAttachments(id ?? ""),
    enabled: Boolean(id),
  });
}

export function useComponentIssues(
  params: ComponentIssueListParams,
  enabled = true,
) {
  return useQuery({
    queryKey: warrantyKeys.componentIssues(params),
    queryFn: () => fetchComponentIssueDocuments(params),
    enabled,
  });
}

export function useComponentIssueDetail(id: string | null | undefined) {
  return useQuery({
    queryKey: warrantyKeys.componentIssueDetail(id ?? ""),
    queryFn: () => fetchComponentIssueDocument(id ?? ""),
    enabled: Boolean(id),
  });
}

/**
 * Chi tiết NHIỀU phiếu xuất linh kiện cùng lúc — dùng cho nhãn trả máy, nơi
 * phải liệt kê linh kiện đã thay của cả hồ sơ.
 *
 * Bắt buộc gọi từng phiếu: `/warranty-component-issues` (danh sách) trả dòng
 * thô của bảng `component_issue_documents`, KHÔNG kèm `lines`; chỉ
 * `/warranty-component-issues/{id}` mới có SKU và số lượng. Một hồ sơ thực tế
 * chỉ có vài phiếu nên đây là vài request chứ không phải N+1 mất kiểm soát, và
 * `useQueries` dùng CHUNG queryKey với `useComponentIssueDetail` nên phiếu nào
 * đã mở trong modal chi tiết thì lấy thẳng từ cache.
 */
export function useComponentIssueDetails(ids: string[], enabled = true) {
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: warrantyKeys.componentIssueDetail(id),
      queryFn: () => fetchComponentIssueDocument(id),
      enabled,
    })),
  });
}

/**
 * `onError` khai NGAY TẠI ĐÂY khi có `errorFallback` (không để trống cho
 * global `MutationCache` safety net trong query-client.ts lo) — mutation nào
 * không tự khai onError thì lưới an toàn toàn cục sẽ tự bắn thêm một toast
 * nữa; trước đây các hook dưới đây để trống và component gọi TỰ toast thêm
 * lần nữa trong catch, gây hiện đúng một lỗi nhưng thấy 2 toast chồng nhau
 * (mỗi cái đọc một chỗ khác nhau). `errorFallback` giữ đúng câu nghiệp vụ cụ
 * thể cho từng hành động (thay vì câu chung chung của safety net); KHÔNG nối
 * request_id vào đây — đó là mã tra cứu kỹ thuật cho việc debug, người dùng
 * đọc không hiểu và không cần thấy trong toast (xem ApiErrorAlert.tsx:
 * request_id chỉ hiện ở dòng phụ có nhãn rõ, không bao giờ nối thẳng vào câu
 * chính).
 *
 * Bỏ trống `errorFallback` (hook dùng trong vòng lặp `Promise.allSettled` để
 * gộp N lỗi thành một toast tổng kết, hoặc component tự dựng UI lỗi riêng —
 * xem useUploadWarrantyAttachment/useDeleteWarrantyAttachment): `onError` vẫn
 * được khai (rỗng) chỉ để CHẶN lưới an toàn toàn cục tự bắn thêm toast — im
 * lặng hoàn toàn ở tầng hook, để nguyên trách nhiệm hiển thị cho nơi gọi.
 */
function useInvalidateWarrantyMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
  errorFallback?: MessageKey,
) {
  const queryClient = useQueryClient();
  const t = useT();
  // Xuất linh kiện bảo hành trừ tồn kho thật -> phải làm mới cả tồn/dashboard/
  // báo cáo, không chỉ cache của module bảo hành.
  const reload = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: warrantyKeys.all }),
      invalidateStockDerived(queryClient),
    ]);
  return useMutation({
    mutationFn,
    onSuccess: reload,
    onError: (error: unknown) => {
      // SRS §8.2 / AC-GWT-CONC-001: 412 STALE_VERSION và 409
      // CONCURRENCY_CONFLICT nghĩa là bản ghi đã đổi dưới chân form (tab thứ
      // hai, mini app, người khác). KHÔNG tải lại ở đây thì cache vẫn giữ
      // version cũ — staleTime 60s + refetchOnWindowFocus=false nghĩa là
      // không có gì kích hoạt refetch khi modal đang mở — nên MỌI lần bấm lại
      // đều gửi đúng version cũ đó và nhận lại đúng 412: người dùng kẹt trong
      // dialog. Tải lại ở đây để lần bấm sau gửi version hiện hành; KHÔNG tự
      // gửi lại hộ (auto-retry là cách nhanh nhất tạo double-post).
      const outcome = classifyConcurrencyError(error);
      if (outcome !== null && isRetryableAfterReload(outcome)) {
        void reload();
      }
      // errorFallback rỗng: im lặng có chủ đích — xem docblock ở trên. onError
      // vẫn phải được khai để lưới an toàn toàn cục không bắn thêm toast.
      if (errorFallback) {
        toast.error(getApiErrorMessage(error, t(errorFallback)));
      }
    },
  });
}

export function useCreateWarrantyCase() {
  return useInvalidateWarrantyMutation(
    (payload: CreateWarrantyCaseRequest) => createWarrantyCase(payload),
    "warranty.error.createCase",
  );
}

// Không truyền errorFallback: WarrantyDetailModal.tsx dùng lại đúng MỘT hook
// này cho 2 hành động khác nhau (đổi trạng thái case / sửa thông tin case),
// mỗi hành động cần một câu fallback riêng — để component tự toast theo đúng
// ngữ cảnh, hook toast sẵn ở đây sẽ vừa sai câu vừa gây trùng.
export function useUpdateWarrantyCase() {
  return useInvalidateWarrantyMutation(
    ({ id, request }: { id: string; request: UpdateWarrantyCaseRequest }) =>
      updateWarrantyCase(id, request),
  );
}

// Không truyền errorFallback: cả 2 nơi gọi (WarrantyIntakeModal — batch nhiều
// file qua Promise.allSettled, gộp thành 1 toast tổng kết; WarrantyDetailModal
// — tự toast lỗi riêng cho từng thao tác) đều đã tự xử lý hiển thị lỗi theo
// đúng ngữ cảnh của mình; hook toast thêm ở đây sẽ chỉ gây trùng.
export function useUploadWarrantyAttachment() {
  return useInvalidateWarrantyMutation(
    (input: {
      caseId: string;
      file: File;
      attachmentType?: WarrantyAttachmentType;
    }) => uploadWarrantyAttachment(input),
  );
}

export function useDeleteWarrantyAttachment() {
  return useInvalidateWarrantyMutation((attachmentId: string) =>
    deleteWarrantyAttachment(attachmentId),
  );
}

export function useCreateComponentIssue() {
  return useInvalidateWarrantyMutation(
    (payload: ComponentIssueCreateRequest) => createComponentIssue(payload),
    "warranty.error.createComponentIssue",
  );
}

export function useScanComponentIssue() {
  return useInvalidateWarrantyMutation(
    (input: {
      documentId: string;
      lineId: string;
      codeValue: string;
      quantity: number;
      ifMatch: number;
    }) => scanComponentIssue(input),
    "warranty.error.scanComponent",
  );
}

export function useCancelComponentIssue() {
  return useInvalidateWarrantyMutation(
    (input: { documentId: string; reason: string; ifMatch: number }) =>
      cancelComponentIssue(input),
    "warranty.error.cancelDocument",
  );
}

export function usePostComponentIssue() {
  return useInvalidateWarrantyMutation(
    (input: { documentId: string; ifMatch: number; idempotencyKey: string }) =>
      postComponentIssue(input),
    "warranty.error.postComponentIssue",
  );
}
