import { MenuItem, Select } from "@mui/material";

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
/** @deprecated internal của DataTable (adapter antd, freeze tới Part 4) — canonical: UiPagination. */
export function PageSizeSelector({
  current,
  pageSize,
  pageSizeOptions = [10, 20, 50],
  onChange,
}: PageSizeSelectorProps) {
  return (
    <Select
      value={pageSize}
      sx={{ width: 110 }}
      inputProps={{ "aria-label": "Số bản ghi mỗi trang" }}
      onChange={(event) => onChange(current, Number(event.target.value))}
    >
      {pageSizeOptions.map((size) => (
        <MenuItem key={size} value={size}>
          {size} / trang
        </MenuItem>
      ))}
    </Select>
  );
}
