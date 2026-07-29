import { useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Upload,
  message,
  type TablePaginationConfig,
  type UploadProps,
} from "antd";
import {
  DownloadOutlined,
  EyeOutlined,
  ImportOutlined,
  PlusOutlined,
  ReloadOutlined,
  StopOutlined,
} from "@ant-design/icons";
import type { ColumnsType, TableProps } from "antd/es/table";
import type { UseQueryResult } from "@tanstack/react-query";
import {
  extractFieldErrorsRaw,
  getApiErrorMessage,
  getErrorRequestId,
  normalizeError,
} from "@/shared/api/api-error";
import { ConfirmButton } from "@/shared/components/feedback/ConfirmButton";
import { useHasPermission } from "@/lib/permissions";
import {
  type UseTablePatternReturn,
  useTablePattern,
} from "@/shared/hooks/useTablePattern";
import {
  useCreateSku,
  useImportSkus,
  useItems,
  usePhysicalCodes,
  useSkus,
  useUpdateSkuStatus,
} from "@/modules/master-data/hooks/use-master-data";
import type {
  ImportResult,
  ImportRowError,
  ItemRecord,
  MasterListParams,
  MasterPageResult,
  PhysicalCodeRecord,
  SkuPayload,
  SkuRecord,
} from "@/modules/master-data/types/master-data.types";

const SKU_TYPES = [
  { label: "PRODUCT", value: "PRODUCT" },
  { label: "COMPONENT", value: "COMPONENT" },
];

const STATUS_OPTIONS = [
  { label: "ACTIVE", value: "ACTIVE" },
  { label: "INACTIVE", value: "INACTIVE" },
  { label: "DRAFT", value: "DRAFT" },
];

const CODE_TYPES = [
  { label: "ITEM", value: "ITEM" },
  { label: "CARTON", value: "CARTON" },
  { label: "BOX", value: "BOX" },
  { label: "TRAY", value: "TRAY" },
];

const CONTAINER_TYPES = [
  { label: "CARTON", value: "CARTON" },
  { label: "BOX", value: "BOX" },
  { label: "TRAY", value: "TRAY" },
];

type MasterEntityKey = "skus" | "items" | "codes";
type MasterRecord = SkuRecord | ItemRecord | PhysicalCodeRecord;

interface FilterConfig {
  key: string;
  placeholder: string;
  options: { label: string; value: string | boolean }[];
}

interface DetailField<T extends MasterRecord> {
  label: string;
  render: (record: T) => ReactNode;
}

interface MasterEntityConfig<T extends MasterRecord> {
  key: MasterEntityKey;
  label: string;
  searchPlaceholder: string;
  endpoint: string;
  permissionNote: string;
  columns: ColumnsType<T>;
  query: UseQueryResult<MasterPageResult<T>, Error>;
  table: UseTablePatternReturn;
  filters: FilterConfig[];
  detailFields: DetailField<T>[];
  scrollX: number;
  emptyText: string;
  toolbarExtra?: ReactNode;
}

function statusTag(status: string) {
  const color =
    status === "ACTIVE"
      ? "success"
      : status === "INACTIVE"
        ? "default"
        : status === "DRAFT"
          ? "processing"
          : "warning";
  return <Tag color={color}>{status}</Tag>;
}

function boolTag(value?: boolean, yes = "YES", no = "NO") {
  return <Tag color={value ? "success" : "default"}>{value ? yes : no}</Tag>;
}

function mono(value?: string | number | null) {
  return value ? <span className="font-mono">{value}</span> : "-";
}

function buildParams(table: UseTablePatternReturn): MasterListParams {
  const params = table.getApiParams();
  return {
    page: params.page,
    per_page: params.pageSize,
    search: params.search,
    sort_by: params.sort?.field,
    sort_direction: params.sort?.order,
    ...params.filters,
  } as MasterListParams;
}

