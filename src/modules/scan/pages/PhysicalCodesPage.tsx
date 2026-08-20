/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Input,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import { BarcodeOutlined } from "@ant-design/icons";
import {
  InlineApiError,
  tableEmptyText,
} from "@/shared/components/feedback/BusinessState";
import { MvpPageSizeSelector } from "@/shared/components/mvp/MvpListPagination";
import { resolveApiPagination } from "@/shared/components/mvp/mvp-pagination";
import type { ApiMeta } from "@/shared/types/api-response";
import {
  classifyScanCodes,
  fetchPhysicalCodes,
  fetchScanBatchesPage,
  fetchScanEventsPage,
} from "../services/scanService";
import type {
  PhysicalCode,
  ScanBatch,
  ScanClassifyResponse,
  ScanCodeState,
  ScanContext,
  ScanEvent,
} from "../types";

const stateColorMap: Record<ScanCodeState, string> = {
  waiting: "default",
  scanned: "processing",
  success: "success",
  error: "error",
};

const SCAN_CONTEXT_OPTIONS: Array<{
  value: ScanContext;
  label: string;
}> = [
  { value: "INBOUND", label: "Nhập kho" },
  { value: "OUTBOUND", label: "Xuất kho" },
  { value: "INVENTORY", label: "Tra cứu tồn" },
  { value: "TRACE", label: "Truy vết" },
  { value: "WARRANTY_RECEIVE", label: "Tiếp nhận bảo hành" },
  { value: "WARRANTY_TEMP_ONLY", label: "Bảo hành mã tạm" },
];

