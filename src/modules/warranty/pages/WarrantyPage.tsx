/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Drawer,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Timeline,
  Tooltip,
  Typography,
  message,
} from "antd";
import type { TableProps } from "antd";
import {
  EyeOutlined,
  HistoryOutlined,
  PlusOutlined,
  PrinterOutlined,
  ReloadOutlined,
  SearchOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import { useCanAny } from "@/shared/components/permission";
import {
  extractFieldErrorsRaw,
  getApiErrorMessage,
  getErrorRequestId,
  normalizeError,
} from "@/shared/api/api-error";
import {
  createWarrantyCase,
  fetchWarrantyCase,
  fetchWarrantyCaseEvents,
  fetchWarrantyCases,
  updateWarrantyCaseStatus,
} from "@/modules/warranty/services/warrantyService";
import type {
  CreateWarrantyCaseRequest,
  WarrantyCase,
  WarrantyCaseStatus,
  WarrantyEvent,
  WarrantyIdentificationType,
  WarrantyPriority,
} from "@/modules/warranty/types";

type WarrantyFilters = {
  search?: string;
  identification_type?: WarrantyIdentificationType;
  defect_code?: string;
  status?: WarrantyCaseStatus;
  scope?: string;
};

type CreateWarrantyForm = {
  identification_type: WarrantyIdentificationType;
  item_code?: string;
  sku?: string;
  customer_name: string;
  customer_phone: string;
  agency_name?: string;
  defect_code: string;
  defect_description: string;
  missing_code_reason?: string;
  manual_product_description?: string;
  priority?: WarrantyPriority;
  consent_contact?: boolean;
  consent_photo?: boolean;
  notes?: string;
};

const baselineStatuses: WarrantyCaseStatus[] = [
  "RECEIVED",
  "CHECKING",
  "REPAIRING",
  "COMPLETED",
  "RETURNED",
  "CANCELLED",
];

const statusColorMap: Record<string, string> = {
  RECEIVED: "default",
  OPEN: "default",
  CHECKING: "processing",
  PROCESSING: "processing",
  REPAIRING: "warning",
  WAITING_PARTS: "blue",
  COMPLETED: "success",
  READY: "success",
  RETURNED: "success",
  RETURNED_TO_CUSTOMER: "success",
  CLOSED: "default",
  CANCELLED: "error",
};

const terminalStatuses: WarrantyCaseStatus[] = [
  "RETURNED",
  "RETURNED_TO_CUSTOMER",
  "CLOSED",
  "CANCELLED",
];

const nextStatusMap: Partial<Record<WarrantyCaseStatus, WarrantyCaseStatus[]>> =
  {
    RECEIVED: ["CHECKING", "CANCELLED"],
    OPEN: ["CHECKING", "PROCESSING", "CANCELLED"],
    CHECKING: ["REPAIRING", "CANCELLED"],
    PROCESSING: ["REPAIRING", "WAITING_PARTS", "CANCELLED"],
    WAITING_PARTS: ["REPAIRING", "CANCELLED"],
    REPAIRING: ["COMPLETED", "CANCELLED"],
    READY: ["RETURNED_TO_CUSTOMER", "RETURNED"],
    COMPLETED: ["RETURNED", "RETURNED_TO_CUSTOMER"],
  };

const statusLabels: Record<string, string> = {
  RECEIVED: "Da tiep nhan",
  OPEN: "Mo case",
  CHECKING: "Dang kiem tra",
  PROCESSING: "Dang xu ly",
  WAITING_PARTS: "Cho linh kien",
  REPAIRING: "Dang sua chua",
  COMPLETED: "Da hoan tat xu ly",
  READY: "San sang tra",
  RETURNED: "Da tra khach",
  RETURNED_TO_CUSTOMER: "Da tra khach",
  CLOSED: "Da dong",
  CANCELLED: "Da huy",
};

const priorityColorMap: Record<WarrantyPriority, string> = {
  LOW: "default",
  MEDIUM: "blue",
  HIGH: "warning",
  URGENT: "error",
};

const defectOptions = [
  { value: "POWER", label: "Nguon/dien" },
  { value: "SCREEN", label: "Man hinh/hien thi" },
  { value: "KEYBOARD", label: "Ban phim/phim bam" },
  { value: "SOFTWARE", label: "Phan mem" },
  { value: "OTHER", label: "Khac" },
];

function compactParams(filters: WarrantyFilters) {
  return Object.fromEntries(
    Object.entries(filters).filter(
      ([, value]) => value !== undefined && value !== "",
    ),
  );
}

function formatDateTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN");
}

