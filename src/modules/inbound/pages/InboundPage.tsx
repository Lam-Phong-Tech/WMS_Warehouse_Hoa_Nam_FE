import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Progress,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  message,
  type TablePaginationConfig,
} from "antd";
import {
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ScanOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
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
  useInboundDocuments,
  useUpdateInbound,
} from "@/modules/inbound/hooks/use-inbound";
import { InboundScanModal } from "@/modules/inbound/pages/MvpInboundScreens";
import {
  defaultInboundDraftValues,
  localToday,
  type InboundDraftFormValues,
} from "@/modules/inbound/schemas/inboundDraft.schema";
import type {
  CreateInboundPayload,
  InboundDocument,
  InboundLinePayload,
  UpdateInboundPayload,
} from "@/modules/inbound/types";

type WarehouseRow = Record<string, unknown>;
type DraftModalProps = {
  documentId: string | null;
  onClose: () => void;
  onSaved: (documentId: string) => void;
};

type InboundLineFieldPath = keyof InboundDraftFormValues["lines"][number];
type InboundDraftFieldPath =
  | ["warehouseId"]
  | ["documentDate"]
  | ["sourceName"]
  | ["note"]
  | ["lines"]
  | ["lines", number]
  | ["lines", number, InboundLineFieldPath];

const STATUS_OPTIONS = [
  { label: "DRAFT", value: "DRAFT" },
  { label: "SCANNING", value: "SCANNING" },
  { label: "POSTED", value: "POSTED" },
  { label: "CANCELLED", value: "CANCELLED" },
];
const PAGE_SIZE_OPTIONS = [15, 20, 50, 100];

function text(value: unknown, fallback = ""): string {
  return value === undefined || value === null ? fallback : String(value);
}

function statusTag(status: InboundDocument["status"]) {
  const color =
    status === "POSTED"
      ? "success"
      : status === "SCANNING"
        ? "processing"
        : status === "CANCELLED"
          ? "error"
          : "warning";
  return <Tag color={color}>{status}</Tag>;
}

function useInboundPermission(code: string) {
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  return hasAnyWmsPermission(permissionCodes, [code], isSuperAdmin);
}

function toInboundLinePayload(lines: InboundDraftFormValues["lines"]): InboundLinePayload[] {
  return lines.map((line) => {
    const payload: InboundLinePayload = {
      product_id: line.product_id,
      qty_planned: Number(line.qty_planned),
      note: line.note?.trim() || null,
    };
    if (line.id) payload.id = line.id;
    if (line.import_batch_id !== undefined) payload.import_batch_id = line.import_batch_id;
    return payload;
  });
}

function backendFieldPath(key: string): InboundDraftFieldPath | null {
  const direct: Record<string, InboundDraftFieldPath> = {
    doc_date: ["documentDate"],
    dst_warehouse_id: ["warehouseId"],
    source_name: ["sourceName"],
    note: ["note"],
  };
  if (direct[key]) return direct[key];
  const match = key.match(/^lines\.(\d+)\.(product_id|qty_planned|note|import_batch_id)$/);
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
    .filter((field): field is { name: InboundDraftFieldPath; errors: string[] } => Boolean(field));
  if (fields.length) form.setFields(fields);
}

