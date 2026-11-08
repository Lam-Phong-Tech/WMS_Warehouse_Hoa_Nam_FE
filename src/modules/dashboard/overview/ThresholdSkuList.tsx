import { useEffect, useRef, useState } from "react";
import { UiButton, UiPagination } from "@/shared/ui";
import { ActionIconButton, RowActionButton } from "@/shared/components/actions";
import { SearchInput } from "@/shared/components/data-display/SearchInput";
import { ResponsiveDataTable } from "@/shared/components/data-display/ResponsiveDataTable";
import { TABLE_PAGE_SIZE_OPTIONS } from "@/shared/constants/table-pagination";
import type { DashboardThresholdRow } from "./dashboard-threshold-model";
import { fmt } from "./overview-data";
import "./threshold-sku-list.css";

type Filter = "alerts" | "low" | "high" | "all";
type Props = {
  rows: DashboardThresholdRow[];
  onNavigate: (route: string) => void;
};
const stateLabel = (state: DashboardThresholdRow["state"]) =>
  state === "low" ? "Dưới min" : state === "high" ? "Trên max" : "Trong ngưỡng";

export function ThresholdSkuList({ rows, onNavigate }: Props) {
  const [filter, setFilter] = useState<Filter>("alerts");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [previousRows, setPreviousRows] = useState(rows);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const detailHeading = useRef<HTMLHeadingElement | null>(null);
  const query = search.trim().toLocaleLowerCase("vi-VN");
  const filtered = rows.filter(
    (row) =>
      (filter === "all" ||
        (filter === "alerts" ? row.state !== "ok" : row.state === filter)) &&
      (!query ||
        `${row.sku} ${row.name}`.toLocaleLowerCase("vi-VN").includes(query)),
  );
  const current = Math.min(
    page,
    Math.max(1, Math.ceil(filtered.length / pageSize)),
  );
  const start = (current - 1) * pageSize;
  const visible = filtered
    .slice(start, start + pageSize)
    .map((row, i) => ({ ...row, order: start + i + 1 }));
  const selected = visible.find((row) => row.sku === selectedSku);
  // Persist bounds after refresh so restored data cannot reopen a hidden selection.
  if (previousRows !== rows) {
    setPreviousRows(rows);
    if (page !== current) setPage(current);
    if (selectedSku !== null && !selected) setSelectedSku(null);
  }
  useEffect(() => {
    detailHeading.current?.focus();
  }, [selected?.sku]);

  const resetPage = () => {
    setPage(1);
    setSelectedSku(null);
  };
  const open = (sku: string, button: HTMLButtonElement) => {
    trigger.current = button;
    setSelectedSku(sku);
  };
  const close = () => {
    setSelectedSku(null);
    trigger.current?.focus();
  };
  return (
    <div className={`threshold-layout${selected ? " has-selection" : ""}`}>
      <section
        className="threshold-list"
        aria-labelledby="threshold-list-title"
      >
        <h2 id="threshold-list-title">Danh sách SKU</h2>
        <div className="threshold-filters">
          <SearchInput
            className="threshold-search"
            width="100%"
            value={search}
            placeholder="Tìm mã hoặc tên SKU"
            onChange={(value) => {
              setSearch(value);
              resetPage();
            }}
          />
          <select
            aria-label="Lọc trạng thái định mức"
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value as Filter);
              resetPage();
            }}
          >
            <option value="alerts">Trạng thái: Đang cảnh báo</option>
            <option value="low">Trạng thái: Dưới min</option>
            <option value="high">Trạng thái: Trên max</option>
            <option value="all">Trạng thái: Tất cả đã cấu hình</option>
          </select>
          {(search || filter !== "alerts") && (
            <UiButton
              appearance="outlined"
              onClick={() => {
                setSearch("");
                setFilter("alerts");
                resetPage();
              }}
            >
              Xóa lọc
            </UiButton>
          )}
        </div>
        <div className="threshold-table">
          <ResponsiveDataTable
            rows={visible}
            rowKey={(row) => row.sku}
            mobileBreakpoint="lg"
            emptyText="Không có SKU trong bộ lọc này."
            headerCellStyle={{
              backgroundColor: "var(--ops-table-header)",
              backgroundImage: "none",
              color: "var(--ops-heading)",
              fontSize: 16,
              fontWeight: 800,
              lineHeight: "24px",
              padding: "12px 18px",
              textTransform: "none",
              letterSpacing: "0.02em",
            }}
            columns={[
              {
                key: "order",
                header: "STT",
                width: "9%",
                truncate: 0,
                render: (row) => row.order,
              },
              {
                key: "sku",
                header: "SKU",
                width: "18%",
                truncate: 0,
                render: (row) => (
                  <button
                    type="button"
                    className="threshold-sku"
                    aria-pressed={row.sku === selectedSku}
                    onClick={(event) => open(row.sku, event.currentTarget)}
                  >
                    {row.sku}
                  </button>
                ),
              },
              {
                key: "name",
                header: "Tên",
                width: "20%",
                truncate: 0,
                render: (row) => row.name || "—",
              },
              {
                key: "available",
                header: "Khả dụng",
                width: "12%",
                align: "right",
                truncate: 0,
                render: (row) => fmt(row.available),
              },
              {
                key: "min",
                header: "Min",
                width: "9%",
                align: "right",
                truncate: 0,
                render: (row) => (row.min === null ? "—" : fmt(row.min)),
              },
              {
                key: "max",
                header: "Max",
                width: "9%",
                align: "right",
                truncate: 0,
                render: (row) => (row.max === null ? "—" : fmt(row.max)),
              },
              {
                key: "state",
                header: "Trạng thái",
                width: "15%",
                truncate: 0,
                render: (row) => (
                  <span className="threshold-status" data-state={row.state}>
                    {stateLabel(row.state)}
                  </span>
                ),
              },
              {
                key: "action",
                header: "Thao tác",
                isAction: true,
                width: "8%",
                render: (row) => (
                  <RowActionButton
                    kind="view"
                    label={`Xem định mức ${row.sku}`}
                    onClick={(event) => open(row.sku, event.currentTarget)}
                  />
                ),
              },
            ]}
          />
          <div className="threshold-pagination">
            <div className="threshold-pagination-info">
              <span aria-live="polite">
                Hiển thị {filtered.length ? start + 1 : 0}–
                {Math.min(start + pageSize, filtered.length)} /{" "}
                {fmt(filtered.length)} SKU
              </span>
              <select
                aria-label="Số dòng mỗi trang"
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  resetPage();
                }}
              >
                {TABLE_PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size} / trang
                  </option>
                ))}
              </select>
            </div>
            <UiPagination
              page={current}
              pageSize={pageSize}
              total={filtered.length}
              showTotal={false}
              onPageChange={(value) => {
                setPage(value);
                setSelectedSku(null);
              }}
            />
          </div>
        </div>
      </section>
      {selected && (
        <section
          className="threshold-detail"
          aria-labelledby="threshold-detail-title"
        >
          <header>
            <h2 id="threshold-detail-title" tabIndex={-1} ref={detailHeading}>
              Chi tiết định mức
            </h2>
            <ActionIconButton
              kind="close"
              label="Đóng chi tiết định mức"
              onClick={close}
            />
          </header>
          <strong className="threshold-detail-code">{selected.sku}</strong>
          {selected.name && selected.name !== selected.sku && (
            <p>{selected.name}</p>
          )}
          <dl>
            <div>
              <dt>Loại hàng</dt>
              <dd>
                {selected.kind === "PRODUCT"
                  ? "Sản phẩm"
                  : selected.kind === "COMPONENT"
                    ? "Linh kiện"
                    : "—"}
              </dd>
            </div>
            <div>
              <dt>Tồn khả dụng</dt>
              <dd>{fmt(selected.available)}</dd>
            </div>
            <div>
              <dt>Định mức min</dt>
              <dd>{selected.min === null ? "Chưa đặt" : fmt(selected.min)}</dd>
            </div>
            <div>
              <dt>Định mức max</dt>
              <dd>{selected.max === null ? "Chưa đặt" : fmt(selected.max)}</dd>
            </div>
            <div>
              <dt>Mức cần kiểm tra</dt>
              <dd>
                {selected.state === "low"
                  ? `Thiếu ${fmt((selected.min ?? 0) - selected.available)}`
                  : selected.state === "high"
                    ? `Vượt ${fmt(selected.available - (selected.max ?? 0))}`
                    : "Trong ngưỡng"}
              </dd>
            </div>
          </dl>
          <p className="threshold-detail-note">
            Kiểm tra nhu cầu và số tồn trước khi điều chuyển hoặc nhập thêm.
          </p>
          <UiButton
            appearance="filled"
            onClick={() => onNavigate("/inventory")}
          >
            Xem tồn kho
          </UiButton>
        </section>
      )}
    </div>
  );
}
