/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { AppPageHeader } from "@/app/layouts/AppPageHeader";
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
import {
  AppstoreOutlined,
  SwapOutlined,
  SearchOutlined,
} from "@/shared/components/icons";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { SkuLink } from "@/shared/components/data-display/SkuLink";
import {
  TableLoadingBanner,
  tableEmptyText,
} from "@/shared/components/feedback/BusinessState";
import { MVP_PAGE_SIZE_OPTIONS } from "@/shared/components/mvp/mvp-pagination";
import { mvpRowNumber } from "@/shared/components/mvp/MvpSelectionCell";
import { resolveApiPagination } from "@/shared/components/mvp/mvp-pagination";
import { useCanAny } from "@/shared/components/permission";
import { useOverlayBackDismiss } from "@/shared/hooks/useOverlayBackDismiss";
import { WMS_PERMISSION_CATALOG as P } from "@/shared/constants/wms-permissions";
import {
  INVENTORY_STOCK_STATUS_LABELS,
  MOVEMENT_STATUS_LABELS,
  MOVEMENT_TYPE_LABELS,
  RECONCILE_REASON_LABELS,
  RECONCILE_STATUS_LABELS,
  SKU_TYPE_LABELS,
  SOURCE_DOCUMENT_TYPE_LABELS,
  businessLabel,
  enumLabelOrText,
} from "@/shared/constants/business-labels";
import { useT, type TranslateFn } from "@/shared/i18n/useT";
import {
  useInventoryBalances,
  useStockMovements,
} from "../hooks/use-inventory";
import { BalanceDetailModal } from "../components/BalanceDetailModal";
import { TraceModal } from "../components/TraceModal";
import { movementTypeTone } from "../movement-tone";
import type {
  InventoryBalanceRow,
  InventoryReconciliationStatus,
  InventoryStockStatus,
  StockMovementRow,
} from "../services/inventoryService";
import { formatDateTime } from "@/shared/utils/format-date";
import { formatQuantity } from "@/shared/utils/format-number";
import { localizedUnitLabel } from "@/shared/utils/format-unit";
import { ActionButton, RowActionButton } from "@/shared/components/actions";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { rowIndexOf } from "@/shared/components/data-display/row-index";

import "./inventory-page.css";

const SEARCH_DEBOUNCE_MS = 250;
const TABLE_HEADER_STYLE = {
  background: "var(--inv-table-header)",
  color: "var(--ops-heading)",
  fontSize: 16,
  fontWeight: 800,
  lineHeight: "24px",
  letterSpacing: "0.02em",
  textTransform: "uppercase",
  padding: "12px 18px",
  borderBottom: "1px solid var(--ops-line)",
} as const;

function pageSizeOptions(current: number) {
  return MVP_PAGE_SIZE_OPTIONS.includes(
    current as (typeof MVP_PAGE_SIZE_OPTIONS)[number],
  )
    ? MVP_PAGE_SIZE_OPTIONS
    : [...MVP_PAGE_SIZE_OPTIONS, current].sort((a, b) => a - b);
}

