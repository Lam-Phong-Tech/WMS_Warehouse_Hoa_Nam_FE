import { UiText } from "@/shared/ui";
import { UiPagination } from "@/shared/ui/components/UiPagination";

export interface TopPaginationProps {
  /** Tổng số bản ghi */
  total: number;
  /** Trang hiện tại (bắt đầu từ 1) */
  current: number;
  /** Số bản ghi hiện tại trên trang */
  pageSize: number;
  /** Tên đơn vị (vd: "nhân sự", "phòng ban") */
  unitName?: string;
  /** Các tùy chọn page size */
  pageSizeOptions?: number[];
  /** Callback khi thay đổi trang hoặc số bản ghi/trang */
  onChange: (page: number, pageSize: number) => void;
  /** Vị trí hiển thị: 'top' (mặc định, margin dưới) hoặc 'bottom' (margin trên). */
  placement?: "top" | "bottom";
  /** Hiển thị dropdown chọn số bản ghi/trang. Mặc định true. */
  showSizeChanger?: boolean;
}

/**
 * Thanh phân trang ở phía trên bảng: tổng số bản ghi, nút chuyển trang
 * (Prev/Next/số trang) và dropdown chọn số bản ghi/trang. Dùng cho
 * server-side pagination — `onChange` nhận cả page lẫn pageSize mới.
 *
 * @deprecated compatibility adapter — dùng UiPagination cho code mới.
 * Public API giữ nguyên; phần render đã chuyển từ antd Pagination sang
 * UiPagination (label tổng render riêng để giữ `unitName`).
 */
export function TopPagination({
  total,
  current,
  pageSize,
  unitName = "bản ghi",
  pageSizeOptions = [10, 20, 50],
  onChange,
  placement = "top",
  showSizeChanger = true,
}: TopPaginationProps) {
  // Đổi cỡ trang: kẹp lại trang hiện tại theo số trang mới (cùng ngữ nghĩa
  // onShowSizeChange của antd cũ — caller nhận (page đã kẹp, pageSize mới)).
  const handlePageSizeChange = (nextSize: number) => {
    const nextMax = Math.max(1, Math.ceil(total / Math.max(1, nextSize)));
    onChange(Math.min(Math.max(1, current), nextMax), nextSize);
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 8,
        ...(placement === "bottom" ? { marginTop: 12 } : { marginBottom: 12 }),
      }}
    >
      <UiText variant="secondary">
        Tổng {total} {unitName}
      </UiText>
      <UiPagination
        page={current}
        pageSize={pageSize}
        total={total}
        showTotal={false}
        pageSizeOptions={pageSizeOptions}
        onPageChange={(nextPage) => onChange(nextPage, pageSize)}
        onPageSizeChange={showSizeChanger ? handlePageSizeChange : undefined}
      />
    </div>
  );
}
