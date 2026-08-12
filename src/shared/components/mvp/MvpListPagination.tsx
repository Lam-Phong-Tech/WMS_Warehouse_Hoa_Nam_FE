import { Pagination, Select } from "antd";
import type { ApiMeta } from "@/shared/types/api-response";

export const MVP_PAGE_SIZE_OPTIONS = [15, 20, 50, 100] as const;

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

export function resolveApiPagination(
  meta: ApiMeta | Record<string, unknown> | undefined,
  fallback: { page: number; pageSize: number; rowCount: number },
) {
  const current = Number(meta?.current_page ?? fallback.page);
  const pageSize = Number(meta?.per_page ?? fallback.pageSize);
  const total = Number(meta?.total ?? fallback.rowCount);
  const lastPage = Number(
    meta?.last_page ?? Math.max(1, Math.ceil(total / Math.max(1, pageSize))),
  );

  return {
    current: Number.isFinite(current) && current > 0 ? current : fallback.page,
    pageSize:
      Number.isFinite(pageSize) && pageSize > 0 ? pageSize : fallback.pageSize,
    total: Number.isFinite(total) && total >= 0 ? total : fallback.rowCount,
    lastPage: Number.isFinite(lastPage) && lastPage > 0 ? lastPage : 1,
  };
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
      <span>Tổng {total} {itemLabel}</span>
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
