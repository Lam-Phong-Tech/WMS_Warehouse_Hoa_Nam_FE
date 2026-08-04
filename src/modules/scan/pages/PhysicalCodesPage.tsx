/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState, useCallback } from "react";
import {
  Alert,
  Button,
  Input,
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
import type { ScanCodeState, ScanClassifyItem } from "../types";
import {
  classifyScanCodes,
  fetchScanBatches,
  fetchScanEvents,
  fetchPhysicalCodes,
} from "../services/scanService";
import type { ScanBatch, ScanEvent, PhysicalCode } from "../types";

/** Map scan code state to Tag color */
const stateColorMap: Record<ScanCodeState, string> = {
  waiting: "default",
  scanned: "processing",
  duplicate: "warning",
  unknown: "geekblue",
  invalid: "error",
  success: "success",
  error: "error",
};

/** Map classify status to Tag color */
const classifyColorMap: Record<string, string> = {
  VALID: "success",
  DUPLICATE: "warning",
  UNKNOWN: "geekblue",
  INVALID: "error",
};

export default function PhysicalCodesPage() {
  const [activeTab, setActiveTab] = useState("list");
  const [codes, setCodes] = useState<PhysicalCode[]>([]);
  const [batches, setBatches] = useState<ScanBatch[]>([]);
  const [events, setEvents] = useState<ScanEvent[]>([]);
  const [scanValue, setScanValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<unknown>(null);
  const [historyError, setHistoryError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Classify-specific state
  const [classifyResult, setClassifyResult] = useState<
    ScanClassifyItem[] | null
  >(null);
  const [classifyState, setClassifyState] = useState<ScanCodeState>("waiting");
  const [classifyMessage, setClassifyMessage] = useState("");
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    if (activeTab === "list") {
      setListError(null);
      fetchPhysicalCodes({ page: 1, per_page: 20 })
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
    } else {
      setHistoryError(null);
      Promise.all([
        fetchScanBatches({ per_page: 20 }),
        fetchScanEvents({ per_page: 20 }),
      ])
        .then(([batchRows, eventRows]) => {
          if (!cancelled) {
            setBatches(batchRows);
            setEvents(eventRows);
          }
        })
        .catch((fetchError: unknown) => {
          if (!cancelled) {
            setBatches([]);
            setEvents([]);
            setHistoryError(fetchError);
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [activeTab, reloadKey]);

  /** Submit scan code via POST /scan-batches/classify */
  const submitScan = useCallback(async () => {
    const code = scanValue.trim();
    if (!code) return;

    setLoading(true);
    setClassifyState("scanned");
    setClassifyResult(null);
    setClassifyMessage("");

    try {
      const response = await classifyScanCodes({
        codes: [code],
        scan_source: "manual",
      });

      setClassifyResult(response.items);

      // Determine overall state from classify results
      const allValid = response.items.every((item) => item.status === "VALID");
      const hasDuplicate = response.items.some(
        (item) => item.status === "DUPLICATE",
      );
      const hasUnknown = response.items.some(
        (item) => item.status === "UNKNOWN",
      );
      const hasInvalid = response.items.some(
        (item) => item.status === "INVALID",
      );

      if (allValid) {
        setClassifyState("success");
        setClassifyMessage(`Mã ${code} hợp lệ.`);
      } else if (hasDuplicate) {
        setClassifyState("duplicate");
        setClassifyMessage(`Mã ${code} đã được quét trước đó.`);
      } else if (hasUnknown) {
        setClassifyState("unknown");
        setClassifyMessage(`Mã ${code} không được nhận diện trong hệ thống.`);
      } else if (hasInvalid) {
        setClassifyState("invalid");
        setClassifyMessage(`Mã ${code} không hợp lệ.`);
      }

      // Refresh batches and events after successful classify
      const [batchRows, eventRows] = await Promise.all([
        fetchScanBatches({ per_page: 20 }),
        fetchScanEvents({ per_page: 20 }),
      ]);
      setBatches(batchRows);
      setEvents(eventRows);
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
  }, [scanValue]);

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
                <Space style={{ marginBottom: 16 }}>
                  <Input.Search
                    placeholder="Giá trị mã / UID..."
                    style={{ width: 285 }}
                  />
                  <Button type="primary" icon={<BarcodeOutlined />}>
                    Tạo mã
                  </Button>
                </Space>
                <InlineApiError
                  error={listError}
                  title="Không thể tải danh sách mã vật lý"
                  onRetry={() => setReloadKey((value) => value + 1)}
                />
                <Table
                  dataSource={codes}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
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
                <Space style={{ marginBottom: 16 }}>
                  <Input.Search
                    placeholder="Quét/nhập mã..."
                    value={scanValue}
                    onChange={(event) => setScanValue(event.target.value)}
                    onSearch={submitScan}
                    style={{ width: 360 }}
                    enterButton="Phân loại"
                  />
                  <Button
                    type="primary"
                    onClick={submitScan}
                    loading={loading && classifyState === "scanned"}
                    icon={<BarcodeOutlined />}
                  >
                    Gửi quét
                  </Button>
                </Space>

                {/* Classify result display */}
                {classifyState !== "waiting" && classifyState !== "scanned" && (
                  <Alert
                    type={
                      classifyState === "success"
                        ? "success"
                        : classifyState === "duplicate"
                          ? "warning"
                          : classifyState === "unknown"
                            ? "info"
                            : "error"
                    }
                    message={
                      <Space>
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
                    message="Đang phân loại mã..."
                    showIcon
                    style={{ marginBottom: 16 }}
                  />
                )}

                {/* Classify detail table */}
                {classifyResult && classifyResult.length > 0 && (
                  <Table
                    dataSource={classifyResult}
                    rowKey="code_value"
                    pagination={false}
                    size="small"
                    style={{ marginBottom: 16 }}
                    scroll={{ x: "max-content" }}
                    columns={[
                      {
                        title: "Mã",
                        dataIndex: "code_value",
                        key: "code_value",
                      },
                      {
                        title: "Loại mã",
                        dataIndex: "code_type",
                        key: "code_type",
                      },
                      {
                        title: "Kết quả",
                        dataIndex: "status",
                        key: "status",
                        render: (value: string) => (
                          <Tag color={classifyColorMap[value]}>{value}</Tag>
                        ),
                      },
                      { title: "SKU", dataIndex: "sku_code", key: "sku_code" },
                      {
                        title: "Ghi chú",
                        dataIndex: "message",
                        key: "message",
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
                <Table
                  dataSource={batches}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 5 }}
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
                      render: (v: number) =>
                        v > 0 ? <Tag color="warning">{v}</Tag> : v,
                    },
                    {
                      title: "Không rõ",
                      dataIndex: "unknown_count",
                      key: "unknown_count",
                      render: (v: number) =>
                        v > 0 ? <Tag color="geekblue">{v}</Tag> : v,
                    },
                    {
                      title: "Lỗi",
                      dataIndex: "invalid_count",
                      key: "invalid_count",
                      render: (v: number) =>
                        v > 0 ? <Tag color="error">{v}</Tag> : v,
                    },
                    {
                      title: "Tạo lúc",
                      dataIndex: "created_at",
                      key: "created_at",
                    },
                  ]}
                />
                <Table
                  dataSource={events}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 5 }}
                  scroll={{ x: "max-content" }}
                  locale={{ emptyText: tableEmptyText(historyError) }}
                  columns={[
                    { title: "Mã", dataIndex: "code_value", key: "code_value" },
                    { title: "Loại", dataIndex: "code_type", key: "code_type" },
                    {
                      title: "Kết quả",
                      dataIndex: "status",
                      key: "status",
                      render: (value: string) => (
                        <Tag color={classifyColorMap[value]}>{value}</Tag>
                      ),
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
