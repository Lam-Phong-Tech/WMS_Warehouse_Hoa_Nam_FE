import { useState } from "react";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Timeline,
  Typography,
  Upload,
} from "antd";
import { toast } from "sonner";
import type { TableProps, UploadProps } from "antd";
import {
  DeleteOutlined,
  DownloadOutlined,
  PaperClipOutlined,
  ToolOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import {
  extractFieldErrorsRaw,
  getApiErrorMessage,
  getErrorRequestId,
} from "@/shared/api/api-error";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { useCanAny } from "@/shared/components/permission";
import {
  WARRANTY_ATTACHMENT_TYPE_LABELS,
  WARRANTY_NEXT_STATUS,
  WARRANTY_STATUS_COLORS,
  WARRANTY_STATUS_LABELS,
  WARRANTY_TERMINAL_STATUSES,
  formatWarrantyDateTime,
} from "@/modules/warranty/constants";
import {
  useComponentIssues,
  useDeleteWarrantyAttachment,
  useUpdateWarrantyCase,
  useUploadWarrantyAttachment,
  useWarrantyAttachments,
  useWarrantyCase,
  useWarrantyEvents,
} from "@/modules/warranty/hooks/use-warranty";
import { downloadWarrantyAttachment } from "@/modules/warranty/services/warrantyService";
import type { ComponentIssueDocument } from "@/modules/warranty/services/componentIssueService";
import type {
  WarrantyAttachment,
  WarrantyAttachmentType,
  WarrantyCaseStatus,
} from "@/modules/warranty/types";

interface WarrantyDetailModalProps {
  caseId: string;
  onClose: () => void;
  onOpenComponentIssue: (input: {
    caseId: string;
    caseCode?: string;
    caseActive: boolean;
    documentId?: string | null;
  }) => void;
}

function errorText(error: unknown, fallback: string): string {
  const requestId = getErrorRequestId(error);
  return `${getApiErrorMessage(error, fallback)}${
    requestId ? ` — Request ${requestId}` : ""
  }`;
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * WAR-03 · Chi tiết bảo hành dạng modal (mở từ danh sách WAR-01, không chuyển trang).
 * Gồm: thông tin case (PII mask theo quyền), chẩn đoán, cập nhật trạng thái theo
 * state machine, tệp đính kèm và các phiếu xuất linh kiện gắn với case.
 */
export function WarrantyDetailModal({
  caseId,
  onClose,
  onOpenComponentIssue,
}: WarrantyDetailModalProps) {
  const canManage = useCanAny(["warranty.manage"]);
  const canIssue = useCanAny(["warranty.component_issue"]);
  const canViewPii = useCanAny(["warranty.pii.view"]);

  const detailQuery = useWarrantyCase(caseId);
  const eventsQuery = useWarrantyEvents(caseId);
  const attachmentsQuery = useWarrantyAttachments(caseId);
  const issuesQuery = useComponentIssues(
    { warranty_case_id: caseId, per_page: 50 },
    canIssue,
  );

  const updateMutation = useUpdateWarrantyCase();
  const uploadMutation = useUploadWarrantyAttachment();
  const deleteAttachmentMutation = useDeleteWarrantyAttachment();

  const [statusOpen, setStatusOpen] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusForm] = Form.useForm<{
    status: WarrantyCaseStatus;
    reason?: string;
    confirmed_defect?: string;
    cancel_reason?: string;
  }>();
  const [attachmentType, setAttachmentType] =
    useState<WarrantyAttachmentType>("INTAKE");
  const statusValue = Form.useWatch("status", statusForm);

  const detail = detailQuery.data;
  const isTerminal = detail
    ? WARRANTY_TERMINAL_STATUSES.includes(detail.status)
    : true;
  const nextStatuses = detail
    ? (WARRANTY_NEXT_STATUS[detail.status] ?? [])
    : [];
  const caseActive = detail ? !isTerminal : false;

  const submitStatus = async () => {
    if (!detail) return;
    setStatusError(null);
    let values: {
      status: WarrantyCaseStatus;
      reason?: string;
      confirmed_defect?: string;
      cancel_reason?: string;
    };
    try {
      values = await statusForm.validateFields();
    } catch {
      return;
    }
    try {
      const updated = await updateMutation.mutateAsync({
        id: detail.id,
        request: {
          status: values.status,
          reason: values.reason?.trim() || undefined,
          confirmed_defect: values.confirmed_defect?.trim() || undefined,
          cancel_reason: values.cancel_reason?.trim() || undefined,
          ifMatch: detail.version,
        },
      });
      toast.success(
        `Đã cập nhật case ${updated.case_code} → ${
          WARRANTY_STATUS_LABELS[updated.status] ?? updated.status
        }.`,
      );
      statusForm.resetFields();
      setStatusOpen(false);
    } catch (error: unknown) {
      const fieldErrors = extractFieldErrorsRaw(error);
      if (fieldErrors) {
        statusForm.setFields(
          Object.entries(fieldErrors).map(([name, errors]) => ({
            name: [name] as never,
            errors: [errors],
          })),
        );
      }
      toast.error(errorText(error, "Không cập nhật được trạng thái."));
      setStatusError(errorText(error, "Không cập nhật được trạng thái."));
    }
  };

  const uploadProps: UploadProps = {
    accept: "image/*,.pdf",
    showUploadList: false,
    disabled:
      !canManage || uploadMutation.isPending || detail?.status === "CANCELLED",
    beforeUpload: (file) => {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Tệp vượt quá 10MB.");
        return Upload.LIST_IGNORE;
      }
      uploadMutation
        .mutateAsync({ caseId, file, attachmentType })
        .then(() => toast.success(`Đã tải lên ${file.name}.`))
        .catch((error: unknown) =>
          toast.error(errorText(error, "Tải tệp lên thất bại.")),
        );
      return false;
    },
  };

  const attachmentColumns: TableProps<WarrantyAttachment>["columns"] = [
    {
      title: "Tệp",
      key: "file",
      render: (_, row) => (
        <Space>
          <PaperClipOutlined />
          <Space direction="vertical" size={0}>
            <Typography.Text>{row.file_name}</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {formatBytes(row.file_size_bytes)} ·{" "}
              {WARRANTY_ATTACHMENT_TYPE_LABELS[row.attachment_type] ??
                row.attachment_type}
            </Typography.Text>
          </Space>
        </Space>
      ),
    },
    {
      title: "Tải lên",
      key: "uploaded_at",
      width: 150,
      render: (_, row) => formatWarrantyDateTime(row.uploaded_at),
    },
    {
      title: "",
      key: "actions",
      width: 90,
      render: (_, row) => (
        <Space>
          <Button
            type="text"
            icon={<DownloadOutlined />}
            onClick={() =>
              downloadWarrantyAttachment({
                attachmentId: row.id,
                fileName: row.file_name,
              }).catch((error: unknown) =>
                toast.error(errorText(error, "Tải tệp xuống thất bại.")),
              )
            }
          />
          <Popconfirm
            title="Xóa tệp đính kèm này?"
            okText="Xóa"
            cancelText="Không"
            onConfirm={() =>
              deleteAttachmentMutation
                .mutateAsync(row.id)
                .then(() => toast.success("Đã xóa tệp đính kèm."))
                .catch((error: unknown) =>
                  toast.error(errorText(error, "Không xóa được tệp.")),
                )
            }
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              disabled={!canManage}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const issueColumns: TableProps<ComponentIssueDocument>["columns"] = [
    {
      title: "Phiếu xuất linh kiện",
      dataIndex: "component_issue_no",
      key: "component_issue_no",
      render: (value: string, row) => (
        <Button
          type="link"
          style={{ padding: 0 }}
          onClick={() =>
            onOpenComponentIssue({
              caseId,
              caseCode: detail?.case_code,
              caseActive,
              documentId: row.id,
            })
          }
        >
          {value}
        </Button>
      ),
    },
    {
      title: "Ngày chứng từ",
      dataIndex: "document_date",
      key: "document_date",
      width: 130,
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (value: string) => (
        <Tag
          color={
            value === "POSTED"
              ? "success"
              : value === "CANCELLED"
                ? "error"
                : "processing"
          }
        >
          {value}
        </Tag>
      ),
    },
  ];

  return (
    <Modal
      title={
        <Space>
          <span>{detail?.case_code ?? "Chi tiết bảo hành"}</span>
          {detail ? (
            <Tag color={WARRANTY_STATUS_COLORS[detail.status]}>
              {WARRANTY_STATUS_LABELS[detail.status] ?? detail.status}
            </Tag>
          ) : null}
          {detail?.identification_type === "TEMP_ONLY" ? (
            <Tag color="warning">TEMP_ONLY</Tag>
          ) : null}
        </Space>
      }
      open
      onCancel={onClose}
      width={1000}
      centered
      maskClosable={false}
      destroyOnHidden
      footer={
        <Space wrap>
          <Button onClick={onClose}>Đóng</Button>
          <Button
            icon={<ToolOutlined />}
            disabled={!canIssue || !detail}
            onClick={() =>
              detail &&
              onOpenComponentIssue({
                caseId,
                caseCode: detail.case_code,
                caseActive,
                documentId: null,
              })
            }
          >
            Xuất linh kiện
          </Button>
          <Button
            type="primary"
            disabled={!canManage || isTerminal || nextStatuses.length === 0}
            onClick={() => {
              statusForm.setFieldsValue({ status: nextStatuses[0] });
              setStatusError(null);
              setStatusOpen(true);
            }}
          >
            Cập nhật trạng thái
          </Button>
        </Space>
      }
    >
      <ApiErrorAlert
        error={detailQuery.error}
        title="Không tải được chi tiết case"
        onRetry={() => detailQuery.refetch()}
        style={{ marginBottom: 12 }}
      />

      {!canViewPii ? (
        <Alert
          type="info"
          showIcon
          message="Thông tin khách hàng đang được che (mask) theo quyền warranty.pii.view."
          style={{ marginBottom: 12 }}
        />
      ) : null}

      {detail ? (
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          {detail.identification_type === "TEMP_ONLY" ? (
            <Alert
              type="warning"
              showIcon
              message={`Mã tạm: ${detail.temporary_item_code ?? "—"} · sales_trace_status = NOT_TRACEABLE. Không liên kết item gốc, không sinh stock movement.`}
            />
          ) : null}

          <Descriptions
            title="Khách hàng & tiếp nhận"
            bordered
            size="small"
            column={{ xs: 1, md: 2 }}
          >
            <Descriptions.Item label="Khách gửi">
              {detail.customer_name}
            </Descriptions.Item>
            <Descriptions.Item label="SĐT">
              {detail.customer_phone ?? "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Địa chỉ">
              {detail.customer_address ?? "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Ngày mua">
              {detail.purchase_date ?? "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Ngày tiếp nhận">
              {formatWarrantyDateTime(detail.received_at)}
            </Descriptions.Item>
            <Descriptions.Item label="Phụ kiện đi kèm">
              {detail.accessories_received ?? "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Tình trạng tiếp nhận" span={2}>
              {detail.received_condition ?? "—"}
            </Descriptions.Item>
          </Descriptions>

          <Descriptions
            title="Máy & chẩn đoán"
            bordered
            size="small"
            column={{ xs: 1, md: 2 }}
          >
            <Descriptions.Item label="Item / serial / mã tạm">
              {detail.identification_type === "TEMP_ONLY"
                ? (detail.temporary_item_code ?? "—")
                : (detail.item_code ?? detail.serial_number ?? "—")}
            </Descriptions.Item>
            <Descriptions.Item label="SKU / model">
              {detail.sku || detail.sku_name || "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Trạng thái item">
              {detail.item_status ?? "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Bệnh / lỗi (danh mục)">
              {detail.defect_code
                ? `${detail.defect_code} · ${detail.defect}`
                : (detail.defect ?? "—")}
            </Descriptions.Item>
            <Descriptions.Item label="Khách phản ánh" span={2}>
              {detail.reported_defect ?? "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Kết quả kiểm tra" span={2}>
              {detail.confirmed_defect ?? "Chưa có kết luận"}
            </Descriptions.Item>
            {detail.identification_type === "TEMP_ONLY" ? (
              <>
                <Descriptions.Item label="Lý do mất mã">
                  {detail.missing_code_reason ?? "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Mô tả nhận diện">
                  {detail.manual_product_description ?? "—"}
                </Descriptions.Item>
              </>
            ) : null}
            {detail.status === "CANCELLED" ? (
              <Descriptions.Item label="Lý do hủy" span={2}>
                {detail.cancel_reason ?? "—"}
              </Descriptions.Item>
            ) : null}
            <Descriptions.Item label="Hoàn tất sửa">
              {formatWarrantyDateTime(detail.completed_at)}
            </Descriptions.Item>
            <Descriptions.Item label="Trả khách">
              {formatWarrantyDateTime(detail.returned_at)}
            </Descriptions.Item>
          </Descriptions>

          <Card
            size="small"
            title={`Tệp đính kèm (${attachmentsQuery.data?.length ?? 0})`}
            extra={
              <Space>
                <Select
                  size="small"
                  value={attachmentType}
                  style={{ width: 170 }}
                  onChange={(value) => setAttachmentType(value)}
                  options={Object.entries(WARRANTY_ATTACHMENT_TYPE_LABELS).map(
                    ([value, label]) => ({ value, label }),
                  )}
                />
                <Upload {...uploadProps}>
                  <Button
                    size="small"
                    icon={<UploadOutlined />}
                    loading={uploadMutation.isPending}
                    disabled={!canManage || detail.status === "CANCELLED"}
                  >
                    Tải tệp lên
                  </Button>
                </Upload>
              </Space>
            }
          >
            <Table
              dataSource={attachmentsQuery.data ?? []}
              columns={attachmentColumns}
              rowKey="id"
              size="small"
              loading={attachmentsQuery.isLoading}
              pagination={false}
              locale={{ emptyText: "Chưa có ảnh/tệp đính kèm." }}
            />
          </Card>

          {canIssue ? (
            <Card
              size="small"
              title={`Phiếu xuất linh kiện của case (${issuesQuery.data?.data.length ?? 0})`}
            >
              <Table
                dataSource={issuesQuery.data?.data ?? []}
                columns={issueColumns}
                rowKey="id"
                size="small"
                loading={issuesQuery.isLoading}
                pagination={false}
                locale={{
                  emptyText:
                    "Chưa có phiếu xuất linh kiện — dùng nút “Xuất linh kiện” để tạo.",
                }}
              />
            </Card>
          ) : null}

          <Card
            size="small"
            title="Timeline trạng thái"
            loading={eventsQuery.isLoading}
          >
            <Timeline
              items={
                (eventsQuery.data ?? []).length
                  ? (eventsQuery.data ?? []).map((event) => ({
                      color: WARRANTY_STATUS_COLORS[event.to_status] ?? "blue",
                      children: (
                        <Space direction="vertical" size={2}>
                          <Typography.Text strong>
                            {event.event_type === "NOTE"
                              ? "Ghi chú xử lý"
                              : (WARRANTY_STATUS_LABELS[event.to_status] ??
                                event.to_status)}
                          </Typography.Text>
                          <Typography.Text type="secondary">
                            {formatWarrantyDateTime(event.performed_at)}
                          </Typography.Text>
                          <Typography.Text>{event.description}</Typography.Text>
                        </Space>
                      ),
                    }))
                  : [
                      {
                        color: "gray",
                        children: "Chưa có lịch sử trạng thái cho case này.",
                      },
                    ]
              }
            />
          </Card>
        </Space>
      ) : null}

      <Modal
        title="Cập nhật trạng thái bảo hành"
        open={statusOpen}
        onCancel={() => setStatusOpen(false)}
        onOk={submitStatus}
        okText="Cập nhật"
        cancelText="Hủy"
        confirmLoading={updateMutation.isPending}
        destroyOnHidden
      >
        {statusError ? (
          <Alert
            type="error"
            showIcon
            message={statusError}
            style={{ marginBottom: 12 }}
          />
        ) : null}
        <Alert
          type="info"
          showIcon
          message="Cập nhật trạng thái là stock-neutral: item không tự quay lại tồn bán; trả khách chuyển item sang RETURNED_TO_CUSTOMER."
          style={{ marginBottom: 12 }}
        />
        <Form form={statusForm} layout="vertical">
          <Form.Item
            name="status"
            label="Trạng thái mới"
            rules={[{ required: true, message: "Chọn trạng thái mới." }]}
          >
            <Select
              options={nextStatuses.map((value) => ({
                value,
                label: WARRANTY_STATUS_LABELS[value] ?? value,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="confirmed_defect"
            label="Kết quả kiểm tra / bệnh xác nhận"
          >
            <Input.TextArea rows={2} maxLength={2000} showCount />
          </Form.Item>
          {statusValue === "CANCELLED" ? (
            <Form.Item
              name="cancel_reason"
              label="Lý do hủy (bắt buộc)"
              rules={[
                { required: true, message: "Hủy case cần lý do/bằng chứng." },
              ]}
            >
              <Input.TextArea rows={2} maxLength={1000} showCount />
            </Form.Item>
          ) : null}
          <Form.Item name="reason" label="Ghi chú xử lý (hiện trên timeline)">
            <Input.TextArea rows={2} maxLength={2000} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </Modal>
  );
}
