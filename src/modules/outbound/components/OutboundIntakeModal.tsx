import { useState } from "react";
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import {
  useMvpAgencies,
  useMvpSkus,
} from "@/modules/master-data/hooks/use-mvp-master";
import type { AgencyRecord } from "@/modules/master-data/types/mvp-master.types";
import {
  consumeOutboundImport,
  fetchAvailableQtyBySku,
  uploadOutboundRequestFile,
  validateOutboundRequestRows,
  type OutboundImportResult,
  type OutboundRequestRowInput,
} from "@/modules/outbound/services/mvpOutboundService";

type IntakeMode = "manual" | "excel";

type IntakeFormValues = {
  request_no: string;
  agency_id?: string;
  recipient_name: string;
  recipient_address: string;
  lines: Array<{ product_id: string; required_qty: number }>;
};

interface OutboundIntakeModalProps {
  open: boolean;
  canImport: boolean;
  onClose: () => void;
  /** Consume thành công: trả danh sách outbound document id vừa được BE tạo. */
  onConsumed: (outboundDocumentIds: string[]) => void;
}

function makeKey(prefix: string): string {
  const random =
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `${prefix}-${random}`;
}

function text(value: unknown, fallback = ""): string {
  return value === undefined || value === null ? fallback : String(value);
}

type ImportRow = OutboundImportResult["rows"][number];

function rowErrorText(row: ImportRow): string {
  return row.errors
    .map(
      (error) =>
        `${error.field ?? `dòng ${error.row ?? row.rowNo}`}: ${error.message ?? error.error_code ?? "Lỗi"}`,
    )
    .join(" · ");
}

const IMPORT_STATUS_COLOR: Record<string, string> = {
  UPLOADED: "processing",
  VALIDATED: "success",
  REJECTED: "error",
  CONSUMED: "default",
};

/**
 * OUT-REQ-01 · Tiếp nhận Phiếu yêu cầu xuất.
 * Hai chế độ: nhập tay (validate qua cùng API import) và upload file Excel.
 * Luồng chuẩn baseline: validate → preview lỗi theo row/field → consume
 * (Idempotency-Key) → BE tự tạo outbound request OPEN + outbound DRAFT.
 * Toàn bộ bước này stock-neutral.
 */
