/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Box,
  SEMANTIC_LIGHT,
  Stack,
  Tooltip,
  UiPagination,
  UiSelect,
  UiStatusBadge,
  UiTabs,
  UiTabPanel,
  UiText,
  UiTextField,
  type UiTabItem,
} from "@/shared/ui";
import {
  ResponsiveDataTable,
  type ResponsiveTableColumn,
} from "@/shared/components/data-display/ResponsiveDataTable";
import { AppstoreOutlined, SwapOutlined } from "@/shared/components/icons";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import {
  TableLoadingBanner,
  tableEmptyText,
} from "@/shared/components/feedback/BusinessState";
import { MVP_PAGE_SIZE_OPTIONS } from "@/shared/components/mvp/mvp-pagination";
import { mvpRowNumber } from "@/shared/components/mvp/MvpSelectionCell";
import { resolveApiPagination } from "@/shared/components/mvp/mvp-pagination";
import { useCanAny } from "@/shared/components/permission";
import { useOverlayBackDismiss } from "@/shared/hooks/useOverlayBackDismiss";
import { useRowSelection } from "@/shared/hooks/useRowSelection";
import { WMS_PERMISSION_CATALOG as P } from "@/shared/constants/wms-permissions";
import {
  INVENTORY_STOCK_STATUS_LABELS,
  MOVEMENT_STATUS_LABELS,
  MOVEMENT_TYPE_LABELS,
  RECONCILE_STATUS_LABELS,
  SKU_TYPE_LABELS,
  SOURCE_DOCUMENT_TYPE_LABELS,
  businessLabel,
} from "@/shared/constants/business-labels";
import {
  useInventoryBalances,
  useStockMovements,
} from "../hooks/use-inventory";
import { BalanceDetailModal } from "../components/BalanceDetailModal";
import { TraceModal } from "../components/TraceModal";
import type {
  InventoryBalanceRow,
  InventoryStockStatus,
  StockMovementRow,
} from "../services/inventoryService";
import { formatDateTime } from "@/shared/utils/format-date";
import { formatQuantity } from "@/shared/utils/format-number";
import { ActionButton, ActionIconButton } from "@/shared/components/actions";

const SEARCH_DEBOUNCE_MS = 250;

function pageSizeOptions(current: number) {
  return MVP_PAGE_SIZE_OPTIONS.includes(
    current as (typeof MVP_PAGE_SIZE_OPTIONS)[number],
  )
    ? MVP_PAGE_SIZE_OPTIONS
    : [...MVP_PAGE_SIZE_OPTIONS, current].sort((a, b) => a - b);
}

function formatQty(value: number | null | undefined, uom = "") {
  const formatted = formatQuantity(value);
  if (formatted === "-") return "-";
  return `${formatted}${uom ? ` ${uom}` : ""}`;
}

function reconcileColor(status: string): "success" | "error" | "warning" {
  if (status === "MATCH" || status === "PASS") return "success";
  if (status === "MISMATCH" || status === "FAIL") return "error";
  return "warning";
}

/** Nhãn tab kèm icon — UiTabs nhận label ReactNode nên icon ghép ngay trong label. */
function TabLabel({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <Box
      component="span"
      sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}
    >
      {icon}
      <span>{text}</span>
    </Box>
  );
}

/** Mã dạng code (SKU/chứng từ) — thay antd Typography.Text `code`. */
function CodeText({ children }: { children: ReactNode }) {
  return (
    <Box
      component="code"
      sx={{
        fontFamily: "monospace",
        fontSize: 13,
        px: 0.5,
        borderRadius: 1,
        backgroundColor: SEMANTIC_LIGHT.secondarySoft,
        color: SEMANTIC_LIGHT.textHigh,
      }}
    >
      {children}
    </Box>
  );
}

const INVENTORY_TAB_ITEMS: UiTabItem[] = [
  {
    key: "balance",
    label: (
      <TabLabel
        icon={<AppstoreOutlined style={{ fontSize: 15 }} />}
        text="Tồn kho hiện tại"
      />
    ),
  },
  {
    key: "movement",
    label: (
      <TabLabel
        icon={<SwapOutlined style={{ fontSize: 15 }} />}
        text="Lịch sử biến động"
      />
    ),
  },
];

