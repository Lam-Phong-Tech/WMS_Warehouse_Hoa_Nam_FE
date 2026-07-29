import { Select } from "antd";

export interface PageSizeSelectorProps {
  /** Trang hiện tại (bắt đầu từ 1) */
  current: number;
  /** Số bản ghi hiện tại trên trang */
  pageSize: number;
  /** Các tùy chọn số bản ghi/trang */
  pageSizeOptions?: number[];
  /** Callback khi đổi số bản ghi/trang (giữ nguyên trang hiện tại) */
  onChange: (page: number, pageSize: number) => void;
}

/** Dropdown chọn số bản ghi/trang, hiển thị độc lập (vd: phía trên bảng, tách khỏi thanh phân trang ở dưới). */
export function PageSizeSelector({
  current,
  pageSize,
  pageSizeOptions = [15, 20, 50, 100],
  onChange,
}: PageSizeSelectorProps) {
  return (
    <Select
      size="small"
      value={pageSize}
      style={{ width: 110 }}
      showSearch={false}
      options={pageSizeOptions.map((size) => ({
        value: size,
        label: `${size} / trang`,
      }))}
      onChange={(newPageSize) => onChange(current, newPageSize)}
    />
  );
}