function errorAlert(error: unknown) {
  const normalized = normalizeError(error);
  const requestId = getErrorRequestId(error);
  return (
    <Alert
      type={normalized.status === 403 ? "warning" : "error"}
      showIcon
      className="master-data-state-alert"
      message={
        normalized.status === 403
          ? "Khong co quyen truy cap du lieu"
          : getApiErrorMessage(error)
      }
      description={[
        normalized.status ? `HTTP ${normalized.status}` : undefined,
        normalized.code ? `Error code: ${normalized.code}` : undefined,
        requestId ? `Request ID: ${requestId}` : undefined,
      ]
        .filter(Boolean)
        .join(" | ")}
    />
  );
}

function tableChange(
  table: UseTablePatternReturn,
): TableProps<MasterRecord>["onChange"] {
  return (pagination: TablePaginationConfig, filters, sorter) => {
    table.setPage(pagination.current ?? 1);
    table.setPageSize(pagination.pageSize ?? 10);
    const sort = Array.isArray(sorter) ? sorter[0] : sorter;
    table.setSort(
      sort?.field && sort.order
        ? {
            field: String(sort.field),
            order: sort.order === "ascend" ? "asc" : "desc",
          }
        : undefined,
    );
    for (const [key, value] of Object.entries(filters)) {
      if (value?.length) table.setFilter(key, String(value[0]));
    }
  };
}

function normalizeImportRows(result?: ImportResult): ImportRowError[] {
  return result?.row_errors ?? result?.errors ?? [];
}

function downloadSkuTemplate() {
  const header = [
    "sku_type",
    "sku_code",
    "sku_name",
    "brand",
    "category",
    "model",
    "unit",
    "serial_tracking",
    "default_container_type",
    "warranty_enabled",
    "status",
  ];
  const sample = [
    "PRODUCT",
    "SKU-SAMPLE-001",
    "Sample SKU",
    "Hoa Nam",
    "TOOLS",
    "MODEL-A",
    "PCS",
    "true",
    "CARTON",
    "false",
    "ACTIVE",
  ];
  const csv = `${header.join(",")}\n${sample.join(",")}\n`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "sku-import-template.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function ImportResultModal({
  result,
  open,
  onClose,
}: {
  result?: ImportResult;
  open: boolean;
  onClose: () => void;
}) {
  const rowErrors = normalizeImportRows(result);
  return (
    <Modal
      title="Ket qua import SKU"
      open={open}
      onCancel={onClose}
      onOk={onClose}
      width={920}
      okText="Dong"
    >
      <Alert
        showIcon
        type={rowErrors.length > 0 ? "warning" : "success"}
        message={result?.message ?? "Backend da tra ket qua xu ly import."}
        description="UI chi hien thi ket qua theo contract. Rule ghi partial hay rollback toan bo do backend HN-MC-001 quyet dinh."
      />
      <Row gutter={[12, 12]} className="import-summary">
        <Col xs={12} md={4}>
          <Statistic title="Total" value={result?.total_rows ?? 0} />
        </Col>
        <Col xs={12} md={4}>
          <Statistic title="Valid" value={result?.valid_rows ?? 0} />
        </Col>
        <Col xs={12} md={4}>
          <Statistic title="Errors" value={result?.error_rows ?? rowErrors.length} />
        </Col>
        <Col xs={12} md={4}>
          <Statistic title="Inserted" value={result?.inserted_rows ?? 0} />
        </Col>
        <Col xs={12} md={4}>
          <Statistic title="Updated" value={result?.updated_rows ?? 0} />
        </Col>
        <Col xs={12} md={4}>
          <Statistic title="Partial" value={result?.partial_write ? "YES" : "NO"} />
        </Col>
      </Row>
      <Table
        size="small"
        rowKey={(row, index) => `${row.row}-${row.field ?? "row"}-${index}`}
        dataSource={rowErrors}
        pagination={{ pageSize: 8 }}
        locale={{ emptyText: "Khong co row-level error" }}
        columns={[
          { title: "Row", dataIndex: "row", width: 80 },
          { title: "Field", dataIndex: "field", width: 160, render: mono },
          { title: "Code", dataIndex: "code", width: 160, render: mono },
          { title: "Value", dataIndex: "value", width: 180, render: mono },
          { title: "Message", dataIndex: "message" },
        ]}
      />
    </Modal>
  );
}

