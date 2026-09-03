/**
 * Hành vi nút "Làm mới" dùng CHUNG cho cả 8 màn Báo cáo.
 *
 * VÌ SAO CÓ FILE NÀY (phản hồi người dùng 2026-09-03: "ấn vào cảm giác như
 * không có gì cả"): trước đây mỗi màn chỉ gọi `refetch()` rồi đặt
 * `disabled={isFetching}`. Trên máy nội bộ một lượt gọi lại xong trong ~50ms,
 * nên trạng thái disabled chớp qua không kịp thấy; và nếu số liệu không đổi thì
 * TRÊN MÀN KHÔNG CÓ MỘT PIXEL NÀO nhúc nhích — người dùng không có cách nào
 * biết nút vừa làm việc hay đã chết.
 *
 * Ba thứ hook này bảo đảm, giống hệt nhau ở cả 8 màn:
 *  1. Nút vào trạng thái `loading` (spinner) trong suốt lượt gọi lại.
 *  2. Trạng thái đó hiển thị TỐI THIỂU `MIN_BUSY_MS` — đây KHÔNG phải làm chậm
 *     dữ liệu: dữ liệu về lúc nào dùng lúc đó, chỉ riêng phần hiển thị "đang
 *     bận" được giữ đủ lâu để mắt kịp thấy. Không có ngưỡng này thì spinner
 *     nhấp nháy một phần mười giây, còn tệ hơn là không có.
 *  3. Xong thì báo bằng toast — mốc "Dữ liệu lúc HH:mm" trên màn cũng đổi theo,
 *     nên người dùng có hai bằng chứng độc lập là số liệu vừa được lấy lại.
 *     Hỏng thì hiện đúng thông điệp lỗi của API, không im lặng.
 *
 * KHÔNG nuốt lỗi: `refetch` của React Query không reject khi request hỏng (lỗi
 * nằm trong `query.error`), nên hook nhận thêm `readError` để đọc trạng thái
 * lỗi SAU lượt gọi và báo đúng sự thật.
 */
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import dayjs from "dayjs";
import { getApiErrorMessage } from "@/shared/api/api-error";

/**
 * Thời lượng tối thiểu của trạng thái "đang làm mới".
 *
 * 420ms ≈ hai lần `MOTION.duration.normal` (200ms) — đủ để spinner quay trọn
 * một nhịp và mắt ghi nhận, vẫn dưới ngưỡng 1s mà người dùng bắt đầu thấy chậm.
 */
const MIN_BUSY_MS = 420;

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

export type ReportRefreshOptions = {
  /** Gọi lại toàn bộ nguồn dữ liệu của màn. */
  refetch: () => unknown;
  /**
   * Đọc lỗi hiện tại của màn SAU lượt gọi lại. Trả `null`/`undefined` là thành
   * công. Bỏ trống khi màn tự hiện lỗi bằng banner riêng.
   */
  readError?: () => unknown;
  /** Việc cần làm trước khi gọi lại (vd đưa bộ lọc về mặc định). */
  beforeRefetch?: () => void;
  /** Câu báo thành công; mặc định kèm mốc giờ vừa lấy số liệu. */
  successMessage?: string;
};

export type ReportRefreshState = {
  /** Nút đang ở trạng thái bận — truyền vào `loading` của UiButton. */
  refreshing: boolean;
  /** Handler cho `onClick` của nút "Làm mới". */
  refresh: () => void;
};

export function useReportRefresh({
  refetch,
  readError,
  beforeRefetch,
  successMessage,
}: ReportRefreshOptions): ReportRefreshState {
  const [refreshing, setRefreshing] = useState(false);
  /** Chặn bấm dồn: đang chạy mà bấm nữa thì bỏ qua, không xếp hàng thêm lượt. */
  const runningRef = useRef(false);

  const refresh = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    setRefreshing(true);

    void (async () => {
      try {
        beforeRefetch?.();
        await Promise.all([Promise.resolve(refetch()), wait(MIN_BUSY_MS)]);
        const error = readError?.();
        if (error !== null && error !== undefined) {
          toast.error(getApiErrorMessage(error, "Làm mới số liệu thất bại."));
          return;
        }
        toast.success(
          successMessage ??
            `Đã cập nhật số liệu lúc ${dayjs().format("HH:mm")}`,
        );
      } catch (error) {
        toast.error(getApiErrorMessage(error, "Làm mới số liệu thất bại."));
      } finally {
        runningRef.current = false;
        setRefreshing(false);
      }
    })();
  }, [refetch, readError, beforeRefetch, successMessage]);

  return { refreshing, refresh };
}
