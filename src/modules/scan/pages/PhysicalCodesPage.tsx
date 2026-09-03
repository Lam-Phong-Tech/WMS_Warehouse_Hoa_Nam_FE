/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Stack,
  UiAlert,
  UiPagination,
  UiSelect,
  UiStatusBadge,
  UiTabs,
  UiTabPanel,
  UiText,
  UiTextField,
  type UiStatusTone,
} from "@/shared/ui";
import {
  HistoryOutlined,
  ScanOutlined,
  UnorderedListOutlined,
} from "@/shared/components/icons";
import { useQuery } from "@tanstack/react-query";
import { getApiErrorMessage } from "@/shared/api/api-error";
import {
  InlineApiError,
  tableEmptyText,
} from "@/shared/components/feedback/BusinessState";
import { SearchInput } from "@/shared/components/data-display/SearchInput";
import { MvpPageSizeSelector } from "@/shared/components/mvp/MvpListPagination";
import { resolveApiPagination } from "@/shared/components/mvp/mvp-pagination";
import type { ApiMeta } from "@/shared/types/api-response";
import {
  INVENTORY_STOCK_STATUS_LABELS,
  MASTER_STATUS_LABELS,
  SCAN_BATCH_STATUS_LABELS,
  SCAN_CLASSIFICATION_LABELS,
  SCAN_CONTEXT_LABELS,
  SCAN_RESULT_LABELS,
  businessLabel,
} from "@/shared/constants/business-labels";
import { fetchWarehouses } from "@/modules/master-data/services/warehouse.service";
import {
  classifyScanCodes,
  fetchPhysicalCodes,
  fetchScanBatchesPage,
  fetchScanEventsPage,
} from "../services/scanService";
import { IssuePhysicalCodeModal } from "../components/IssuePhysicalCodeModal";
import { useCan } from "@/shared/components/permission";
import { WMS_PERMISSION_CATALOG } from "@/shared/constants/wms-permissions";
import { formatDateTime } from "@/shared/utils/format-date";
import {
  ResponsiveDataTable,
  type ResponsiveTableColumn,
} from "@/shared/components/data-display/ResponsiveDataTable";
import type {
  PhysicalCode,
  ScanBatch,
  ScanClassifyResponse,
  ScanCodeState,
  ScanContext,
  ScanEvent,
} from "../types";
import type { ReactNode } from "react";
import { ActionButton } from "@/shared/components/actions";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { useT, type TranslateFn } from "@/shared/i18n/useT";

// Tông soft-tint theo UiStatusBadge — "processing"/"default" (antd cũ) ⇒ info/neutral.
const stateToneMap: Record<ScanCodeState, UiStatusTone> = {
  waiting: "neutral",
  scanned: "info",
  success: "success",
  error: "error",
};

function stateLabel(t: TranslateFn, state: ScanCodeState): string {
  switch (state) {
    case "waiting":
      return t("scan.physical.stateWaiting");
    case "scanned":
      return t("scan.physical.stateProcessing");
    case "success":
      return t("scan.physical.stateSuccess");
    default:
      return t("scan.physical.stateError");
  }
}

function carrierLabel(t: TranslateFn, value: string): string | undefined {
  if (value === "QR") return "QR";
  if (value === "BARCODE") return t("scan.carrierBarcode");
  if (value === "RFID") return "RFID";
  return undefined;
}

// Màu badge trạng thái: hoàn tất/hợp lệ = xanh lá, lỗi/không hợp lệ = đỏ,
// cảnh báo/chưa hoàn tất = cam vàng — theo quy ước chung của dự án.
const SCAN_RESULT_TONE: Record<string, UiStatusTone> = {
  VALID: "success",
  DUPLICATE: "warning",
  UNKNOWN: "error",
  INVALID: "error",
};

const SCAN_BATCH_STATUS_TONE: Record<string, UiStatusTone> = {
  OPEN: "info",
  CLASSIFIED: "warning",
  PARTIALLY_POSTED: "warning",
  CLOSED: "success",
  CANCELLED: "error",
};