/**
 * INV-01 · Tra cứu tồn & đối soát — màn hub của luồng 05 · Tồn kho & kiểm soát.
 * Truy vết (TRACE-01) mở modal ngay trên danh sách, không chuyển trang —
 * đồng bộ pattern luồng 02/03/04.
 */
export default function InventoryPage() {
  const canTrace = useCanAny([P.INVENTORY_TRACE]);
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [stockStatus, setStockStatus] = useState<InventoryStockStatus | "">("");
  const [skuType, setSkuType] = useState<"PRODUCT" | "COMPONENT" | "">("");
  const [movementSearch, setMovementSearch] = useState("");
  const [movementType, setMovementType] = useState("");
  const [balancePage, setBalancePage] = useState(1);
  const [balancePerPage, setBalancePerPage] = useState(10);
  const [movementPage, setMovementPage] = useState(1);
  const [movementPerPage, setMovementPerPage] = useState(10);

  const [activeTab, setActiveTab] = useState("balance");

  const [balanceDetailRow, setBalanceDetailRow] =
    useState<InventoryBalanceRow | null>(null);
  const [traceMovementId, setTraceMovementId] = useState<string | null>(null);

  const balanceQuery = useInventoryBalances({
    keyword: search || undefined,
    stock_status: stockStatus || undefined,
    sku_type: skuType || undefined,
    page: balancePage,
    per_page: balancePerPage,
  });

  const movementQuery = useStockMovements({
    search: movementSearch || undefined,
    keyword: movementSearch || undefined,
    movement_type: movementType || undefined,
    page: movementPage,
    per_page: movementPerPage,
  });

  const balances = balanceQuery.data?.rows ?? [];
  const balanceSelection = useRowSelection(balances, (row) => row.id);
  const balanceMeta = balanceQuery.data?.meta;
  const movements = movementQuery.data?.rows ?? [];
  const movementSelection = useRowSelection(movements, (row) => row.id);
  const movementMeta = movementQuery.data?.meta;

  const balancePagination = resolveApiPagination(balanceMeta, {
    page: balancePage,
    pageSize: balancePerPage,
    rowCount: balances.length,
  });
  const movementPagination = resolveApiPagination(movementMeta, {
    page: movementPage,
    pageSize: movementPerPage,
    rowCount: movements.length,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setBalancePage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const screen = searchParams.get("screen");
    if (!screen || screen === "INV-01") return;
    if (screen === "TRACE-01") {
      const id = searchParams.get("id");
      if (id) {
        setTraceMovementId(id);
      } else {
        setTraceMovementId("__lookup__");
      }
    } else {
      return;
    }
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("screen", "INV-01");
    nextParams.delete("id");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleOpenTrace = (movementId: string) => {
    setBalanceDetailRow(null);
    setTraceMovementId(movementId);
  };

  const overlayOpen = balanceDetailRow !== null || traceMovementId !== null;
  const closeOverlays = () => {
    setBalanceDetailRow(null);
    setTraceMovementId(null);
  };
  useOverlayBackDismiss(overlayOpen, closeOverlays, "INV-01-overlay");

  // Bảng nhiều cột nhất dự án (~16 cột cả 2 tab) — chuyển sang
  // ResponsiveDataTable: desktop giữ UX bảng, mobile/tablet hẹp (<md) chuyển
  // thành card. 5-6 cột nghiệp vụ cốt lõi (SKU/tên/trạng thái/khả
  // dụng/vị trí/đối soát — đúng mục đích "Tra cứu tồn & đối soát" của màn
  // này) hiện trên card; "Tồn hiện có"/"Tồn theo sổ cái" (số lượng phụ, đã có
  // "Khả dụng" là số chính và "Chênh lệch" đã tóm tắt phép so 2 số này) cùng
  // "STT" (thứ tự không còn ý nghĩa nhiều trong danh sách card) ẩn trên
  // mobile. Toàn bộ sorter ở đây vốn là client-side (so sánh trực tiếp
  // trên mảng `balances` của trang hiện tại, không có tham số sort gửi lên
  // API) nên cột nào cũng giữ được qua `sortAccessor`.
  const balanceColumns: ResponsiveTableColumn<InventoryBalanceRow>[] = [
    {
      key: "stt",
      header: "STT",
      width: 60,
      hideOnMobile: true,
      render: (row) =>
        mvpRowNumber(balancePage, balancePerPage, balances.indexOf(row)),
    },
    {
      key: "sku",
      header: "SKU",
      width: 140,
      sortAccessor: (row) => row.sku,
      render: (row) => (
        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
          <CodeText>{row.sku || "-"}</CodeText>
          <ActionIconButton
            kind="copy"
            onClick={(event) => {
              event.stopPropagation();
              void navigator.clipboard?.writeText(row.sku || "-");
            }}
          />
        </Stack>
      ),
    },
    {
      key: "name",
      header: "Tên hàng",
      width: 200,
      sortAccessor: (row) => row.name || "",
      render: (row) => (
        <Stack>
          <strong>{row.name || "-"}</strong>
          <UiText variant="secondary">
            {businessLabel(SKU_TYPE_LABELS, row.type, "Loại khác")}
          </UiText>
        </Stack>
      ),
    },
    {
      key: "stockStatus",
      header: "Trạng thái tồn",
      width: 170,
      sortType: "value",
      sortAccessor: (row) => row.stockStatus,
      render: (row) => (
        <UiStatusBadge
          tone={row.stockStatus === "AVAILABLE" ? "success" : "warning"}
          label={businessLabel(
            INVENTORY_STOCK_STATUS_LABELS,
            row.stockStatus,
            "Trạng thái khác",
          )}
        />
      ),
    },
    {
      key: "available",
      header: "Khả dụng",
      width: 110,
      align: "right",
      sortType: "value",
      sortAccessor: (row) => row.available,
      render: (row) => <strong>{formatQty(row.available, row.uom)}</strong>,
    },
    {
      key: "onHand",
      header: "Tồn hiện có",
      width: 120,
      align: "right",
      sortType: "value",
      sortAccessor: (row) => row.onHand,
      hideOnMobile: true,
      render: (row) => formatQty(row.onHand, row.uom),
    },
    {
      // WWHN-191: tổng theo sổ cái (sum stock_movements.qty_delta) — vế còn lại
      // của phép đối soát. Trước đây chỉ pass-through trong service, nay hiện
      // luôn cạnh "Tồn hiện có" để người dùng thấy cả 2 số đang so với nhau.
      key: "ledgerTotal",
      header: "Tồn theo sổ cái",
      width: 130,
      align: "right",
      sortType: "value",
      sortAccessor: (row) => row.ledgerTotal,
      hideOnMobile: true,
      render: (row) => formatQty(row.ledgerTotal, row.uom),
    },
    {
      // Chênh lệch có dấu = tồn hiện có - sổ cái. Đây là con số đứng sau tag
      // "Đối soát" nên tô màu theo hướng lệch, 0 để mờ cho đỡ nhiễu.
      key: "variance",
      header: "Chênh lệch",
      width: 120,
      align: "right",
      sortType: "value",
      sortAccessor: (row) => row.variance,
      render: (row) => {
        if (row.variance === 0) {
          return (
            <Box
              component="span"
              sx={{
                color: SEMANTIC_LIGHT.textMedium,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              0
            </Box>
          );
        }
        return (
          <Box
            component="span"
            sx={{
              color:
                row.variance > 0
                  ? SEMANTIC_LIGHT.warningText
                  : SEMANTIC_LIGHT.errorText,
              fontVariantNumeric: "tabular-nums",
              fontWeight: 600,
            }}
          >
            {row.variance > 0
              ? `+${formatQuantity(row.variance)}`
              : formatQuantity(row.variance)}
          </Box>
        );
      },
    },
    {
      key: "location",
      header: "Vị trí gợi ý",
      width: 160,
      sortAccessor: (row) => row.containerCode || row.trayCode || "",
      render: (row) => {
        // Danh sách chỉ cần 2 mã định danh để nhận ra ngay "đang ở đâu": mã hộp
        // (container_code — có ngay sau khi nhập kho) và mã khay (tray_code —
        // container_code của TRAY cha, chỉ có sau khi Putaway xếp hộp vào khay).
        // Vị trí mô tả rời (location_hint) chi tiết hơn — xem ở "Xem chi tiết".
        const parts = [
          row.containerCode ? `Hộp ${row.containerCode}` : null,
          row.trayCode ? `Khay ${row.trayCode}` : null,
        ].filter((part): part is string => Boolean(part));
        if (parts.length === 0) {
          return <UiText variant="secondary">Chưa có vị trí gợi ý</UiText>;
        }
        const text = parts.join(" · ");
        // Độ dài container/location thất thường (có khi rất dài) — ellipsis +
        // tooltip để tránh dòng bị dồn/cắt xấu hoặc kéo lệch chiều cao bảng
        // (tiêu chí 2), vẫn xem được đầy đủ khi hover.
        return (
          <Tooltip title={text}>
            <Box
              sx={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: 150,
                fontSize: 12,
              }}
            >
              {text}
            </Box>
          </Tooltip>
        );
      },
    },
    {
      key: "reconcile",
      header: "Đối soát",
      width: 140,
      sortType: "value",
      sortAccessor: (row) => row.reconcile,
      render: (row) => (
        <Tooltip
          title={
            row.reconcileNote ||
            (row.reconcile === "MATCH" || row.reconcile === "PASS"
              ? "Sổ cái và số tồn hiện tại khớp nhau"
              : "Sổ cái và số tồn hiện tại đang có chênh lệch")
          }
        >
          <span>
            <UiStatusBadge
              tone={reconcileColor(row.reconcile)}
              label={businessLabel(
                RECONCILE_STATUS_LABELS,
                row.reconcile,
                "Chưa đối soát",
              )}
            />
          </span>
        </Tooltip>
      ),
    },
  ];

  // Bảng "Lịch sử biến động" chỉ có 5 cột nghiệp vụ thật (không tính STT/thao
  // tác) nên không có cột "phụ" nào để ẩn trên mobile — tất cả đều là thông
  // tin cốt lõi của 1 dòng biến động. Chỉ ẩn STT (thứ tự không cần thiết ở
  // dạng card). Sorter cũng thuần client-side như bảng tồn kho ở trên.
  const movementColumns: ResponsiveTableColumn<StockMovementRow>[] = [
    {
      key: "stt",
      header: "STT",
      width: 60,
      hideOnMobile: true,
      render: (row) =>
        mvpRowNumber(movementPage, movementPerPage, movements.indexOf(row)),
    },
    {
      key: "time",
      header: "Thời gian",
      width: 150,
      sortType: "value",
      sortAccessor: (row) => row.time || "",
      render: (row) => formatDateTime(row.time),
    },
    {
      key: "type",
      header: "Loại biến động",
      width: 170,
      sortType: "value",
      sortAccessor: (row) => row.type,
      render: (row) => (
        <Stack sx={{ alignItems: "flex-start" }}>
          <UiStatusBadge
            tone="neutral"
            label={businessLabel(
              MOVEMENT_TYPE_LABELS,
              row.type,
              "Biến động khác",
            )}
          />
          <UiText variant="secondary">
            {businessLabel(
              MOVEMENT_STATUS_LABELS,
              row.status,
              "Trạng thái khác",
            )}
          </UiText>
        </Stack>
      ),
    },
    {
      key: "sku",
      header: "SKU",
      width: 120,
      sortAccessor: (row) => row.sku,
      render: (row) => row.sku,
    },
    {
      key: "qty",
      header: "Số lượng thay đổi",
      width: 140,
      align: "right",
      sortType: "value",
      sortAccessor: (row) => row.qty,
      render: (row) => (
        <Box
          component="span"
          sx={{
            color:
              row.qty >= 0
                ? SEMANTIC_LIGHT.successText
                : SEMANTIC_LIGHT.errorText,
            fontVariantNumeric: "tabular-nums",
            fontWeight: 600,
          }}
        >
          {row.qty >= 0
            ? `+${formatQuantity(row.qty)}`
            : formatQuantity(row.qty)}
        </Box>
      ),
    },
    {
      key: "source",
      header: "Chứng từ nguồn",
      width: 180,
      sortAccessor: (row) => row.source || "",
      render: (row) => (
        <Stack sx={{ alignItems: "flex-start" }}>
          <CodeText>{row.source || "-"}</CodeText>
          <UiText variant="secondary">
            {businessLabel(
              SOURCE_DOCUMENT_TYPE_LABELS,
              row.sourceType,
              "Nguồn khác",
            )}
          </UiText>
        </Stack>
      ),
    },
  ];

  return (
    <>
      <div className="inventory-page hn-mvp-source-screen">
        <Box sx={{ marginTop: "12px" }}>
          <UiTabs
            items={INVENTORY_TAB_ITEMS}
            value={activeTab}
            onChange={(key) => setActiveTab(key)}
          />
        </Box>

        {activeTab === "balance" ? (
          <UiTabPanel value={activeTab}>
            <div className="toolbar">
              <UiTextField
                value={searchInput}
                placeholder="SKU, tên hàng, kho..."
                slotProps={{ htmlInput: { "aria-label": "Tìm tồn kho" } }}
                onChange={(e) => setSearchInput(e.target.value)}
                sx={{ minWidth: 220 }}
              />
              <UiSelect
                value={skuType}
                aria-label="Lọc loại hàng"
                placeholder="Loại: Tất cả"
                minWidth={150}
                options={[
                  { value: "PRODUCT", label: "Sản phẩm" },
                  { value: "COMPONENT", label: "Linh kiện" },
                ]}
                onChange={(value) => {
                  setSkuType(value as "PRODUCT" | "COMPONENT" | "");
                  setBalancePage(1);
                }}
              />
              <UiSelect
                value={stockStatus}
                aria-label="Lọc trạng thái tồn"
                placeholder="Trạng thái tồn: Tất cả"
                minWidth={190}
                options={[
                  { value: "AVAILABLE", label: "Khả dụng" },
                  { value: "NON_SELLABLE", label: "Không thể bán/xuất" },
                  { value: "DEFECTIVE", label: "Hàng lỗi" },
                  { value: "QUARANTINE", label: "Chờ kiểm tra" },
                ]}
                onChange={(value) => {
                  setStockStatus(value as InventoryStockStatus | "");
                  setBalancePage(1);
                }}
              />
              <UiSelect
                value={balancePerPage}
                aria-label="Số dòng mỗi trang"
                minWidth={100}
                options={pageSizeOptions(balancePerPage).map((size) => ({
                  value: size,
                  label: `${size} / trang`,
                }))}
                onChange={(value) => {
                  setBalancePerPage(Number(value));
                  setBalancePage(1);
                }}
              />
              {/* Tổng số dòng hiển thị ngay trong khu vực filter/toolbar — tránh
                phải kéo xuống cuối bảng mới thấy (tiêu chí 4). */}

              <div className="spacer" />
              {canTrace ? (
                <ActionButton
                  kind="trace"
                  onClick={() => setTraceMovementId("__lookup__")}
                >
                  Truy vết mã
                </ActionButton>
              ) : null}
            </div>

            {balanceQuery.isError ? (
              <Box sx={{ mb: "14px" }}>
                <ApiErrorAlert
                  error={balanceQuery.error}
                  title="Không thể tải tồn kho hiện tại"
                  onRetry={() => balanceQuery.refetch()}
                />
              </Box>
            ) : null}

            <TableLoadingBanner
              loading={balanceQuery.isLoading || balanceQuery.isFetching}
            />
            <ResponsiveDataTable<InventoryBalanceRow>
              rowKey={(row) => row.id}
              columns={balanceColumns}
              rows={balances}
              rowSelection={balanceSelection}
              selectionLabel={(row) => `Chọn dòng tồn kho SKU ${row.sku}`}
              loading={balanceQuery.isLoading || balanceQuery.isFetching}
              emptyText={tableEmptyText(
                balanceQuery.isError ? balanceQuery.error : null,
                "Không có tồn kho theo bộ lọc hiện tại",
              )}
              onRowClick={(row) => setBalanceDetailRow(row)}
              renderRowActions={(row) => (
                <ActionButton
                  kind="view"
                  sx={{ whiteSpace: "nowrap" }}
                  onClick={(event) => {
                    event.stopPropagation();
                    setBalanceDetailRow(row);
                  }}
                >
                  Mở
                </ActionButton>
              )}
            />
            <Box
              sx={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 1,
                mt: 1.5,
              }}
            >
              {/* Giữ nguyên câu chữ tổng của antd showTotal cũ → UiText riêng,
                tắt showTotal mặc định ("Tổng {total} bản ghi") của UiPagination. */}
              <UiText variant="secondary">
                Tổng {formatQuantity(balancePagination.total)} dòng tồn
                kho
              </UiText>
              <UiPagination
                page={balancePagination.current}
                pageSize={balancePagination.pageSize}
                total={balancePagination.total}
                showTotal={false}
                onPageChange={(page) => setBalancePage(page)}
              />
            </Box>
          </UiTabPanel>
        ) : (
          <UiTabPanel value={activeTab}>
            <div className="toolbar">
              <UiTextField
                value={movementSearch}
                placeholder="Mã biến động, chứng từ, SKU..."
                slotProps={{
                  htmlInput: { "aria-label": "Tìm biến động tồn kho" },
                }}
                onChange={(e) => {
                  setMovementSearch(e.target.value);
                  setMovementPage(1);
                }}
                sx={{ minWidth: 220 }}
              />
              <UiSelect
                value={movementType}
                aria-label="Lọc loại biến động"
                placeholder="Loại: Tất cả"
                minWidth={190}
                options={[
                  { value: "RECEIPT", label: "Nhập kho" },
                  { value: "ISSUE", label: "Xuất kho" },
                  {
                    value: "COMPONENT_ISSUE",
                    label: "Xuất linh kiện bảo hành",
                  },
                  { value: "REVERSAL", label: "Điều chỉnh tồn kho" },
                ]}
                onChange={(value) => {
                  setMovementType(value);
                  setMovementPage(1);
                }}
              />
              <UiSelect
                value={movementPerPage}
                aria-label="Số dòng mỗi trang"
                minWidth={100}
                options={pageSizeOptions(movementPerPage).map((size) => ({
                  value: size,
                  label: `${size} / trang`,
                }))}
                onChange={(value) => {
                  setMovementPerPage(Number(value));
                  setMovementPage(1);
                }}
              />
              <UiText variant="secondary">
                Tổng {formatQuantity(movementPagination.total)} biến
                động
              </UiText>
            </div>

            {movementQuery.isError ? (
              <Box sx={{ mb: "14px" }}>
                <ApiErrorAlert
                  error={movementQuery.error}
                  title="Không thể tải lịch sử biến động"
                  onRetry={() => movementQuery.refetch()}
                />
              </Box>
            ) : null}

            <TableLoadingBanner
              loading={movementQuery.isLoading || movementQuery.isFetching}
            />
            <ResponsiveDataTable<StockMovementRow>
              rowKey={(row) => row.id}
              columns={movementColumns}
              rows={movements}
              rowSelection={movementSelection}
              selectionLabel={(row) =>
                `Chọn biến động ${row.movementId || "chưa có mã"}`
              }
              loading={movementQuery.isLoading || movementQuery.isFetching}
              emptyText={tableEmptyText(
                movementQuery.isError ? movementQuery.error : null,
                "Không có biến động theo bộ lọc hiện tại",
              )}
              renderRowActions={(row) => (
                <Tooltip
                  title={
                    canTrace
                      ? "Truy vết chứng từ nguồn"
                      : "Tài khoản chưa có quyền truy vết tồn kho"
                  }
                >
                  {/* span trung gian để tooltip vẫn hiện khi nút bị disabled */}
                  <span>
                    <ActionButton
                      kind="history"
                      sx={{ whiteSpace: "nowrap" }}
                      disabled={!canTrace || !row.id}
                      onClick={() => handleOpenTrace(String(row.id))}
                    >
                      Truy vết
                    </ActionButton>
                  </span>
                </Tooltip>
              )}
            />
            <Box
              sx={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 1,
                mt: 1.5,
              }}
            >
              {/* Giữ nguyên câu chữ tổng của antd showTotal cũ → UiText riêng,
                tắt showTotal mặc định ("Tổng {total} bản ghi") của UiPagination. */}
              <UiText variant="secondary">
                Tổng {formatQuantity(movementPagination.total)} biến
                động
              </UiText>
              <UiPagination
                page={movementPagination.current}
                pageSize={movementPagination.pageSize}
                total={movementPagination.total}
                showTotal={false}
                onPageChange={(page) => setMovementPage(page)}
              />
            </Box>
          </UiTabPanel>
        )}

        {balanceDetailRow ? (
          <BalanceDetailModal
            balance={balanceDetailRow}
            onClose={() => setBalanceDetailRow(null)}
            onTraceMovement={canTrace ? handleOpenTrace : undefined}
          />
        ) : null}

        {traceMovementId ? (
          <TraceModal
            movementId={
              traceMovementId === "__lookup__" ? null : traceMovementId
            }
            onClose={() => setTraceMovementId(null)}
          />
        ) : null}
      </div>
    </>
  );
}
