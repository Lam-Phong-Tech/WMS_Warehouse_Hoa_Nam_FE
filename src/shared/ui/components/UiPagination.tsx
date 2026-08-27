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
  // Số trang tối thiểu 1 — total=0 vẫn render đủ khung (không giật layout).
  const pageCount = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const safePage = Math.min(Math.max(1, page), pageCount);

  // pageSize hiện tại (vd BE trả per_page=15) có thể nằm ngoài mốc chuẩn —
  // vẫn phải liệt kê để Select hiển thị đúng lựa chọn hiện tại (MUI Select
  // cảnh báo và hiện rỗng nếu value không khớp MenuItem nào).
  const sizeOptions = pageSizeOptions.includes(pageSize)
    ? pageSizeOptions
    : [...pageSizeOptions, pageSize].sort((a, b) => a - b);

  return (
    <Box
      component="nav"
      aria-label="Phân trang"
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: showTotal ? "space-between" : "flex-end",
        flexWrap: "wrap",
        gap: `${SPACING.sm}px`,
      }}
    >
      {showTotal ? (
        <UiText variant="secondary">Tổng {total} bản ghi</UiText>
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
            value={pageSize}
            disabled={disabled}
            inputProps={{ "aria-label": "Số bản ghi mỗi trang" }}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {sizeOptions.map((size) => (
              <MenuItem key={size} value={size}>
                {size} / trang
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