function scanContextOptions(
  t: TranslateFn,
): Array<{ value: ScanContext; label: string }> {
  return [
    { value: "INBOUND", label: t("scan.physical.contextInbound") },
    { value: "OUTBOUND", label: t("scan.physical.contextOutbound") },
    { value: "INVENTORY", label: t("scan.physical.contextInventory") },
    { value: "TRACE", label: t("scan.physical.contextTrace") },
    {
      value: "WARRANTY_RECEIVE",
      label: t("scan.physical.contextWarrantyReceive"),
    },
    {
      value: "WARRANTY_TEMP_ONLY",
      label: t("scan.physical.contextWarrantyTemp"),
    },
  ];
}

function warehouseLabel(t: TranslateFn, row: Record<string, unknown>) {
  return String(
    row.name ??
      row.warehouse_name ??
      row.code ??
      row.warehouse_code ??
      t("scan.physical.warehouseFallback"),
  );
}

function tabLabel(icon: ReactNode, text: string) {
  return (
    <Box
      component="span"
      sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}
    >
      {icon}
      {text}
    </Box>
  );
}

export default function PhysicalCodesPage() {
  const t = useT();
  const [activeTab, setActiveTab] = useState("list");
  const [codes, setCodes] = useState<PhysicalCode[]>([]);
  const [batches, setBatches] = useState<ScanBatch[]>([]);
  const [events, setEvents] = useState<ScanEvent[]>([]);
  const [codePage, setCodePage] = useState(1);
  const [codePerPage, setCodePerPage] = useState(10);
  const [codeSearch, setCodeSearch] = useState("");
  const [batchPage, setBatchPage] = useState(1);
  const [batchPerPage, setBatchPerPage] = useState(10);
  const [batchSearch, setBatchSearch] = useState("");
  const [eventPage, setEventPage] = useState(1);
  const [eventPerPage, setEventPerPage] = useState(10);
  const [eventSearch, setEventSearch] = useState("");
  // Mục 8: drill-down từ một lô quét xuống các event lỗi của chính lô đó.
  const [eventBatchFilter, setEventBatchFilter] = useState("");
  const [eventBatchLabel, setEventBatchLabel] = useState("");
  const [batchMeta, setBatchMeta] = useState<ApiMeta>({});
  const [eventMeta, setEventMeta] = useState<ApiMeta>({});
  const [scanValue, setScanValue] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [scanContext, setScanContext] = useState<ScanContext>("TRACE");
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<unknown>(null);
  const [historyError, setHistoryError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [classifyResult, setClassifyResult] =
    useState<ScanClassifyResponse | null>(null);
  const [classifyState, setClassifyState] = useState<ScanCodeState>("waiting");
  const [classifyMessage, setClassifyMessage] = useState("");
  const [issueModalOpen, setIssueModalOpen] = useState(false);

  const canCreatePhysicalCode = useCan(
    WMS_PERMISSION_CATALOG.PHYSICAL_CODE_CREATE,
  );

  const warehousesQuery = useQuery({
    queryKey: ["physical-codes", "active-warehouse"],
    queryFn: () => fetchWarehouses({ status: "ACTIVE" }),
  });
  const warehouses = warehousesQuery.data ?? [];

  useEffect(() => {
    if (!warehouseId && warehouses.length > 0) {
      setWarehouseId(String(warehouses[0].id ?? ""));
    }
  }, [warehouseId, warehouses]);

  const batchPagination = resolveApiPagination(batchMeta, {
    page: batchPage,
    pageSize: batchPerPage,
    rowCount: batches.length,
  });
  const eventPagination = resolveApiPagination(eventMeta, {
    page: eventPage,
    pageSize: eventPerPage,
    rowCount: events.length,
  });

  // Lọc hiển thị phía client trên dữ liệu trang hiện tại — không phát sinh
  // tham số API mới, chỉ để bảng tra cứu có ô lọc theo yêu cầu UX (tiêu chí 3).
  const normalizedCodeSearch = codeSearch.trim().toLowerCase();
  const filteredCodes = normalizedCodeSearch
    ? codes.filter((row) =>
        (row.code_value ?? "").toLowerCase().includes(normalizedCodeSearch),
      )
    : codes;

  const normalizedBatchSearch = batchSearch.trim().toLowerCase();
  const filteredBatches = normalizedBatchSearch
    ? batches.filter((row) =>
        (row.batch_no ?? "").toLowerCase().includes(normalizedBatchSearch),
      )
    : batches;

  const normalizedEventSearch = eventSearch.trim().toLowerCase();
  const filteredEvents = events.filter((row) => {
    if (eventBatchFilter && row.batch_id !== eventBatchFilter) return false;
    if (
      normalizedEventSearch &&
      !(row.code_value ?? "").toLowerCase().includes(normalizedEventSearch)
    ) {
      return false;
    }
    return true;
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    if (activeTab === "list") {
      setListError(null);
      fetchPhysicalCodes({ page: codePage, per_page: codePerPage })
        .then((data) => {
          if (!cancelled) setCodes(data);
        })
        .catch((fetchError: unknown) => {
          if (!cancelled) {
            setCodes([]);
            setListError(fetchError);
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    } else if (activeTab === "history") {
      setHistoryError(null);
      Promise.all([
        fetchScanBatchesPage({ page: batchPage, per_page: batchPerPage }),
        fetchScanEventsPage({ page: eventPage, per_page: eventPerPage }),
      ])
        .then(([batchResult, eventResult]) => {
          if (!cancelled) {
            setBatches(batchResult.data);
            setBatchMeta(batchResult.meta);
            setEvents(eventResult.data);
            setEventMeta(eventResult.meta);
          }
        })
        .catch((fetchError: unknown) => {
          if (!cancelled) {
            setBatches([]);
            setEvents([]);
            setBatchMeta({});
            setEventMeta({});
            setHistoryError(fetchError);
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    } else {
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [
    activeTab,
    batchPage,
    batchPerPage,
    codePage,
    codePerPage,
    eventPage,
    eventPerPage,
    reloadKey,
  ]);

  const submitScan = useCallback(async () => {
    const rawCode = scanValue.trim();
    if (!rawCode || !warehouseId.trim()) return;

    setLoading(true);
    setClassifyState("scanned");
    setClassifyResult(null);
    setClassifyMessage("");

    try {
      const response = await classifyScanCodes({
        raw_code: rawCode,
        context: scanContext,
        warehouse_id: warehouseId.trim(),
      });

      setClassifyResult(response);
      setClassifyState("success");
      setClassifyMessage(
        t("scan.physical.classifySuccess", {
          code: response.raw_code,
          classification: businessLabel(
            SCAN_CLASSIFICATION_LABELS,
            response.classification,
            t("scan.physical.classificationOtherLower"),
          ),
        }),
      );
      setScanValue("");
    } catch (error: unknown) {
      setClassifyState("error");
      setClassifyMessage(
        getApiErrorMessage(error, t("scan.physical.classifyFailed")),
      );
    } finally {
      setLoading(false);
    }
  }, [scanContext, scanValue, warehouseId, t]);

  const codeColumns: ResponsiveTableColumn<PhysicalCode>[] = [
    {
      key: "stt",
      header: t("scan.physical.colStt"),
      width: 60,
      align: "center",
      hideOnMobile: true,
      render: (row) =>
        (codePage - 1) * codePerPage + filteredCodes.indexOf(row) + 1,
    },
    {
      key: "code_value",
      header: t("scan.physical.colCodeValue"),
      sortAccessor: (row) => row.code_value,
      render: (row) => row.code_value,
    },
    {
      key: "code_type",
      header: t("scan.physical.colCodeType"),
      sortType: "value",
      sortAccessor: (row) => row.code_type,
      hideOnMobile: true,
      render: (row) => (
        <UiStatusBadge
          label={
            carrierLabel(t, row.code_type) ?? t("scan.physical.codeTypeOther")
          }
        />
      ),
    },
    {
      key: "carrier_type",
      header: t("scan.physical.colCarrierType"),
      sortType: "value",
      sortAccessor: (row) => row.carrier_type,
      hideOnMobile: true,
      render: (row) =>
        carrierLabel(t, row.carrier_type) ?? t("scan.physical.carrierOther"),
    },
    {
      key: "target_type",
      header: t("scan.physical.colTargetType"),
      sortType: "value",
      sortAccessor: (row) => row.target_type,
      render: (row) =>
        businessLabel(
          SCAN_CLASSIFICATION_LABELS,
          row.target_type,
          t("scan.physical.classificationOther"),
        ),
    },
    {
      key: "target",
      header: t("scan.physical.colTarget"),
      sortAccessor: (row) => row.sku_code || row.container_code || "",
      render: (row) => row.sku_code || row.container_code || EMPTY_TEXT,
    },
    {
      key: "status",
      header: t("scan.physical.colStatus"),
      sortType: "value",
      sortAccessor: (row) => row.status,
      render: (row) => (
        <UiStatusBadge
          tone={row.status === "ACTIVE" ? "success" : "neutral"}
          label={businessLabel(
            MASTER_STATUS_LABELS,
            row.status,
            t("scan.statusOther"),
          )}
        />
      ),
    },
    {
      key: "location_hint",
      header: t("scan.physical.colLocationHint"),
      sortAccessor: (row) => row.location_hint ?? "",
      render: (row) => row.location_hint ?? EMPTY_TEXT,
    },
  ];

  const classifyColumns: ResponsiveTableColumn<ScanClassifyResponse>[] = [
    {
      key: "stt",
      header: t("scan.physical.colStt"),
      width: 60,
      align: "center",
      hideOnMobile: true,
      render: () => 1,
    },
    {
      key: "raw_code",
      header: t("scan.physical.colCode"),
      sortAccessor: (row) => row.raw_code,
      render: (row) => row.raw_code,
    },
    {
      key: "context",
      header: t("scan.physical.colContext"),
      sortType: "value",
      sortAccessor: (row) => row.context,
      render: (row) =>
        businessLabel(
          SCAN_CONTEXT_LABELS,
          row.context,
          t("scan.physical.contextOther"),
        ),
    },
    {
      key: "classification",
      header: t("scan.physical.colClassification"),
      sortType: "value",
      sortAccessor: (row) => row.classification,
      render: (row) => (
        <UiStatusBadge
          label={businessLabel(
            SCAN_CLASSIFICATION_LABELS,
            row.classification,
            t("scan.physical.classificationOther"),
          )}
        />
      ),
    },
    {
      key: "stock_status",
      header: t("scan.physical.colStockStatus"),
      sortType: "value",
      sortAccessor: (row) => row.stock_status,
      render: (row) => (
        <UiStatusBadge
          tone={row.stock_status === "AVAILABLE" ? "success" : "warning"}
          label={businessLabel(
            INVENTORY_STOCK_STATUS_LABELS,
            row.stock_status,
            t("scan.statusOther"),
          )}
        />
      ),
    },
    {
      key: "current_location",
      header: t("scan.physical.colCurrentWarehouse"),
      sortAccessor: (row) =>
        `${row.current_location.warehouse_code} — ${row.current_location.warehouse_name}`,
      render: (row) =>
        `${row.current_location.warehouse_code} — ${row.current_location.warehouse_name}`,
    },
    {
      key: "stock_effect",
      header: t("scan.physical.colStockEffect"),
      render: () => (
        <UiStatusBadge
          tone="success"
          label={t("scan.physical.stockUnchanged")}
        />
      ),
    },
  ];

  const batchColumns: ResponsiveTableColumn<ScanBatch>[] = [
    {
      key: "stt",
      header: t("scan.physical.colStt"),
      width: 60,
      align: "center",
      hideOnMobile: true,
      render: (row) =>
        (batchPagination.current - 1) * batchPerPage +
        filteredBatches.indexOf(row) +
        1,
    },
    {
      key: "batch_no",
      header: t("scan.physical.colBatch"),
      sortAccessor: (row) => row.batch_no,
      render: (row) => row.batch_no,
    },
    {
      key: "source_type",
      header: t("scan.physical.colSource"),
      sortType: "value",
      sortAccessor: (row) => row.source_type,
      render: (row) =>
        businessLabel(
          SCAN_CONTEXT_LABELS,
          row.source_type,
          t("scan.physical.sourceOther"),
        ),
    },
    {
      key: "status",
      header: t("scan.physical.colStatus"),
      sortType: "value",
      sortAccessor: (row) => row.status,
      render: (row) => (
        <UiStatusBadge
          tone={SCAN_BATCH_STATUS_TONE[row.status] ?? "neutral"}
          label={businessLabel(
            SCAN_BATCH_STATUS_LABELS,
            row.status,
            t("scan.statusOther"),
          )}
        />
      ),
    },
    {
      key: "total_codes",
      header: t("scan.physical.colTotalLines"),
      align: "right",
      sortType: "value",
      sortAccessor: (row) => row.total_codes,
      hideOnMobile: true,
      render: (row) => row.total_codes,
    },
    {
      key: "valid_count",
      header: t("scan.physical.colValid"),
      align: "right",
      sortType: "value",
      sortAccessor: (row) => row.valid_count,
      render: (row) => row.valid_count,
    },
    {
      key: "duplicate_count",
      header: t("scan.physical.colDuplicate"),
      align: "right",
      sortType: "value",
      sortAccessor: (row) => row.duplicate_count,
      hideOnMobile: true,
      render: (row) => row.duplicate_count,
    },
    {
      key: "unknown_count",
      header: t("scan.physical.colUnknown"),
      align: "right",
      sortType: "value",
      sortAccessor: (row) => row.unknown_count,
      hideOnMobile: true,
      render: (row) => row.unknown_count,
    },
    {
      key: "invalid_count",
      header: t("scan.physical.colInvalid"),
      align: "right",
      sortType: "value",
      sortAccessor: (row) => row.invalid_count,
      render: (row) => row.invalid_count,
    },
    {
      key: "drilldown",
      header: t("scan.physical.colDetail"),
      align: "center",
      render: (row) => (
        <ActionButton
          kind="view"
          label={t("scan.physical.viewLines")}
          onClick={() => {
            setEventBatchFilter(row.id);
            setEventBatchLabel(row.batch_no);
            setEventPage(1);
          }}
        />
      ),
    },
  ];

  const eventColumns: ResponsiveTableColumn<ScanEvent>[] = [
    {
      key: "stt",
      header: t("scan.physical.colStt"),
      width: 60,
      align: "center",
      hideOnMobile: true,
      render: (row) =>
        (eventPagination.current - 1) * eventPerPage +
        filteredEvents.indexOf(row) +
        1,
    },
    {
      key: "code_value",
      header: t("scan.physical.colCode"),
      sortAccessor: (row) => row.code_value,
      render: (row) => row.code_value,
    },
    {
      key: "code_type",
      header: t("scan.physical.colCodeType"),
      sortType: "value",
      sortAccessor: (row) => row.code_type,
      render: (row) =>
        carrierLabel(t, row.code_type) ?? t("scan.physical.codeTypeOther"),
    },
    {
      key: "status",
      header: t("scan.physical.colResult"),
      sortType: "value",
      sortAccessor: (row) => row.status,
      render: (row) => (
        <UiStatusBadge
          tone={SCAN_RESULT_TONE[row.status] ?? "neutral"}
          label={businessLabel(
            SCAN_RESULT_LABELS,
            row.status,
            t("scan.physical.resultOther"),
          )}
        />
      ),
    },
    {
      key: "message",
      header: t("scan.physical.colMessage"),
      sortAccessor: (row) => row.message ?? "",
      render: (row) => row.message ?? EMPTY_TEXT,
    },
    {
      key: "scanned_at",
      header: t("scan.physical.colScannedAt"),
      sortType: "value",
      sortAccessor: (row) => new Date(row.scanned_at),
      render: (row) => formatDateTime(row.scanned_at),
    },
  ];

  const contextOptions = useMemo(() => scanContextOptions(t), [t]);

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 2 }}>
        <UiTabs
          aria-label={t("scan.physical.tabsAria")}
          value={activeTab}
          onChange={(key) => {
            setActiveTab(key);
            setClassifyResult(null);
            setClassifyState("waiting");
            setClassifyMessage("");
          }}
          items={[
            {
              key: "list",
              label: tabLabel(
                <UnorderedListOutlined style={{ fontSize: 15 }} />,
                t("scan.physical.tabList"),
              ),
            },
            {
              key: "classify",
              label: tabLabel(
                <ScanOutlined style={{ fontSize: 15 }} />,
                t("scan.physical.tabClassify"),
              ),
            },
            {
              key: "history",
              label: tabLabel(
                <HistoryOutlined style={{ fontSize: 15 }} />,
                t("scan.physical.tabHistory"),
              ),
            },
          ]}
        />
      </Box>

      {activeTab === "list" && (
        <UiTabPanel value={activeTab}>
          <Stack
            direction="row"
            sx={{ flexWrap: "wrap", gap: 1, alignItems: "center", mb: 2 }}
          >
            <SearchInput
              placeholder={t("scan.physical.searchCodePlaceholder")}
              aria-label={t("scan.physical.colCodeValue")}
              width={285}
              value={codeSearch}
              onChange={setCodeSearch}
            />
            <MvpPageSizeSelector
              value={codePerPage}
              onChange={(value) => {
                setCodePerPage(value);
                setCodePage(1);
              }}
            />
            <Box sx={{ flex: 1 }} />
            <ActionButton
              kind="barcode"
              disabled={!canCreatePhysicalCode}
              onClick={() => setIssueModalOpen(true)}
            >
              {t("scan.physical.createCode")}
            </ActionButton>
          </Stack>
          <InlineApiError
            error={listError}
            title={t("scan.physical.listLoadFailed")}
            onRetry={() => setReloadKey((value) => value + 1)}
          />
          <ResponsiveDataTable
            columns={codeColumns}
            rows={filteredCodes}
            rowKey={(row) => row.id}
            loading={loading}
            emptyText={tableEmptyText(
              listError,
              codeSearch.trim()
                ? t("scan.physical.emptyCodesFiltered")
                : t("scan.physical.emptyCodes"),
            )}
          />
          <Box
            sx={{
              mt: 2,
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 1.5,
            }}
          >
            <UiText variant="secondary">
              {t("scan.physical.totalCodes", { count: filteredCodes.length })}
            </UiText>
            <UiPagination
              page={codePage}
              pageSize={codePerPage}
              total={filteredCodes.length}
              showTotal={false}
              onPageChange={setCodePage}
            />
          </Box>
        </UiTabPanel>
      )}

      {activeTab === "classify" && (
        <UiTabPanel value={activeTab}>
          <Box sx={{ mb: 2 }}>
            <UiAlert tone="info" title={t("scan.physical.classifyAlertTitle")}>
              {t("scan.physical.classifyAlertBody")}
            </UiAlert>
          </Box>
          <Stack
            direction="row"
            sx={{ flexWrap: "wrap", gap: 1, alignItems: "center", mb: 2 }}
          >
            <UiSelect
              aria-label={t("scan.physical.selectWarehouse")}
              placeholder={t("scan.physical.selectWarehouse")}
              value={warehouseId}
              minWidth={250}
              onChange={setWarehouseId}
              options={warehouses.map((row) => ({
                value: String(row.id ?? ""),
                label: warehouseLabel(t, row),
              }))}
            />
            <UiSelect
              aria-label={t("scan.physical.contextAria")}
              value={scanContext}
              minWidth={220}
              onChange={(value) => setScanContext(value as ScanContext)}
              options={contextOptions}
            />
            <UiTextField
              placeholder={t("scan.physical.scanInputPlaceholder")}
              slotProps={{
                htmlInput: { "aria-label": t("scan.physical.scanInputAria") },
              }}
              value={scanValue}
              onChange={(event) => setScanValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void submitScan();
              }}
              sx={{ width: 300 }}
              disabled={!warehouseId.trim()}
            />
            <ActionButton
              kind="scan"
              onClick={submitScan}
              disabled={!warehouseId.trim()}
            >
              {t("scan.physical.classifyAction")}
            </ActionButton>
            <ActionButton
              kind="barcode"
              onClick={submitScan}
              loading={loading && classifyState === "scanned"}
              disabled={!scanValue.trim() || !warehouseId.trim()}
            >
              {t("scan.physical.classifyCodeAction")}
            </ActionButton>
          </Stack>

          {classifyState !== "waiting" && classifyState !== "scanned" && (
            <Box sx={{ mb: 2 }}>
              <UiAlert tone={classifyState === "success" ? "success" : "error"}>
                <Stack
                  direction="row"
                  sx={{ flexWrap: "wrap", gap: 1, alignItems: "center" }}
                >
                  <Box component="span" sx={{ fontWeight: 600 }}>
                    {t("scan.physical.resultLabel")}
                  </Box>
                  <UiStatusBadge
                    tone={stateToneMap[classifyState]}
                    label={stateLabel(t, classifyState)}
                  />
                  <span>{classifyMessage}</span>
                </Stack>
              </UiAlert>
            </Box>
          )}

          {loading && classifyState === "scanned" && (
            <Box sx={{ mb: 2 }}>
              <UiAlert tone="info">{t("scan.physical.classifying")}</UiAlert>
            </Box>
          )}

          {classifyResult && (
            <ResponsiveDataTable
              columns={classifyColumns}
              rows={[classifyResult]}
              rowKey={(row) => row.raw_code}
            />
          )}
        </UiTabPanel>
      )}

      {activeTab === "history" && (
        <UiTabPanel value={activeTab}>
          <InlineApiError
            error={historyError}
            title={t("scan.physical.historyLoadFailed")}
            onRetry={() => setReloadKey((value) => value + 1)}
          />
          <Stack
            direction="row"
            sx={{
              mb: 1,
              width: "100%",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 1,
            }}
          >
            <Stack
              direction="row"
              sx={{ flexWrap: "wrap", gap: 1, alignItems: "center" }}
            >
              <Box component="span" sx={{ fontWeight: 600 }}>
                {t("scan.physical.batchSectionTitle")}
              </Box>
              <SearchInput
                placeholder={t("scan.physical.searchBatchPlaceholder")}
                aria-label={t("scan.physical.searchBatchAria")}
                width={220}
                value={batchSearch}
                onChange={setBatchSearch}
              />
            </Stack>
            <MvpPageSizeSelector
              value={batchPerPage}
              onChange={(value) => {
                setBatchPerPage(value);
                setBatchPage(1);
              }}
            />
          </Stack>
          <ResponsiveDataTable
            columns={batchColumns}
            rows={filteredBatches}
            rowKey={(row) => row.id}
            loading={loading}
            emptyText={tableEmptyText(
              historyError,
              normalizedBatchSearch
                ? t("scan.physical.emptyBatchesFiltered")
                : t("scan.physical.emptyBatches"),
            )}
          />
          <Box
            sx={{
              mt: 2,
              mb: 2,
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 1.5,
            }}
          >
            <UiText variant="secondary">
              {t("scan.physical.totalBatches", {
                count: normalizedBatchSearch
                  ? filteredBatches.length
                  : batchPagination.total,
              })}
            </UiText>
            <UiPagination
              page={batchPagination.current}
              pageSize={batchPerPage}
              total={
                normalizedBatchSearch
                  ? filteredBatches.length
                  : batchPagination.total
              }
              showTotal={false}
              onPageChange={setBatchPage}
            />
          </Box>

          <Stack
            direction="row"
            sx={{
              mb: 1,
              width: "100%",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 1,
            }}
          >
            <Stack
              direction="row"
              sx={{ flexWrap: "wrap", gap: 1, alignItems: "center" }}
            >
              <Box component="span" sx={{ fontWeight: 600 }}>
                {t("scan.physical.eventSectionTitle")}
              </Box>
              <SearchInput
                placeholder={t("scan.physical.searchEventPlaceholder")}
                aria-label={t("scan.physical.searchEventAria")}
                width={220}
                value={eventSearch}
                onChange={setEventSearch}
              />
              {eventBatchFilter ? (
                <UiStatusBadge
                  tone="info"
                  onDelete={() => {
                    setEventBatchFilter("");
                    setEventBatchLabel("");
                    setEventPage(1);
                  }}
                  label={t("scan.physical.filteringByBatch", {
                    batch: eventBatchLabel || eventBatchFilter,
                  })}
                />
              ) : null}
            </Stack>
            <MvpPageSizeSelector
              value={eventPerPage}
              onChange={(value) => {
                setEventPerPage(value);
                setEventPage(1);
              }}
            />
          </Stack>
          <ResponsiveDataTable
            columns={eventColumns}
            rows={filteredEvents}
            rowKey={(row) => row.id}
            loading={loading}
            emptyText={tableEmptyText(
              historyError,
              normalizedEventSearch
                ? t("scan.physical.emptyEventsFiltered")
                : t("scan.physical.emptyEvents"),
            )}
          />
          <Box
            sx={{
              mt: 2,
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 1.5,
            }}
          >
            <UiText variant="secondary">
              {t("scan.physical.totalEvents", {
                count: normalizedEventSearch
                  ? filteredEvents.length
                  : eventPagination.total,
              })}
            </UiText>
            <UiPagination
              page={eventPagination.current}
              pageSize={eventPerPage}
              total={
                normalizedEventSearch
                  ? filteredEvents.length
                  : eventPagination.total
              }
              showTotal={false}
              onPageChange={setEventPage}
            />
          </Box>
        </UiTabPanel>
      )}

      <IssuePhysicalCodeModal
        open={issueModalOpen}
        onClose={() => setIssueModalOpen(false)}
        onIssued={() => {
          setIssueModalOpen(false);
          setActiveTab("list");
          setCodePage(1);
          setReloadKey((value) => value + 1);
        }}
      />
    </Box>
  );
}
