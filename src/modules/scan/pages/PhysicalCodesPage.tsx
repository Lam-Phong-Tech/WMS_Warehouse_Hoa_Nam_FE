/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from "react";
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

// Tông soft-tint theo UiStatusBadge — "processing"/"default" (antd cũ) ⇒ info/neutral.
const stateToneMap: Record<ScanCodeState, UiStatusTone> = {
  waiting: "neutral",
  scanned: "info",
  success: "success",
  error: "error",
};

const STATE_LABELS: Record<ScanCodeState, string> = {
  waiting: "Chờ quét",
  scanned: "Đang xử lý",
  success: "Thành công",
  error: "Có lỗi",
};

const CARRIER_LABELS: Record<string, string> = {
  QR: "QR",
  BARCODE: "Mã vạch",
  RFID: "RFID",
};

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

const SCAN_CONTEXT_OPTIONS: Array<{ value: ScanContext; label: string }> = [
  { value: "INBOUND", label: "Nhập kho" },
  { value: "OUTBOUND", label: "Xuất kho" },
  { value: "INVENTORY", label: "Tra cứu tồn kho" },
  { value: "TRACE", label: "Truy vết" },
  { value: "WARRANTY_RECEIVE", label: "Tiếp nhận bảo hành" },
  { value: "WARRANTY_TEMP_ONLY", label: "Bảo hành tạm" },
];