function ApiErrorAlert({ error, fallback }: { error: unknown; fallback: string }) {
  const normalized = normalizeError(error);
  const requestId = getErrorRequestId(error);
  return (
    <Alert
      showIcon
      type={normalized.status === 403 ? "warning" : "error"}
      message={normalized.status === 403 ? "Không có quyền truy cập" : getApiErrorMessage(error, fallback)}
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

function InboundDraftModal({ documentId, onClose, onSaved }: DraftModalProps) {
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
  const hasScanEvidence = Boolean(detail?.lines.some((line) => line.scanned > 0));
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
          label: [text(warehouse.code), text(warehouse.name)].filter(Boolean).join(" · ") || id,
        };
      }),
    [warehouseRows],
  );

  const handleSave = async (values: InboundDraftFormValues) => {
    if (!canCreate || !isMutable) return;
    const lines = values.lines ?? [];
    if (lines.length === 0) {
      message.error("Phiếu nhập phải có ít nhất một dòng SKU.");
      return;
    }
    const invalidExpected = lines.some((line) => {
      const expected = Number(line.qty_planned);
      const scanned = Number(line.scanned_qty ?? 0);
      return !Number.isInteger(expected) || expected < 1 || expected < scanned;
    });
    if (invalidExpected) {
      message.error("Expected qty phải là số nguyên dương và không được nhỏ hơn số đã scan.");
      return;
    }

    try {
      const normalizedLines = toInboundLinePayload(lines);
      if (documentId) {
        if (!detail) return;
        const payload: UpdateInboundPayload = {
          doc_date: values.documentDate || null,
          source_name: values.sourceName?.trim() || null,
          note: values.note?.trim() || null,
          lines: normalizedLines,
        };
        const updated = await updateMutation.mutateAsync({
          id: documentId,
          payload,
          ifMatch: detail.document.version,
        });
        message.success(
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
        source_name: values.sourceName?.trim() || null,
        note: values.note?.trim() || null,
        lines: normalizedLines,
      };
      const created = await createMutation.mutateAsync(payload);
      message.success("Đã tạo phiếu nhập DRAFT. Chưa phát sinh biến động tồn kho.");
      onSaved(created.id);
    } catch (error) {
      applyBackendErrors(form, error);
      message.error(getApiErrorMessage(error, "Không lưu được phiếu nhập."));
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
      maskClosable={false}
      closable={!saving}
      destroyOnHidden
    >
      <Space wrap style={{ marginBottom: 12 }}>
        <Tag color="blue">POST / PATCH /inbound-documents</Tag>
        <Tag color="gold">inbound.create</Tag>
        <Tag>Full-post only</Tag>
      </Space>

      {detailQuery.isError ? (
        <div style={{ marginBottom: 14 }}>
          <ApiErrorAlert error={detailQuery.error} fallback="Không tải được phiếu nhập." />
        </div>
      ) : null}

      {documentId && detail && !isMutable ? (
        <Alert
          showIcon
          type={detail.document.status === "POSTED" ? "success" : "info"}
          style={{ marginBottom: 14 }}
          message={
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
          style={{ marginBottom: 14 }}
          message="Phiếu đã có scan evidence"
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
                    <Input value={detail?.document.code || "Tự sinh sau khi lưu"} disabled />
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
                    <Input maxLength={255} disabled={!isMutable} placeholder="Nhà cung cấp / nguồn nhập" />
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  <Form.Item
                    label="Kho nhận"
                    name="warehouseId"
                    rules={[{ required: true, message: "Chọn kho nhận ACTIVE." }]}
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
                    <Input.TextArea rows={3} maxLength={2000} showCount disabled={!isMutable} />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card size="small" title="Quy tắc nhập kho bắt buộc">
              <Space direction="vertical" size={10}>
                <div>• Expected qty là toàn bộ số lượng phải nhận của từng dòng.</div>
                <div>• DRAFT/SCANNING, scan và đăng ký BOX đều stock-neutral.</div>
                <div>• Không có partial, thiếu/thừa, remainder hoặc PARTIALLY_POSTED.</div>
                <div>• Scan sai SKU/state, trùng hoặc vượt Expected phải bị từ chối.</div>
                <div>• Chỉ Full Post khi mọi dòng scanned_qty = expected_qty.</div>
                <div>• COMPONENT putaway sau Receipt không được cộng tồn lần hai.</div>
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
                  locale={{ emptyText: "Phiếu nhập phải có ít nhất một dòng SKU" }}
                  columns={[
                    {
                      title: "SKU",
                      width: 300,
                      render: (_, field) => {
                        const line = watchedLines[field.name];
                        const sku = skuRows.find((item) => item.sku_id === line?.product_id);
                        return (
                          <>
                            <Form.Item name={[field.name, "id"]} hidden><Input /></Form.Item>
                            <Form.Item name={[field.name, "scanned_qty"]} hidden><Input /></Form.Item>
                            <Form.Item name={[field.name, "import_batch_id"]} hidden><Input /></Form.Item>
                            {canEditStructure ? (
                              <Form.Item
                                name={[field.name, "product_id"]}
                                rules={[{ required: true, message: "Chọn SKU." }]}
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
                                <Form.Item name={[field.name, "product_id"]} hidden><Input /></Form.Item>
                                <strong>{sku?.sku_code ?? line?.product_id ?? "-"}</strong>
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
                        const sku = skuRows.find((item) => item.sku_id === line?.product_id);
                        return (
                          <div>
                            <div>{sku?.sku_name ?? "-"}</div>
                            {sku?.sku_type ? <Tag style={{ marginTop: 4 }}>{sku.sku_type}</Tag> : null}
                          </div>
                        );
                      },
                    },
                    {
                      title: "Expected qty",
                      width: 150,
                      render: (_, field) => {
                        const scanned = Number(watchedLines[field.name]?.scanned_qty ?? 0);
                        return (
                          <Form.Item
                            name={[field.name, "qty_planned"]}
                            rules={[
                              { required: true, message: "Nhập Expected." },
                              {
                                validator: (_, value) => {
                                  const expected = Number(value);
                                  if (!Number.isInteger(expected) || expected < 1) {
                                    return Promise.reject(new Error("Số nguyên > 0."));
                                  }
                                  if (expected < scanned) {
                                    return Promise.reject(new Error(`Không nhỏ hơn ${scanned}.`));
                                  }
                                  return Promise.resolve();
                                },
                              },
                            ]}
                            style={{ marginBottom: 0 }}
                          >
                            <InputNumber min={Math.max(1, scanned)} precision={0} disabled={!isMutable} style={{ width: "100%" }} />
                          </Form.Item>
                        );
                      },
                    },
                    {
                      title: "Đã scan",
                      width: 120,
                      align: "right",
                      render: (_, field) => {
                        const scanned = Number(watchedLines[field.name]?.scanned_qty ?? 0);
                        return scanned > 0 ? <Tag color="processing">{scanned}</Tag> : <span>0</span>;
                      },
                    },
                    {
                      title: "Ghi chú dòng",
                      width: 220,
                      render: (_, field) => (
                        <Form.Item name={[field.name, "note"]} style={{ marginBottom: 0 }}>
                          <Input maxLength={2000} disabled={!isMutable} placeholder="Tùy chọn" />
                        </Form.Item>
                      ),
                    },
                    {
                      title: "",
                      width: 80,
                      fixed: "right",
                      render: (_, field) =>
                        canEditStructure && fields.length > 1 ? (
                          <Button danger type="link" size="small" onClick={() => remove(field.name)}>
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
                    onClick={() => add({ product_id: "", qty_planned: 1, scanned_qty: 0, note: null })}
                  >
                    Thêm dòng SKU
                  </Button>
                ) : null}
              </>
            )}
          </Form.List>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
            <Button disabled={saving} onClick={onClose}>
              {isMutable ? "Hủy thao tác" : "Đóng"}
            </Button>
            {isMutable ? (
              <Button
                type="primary"
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

function InboundListScreen() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftDocumentId, setDraftDocumentId] = useState<string | null>(null);
  const [scanDocumentId, setScanDocumentId] = useState<string | null>(null);
  const canCreate = useInboundPermission(P.INBOUND_CREATE);
  const canScan = useInboundPermission(P.INBOUND_SCAN);
  const query = useInboundDocuments({ search: search || undefined, status, page, per_page: perPage });
  const rows = query.data?.data ?? [];
  const meta = query.data?.meta;
  const total = Number(meta?.total ?? rows.length);

  useEffect(() => {
    const requestedScreen = searchParams.get("screen");
    if (requestedScreen !== "IN-02" && requestedScreen !== "IN-03") return;
    const id = searchParams.get("id");
    if (requestedScreen === "IN-02") {
      setDraftDocumentId(id);
      setDraftOpen(true);
    } else if (id) {
      setScanDocumentId(id);
    }
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("screen", "IN-01");
    nextParams.delete("id");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const openCreateModal = () => {
    setDraftDocumentId(null);
    setDraftOpen(true);
  };
  const openEditModal = (documentId: string) => {
    setDraftDocumentId(documentId);
    setDraftOpen(true);
  };
  const closeDraftModal = () => {
    setDraftOpen(false);
    setDraftDocumentId(null);
  };
  const handleSaved = (documentId: string) => {
    closeDraftModal();
    setScanDocumentId(documentId);
  };
  const openExpectedCorrectionFromScan = (documentId: string) => {
    setScanDocumentId(null);
    openEditModal(documentId);
  };

  const columns: ColumnsType<InboundDocument> = [
    {
      title: "Phiếu nhập",
      dataIndex: "code",
      key: "code",
      width: 180,
      fixed: "left",
      render: (value: string, row) => <strong>{value || row.id}</strong>,
    },
    {
      title: "Nguồn / tham chiếu",
      dataIndex: "source",
      key: "source",
      width: 220,
      render: (value: string) => value || "-",
    },
    {
      title: "Tiến độ scan",
      key: "progress",
      width: 220,
      render: (_, row) => {
        const percent = row.expected > 0 ? Math.min(100, Math.round((row.scanned / row.expected) * 100)) : 0;
        return (
          <div style={{ minWidth: 170 }}>
            <Progress percent={percent} size="small" status={row.status === "POSTED" ? "success" : "normal"} />
            <span style={{ fontSize: 12 }}>{row.scanned} / {row.expected}</span>
          </div>
        );
      },
    },
    { title: "Trạng thái", dataIndex: "status", width: 130, render: statusTag },
    {
      title: "Cập nhật",
      key: "updatedAt",
      width: 180,
      render: (_, row) => row.updatedAt ?? row.date ?? "-",
    },
    {
      title: "Hành động",
      key: "actions",
      width: 250,
      fixed: "right",
      render: (_, row) => {
        const mutable = row.status === "DRAFT" || row.status === "SCANNING";
        return (
          <Space size={4} wrap>
            {canCreate && mutable ? (
              <Tooltip title={row.status === "SCANNING" ? "Hiệu chỉnh Expected an toàn" : "Sửa phiếu DRAFT"}>
                <Button size="small" icon={<EditOutlined />} onClick={() => openEditModal(row.id)}>
                  {row.status === "SCANNING" ? "Expected" : "Sửa"}
                </Button>
              </Tooltip>
            ) : null}
            <Button
              type={mutable && canScan ? "primary" : "default"}
              size="small"
              icon={mutable && canScan ? <ScanOutlined /> : <EyeOutlined />}
              onClick={() => setScanDocumentId(row.id)}
            >
              {mutable && canScan
                ? row.status === "DRAFT"
                  ? "Bắt đầu quét"
                  : "Tiếp tục quét"
                : "Xem"}
            </Button>
          </Space>
        );
      },
    },
  ];

  const handleTableChange = (pagination: TablePaginationConfig) => {
    setPage(pagination.current ?? 1);
    setPerPage(pagination.pageSize ?? perPage);
  };

  return (
    <div className="inbound-page">
      <div className="page-heading">
        <div><h1>Danh sách phiếu nhập</h1></div>
        <Space wrap>
          
          <Button type="primary" icon={<PlusOutlined />} disabled={!canCreate} onClick={openCreateModal}>
            Tạo phiếu nhập
          </Button>
        </Space>
      </div>

      <Card className="master-data-panel">
        <Space wrap style={{ marginBottom: 12 }}>
          <Tag color="blue">GET /inbound-documents</Tag>
          <Tag color="gold">inbound.view / create / scan / post</Tag>
          <Tag>Full-post only</Tag>
        </Space>

        <Row gutter={[12, 12]} style={{ marginBottom: 14 }}>
          <Col xs={24} md={10}>
            <Input.Search
              allowClear
              placeholder="Tìm mã phiếu / nguồn nhập"
              onSearch={(value) => {
                setSearch(value.trim());
                setPage(1);
              }}
              onChange={(event) => {
                if (!event.target.value) {
                  setSearch("");
                  setPage(1);
                }
              }}
            />
          </Col>
          <Col xs={12} md={5}>
            <Select
              allowClear
              className="full-width"
              placeholder="Trạng thái"
              options={STATUS_OPTIONS}
              value={status}
              onChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
            />
          </Col>
          <Col xs={12} md={4}>
            <Button className="full-width" onClick={() => { setSearch(""); setStatus(undefined); setPage(1); }}>
              Xóa lọc
            </Button>
          </Col>
        </Row>

        <Alert
          showIcon
          type="info"
          style={{ marginBottom: 14 }}
          message="Luồng chuẩn: DRAFT → SCANNING → Full Post Receipt → POSTED"
          description="DRAFT/SCANNING và mọi scan đều stock-neutral. Chỉ Full Post khi mọi dòng đủ chính xác; COMPONENT sau Post mới đi Putaway và Putaway không đổi tồn."
        />

        {query.isError ? (
          <div style={{ marginBottom: 14 }}>
            <ApiErrorAlert error={query.error} fallback="Không tải được danh sách phiếu nhập." />
          </div>
        ) : null}

        <Table<InboundDocument>
          rowKey="id"
          columns={columns}
          dataSource={rows}
          loading={query.isLoading || query.isFetching}
          onChange={handleTableChange}
          pagination={{
            current: Number(meta?.current_page ?? page),
            pageSize: perPage,
            total,
            showSizeChanger: true,
            pageSizeOptions: PAGE_SIZE_OPTIONS.map(String),
            showTotal: (count, range) => `${range[0]}-${range[1]} / ${count} phiếu`,
          }}
          locale={{ emptyText: query.isError ? "Không tải được dữ liệu" : "Chưa có phiếu nhập phù hợp" }}
          scroll={{ x: 1180 }}
        />
      </Card>

      {draftOpen ? (
        <InboundDraftModal documentId={draftDocumentId} onClose={closeDraftModal} onSaved={handleSaved} />
      ) : null}

      {scanDocumentId ? (
        <InboundScanModal
          documentId={scanDocumentId}
          onClose={() => setScanDocumentId(null)}
          onChanged={() => void query.refetch()}
          onEditExpected={() => openExpectedCorrectionFromScan(scanDocumentId)}
        />
      ) : null}
    </div>
  );
}

export default function InboundPage() {
  return <InboundListScreen />;
}
