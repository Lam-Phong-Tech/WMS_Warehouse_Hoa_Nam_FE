import { MenuItem, Select } from "@mui/material";
import { UiPagination } from "@/shared/ui/components/UiPagination";
import { MVP_PAGE_SIZE_OPTIONS } from "@/shared/components/mvp/mvp-pagination";
import { useT } from "@/shared/i18n/useT";

interface PageSizeSelectorProps {
  value: number;
  onChange: (value: number) => void;
  /** Optional screen-scoped styling for the dropdown portal. */
  menuClassName?: string;
}

interface PaginationFooterProps {
  current: number;
  pageSize: number;
  total: number;
  itemLabel: string;
  onChange: (page: number) => void;
}

/**
 * @deprecated compatibility adapter — dùng UiPagination (có Select cỡ trang
 * tích hợp) cho code mới.
 */
export function MvpPageSizeSelector({
  value,
  onChange,
  menuClassName,
}: PageSizeSelectorProps) {
  const t = useT();
  // Giá trị hiện tại (vd: per_page=15 do BE trả về) có thể không nằm trong
  // các mốc chuẩn — vẫn phải liệt kê để Select hiển thị đúng lựa chọn hiện tại
  // (Select của MUI cảnh báo và hiện rỗng nếu value không khớp MenuItem nào).
  const options = MVP_PAGE_SIZE_OPTIONS.includes(
    value as (typeof MVP_PAGE_SIZE_OPTIONS)[number],
  )
    ? MVP_PAGE_SIZE_OPTIONS
    : [...MVP_PAGE_SIZE_OPTIONS, value].sort((a, b) => a - b);

  return (
    // Trước đây là <select> thuần (cho khớp chiều cao với các bộ lọc cũ cùng
    // class "select"). Các bộ lọc đó nay đã chuyển hết sang MUI/antd, nên ô này
    // thành thứ duy nhất còn bung menu theo kiểu hệ điều hành: phông, màu bôi
    // đen và tốc độ đều lệch phần còn lại của app. Đổi sang Select của MUI để
    // menu ăn theme và có hiệu ứng như mọi dropdown khác.
    // Theme lấy từ AppThemeProvider ở composition root — context xuyên qua portal.
    <div className="table-page-size">
      <Select
        MenuProps={
          menuClassName
            ? { slotProps: { paper: { className: menuClassName } } }
            : undefined
        }
        value={value}
        sx={{ width: 130 }}
        inputProps={{ "aria-label": t("shared.table.rowsPerPageAria") }}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {options.map((size) => (
          <MenuItem key={size} value={size}>
            {t("shared.table.perPage", { size })}
          </MenuItem>
        ))}
      </Select>
    </div>
  );
}

/**
 * @deprecated compatibility adapter — dùng UiPagination cho code mới.
 * Public API giữ nguyên (Tổng {total} {itemLabel} + nút chuyển trang); phần
 * render đã chuyển từ antd Pagination sang UiPagination.
 */
export function MvpPaginationFooter({
  current,
  pageSize,
  total,
  itemLabel,
  onChange,
}: PaginationFooterProps) {
  const t = useT();
  const maxPage = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const safeCurrent = Math.min(Math.max(1, current), maxPage);

  return (
    <div className="mvp-pagination-footer">
      <span>{t("shared.table.totalWithUnit", { total, unit: itemLabel })}</span>
      <UiPagination
        page={safeCurrent}
        pageSize={pageSize}
        total={total}
        showTotal={false}
        onPageChange={onChange}
      />
    </div>
  );
}
