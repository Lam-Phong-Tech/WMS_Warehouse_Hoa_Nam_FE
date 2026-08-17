import { useState } from "react";
import {
  Alert,
  Descriptions,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { toast } from "sonner";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { getApiErrorMessage, normalizeError } from "@/shared/api/api-error";
import { useHasPermission } from "@/shared/components/permission";
import {
  useCancelReversal,
  useConfirmReversal,
  usePostReversal,
  useReversalDocument,
  useReversalLines,
} from "../hooks/use-reversal";
import { ReversalStatusTag } from "./ReversalStatusTag";
import type { ReversalLine, ReversalReturnCondition } from "../types";

const numberFormatter = new Intl.NumberFormat("vi-VN");

function qty(value?: number) {
  return numberFormatter.format(Number(value ?? 0));
}

function idempotencyKey(action: string, id: string) {
  return `reversal-${action}-${id}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const RETURN_CONDITION_OPTIONS: Array<{
  value: ReversalReturnCondition;
  label: string;
}> = [
  { value: "SELLABLE", label: "SELLABLE · cộng lại available" },
  { value: "DEFECTIVE", label: "DEFECTIVE · không cộng available" },
  { value: "NON_SELLABLE", label: "NON_SELLABLE · không cộng available" },
];

interface Props {
  documentId: string;
  onClose: () => void;
}

/**
 * REV-01 · Chi tiết Reversal + lifecycle SRS §6.
 *
 * DRAFT → Confirm (xác nhận hàng vật lý về, stock-neutral) → Post (điểm duy nhất sinh
 * movement đối ứng) hoặc Cancel. BR-REV-08: POSTED là append-only, không sửa/huỷ được;
 * muốn chỉnh tiếp phải tạo Reversal mới trong cùng correction_chain_id.
 */
export function ReversalDetailModal({ documentId, onClose }: Props) {
  const can = useHasPermission();
  const canPost = can("inventory.reversal.post");

  const docQuery = useReversalDocument(documentId);
  const linesQuery = useReversalLines(documentId);
  const confirmMutation = useConfirmReversal();
  const postMutation = usePostReversal();
  const cancelMutation = useCancelReversal();

  const doc = docQuery.data;
  const lines = linesQuery.data ?? [];

  const [returnCondition, setReturnCondition] =
    useState<ReversalReturnCondition>("SELLABLE");
  const [cancelReason, setCancelReason] = useState("");
  const [actionError, setActionError] = useState<unknown>(null);

  const isDraft = doc?.status === "DRAFT";
  const pendingReturn = doc?.physical_return_status === "PENDING_RETURN";
  const busy =
    confirmMutation.isPending ||
    postMutation.isPending ||
    cancelMutation.isPending;

  function handleFailure(error: unknown, fallback: string) {
    setActionError(error);
    const normalized = normalizeError(error);
    toast.error(
      normalized.status === 409 ||
        normalized.status === 412 ||
        normalized.status === 428
        ? `${normalized.message}. Tải lại phiếu để lấy version mới rồi thử lại.`
        : getApiErrorMessage(error, fallback),
    );
  }

  async function handleConfirm() {
    if (!doc) return;
    setActionError(null);
    try {
      await confirmMutation.mutateAsync({
        id: doc.id,
        version: doc.version,
        return_condition: returnCondition,
      });
      toast.success("Đã xác nhận hàng vật lý quay lại kho; chưa phát sinh tồn.");
    } catch (error) {
      handleFailure(error, "Không thể xác nhận hàng về");
    }
  }

  async function handlePost() {
    if (!doc) return;
    Modal.confirm({
      title: "Post reversal?",
      okText: "Post reversal",
      cancelText: "Kiểm tra lại",
      okButtonProps: { danger: true },
      content: (
        <Typography.Text>
          Đây là bước duy nhất phát sinh movement đối ứng. Movement gốc giữ nguyên
          (append-only) và không thể hoàn tác — sửa tiếp phải tạo Reversal mới trong
          cùng chuỗi.
        </Typography.Text>
      ),
      onOk: async () => {
        setActionError(null);
        try {
          await postMutation.mutateAsync({
            id: doc.id,
            version: doc.version,
            idempotency_key: idempotencyKey("post", doc.id),
          });
          toast.success("Đã Post reversal; movement đối ứng đã được ghi.");
        } catch (error) {
          handleFailure(error, "Không thể Post reversal");
        }
      },
    });
  }

  async function handleCancel() {
    if (!doc) return;
    setActionError(null);
    try {
      await cancelMutation.mutateAsync({
        id: doc.id,
        version: doc.version,
        reason: cancelReason.trim(),
      });
      toast.success("Đã huỷ reversal DRAFT; không phát sinh tồn.");
      setCancelReason("");
    } catch (error) {
      handleFailure(error, "Không thể huỷ reversal");
    }
  }

  return (
    <Modal
      open
      centered
      destroyOnHidden
      mask={{ closable: false }}
      width={1040}
      title={`Chi tiết hoàn đảo — ${doc?.reversal_code ?? documentId}`}
      footer={null}
      onCancel={onClose}
    >
      <Space orientation="vertical" size={16} style={{ width: "100%" }}>
        {docQuery.isError ? (
          <ApiErrorAlert
            error={docQuery.error}
            title="Không thể tải chi tiết hoàn đảo"
            onRetry={() => docQuery.refetch()}
          />
        ) : null}

        {actionError ? (
          <ApiErrorAlert
            error={actionError}
            title="Thao tác lifecycle không thành công"
            onRetry={() => {
              setActionError(null);
              void docQuery.refetch();
            }}
          />
        ) : null}

        {docQuery.isLoading ? (
          <div style={{ padding: 24, textAlign: "center" }}>
            Đang tải chi tiết...
          </div>
        ) : null}

        {doc ? (
          <>
            <Descriptions bordered column={{ xs: 1, md: 2 }} size="small">
              <Descriptions.Item label="Mã hoàn đảo">
                <Typography.Text code copyable>
                  {doc.reversal_code}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                <ReversalStatusTag
                  status={doc.status}
                  physicalReturnStatus={doc.physical_return_status}
                />
              </Descriptions.Item>
              <Descriptions.Item label="Chứng từ gốc">
                <Typography.Text code>
                  {doc.reference_document_code}
                </Typography.Text>{" "}
                <Tag>{doc.reference_document_type}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Chuỗi hoàn đảo">
                <Typography.Text code>
                  {doc.correction_chain_id ?? "-"}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="Kho">
                {doc.warehouse_name}
              </Descriptions.Item>
              <Descriptions.Item label="Version (If-Match)">
                {doc.version}
              </Descriptions.Item>
              <Descriptions.Item label="Lý do">
                {doc.reason_code ? <Tag>{doc.reason_code}</Tag> : null}
                {doc.reason}
              </Descriptions.Item>
              <Descriptions.Item label="Tổng dòng / SL">
                {doc.total_lines} dòng · {qty(doc.total_qty)}
              </Descriptions.Item>
              <Descriptions.Item label="Ngày tạo">
                {doc.created_at}
              </Descriptions.Item>
              <Descriptions.Item label="Người tạo">
                {doc.created_by}
              </Descriptions.Item>
              <Descriptions.Item label="Posted at / by">
                {doc.reversed_at ?? "-"} · {doc.posted_by ?? "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Huỷ">
                {doc.cancelled_at
                  ? `${doc.cancelled_at} · ${doc.cancel_reason ?? "-"}`
                  : "-"}
              </Descriptions.Item>
            </Descriptions>

            {doc.status === "POSTED" ? (
              <Alert
                type="success"
                showIcon
                title="Reversal đã POSTED — append-only"
                description="Movement gốc giữ nguyên, movement đối ứng đã ghi. Muốn sửa tiếp phải tạo Reversal mới tham chiếu movement gần nhất trong cùng chuỗi (BR-REV-08)."
              />
            ) : null}

            {isDraft && canPost ? (
              <div
                style={{
                  background: "#fafafa",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  padding: 16,
                }}
              >
                <Typography.Text
                  strong
                  style={{ display: "block", marginBottom: 12 }}
                >
                  Lifecycle DRAFT → CONFIRMED → POSTED
                </Typography.Text>

                {pendingReturn ? (
                  <Space wrap align="end" style={{ marginBottom: 12 }}>
                    <div>
                      <Typography.Text
                        type="secondary"
                        style={{ display: "block", fontSize: 12 }}
                      >
                        Tình trạng hàng trả về (BR-REV-06/07)
                      </Typography.Text>
                      <Select<ReversalReturnCondition>
                        value={returnCondition}
                        style={{ width: 320 }}
                        options={RETURN_CONDITION_OPTIONS}
                        onChange={setReturnCondition}
                      />
                    </div>
                    <button
                      className="btn primary"
                      type="button"
                      disabled={busy}
                      onClick={() => void handleConfirm()}
                    >
                      Xác nhận hàng vật lý đã về
                    </button>
                  </Space>
                ) : (
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 12 }}
                    title="Đã đủ điều kiện Post"
                    description="Hàng vật lý đã được xác nhận quay lại kho; bấm Post reversal để ghi movement đối ứng."
                  />
                )}

                <Space wrap align="end">
                  <button
                    className="btn danger"
                    type="button"
                    disabled={busy || pendingReturn}
                    onClick={() => void handlePost()}
                  >
                    Post reversal
                  </button>
                  <div>
                    <Typography.Text
                      type="secondary"
                      style={{ display: "block", fontSize: 12 }}
                    >
                      Lý do huỷ (tối thiểu 5 ký tự)
                    </Typography.Text>
                    <Input
                      value={cancelReason}
                      style={{ width: 320 }}
                      placeholder="Nhập lý do huỷ phiếu DRAFT..."
                      onChange={(e) => setCancelReason(e.target.value)}
                    />
                  </div>
                  <button
                    className="btn"
                    type="button"
                    disabled={busy || cancelReason.trim().length < 5}
                    onClick={() => void handleCancel()}
                  >
                    Huỷ phiếu DRAFT
                  </button>
                </Space>
              </div>
            ) : null}
          </>
        ) : null}

        {linesQuery.isError ? (
          <ApiErrorAlert
            error={linesQuery.error}
            title="Không thể tải dòng hoàn đảo"
            onRetry={() => linesQuery.refetch()}
          />
        ) : null}

        <div>
          <Typography.Text strong style={{ display: "block", marginBottom: 8 }}>
            Dòng hoàn đảo ({lines.length})
          </Typography.Text>
          <Table<ReversalLine>
            size="small"
            dataSource={lines}
            rowKey="id"
            loading={linesQuery.isLoading}
            pagination={lines.length > 10 ? { pageSize: 10 } : false}
            scroll={{ x: 1080 }}
            locale={{ emptyText: "Chưa có dòng hoàn đảo" }}
            columns={[
              { title: "#", dataIndex: "line_no", width: 50 },
              { title: "SKU", dataIndex: "sku", width: 140 },
              { title: "Tên", dataIndex: "sku_name", width: 170 },
              {
                title: "Movement gốc",
                width: 150,
                render: (_: unknown, row: ReversalLine) => (
                  <Typography.Text code>
                    {row.original_movement_code || row.original_movement_id}
                  </Typography.Text>
                ),
              },
              {
                title: "Item / Serial",
                width: 150,
                render: (_: unknown, row: ReversalLine) =>
                  row.serial_number || row.item_code || "-",
              },
              {
                title: "SL gốc",
                dataIndex: "original_qty",
                width: 90,
                align: "right",
                render: qty,
              },
              {
                title: "SL đảo",
                dataIndex: "reversal_qty",
                width: 90,
                align: "right",
                render: (v: number) => (
                  <Typography.Text strong type="danger">
                    {qty(v)}
                  </Typography.Text>
                ),
              },
              {
                title: "Đã đảo",
                dataIndex: "reversed_qty",
                width: 90,
                align: "right",
                render: qty,
              },
              {
                title: "Còn đảo",
                dataIndex: "remaining_qty",
                width: 90,
                align: "right",
                render: qty,
              },
              {
                title: "Tình trạng trả về",
                dataIndex: "return_condition",
                width: 140,
                render: (value: string | undefined) =>
                  value ? <Tag>{value}</Tag> : "-",
              },
              {
                title: "Trạng thái",
                dataIndex: "status",
                width: 110,
                render: (value: string) => (
                  <ReversalStatusTag status={value} compact />
                ),
              },
            ]}
          />
        </div>
      </Space>
    </Modal>
  );
}
