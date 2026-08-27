/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from "react";
import { Alert, Input, Pagination, Select, Space, Tag, Typography } from "antd";
import { Tab, Tabs } from "@mui/material";
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
import { ActionButton } from "@/shared/components/actions";

const stateColorMap: Record<ScanCodeState, string> = {
  waiting: "default",
  scanned: "processing",
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

// Màu Tag trạng thái: hoàn tất/hợp lệ = xanh lá, lỗi/không hợp lệ = đỏ,
// cảnh báo/chưa hoàn tất = cam vàng — theo quy ước chung của dự án.
const SCAN_RESULT_COLOR: Record<string, string> = {
  VALID: "success",
  DUPLICATE: "warning",
  UNKNOWN: "error",
  INVALID: "error",
};

const SCAN_BATCH_STATUS_COLOR: Record<string, string> = {
  OPEN: "processing",
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
        <Tag>{CARRIER_LABELS[row.code_type] ?? "Loại mã khác"}</Tag>
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
        <Tag color={row.status === "ACTIVE" ? "success" : "default"}>
          {businessLabel(MASTER_STATUS_LABELS, row.status, "Trạng thái khác")}
        </Tag>
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
        <Tag>
          {businessLabel(
            SCAN_CLASSIFICATION_LABELS,
            row.classification,
            "Đối tượng khác",
          )}
        </Tag>
      ),
    },
    {
      key: "stock_status",
      header: "Trạng thái tồn",
      sortType: "value",
      sortAccessor: (row) => row.stock_status,
      render: (row) => (
        <Tag color={row.stock_status === "AVAILABLE" ? "success" : "warning"}>
          {businessLabel(
            INVENTORY_STOCK_STATUS_LABELS,
            row.stock_status,
            "Trạng thái khác",
          )}
        </Tag>
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
      render: () => <Tag color="success">Không thay đổi tồn</Tag>,
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
        <Tag color={SCAN_BATCH_STATUS_COLOR[row.status] ?? "default"}>
          {businessLabel(
            SCAN_BATCH_STATUS_LABELS,
            row.status,
            "Trạng thái khác",
          )}
        </Tag>
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
        <Tag color={SCAN_RESULT_COLOR[row.status] ?? "default"}>
          {businessLabel(SCAN_RESULT_LABELS, row.status, "Kết quả khác")}
        </Tag>
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
    <div style={{ padding: 24 }}>
      <>
        <Tabs
          value={activeTab}
          onChange={(_event, value: string) => {
            setActiveTab(value);
            setClassifyResult(null);
            setClassifyState("waiting");
            setClassifyMessage("");
          }}
          sx={{ marginBottom: 2 }}
        >
          <Tab
            value="list"
            icon={<UnorderedListOutlined style={{ fontSize: 15 }} />}
            iconPosition="start"
            label="Danh sách mã vật lý"
            sx={{ minHeight: 40, textTransform: "none" }}
          />
          <Tab
            value="classify"
            icon={<ScanOutlined style={{ fontSize: 15 }} />}
            iconPosition="start"
            label="Nhận diện mã quét"
            sx={{ minHeight: 40, textTransform: "none" }}
          />
          <Tab
            value="history"
            icon={<HistoryOutlined style={{ fontSize: 15 }} />}
            iconPosition="start"
            label="Lịch sử quét"
            sx={{ minHeight: 40, textTransform: "none" }}
          />
        </Tabs>
      </>

      {activeTab === "list" && (
        <>
          <Space wrap style={{ marginBottom: 16 }}>
            <Input.Search
              placeholder="Giá trị mã..."
              aria-label="Giá trị mã"
              style={{ width: 285 }}
              value={codeSearch}
              allowClear
              onChange={(event) => setCodeSearch(event.target.value)}
            />
            <MvpPageSizeSelector
              value={codePerPage}
              onChange={(value) => {
                setCodePerPage(value);
                setCodePage(1);
              }}
            />
            <div style={{ flex: 1 }} />
            <ActionButton
              kind="barcode"
              disabled={!canCreatePhysicalCode}
              onClick={() => setIssueModalOpen(true)}
            >
              Tạo mã vật lý
            </ActionButton>
          </Space>
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
          <div
            style={{
              marginTop: 16,
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <Pagination
              current={codePage}
              pageSize={codePerPage}
              total={filteredCodes.length}
              showSizeChanger={false}
              showTotal={(total) => `Tổng ${total} mã vật lý`}
              onChange={setCodePage}
            />
          </div>
        </>
      )}

      {activeTab === "classify" && (
        <>
          <Alert
            type="info"
            showIcon
            title="Tra cứu mã an toàn"
            description="Nhận diện mã chỉ dùng để tra cứu thông tin. Thao tác này không làm tăng, giảm hoặc thay đổi tồn kho."
            style={{ marginBottom: 16 }}
          />
          <Space wrap style={{ marginBottom: 16 }}>
            <Select
              placeholder="Chọn kho"
              aria-label="Chọn kho"
              value={warehouseId || undefined}
              loading={warehousesQuery.isLoading}
              style={{ width: 250 }}
              onChange={setWarehouseId}
              options={warehouses.map((row) => ({
                value: String(row.id ?? ""),
                label: warehouseLabel(row),
              }))}
            />
            <Select<ScanContext>
              value={scanContext}
              onChange={setScanContext}
              options={SCAN_CONTEXT_OPTIONS}
              style={{ width: 220 }}
            />
            <Input.Search
              placeholder="Quét hoặc nhập mã..."
              aria-label="Quét hoặc nhập mã"
              value={scanValue}
              onChange={(event) => setScanValue(event.target.value)}
              onSearch={submitScan}
              style={{ width: 360 }}
              enterButton="Nhận diện"
              disabled={!warehouseId.trim()}
            />
            <ActionButton
              kind="barcode"
              onClick={submitScan}
              loading={loading && classifyState === "scanned"}
              disabled={!scanValue.trim() || !warehouseId.trim()}
            >
              Nhận diện mã
            </ActionButton>
          </Space>

          {classifyState !== "waiting" && classifyState !== "scanned" && (
            <Alert
              type={classifyState === "success" ? "success" : "error"}
              title={
                <Space wrap>
                  <Typography.Text strong>Kết quả:</Typography.Text>
                  <Tag color={stateColorMap[classifyState]}>
                    {STATE_LABELS[classifyState]}
                  </Tag>
                  <Typography.Text>{classifyMessage}</Typography.Text>
                </Space>
              }
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          {loading && classifyState === "scanned" && (
            <Alert
              type="info"
              title="Đang nhận diện mã..."
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          {classifyResult && (
            <ResponsiveDataTable
              columns={classifyColumns}
              rows={[classifyResult]}
              rowKey={(row) => row.raw_code}
            />
          )}
        </>
      )}

      {activeTab === "history" && (
        <>
          <InlineApiError
            error={historyError}
            title="Không thể tải lịch sử quét"
            onRetry={() => setReloadKey((value) => value + 1)}
          />
          <Space
            wrap
            style={{
              marginBottom: 8,
              width: "100%",
              justifyContent: "space-between",
            }}
          >
            <Space wrap>
              <Typography.Text strong>Lô quét</Typography.Text>
              <Input.Search
                placeholder="Tìm theo số lô..."
                aria-label="Tìm theo số lô"
                style={{ width: 220 }}
                value={batchSearch}
                allowClear
                onChange={(event) => setBatchSearch(event.target.value)}
              />
            </Space>
            <MvpPageSizeSelector
              value={batchPerPage}
              onChange={(value) => {
                setBatchPerPage(value);
                setBatchPage(1);
              }}
            />
          </Space>
          <ResponsiveDataTable
            columns={batchColumns}
            rows={filteredBatches}
            rowKey={(row) => row.id}
            loading={loading}
            emptyText={tableEmptyText(historyError)}
          />
          <div
            style={{
              marginTop: 16,
              marginBottom: 16,
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <Pagination
              current={batchPagination.current}
              pageSize={batchPerPage}
              total={
                normalizedBatchSearch
                  ? filteredBatches.length
                  : batchPagination.total
              }
              showSizeChanger={false}
              showTotal={(total) => `Tổng ${total} lô quét`}
              onChange={setBatchPage}
            />
          </div>

          <Space
            wrap
            style={{
              marginBottom: 8,
              width: "100%",
              justifyContent: "space-between",
            }}
          >
            <Space wrap>
              <Typography.Text strong>Sự kiện quét</Typography.Text>
              <Input.Search
                placeholder="Tìm theo mã..."
                aria-label="Tìm theo mã sự kiện quét"
                style={{ width: 220 }}
                value={eventSearch}
                allowClear
                onChange={(event) => setEventSearch(event.target.value)}
              />
            </Space>
            <MvpPageSizeSelector
              value={eventPerPage}
              onChange={(value) => {
                setEventPerPage(value);
                setEventPage(1);
              }}
            />
          </Space>
          <ResponsiveDataTable
            columns={eventColumns}
            rows={filteredEvents}
            rowKey={(row) => row.id}
            loading={loading}
            emptyText={tableEmptyText(historyError)}
          />
          <div
            style={{
              marginTop: 16,
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <Pagination
              current={eventPagination.current}
              pageSize={eventPerPage}
              total={
                normalizedEventSearch
                  ? filteredEvents.length
                  : eventPagination.total
              }
              showSizeChanger={false}
              showTotal={(total) => `Tổng ${total} sự kiện`}
              onChange={setEventPage}
            />
          </div>
        </>
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
    </div>
  );
}
