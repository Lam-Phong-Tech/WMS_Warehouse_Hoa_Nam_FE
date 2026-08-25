import { Pagination, Typography } from "antd";

const { Text } = Typography;

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
      <Text type="secondary">
        Tổng {total} {unitName}
      </Text>
      <Pagination
        size="small"
        total={total}
        current={current}
        pageSize={pageSize}
        showSizeChanger={showSizeChanger}
        pageSizeOptions={pageSizeOptions}
        onChange={onChange}
        onShowSizeChange={onChange}
      />
    </div>
  );
}
