/**
 * @deprecated Stocktake Model A — removed from MVP scope.
 * Not registered in router. Jira WWHN-58/59 to be dispositioned as Out of Scope.
 * Do NOT import or extend this module. Retained for reference only.
 */
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Progress,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import { toast } from "sonner";
import {
  CheckCircleOutlined,
  ExperimentOutlined,
  ReloadOutlined,
  SaveOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import {
  InlineApiError,
  ResponsiveToolbar,
  tableEmptyText,
} from "@/shared/components/feedback/BusinessState";
import { getApiErrorMessage, normalizeError } from "@/shared/api/api-error";
import { useCanAny } from "@/shared/components/permission";
import {
  applyStocktakeAdjustment,
  createStocktakeSession,
  fetchInventorySnapshots,
  fetchStocktakeCounts,
  fetchStocktakeSessions,
  fetchStocktakeVariances,
  submitStocktakeCount,
} from "@/modules/stocktake/services/stocktakeService";
import type {
  ApplyAdjustmentResponse,
  CreateStocktakeSessionRequest,
  StocktakeCount,
  StocktakeSession,
  StocktakeSnapshot,
  StocktakeVariance,
} from "@/modules/stocktake/types";

type CountDraft = Record<string, { actual_qty?: number; notes?: string }>;

const scopeOptions = [
  { label: "Toàn kho", value: "FULL_WAREHOUSE" },
  { label: "Theo SKU", value: "SKU" },
  { label: "Theo nhóm SKU", value: "SKU_GROUP" },
  { label: "Theo vị trí", value: "LOCATION" },
];

const reviewStatuses = new Set([
  "REVIEWING",
  "COMPLETED",
  "COUNTING",
  "IN_PROGRESS",
]);
const adjustedStatuses = new Set(["ADJUSTED", "APPLIED", "CANCELLED"]);

function idempotencyKey(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function statusTag(value?: string) {
  const status = value || "-";
  const color = adjustedStatuses.has(status)
    ? "success"
    : status === "CANCELLED"
      ? "default"
      : reviewStatuses.has(status)
        ? "processing"
        : "warning";
  return <Tag color={color}>{status}</Tag>;
}

function varianceTag(value: number) {
  if (value > 0) return <Tag color="green">+{value}</Tag>;
  if (value < 0) return <Tag color="red">{value}</Tag>;
  return <Tag>0</Tag>;
}

function progressOf(session: StocktakeSession) {
  if (!session.total_sku) return 0;
  return Math.round((session.counted_sku / session.total_sku) * 100);
}

function formatQty(value?: number) {
  return Number(value ?? 0).toLocaleString("vi-VN");
}

export default function StocktakePage() {
  const [activeTab, setActiveTab] = useState("sessions");
  const [sessions, setSessions] = useState<StocktakeSession[]>([]);
  const [snapshots, setSnapshots] = useState<StocktakeSnapshot[]>([]);
  const [counts, setCounts] = useState<StocktakeCount[]>([]);
  const [variances, setVariances] = useState<StocktakeVariance[]>([]);
  const [selectedSession, setSelectedSession] = useState<StocktakeSession>();
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [detailError, setDetailError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [applyResult, setApplyResult] = useState<ApplyAdjustmentResponse>();
  const [draft, setDraft] = useState<CountDraft>({});
  const [form] = Form.useForm<CreateStocktakeSessionRequest>();
  const canCreateOrManage = useCanAny([
    "stocktake.create",
    "stocktake.manage",
    "stocktake.count",
  ]);
  const canApply = useCanAny(["stocktake.apply", "stocktake.manage"]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const request =
      activeTab === "snapshots"
        ? fetchInventorySnapshots({ per_page: 50 }).then((data) => {
            if (!cancelled) setSnapshots(data);
          })
        : fetchStocktakeSessions({ per_page: 50 }).then((data) => {
            if (!cancelled) {
              setSessions(data);
              setSelectedSession((current) => {
                if (current && data.some((item) => item.id === current.id))
                  return current;
                return data[0];
              });
            }
          });

    request
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          if (activeTab === "snapshots") setSnapshots([]);
          else setSessions([]);
          setError(fetchError);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, reloadKey]);

  useEffect(() => {
    if (!selectedSession?.id || activeTab !== "sessions") return;
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    Promise.all([
      fetchStocktakeCounts(selectedSession.id, { per_page: 200 }),
      fetchStocktakeVariances(selectedSession.id, { per_page: 200 }),
    ])
      .then(([countRows, varianceRows]) => {
        if (cancelled) return;
        setCounts(countRows);
        setVariances(varianceRows);
        setDraft(
          Object.fromEntries(
            countRows.map((line) => [
              line.sku,
              { actual_qty: line.actual_qty, notes: line.notes },
            ]),
          ),
        );
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setCounts([]);
          setVariances([]);
          setDetailError(fetchError);
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSession?.id, activeTab, reloadKey]);

  const approvedLines = useMemo(
    () =>
      variances
        .filter(
          (line) => line.variance !== 0 && line.reconcile_status !== "REJECTED",
        )
        .map((line) => ({
          sku: line.sku,
          actual_qty: line.actual_qty,
          reason: `Stocktake ${selectedSession?.code ?? selectedSession?.id}`,
        })),
    [selectedSession?.code, selectedSession?.id, variances],
  );

  const totalVariance = variances.reduce((sum, line) => sum + line.variance, 0);
  const canApplySession =
    Boolean(selectedSession) &&
    canApply &&
    approvedLines.length > 0 &&
    !adjustedStatuses.has(selectedSession?.status ?? "");

  const retry = () => setReloadKey((value) => value + 1);

  const handleCreate = async () => {
    const values = await form.validateFields();
    const payload: CreateStocktakeSessionRequest = {
      ...values,
      sku_codes:
        values.scope_type === "SKU" && typeof values.sku_codes === "string"
          ? String(values.sku_codes)
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean)
          : values.sku_codes,
      idempotency_key: idempotencyKey("stocktake-create"),
    };
    setSubmitting(true);
    try {
      const created = await createStocktakeSession(payload);
      toast.success("Đã tạo phiên kiểm kê và yêu cầu backend chụp snapshot");
      setCreateOpen(false);
      form.resetFields();
      setSelectedSession(created);
      retry();
    } catch (createError) {
      toast.error(
        getApiErrorMessage(createError, "Không thể tạo phiên kiểm kê"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const saveCount = async (line: StocktakeCount) => {
    const lineDraft = draft[line.sku] ?? {};
    if (lineDraft.actual_qty === undefined || lineDraft.actual_qty < 0) {
      toast.warning("Số đếm thực tế phải lớn hơn hoặc bằng 0");
      return;
    }
    setSubmitting(true);
    try {
      const updated = await submitStocktakeCount(selectedSession!.id, {
        sku: line.sku,
        actual_qty: lineDraft.actual_qty,
        notes: lineDraft.notes,
      });
      setCounts((rows) =>
        rows.map((item) => (item.sku === line.sku ? updated : item)),
      );
      toast.success(`Đã lưu số đếm cho ${line.sku}`);
      retry();
    } catch (saveError) {
      toast.error(getApiErrorMessage(saveError, "Không thể lưu số đếm"));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmApply = () => {
    if (!selectedSession) return;
    Modal.confirm({
      title: "Áp dụng điều chỉnh tồn kho?",
      icon: <WarningOutlined />,
      okText: "Áp dụng điều chỉnh",
      cancelText: "Kiểm tra lại",
      content: (
        <Space orientation="vertical">
          <Typography.Text>
            Phiên {selectedSession.code} có {approvedLines.length} dòng chênh
            lệch sẽ tạo stock adjustment append-only. Backend vẫn là nguồn quyết
            định cuối cùng.
          </Typography.Text>
          <Typography.Text strong>
            Tổng chênh lệch dự kiến: {totalVariance > 0 ? "+" : ""}
            {formatQty(totalVariance)}
          </Typography.Text>
          <Typography.Text type="secondary">
            Idempotency-Key sẽ được tạo cho lần gửi này; nếu BE yêu cầu version,
            UI gửi If-Match từ version/etag của phiên.
          </Typography.Text>
        </Space>
      ),
      onOk: async () => {
        setSubmitting(true);
        try {
          const result = await applyStocktakeAdjustment({
            session_id: selectedSession.id,
            lines: approvedLines,
            idempotency_key: idempotencyKey("stocktake-apply"),
            version: selectedSession.version ?? selectedSession.etag ?? "",
          });
          setApplyResult(result);
          toast.success("Backend đã xử lý apply adjustment");
          retry();
        } catch (applyError) {
          const normalized = normalizeError(applyError);
          toast.error(
            normalized.status === 409 ||
              normalized.status === 412 ||
              normalized.status === 428
              ? `${normalized.message}. Vui lòng tải lại trạng thái phiên trước khi gửi lại.`
              : getApiErrorMessage(applyError, "Không thể apply adjustment"),
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
            key: "sessions",
            label: "Phiên kiểm kê",
            children: (
              <Row gutter={[16, 16]}>
                <Col xs={24}>
                  <ResponsiveToolbar>
                    <Input.Search
                      placeholder="Mã phiên, kho, owner..."
                      style={{ width: 285 }}
                    />
                    <Select
                      placeholder="Trạng thái"
                      allowClear
                      style={{ width: 180 }}
                      options={[
                        "DRAFT",
                        "COUNTING",
                        "REVIEWING",
                        "COMPLETED",
                        "ADJUSTED",
                      ].map((status) => ({ label: status, value: status }))}
                    />
                    <Button icon={<ReloadOutlined />} onClick={retry}>
                      Tải lại
                    </Button>
                    <Button
                      type="primary"
                      icon={<ExperimentOutlined />}
                      disabled={!canCreateOrManage}
                      onClick={() => setCreateOpen(true)}
                    >
                      Tạo phiên
                    </Button>
                  </ResponsiveToolbar>
                  <InlineApiError
                    error={error}
                    title="Không thể tải danh sách phiên kiểm kê"
                    onRetry={retry}
                  />
                </Col>
                <Col xs={24} xl={13}>
                  <Table
                    dataSource={sessions}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: 1120 }}
                    locale={{
                      emptyText: tableEmptyText(error, "Chưa có phiên kiểm kê"),
                    }}
                    onRow={(record) => ({
                      onClick: () => setSelectedSession(record),
                    })}
                    rowClassName={(record) =>
                      record.id === selectedSession?.id
                        ? "ant-table-row-selected"
                        : ""
                    }
                    columns={[
                      {
                        title: "Mã phiên",
                        dataIndex: "code",
                        fixed: "left",
                        width: 150,
                      },
                      { title: "Kho", dataIndex: "warehouse_name", width: 160 },
                      {
                        title: "Scope",
                        width: 160,
                        render: (_, row) =>
                          row.scope_label ||
                          row.scope_type ||
                          "Theo contract BE",
                      },
                      {
                        title: "Snapshot",
                        dataIndex: "snapshot_at",
                        width: 180,
                      },
                      {
                        title: "Tiến độ",
                        width: 180,
                        render: (_, row) => (
                          <Space
                            orientation="vertical"
                            size={0}
                            style={{ width: "100%" }}
                          >
                            <Progress percent={progressOf(row)} size="small" />
                            <Typography.Text type="secondary">
                              {row.counted_sku}/{row.total_sku} SKU
                            </Typography.Text>
                          </Space>
                        ),
                      },
                      {
                        title: "Variance",
                        width: 120,
                        render: (_, row) => varianceTag(row.variance_sku),
                      },
                      {
                        title: "Movement",
                        width: 130,
                        render: (_, row) =>
                          row.movement_warning_count ? (
                            <Tag color="orange">
                              {row.movement_warning_count} cảnh báo
                            </Tag>
                          ) : (
                            <Tag>Không có</Tag>
                          ),
                      },
                      {
                        title: "Trạng thái",
                        dataIndex: "status",
                        width: 130,
                        render: statusTag,
                      },
                      { title: "Owner", dataIndex: "owner_name", width: 160 },
                    ]}
                  />
                </Col>
                <Col xs={24} xl={11}>
                  <Card
                    title={
                      selectedSession
                        ? `Chi tiết ${selectedSession.code}`
                        : "Chi tiết phiên"
                    }
                  >
                    {selectedSession ? (
                      <Space
                        orientation="vertical"
                        size={16}
                        style={{ width: "100%" }}
                      >
                        <Descriptions size="small" column={{ xs: 1, md: 2 }}>
                          <Descriptions.Item label="Kho">
                            {selectedSession.warehouse_name}
                          </Descriptions.Item>
                          <Descriptions.Item label="Trạng thái">
                            {statusTag(selectedSession.status)}
                          </Descriptions.Item>
                          <Descriptions.Item label="Snapshot">
                            {selectedSession.snapshot_at || "-"}
                          </Descriptions.Item>
                          <Descriptions.Item label="Version">
                            {selectedSession.version ??
                              selectedSession.etag ??
                              "Chưa có"}
                          </Descriptions.Item>
                        </Descriptions>
                        {selectedSession.movement_warning_count ? (
                          <Alert
                            type="warning"
                            showIcon
                            title="Có movement sau snapshot"
                            description="Variance phải đối chiếu expected_at_count = snapshot_qty + net movement sau snapshot đến cutoff. FE chỉ hiển thị dữ liệu BE trả, không tự chốt số canonical."
                          />
                        ) : null}
                        <Row gutter={[12, 12]}>
                          <Col xs={12} md={6}>
                            <Statistic
                              title="SKU"
                              value={selectedSession.total_sku}
                            />
                          </Col>
                          <Col xs={12} md={6}>
                            <Statistic
                              title="Đã đếm"
                              value={selectedSession.counted_sku}
                            />
                          </Col>
                          <Col xs={12} md={6}>
                            <Statistic
                              title="Chênh lệch"
                              value={selectedSession.variance_sku}
                            />
                          </Col>
                          <Col xs={12} md={6}>
                            <Statistic
                              title="Movement"
                              value={
                                selectedSession.movement_warning_count ?? 0
                              }
                            />
                          </Col>
                        </Row>
                        <InlineApiError
                          error={detailError}
                          title="Không thể tải count/variance của phiên"
                          onRetry={retry}
                        />
                        <Tabs
                          items={[
                            {
                              key: "count",
                              label: "Nhập số đếm",
                              children: (
                                <Table
                                  size="small"
                                  dataSource={counts}
                                  rowKey="sku"
                                  loading={detailLoading}
                                  pagination={{ pageSize: 6 }}
                                  scroll={{ x: 980 }}
                                  locale={{
                                    emptyText: tableEmptyText(
                                      detailError,
                                      "Chưa có dòng đếm từ backend",
                                    ),
                                  }}
                                  columns={[
                                    {
                                      title: "SKU",
                                      dataIndex: "sku",
                                      width: 130,
                                    },
                                    {
                                      title: "Tên",
                                      dataIndex: "sku_name",
                                      width: 180,
                                    },
                                    {
                                      title: "Snapshot",
                                      width: 100,
                                      render: (_, row) =>
                                        formatQty(row.snapshot_qty),
                                    },
                                    {
                                      title: "Net move",
                                      width: 100,
                                      render: (_, row) =>
                                        formatQty(
                                          row.net_movement_after_snapshot,
                                        ),
                                    },
                                    {
                                      title: "Expected",
                                      width: 100,
                                      render: (_, row) =>
                                        formatQty(
                                          row.expected_at_count ??
                                            row.expected_qty,
                                        ),
                                    },
                                    {
                                      title: "Actual",
                                      width: 150,
                                      render: (_, row) => (
                                        <InputNumber
                                          min={0}
                                          value={draft[row.sku]?.actual_qty}
                                          onChange={(value) =>
                                            setDraft((current) => ({
                                              ...current,
                                              [row.sku]: {
                                                ...current[row.sku],
                                                actual_qty: Number(value ?? 0),
                                              },
                                            }))
                                          }
                                        />
                                      ),
                                    },
                                    {
                                      title: "Ghi chú",
                                      width: 220,
                                      render: (_, row) => (
                                        <Input
                                          value={draft[row.sku]?.notes}
                                          placeholder="Lý do đếm lại, ghi chú..."
                                          onChange={(event) =>
                                            setDraft((current) => ({
                                              ...current,
                                              [row.sku]: {
                                                ...current[row.sku],
                                                notes: event.target.value,
                                              },
                                            }))
                                          }
                                        />
                                      ),
                                    },
                                    {
                                      title: "Trạng thái",
                                      dataIndex: "status",
                                      width: 120,
                                      render: statusTag,
                                    },
                                    {
                                      title: "Lưu",
                                      fixed: "right",
                                      width: 100,
                                      render: (_, row) => (
                                        <Button
                                          size="small"
                                          icon={<SaveOutlined />}
                                          loading={submitting}
                                          disabled={row.status === "VERIFIED"}
                                          onClick={() => saveCount(row)}
                                        >
                                          Lưu
                                        </Button>
                                      ),
                                    },
                                  ]}
                                />
                              ),
                            },
                            {
                              key: "variance",
                              label: "Đối soát variance",
                              children: (
                                <Space
                                  orientation="vertical"
                                  style={{ width: "100%" }}
                                >
                                  <Alert
                                    type="info"
                                    showIcon
                                    title="Công thức hiển thị"
                                    description="expected_at_count = snapshot_qty + net_movement_after_snapshot_to_count_cutoff; variance_to_apply = actual_qty - expected_at_count."
                                  />
                                  <Table
                                    size="small"
                                    dataSource={variances}
                                    rowKey="sku"
                                    loading={detailLoading}
                                    pagination={{ pageSize: 6 }}
                                    scroll={{ x: 980 }}
                                    locale={{
                                      emptyText: tableEmptyText(
                                        detailError,
                                        "Chưa có variance cần review",
                                      ),
                                    }}
                                    columns={[
                                      {
                                        title: "SKU",
                                        dataIndex: "sku",
                                        width: 130,
                                      },
                                      {
                                        title: "Tên",
                                        dataIndex: "sku_name",
                                        width: 180,
                                      },
                                      {
                                        title: "Snapshot",
                                        width: 100,
                                        render: (_, row) =>
                                          formatQty(row.snapshot_qty),
                                      },
                                      {
                                        title: "Net move",
                                        width: 100,
                                        render: (_, row) =>
                                          varianceTag(
                                            row.net_movement_after_snapshot ??
                                              0,
                                          ),
                                      },
                                      {
                                        title: "Expected",
                                        width: 110,
                                        render: (_, row) =>
                                          formatQty(
                                            row.expected_at_count ??
                                              row.expected_qty,
                                          ),
                                      },
                                      {
                                        title: "Actual",
                                        dataIndex: "actual_qty",
                                        width: 100,
                                        render: formatQty,
                                      },
                                      {
                                        title: "Variance",
                                        dataIndex: "variance",
                                        width: 110,
                                        render: varianceTag,
                                      },
                                      {
                                        title: "Movement",
                                        width: 120,
                                        render: (_, row) =>
                                          row.movement_warning_count ? (
                                            <Tag color="orange">
                                              {row.movement_warning_count} cảnh
                                              báo
                                            </Tag>
                                          ) : (
                                            <Tag>Ổn</Tag>
                                          ),
                                      },
                                      {
                                        title: "Disposition",
                                        dataIndex: "reconcile_status",
                                        width: 130,
                                        render: statusTag,
                                      },
                                    ]}
                                  />
                                  <Button
                                    type="primary"
                                    icon={<CheckCircleOutlined />}
                                    disabled={!canApplySession}
                                    loading={submitting}
                                    onClick={confirmApply}
                                  >
                                    Apply adjustment
                                  </Button>
                                  {!canApply ? (
                                    <Alert
                                      type="warning"
                                      showIcon
                                      title="Thiếu quyền stocktake.apply"
                                      description="Route chỉ yêu cầu stocktake.count; action ảnh hưởng tồn kho cần permission apply/manage theo matrix."
                                    />
                                  ) : null}
                                  {applyResult ? (
                                    <Alert
                                      type={
                                        applyResult.status === "FAILED"
                                          ? "error"
                                          : "success"
                                      }
                                      showIcon
                                      title={`Kết quả apply: ${applyResult.status}`}
                                      description={`Adjusted lines: ${applyResult.adjusted_lines}; total variance: ${applyResult.total_variance}; errors: ${applyResult.errors?.length ?? 0}`}
                                    />
                                  ) : null}
                                </Space>
                              ),
                            },
                          ]}
                        />
                      </Space>
                    ) : (
                      <Alert
                        type="info"
                        showIcon
                        title="Chọn một phiên để nhập đếm, review variance và apply adjustment"
                      />
                    )}
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: "snapshots",
            label: "Tồn chụp",
            children: (
              <>
                <InlineApiError
                  error={error}
                  title="Không thể tải tồn chụp"
                  onRetry={retry}
                />
                <Table
                  dataSource={snapshots}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: 760 }}
                  locale={{
                    emptyText: tableEmptyText(error, "Chưa có tồn chụp"),
                  }}
                  columns={[
                    { title: "SKU", dataIndex: "sku" },
                    { title: "Tên SKU", dataIndex: "sku_name" },
                    {
                      title: "SL kỳ vọng",
                      dataIndex: "expected_qty",
                      render: formatQty,
                    },
                    {
                      title: "SL tồn chụp",
                      dataIndex: "snapshot_qty",
                      render: formatQty,
                    },
                    { title: "Vị trí", dataIndex: "location_hint" },
                  ]}
                />
              </>
            ),
          },
        ]}
      />
      <Modal
        title="Tạo phiên kiểm kê"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        okText="Tạo và chụp snapshot"
        cancelText="Hủy"
        confirmLoading={submitting}
        width={720}
      >
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title="FE không khóa tồn kho"
          description="Khi tạo phiên, backend là authority chụp snapshot/stocktake_started_at và xử lý duplicate/open-session rule."
        />
        <Form
          form={form}
          layout="vertical"
          initialValues={{ scope_type: "FULL_WAREHOUSE" }}
        >
          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item
                name="name"
                label="Tên phiên"
                rules={[{ required: true }]}
              >
                <Input placeholder="VD: Kiểm kê cuối tháng 08" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="warehouse_id"
                label="Kho"
                rules={[{ required: true }]}
              >
                <InputNumber
                  min={1}
                  style={{ width: "100%" }}
                  placeholder="warehouse_id"
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="scope_type"
                label="Scope"
                rules={[{ required: true }]}
              >
                <Select options={scopeOptions} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item noStyle shouldUpdate>
                {({ getFieldValue }) => {
                  const scope = getFieldValue("scope_type");
                  if (scope === "SKU") {
                    return (
                      <Form.Item
                        name="sku_codes"
                        label="SKU"
                        rules={[{ required: true }]}
                      >
                        <Input placeholder="SKU001, SKU002" />
                      </Form.Item>
                    );
                  }
                  if (scope === "SKU_GROUP") {
                    return (
                      <Form.Item
                        name="group_code"
                        label="Nhóm SKU"
                        rules={[{ required: true }]}
                      >
                        <Input placeholder="GROUP-A" />
                      </Form.Item>
                    );
                  }
                  if (scope === "LOCATION") {
                    return (
                      <Form.Item
                        name="location_code"
                        label="Vị trí"
                        rules={[{ required: true }]}
                      >
                        <Input placeholder="A-01-01" />
                      </Form.Item>
                    );
                  }
                  return null;
                }}
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item name="notes" label="Ghi chú">
                <Input.TextArea rows={3} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}
