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
  RETURN_CONDITION_LABELS,
  SOURCE_DOCUMENT_TYPE_LABELS,
  businessLabel,
} from "@/shared/constants/business-labels";
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
  { value: "SELLABLE", label: "Có thể bán/xuất lại" },
  { value: "DEFECTIVE", label: "Hàng lỗi" },
  { value: "NON_SELLABLE", label: "Không thể bán/xuất" },
];

interface Props {
  documentId: string;
  onClose: () => void;
}

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
  const [staleRecovered, setStaleRecovered] = useState(false);

  const isDraft = doc?.status === "DRAFT";
  const pendingReturn = doc?.physical_return_status === "PENDING_RETURN";
  const busy =
    confirmMutation.isPending ||
    postMutation.isPending ||
    cancelMutation.isPending;

  function handleFailure(error: unknown, fallback: string) {
    setActionError(error);
    const normalized = normalizeError(error);
    const isStaleVersion =
      normalized.status === 409 ||
      normalized.status === 412 ||
      normalized.status === 428;

    if (isStaleVersion) {
      setStaleRecovered(true);
      void docQuery.refetch();
      void linesQuery.refetch();
      toast.error(
        `${normalized.message}. Hệ thống đã tải lại phiếu mới nhất; hãy kiểm tra trạng thái rồi thử lại.`,
      );
      return;
    }

    setStaleRecovered(false);
    toast.error(getApiErrorMessage(error, fallback));
  }

  async function handleConfirm() {
    if (!doc) return;
    setActionError(null);
    setStaleRecovered(false);
    try {
      await confirmMutation.mutateAsync({
        id: doc.id,
        version: doc.version,
        return_condition: returnCondition,
      });
      toast.success(
        "Đã xác nhận hàng vật lý quay lại kho; tồn kho chưa thay đổi ở bước này.",
      );
    } catch (error) {
      handleFailure(error, "Không thể xác nhận hàng đã về kho");
    }
  }

  async function handlePost() {
    if (!doc) return;
    Modal.confirm({
      title: "Hoàn tất phiếu điều chỉnh tồn kho?",
      okText: "Hoàn tất điều chỉnh",
      cancelText: "Kiểm tra lại",
      okButtonProps: { danger: true },
      content: (
        <Typography.Text>
          Đây là bước làm phát sinh giao dịch đối ứng và thay đổi tồn kho. Giao
          dịch gốc vẫn được giữ nguyên. Nếu cần điều chỉnh tiếp, phải tạo phiếu
          điều chỉnh mới.
        </Typography.Text>
      ),
      onOk: async () => {
        setActionError(null);
        setStaleRecovered(false);
        try {
          await postMutation.mutateAsync({
            id: doc.id,
            version: doc.version,
            idempotency_key: idempotencyKey("post", doc.id),
          });
          toast.success("Đã hoàn tất điều chỉnh tồn kho.");
        } catch (error) {
          handleFailure(error, "Không thể hoàn tất điều chỉnh tồn kho");
        }
      },
    });
  }

  async function handleCancel() {
    if (!doc) return;
    setActionError(null);
    setStaleRecovered(false);
    try {
      await cancelMutation.mutateAsync({
        id: doc.id,
        version: doc.version,
        reason: cancelReason.trim(),
      });
      toast.success("Đã hủy phiếu điều chỉnh; tồn kho không thay đổi.");
      setCancelReason("");
    } catch (error) {
      handleFailure(error, "Không thể hủy phiếu điều chỉnh");
    }
  }

  return (
    <Modal
      open
      centered
      destroyOnHidden
      mask={{ closable: false }}
      width={1040}
      title={`Chi tiết phiếu điều chỉnh — ${doc?.reversal_code ?? documentId}`}
      footer={null}
      onCancel={onClose}
    >
      <Space orientation="vertical" size={16} style={{ width: "100%" }}>
        {docQuery.isError ? (
          <ApiErrorAlert
            error={docQuery.error}
            title="Không thể tải chi tiết phiếu điều chỉnh"
            onRetry={() => docQuery.refetch()}
          />
        ) : null}

        {actionError ? (
          <ApiErrorAlert
            error={actionError}
            title="Thao tác không thành công"
            onRetry={() => {
              setActionError(null);
              setStaleRecovered(false);
              void docQuery.refetch();
              void linesQuery.refetch();
            }}
          />
        ) : null}

        {staleRecovered ? (
          <Alert
            type="warning"
            showIcon
            role="status"
            data-testid="reversal-stale-version-notice"
            title="Phiếu đã được cập nhật ở phiên khác"
            description="Hệ thống đã tự tải lại dữ liệu mới nhất. Hãy kiểm tra trạng thái hiện tại trước khi tiếp tục thao tác. Không có thay đổi tồn kho nào được ghi từ lần thao tác bị từ chối."
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
              <Descriptions.Item label="Mã điều chỉnh">
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
                <Tag>
                  {businessLabel(
                    SOURCE_DOCUMENT_TYPE_LABELS,
                    doc.reference_document_type,
                    "Chứng từ khác",
                  )}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Mã chuỗi điều chỉnh">
                <Typography.Text code>
                  {doc.correction_chain_id ?? "-"}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="Kho">
                {doc.warehouse_name}
              </Descriptions.Item>
              <Descriptions.Item label="Lý do">
                {doc.reason_code ? <Tag>{doc.reason_code}</Tag> : null}
                {doc.reason}
              </Descriptions.Item>
              <Descriptions.Item label="Tổng dòng / số lượng">
                {doc.total_lines} dòng · {qty(doc.total_qty)}
              </Descriptions.Item>
              <Descriptions.Item label="Ngày tạo">
                {doc.created_at}
              </Descriptions.Item>
              <Descriptions.Item label="Người tạo">
                {doc.created_by}
              </Descriptions.Item>
              <Descriptions.Item label="Thời điểm hoàn tất / người thực hiện">
                {doc.reversed_at ?? "-"} · {doc.posted_by ?? "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Thông tin hủy">
                {doc.cancelled_at
                  ? `${doc.cancelled_at} · ${doc.cancel_reason ?? "-"}`
                  : "-"}
              </Descriptions.Item>
            </Descriptions>

            {doc.status === "POSTED" ? (
              <Alert
                type="success"
                showIcon
                title="Phiếu điều chỉnh đã hoàn tất"
                description="Giao dịch gốc vẫn được giữ nguyên và giao dịch đối ứng đã được ghi. Nếu cần sửa tiếp, hãy tạo phiếu điều chỉnh mới tham chiếu giao dịch gần nhất trong cùng chuỗi."
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
                  Các bước xử lý phiếu điều chỉnh
                </Typography.Text>

                {pendingReturn ? (
                  <Space wrap align="end" style={{ marginBottom: 12 }}>
                    <div>
                      <Typography.Text
                        type="secondary"
                        style={{ display: "block", fontSize: 12 }}
                      >
                        Tình trạng hàng trả về
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
                    title="Đã đủ điều kiện hoàn tất"
                    description="Hàng vật lý đã được xác nhận quay lại kho. Bấm Hoàn tất điều chỉnh để ghi thay đổi tồn kho."
                  />
                )}

                <Space wrap align="end">
                  <button
                    className="btn danger"
                    type="button"
                    disabled={busy || pendingReturn}
                    onClick={() => void handlePost()}
                  >
                    Hoàn tất điều chỉnh
                  </button>
                  <div>
                    <Typography.Text
                      type="secondary"
                      style={{ display: "block", fontSize: 12 }}
                    >
                      Lý do hủy (tối thiểu 5 ký tự)
                    </Typography.Text>
                    <Input
                      value={cancelReason}
                      style={{ width: 320 }}
                      placeholder="Nhập lý do hủy phiếu..."
                      onChange={(event) => setCancelReason(event.target.value)}
                    />
                  </div>
                  <button
                    className="btn"
                    type="button"
                    disabled={busy || cancelReason.trim().length < 5}
                    onClick={() => void handleCancel()}
                  >
                    Hủy phiếu
                  </button>
                </Space>
              </div>
            ) : null}
          </>
        ) : null}

        {linesQuery.isError ? (
          <ApiErrorAlert
            error={linesQuery.error}
            title="Không thể tải các dòng điều chỉnh"
            onRetry={() => linesQuery.refetch()}
          />
        ) : null}

        <div>
          <Typography.Text strong style={{ display: "block", marginBottom: 8 }}>
            Dòng điều chỉnh ({lines.length})
          </Typography.Text>
          <Table<ReversalLine>
            size="small"
            dataSource={lines}
            rowKey="id"
            loading={linesQuery.isLoading}
            pagination={lines.length > 10 ? { pageSize: 10 } : false}
            scroll={{ x: "max-content" }}
            locale={{ emptyText: "Chưa có dòng điều chỉnh" }}
            columns={[
              { title: "#", dataIndex: "line_no", width: 50 },
              { title: "SKU", dataIndex: "sku", width: 140 },
              { title: "Tên", dataIndex: "sku_name", width: 170 },
              {
                title: "Giao dịch gốc",
                width: 160,
                render: (_: unknown, row: ReversalLine) => (
                  <Typography.Text code>
                    {row.original_movement_code || row.original_movement_id}
                  </Typography.Text>
                ),
              },
              {
                title: "Sản phẩm / Số sê-ri",
                width: 170,
                render: (_: unknown, row: ReversalLine) =>
                  row.serial_number || row.item_code || "-",
              },
              {
                title: "Số lượng gốc",
                dataIndex: "original_qty",
                width: 110,
                align: "right",
                render: qty,
              },
              {
                title: "Số lượng điều chỉnh",
                dataIndex: "reversal_qty",
                width: 130,
                align: "right",
                render: qty,
              },
              {
                title: "Đã điều chỉnh",
                dataIndex: "reversed_qty",
                width: 110,
                align: "right",
                render: qty,
              },
              {
                title: "Còn có thể điều chỉnh",
                dataIndex: "remaining_qty",
                width: 150,
                align: "right",
                render: qty,
              },
              {
                title: "Tình trạng trả về",
                dataIndex: "return_condition",
                width: 160,
                render: (value: string | undefined) =>
                  value ? (
                    <Tag>
                      {businessLabel(
                        RETURN_CONDITION_LABELS,
                        value,
                        "Tình trạng khác",
                      )}
                    </Tag>
                  ) : (
                    "-"
                  ),
              },
              {
                title: "Trạng thái",
                dataIndex: "status",
                width: 150,
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