function caseAgeDays(record: WarrantyCase) {
  if (typeof record.case_age_days === "number") return record.case_age_days;
  const received = new Date(record.received_at).getTime();
  if (!Number.isFinite(received)) return undefined;
  return Math.max(0, Math.floor((Date.now() - received) / 86_400_000));
}

function maskPhone(phone?: string) {
  if (!phone) return "-";
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) return "****";
  return `${digits.slice(0, 3)}****${digits.slice(-3)}`;
}

function maskName(name?: string) {
  if (!name || name === "-") return "-";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return `${parts[0][0] ?? "*"}***`;
  return `${parts[0]} ${parts
    .slice(1)
    .map((part) => `${part[0] ?? "*"}.`)
    .join(" ")}`;
}

function piiName(record: WarrantyCase, canViewPii: boolean) {
  if (canViewPii) return record.customer_name;
  return record.masked_customer_name ?? maskName(record.customer_name);
}

function piiPhone(record: WarrantyCase, canViewPii: boolean) {
  if (canViewPii) return record.customer_phone ?? "-";
  return record.masked_customer_phone ?? maskPhone(record.customer_phone);
}

function machineDisplay(record: WarrantyCase) {
  if (record.identification_type === "TEMP_ONLY") {
    return (
      record.temporary_item_code ?? record.manual_product_description ?? "-"
    );
  }
  return (
    record.item_code ?? record.serial_number ?? record.physical_code ?? "-"
  );
}

function makeIdempotencyKey(caseId: string, status: string) {
  return (
    globalThis.crypto?.randomUUID?.() ?? `${caseId}-${status}-${Date.now()}`
  );
}