function formatQty(value: number | null | undefined, uom: string, t: TranslateFn) {
  const formatted = formatQuantity(value);
  if (formatted === EMPTY_TEXT) return EMPTY_TEXT;
  return `${formatted}${uom ? ` ${localizedUnitLabel(uom, t)}` : ""}`;
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

/**
 * Mã dạng code (SKU/chứng từ) — thay antd Typography.Text `code`.
 *
 * Ô bảng đi qua `TruncatedText` (`.hn-truncate`, overflow hidden) nên chip này
 * PHẢI tự co và tự cắt: `<code>` mặc định là inline nên `text-overflow` không
 * áp được lên nó, và làm phần tử flex thì nó cũng không chịu co
 * (`min-width: auto`) — mã dài bị cắt cụt giữa ký tự, đồng thời đẩy phần tử
 * đứng sau (nút sao chép) ra ngoài vùng thấy được. Khai `inline-block` +
 * `minWidth: 0` + ellipsis để mã dài kết thúc bằng "…" thay vì cắt ngang.
 */
function CodeText({ children }: { children: ReactNode }) {
  return <code className="hn-inventory-code">{children}</code>;
}

const inventoryTabItems = (t: TranslateFn): UiTabItem[] => [
  {
    key: "balance",
    label: (
      <TabLabel
        icon={<AppstoreOutlined style={{ fontSize: 15 }} />}
        text={t("inventory.tab.balances")}
      />
    ),
  },
  {
    key: "movement",
    label: (
      <TabLabel
        icon={<SwapOutlined style={{ fontSize: 15 }} />}
        text={t("inventory.tab.movements")}
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
  const t = useT();
  const canTrace = useCanAny([P.INVENTORY_TRACE]);
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [stockStatus, setStockStatus] = useState<InventoryStockStatus | "">("");
  const [reconciliationStatus, setReconciliationStatus] = useState<
    InventoryReconciliationStatus | ""
  >("");
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
    reconciliation_status: reconciliationStatus || undefined,
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
  const matchingBalanceDetail = balanceDetailRow
    ? balances.find((row) => String(row.id) === String(balanceDetailRow.id))
    : undefined;
  const balanceDetailMissing = Boolean(
    balanceDetailRow &&
      balanceQuery.isSuccess &&
      !balanceQuery.isFetching &&
      !matchingBalanceDetail,
  );
  const currentBalanceDetail = balanceDetailMissing
    ? null
    : matchingBalanceDetail ?? balanceDetailRow;
  useEffect(() => {
    if (balanceDetailMissing) {
      // A settled filtered read no longer contains this balance.
      setBalanceDetailRow(null);
    }
  }, [balanceDetailMissing]);
  const balanceMeta = balanceQuery.data?.meta;
  const movements = movementQuery.data?.rows ?? [];
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

  // ResponsiveDataTable giữ bảng trên desktop và chuyển thành card ở màn hẹp.
  // Khả dụng, sổ cái, chênh lệch và vị trí được xem trong chi tiết.
  // Chỉ STT được ẩn trên card. Sorter ở đây là client-side (so sánh trực tiếp
  // trên mảng `balances` của trang hiện tại, không có tham số sort gửi lên
  // API) nên cột nào cũng giữ được qua `sortAccessor`.
  const balanceColumns: ResponsiveTableColumn<InventoryBalanceRow>[] = [
    {
      key: "stt",
      header: "#",
      width: "5%",
      hideOnMobile: true,
      render: (row) =>
        mvpRowNumber(balancePage, balancePerPage, rowIndexOf(balances, row)),
    },
    {
      key: "sku",
      header: "SKU",
      width: "18%",
      sortAccessor: (row) => row.sku,
      render: (row) => (
        <CodeText>
          <SkuLink code={row.sku} />
        </CodeText>
      ),
    },
    {
      key: "name",
      header: t("inventory.balance.colName"),
      width: "28%",
      sortAccessor: (row) => row.name || "",
      render: (row) => (
        <Stack>
          <strong>{row.name || EMPTY_TEXT}</strong>
          <UiText variant="secondary">
            {businessLabel(
              SKU_TYPE_LABELS,
              row.type,
              t("inventory.fallback.skuType"),
            )}
          </UiText>
        </Stack>
      ),
    },
    {
      key: "stockStatus",
      header: t("inventory.balance.colStockStatus"),
      width: "17%",
      sortType: "value",
      sortAccessor: (row) => row.stockStatus,
      render: (row) => (
        <UiStatusBadge
          tone={row.stockStatus === "AVAILABLE" ? "success" : "warning"}
          data-tone={row.stockStatus === "AVAILABLE" ? "success" : "warning"}
          label={businessLabel(
            INVENTORY_STOCK_STATUS_LABELS,
            row.stockStatus,
            t("inventory.fallback.status"),
          )}
        />
      ),
    },
    {
      key: "onHand",
      header: t("inventory.balance.colOnHand"),
      width: "13%",
      align: "right",
      sortType: "value",
      sortAccessor: (row) => row.onHand,
      render: (row) => formatQty(row.onHand, row.uom, t),
    },
    {
      key: "reconcile",
      header: t("inventory.balance.colReconcile"),
      width: "11%",
      sortType: "value",
      sortAccessor: (row) => row.reconcile,
      render: (row) => (
        <Tooltip
          title={
            (row.reconcileNote &&
              enumLabelOrText(RECONCILE_REASON_LABELS, row.reconcileNote)) ||
            (row.reconcile === "MATCH" || row.reconcile === "PASS"
              ? t("inventory.balance.reconcileMatch")
              : t("inventory.balance.reconcileMismatch"))
          }
        >
          <span>
            <UiStatusBadge
              tone={reconcileColor(row.reconcile)}
              data-tone={reconcileColor(row.reconcile)}
              label={businessLabel(
                RECONCILE_STATUS_LABELS,
                row.reconcile,
                t("inventory.fallback.notReconciled"),
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
      header: "#",
      width: "5%",
      hideOnMobile: true,
      render: (row) =>
        mvpRowNumber(movementPage, movementPerPage, rowIndexOf(movements, row)),
    },
    {
      key: "time",
      header: t("inventory.movement.colTime"),
      width: "18%",
      sortType: "value",
      sortAccessor: (row) => row.time || "",
      render: (row) => formatDateTime(row.time),
    },
    {
      key: "type",
      header: t("inventory.movement.colType"),
      width: "19%",
      sortType: "value",
      sortAccessor: (row) => row.type,
      render: (row) => {
        const tone = movementTypeTone(row.type);
        return (
          <Stack sx={{ alignItems: "flex-start" }}>
            <UiStatusBadge
              tone={tone}
              data-tone={tone}
              label={businessLabel(
                MOVEMENT_TYPE_LABELS,
                row.type,
                t("inventory.fallback.movementType"),
              )}
            />
            <UiText variant="secondary">
              {businessLabel(
                MOVEMENT_STATUS_LABELS,
                row.status,
                t("inventory.fallback.status"),
              )}
            </UiText>
          </Stack>
        );
      },
    },
    {
      key: "sku",
      header: "SKU",
      // Mã SKU dài nhất của hệ (~17 ký tự) chiếm ~130px ở font thân bài; cộng
      // 20px padding của ô là 150px. 120px cũ khiến MỌI mã trong tab này bị cắt
      // bằng "…" dù cột kế bên còn thừa chỗ.
      width: "18%",
      sortAccessor: (row) => row.sku,
      render: (row) => <SkuLink code={row.sku} />,
    },
    {
      key: "qty",
      header: t("inventory.movement.colQtyChange"),
      width: "12%",
      align: "right",
      sortType: "value",
      sortAccessor: (row) => row.qty,
      render: (row) => (
        <Box
          component="span"
          sx={{
            color:
              row.qty === null
                ? "text.secondary"
                : row.qty >= 0
                  ? SEMANTIC_LIGHT.successText
                  : SEMANTIC_LIGHT.errorText,
            fontVariantNumeric: "tabular-nums",
            fontWeight: 600,
          }}
        >
          {row.qty !== null && row.qty >= 0
            ? `+${formatQuantity(row.qty)}`
            : formatQuantity(row.qty)}
        </Box>
      ),
    },
    {
      key: "source",
      header: t("inventory.movement.colSourceDocument"),
      width: "18%",
      sortAccessor: (row) => row.source || "",
      render: (row) => (
        <Stack sx={{ alignItems: "flex-start" }}>
          <CodeText>{row.source || EMPTY_TEXT}</CodeText>
          <UiText variant="secondary">
            {businessLabel(
              SOURCE_DOCUMENT_TYPE_LABELS,
              row.sourceType,
              t("inventory.fallback.source"),
            )}
          </UiText>
        </Stack>
      ),
    },
  ];

  const isBalance = activeTab === "balance";
  const query = isBalance ? balanceQuery : movementQuery;
  const pagination = isBalance ? balancePagination : movementPagination;
  const perPage = isBalance ? balancePerPage : movementPerPage;
  const visibleRowCount = isBalance ? balances.length : movements.length;
  const rangeFrom =
    visibleRowCount > 0 && pagination.total > 0
      ? (pagination.current - 1) * pagination.pageSize + 1
      : 0;
  const rangeTo =
    visibleRowCount > 0
      ? Math.min(pagination.total, rangeFrom + visibleRowCount - 1)
      : 0;
  const hasFilters = isBalance
    ? Boolean(searchInput || skuType || stockStatus || reconciliationStatus)
    : Boolean(movementSearch || movementType);
  const resetFilters = () => {
    if (isBalance) {
      setSearchInput("");
      setSearch("");
      setSkuType("");
      setStockStatus("");
      setReconciliationStatus("");
      setBalancePage(1);
    } else {
      setMovementSearch("");
      setMovementType("");
      setMovementPage(1);
    }
  };
  const emptyContent = (
    <div className="hn-inventory-empty">
      {tableEmptyText(
        query.isError ? query.error : null,
        t(isBalance ? "inventory.balance.empty" : "inventory.movement.empty"),
      )}
      {hasFilters && !query.isError ? (
        <ActionButton kind="reset" onClick={resetFilters} />
      ) : null}
    </div>
  );

  return (
    <div className="inventory-page hn-mvp-source-screen hn-inventory">
      <AppPageHeader
        showEyebrow={false}
        showDescription={false}
        showContextBadges={false}
        actions={
          <div className="hn-inventory-actions">
            {isBalance && canTrace ? (
              <ActionButton
                kind="trace"
                className="hn-inventory-primary"
                onClick={() => setTraceMovementId("__lookup__")}
              >
                {t("inventory.balance.traceCode")}
              </ActionButton>
            ) : null}
          </div>
        }
      />
      <div className="hn-inventory-navigation">
        <UiTabs
          items={inventoryTabItems(t)}
          value={activeTab}
          onChange={setActiveTab}
        />
      </div>

      <UiTabPanel value={activeTab} className="hn-inventory-panel">
        <div
          className={
            isBalance
              ? "hn-inventory-filters"
              : "hn-inventory-filters hn-inventory-filters--movement"
          }
        >
          <div className="hn-inventory-field hn-inventory-search">
            <UiTextField
              id="inventory-search"
              fullWidth
              value={isBalance ? searchInput : movementSearch}
              placeholder={t(
                isBalance
                  ? "inventory.balance.searchPlaceholder"
                  : "inventory.movement.searchPlaceholder",
              )}
              slotProps={{
                input: {
                  startAdornment: (
                    <SearchOutlined className="hn-inventory-search-icon" />
                  ),
                },
                htmlInput: {
                  "aria-label": t(
                    isBalance
                      ? "inventory.balance.searchAria"
                      : "inventory.movement.searchAria",
                  ),
                },
              }}
              onChange={(e) => {
                if (isBalance) setSearchInput(e.target.value);
                else {
                  setMovementSearch(e.target.value);
                  setMovementPage(1);
                }
              }}
            />
          </div>
          <div className="hn-inventory-field">
            <UiSelect
              id="inventory-type"
              fullWidth
              menuClassName="hn-inventory-menu"
              value={isBalance ? skuType : movementType}
              aria-label={t(
                isBalance
                  ? "inventory.balance.typeFilterAria"
                  : "inventory.movement.typeFilterAria",
              )}
              placeholder={t(
                isBalance
                  ? "inventory.balance.typeFilterPlaceholder"
                  : "inventory.movement.typeFilterPlaceholder",
              )}
              options={(isBalance
                ? [
                    {
                      value: "PRODUCT",
                      label: t("inventory.balance.typeProduct"),
                    },
                    {
                      value: "COMPONENT",
                      label: t("inventory.balance.typeComponent"),
                    },
                  ]
                : [
                    {
                      value: "RECEIPT",
                      label: t("inventory.movement.typeReceipt"),
                    },
                    {
                      value: "ISSUE",
                      label: t("inventory.movement.typeIssue"),
                    },
                    {
                      value: "COMPONENT_ISSUE",
                      label: t("inventory.movement.typeComponentIssue"),
                    },
                    {
                      value: "REVERSAL",
                      label: t("inventory.movement.typeReversal"),
                    },
                  ]
              ).map((option) => ({
                ...option,
                label: (
                  <>
                    <span className="hn-inventory-filter-prefix">
                      {
                        t(
                          isBalance
                            ? "inventory.balance.typeFilterPlaceholder"
                            : "inventory.movement.typeFilterPlaceholder",
                        ).split(":")[0]
                      }
                      :{" "}
                    </span>
                    {option.label}
                  </>
                ),
              }))}
              onChange={(value) => {
                if (isBalance) {
                  setSkuType(value as "PRODUCT" | "COMPONENT" | "");
                  setBalancePage(1);
                } else {
                  setMovementType(value);
                  setMovementPage(1);
                }
              }}
            />
          </div>
          {isBalance ? (
            <div className="hn-inventory-field">
              <UiSelect
                id="inventory-status"
                fullWidth
                menuClassName="hn-inventory-menu"
                value={stockStatus}
                aria-label={t("inventory.balance.statusFilterAria")}
                placeholder={t("inventory.balance.statusFilterPlaceholder")}
                options={[
                  {
                    value: "AVAILABLE",
                    label: t("inventory.balance.statusAvailable"),
                  },
                  {
                    value: "NON_SELLABLE",
                    label: t("inventory.balance.statusNonSellable"),
                  },
                  {
                    value: "DEFECTIVE",
                    label: t("inventory.balance.statusDefective"),
                  },
                  {
                    value: "QUARANTINE",
                    label: t("inventory.balance.statusQuarantine"),
                  },
                ].map((option) => ({
                  ...option,
                  label: (
                    <>
                      <span className="hn-inventory-filter-prefix">
                        {t("inventory.balance.colStockStatus")}:{" "}
                      </span>
                      {option.label}
                    </>
                  ),
                }))}
                onChange={(value) => {
                  setStockStatus(value as InventoryStockStatus | "");
                  setBalancePage(1);
                }}
              />
            </div>
          ) : null}
          {isBalance ? (
            <div className="hn-inventory-field">
              <UiSelect
                id="inventory-reconciliation"
                fullWidth
                menuClassName="hn-inventory-menu"
                value={reconciliationStatus}
                aria-label={t("inventory.balance.reconcileFilterAria")}
                placeholder={t("inventory.balance.reconcileFilterPlaceholder")}
                options={(["MATCH", "MISMATCH"] as const).map((value) => ({
                  value,
                  label: (
                    <>
                      <span className="hn-inventory-filter-prefix">
                        {t("inventory.balance.colReconcile")}:{" "}
                      </span>
                      {businessLabel(RECONCILE_STATUS_LABELS, value)}
                    </>
                  ),
                }))}
                onChange={(value) => {
                  setReconciliationStatus(
                    value as InventoryReconciliationStatus | "",
                  );
                  setBalancePage(1);
                }}
              />
            </div>
          ) : null}
          {hasFilters ? (
            <ActionButton
              kind="reset"
              onClick={resetFilters}
              className="hn-inventory-reset"
            >
              {t("reports.filters.clearFilters")}
            </ActionButton>
          ) : null}
        </div>

        <section
          className="hn-inventory-data"
          aria-label={t(
            isBalance ? "inventory.tab.balances" : "inventory.tab.movements",
          )}
        >
          {query.isError ? (
            <div className="hn-inventory-feedback">
              <ApiErrorAlert
                error={query.error}
                title={t(
                  isBalance
                    ? "inventory.balance.loadError"
                    : "inventory.movement.loadError",
                )}
                onRetry={() => void query.refetch()}
              />
            </div>
          ) : null}
          <TableLoadingBanner loading={query.isLoading} />
          <div className="hn-inventory-table">
            {isBalance ? (
              <ResponsiveDataTable<InventoryBalanceRow>
                headerCellStyle={TABLE_HEADER_STYLE}
                actionColumnWidth="8%"
                mobileBreakpoint="lg"
                rowKey={(row) => row.id}
                columns={balanceColumns}
                rows={balances}
                loading={balanceQuery.isLoading}
                emptyText={emptyContent}
                onRowClick={(row) => setBalanceDetailRow(row)}
                renderRowActions={(row) => (
                  <RowActionButton
                    kind="view"
                    onClick={(event) => {
                      event.stopPropagation();
                      setBalanceDetailRow(row);
                    }}
                  >
                    {t("inventory.balance.open")}
                  </RowActionButton>
                )}
              />
            ) : (
              <ResponsiveDataTable<StockMovementRow>
                headerCellStyle={TABLE_HEADER_STYLE}
                actionColumnWidth="10%"
                mobileBreakpoint="lg"
                rowKey={(row) => row.id}
                columns={movementColumns}
                rows={movements}
                loading={movementQuery.isLoading}
                emptyText={emptyContent}
                onRowClick={
                  canTrace
                    ? (row) => {
                        if (row.id) handleOpenTrace(String(row.id));
                      }
                    : undefined
                }
                renderRowActions={(row) => (
                  <Tooltip
                    title={t(
                      canTrace
                        ? "inventory.movement.traceTooltip"
                        : "inventory.movement.traceNoPermission",
                    )}
                  >
                    <span>
                      <RowActionButton
                        kind="trace"
                        iconOnly={false}
                        disabled={!canTrace || !row.id}
                        onClick={() => handleOpenTrace(String(row.id))}
                      >
                        {t("inventory.movement.trace")}
                      </RowActionButton>
                    </span>
                  </Tooltip>
                )}
              />
            )}
          </div>
          <div className="hn-inventory-footer">
            <div className="hn-inventory-page-size">
              <span aria-live="polite">
                {t("inventory.rangeLabel", {
                  from: formatQuantity(rangeFrom),
                  to: formatQuantity(rangeTo),
                  total: formatQuantity(pagination.total),
                })}
              </span>
              <UiSelect
                id="inventory-page-size"
                value={perPage}
                aria-label={t("inventory.balance.pageSizeAria")}
                menuClassName="hn-inventory-menu"
                minWidth={76}
                options={pageSizeOptions(perPage).map((size) => ({
                  value: size,
                  label: t("shared.table.perPage", { size }),
                }))}
                onChange={(value) => {
                  if (isBalance) {
                    setBalancePerPage(Number(value));
                    setBalancePage(1);
                  } else {
                    setMovementPerPage(Number(value));
                    setMovementPage(1);
                  }
                }}
              />
            </div>
            <UiPagination
              page={pagination.current}
              pageSize={pagination.pageSize}
              total={pagination.total}
              showTotal={false}
              onPageChange={(page) =>
                isBalance ? setBalancePage(page) : setMovementPage(page)
              }
            />
          </div>
        </section>
      </UiTabPanel>
      {currentBalanceDetail ? (
        <BalanceDetailModal
          balance={currentBalanceDetail}
          onClose={() => setBalanceDetailRow(null)}
          onTraceMovement={canTrace ? handleOpenTrace : undefined}
        />
      ) : null}
      {traceMovementId ? (
        <TraceModal
          movementId={traceMovementId === "__lookup__" ? null : traceMovementId}
          onClose={() => setTraceMovementId(null)}
        />
      ) : null}
    </div>
  );
}