export default function PhysicalCodesPage() {
  const [activeTab, setActiveTab] = useState("list");
  const [codes, setCodes] = useState<PhysicalCode[]>([]);
  const [batches, setBatches] = useState<ScanBatch[]>([]);
  const [events, setEvents] = useState<ScanEvent[]>([]);
  const [codePage, setCodePage] = useState(1);
  const [codePerPage, setCodePerPage] = useState(15);
  const [batchPage, setBatchPage] = useState(1);
  const [batchPerPage, setBatchPerPage] = useState(15);
  const [eventPage, setEventPage] = useState(1);
  const [eventPerPage, setEventPerPage] = useState(15);
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

  /** POST /api/v1/scan/classify — exact WWHN-150.1.1.0 read-only contract. */
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
        `Mã ${response.raw_code} được nhận diện là ${response.classification}. ` +
          "Đây là thao tác chỉ đọc, không phát sinh biến động tồn kho.",
      );
      setScanValue("");
    } catch (error: unknown) {
      setClassifyState("error");
      setClassifyMessage(
        error instanceof Error
          ? error.message
          : "Lỗi khi phân loại mã. Vui lòng thử lại.",
      );
    } finally {
      setLoading(false);
    }
  }, [scanContext, scanValue, warehouseId]);

  return (
    <div style={{ padding: 24 }}>
      <Tabs
        activeKey={activeTab}
        onChange={(key) => {
          setActiveTab(key);
          setClassifyResult(null);
          setClassifyState("waiting");
          setClassifyMessage("");
        }}
        items={[
          {
            key: "list",
            label: "Danh sách mã vật lý",
            children: (
              <>
                <Space wrap style={{ marginBottom: 16 }}>
                  <Input.Search
                    placeholder="Giá trị mã / UID..."
                    style={{ width: 285 }}
                  />
                  <Button type="primary" icon={<BarcodeOutlined />} disabled>
                    Tạo mã
                  </Button>
                </Space>
                <InlineApiError
                  error={listError}
                  title="Không thể tải danh sách mã vật lý"
                  onRetry={() => setReloadKey((value) => value + 1)}
                />
                <MvpPageSizeSelector
                  value={codePerPage}
                  onChange={(value) => {
                    setCodePerPage(value);
                    setCodePage(1);
                  }}
                />
                <Table
                  dataSource={codes}
                  rowKey="id"
                  loading={loading}
                  pagination={{
                    current: codePage,
                    pageSize: codePerPage,
                    total: codes.length,
                    showSizeChanger: false,
                    showTotal: (total) => `Tổng ${total} mã vật lý`,
                    onChange: setCodePage,
                  }}
                  scroll={{ x: "max-content" }}
                  locale={{ emptyText: tableEmptyText(listError) }}
                  columns={[
                    {
                      title: "Giá trị mã",
                      dataIndex: "code_value",
                      key: "code_value",
                    },
                    {
                      title: "Loại",
                      dataIndex: "code_type",
                      key: "code_type",
                      render: (value: string) => <Tag>{value}</Tag>,
                    },
                    {
                      title: "Vật mang",
                      dataIndex: "carrier_type",
                      key: "carrier_type",
                    },
                    {
                      title: "Đối tượng",
                      dataIndex: "target_type",
                      key: "target_type",
                    },
                    {
                      title: "SKU/Container",
                      dataIndex: "sku_code",
                      key: "sku_code",
                    },
                    { title: "Trạng thái", dataIndex: "status", key: "status" },
                    {
                      title: "Vị trí gợi ý",
                      dataIndex: "location_hint",
                      key: "location_hint",
                    },
                  ]}
                />
              </>
            ),
          },
          {
            key: "classify",
            label: "Phân loại mã quét",
            children: (
              <>
                <Alert
                  type="info"
                  showIcon
                  title="Contract WWHN-150.1.1.0 — read-only"
                  description="Phân loại không tạo stock movement, posting event hoặc idempotency cache. Warehouse ID phải là UUID đúng scope hiện hành."
                  style={{ marginBottom: 16 }}
                />
                <Space wrap style={{ marginBottom: 16 }}>
                  <Input
                    placeholder="Warehouse UUID..."
                    value={warehouseId}
                    onChange={(event) => setWarehouseId(event.target.value)}
                    style={{ width: 320 }}
                  />
                  <Select<ScanContext>
                    value={scanContext}
                    onChange={setScanContext}
                    options={SCAN_CONTEXT_OPTIONS}
                    style={{ width: 210 }}
                  />
                  <Input.Search
                    placeholder="Quét/nhập mã..."
                    value={scanValue}
                    onChange={(event) => setScanValue(event.target.value)}
                    onSearch={submitScan}
                    style={{ width: 360 }}
                    enterButton="Phân loại"
                    disabled={!warehouseId.trim()}
                  />
                  <Button
                    type="primary"
                    onClick={submitScan}
                    loading={loading && classifyState === "scanned"}
                    disabled={!scanValue.trim() || !warehouseId.trim()}
                    icon={<BarcodeOutlined />}
                  >
                    Gửi quét
                  </Button>
                </Space>

                {classifyState !== "waiting" && classifyState !== "scanned" && (
                  <Alert
                    type={classifyState === "success" ? "success" : "error"}
                    title={
                      <Space wrap>
                        <Typography.Text strong>Kết quả:</Typography.Text>
                        <Tag color={stateColorMap[classifyState]}>
                          {classifyState.toUpperCase()}
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
                    title="Đang phân loại mã..."
                    showIcon
                    style={{ marginBottom: 16 }}
                  />
                )}

                {classifyResult && (
                  <Table
                    dataSource={[classifyResult]}
                    rowKey="raw_code"
                    pagination={false}
                    size="small"
                    scroll={{ x: "max-content" }}
                    columns={[
                      {
                        title: "Mã",
                        dataIndex: "raw_code",
                        key: "raw_code",
                      },
                      {
                        title: "Context",
                        dataIndex: "context",
                        key: "context",
                      },
                      {
                        title: "Phân loại",
                        dataIndex: "classification",
                        key: "classification",
                        render: (value: string) => <Tag>{value}</Tag>,
                      },
                      {
                        title: "Trạng thái tồn",
                        dataIndex: "stock_status",
                        key: "stock_status",
                      },
                      {
                        title: "Nguồn resolve",
                        dataIndex: "resolved_source",
                        key: "resolved_source",
                      },
                      {
                        title: "Kho hiện tại",
                        dataIndex: "current_location",
                        key: "current_location",
                        render: (
                          location: ScanClassifyResponse["current_location"],
                        ) =>
                          `${location.warehouse_code} — ${location.warehouse_name}`,
                      },
                      {
                        title: "Stock effect",
                        dataIndex: "stock_effect",
                        key: "stock_effect",
                        render: (value: string) => <Tag>{value}</Tag>,
                      },
                      {
                        title: "Contract",
                        dataIndex: "contract_version",
                        key: "contract_version",
                      },
                    ]}
                  />
                )}
              </>
            ),
          },
          {
            key: "history",
            label: "Lô quét / sự kiện",
            children: (
              <>
                <InlineApiError
                  error={historyError}
                  title="Không thể tải lô quét/sự kiện"
                  onRetry={() => setReloadKey((value) => value + 1)}
                />
                <Typography.Text strong>Lô quét</Typography.Text>
                <MvpPageSizeSelector
                  value={batchPerPage}
                  onChange={(value) => {
                    setBatchPerPage(value);
                    setBatchPage(1);
                  }}
                />
                <Table
                  dataSource={batches}
                  rowKey="id"
                  loading={loading}
                  pagination={{
                    current: batchPagination.current,
                    pageSize: batchPerPage,
                    total: batchPagination.total,
                    showSizeChanger: false,
                    showTotal: (total) => `Tổng ${total} lô quét`,
                    onChange: setBatchPage,
                  }}
                  style={{ marginBottom: 16 }}
                  scroll={{ x: "max-content" }}
                  locale={{ emptyText: tableEmptyText(historyError) }}
                  columns={[
                    { title: "Lô", dataIndex: "batch_no", key: "batch_no" },
                    {
                      title: "Nguồn",
                      dataIndex: "source_type",
                      key: "source_type",
                    },
                    {
                      title: "Trạng thái",
                      dataIndex: "status",
                      key: "status",
                      render: (value: string) => <Tag>{value}</Tag>,
                    },
                    {
                      title: "Mã hợp lệ",
                      dataIndex: "valid_count",
                      key: "valid_count",
                    },
                    {
                      title: "Trùng",
                      dataIndex: "duplicate_count",
                      key: "duplicate_count",
                    },
                    {
                      title: "Không rõ",
                      dataIndex: "unknown_count",
                      key: "unknown_count",
                    },
                    {
                      title: "Lỗi",
                      dataIndex: "invalid_count",
                      key: "invalid_count",
                    },
                    {
                      title: "Tạo lúc",
                      dataIndex: "created_at",
                      key: "created_at",
                    },
                  ]}
                />
                <Typography.Text strong>Sự kiện quét</Typography.Text>
                <MvpPageSizeSelector
                  value={eventPerPage}
                  onChange={(value) => {
                    setEventPerPage(value);
                    setEventPage(1);
                  }}
                />
                <Table
                  dataSource={events}
                  rowKey="id"
                  loading={loading}
                  pagination={{
                    current: eventPagination.current,
                    pageSize: eventPerPage,
                    total: eventPagination.total,
                    showSizeChanger: false,
                    showTotal: (total) => `Tổng ${total} sự kiện`,
                    onChange: setEventPage,
                  }}
                  scroll={{ x: "max-content" }}
                  locale={{ emptyText: tableEmptyText(historyError) }}
                  columns={[
                    { title: "Mã", dataIndex: "code_value", key: "code_value" },
                    { title: "Loại", dataIndex: "code_type", key: "code_type" },
                    {
                      title: "Kết quả",
                      dataIndex: "status",
                      key: "status",
                      render: (value: string) => <Tag>{value}</Tag>,
                    },
                    {
                      title: "Tạo lúc",
                      dataIndex: "scanned_at",
                      key: "scanned_at",
                    },
                  ]}
                />
              </>
            ),
          },
        ]}
      />
    </div>
  );
}
