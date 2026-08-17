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
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { toast } from "sonner";
import {
  CheckCircleOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  FileExcelOutlined,
  PlusOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getApiErrorMessage } from "@/shared/api/api-error";
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
  // §5.2: toa mang "số toa - ngày - người nhận".
  request_date?: string;
  agency_id?: string;
  recipient_name: string;
  // SRS v1.12 §15: address/phone nullable.
  recipient_address?: string;
  recipient_contact_phone?: string;
  lines: Array<{ product_id: string; required_qty: number }>;
};

/** Annex C OutboundRequestImportConfirmRequest — resolve mapping ở bước review. */
type LineResolution = { sku_id?: string; required_qty?: number };

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
  // SCR-REQ-OUT-01 "line mapping" + §8.1: người dùng resolve SKU/số lượng và
  // override người nhận ngay ở màn review, không phải sửa file rồi upload lại.
  const [resolutions, setResolutions] = useState<Record<number, LineResolution>>(
    {},
  );
  const [recipientOverride, setRecipientOverride] = useState({
    receiver_name: "",
    receiver_address: "",
    receiver_contact_phone: "",
  });
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
    setResolutions({});
    setRecipientOverride({
      receiver_name: "",
      receiver_address: "",
      receiver_contact_phone: "",
    });
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
        request_date: (values.request_date ?? "").trim() || undefined,
        customer_name: values.recipient_name.trim(),
        customer_address: (values.recipient_address ?? "").trim(),
        // §5.2 + Annex D SCR-OUT-01: SĐT người nhận tiếp nhận ngay từ toa (nullable).
        recipient_contact_phone:
          (values.recipient_contact_phone ?? "").trim() || undefined,
        sku_id: line.product_id,
        required_qty: Number(line.required_qty),
        agency_id: values.agency_id || null,
      }));
      return validateOutboundRequestRows(rows);
    },
    onSuccess: (result) => {
      setPreview(result);
      if (result.status === "VALIDATED") {
        toast.success(
          "Yêu cầu xuất hợp lệ. Kiểm tra preview rồi Confirm để tạo Outbound DRAFT.",
        );
      } else {
        toast.warning(
          "Dữ liệu còn lỗi blocking — chưa thể consume. Sửa theo bảng lỗi bên dưới.",
        );
      }
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, "Xác nhận yêu cầu xuất kho thất bại."),
      );
    },
  });

  const validateFileMutation = useMutation({
    mutationFn: async () => {
      if (!file)
        throw new Error("Chọn file Excel (.xlsx/.xls) trước khi kiểm tra.");
      return uploadOutboundRequestFile(file);
    },
    onSuccess: (result) => {
      setPreview(result);
      if (result.status === "VALIDATED") {
        toast.success(
          "File Excel đã VALIDATED. Confirm để tạo Outbound DRAFT.",
        );
      } else {
        toast.warning(
          "File có row lỗi. Blocking error khiến toàn bộ batch không được consume (không consume một phần).",
        );
      }
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Xác nhận file thất bại."));
    },
  });

  const consumeMutation = useMutation({
    mutationFn: async () => {
      if (!preview) throw new Error("Chưa có import để Confirm.");
      // Annex C confirmOutboundRequestImport: Idempotency-Key + If-Match(version import),
      // kèm mapping line và override người nhận đã resolve ở màn review (§8.1).
      const lines = Object.entries(resolutions)
        .map(([rowNo, value]) => ({
          row_no: Number(rowNo),
          ...(value.sku_id ? { sku_id: value.sku_id } : {}),
          ...(value.required_qty ? { required_qty: value.required_qty } : {}),
        }))
        .filter((line) => line.sku_id || line.required_qty);
      const recipient = Object.fromEntries(
        Object.entries(recipientOverride).filter(
          ([, value]) => value.trim() !== "",
        ),
      );
      return consumeOutboundImport(
        preview.id,
        makeKey("confirm-outbound"),
        preview.version,
        { ...(lines.length ? { lines } : {}), ...recipient },
      );
    },
    onSuccess: (result) => {
      toast.success(
        `Đã tạo ${result.outboundRequestIds.length} request OPEN và ${result.outboundDocumentIds.length} phiếu xuất DRAFT.`,
      );
      const ids = result.outboundDocumentIds;
      resetAll();
      onConsumed(ids);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Không thể tạo phiếu xuất kho."));
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
        text(
          row.normalized.recipient_name ?? row.normalized.customer_name,
          "-",
        ),
    },
    {
      title: "SKU",
      key: "sku",
      width: 220,
      render: (_, row) =>
        text(row.normalized.sku_code ?? row.normalized.sku_id, "-"),
    },
    {
      // SCR-REQ-OUT-01: "line mapping" — resolve SKU chưa map ngay ở bước review.
      title: "Map SKU (Confirm)",
      key: "sku_mapping",
      width: 260,
      render: (_, row) => (
        <Select
          allowClear
          showSearch
          size="small"
          style={{ width: 240 }}
          optionFilterProp="label"
          placeholder="Giữ nguyên theo file"
          loading={skuQuery.isLoading}
          value={resolutions[row.rowNo]?.sku_id}
          onChange={(value?: string) =>
            setResolutions((current) => ({
              ...current,
              [row.rowNo]: { ...current[row.rowNo], sku_id: value },
            }))
          }
          options={skuRows.map((sku) => ({
            value: sku.sku_id,
            label: `${sku.sku_code} · ${sku.sku_name}`,
          }))}
        />
      ),
    },
    {
      title: "SL yêu cầu",
      key: "qty",
      width: 140,
      align: "right",
      render: (_, row) => (
        <InputNumber
          size="small"
          min={1}
          style={{ width: 110 }}
          value={
            resolutions[row.rowNo]?.required_qty ??
            (Number(row.normalized.required_qty ?? 0) || undefined)
          }
          onChange={(value) =>
            setResolutions((current) => ({
              ...current,
              [row.rowNo]: {
                ...current[row.rowNo],
                required_qty: value ? Number(value) : undefined,
              },
            }))
          }
        />
      ),
    },
    {
      title: "Khả dụng",
      key: "available",
      width: 150,
      align: "right",
      render: (_, row) => {
        const skuId = text(row.normalized.sku_id);
        const available = skuId ? availabilityQuery.data?.[skuId] : undefined;
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

  // §8.1: Confirm re-validate sau khi áp mapping/override, nên batch REJECTED vẫn
  // được thử Confirm; BE trả 409 IMPORT_HAS_BLOCKING_ERRORS kèm row còn lỗi.
  const consumable = Boolean(preview) && canImport;

  return (
    <Modal
      title="OUT-REQ-01 · Tiếp nhận Phiếu yêu cầu xuất"
      open={open}
      width={1060}
      footer={null}
      onCancel={close}
      mask={{ closable: false }}
      destroyOnHidden
    >
      <Space orientation="vertical" size={14} style={{ width: "100%" }}>
        <Space wrap>
          <Tag color="blue">POST /outbound-request-imports</Tag>
          <Tag color="blue">POST /outbound-request-imports/:id/confirm</Tag>
          <Tag color="gold">Idempotency-Key + If-Match khi Confirm</Tag>
          <Tag color="green">stock_effect=NONE</Tag>
        </Space>
        <Alert
          type="info"
          showIcon
          title="Luồng chuẩn: validate request/Excel → preview lỗi row/field → map SKU/người nhận → Confirm → BE tạo Outbound DRAFT"
          description="Blocking error khiến cả batch không được Confirm (không tạo một phần). Một toa chỉ một người nhận; trùng source key/checksum/số toa đều bị chặn, không tạo phiếu trùng."
        />

        <Space>
          <Button
            type={mode === "manual" ? "primary" : "default"}
            icon={<EditOutlined />}
            onClick={() => {
              setMode("manual");
              setPreview(null);
            }}
          >
            Nhập tay
          </Button>
          <Button
            type={mode === "excel" ? "primary" : "default"}
            icon={<FileExcelOutlined />}
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
                rules={[
                  { required: true, message: "Nhập mã phiếu yêu cầu xuất" },
                ]}
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
              {/* SRS v1.12 §15 + REQ-SRS-014: address/phone của toa nullable —
                  toa mẫu Kinh doanh phát hành có thể không có địa chỉ. */}
              <Form.Item name="recipient_address" label="Địa chỉ nhận">
                <Input maxLength={1000} />
              </Form.Item>
              <Form.Item
                name="recipient_contact_phone"
                label="SĐT liên hệ"
                rules={[
                  {
                    pattern: /^\+?[0-9\s.-]{6,20}$/,
                    message: "SĐT chỉ gồm chữ số (6-20 ký tự).",
                  },
                ]}
              >
                <Input maxLength={50} placeholder="VD: 0901234567" />
              </Form.Item>
              <Form.Item name="request_date" label="Ngày toa">
                <Input placeholder="YYYY-MM-DD" maxLength={10} />
              </Form.Item>
            </div>

            <Form.List name="lines">
              {(fields, { add, remove }) => (
                <Space orientation="vertical" style={{ width: "100%" }}>
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
                        <InputNumber
                          min={1}
                          precision={0}
                          style={{ width: 130 }}
                        />
                      </Form.Item>
                      <Button
                        danger
                        icon={<DeleteOutlined />}
                        disabled={fields.length === 1}
                        onClick={() => remove(field.name)}
                      >
                        Xóa dòng
                      </Button>
                    </Space>
                  ))}
                  <Button
                    type="dashed"
                    icon={<PlusOutlined />}
                    onClick={() => add({ product_id: "", required_qty: 1 })}
                  >
                    Thêm dòng SKU
                  </Button>
                </Space>
              )}
            </Form.List>

            <Space style={{ marginTop: 12 }}>
              <Button
                type="primary"
                icon={<EyeOutlined />}
                loading={validateManualMutation.isPending}
                disabled={!canImport}
                onClick={() => validateManualMutation.mutate()}
              >
                Kiểm tra & Preview
              </Button>
              <Typography.Text type="secondary">
                Người nhận bắt buộc; địa chỉ/SĐT/ngày toa tùy chọn theo SRS §15
                — thiếu thì Packing Label render blank.
              </Typography.Text>
            </Space>
            <ApiErrorAlert
              error={validateManualMutation.error}
              title="Không validate được yêu cầu xuất"
              style={{ marginTop: 12 }}
            />
          </Form>
        ) : (
          <Space orientation="vertical" style={{ width: "100%" }}>
            <Input
              key={fileInputKey}
              type="file"
              accept=".xlsx,.xls"
              aria-label="Chọn file Excel yêu cầu xuất"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <Typography.Text type="secondary">
              Cột bắt buộc: request_no · sku_code · required_qty ·
              recipient_name/customer_name. Cột tùy chọn: request_date ·
              recipient_address · recipient_contact_phone · note (SRS §5.2/§15).
              Tối đa 10.000 dòng, file ≤ 20MB; row lỗi có thể resolve ở bảng
              preview trước khi Confirm.
            </Typography.Text>
            <Button
              type="primary"
              icon={<UploadOutlined />}
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
            <Space orientation="vertical" style={{ width: "100%" }}>
              <Space wrap>
                <Tag color={IMPORT_STATUS_COLOR[preview.status] ?? "default"}>
                  {preview.status || "-"}
                </Tag>
                <Typography.Text>Tổng: {preview.totalRows}</Typography.Text>
                <Typography.Text type="success">
                  Hợp lệ: {preview.validRows}
                </Typography.Text>
                <Typography.Text
                  type={preview.errorRows > 0 ? "danger" : undefined}
                >
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
                scroll={{ x: 1420 }}
                locale={{ emptyText: "Import không có row nào" }}
              />
              {/* §8.1: ConfirmRequest "may override recipient fields"; hiệu lực
                  receiver_name bắt buộc, address/phone optional. */}
              <Card size="small" title="Override người nhận khi Confirm (tùy chọn)">
                <Space wrap>
                  <Input
                    style={{ width: 240 }}
                    placeholder="Người nhận (receiver_name)"
                    maxLength={200}
                    value={recipientOverride.receiver_name}
                    onChange={(event) =>
                      setRecipientOverride((current) => ({
                        ...current,
                        receiver_name: event.target.value,
                      }))
                    }
                  />
                  <Input
                    style={{ width: 300 }}
                    placeholder="Địa chỉ nhận (tùy chọn)"
                    maxLength={1000}
                    value={recipientOverride.receiver_address}
                    onChange={(event) =>
                      setRecipientOverride((current) => ({
                        ...current,
                        receiver_address: event.target.value,
                      }))
                    }
                  />
                  <Input
                    style={{ width: 200 }}
                    placeholder="SĐT liên hệ (tùy chọn)"
                    maxLength={50}
                    value={recipientOverride.receiver_contact_phone}
                    onChange={(event) =>
                      setRecipientOverride((current) => ({
                        ...current,
                        receiver_contact_phone: event.target.value,
                      }))
                    }
                  />
                </Space>
              </Card>
              <Space>
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  disabled={!consumable}
                  loading={consumeMutation.isPending}
                  onClick={() => consumeMutation.mutate()}
                >
                  Confirm & tạo Outbound DRAFT
                </Button>
                {!consumable && (
                  <Typography.Text type="secondary">
                    {!canImport
                      ? "Bạn không có quyền outbound.request.confirm."
                      : "Còn row lỗi — map SKU/số lượng hoặc override người nhận rồi Confirm lại."}
                  </Typography.Text>
                )}
              </Space>
              <ApiErrorAlert
                error={consumeMutation.error}
                title="Không Confirm được toa xuất"
              />
            </Space>
          </Card>
        )}

        <Space style={{ justifyContent: "flex-end", width: "100%" }}>
          <Button icon={<CloseOutlined />} onClick={close}>
            Đóng
          </Button>
        </Space>
      </Space>
    </Modal>
  );
}
