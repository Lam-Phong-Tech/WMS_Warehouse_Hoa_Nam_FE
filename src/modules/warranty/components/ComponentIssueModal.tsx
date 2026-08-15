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
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { toast } from "sonner";
import type { TableProps } from "antd";
import {
  CameraOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  PlusOutlined,
  StopOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { getApiErrorMessage, getErrorRequestId } from "@/shared/api/api-error";
import { CameraScanModal } from "@/shared/components/forms/CameraScanModal";
import { ScanInput } from "@/shared/components/forms/ScanInput";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { useCanAny } from "@/shared/components/permission";
import { fetchWarehouses } from "@/modules/master-data/services/warehouse.service";
import { useMvpSkus } from "@/modules/master-data/hooks/use-mvp-master";
import {
  useCancelComponentIssue,
  useComponentIssueDetail,
  useCreateComponentIssue,
  usePostComponentIssue,
  useScanComponentIssue,
} from "@/modules/warranty/hooks/use-warranty";
import { makeWarrantyIdempotencyKey } from "@/modules/warranty/services/warrantyService";
import type {
  ComponentIssueDocument,
  ComponentIssueLine,
  ComponentIssueStatus,
} from "@/modules/warranty/services/componentIssueService";

interface DraftLineValue {
  sku_id?: string;
  required_qty?: number;
}

interface ComponentIssueModalProps {
  caseId: string;
  caseCode?: string;
  caseActive: boolean;
  documentId?: string | null;
  onClose: () => void;
  onChanged?: () => void;
}

const STATUS_TAG: Record<
  ComponentIssueStatus,
  { color: string; label: string }
> = {
  DRAFT: { color: "default", label: "DRAFT" },
  SCANNING: { color: "processing", label: "SCANNING" },
  POSTED: { color: "success", label: "POSTED" },
  CANCELLED: { color: "error", label: "CANCELLED" },
};

function errorText(error: unknown, fallback: string): string {
  const requestId = getErrorRequestId(error);
  return `${getApiErrorMessage(error, fallback)}${
    requestId ? ` — Request ${requestId}` : ""
  }`;
}

/**
 * COMP-01 · Xuất linh kiện cho bảo hành (BP-WMS-06).
 * DRAFT → SCANNING → POSTED/CANCELLED; purpose luôn WARRANTY và bắt buộc
 * warranty case active; full-post (mọi line scanned = required) mới trừ tồn.
 */
export function ComponentIssueModal({
  caseId,
  caseCode,
  caseActive,
  documentId: initialDocumentId,
  onClose,
  onChanged,
}: ComponentIssueModalProps) {
  const canIssue = useCanAny(["warranty.component_issue"]);
  const [documentId, setDocumentId] = useState<string | null>(
    initialDocumentId ?? null,
  );
  const [localVersion, setLocalVersion] = useState<number | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [scanQuantity, setScanQuantity] = useState<number>(1);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [recentCodes, setRecentCodes] = useState<string[]>([]);
  const [createForm] = Form.useForm<{
    note?: string;
    lines: DraftLineValue[];
  }>();

  const detailQuery = useComponentIssueDetail(documentId);
  const detail = detailQuery.data;
  const version = localVersion ?? detail?.version ?? null;

  const warehousesQuery = useQuery({
    queryKey: ["warranty", "component-issue-warehouse"],
    queryFn: () => fetchWarehouses({ status: "ACTIVE" }),
    enabled: !documentId,
  });
  const warehouse = warehousesQuery.data?.[0];
  const skusQuery = useMvpSkus({
    sku_type: "COMPONENT",
    status: "ACTIVE",
    per_page: 100,
  });

  const createMutation = useCreateComponentIssue();
  const scanMutation = useScanComponentIssue();
  const cancelMutation = useCancelComponentIssue();
  const postMutation = usePostComponentIssue();

  useEffect(() => {
    if (!selectedLineId && detail?.lines.length) {
      const pending = detail.lines.find(
        (line) => line.scanned_qty < line.required_qty,
      );
      setSelectedLineId((pending ?? detail.lines[0]).id);
    }
  }, [detail, selectedLineId]);

  const allLinesComplete = useMemo(
    () =>
      Boolean(detail?.lines.length) &&
      (detail?.lines ?? []).every(
        (line) => line.scanned_qty === line.required_qty,
      ),
    [detail],
  );
  const isOpenDocument =
    detail?.status === "DRAFT" || detail?.status === "SCANNING";

  const handleCreate = async () => {
    let values: { note?: string; lines: DraftLineValue[] };
    try {
      values = await createForm.validateFields();
    } catch {
      return;
    }
    if (!warehouse?.id) {
      toast.error("Chưa xác định được kho tổng ACTIVE.");
      return;
    }
    try {
      const created = await createMutation.mutateAsync({
        warehouse_id: String(warehouse.id),
        warranty_case_id: caseId,
        document_date: dayjs().format("YYYY-MM-DD"),
        note: values.note?.trim() || undefined,
        lines: (values.lines ?? [])
          .filter((line) => line.sku_id && line.required_qty)
          .map((line) => ({
            sku_id: String(line.sku_id),
            required_qty: Number(line.required_qty),
          })),
      });
      toast.success(
        `Đã tạo phiếu xuất linh kiện ${created.component_issue_no}.`,
      );
      setDocumentId(created.id);
      setLocalVersion(created.version);
      onChanged?.();
    } catch (error: unknown) {
      toast.error(errorText(error, "Không tạo được phiếu xuất linh kiện."));
    }
  };

  const handleScan = async (code: string) => {
    if (!detail || !documentId) return;
    const line = detail.lines.find((item) => item.id === selectedLineId);
    if (!line) {
      toast.warning("Chọn dòng linh kiện trước khi quét.");
      return;
    }
    if (version === null) return;
    try {
      const result = await scanMutation.mutateAsync({
        documentId,
        lineId: line.id,
        codeValue: code,
        quantity: scanQuantity,
        ifMatch: version,
      });
      setLocalVersion(result.version);
      setRecentCodes((current) => [code, ...current].slice(0, 30));
      toast.success(
        `Đã ghi nhận ${scanQuantity} × ${line.sku_code} (${result.scanned_qty}/${line.required_qty}).`,
      );
      onChanged?.();
    } catch (error: unknown) {
      toast.error(errorText(error, "Quét linh kiện thất bại."));
    }
  };

  const handleCancel = async () => {
    if (!documentId || version === null) return;
    if (!cancelReason.trim()) {
      toast.warning("Nhập lý do hủy phiếu.");
      return;
    }
    try {
      const result = await cancelMutation.mutateAsync({
        documentId,
        reason: cancelReason.trim(),
        ifMatch: version,
      });
      setLocalVersion(result.version);
      setCancelOpen(false);
      toast.success("Đã hủy phiếu xuất linh kiện.");
      onChanged?.();
    } catch (error: unknown) {
      toast.error(errorText(error, "Không hủy được phiếu."));
    }
  };

  const confirmPost = () => {
    if (!documentId || version === null) return;
    Modal.confirm({
      title: "Full Post phiếu xuất linh kiện?",
      content:
        "Tồn kho linh kiện sẽ bị trừ atomically (movement COMPONENT_ISSUE). Chỉ Post khi mọi dòng đã quét đủ số lượng.",
      okText: "Post",
      cancelText: "Xem lại",
      onOk: async () => {
        try {
          const result = await postMutation.mutateAsync({
            documentId,
            ifMatch: version,
            idempotencyKey: makeWarrantyIdempotencyKey(
              `component-post-${documentId}`,
            ),
          });
          setLocalVersion(result.version);
          toast.success(
            `Đã Post phiếu xuất linh kiện — ${result.movement_ids.length} movement trừ tồn.`,
          );
          onChanged?.();
        } catch (error: unknown) {
          toast.error(
            errorText(error, "Post phiếu xuất linh kiện thất bại."),
          );
        }
      },
    });
  };

  const lineColumns: TableProps<ComponentIssueLine>["columns"] = [
    {
      title: "#",
      key: "line_no",
      width: 48,
      render: (_, __, index) => index + 1,
    },
    {
      title: "Linh kiện (COMPONENT)",
      key: "sku",
      render: (_, line) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{line.sku_code}</Typography.Text>
          <Typography.Text type="secondary">{line.sku_name}</Typography.Text>
        </Space>
      ),
    },
    {
      title: "Tiến độ quét",
      key: "progress",
      width: 140,
      render: (_, line) => (
        <Tag
          color={
            line.scanned_qty === line.required_qty ? "success" : "processing"
          }
        >
          {line.scanned_qty} / {line.required_qty}
        </Tag>
      ),
    },
    {
      title: "Đã chọn",
      key: "items",
      render: (_, line) => {
        const active = line.items.filter((item) => item.status !== "REMOVED");
        if (!active.length)
          return <Typography.Text type="secondary">—</Typography.Text>;
        return (
          <Space direction="vertical" size={0}>
            {active.map((item) => (
              <Typography.Text key={item.id} style={{ fontSize: 12 }}>
                {item.item_id ? "Serial item" : "Box"} × {item.quantity}
              </Typography.Text>
            ))}
          </Space>
        );
      },
    },
  ];

  const footer = (
    <Space wrap>
      <Button onClick={onClose}>Đóng</Button>
      {documentId && isOpenDocument ? (
        <>
          <Button
            danger
            icon={<StopOutlined />}
            disabled={!canIssue}
            loading={cancelMutation.isPending}
            onClick={() => setCancelOpen(true)}
          >
            Hủy phiếu
          </Button>
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            disabled={!canIssue || !allLinesComplete}
            loading={postMutation.isPending}
            onClick={confirmPost}
          >
            Full Post (trừ tồn)
          </Button>
        </>
      ) : null}
      {!documentId ? (
        <Button
          type="primary"
          icon={<PlusOutlined />}
          disabled={!canIssue || !caseActive}
          loading={createMutation.isPending}
          onClick={handleCreate}
        >
          Tạo phiếu DRAFT
        </Button>
      ) : null}
    </Space>
  );

  return (
    <Modal
      title={
        documentId
          ? `Phiếu xuất linh kiện ${detail?.component_issue_no ?? ""}`
          : `Xuất linh kiện cho case ${caseCode ?? caseId}`
      }
      open
      onCancel={onClose}
      footer={footer}
      width={900}
      centered
      maskClosable={false}
      destroyOnHidden
    >
      {!caseActive && !documentId ? (
        <Alert
          type="error"
          showIcon
          title="Warranty case không còn active (RETURNED/CANCELLED) — không được tạo phiếu xuất linh kiện."
          style={{ marginBottom: 12 }}
        />
      ) : null}

      {!documentId ? (
        <>
          <Alert
            type="info"
            showIcon
            title="Phiếu xuất linh kiện chỉ phục vụ bảo hành (purpose=WARRANTY) và bắt buộc gắn với warranty case đang hoạt động. Tạo DRAFT chưa trừ tồn."
            style={{ marginBottom: 12 }}
          />
          <Form
            form={createForm}
            layout="vertical"
            initialValues={{ lines: [{}] }}
          >
            <Descriptions size="small" column={2} style={{ marginBottom: 12 }}>
              <Descriptions.Item label="Kho xuất">
                {warehouse
                  ? `${String(warehouse.code ?? warehouse.warehouse_code ?? "")} · ${String(
                      warehouse.name ?? warehouse.warehouse_name ?? "",
                    )}`
                  : warehousesQuery.isLoading
                    ? "Đang tải..."
                    : "Không tìm thấy kho ACTIVE"}
              </Descriptions.Item>
              <Descriptions.Item label="Warranty case">
                {caseCode ?? caseId}
              </Descriptions.Item>
            </Descriptions>
            <Form.List name="lines">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field) => (
                    <Space
                      key={field.key}
                      align="start"
                      style={{ display: "flex", marginBottom: 4 }}
                    >
                      <Form.Item
                        name={[field.name, "sku_id"]}
                        rules={[{ required: true, message: "Chọn linh kiện." }]}
                        style={{ width: 420, marginBottom: 8 }}
                      >
                        <Select
                          showSearch
                          optionFilterProp="label"
                          loading={skusQuery.isLoading}
                          placeholder="Chọn SKU linh kiện (COMPONENT)"
                          options={(skusQuery.data?.data ?? []).map((sku) => ({
                            value: sku.sku_id,
                            label: `${sku.sku_code} · ${sku.sku_name}`,
                          }))}
                        />
                      </Form.Item>
                      <Form.Item
                        name={[field.name, "required_qty"]}
                        rules={[{ required: true, message: "Nhập số lượng." }]}
                        style={{ marginBottom: 8 }}
                      >
                        <InputNumber min={1} placeholder="SL cần" />
                      </Form.Item>
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        disabled={fields.length <= 1}
                        onClick={() => remove(field.name)}
                      />
                    </Space>
                  ))}
                  <Button
                    type="dashed"
                    block
                    icon={<PlusOutlined />}
                    onClick={() => add({})}
                    style={{ marginBottom: 12 }}
                  >
                    Thêm dòng linh kiện
                  </Button>
                </>
              )}
            </Form.List>
            <Form.Item name="note" label="Ghi chú">
              <Input.TextArea rows={2} maxLength={2000} />
            </Form.Item>
          </Form>
        </>
      ) : (
        <>
          <ApiErrorAlert
            error={detailQuery.error}
            title="Không tải được phiếu xuất linh kiện"
            onRetry={() => detailQuery.refetch()}
            style={{ marginBottom: 12 }}
          />
          {detail ? (
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <Descriptions size="small" column={{ xs: 1, md: 3 }} bordered>
                <Descriptions.Item label="Trạng thái">
                  <Tag color={STATUS_TAG[detail.status].color}>
                    {STATUS_TAG[detail.status].label}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Mục đích">
                  <Tag color="blue">WARRANTY</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Ngày chứng từ">
                  {detail.document_date || "—"}
                </Descriptions.Item>
              </Descriptions>

              {detail.status === "CANCELLED" ? (
                <Alert
                  type="warning"
                  showIcon
                  title={`Phiếu đã hủy${detail.cancel_reason ? ` — ${detail.cancel_reason}` : ""}. Tồn kho không đổi.`}
                />
              ) : null}
              {detail.status === "POSTED" ? (
                <Alert
                  type="success"
                  showIcon
                  title="Phiếu đã POSTED — tồn linh kiện đã trừ và ghi movement COMPONENT_ISSUE gắn với warranty case."
                />
              ) : null}

              <Table
                dataSource={detail.lines}
                columns={lineColumns}
                rowKey="id"
                size="small"
                pagination={false}
                rowClassName={(line) =>
                  line.id === selectedLineId ? "ant-table-row-selected" : ""
                }
                onRow={(line) => ({
                  onClick: () => setSelectedLineId(line.id),
                })}
              />

              {isOpenDocument ? (
                <Card
                  size="small"
                  title="Quét serial linh kiện hoặc box + số lượng"
                >
                  <Space.Compact block>
                    <InputNumber
                      min={1}
                      value={scanQuantity}
                      onChange={(value) => setScanQuantity(Number(value) || 1)}
                      style={{ width: 90 }}
                    />
                    <div style={{ flex: 1 }}>
                      <ScanInput
                        size="middle"
                        placeholder="Quét Barcode/QR serial linh kiện hoặc box code"
                        recentCodes={recentCodes}
                        disabled={!canIssue || scanMutation.isPending}
                        onScan={handleScan}
                      />
                    </div>
                    <Button
                      icon={<CameraOutlined />}
                      onClick={() => setCameraOpen(true)}
                    >
                      Camera
                    </Button>
                  </Space.Compact>
                  <Typography.Paragraph
                    type="secondary"
                    style={{ marginTop: 8, marginBottom: 0, fontSize: 12 }}
                  >
                    Serial item bắt buộc số lượng 1; box (SKU không serial) nhập
                    số lượng cần lấy. Quét chỉ ghi nhận, chưa trừ tồn cho đến
                    khi Post.
                  </Typography.Paragraph>
                </Card>
              ) : null}
            </Space>
          ) : null}
        </>
      )}

      <Modal
        title="Hủy phiếu xuất linh kiện"
        open={cancelOpen}
        onCancel={() => setCancelOpen(false)}
        onOk={handleCancel}
        okText="Xác nhận hủy"
        okButtonProps={{ danger: true }}
        cancelText="Quay lại"
        confirmLoading={cancelMutation.isPending}
        destroyOnHidden
      >
        <Input.TextArea
          rows={3}
          maxLength={2000}
          placeholder="Lý do hủy (bắt buộc)"
          value={cancelReason}
          onChange={(event) => setCancelReason(event.target.value)}
        />
      </Modal>

      <CameraScanModal
        open={cameraOpen}
        title="Quét linh kiện / box"
        onDetected={(code) => {
          setCameraOpen(false);
          void handleScan(code.trim().toUpperCase());
        }}
        onClose={() => setCameraOpen(false)}
      />
    </Modal>
  );
}

export type { ComponentIssueDocument };
