/**
 * Foundation Pagination — thanh phân trang canonical Vuexy: tổng bản ghi bên
 * trái, Select cỡ trang + nút chuyển trang bên phải. Server-side pagination:
 * component không giữ state, mọi thay đổi đi qua callback của caller.
 */
import Box from "@mui/material/Box";
import MenuItem from "@mui/material/MenuItem";
import Pagination from "@mui/material/Pagination";
import Select from "@mui/material/Select";
import { SPACING } from "@/shared/ui/tokens";
import { UiText } from "./UiText";
import { useT } from "@/shared/i18n/useT";

export interface UiPaginationProps {
  /** Trang hiện tại (bắt đầu từ 1). */
  page: number;
  /** Số bản ghi mỗi trang. */
  pageSize: number;
  /** Tổng số bản ghi. */
  total: number;
  onPageChange: (page: number) => void;
  /** Không truyền → ẩn Select chọn cỡ trang. */
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  /** Hiện "Tổng {total} bản ghi" bên trái. Mặc định true. */
  showTotal?: boolean;
  disabled?: boolean;
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export function UiPagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  showTotal = true,
  disabled = false,
}: UiPaginationProps) {
  const t = useT();
  // Phòng thủ NaN/undefined từ payload lỗi: Math.max(1, NaN) = NaN sẽ làm MUI
  // Pagination render chữ "NaN" — chuẩn hoá về số hữu hạn trước khi tính.
  const safeTotal = Number.isFinite(total) ? Math.max(0, total) : 0;
  const safeSize = Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 1;
  // Số trang tối thiểu 1 — total=0 vẫn render đủ khung (không giật layout).
  const pageCount = Math.max(1, Math.ceil(safeTotal / safeSize));
  const safePage = Math.min(
    Math.max(1, Number.isFinite(page) ? page : 1),
    pageCount,
  );

  // pageSize hiện tại (vd BE trả per_page=15) có thể nằm ngoài mốc chuẩn —
  // vẫn phải liệt kê để Select hiển thị đúng lựa chọn hiện tại (MUI Select
  // cảnh báo và hiện rỗng nếu value không khớp MenuItem nào).
  const sizeOptions = pageSizeOptions.includes(safeSize)
    ? pageSizeOptions
    : [...pageSizeOptions, safeSize].sort((a, b) => a - b);

  return (
    <Box
      component="nav"
      aria-label={t("shared.table.pagination")}
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: showTotal ? "space-between" : "flex-end",
        flexWrap: "wrap",
        gap: `${SPACING.sm}px`,
      }}
    >
      {showTotal ? (
        <UiText variant="secondary">
          {t("shared.table.totalRecords", { total: safeTotal })}
        </UiText>
      ) : null}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: `${SPACING.sm}px`,
        }}
      >
        {onPageSizeChange ? (
          <Select
            size="small"
            value={safeSize}
            disabled={disabled}
            inputProps={{ "aria-label": t("shared.table.perPageAria") }}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {sizeOptions.map((size) => (
              <MenuItem key={size} value={size}>
                {t("shared.table.perPage", { size })}
              </MenuItem>
            ))}
          </Select>
        ) : null}
        <Pagination
          size="small"
          shape="rounded"
          color="primary"
          count={pageCount}
          page={safePage}
          disabled={disabled}
          onChange={(_event, nextPage) => onPageChange(nextPage)}
        />
      </Box>
    </Box>
  );
}
