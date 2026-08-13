import { Pagination, Select } from "antd";
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
  return (
    <div className="table-page-size">
      <Select
        size="small"
        value={value}
        style={{ width: 110 }}
        showSearch={false}
        labelRender={({ value: selectedValue }) => `${selectedValue} / trang`}
        options={MVP_PAGE_SIZE_OPTIONS.map((size) => ({
          value: size,
          label: `${size} / trang`,
        }))}
        onChange={onChange}
      />
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
