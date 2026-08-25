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
import { useQuery } from "@tanstack/react-query";
import {
  InlineApiError,
  tableEmptyText,
} from "@/shared/components/feedback/BusinessState";
import { MvpPageSizeSelector } from "@/shared/components/mvp/MvpListPagination";
import { resolveApiPagination } from "@/shared/components/mvp/mvp-pagination";
import type { ApiMeta } from "@/shared/types/api-response";
import {
  CONTAINER_TYPE_LABELS,
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
        error instanceof Error
          ? error.message
          : "Không nhận diện được mã. Vui lòng thử lại.",
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
                    placeholder="Giá trị mã..."
                    style={{ width: 285 }}
                  />
                  <Button
                    type="primary"
                    icon={<BarcodeOutlined />}
                    disabled={!canCreatePhysicalCode}
                    onClick={() => setIssueModalOpen(true)}
                  >
                    Tạo mã vật lý
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
                      title: "Loại mã",
                      dataIndex: "code_type",
                      key: "code_type",
                      render: (value: string) => (
                        <Tag>{CARRIER_LABELS[value] ?? "Loại mã khác"}</Tag>
                      ),
                    },
                    {
                      title: "Hình thức mã",
                      dataIndex: "carrier_type",
                      key: "carrier_type",
                      render: (value: string) =>
                        CARRIER_LABELS[value] ?? "Hình thức khác",
                    },
                    {
                      title: "Đối tượng gắn mã",
                      dataIndex: "target_type",
                      key: "target_type",
                      render: (value: string) =>
                        businessLabel(
                          SCAN_CLASSIFICATION_LABELS,
                          value,
                          "Đối tượng khác",
                        ),
                    },
                    {
                      title: "SKU / vật chứa",
                      key: "target",
                      render: (_: unknown, row: PhysicalCode) =>
                        row.sku_code || row.container_code || "—",
                    },
                    {
                      title: "Trạng thái",
                      dataIndex: "status",
                      key: "status",
                      render: (value: string) => (
                        <Tag color={value === "ACTIVE" ? "success" : "default"}>
                          {businessLabel(
                            MASTER_STATUS_LABELS,
                            value,
                            "Trạng thái khác",
                          )}
                        </Tag>
                      ),
                    },
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
            label: "Nhận diện mã quét",
            children: (
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
                    value={scanValue}
                    onChange={(event) => setScanValue(event.target.value)}
                    onSearch={submitScan}
                    style={{ width: 360 }}
                    enterButton="Nhận diện"
                    disabled={!warehouseId.trim()}
                  />
                  <Button
                    type="primary"
                    onClick={submitScan}
                    loading={loading && classifyState === "scanned"}
                    disabled={!scanValue.trim() || !warehouseId.trim()}
                    icon={<BarcodeOutlined />}
                  >
                    Nhận diện mã
                  </Button>
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
                        title: "Ngữ cảnh sử dụng",
                        dataIndex: "context",
                        key: "context",
                        render: (value: string) =>
                          businessLabel(
                            SCAN_CONTEXT_LABELS,
                            value,
                            "Ngữ cảnh khác",
                          ),
                      },
                      {
                        title: "Nhận diện là",
                        dataIndex: "classification",
                        key: "classification",
                        render: (value: string) => (
                          <Tag>
                            {businessLabel(
                              SCAN_CLASSIFICATION_LABELS,
                              value,
                              "Đối tượng khác",
                            )}
                          </Tag>
                        ),
                      },
                      {
                        title: "Trạng thái tồn",
                        dataIndex: "stock_status",
                        key: "stock_status",
                        render: (value: string) =>
                          businessLabel(
                            INVENTORY_STOCK_STATUS_LABELS,
                            value,
                            "Trạng thái khác",
                          ),
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
                        title: "Ảnh hưởng tồn kho",
                        key: "stock_effect",
                        render: () => <Tag color="success">Không thay đổi tồn</Tag>,
                      },
                    ]}
                  />
                )}
              </>
            ),
          },
          {
            key: "history",
            label: "Lịch sử quét",
            children: (
              <>
                <InlineApiError
                  error={historyError}
                  title="Không thể tải lịch sử quét"
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
                      title: "Nguồn quét",
                      dataIndex: "source_type",
                      key: "source_type",
                      render: (value: string) =>
                        businessLabel(
                          SCAN_CONTEXT_LABELS,
                          value,
                          "Nguồn khác",
                        ),
                    },
                    {
                      title: "Trạng thái",
                      dataIndex: "status",
                      key: "status",
                      render: (value: string) => (
                        <Tag>
                          {businessLabel(
                            SCAN_BATCH_STATUS_LABELS,
                            value,
                            "Trạng thái khác",
                          )}
                        </Tag>
                      ),
                    },
                    {
                      title: "Hợp lệ",
                      dataIndex: "valid_count",
                      key: "valid_count",
                    },
                    {
                      title: "Đã quét trước đó",
                      dataIndex: "duplicate_count",
                      key: "duplicate_count",
                    },
                    {
                      title: "Không nhận diện",
                      dataIndex: "unknown_count",
                      key: "unknown_count",
                    },
                    {
                      title: "Không hợp lệ",
                      dataIndex: "invalid_count",
                      key: "invalid_count",
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
                    {
                      title: "Loại mã",
                      dataIndex: "code_type",
                      key: "code_type",
                      render: (value: string) =>
                        CARRIER_LABELS[value] ?? "Loại mã khác",
                    },
                    {
                      title: "Kết quả",
                      dataIndex: "status",
                      key: "status",
                      render: (value: string) => (
                        <Tag>
                          {businessLabel(
                            SCAN_RESULT_LABELS,
                            value,
                            "Kết quả khác",
                          )}
                        </Tag>
                      ),
                    },
                    {
                      title: "Thời gian quét",
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
