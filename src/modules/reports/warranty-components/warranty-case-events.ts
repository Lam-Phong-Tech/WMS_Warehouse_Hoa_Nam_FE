/**
 * Lịch sử phân công của một hồ sơ bảo hành — mục "Lịch sử phân công" trong hộp
 * thoại đối soát của RPT-06.
 *
 * `/warranty-cases/{id}/events` là NGUỒN DUY NHẤT có mốc thời gian + người thực
 * hiện + diễn giải; hai endpoint báo cáo (`/reports/warranty-defects`,
 * `/warranty-cases`) không trả timeline. Endpoint này nằm sau quyền
 * `warranty.view`/`warranty.manage`, nên chỉ gọi khi actor thực sự có quyền —
 * gọi thiếu quyền sẽ ném ngay ở client và biến hộp thoại thành màn lỗi.
 */
import { useQuery } from "@tanstack/react-query";
import { fetchWarrantyCaseEvents } from "@/modules/warranty/services/warrantyService";

export function useWarrantyCaseEvents(caseId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["rpt-06", "warranty-case-events", caseId],
    queryFn: () => fetchWarrantyCaseEvents(caseId ?? ""),
    enabled: Boolean(caseId) && enabled,
    // GHI ĐÈ CÓ CHỦ Ý so với nhóm `report` (5 phút): dòng sự kiện của một hồ sơ
    // bảo hành đang xử lý phải bám sát thao tác của người khác trên cùng hồ sơ.
    staleTime: 60_000,
    retry: false,
  });
}
