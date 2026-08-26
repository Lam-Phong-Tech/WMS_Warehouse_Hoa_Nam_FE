import { Pagination } from "antd";
import { MVP_PAGE_SIZE_OPTIONS } from "@/shared/components/mvp/mvp-pagination";

interface PageSizeSelectorProps {
  value: number;
  onChange: (value: number) => void;
}

interface PaginationFooterProps {
  current: number;
  pageSize: number;
  total: number;
  itemLabel: string;
  onChange: (page: number) => void;
}

export function MvpPageSizeSelector({
  value,
  onChange,
}: PageSizeSelectorProps) {
  // Giá trị hiện tại (vd: per_page=15 do BE trả về) có thể không nằm trong
  // các mốc chuẩn — vẫn phải liệt kê để <select> hiển thị đúng lựa chọn.
  const options = MVP_PAGE_SIZE_OPTIONS.includes(
    value as (typeof MVP_PAGE_SIZE_OPTIONS)[number],
  )
    ? MVP_PAGE_SIZE_OPTIONS
    : [...MVP_PAGE_SIZE_OPTIONS, value].sort((a, b) => a - b);

  return (
    <div className="table-page-size">
      {/* select thường (không phải antd) để cùng chiều cao với các bộ lọc
       * Loại/Hãng/Trạng thái bên cạnh — đều dùng chung class "select". */}
      <select
        className="select"
        value={value}
        aria-label="Số dòng mỗi trang"
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {options.map((size) => (
          <option key={size} value={size}>
            {size} / trang
          </option>
        ))}
      </select>
    </div>
  );
}

export function MvpPaginationFooter({
  current,
  pageSize,
  total,
  itemLabel,
  onChange,
}: PaginationFooterProps) {
  const maxPage = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const safeCurrent = Math.min(Math.max(1, current), maxPage);

  return (
    <div className="mvp-pagination-footer">
      <span>
        Tổng {total} {itemLabel}
      </span>
      <Pagination
        current={safeCurrent}
        pageSize={pageSize}
        total={total}
        showSizeChanger={false}
        hideOnSinglePage={false}
        onChange={onChange}
      />
    </div>
  );
}