function MasterEntityPanel<T extends MasterRecord>({
  config,
  onViewDetail,
}: {
  config: MasterEntityConfig<T>;
  onViewDetail: (record: T, config: MasterEntityConfig<T>) => void;
}) {
  const data = config.query.data?.data as T[] | undefined;
  return (
    <Card className="master-data-panel">
      <div className="master-data-contract-strip">
        <Tag color="blue">{config.endpoint}</Tag>
        <Tag color="gold">{config.permissionNote}</Tag>
      </div>
      <Row gutter={[12, 12]} className="filter-row">
        <Col xs={24} md={8}>
          <Input.Search
            placeholder={config.searchPlaceholder}
            value={config.table.search}
            onChange={(event) => config.table.setSearch(event.target.value)}
            allowClear
          />
        </Col>
        {config.filters.map((filter) => (
          <Col xs={12} md={4} key={filter.key}>
            <Select
              placeholder={filter.placeholder}
              options={filter.options}
              value={config.table.filters[filter.key]}
              onChange={(value) => config.table.setFilter(filter.key, value)}
              allowClear
              className="full-width"
            />
          </Col>
        ))}
        <Col xs={12} md={4}>
          <Button onClick={config.table.resetFilters} className="full-width">
            Xoa loc
          </Button>
        </Col>
        <Col xs={24} md={4} className="panel-extra-actions">
          {config.toolbarExtra}
        </Col>
      </Row>
      {config.query.isError ? errorAlert(config.query.error) : null}
      <Table<T>
        rowKey="id"
        columns={[
          ...config.columns,
          {
            title: "Detail",
            key: "detail",
            width: 96,
            fixed: "right",
            render: (_, record) => (
              <Button
                type="link"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => onViewDetail(record, config)}
              >
                View
              </Button>
            ),
          },
        ]}
        dataSource={data ?? []}
        loading={config.query.isLoading || config.query.isFetching}
        onChange={tableChange(config.table) as TableProps<T>["onChange"]}
        pagination={{
          current: config.table.page,
          pageSize: config.table.pageSize,
          total: config.query.data?.meta.total ?? 0,
          showSizeChanger: true,
          showTotal: (total) => `Tong ${total} ban ghi`,
        }}
        locale={{
          emptyText: config.query.isError ? "Khong tai duoc du lieu" : config.emptyText,
        }}
        scroll={{ x: config.scrollX }}
      />
    </Card>
  );
}