export default function WarrantyPage() {
  const [form] = Form.useForm<CreateWarrantyForm>();
  const [statusForm] = Form.useForm<{
    status: WarrantyCaseStatus;
    reason?: string;
  }>();
  const [filters, setFilters] = useState<WarrantyFilters>({});
  const [searchInput, setSearchInput] = useState("");
  const [cases, setCases] = useState<WarrantyCase[]>([]);
  const [events, setEvents] = useState<WarrantyEvent[]>([]);
  const [selectedCase, setSelectedCase] = useState<WarrantyCase | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [eventLoading, setEventLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [formError, setFormError] = useState("");
  const [statusError, setStatusError] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [createdTempCode, setCreatedTempCode] = useState<string>();
  const [reloadKey, setReloadKey] = useState(0);
  const canViewPii = useCanAny(["warranty.pii.view", "WARRANTY_PII_VIEW"]);
  const canManageWarranty = useCanAny(["warranty.manage", "WARRANTY_MANAGE"]);

  const loadCases = useCallback(() => {
    let active = true;
    setLoading(true);
    setListError("");
    fetchWarrantyCases({ ...compactParams(filters), per_page: 20 })
      .then((rows) => {
        if (!active) return;
        setCases(rows);
        if (selectedCase && !rows.some((row) => row.id === selectedCase.id)) {
          setSelectedCase(null);
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        setCases([]);
        setListError(
          getApiErrorMessage(error, "Khong tai duoc danh sach bao hanh."),
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [filters, selectedCase]);

  useEffect(() => loadCases(), [loadCases, reloadKey]);

  const loadEvents = useCallback((caseId: string) => {
    setEventLoading(true);
    fetchWarrantyCaseEvents(caseId)
      .then(setEvents)
      .catch((error: unknown) => {
        const requestId = getErrorRequestId(error);
        message.error(
          `${getApiErrorMessage(error, "Khong tai duoc timeline.")}${
            requestId ? ` - Request ${requestId}` : ""
          }`,
        );
        setEvents([]);
      })
      .finally(() => setEventLoading(false));
  }, []);

  const openDetail = useCallback((record: WarrantyCase) => {
    setSelectedCase(record);
    setDrawerOpen(true);
    setDetailError("");
    setDetailLoading(true);
    setEvents([]);
    Promise.all([
      fetchWarrantyCase(record.id),
      fetchWarrantyCaseEvents(record.id),
    ])
      .then(([detail, timeline]) => {
        setSelectedCase(detail);
        setCases((current) =>
          current.map((row) => (row.id === detail.id ? detail : row)),
        );
        setEvents(timeline);
      })
      .catch((error: unknown) => {
        setDetailError(
          getApiErrorMessage(error, "Khong tai duoc chi tiet case."),
        );
      })
      .finally(() => setDetailLoading(false));
  }, []);

  const submitCreate = async () => {
    setFormError("");
    setCreatedTempCode(undefined);
    try {
      const values = await form.validateFields();
      const payload: CreateWarrantyCaseRequest = {
        identification_type: values.identification_type,
        customer_name: values.customer_name.trim(),
        customer_phone: values.customer_phone.trim(),
        defect_code: values.defect_code,
        defect_description: values.defect_description.trim(),
        priority: values.priority ?? "MEDIUM",
        agency_name: values.agency_name?.trim(),
        notes: values.notes?.trim(),
        consent_contact: values.consent_contact,
        consent_photo: values.consent_photo,
        ...(values.identification_type === "IDENTIFIED"
          ? {
              item_code: values.item_code?.trim(),
              sku: values.sku?.trim(),
            }
          : {
              missing_code_reason: values.missing_code_reason?.trim(),
              manual_product_description:
                values.manual_product_description?.trim(),
            }),
      };

      setSubmitLoading(true);
      const created = await createWarrantyCase(payload);
      message.success("Da tao case bao hanh.");
      form.resetFields();
      setCreateOpen(false);
      setCreatedTempCode(created.temporary_item_code);
      setSelectedCase(created);
      setDrawerOpen(true);
      setReloadKey((value) => value + 1);
      loadEvents(created.id);
    } catch (error: unknown) {
      if (error && typeof error === "object" && "errorFields" in error) return;
      const fieldErrors = extractFieldErrorsRaw(error);
      if (fieldErrors) {
        form.setFields(
          Object.entries(fieldErrors).map(([name, errors]) => ({
            name: [name] as never,
            errors: [errors],
          })),
        );
      }
      const normalized = normalizeError(error);
      const requestId = getErrorRequestId(error);
      setFormError(
        `${normalized.message}${requestId ? ` - Request ${requestId}` : ""}`,
      );
    } finally {
      setSubmitLoading(false);
    }
  };

  const submitStatusUpdate = async () => {
    if (!selectedCase) return;
    setStatusError("");
    try {
      const values = await statusForm.validateFields();
      setStatusLoading(true);
      const updated = await updateWarrantyCaseStatus(selectedCase.id, {
        status: values.status,
        reason: values.reason?.trim(),
        idempotency_key: makeIdempotencyKey(selectedCase.id, values.status),
      });
      message.success("Da cap nhat trang thai bao hanh.");
      statusForm.resetFields();
      setStatusOpen(false);
      setSelectedCase(updated);
      setCases((current) =>
        current.map((row) => (row.id === updated.id ? updated : row)),
      );
      loadEvents(updated.id);
      setReloadKey((value) => value + 1);
    } catch (error: unknown) {
      if (error && typeof error === "object" && "errorFields" in error) return;
      const fieldErrors = extractFieldErrorsRaw(error);
      if (fieldErrors) {
        statusForm.setFields(
          Object.entries(fieldErrors).map(([name, errors]) => ({
            name: [name] as never,
            errors: [errors],
          })),
        );
      }
      const requestId = getErrorRequestId(error);
      setStatusError(
        `${getApiErrorMessage(error, "Khong cap nhat duoc trang thai.")}${
          requestId ? ` - Request ${requestId}` : ""
        }`,
      );
    } finally {
      setStatusLoading(false);
    }
  };

  const columns: TableProps<WarrantyCase>["columns"] = useMemo(
    () => [
      {
        title: "Ma case",
        dataIndex: "case_code",
        key: "case_code",
        fixed: "left",
        render: (value: string, record) => (
          <Button type="link" onClick={() => openDetail(record)}>
            {value || record.id}
          </Button>
        ),
      },
      {
        title: "Dinh danh",
        dataIndex: "identification_type",
        key: "identification_type",
        render: (value: WarrantyIdentificationType) => (
          <Tag color={value === "TEMP_ONLY" ? "warning" : "blue"}>{value}</Tag>
        ),
      },
      {
        title: "May/item",
        key: "machine",
        render: (_, record) => machineDisplay(record),
      },
      { title: "SKU/model", dataIndex: "sku_name", key: "sku_name" },
      {
        title: "Khach gui",
        key: "customer",
        render: (_, record) => (
          <Space direction="vertical" size={0}>
            <Typography.Text>{piiName(record, canViewPii)}</Typography.Text>
            <Typography.Text type="secondary">
              {piiPhone(record, canViewPii)}
            </Typography.Text>
          </Space>
        ),
      },
      {
        title: "Benh/loi",
        key: "defect",
        render: (_, record) => record.defect || record.defect_code || "-",
      },
      {
        title: "Ngay nhan",
        dataIndex: "received_at",
        key: "received_at",
        render: formatDateTime,
      },
      {
        title: "Trang thai",
        dataIndex: "status",
        key: "status",
        render: (value: WarrantyCaseStatus) => (
          <Tag color={statusColorMap[value]}>
            {statusLabels[value] ?? value}
          </Tag>
        ),
      },
      {
        title: "Tuoi case",
        key: "age",
        align: "right",
        render: (_, record) => {
          const age = caseAgeDays(record);
          return age === undefined ? "-" : `${age} ngay`;
        },
      },
      {
        title: "Thao tac",
        key: "action",
        fixed: "right",
        render: (_, record) => (
          <Space>
            <Tooltip title="Mo chi tiet">
              <Button
                type="text"
                icon={<EyeOutlined />}
                onClick={() => openDetail(record)}
              />
            </Tooltip>
            <Tooltip title="Cap nhat trang thai">
              <Button
                type="text"
                icon={<ToolOutlined />}
                disabled={
                  !canManageWarranty || terminalStatuses.includes(record.status)
                }
                onClick={() => {
                  setSelectedCase(record);
                  statusForm.setFieldsValue({
                    status: nextStatusMap[record.status]?.[0],
                  });
                  setStatusOpen(true);
                }}
              />
            </Tooltip>
            {record.identification_type === "TEMP_ONLY" && (
              <Tooltip title="Hien thi ma tam">
                <Button
                  type="text"
                  icon={<PrinterOutlined />}
                  onClick={() => {
                    Modal.info({
                      title: "Ma tam TEMP_ONLY",
                      content:
                        record.temporary_item_code ?? "BE chua tra ma tam.",
                    });
                  }}
                />
              </Tooltip>
            )}
          </Space>
        ),
      },
    ],
    [canManageWarranty, canViewPii, openDetail, statusForm],
  );

  const nextStatuses = selectedCase
    ? (nextStatusMap[selectedCase.status] ?? [])
    : [];
  const identificationType = Form.useWatch("identification_type", form);
  const statusValue = Form.useWatch("status", statusForm);

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="Bao hanh"
        extra={
          <Space wrap>
            <Input
              prefix={<SearchOutlined />}
              allowClear
              placeholder="Case/item/serial/SKU/SDT..."
              value={searchInput}
              style={{ width: 260 }}
              onChange={(event) => {
                setSearchInput(event.target.value);
                if (!event.target.value) {
                  setFilters((current) => ({ ...current, search: undefined }));
                }
              }}
              onPressEnter={() =>
                setFilters((current) => ({
                  ...current,
                  search: searchInput.trim() || undefined,
                }))
              }
            />
            <Select
              allowClear
              placeholder="Dinh danh"
              style={{ width: 150 }}
              value={filters.identification_type}
              onChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  identification_type: value,
                }))
              }
              options={[
                { value: "IDENTIFIED", label: "IDENTIFIED" },
                { value: "TEMP_ONLY", label: "TEMP_ONLY" },
              ]}
            />
            <Select
              allowClear
              placeholder="Benh/loi"
              style={{ width: 150 }}
              value={filters.defect_code}
              onChange={(value) =>
                setFilters((current) => ({ ...current, defect_code: value }))
              }
              options={defectOptions}
            />
            <Select
              allowClear
              placeholder="Trang thai"
              style={{ width: 190 }}
              value={filters.status}
              onChange={(value) =>
                setFilters((current) => ({ ...current, status: value }))
              }
              options={baselineStatuses.map((value) => ({
                value,
                label: statusLabels[value],
              }))}
            />
            <Input
              allowClear
              placeholder="Kho/scope"
              value={filters.scope}
              style={{ width: 150 }}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  scope: event.target.value || undefined,
                }))
              }
            />
            <Tooltip title="Tai lai">
              <Button
                icon={<ReloadOutlined />}
                onClick={() => setReloadKey((value) => value + 1)}
              />
            </Tooltip>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              disabled={!canManageWarranty}
              onClick={() => {
                form.resetFields();
                form.setFieldsValue({
                  identification_type: "IDENTIFIED",
                  priority: "MEDIUM",
                  consent_contact: true,
                  consent_photo: false,
                });
                setCreatedTempCode(undefined);
                setFormError("");
                setCreateOpen(true);
              }}
            >
              Tiep nhan bao hanh
            </Button>
          </Space>
        }
      >
        {!canViewPii && (
          <Alert
            type="info"
            showIcon
            message="Thong tin khach hang dang duoc mask theo quyen warranty.pii.view."
            style={{ marginBottom: 12 }}
          />
        )}
        {listError && (
          <Alert
            type="error"
            showIcon
            message={listError}
            action={
              <Button
                size="small"
                onClick={() => setReloadKey((value) => value + 1)}
              >
                Thu lai
              </Button>
            }
            style={{ marginBottom: 12 }}
          />
        )}
        <Table
          dataSource={cases}
          columns={columns}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={{ pageSize: 10, showSizeChanger: true }}
          scroll={{ x: 1200 }}
          locale={{
            emptyText: listError
              ? "Khong the hien thi du lieu do loi API/quyen."
              : "Khong co case bao hanh theo bo loc hien tai.",
          }}
          rowClassName={(record) =>
            record.id === selectedCase?.id ? "ant-table-row-selected" : ""
          }
          onRow={(record) => ({ onDoubleClick: () => openDetail(record) })}
        />
      </Card>

      <Drawer
        title={selectedCase?.case_code ?? "Chi tiet bao hanh"}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={920}
        extra={
          selectedCase && (
            <Space>
              <Tag color={statusColorMap[selectedCase.status]}>
                {statusLabels[selectedCase.status] ?? selectedCase.status}
              </Tag>
              <Button
                icon={<HistoryOutlined />}
                loading={eventLoading}
                onClick={() => loadEvents(selectedCase.id)}
              >
                Tai timeline
              </Button>
              <Button
                type="primary"
                icon={<ToolOutlined />}
                disabled={
                  !canManageWarranty ||
                  terminalStatuses.includes(selectedCase.status) ||
                  nextStatuses.length === 0
                }
                onClick={() => {
                  statusForm.setFieldsValue({ status: nextStatuses[0] });
                  setStatusError("");
                  setStatusOpen(true);
                }}
              >
                Cap nhat
              </Button>
            </Space>
          )
        }
      >
        {detailError && (
          <Alert
            type="error"
            showIcon
            message={detailError}
            style={{ marginBottom: 12 }}
          />
        )}
        {createdTempCode && (
          <Alert
            type="success"
            showIcon
            message={`Ma tam duoc BE sinh: ${createdTempCode}`}
            style={{ marginBottom: 12 }}
          />
        )}
        {selectedCase && (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Descriptions bordered size="small" column={{ xs: 1, md: 2 }}>
              <Descriptions.Item label="Ma case">
                {selectedCase.case_code}
              </Descriptions.Item>
              <Descriptions.Item label="Dinh danh">
                <Tag
                  color={
                    selectedCase.identification_type === "TEMP_ONLY"
                      ? "warning"
                      : "blue"
                  }
                >
                  {selectedCase.identification_type}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Priority">
                <Tag color={priorityColorMap[selectedCase.priority]}>
                  {selectedCase.priority}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Ngay nhan">
                {formatDateTime(selectedCase.received_at)}
              </Descriptions.Item>
              <Descriptions.Item label="Du kien tra">
                {formatDateTime(selectedCase.expected_return_at)}
              </Descriptions.Item>
              <Descriptions.Item label="Ngay tra">
                {formatDateTime(selectedCase.returned_at)}
              </Descriptions.Item>
            </Descriptions>

            {selectedCase.identification_type === "TEMP_ONLY" && (
              <Alert
                type="warning"
                showIcon
                message="TEMP_ONLY khong lien ket item goc, khong xac nhan lich su ban hang va khong sinh stock movement."
              />
            )}

            <Descriptions
              title="Thong tin may"
              bordered
              size="small"
              column={{ xs: 1, md: 2 }}
            >
              <Descriptions.Item label="Item/serial/ma tam">
                {machineDisplay(selectedCase)}
              </Descriptions.Item>
              <Descriptions.Item label="SKU/model">
                {selectedCase.sku || selectedCase.sku_name}
              </Descriptions.Item>
              <Descriptions.Item label="Trang thai item">
                {selectedCase.item_status ?? "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Kho/scope">
                {selectedCase.warehouse_name ?? selectedCase.agency_name ?? "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Ly do mat/khong co ma">
                {selectedCase.missing_code_reason ?? "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Mo ta nhan dien may">
                {selectedCase.manual_product_description ?? "-"}
              </Descriptions.Item>
            </Descriptions>

            <Descriptions
              title="Khach hang va loi"
              bordered
              size="small"
              column={{ xs: 1, md: 2 }}
            >
              <Descriptions.Item label="Khach gui">
                {piiName(selectedCase, canViewPii)}
              </Descriptions.Item>
              <Descriptions.Item label="SDT">
                {piiPhone(selectedCase, canViewPii)}
              </Descriptions.Item>
              <Descriptions.Item label="Benh/loi">
                {selectedCase.defect || selectedCase.defect_code}
              </Descriptions.Item>
              <Descriptions.Item label="Ghi chu">
                {selectedCase.notes ?? "-"}
              </Descriptions.Item>
            </Descriptions>

            <Card
              size="small"
              title="Timeline trang thai"
              loading={detailLoading || eventLoading}
            >
              <Timeline
                items={
                  events.length
                    ? events.map((event) => ({
                        color: statusColorMap[event.to_status] ?? "blue",
                        children: (
                          <Space direction="vertical" size={2}>
                            <Typography.Text strong>
                              {statusLabels[event.to_status] ?? event.to_status}
                            </Typography.Text>
                            <Typography.Text type="secondary">
                              {formatDateTime(event.performed_at)} -{" "}
                              {event.performed_by}
                            </Typography.Text>
                            <Typography.Text>
                              {event.from_status
                                ? `${event.from_status} -> ${event.to_status}`
                                : event.event_type}
                            </Typography.Text>
                            <Typography.Text>
                              {event.description}
                            </Typography.Text>
                          </Space>
                        ),
                      }))
                    : [
                        {
                          color: "gray",
                          children: "Chua co lich su trang thai cho case nay.",
                        },
                      ]
                }
              />
            </Card>
          </Space>
        )}
      </Drawer>

      <Modal
        title="Tiep nhan bao hanh"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={submitCreate}
        okText="Luu case"
        cancelText="Huy"
        confirmLoading={submitLoading}
        width={760}
        destroyOnHidden
      >
        {formError && (
          <Alert
            type="error"
            showIcon
            message={formError}
            style={{ marginBottom: 12 }}
          />
        )}
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            identification_type: "IDENTIFIED",
            priority: "MEDIUM",
            consent_contact: true,
          }}
        >
          <Form.Item
            name="identification_type"
            label="Trang thai dinh danh"
            rules={[{ required: true, message: "Chon trang thai dinh danh." }]}
          >
            <Select
              options={[
                { value: "IDENTIFIED", label: "IDENTIFIED" },
                { value: "TEMP_ONLY", label: "TEMP_ONLY" },
              ]}
            />
          </Form.Item>

          {identificationType === "TEMP_ONLY" ? (
            <Alert
              type="warning"
              showIcon
              message="Case TEMP_ONLY khong gui item_code/item_id goc. Ma tam do BE sinh sau khi luu."
              style={{ marginBottom: 12 }}
            />
          ) : (
            <Alert
              type="info"
              showIcon
              message="Neu BE tra active case/state khong hop le, UI se chan submit va giu du lieu da nhap."
              style={{ marginBottom: 12 }}
            />
          )}

          {identificationType === "TEMP_ONLY" ? (
            <>
              <Form.Item
                name="missing_code_reason"
                label="Ly do mat/khong co ma"
                rules={[{ required: true, message: "Nhap ly do bat buoc." }]}
              >
                <Input.TextArea rows={2} maxLength={300} showCount />
              </Form.Item>
              <Form.Item
                name="manual_product_description"
                label="Mo ta nhan dien may"
                rules={[
                  { required: true, message: "Nhap mo ta may bat buoc." },
                ]}
              >
                <Input.TextArea rows={2} maxLength={500} showCount />
              </Form.Item>
            </>
          ) : (
            <>
              <Form.Item
                name="item_code"
                label="Ma may/item/serial/physical code"
                rules={[
                  { required: true, message: "Nhap ma may can bao hanh." },
                ]}
              >
                <Input placeholder="Quet hoac nhap ma may" />
              </Form.Item>
              <Form.Item name="sku" label="SKU/model">
                <Input placeholder="Nhap neu BE contract yeu cau" />
              </Form.Item>
            </>
          )}

          <Space wrap align="start" style={{ width: "100%" }}>
            <Form.Item
              name="customer_name"
              label="Ten khach gui"
              rules={[{ required: true, message: "Nhap ten khach gui." }]}
              style={{ minWidth: 260, flex: 1 }}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="customer_phone"
              label="So dien thoai"
              rules={[
                { required: true, message: "Nhap so dien thoai." },
                {
                  pattern: /^[0-9+\-\s()]{8,20}$/,
                  message: "So dien thoai chua hop le.",
                },
              ]}
              style={{ minWidth: 220, flex: 1 }}
            >
              <Input />
            </Form.Item>
          </Space>

          <Space wrap align="start" style={{ width: "100%" }}>
            <Form.Item
              name="defect_code"
              label="Benh/loi"
              rules={[{ required: true, message: "Chon benh/loi." }]}
              style={{ minWidth: 220, flex: 1 }}
            >
              <Select options={defectOptions} />
            </Form.Item>
            <Form.Item
              name="priority"
              label="Priority"
              style={{ minWidth: 180, flex: 1 }}
            >
              <Select
                options={["LOW", "MEDIUM", "HIGH", "URGENT"].map((value) => ({
                  value,
                  label: value,
                }))}
              />
            </Form.Item>
          </Space>

          <Form.Item
            name="defect_description"
            label="Mo ta loi ban dau"
            rules={[{ required: true, message: "Nhap mo ta loi ban dau." }]}
          >
            <Input.TextArea rows={3} maxLength={1000} showCount />
          </Form.Item>
          <Space wrap align="start" style={{ width: "100%" }}>
            <Form.Item name="consent_contact" label="Consent lien he">
              <Select
                options={[
                  { value: true, label: "Da co" },
                  { value: false, label: "Chua co" },
                ]}
              />
            </Form.Item>
            <Form.Item name="consent_photo" label="Consent hinh anh">
              <Select
                options={[
                  { value: true, label: "Da co" },
                  { value: false, label: "Chua co/khong ap dung" },
                ]}
              />
            </Form.Item>
          </Space>
          <Form.Item name="notes" label="Ghi chu/handoff">
            <Input.TextArea rows={2} maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Cap nhat trang thai"
        open={statusOpen}
        onCancel={() => setStatusOpen(false)}
        onOk={submitStatusUpdate}
        okText="Cap nhat"
        cancelText="Huy"
        confirmLoading={statusLoading}
        destroyOnHidden
      >
        {statusError && (
          <Alert
            type="error"
            showIcon
            message={statusError}
            style={{ marginBottom: 12 }}
          />
        )}
        {selectedCase && (
          <Alert
            type="info"
            showIcon
            message={`Case ${selectedCase.case_code}: transition hop le duoc gioi han theo status hien tai. FE khong cap nhat ton cuc bo.`}
            style={{ marginBottom: 12 }}
          />
        )}
        <Form form={statusForm} layout="vertical">
          <Form.Item
            name="status"
            label="Trang thai moi"
            rules={[{ required: true, message: "Chon trang thai moi." }]}
          >
            <Select
              options={nextStatuses.map((value) => ({
                value,
                label: statusLabels[value] ?? value,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="reason"
            label="Reason/evidence"
            rules={[
              {
                required: statusValue === "CANCELLED",
                message: "Huy case can reason/evidence.",
              },
            ]}
          >
            <Input.TextArea rows={3} maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