export function OutboundIntakeModal({
  open,
  canImport,
  onClose,
  onConsumed,
}: OutboundIntakeModalProps) {
  const [mode, setMode] = useState<IntakeMode>("manual");
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [preview, setPreview] = useState<OutboundImportResult | null>(null);
  const [form] = Form.useForm<IntakeFormValues>();

  const skuQuery = useMvpSkus({
    status: "ACTIVE",
    sku_type: "PRODUCT",
    per_page: 100,
  });
  const agencyQuery = useMvpAgencies({ status: "ACTIVE", per_page: 100 });
  const skuRows = skuQuery.data?.data ?? [];
  const agencyRows = agencyQuery.data?.data ?? [];

  // OUT-REQ-01: cột "Khả dụng" chỉ để tham khảo khi preview; availability
  // thật luôn được BE kiểm tra lại tại thời điểm scan/Post (mục 2.1).
  const previewSkuIds = [
    ...new Set(
      (preview?.rows ?? [])
        .map((row) => text(row.normalized.sku_id))
        .filter(Boolean),
    ),
  ];
  const availabilityQuery = useQuery({
    queryKey: ["mvp-outbound", "availability", preview?.id, previewSkuIds],
    enabled: previewSkuIds.length > 0,
    retry: false,
    queryFn: () => fetchAvailableQtyBySku(previewSkuIds),
  });

  const resetAll = () => {
    setPreview(null);
    setFile(null);
    setFileInputKey((key) => key + 1);
    setMode("manual");
    form.resetFields();
  };

  const close = () => {
    resetAll();
    onClose();
  };

  const validateManualMutation = useMutation({
    mutationFn: async () => {
      const values = await form.validateFields();
      const rows: OutboundRequestRowInput[] = values.lines.map((line) => ({
        request_no: values.request_no.trim(),
        customer_name: values.recipient_name.trim(),
        customer_address: values.recipient_address.trim(),
        sku_id: line.product_id,
        required_qty: Number(line.required_qty),
        agency_id: values.agency_id || null,
      }));
      return validateOutboundRequestRows(rows);
    },
    onSuccess: (result) => {
      setPreview(result);
      if (result.status === "VALIDATED") {
        message.success(
          "Yêu cầu xuất hợp lệ. Kiểm tra preview rồi Confirm để tạo Outbound DRAFT.",
        );
      } else {
        message.warning(
          "Dữ liệu còn lỗi blocking — chưa thể consume. Sửa theo bảng lỗi bên dưới.",
        );
      }
    },
  });

  const validateFileMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Chọn file Excel (.xlsx/.xls) trước khi kiểm tra.");
      return uploadOutboundRequestFile(file);
    },
    onSuccess: (result) => {
      setPreview(result);
      if (result.status === "VALIDATED") {
        message.success("File Excel đã VALIDATED. Confirm để tạo Outbound DRAFT.");
      } else {
        message.warning(
          "File có row lỗi. Blocking error khiến toàn bộ batch không được consume (không consume một phần).",
        );
      }
    },
  });

  const consumeMutation = useMutation({
    mutationFn: async () => {
      if (!preview) throw new Error("Chưa có import để consume.");
      return consumeOutboundImport(preview.id, makeKey("consume-outbound"));
    },
    onSuccess: (result) => {
      message.success(
        `Đã tạo ${result.outboundRequestIds.length} request OPEN và ${result.outboundDocumentIds.length} phiếu xuất DRAFT.`,
      );
      const ids = result.outboundDocumentIds;
      resetAll();
      onConsumed(ids);
    },
  });

  const handleAgencyChange = (agencyId?: string) => {
    const agency: AgencyRecord | undefined = agencyId
      ? agencyRows.find((row) => row.agency_id === agencyId)
      : undefined;
    if (!agency) return;
    form.setFieldsValue({
      agency_id: agency.agency_id,
      recipient_name: agency.agency_name,
      recipient_address: agency.address ?? "",
    });
  };

  const previewColumns: ColumnsType<ImportRow> = [
    { title: "Row", dataIndex: "rowNo", width: 70 },
    {
      title: "Request",
      key: "request",
      width: 170,
      render: (_, row) => text(row.normalized.request_no, "-"),
    },
    {
      title: "Người nhận",
      key: "recipient",
      width: 180,
      render: (_, row) =>
        text(row.normalized.recipient_name ?? row.normalized.customer_name, "-"),
    },
    {
      title: "SKU",
      key: "sku",
      width: 220,
      render: (_, row) =>
        text(row.normalized.sku_code ?? row.normalized.sku_id, "-"),
    },
    {
      title: "SL yêu cầu",
      key: "qty",
      width: 100,
      align: "right",
      render: (_, row) => text(row.normalized.required_qty, "-"),
    },
    {
      title: "Khả dụng",
      key: "available",
      width: 150,
      align: "right",
      render: (_, row) => {
        const skuId = text(row.normalized.sku_id);
        const available = skuId
          ? availabilityQuery.data?.[skuId]
          : undefined;
        if (available === undefined) {
          return (
            <Typography.Text type="secondary">
              {availabilityQuery.isLoading ? "…" : "—"}
            </Typography.Text>
          );
        }
        const required = Number(row.normalized.required_qty ?? 0);
        return (
          <Space size={4}>
            <span>{available}</span>
            {row.errors.length === 0 ? (
              <Tag color={available >= required ? "success" : "warning"}>
                {available >= required ? "Có thể đáp ứng" : "Thiếu tồn"}
              </Tag>
            ) : null}
          </Space>
        );
      },
    },
    {
      title: "Kết quả",
      key: "result",
      render: (_, row) =>
        row.errors.length === 0 ? (
          <Tag color="success">VALID</Tag>
        ) : (
          <Typography.Text type="danger">{rowErrorText(row)}</Typography.Text>
        ),
    },
  ];

  const consumable =
    Boolean(preview) &&
    preview?.status === "VALIDATED" &&
    (preview?.errorRows ?? 0) === 0 &&
    canImport;

  return (
    <Modal
      title="OUT-REQ-01 · Tiếp nhận Phiếu yêu cầu xuất"
      open={open}
      width={1060}
      footer={null}
      onCancel={close}
      maskClosable={false}
      destroyOnHidden
    >
      <Space direction="vertical" size={14} style={{ width: "100%" }}>
        <Space wrap>
          <Tag color="blue">POST /outbound-request-imports</Tag>
          <Tag color="blue">POST /outbound-request-imports/:id/consume</Tag>
          <Tag color="gold">Idempotency-Key khi consume</Tag>
          <Tag color="green">stock_effect=NONE</Tag>
        </Space>
        <Alert
          type="info"
          showIcon
          message="Luồng chuẩn: validate request/Excel → preview lỗi row/field → consume → BE tạo Outbound DRAFT"
          description="Blocking error khiến cả batch không được consume (không consume một phần). Trùng source key/checksum sẽ replay kết quả, không tạo trùng."
        />

        <Space>
          <Button
            type={mode === "manual" ? "primary" : "default"}
            onClick={() => {
              setMode("manual");
              setPreview(null);
            }}
          >
            Nhập tay
          </Button>
          <Button
            type={mode === "excel" ? "primary" : "default"}
            onClick={() => {
              setMode("excel");
              setPreview(null);
            }}
          >
            Import Excel
          </Button>
        </Space>

        {mode === "manual" ? (
          <Form<IntakeFormValues>
            form={form}
            layout="vertical"
            initialValues={{ lines: [{ product_id: "", required_qty: 1 }] }}
          >
            <div className="grid-2">
              <Form.Item
                name="request_no"
                label="source_request_no *"
                rules={[{ required: true, message: "Nhập mã phiếu yêu cầu xuất" }]}
              >
                <Input placeholder="VD: REQ-20260813-001" maxLength={80} />
              </Form.Item>
              <Form.Item name="agency_id" label="Đại lý / nơi nhận (tùy chọn)">
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="Chọn đại lý để tự điền người nhận / địa chỉ"
                  loading={agencyQuery.isLoading}
                  onChange={handleAgencyChange}
                  options={agencyRows.map((agency) => ({
                    value: agency.agency_id,
                    label: `${agency.agency_code} · ${agency.agency_name}`,
                  }))}
                />
              </Form.Item>
              <Form.Item
                name="recipient_name"
                label="Người / nơi nhận *"
                rules={[{ required: true, message: "Nhập người nhận" }]}
              >
                <Input maxLength={200} />
              </Form.Item>
              <Form.Item
                name="recipient_address"
                label="Địa chỉ nhận *"
                rules={[{ required: true, message: "Nhập địa chỉ nhận" }]}
              >
                <Input maxLength={1000} />
              </Form.Item>
            </div>

            <Form.List name="lines">
              {(fields, { add, remove }) => (
                <Space direction="vertical" style={{ width: "100%" }}>
                  {fields.map((field) => (
                    <Space key={field.key} align="baseline" wrap>
                      <Form.Item
                        {...field}
                        name={[field.name, "product_id"]}
                        label="SKU PRODUCT *"
                        rules={[{ required: true, message: "Chọn SKU" }]}
                      >
                        <Select
                          showSearch
                          optionFilterProp="label"
                          style={{ width: 430 }}
                          loading={skuQuery.isLoading}
                          placeholder="Chỉ SKU PRODUCT ACTIVE (COMPONENT đi luồng bảo hành)"
                          options={skuRows.map((sku) => ({
                            value: sku.sku_id,
                            label: `${sku.sku_code} · ${sku.sku_name}`,
                          }))}
                        />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, "required_qty"]}
                        label="Số lượng *"
                        rules={[{ required: true, message: "Nhập số lượng" }]}
                      >
                        <InputNumber min={1} precision={0} style={{ width: 130 }} />
                      </Form.Item>
                      <Button
                        danger
                        disabled={fields.length === 1}
                        onClick={() => remove(field.name)}
                      >
                        Xóa dòng
                      </Button>
                    </Space>
                  ))}
                  <Button
                    type="dashed"
                    onClick={() => add({ product_id: "", required_qty: 1 })}
                  >
                    + Thêm dòng SKU
                  </Button>
                </Space>
              )}
            </Form.List>

            <Space style={{ marginTop: 12 }}>
              <Button
                type="primary"
                loading={validateManualMutation.isPending}
                disabled={!canImport}
                onClick={() => validateManualMutation.mutate()}
              >
                Kiểm tra & Preview
              </Button>
              <Typography.Text type="secondary">
                SĐT không nằm trong dữ liệu request/nhãn theo baseline PII.
              </Typography.Text>
            </Space>
            <ApiErrorAlert
              error={validateManualMutation.error}
              title="Không validate được yêu cầu xuất"
              style={{ marginTop: 12 }}
            />
          </Form>
        ) : (
          <Space direction="vertical" style={{ width: "100%" }}>
            <Input
              key={fileInputKey}
              type="file"
              accept=".xlsx,.xls"
              aria-label="Chọn file Excel yêu cầu xuất"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <Typography.Text type="secondary">
              Cột bắt buộc: request_no · sku_code · required_qty ·
              recipient_name/customer_name · recipient_address/customer_address.
              Tối đa 10.000 dòng, file ≤ 20MB; row lỗi chặn consume toàn batch.
            </Typography.Text>
            <Button
              type="primary"
              loading={validateFileMutation.isPending}
              disabled={!canImport || !file}
              onClick={() => validateFileMutation.mutate()}
            >
              Upload & Preview
            </Button>
            <ApiErrorAlert
              error={validateFileMutation.error}
              title="Không validate được file Excel"
            />
          </Space>
        )}

        {preview && (
          <Card
            size="small"
            title={`Kết quả import preview · ${preview.importNo || preview.id}`}
          >
            <Space direction="vertical" style={{ width: "100%" }}>
              <Space wrap>
                <Tag color={IMPORT_STATUS_COLOR[preview.status] ?? "default"}>
                  {preview.status || "-"}
                </Tag>
                <Typography.Text>Tổng: {preview.totalRows}</Typography.Text>
                <Typography.Text type="success">
                  Hợp lệ: {preview.validRows}
                </Typography.Text>
                <Typography.Text type={preview.errorRows > 0 ? "danger" : undefined}>
                  Lỗi: {preview.errorRows}
                </Typography.Text>
              </Space>
              <Table<ImportRow>
                rowKey="id"
                size="small"
                dataSource={preview.rows}
                columns={previewColumns}
                pagination={
                  preview.rows.length > 10
                    ? { pageSize: 10, showSizeChanger: false }
                    : false
                }
                scroll={{ x: 1020 }}
                locale={{ emptyText: "Import không có row nào" }}
              />
              <Space>
                <Button
                  type="primary"
                  disabled={!consumable}
                  loading={consumeMutation.isPending}
                  onClick={() => consumeMutation.mutate()}
                >
                  Confirm & tạo Outbound DRAFT
                </Button>
                {!consumable && (
                  <Typography.Text type="secondary">
                    {preview.status !== "VALIDATED" || preview.errorRows > 0
                      ? "Chỉ consume được khi batch VALIDATED và không còn row lỗi."
                      : "Bạn không có quyền outbound.import."}
                  </Typography.Text>
                )}
              </Space>
              <ApiErrorAlert
                error={consumeMutation.error}
                title="Không consume được request"
              />
            </Space>
          </Card>
        )}

        <Space style={{ justifyContent: "flex-end", width: "100%" }}>
          <Button onClick={close}>Đóng</Button>
        </Space>
      </Space>
    </Modal>
  );
}