function warehouseLabel(row: Record<string, unknown>) {
  return String(
    row.name ?? row.warehouse_name ?? row.code ?? row.warehouse_code ?? "Kho",
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
  const filteredEvents = normalizedEventSearch
    ? events.filter((row) =>
        (row.code_value ?? "").toLowerCase().includes(normalizedEventSearch),
      )
    : events;

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
        `Mã ${response.raw_code} được nhận diện là ${businessLabel(
          SCAN_CLASSIFICATION_LABELS,
          response.classification,
          "đối tượng khác",
        )}. Thao tác này chỉ dùng để tra cứu, không thay đổi tồn kho.`,
      );
      setScanValue("");
    } catch (error: unknown) {
      setClassifyState("error");
      setClassifyMessage(
        getApiErrorMessage(error, "Không nhận diện được mã. Vui lòng thử lại."),
      );
    } finally {
      setLoading(false);
    }
  }, [scanContext, scanValue, warehouseId]);

  const codeColumns: ResponsiveTableColumn<PhysicalCode>[] = [
    {
      key: "stt",
      header: "STT",
      width: 60,
      align: "center",
      hideOnMobile: true,
      render: (row) =>
        (codePage - 1) * codePerPage + filteredCodes.indexOf(row) + 1,
    },
    {
      key: "code_value",
      header: "Giá trị mã",
      sortAccessor: (row) => row.code_value,
      render: (row) => row.code_value,
    },
    {
      key: "code_type",
      header: "Loại mã",
      sortType: "value",
      sortAccessor: (row) => row.code_type,
      hideOnMobile: true,
      render: (row) => (
        <UiStatusBadge
          label={CARRIER_LABELS[row.code_type] ?? "Loại mã khác"}
        />
      ),
    },
    {
      key: "carrier_type",
      header: "Hình thức mã",
      sortType: "value",
      sortAccessor: (row) => row.carrier_type,
      hideOnMobile: true,
      render: (row) => CARRIER_LABELS[row.carrier_type] ?? "Hình thức khác",
    },
    {
      key: "target_type",
      header: "Đối tượng gắn mã",
      sortType: "value",
      sortAccessor: (row) => row.target_type,
      render: (row) =>
        businessLabel(
          SCAN_CLASSIFICATION_LABELS,
          row.target_type,
          "Đối tượng khác",
        ),
    },
    {
      key: "target",
      header: "SKU / vật chứa",
      sortAccessor: (row) => row.sku_code || row.container_code || "",
      render: (row) => row.sku_code || row.container_code || "—",
    },
    {
      key: "status",
      header: "Trạng thái",
      sortType: "value",
      sortAccessor: (row) => row.status,
      render: (row) => (
        <UiStatusBadge
          tone={row.status === "ACTIVE" ? "success" : "neutral"}
          label={businessLabel(
            MASTER_STATUS_LABELS,
            row.status,
            "Trạng thái khác",
          )}
        />
      ),
    },
    {
      key: "location_hint",
      header: "Vị trí gợi ý",
      sortAccessor: (row) => row.location_hint ?? "",
      render: (row) => row.location_hint ?? "—",
    },
  ];

  const classifyColumns: ResponsiveTableColumn<ScanClassifyResponse>[] = [
    {
      key: "stt",
      header: "STT",
      width: 60,
      align: "center",
      hideOnMobile: true,
      render: () => 1,
    },
    {
      key: "raw_code",
      header: "Mã",
      sortAccessor: (row) => row.raw_code,
      render: (row) => row.raw_code,
    },
    {
      key: "context",
      header: "Ngữ cảnh sử dụng",
      sortType: "value",
      sortAccessor: (row) => row.context,
      render: (row) =>
        businessLabel(SCAN_CONTEXT_LABELS, row.context, "Ngữ cảnh khác"),
    },
    {
      key: "classification",
      header: "Nhận diện là",
      sortType: "value",
      sortAccessor: (row) => row.classification,
      render: (row) => (
        <UiStatusBadge
          label={businessLabel(
            SCAN_CLASSIFICATION_LABELS,
            row.classification,
            "Đối tượng khác",
          )}
        />
      ),
    },
    {
      key: "stock_status",
      header: "Trạng thái tồn",
      sortType: "value",
      sortAccessor: (row) => row.stock_status,
      render: (row) => (
        <UiStatusBadge
          tone={row.stock_status === "AVAILABLE" ? "success" : "warning"}
          label={businessLabel(
            INVENTORY_STOCK_STATUS_LABELS,
            row.stock_status,
            "Trạng thái khác",
          )}
        />
      ),
    },
    {
      key: "current_location",
      header: "Kho hiện tại",
      sortAccessor: (row) =>
        `${row.current_location.warehouse_code} — ${row.current_location.warehouse_name}`,
      render: (row) =>
        `${row.current_location.warehouse_code} — ${row.current_location.warehouse_name}`,
    },
    {
      key: "stock_effect",
      header: "Ảnh hưởng tồn kho",
      render: () => <UiStatusBadge tone="success" label="Không thay đổi tồn" />,
    },
  ];

  const batchColumns: ResponsiveTableColumn<ScanBatch>[] = [
    {
      key: "stt",
      header: "STT",
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
      header: "Lô",
      sortAccessor: (row) => row.batch_no,
      render: (row) => row.batch_no,
    },
    {
      key: "source_type",
      header: "Nguồn quét",
      sortType: "value",
      sortAccessor: (row) => row.source_type,
      render: (row) =>
        businessLabel(SCAN_CONTEXT_LABELS, row.source_type, "Nguồn khác"),
    },
    {
      key: "status",
      header: "Trạng thái",
      sortType: "value",
      sortAccessor: (row) => row.status,
      render: (row) => (
        <UiStatusBadge
          tone={SCAN_BATCH_STATUS_TONE[row.status] ?? "neutral"}
          label={businessLabel(
            SCAN_BATCH_STATUS_LABELS,
            row.status,
            "Trạng thái khác",
          )}
        />
      ),
    },
    {
      key: "valid_count",
      header: "Hợp lệ",
      align: "right",
      sortType: "value",
      sortAccessor: (row) => row.valid_count,
      render: (row) => row.valid_count,
    },
    {
      key: "duplicate_count",
      header: "Đã quét trước đó",
      align: "right",
      sortType: "value",
      sortAccessor: (row) => row.duplicate_count,
      hideOnMobile: true,
      render: (row) => row.duplicate_count,
    },
    {
      key: "unknown_count",
      header: "Không nhận diện",
      align: "right",
      sortType: "value",
      sortAccessor: (row) => row.unknown_count,
      hideOnMobile: true,
      render: (row) => row.unknown_count,
    },
    {
      key: "invalid_count",
      header: "Không hợp lệ",
      align: "right",
      sortType: "value",
      sortAccessor: (row) => row.invalid_count,
      render: (row) => row.invalid_count,
    },
  ];

  const eventColumns: ResponsiveTableColumn<ScanEvent>[] = [
    {
      key: "stt",
      header: "STT",
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
      header: "Mã",
      sortAccessor: (row) => row.code_value,
      render: (row) => row.code_value,
    },
    {
      key: "code_type",
      header: "Loại mã",
      sortType: "value",
      sortAccessor: (row) => row.code_type,
      render: (row) => CARRIER_LABELS[row.code_type] ?? "Loại mã khác",
    },
    {
      key: "status",
      header: "Kết quả",
      sortType: "value",
      sortAccessor: (row) => row.status,
      render: (row) => (
        <UiStatusBadge
          tone={SCAN_RESULT_TONE[row.status] ?? "neutral"}
          label={businessLabel(SCAN_RESULT_LABELS, row.status, "Kết quả khác")}
        />
      ),
    },
    {
      key: "scanned_at",
      header: "Thời gian quét",
      sortType: "value",
      sortAccessor: (row) => new Date(row.scanned_at),
      render: (row) => formatDateTime(row.scanned_at),
    },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 2 }}>
        <UiTabs
          aria-label="Các tab mã vật lý"
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
                "Danh sách mã vật lý",
              ),
            },
            {
              key: "classify",
              label: tabLabel(
                <ScanOutlined style={{ fontSize: 15 }} />,
                "Nhận diện mã quét",
              ),
            },
            {
              key: "history",
              label: tabLabel(
                <HistoryOutlined style={{ fontSize: 15 }} />,
                "Lịch sử quét",
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
              placeholder="Giá trị mã..."
              aria-label="Giá trị mã"
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
              Tạo mã vật lý
            </ActionButton>
          </Stack>
          <InlineApiError
            error={listError}
            title="Không thể tải danh sách mã vật lý"
            onRetry={() => setReloadKey((value) => value + 1)}
          />
          <ResponsiveDataTable
            columns={codeColumns}
            rows={filteredCodes}
            rowKey={(row) => row.id}
            loading={loading}
            emptyText={tableEmptyText(listError)}
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
              Tổng {filteredCodes.length} mã vật lý
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
            <UiAlert tone="info" title="Tra cứu mã an toàn">
              Nhận diện mã chỉ dùng để tra cứu thông tin. Thao tác này không làm
              tăng, giảm hoặc thay đổi tồn kho.
            </UiAlert>
          </Box>
          <Stack
            direction="row"
            sx={{ flexWrap: "wrap", gap: 1, alignItems: "center", mb: 2 }}
          >
            <UiSelect
              aria-label="Chọn kho"
              placeholder="Chọn kho"
              value={warehouseId}
              minWidth={250}
              onChange={setWarehouseId}
              options={warehouses.map((row) => ({
                value: String(row.id ?? ""),
                label: warehouseLabel(row),
              }))}
            />
            <UiSelect
              aria-label="Ngữ cảnh quét"
              value={scanContext}
              minWidth={220}
              onChange={(value) => setScanContext(value as ScanContext)}
              options={SCAN_CONTEXT_OPTIONS}
            />
            <UiTextField
              placeholder="Quét hoặc nhập mã..."
              slotProps={{ htmlInput: { "aria-label": "Quét hoặc nhập mã" } }}
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
              Nhận diện
            </ActionButton>
            <ActionButton
              kind="barcode"
              onClick={submitScan}
              loading={loading && classifyState === "scanned"}
              disabled={!scanValue.trim() || !warehouseId.trim()}
            >
              Nhận diện mã
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
                    Kết quả:
                  </Box>
                  <UiStatusBadge
                    tone={stateToneMap[classifyState]}
                    label={STATE_LABELS[classifyState]}
                  />
                  <span>{classifyMessage}</span>
                </Stack>
              </UiAlert>
            </Box>
          )}

          {loading && classifyState === "scanned" && (
            <Box sx={{ mb: 2 }}>
              <UiAlert tone="info">Đang nhận diện mã...</UiAlert>
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
            title="Không thể tải lịch sử quét"
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
                Lô quét
              </Box>
              <SearchInput
                placeholder="Tìm theo số lô..."
                aria-label="Tìm theo số lô"
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
            emptyText={tableEmptyText(historyError)}
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
              Tổng{" "}
              {normalizedBatchSearch
                ? filteredBatches.length
                : batchPagination.total}{" "}
              lô quét
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
                Sự kiện quét
              </Box>
              <SearchInput
                placeholder="Tìm theo mã..."
                aria-label="Tìm theo mã sự kiện quét"
                width={220}
                value={eventSearch}
                onChange={setEventSearch}
              />
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
            emptyText={tableEmptyText(historyError)}
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
              Tổng{" "}
              {normalizedEventSearch
                ? filteredEvents.length
                : eventPagination.total}{" "}
              sự kiện
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