export default function MasterPage() {
  const [activeTab, setActiveTab] = useState<MasterEntityKey>("skus");
  const [isSkuModalOpen, setIsSkuModalOpen] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | undefined>();
  const [detailState, setDetailState] = useState<{
    record: MasterRecord;
    fields: DetailField<MasterRecord>[];
    title: string;
  }>();
  const [form] = Form.useForm<SkuPayload>();
  const hasPermission = useHasPermission();
  const canManageMasterData =
    hasPermission("sku.manage") || hasPermission("master.manage");

  const skuTable = useTablePattern({ initialPageSize: 10 });
  const itemTable = useTablePattern({ initialPageSize: 10 });
  const codeTable = useTablePattern({ initialPageSize: 10 });

  const skus = useSkus(buildParams(skuTable));
  const items = useItems(buildParams(itemTable));
  const codes = usePhysicalCodes(buildParams(codeTable));
  const createSkuMutation = useCreateSku();
  const updateStatusMutation = useUpdateSkuStatus();
  const importMutation = useImportSkus();

  const handleSkuSave = async () => {
    const values = await form.validateFields();
    try {
      await createSkuMutation.mutateAsync(values);
      message.success("Da tao SKU");
      setIsSkuModalOpen(false);
      form.resetFields();
    } catch (error) {
      const fieldErrors = extractFieldErrorsRaw(error);
      if (fieldErrors) {
        form.setFields(
          Object.entries(fieldErrors).map(([name, errors]) => ({
            name: [name as keyof SkuPayload],
            errors: [errors],
          })),
        );
      }
      message.error(getApiErrorMessage(error, "Khong the tao SKU"));
    }
  };

  const uploadProps: UploadProps = {
    accept: ".xlsx,.xls,.csv",
    maxCount: 1,
    showUploadList: false,
    beforeUpload: async (file) => {
      try {
        const result = await importMutation.mutateAsync(file);
        setImportResult(result);
        message.success("Da nhan ket qua import SKU");
      } catch (error) {
        Modal.error({
          title: "Import khong thanh cong",
          content: getApiErrorMessage(error, "Khong the import file"),
        });
      }
      return Upload.LIST_IGNORE;
    },
  };

  const skuColumns: ColumnsType<SkuRecord> = useMemo(
    () => [
      {
        title: "SKU code",
        dataIndex: "sku_code",
        sorter: true,
        render: mono,
      },
      {
        title: "Ten SKU",
        dataIndex: "sku_name",
        sorter: true,
        render: (value: string) => <strong>{value}</strong>,
      },
      {
        title: "Loai",
        dataIndex: "sku_type",
        render: (value: string) => (
          <Tag color={value === "PRODUCT" ? "blue" : "green"}>{value}</Tag>
        ),
      },
      {
        title: "Brand/Model",
        render: (_, record) =>
          [record.brand, record.model].filter(Boolean).join(" / ") || "-",
      },
      {
        title: "Serial",
        dataIndex: "serial_tracking",
        render: (value?: boolean) => boolTag(value, "Serial", "Quantity"),
      },
      { title: "DVT", dataIndex: "unit" },
      { title: "Container", dataIndex: "default_container_type" },
      {
        title: "Trang thai",
        dataIndex: "status",
        filters: STATUS_OPTIONS.map((item) => ({
          text: item.label,
          value: item.value,
        })),
        render: statusTag,
      },
      {
        title: "Action",
        key: "action",
        width: 132,
        render: (_, record) => (
          <ConfirmButton
            type="link"
            size="small"
            danger={record.status === "ACTIVE"}
            icon={<StopOutlined />}
            title={
              record.status === "ACTIVE"
                ? "Ngung hoat dong SKU?"
                : "Kich hoat SKU?"
            }
            description="Thao tac gui trang thai moi len API theo contract da duyet."
            okText="Xac nhan"
            loading={updateStatusMutation.isPending}
            disabled={!canManageMasterData}
            onConfirm={() =>
              updateStatusMutation.mutate({
                id: record.id,
                status: record.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
              })
            }
          >
            {record.status === "ACTIVE" ? "Disable" : "Enable"}
          </ConfirmButton>
        ),
      },
    ],
    [canManageMasterData, updateStatusMutation],
  );

  const itemColumns: ColumnsType<ItemRecord> = [
    { title: "Item code", dataIndex: "item_code", render: mono },
    { title: "SKU", dataIndex: "sku_code", render: mono },
    { title: "Ten SKU", dataIndex: "sku_name" },
    { title: "Serial", dataIndex: "serial_no", render: mono },
    { title: "Lot", dataIndex: "lot_no", render: mono },
    { title: "Kho", dataIndex: "warehouse_name", render: (value) => value || "-" },
    { title: "Trang thai", dataIndex: "status", render: statusTag },
  ];

  const codeColumns: ColumnsType<PhysicalCodeRecord> = [
    { title: "Physical code", dataIndex: "code_value", render: mono },
    { title: "Code type", dataIndex: "code_type", render: (value) => <Tag>{value}</Tag> },
    { title: "Carrier", dataIndex: "carrier", render: (value) => value || "-" },
    { title: "SKU", dataIndex: "sku_code", render: mono },
    { title: "Item", dataIndex: "item_code", render: mono },
    {
      title: "Duplicate",
      dataIndex: "duplicate_flag",
      render: (value?: boolean) => boolTag(value),
    },
    { title: "Trang thai", dataIndex: "status", render: statusTag },
  ];

  const configs: MasterEntityConfig<MasterRecord>[] = [
    {
      key: "skus",
      label: "SKU / Product master",
      endpoint: "GET/POST /skus",
      permissionNote: "sku.manage | master.manage",
      searchPlaceholder: "Ten, SKU, brand, model...",
      columns: skuColumns as ColumnsType<MasterRecord>,
      query: skus,
      table: skuTable,
      filters: [
        { key: "sku_type", placeholder: "Loai SKU", options: SKU_TYPES },
        {
          key: "serial_tracking",
          placeholder: "Serial",
          options: [
            { label: "Serial", value: true },
            { label: "Quantity", value: false },
          ],
        },
        { key: "status", placeholder: "Trang thai", options: STATUS_OPTIONS },
      ],
      detailFields: [
        { label: "SKU code", render: (record) => mono((record as SkuRecord).sku_code) },
        { label: "Ten SKU", render: (record) => (record as SkuRecord).sku_name },
        { label: "Loai", render: (record) => (record as SkuRecord).sku_type },
        { label: "Brand", render: (record) => (record as SkuRecord).brand || "-" },
        { label: "Category", render: (record) => (record as SkuRecord).category || "-" },
        { label: "Model", render: (record) => (record as SkuRecord).model || "-" },
        { label: "DVT", render: (record) => (record as SkuRecord).unit || "-" },
        {
          label: "Serial tracking",
          render: (record) => boolTag((record as SkuRecord).serial_tracking),
        },
        {
          label: "Warranty",
          render: (record) => boolTag((record as SkuRecord).warranty_enabled),
        },
        { label: "Status", render: (record) => statusTag(record.status) },
        { label: "Updated", render: (record) => record.updated_at || "-" },
      ],
      scrollX: 1180,
      emptyText: "Chua co SKU",
      toolbarExtra: (
        <Button
          icon={<ReloadOutlined />}
          onClick={() => void skus.refetch()}
          className="full-width"
        >
          Refresh
        </Button>
      ),
    },
    {
      key: "items",
      label: "Item",
      endpoint: "GET /items",
      permissionNote: "route RBAC + backend data scope",
      searchPlaceholder: "Item code, SKU, serial...",
      columns: itemColumns as ColumnsType<MasterRecord>,
      query: items,
      table: itemTable,
      filters: [{ key: "status", placeholder: "Trang thai", options: STATUS_OPTIONS }],
      detailFields: [
        { label: "Item code", render: (record) => mono((record as ItemRecord).item_code) },
        { label: "SKU", render: (record) => mono((record as ItemRecord).sku_code) },
        { label: "Ten SKU", render: (record) => (record as ItemRecord).sku_name || "-" },
        { label: "Serial", render: (record) => mono((record as ItemRecord).serial_no) },
        { label: "Lot", render: (record) => mono((record as ItemRecord).lot_no) },
        { label: "Kho", render: (record) => (record as ItemRecord).warehouse_name || "-" },
        { label: "Status", render: (record) => statusTag(record.status) },
        { label: "Updated", render: (record) => record.updated_at || "-" },
      ],
      scrollX: 980,
      emptyText: "Chua co item",
    },
    {
      key: "codes",
      label: "Physical code",
      endpoint: "GET /physical-codes",
      permissionNote: "duplicate/unknown do backend classify",
      searchPlaceholder: "QR/Barcode/RFID-ready code...",
      columns: codeColumns as ColumnsType<MasterRecord>,
      query: codes,
      table: codeTable,
      filters: [
        { key: "code_type", placeholder: "Code type", options: CODE_TYPES },
        { key: "status", placeholder: "Trang thai", options: STATUS_OPTIONS },
        {
          key: "duplicate_flag",
          placeholder: "Duplicate",
          options: [
            { label: "YES", value: true },
            { label: "NO", value: false },
          ],
        },
      ],
      detailFields: [
        {
          label: "Physical code",
          render: (record) => mono((record as PhysicalCodeRecord).code_value),
        },
        { label: "Code type", render: (record) => (record as PhysicalCodeRecord).code_type },
        { label: "Carrier", render: (record) => (record as PhysicalCodeRecord).carrier || "-" },
        { label: "SKU", render: (record) => mono((record as PhysicalCodeRecord).sku_code) },
        { label: "Item", render: (record) => mono((record as PhysicalCodeRecord).item_code) },
        {
          label: "Duplicate",
          render: (record) => boolTag((record as PhysicalCodeRecord).duplicate_flag),
        },
        { label: "Status", render: (record) => statusTag(record.status) },
        {
          label: "Last scanned",
          render: (record) => (record as PhysicalCodeRecord).last_scanned_at || "-",
        },
      ],
      scrollX: 1040,
      emptyText: "Chua co physical code",
    },
  ];

  const activeConfig = configs.find((item) => item.key === activeTab) ?? configs[0];

  return (
    <div className="master-data-page">
      <div className="page-heading">
        <div>
          <h1>Master/SKU FE</h1>
          <p>PL01-04 | HN-EPIC-04 | HN-PIN-04 | HN-FE-01</p>
        </div>
        <Space wrap>
          <Button icon={<DownloadOutlined />} onClick={downloadSkuTemplate}>
            Template CSV
          </Button>
          <Upload {...uploadProps}>
            <Button
              icon={<ImportOutlined />}
              loading={importMutation.isPending}
              disabled={!canManageMasterData}
              title={
                canManageMasterData
                  ? undefined
                  : "Ban khong co quyen import du lieu Master/SKU"
              }
            >
              Import Excel
            </Button>
          </Upload>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={!canManageMasterData}
            title={canManageMasterData ? undefined : "Ban khong co quyen tao SKU"}
            onClick={() => setIsSkuModalOpen(true)}
          >
            Tao SKU
          </Button>
        </Space>
      </div>

      <Alert
        showIcon
        type="info"
        className="trace-alert"
        message="FE dung component cau hinh lai cho SKU/item/code; backend van la authority cho permission, validation, data scope va import transaction rule."
      />

      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as MasterEntityKey)}
        items={configs.map((config) => ({
          key: config.key,
          label: config.label,
          children: (
            <MasterEntityPanel
              config={config}
              onViewDetail={(record, detailConfig) =>
                setDetailState({
                  record,
                  fields: detailConfig.detailFields as DetailField<MasterRecord>[],
                  title: detailConfig.label,
                })
              }
            />
          ),
        }))}
      />

      <Drawer
        title={`${detailState?.title ?? activeConfig.label} detail`}
        open={Boolean(detailState)}
        onClose={() => setDetailState(undefined)}
        width={520}
      >
        {detailState ? (
          <Descriptions column={1} bordered size="small">
            {detailState.fields.map((field) => (
              <Descriptions.Item label={field.label} key={field.label}>
                {field.render(detailState.record)}
              </Descriptions.Item>
            ))}
          </Descriptions>
        ) : null}
      </Drawer>

      <ImportResultModal
        open={Boolean(importResult)}
        result={importResult}
        onClose={() => setImportResult(undefined)}
      />

      <Modal
        title="Tao SKU moi"
        open={isSkuModalOpen}
        onOk={() => void handleSkuSave()}
        okText="Luu"
        confirmLoading={createSkuMutation.isPending}
        onCancel={() => setIsSkuModalOpen(false)}
        width={760}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            status: "ACTIVE",
            warranty_enabled: false,
            serial_tracking: true,
          }}
        >
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item label="Loai SKU" name="sku_type" rules={[{ required: true }]}>
                <Select options={SKU_TYPES} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="SKU code" name="sku_code" rules={[{ required: true }]}>
                <Input placeholder="Theo API field specification" />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item label="Ten SKU" name="sku_name" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Brand" name="brand">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Category" name="category">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Model" name="model">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Don vi tinh" name="unit" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                label="Container mac dinh"
                name="default_container_type"
                rules={[{ required: true }]}
              >
                <Select options={CONTAINER_TYPES} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Trang thai" name="status" rules={[{ required: true }]}>
                <Select options={STATUS_OPTIONS} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Theo doi serial" name="serial_tracking">
                <Select
                  options={[
                    { label: "Serial", value: true },
                    { label: "Quantity", value: false },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Bao hanh ap dung" name="warranty_enabled">
                <Select
                  options={[
                    { label: "YES", value: true },
                    { label: "NO", value: false },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}
