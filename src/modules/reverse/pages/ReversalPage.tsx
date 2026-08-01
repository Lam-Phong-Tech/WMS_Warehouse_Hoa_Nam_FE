/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from "antd";
import {
  EyeOutlined,
  ReloadOutlined,
  RollbackOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import {
  InlineApiError,
  ResponsiveToolbar,
  tableEmptyText,
} from "@/shared/components/feedback/BusinessState";
import { getApiErrorMessage, normalizeError } from "@/shared/api/api-error";
import {
  createReversalDocument,
  fetchReversalDocuments,
  fetchReversalLines,
  fetchReversibleMovements,
} from "@/modules/reverse/services/reversalService";
import type {
  CreateReversalRequest,
  CreateReversalResponse,
  ReversalDocument,
  ReversalLine,
  ReversibleMovement,
} from "@/modules/reverse/types";

type ReversalDraft = Record<string, { reversal_qty?: number; reason?: string }>;

function idempotencyKey() {
  return `reversal-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function statusTag(value?: string) {
  const status = value || "-";
  const color =
    status === "REVERSED" || status === "APPROVED"
      ? "success"
      : status === "REJECTED" || status === "CANCELLED"
        ? "error"
        : "processing";
  return <Tag color={color}>{status}</Tag>;
}

function qty(value?: number) {
  return Number(value ?? 0).toLocaleString("vi-VN");
}

export default function ReversalPage() {
  const [activeTab, setActiveTab] = useState("lookup");
  const [documents, setDocuments] = useState<ReversalDocument[]>([]);
  const [movements, setMovements] = useState<ReversibleMovement[]>([]);
  const [selectedMovement, setSelectedMovement] =
    useState<ReversibleMovement>();
  const [selectedDocument, setSelectedDocument] = useState<ReversalDocument>();
  const [documentLines, setDocumentLines] = useState<ReversalLine[]>([]);
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState("");
  const [draft, setDraft] = useState<ReversalDraft>({});
  const [result, setResult] = useState<CreateReversalResponse>();
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [detailError, setDetailError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const request =
      activeTab === "lookup"
        ? fetchReversibleMovements({
            search,
            reversible_only: true,
            per_page: 50,
          }).then((data) => {
            if (!cancelled) {
              setMovements(data);
              setSelectedMovement((current) => current ?? data[0]);
            }
          })
        : fetchReversalDocuments({ search, per_page: 50 }).then((data) => {
            if (!cancelled) {
              setDocuments(data);
              setSelectedDocument((current) => current ?? data[0]);
            }
          });

    request
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          if (activeTab === "lookup") setMovements([]);
          else setDocuments([]);
          setError(fetchError);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, reloadKey, search]);

  useEffect(() => {
    if (!selectedMovement) return;
    setDraft(
      Object.fromEntries(
        selectedMovement.lines.map((line) => [
          line.sku,
          {
            reversal_qty: line.can_reverse ? line.reversible_qty : 0,
            reason: line.dependency_guard,
          },
        ]),
      ),
    );
  }, [selectedMovement]);

  useEffect(() => {
    if (!selectedDocument?.id || activeTab !== "documents") return;
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    fetchReversalLines(selectedDocument.id, { per_page: 100 })
      .then((data) => {
        if (!cancelled) setDocumentLines(data);
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setDocumentLines([]);
          setDetailError(fetchError);
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDocument?.id, activeTab, reloadKey]);

  const selectedLines = useMemo(() => {
    if (!selectedMovement) return [];
    return selectedMovement.lines
      .filter((line) => line.can_reverse)
      .map((line) => ({
        sku: line.sku,
        reversal_qty: Number(draft[line.sku]?.reversal_qty ?? 0),
        reason: draft[line.sku]?.reason,
        max: line.reversible_qty,
      }))
      .filter((line) => line.reversal_qty > 0);
  }, [draft, selectedMovement]);

  const totalQty = selectedLines.reduce(
    (sum, line) => sum + line.reversal_qty,
    0,
  );
  const invalidLine = selectedLines.find(
    (line) => line.reversal_qty > line.max,
  );
  const canSubmit =
    Boolean(selectedMovement?.can_reverse) &&
    selectedLines.length > 0 &&
    totalQty > 0 &&
    reason.trim().length >= 5 &&
    !invalidLine;

  const retry = () => setReloadKey((value) => value + 1);

  const submitReversal = () => {
    if (!selectedMovement) return;
    Modal.confirm({
      title: "Tạo chứng từ hoàn đảo?",
      icon: <WarningOutlined />,
      okText: "Tạo hoàn đảo",
      cancelText: "Kiểm tra lại",
      content: (
        <Space direction="vertical">
          <Typography.Text>
            Movement gốc {selectedMovement.movement_code} sẽ được giữ nguyên.
            Backend sẽ tạo reversal append-only và kiểm tra dependency guard
            trước khi ghi stock effect.
          </Typography.Text>
          <Typography.Text strong>
            {selectedLines.length} dòng, tổng số lượng {qty(totalQty)}
          </Typography.Text>
          <Typography.Text type="secondary">
            UI gửi Idempotency-Key và If-Match nếu lookup trả version.
          </Typography.Text>
        </Space>
      ),
      onOk: async () => {
        const payload: CreateReversalRequest = {
          reversal_type:
            selectedMovement.movement_type === "STOCKTAKE_ADJUSTMENT"
              ? "STOCKTAKE_ADJUSTMENT"
              : "MANUAL_ADJUSTMENT",
          reference_document_id:
            selectedMovement.source_document_id || selectedMovement.id,
          reference_document_type:
            selectedMovement.source_document_type ||
            selectedMovement.movement_type,
          reference_version: selectedMovement.version,
          reason,
          lines: selectedLines.map(({ sku, reversal_qty, reason }) => ({
            sku,
            reversal_qty,
            reason,
          })),
          idempotency_key: idempotencyKey(),
        };
        setSubmitting(true);
        try {
          const created = await createReversalDocument(payload);
          setResult(created);
          message.success(`Đã tạo hoàn đảo ${created.reversal_code}`);
          setActiveTab("documents");
          retry();
        } catch (submitError) {
          const normalized = normalizeError(submitError);
          message.error(
            normalized.status === 409 ||
              normalized.status === 412 ||
              normalized.status === 428
              ? `${normalized.message}. Vui lòng lookup lại movement trước khi gửi lại.`
              : getApiErrorMessage(submitError, "Không thể tạo hoàn đảo"),
          );
        } finally {
          setSubmitting(false);
        }
      },
    });
  };

  return (
    <div style={{ padding: 24 }}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: "lookup",
            label: "Lookup movement hoàn đảo",
            children: (
              <Space direction="vertical" size={16} style={{ width: "100%" }}>
                <ResponsiveToolbar>
                  <Input.Search
                    placeholder="Movement/chứng từ gốc..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    onSearch={retry}
                    allowClear
                    style={{ width: 320 }}
                  />
                  <Button icon={<ReloadOutlined />} onClick={retry}>
                    Tải lại
                  </Button>
                </ResponsiveToolbar>
                <Alert
                  type="info"
                  showIcon
                  message="Hoàn đảo là append-only"
                  description="FE không sửa/xóa movement gốc; mọi giới hạn reversible_qty, dependency guard, stock effect và audit do backend quyết định."
                />
                <InlineApiError
                  error={error}
                  title="Không thể lookup movement có thể hoàn đảo"
                  onRetry={retry}
                />
                <Table
                  dataSource={movements}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 8 }}
                  scroll={{ x: 1080 }}
                  locale={{
                    emptyText: tableEmptyText(
                      error,
                      "Chưa có movement reversible hoặc endpoint lookup chưa sẵn sàng",
                    ),
                  }}
                  onRow={(record) => ({
                    onClick: () => setSelectedMovement(record),
                  })}
                  columns={[
                    {
                      title: "Movement",
                      dataIndex: "movement_code",
                      width: 150,
                    },
                    { title: "Loại", dataIndex: "movement_type", width: 180 },
                    {
                      title: "Chứng từ gốc",
                      width: 180,
                      render: (_, row) =>
                        row.source_document_code || row.source_document_id,
                    },
                    { title: "Kho", dataIndex: "warehouse_name", width: 150 },
                    { title: "Posted at", dataIndex: "posted_at", width: 170 },
                    {
                      title: "Guard",
                      width: 220,
                      render: (_, row) =>
                        row.dependency_guard ? (
                          <Tag color="red">{row.dependency_guard}</Tag>
                        ) : (
                          <Tag color="green">Reversible</Tag>
                        ),
                    },
                    {
                      title: "Action",
                      fixed: "right",
                      width: 110,
                      render: (_, row) => (
                        <Button
                          size="small"
                          icon={<EyeOutlined />}
                          onClick={() => setSelectedMovement(row)}
                        >
                          Chọn
                        </Button>
                      ),
                    },
                  ]}
                />
                <Card
                  title={
                    selectedMovement
                      ? `Tạo hoàn đảo từ ${selectedMovement.movement_code}`
                      : "Tạo hoàn đảo"
                  }
                >
                  {selectedMovement ? (
                    <Space
                      direction="vertical"
                      size={16}
                      style={{ width: "100%" }}
                    >
                      <Descriptions size="small" column={{ xs: 1, md: 3 }}>
                        <Descriptions.Item label="Source">
                          {selectedMovement.source_document_type} /{" "}
                          {selectedMovement.source_document_code ||
                            selectedMovement.source_document_id}
                        </Descriptions.Item>
                        <Descriptions.Item label="Version">
                          {selectedMovement.version ?? "Chưa có"}
                        </Descriptions.Item>
                        <Descriptions.Item label="Trạng thái">
                          {selectedMovement.can_reverse ? (
                            <Tag color="green">Có thể hoàn đảo</Tag>
                          ) : (
                            <Tag color="red">Bị chặn</Tag>
                          )}
                        </Descriptions.Item>
                      </Descriptions>
                      {selectedMovement.dependency_guard ? (
                        <Alert
                          type="warning"
                          showIcon
                          message="Dependency guard"
                          description={selectedMovement.dependency_guard}
                        />
                      ) : null}
                      <Form layout="vertical">
                        <Form.Item
                          label="Lý do hoàn đảo"
                          required
                          validateStatus={
                            reason && reason.length < 5 ? "error" : undefined
                          }
                          help={
                            reason && reason.length < 5
                              ? "Nhập lý do tối thiểu 5 ký tự"
                              : undefined
                          }
                        >
                          <Input.TextArea
                            rows={3}
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                          />
                        </Form.Item>
                      </Form>
                      <Table
                        size="small"
                        dataSource={selectedMovement.lines}
                        rowKey="id"
                        pagination={false}
                        scroll={{ x: 920 }}
                        columns={[
                          { title: "SKU", dataIndex: "sku", width: 140 },
                          { title: "Tên", dataIndex: "sku_name", width: 180 },
                          {
                            title: "Original",
                            dataIndex: "original_qty",
                            width: 100,
                            render: qty,
                          },
                          {
                            title: "Đã đảo",
                            dataIndex: "reversed_qty",
                            width: 100,
                            render: qty,
                          },
                          {
                            title: "Còn đảo",
                            dataIndex: "reversible_qty",
                            width: 100,
                            render: qty,
                          },
                          {
                            title: "SL đảo",
                            width: 150,
                            render: (_, line) => (
                              <InputNumber
                                min={0}
                                max={line.reversible_qty}
                                disabled={!line.can_reverse}
                                value={draft[line.sku]?.reversal_qty}
                                onChange={(value) =>
                                  setDraft((current) => ({
                                    ...current,
                                    [line.sku]: {
                                      ...current[line.sku],
                                      reversal_qty: Number(value ?? 0),
                                    },
                                  }))
                                }
                              />
                            ),
                          },
                          {
                            title: "Guard",
                            width: 220,
                            render: (_, line) =>
                              line.dependency_guard ? (
                                <Tag color="red">{line.dependency_guard}</Tag>
                              ) : (
                                <Tag color="green">OK</Tag>
                              ),
                          },
                        ]}
                      />
                      <Space wrap>
                        <Statistic
                          title="Tổng SL hoàn đảo"
                          value={qty(totalQty)}
                        />
                        <Button
                          type="primary"
                          icon={<RollbackOutlined />}
                          disabled={!canSubmit}
                          loading={submitting}
                          onClick={submitReversal}
                        >
                          Tạo hoàn đảo
                        </Button>
                      </Space>
                      {invalidLine ? (
                        <Alert
                          type="error"
                          showIcon
                          message={`SL đảo của ${invalidLine.sku} vượt số còn reversible`}
                        />
                      ) : null}
                      {result ? (
                        <Alert
                          type={
                            result.status === "REJECTED" ? "warning" : "success"
                          }
                          showIcon
                          message={`Kết quả: ${result.reversal_code} - ${result.status}`}
                          description={`Reversed lines: ${result.reversed_lines}; total qty: ${result.total_qty}; errors: ${result.errors?.length ?? 0}`}
                        />
                      ) : null}
                    </Space>
                  ) : (
                    <Alert
                      type="info"
                      showIcon
                      message="Chọn movement gốc để xem reversible_qty và dependency guard"
                    />
                  )}
                </Card>
              </Space>
            ),
          },
          {
            key: "documents",
            label: "Chứng từ hoàn đảo",
            children: (
              <Space direction="vertical" size={16} style={{ width: "100%" }}>
                <ResponsiveToolbar>
                  <Input.Search
                    placeholder="Mã hoàn đảo/chứng từ gốc..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    onSearch={retry}
                    allowClear
                    style={{ width: 320 }}
                  />
                  <Button icon={<ReloadOutlined />} onClick={retry}>
                    Tải lại
                  </Button>
                </ResponsiveToolbar>
                <InlineApiError
                  error={error}
                  title="Không thể tải danh sách hoàn đảo"
                  onRetry={retry}
                />
                <Table
                  dataSource={documents}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: 1050 }}
                  locale={{
                    emptyText: tableEmptyText(
                      error,
                      "Chưa có chứng từ hoàn đảo",
                    ),
                  }}
                  onRow={(record) => ({
                    onClick: () => setSelectedDocument(record),
                  })}
                  columns={[
                    {
                      title: "Mã hoàn đảo",
                      dataIndex: "reversal_code",
                      width: 150,
                    },
                    {
                      title: "Chứng từ gốc",
                      dataIndex: "reference_document_code",
                      width: 180,
                    },
                    { title: "Loại", dataIndex: "reversal_type", width: 180 },
                    { title: "Lý do", dataIndex: "reason", width: 260 },
                    {
                      title: "Trạng thái",
                      dataIndex: "status",
                      width: 130,
                      render: statusTag,
                    },
                    { title: "Ngày tạo", dataIndex: "created_at", width: 170 },
                  ]}
                />
                <Card
                  title={
                    selectedDocument
                      ? `Trace hoàn đảo ${selectedDocument.reversal_code}`
                      : "Trace hoàn đảo"
                  }
                >
                  {selectedDocument ? (
                    <Space
                      direction="vertical"
                      size={16}
                      style={{ width: "100%" }}
                    >
                      <Descriptions size="small" column={{ xs: 1, md: 3 }}>
                        <Descriptions.Item label="Original">
                          {selectedDocument.reference_document_type} /{" "}
                          {selectedDocument.reference_document_code}
                        </Descriptions.Item>
                        <Descriptions.Item label="Kho">
                          {selectedDocument.warehouse_name}
                        </Descriptions.Item>
                        <Descriptions.Item label="Trạng thái">
                          {statusTag(selectedDocument.status)}
                        </Descriptions.Item>
                        <Descriptions.Item label="Created by">
                          {selectedDocument.created_by}
                        </Descriptions.Item>
                        <Descriptions.Item label="Approved by">
                          {selectedDocument.approved_by ?? "-"}
                        </Descriptions.Item>
                        <Descriptions.Item label="Reversed at">
                          {selectedDocument.reversed_at ?? "-"}
                        </Descriptions.Item>
                      </Descriptions>
                      <InlineApiError
                        error={detailError}
                        title="Không thể tải dòng hoàn đảo"
                        onRetry={retry}
                      />
                      <Table
                        size="small"
                        dataSource={documentLines}
                        rowKey="id"
                        loading={detailLoading}
                        pagination={{ pageSize: 6 }}
                        scroll={{ x: 760 }}
                        locale={{
                          emptyText: tableEmptyText(
                            detailError,
                            "Chưa có dòng hoàn đảo",
                          ),
                        }}
                        columns={[
                          { title: "SKU", dataIndex: "sku", width: 140 },
                          { title: "Tên", dataIndex: "sku_name", width: 180 },
                          {
                            title: "Original",
                            dataIndex: "original_qty",
                            width: 100,
                            render: qty,
                          },
                          {
                            title: "Reversal",
                            dataIndex: "reversal_qty",
                            width: 100,
                            render: qty,
                          },
                          {
                            title: "Remaining",
                            dataIndex: "remaining_qty",
                            width: 100,
                            render: qty,
                          },
                          {
                            title: "Status",
                            dataIndex: "status",
                            width: 130,
                            render: statusTag,
                          },
                          {
                            title: "Lỗi",
                            dataIndex: "error_message",
                            width: 220,
                          },
                        ]}
                      />
                    </Space>
                  ) : (
                    <Alert
                      type="info"
                      showIcon
                      message="Chọn chứng từ để xem trace chain"
                    />
                  )}
                </Card>
              </Space>
            ),
          },
        ]}
      />
    </div>
  );
}
