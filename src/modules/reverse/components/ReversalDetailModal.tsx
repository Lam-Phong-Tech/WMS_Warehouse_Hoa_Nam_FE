import { Modal, Descriptions, Space, Table, Tag, Typography } from "antd";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { useReversalDocument, useReversalLines } from "../hooks/use-reversal";
import type { ReversalLine } from "../types";

const numberFormatter = new Intl.NumberFormat("vi-VN");

function qty(value?: number) {
  return numberFormatter.format(Number(value ?? 0));
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

interface Props {
  documentId: string;
  onClose: () => void;
}

export function ReversalDetailModal({ documentId, onClose }: Props) {
  const docQuery = useReversalDocument(documentId);
  const linesQuery = useReversalLines(documentId);

  const doc = docQuery.data;
  const lines = linesQuery.data ?? [];

  return (
    <Modal
      open
      centered
      destroyOnHidden
      mask={{ closable: false }}
      width={960}
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

        {docQuery.isLoading ? (
          <div style={{ padding: 24, textAlign: "center" }}>
            Đang tải chi tiết...
          </div>
        ) : null}

        {doc ? (
          <Descriptions bordered column={{ xs: 1, md: 2 }} size="small">
            <Descriptions.Item label="Mã hoàn đảo">
              <Typography.Text code copyable>
                {doc.reversal_code}
              </Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="Trạng thái">
              {statusTag(doc.status)}
            </Descriptions.Item>
            <Descriptions.Item label="Loại">
              <Tag>{doc.reversal_type}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Chứng từ gốc">
              <Typography.Text code>
                {doc.reference_document_code}
              </Typography.Text>{" "}
              ({doc.reference_document_type})
            </Descriptions.Item>
            <Descriptions.Item label="Kho">
              {doc.warehouse_name}
            </Descriptions.Item>
            <Descriptions.Item label="Lý do">{doc.reason}</Descriptions.Item>
            <Descriptions.Item label="Tổng dòng / SL">
              {doc.total_lines} dòng · {qty(doc.total_qty)}
            </Descriptions.Item>
            <Descriptions.Item label="Ngày tạo">
              {doc.created_at}
            </Descriptions.Item>
            <Descriptions.Item label="Người tạo">
              {doc.created_by}
            </Descriptions.Item>
            <Descriptions.Item label="Người duyệt">
              {doc.approved_by ?? "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Reversed at">
              {doc.reversed_at ?? "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Ghi chú">
              {doc.notes ?? "-"}
            </Descriptions.Item>
          </Descriptions>
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
            scroll={{ x: 760 }}
            locale={{ emptyText: "Chưa có dòng hoàn đảo" }}
            columns={[
              { title: "SKU", dataIndex: "sku", width: 130 },
              { title: "Tên", dataIndex: "sku_name", width: 170 },
              {
                title: "Original",
                dataIndex: "original_qty",
                width: 100,
                align: "right",
                render: qty,
              },
              {
                title: "Reversal",
                dataIndex: "reversal_qty",
                width: 100,
                align: "right",
                render: (v: number) => (
                  <Typography.Text strong type="danger">
                    {qty(v)}
                  </Typography.Text>
                ),
              },
              {
                title: "Remaining",
                dataIndex: "remaining_qty",
                width: 100,
                align: "right",
                render: qty,
              },
              {
                title: "Status",
                dataIndex: "status",
                width: 120,
                render: statusTag,
              },
              {
                title: "Lỗi",
                dataIndex: "error_message",
                width: 200,
                render: (value: string | undefined) =>
                  value ? (
                    <Typography.Text type="danger">{value}</Typography.Text>
                  ) : (
                    "-"
                  ),
              },
            ]}
          />
        </div>
      </Space>
    </Modal>
  );
}
