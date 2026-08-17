import { useEffect, useMemo, useRef } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tag,
} from "antd";
import { toast } from "sonner";
import {
  CloseOutlined,
  DeleteOutlined,
  PlusOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import {
  extractFieldErrorsRaw,
  getApiErrorMessage,
  getErrorRequestId,
  normalizeError,
} from "@/shared/api/api-error";
import {
  hasAnyWmsPermission,
  WMS_PERMISSION_CATALOG as P,
} from "@/shared/constants/wms-permissions";
import { useAuthStore } from "@/shared/store/auth.store";
import { useMvpSkus } from "@/modules/master-data/hooks/use-mvp-master";
import { fetchWarehouses } from "@/modules/master-data/services/warehouse.service";
import {
  useCreateInbound,
  useInboundDetail,
  useUpdateInbound,
} from "@/modules/inbound/hooks/use-inbound";
import {
  defaultInboundDraftValues,
  localToday,
  type InboundDraftFormValues,
} from "@/modules/inbound/schemas/inboundDraft.schema";
import type {
  CreateInboundPayload,
  InboundLinePayload,
  UpdateInboundPayload,
} from "@/modules/inbound/types";

type WarehouseRow = Record<string, unknown>;
type InboundLineFieldPath = keyof InboundDraftFormValues["lines"][number];
type InboundDraftFieldPath =
  | ["warehouseId"]
  | ["documentDate"]
  | ["sourceName"]
  | ["note"]
  | ["lines"]
  | ["lines", number]
  | ["lines", number, InboundLineFieldPath];

export interface InboundDraftModalProps {
  documentId: string | null;
  onClose: () => void;
  onSaved: (documentId: string) => void;
}

function text(value: unknown, fallback = ""): string {
  return value === undefined || value === null ? fallback : String(value);
}

function useInboundPermission(code: string) {
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  return hasAnyWmsPermission(permissionCodes, [code], isSuperAdmin);
}

function toInboundLinePayload(
  lines: InboundDraftFormValues["lines"],
): InboundLinePayload[] {
  return lines.map((line) => {
    const payload: InboundLinePayload = {
      product_id: line.product_id,
      qty_planned: Number(line.qty_planned),
      note: line.note?.trim() || null,
    };
    if (line.id) payload.id = line.id;
    if (line.import_batch_id !== undefined) {
      payload.import_batch_id = line.import_batch_id;
    }
    return payload;
  });
}

function backendFieldPath(key: string): InboundDraftFieldPath | null {
  const direct: Record<string, InboundDraftFieldPath> = {
    doc_date: ["documentDate"],
    dst_warehouse_id: ["warehouseId"],
    // BE có thể trả field error theo tên chuẩn Annex A (`source_reference`) hoặc
    // tên cột vật lý (`source_name`); cả hai đều gắn về cùng một input.
    source_reference: ["sourceName"],
    source_name: ["sourceName"],
    note: ["note"],
  };
  if (direct[key]) return direct[key];

  const match = key.match(
    /^lines\.(\d+)\.(product_id|qty_planned|note|import_batch_id)$/,
  );
  if (!match) return null;
  return ["lines", Number(match[1]), match[2] as InboundLineFieldPath];
}

function applyBackendErrors(
  form: ReturnType<typeof Form.useForm<InboundDraftFormValues>>[0],
  error: unknown,
) {
  const fieldErrors = extractFieldErrorsRaw(error);
  if (!fieldErrors) return;

  const fields = Object.entries(fieldErrors)
    .map(([key, errors]) => {
      const name = backendFieldPath(key);
      return name ? { name, errors: [errors] } : null;
    })
    .filter(
      (
        field,
      ): field is {
        name: InboundDraftFieldPath;
        errors: string[];
      } => Boolean(field),
    );

  if (fields.length) form.setFields(fields);
}

function ApiErrorAlert({
  error,
  fallback,
}: {
  error: unknown;
  fallback: string;
}) {
  const normalized = normalizeError(error);
  const requestId = getErrorRequestId(error);
  return (
    <Alert
      showIcon
      type={normalized.status === 403 ? "warning" : "error"}
      title={
        normalized.status === 403
          ? "Không có quyền truy cập"
          : getApiErrorMessage(error, fallback)
      }
      description={[
        normalized.status ? `HTTP ${normalized.status}` : undefined,
        normalized.code ? `Mã lỗi: ${normalized.code}` : undefined,
        requestId ? `Mã yêu cầu: ${requestId}` : undefined,
      ]
        .filter(Boolean)
        .join(" | ")}
    />
  );
}

export function InboundDraftModal({
  documentId,
  onClose,
  onSaved,
}: InboundDraftModalProps) {
  const [form] = Form.useForm<InboundDraftFormValues>();
  const initializedIdRef = useRef<string | null>(null);
  const detailQuery = useInboundDetail(documentId);
  const skuQuery = useMvpSkus({ status: "ACTIVE", per_page: 100 });
  const warehousesQuery = useQuery({
    queryKey: ["warehouses", "inbound-active"],
    queryFn: () => fetchWarehouses({ status: "ACTIVE", per_page: 100 }),
  });
  const createMutation = useCreateInbound();
  const updateMutation = useUpdateInbound();
  const canCreate = useInboundPermission(P.INBOUND_CREATE);
  const watchedLines = Form.useWatch("lines", form) ?? [];

  useEffect(() => {
    if (!documentId) {
      form.setFieldsValue(defaultInboundDraftValues());
      return;
    }

    const detail = detailQuery.data;
    if (!detail || initializedIdRef.current === documentId) return;

    form.setFieldsValue({
      warehouseId: detail.document.warehouseId,
      documentDate: detail.document.date?.slice(0, 10) || localToday(),
      sourceName: detail.document.source === "-" ? "" : detail.document.source,
      note: detail.document.note ?? "",
      lines: detail.lines.map((line) => ({
        id: line.id,
        product_id: line.productId,
        qty_planned: line.expected,
        scanned_qty: line.scanned,
        note: line.note ?? null,
      })),
    });
    initializedIdRef.current = documentId;
  }, [detailQuery.data, documentId, form]);

  const skuRows = skuQuery.data?.data ?? [];
  const warehouseRows = (warehousesQuery.data ?? []) as WarehouseRow[];
  const detail = detailQuery.data;
  const status = detail?.document.status;
  const hasScanEvidence = Boolean(
    detail?.lines.some((line) => line.scanned > 0),
  );
  const isMutable = !documentId || status === "DRAFT" || status === "SCANNING";
  const canEditStructure = isMutable && !hasScanEvidence;
  const saving = createMutation.isPending || updateMutation.isPending;

  const skuOptions = useMemo(
    () =>
      skuRows.map((sku) => ({
        value: sku.sku_id,
        label: `${sku.sku_code} · ${sku.sku_name}`,
      })),
    [skuRows],
  );

  const warehouseOptions = useMemo(
    () =>
      warehouseRows.map((warehouse) => {
        const id = text(warehouse.id ?? warehouse.warehouse_id);
        return {
          value: id,
          label:
            [text(warehouse.code), text(warehouse.name)]
              .filter(Boolean)
              .join(" · ") || id,
        };
      }),
    [warehouseRows],
  );

  const handleSave = async (values: InboundDraftFormValues) => {
    if (!canCreate || !isMutable) return;

    const lines = values.lines ?? [];
    if (lines.length === 0) {
      toast.error("Phiếu nhập phải có ít nhất một dòng SKU.");
      return;
    }

    const invalidExpected = lines.some((line) => {
      const expected = Number(line.qty_planned);
      const scanned = Number(line.scanned_qty ?? 0);
      return !Number.isInteger(expected) || expected < 1 || expected < scanned;
    });
    if (invalidExpected) {
      toast.error(
        "Expected qty phải là số nguyên dương và không được nhỏ hơn số đã scan.",
      );
      return;
    }

    try {
      const normalizedLines = toInboundLinePayload(lines);
      if (documentId) {
        if (!detail) return;
        const payload: UpdateInboundPayload = {
          doc_date: values.documentDate || null,
          source_reference: values.sourceName?.trim() || null,
          note: values.note?.trim() || null,
          lines: normalizedLines,
        };
        const updated = await updateMutation.mutateAsync({
          id: documentId,
          payload,
          ifMatch: detail.document.version,
        });
        toast.success(
          hasScanEvidence
            ? "Đã hiệu chỉnh Expected; toàn bộ line ID và scan evidence được giữ nguyên."
            : "Đã cập nhật phiếu nhập.",
        );
        onSaved(updated.id);
        return;
      }

      const payload: CreateInboundPayload = {
        doc_date: values.documentDate || null,
        dst_warehouse_id: values.warehouseId,
        source_reference: values.sourceName?.trim() || null,
        note: values.note?.trim() || null,
        lines: normalizedLines,
      };
      const created = await createMutation.mutateAsync(payload);
      toast.success(
        "Đã tạo phiếu nhập DRAFT. Chưa phát sinh biến động tồn kho.",
      );
      onSaved(created.id);
    } catch (error) {
      applyBackendErrors(form, error);
      toast.error(getApiErrorMessage(error, "Không lưu được phiếu nhập."));
      if (documentId) {
        initializedIdRef.current = null;
        await detailQuery.refetch();
      }
    }
  };

  const modalTitle = documentId
    ? status === "SCANNING"
      ? "Hiệu chỉnh phiếu nhập SCANNING"
      : status === "POSTED" || status === "CANCELLED"
        ? "Xem phiếu nhập"
        : "Sửa phiếu nhập DRAFT"
    : "Tạo phiếu nhập DRAFT";

  return (
    <Modal
      title={modalTitle}
      open
      width={1120}
      footer={null}
      onCancel={onClose}
      centered
      mask={{ closable: false }}
      closable={!saving}
      destroyOnHidden
    >
      <div className="master-data-contract-strip">
        <Tag color="blue">POST / PATCH /inbound-documents</Tag>
        <Tag color="gold">inbound.create</Tag>
        <Tag>Full-post only</Tag>
      </div>

      {detailQuery.isError ? (
        <div style={{ marginBottom: 14 }}>
          <ApiErrorAlert
            error={detailQuery.error}
            fallback="Không tải được phiếu nhập."
          />
        </div>
      ) : null}

      {documentId && detail && !isMutable ? (
        <Alert
          showIcon
          type={detail.document.status === "POSTED" ? "success" : "info"}
          className="master-data-state-alert"
          title={
            detail.document.status === "POSTED"
              ? "Phiếu đã POSTED và bất biến"
              : "Phiếu đã CANCELLED và là trạng thái kết thúc"
          }
          description="Không sửa/xóa chứng từ kết thúc. Sai giao dịch POSTED phải đi Reversal/Correction để giữ audit trail."
        />
      ) : null}

      {hasScanEvidence && isMutable ? (
        <Alert
          showIcon
          type="warning"
          className="master-data-state-alert"
          title="Phiếu đã có scan evidence"
          description="Không được thêm/xóa dòng, đổi SKU hoặc import batch. Chỉ hiệu chỉnh Expected/ghi chú; Expected không được nhỏ hơn scanned_qty. Muốn đổi cấu trúc phải Cancel và tạo phiếu mới."
        />
      ) : null}

      <Form<InboundDraftFormValues>
        form={form}
        layout="vertical"
        initialValues={defaultInboundDraftValues()}
        onFinish={(values) => void handleSave(values)}
      >
        <Row gutter={[14, 14]}>
          <Col xs={24} lg={12}>
            <Card size="small" title="Thông tin phiếu">
              <Row gutter={12}>
                <Col xs={24} md={12}>
                  <Form.Item label="Mã phiếu">
                    <Input
                      value={detail?.document.code || "Tự sinh sau khi lưu"}
                      disabled
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="Ngày chứng từ"
                    name="documentDate"
                    rules={[{ required: true, message: "Chọn ngày chứng từ." }]}
                  >
                    <Input type="date" disabled={!isMutable} />
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  <Form.Item label="Nguồn / tham chiếu" name="sourceName">
                    <Input
                      maxLength={200}
                      disabled={!isMutable}
                      placeholder="Nhà cung cấp / nguồn nhập"
                    />
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  <Form.Item
                    label="Kho nhận"
                    name="warehouseId"
                    rules={[
                      {
                        required: true,
                        message: "Chọn kho nhận ACTIVE.",
                      },
                    ]}
                  >
                    <Select
                      showSearch
                      optionFilterProp="label"
                      loading={warehousesQuery.isLoading}
                      options={warehouseOptions}
                      disabled={!isMutable || Boolean(documentId)}
                      placeholder="Chọn kho ACTIVE"
                    />
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  <Form.Item label="Ghi chú" name="note">
                    <Input.TextArea
                      rows={3}
                      maxLength={2000}
                      showCount
                      disabled={!isMutable}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card size="small" title="Quy tắc nhập kho bắt buộc">
              <Space orientation="vertical" size={10}>
                <div>
                  • Expected qty là toàn bộ số lượng phải nhận của từng dòng.
                </div>
                <div>
                  • DRAFT/SCANNING, scan và đăng ký BOX đều stock-neutral.
                </div>
                <div>
                  • Không có partial, thiếu/thừa, remainder hoặc
                  PARTIALLY_POSTED.
                </div>
                <div>
                  • Scan sai SKU/state, trùng hoặc vượt Expected phải bị từ
                  chối.
                </div>
                <div>
                  • Chỉ Full Post khi mọi dòng scanned_qty = expected_qty.
                </div>
                <div>
                  • COMPONENT putaway sau Receipt không được cộng tồn lần hai.
                </div>
              </Space>
            </Card>
          </Col>
        </Row>

        <Card size="small" title="Dòng hàng dự kiến" style={{ marginTop: 14 }}>
          <Form.List name="lines">
            {(fields, { add, remove }) => (
              <>
                <Table
                  size="small"
                  rowKey="key"
                  pagination={false}
                  dataSource={fields}
                  scroll={{ x: 900 }}
                  locale={{
                    emptyText: "Phiếu nhập phải có ít nhất một dòng SKU",
                  }}
                  columns={[
                    {
                      title: "SKU",
                      width: 300,
                      render: (_, field) => {
                        const line = watchedLines[field.name];
                        const sku = skuRows.find(
                          (item) => item.sku_id === line?.product_id,
                        );
                        return (
                          <>
                            <Form.Item name={[field.name, "id"]} hidden>
                              <Input />
                            </Form.Item>
                            <Form.Item
                              name={[field.name, "scanned_qty"]}
                              hidden
                            >
                              <Input />
                            </Form.Item>
                            <Form.Item
                              name={[field.name, "import_batch_id"]}
                              hidden
                            >
                              <Input />
                            </Form.Item>
                            {canEditStructure ? (
                              <Form.Item
                                name={[field.name, "product_id"]}
                                rules={[
                                  {
                                    required: true,
                                    message: "Chọn SKU.",
                                  },
                                ]}
                                style={{ marginBottom: 0 }}
                              >
                                <Select
                                  showSearch
                                  optionFilterProp="label"
                                  loading={skuQuery.isLoading}
                                  options={skuOptions}
                                  placeholder="Chọn SKU ACTIVE"
                                />
                              </Form.Item>
                            ) : (
                              <>
                                <Form.Item
                                  name={[field.name, "product_id"]}
                                  hidden
                                >
                                  <Input />
                                </Form.Item>
                                <strong>
                                  {sku?.sku_code ?? line?.product_id ?? "-"}
                                </strong>
                              </>
                            )}
                          </>
                        );
                      },
                    },
                    {
                      title: "Tên / loại",
                      width: 240,
                      render: (_, field) => {
                        const line = watchedLines[field.name];
                        const sku = skuRows.find(
                          (item) => item.sku_id === line?.product_id,
                        );
                        return (
                          <div>
                            <div>{sku?.sku_name ?? "-"}</div>
                            {sku?.sku_type ? (
                              <Tag style={{ marginTop: 4 }}>{sku.sku_type}</Tag>
                            ) : null}
                          </div>
                        );
                      },
                    },
                    {
                      title: "Expected qty",
                      width: 150,
                      render: (_, field) => {
                        const scanned = Number(
                          watchedLines[field.name]?.scanned_qty ?? 0,
                        );
                        return (
                          <Form.Item
                            name={[field.name, "qty_planned"]}
                            rules={[
                              {
                                required: true,
                                message: "Nhập Expected.",
                              },
                              {
                                validator: (_, value) => {
                                  const expected = Number(value);
                                  if (
                                    !Number.isInteger(expected) ||
                                    expected < 1
                                  ) {
                                    return Promise.reject(
                                      new Error("Số nguyên > 0."),
                                    );
                                  }
                                  if (expected < scanned) {
                                    return Promise.reject(
                                      new Error(`Không nhỏ hơn ${scanned}.`),
                                    );
                                  }
                                  return Promise.resolve();
                                },
                              },
                            ]}
                            style={{ marginBottom: 0 }}
                          >
                            <InputNumber
                              min={Math.max(1, scanned)}
                              precision={0}
                              disabled={!isMutable}
                              style={{ width: "100%" }}
                            />
                          </Form.Item>
                        );
                      },
                    },
                    {
                      title: "Đã scan",
                      width: 120,
                      align: "right",
                      render: (_, field) => {
                        const scanned = Number(
                          watchedLines[field.name]?.scanned_qty ?? 0,
                        );
                        return scanned > 0 ? (
                          <Tag color="processing">{scanned}</Tag>
                        ) : (
                          <span>0</span>
                        );
                      },
                    },
                    {
                      title: "Ghi chú dòng",
                      width: 220,
                      render: (_, field) => (
                        <Form.Item
                          name={[field.name, "note"]}
                          style={{ marginBottom: 0 }}
                        >
                          <Input
                            maxLength={2000}
                            disabled={!isMutable}
                            placeholder="Tùy chọn"
                          />
                        </Form.Item>
                      ),
                    },
                    {
                      title: "",
                      width: 80,
                      fixed: "right",
                      render: (_, field) =>
                        canEditStructure && fields.length > 1 ? (
                          <Button
                            danger
                            type="link"
                            size="small"
                            icon={<DeleteOutlined />}
                            onClick={() => remove(field.name)}
                          >
                            Xóa
                          </Button>
                        ) : null,
                    },
                  ]}
                />

                {canEditStructure ? (
                  <Button
                    icon={<PlusOutlined />}
                    style={{ marginTop: 10 }}
                    onClick={() =>
                      add({
                        product_id: "",
                        qty_planned: 1,
                        scanned_qty: 0,
                        note: null,
                      })
                    }
                  >
                    Thêm dòng SKU
                  </Button>
                ) : null}
              </>
            )}
          </Form.List>

          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "flex-end",
              marginTop: 16,
            }}
          >
            <Button
              icon={<CloseOutlined />}
              disabled={saving}
              onClick={onClose}
            >
              {isMutable ? "Hủy thao tác" : "Đóng"}
            </Button>
            {isMutable ? (
              <Button
                type="primary"
                icon={<SaveOutlined />}
                htmlType="submit"
                loading={saving}
                disabled={!canCreate || detailQuery.isLoading}
              >
                {documentId ? "Lưu & tiếp tục quét" : "Lưu & bắt đầu quét"}
              </Button>
            ) : null}
          </div>
        </Card>
      </Form>
    </Modal>
  );
}
