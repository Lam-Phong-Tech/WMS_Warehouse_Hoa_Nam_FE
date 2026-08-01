import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Tooltip,
  message,
  type TablePaginationConfig,
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
  useCreateProductCategory,
  useItems,
  usePhysicalCodes,
  useProductCategories,
  useSkus,
  useUpdateSkuStatus,
  useSuppliers,
  useUoms,
} from "@/modules/master-data/hooks/use-master-data";
import type {
  ImportResult,
  ImportRowError,
  ItemRecord,
  MasterListParams,
  MasterPageResult,
  PhysicalCodeRecord,
  ProductCategoryPayload,
  ProductCategoryRecord,
  ProductPayload,
  ProductRecord,
} from "@/modules/master-data/types/master-data.types";

const PRODUCT_STATUS_OPTIONS = [
  { label: "Hoạt động", value: "active" },
  { label: "Ngưng hoạt động", value: "inactive" },
  { label: "Ngừng kinh doanh", value: "discontinued" },
];

const CATEGORY_STATUS_OPTIONS = [
  { label: "Hoạt động", value: 1 },
  { label: "Ngưng hoạt động", value: 0 },
];

const CODE_TYPES = [
  { label: "ITEM", value: "ITEM" },
  { label: "CARTON", value: "CARTON" },
  { label: "BOX", value: "BOX" },
  { label: "TRAY", value: "TRAY" },
];

const PAGE_SIZE_OPTIONS = [15, 20, 50, 100];

type MasterEntityKey = "categories" | "skus" | "items" | "codes";
type MasterRecord =
  | ProductCategoryRecord
  | ProductRecord
  | ItemRecord
  | PhysicalCodeRecord;

interface FilterConfig {
  key: string;
  placeholder: string;
  options: { label: string; value: string | number | boolean }[];
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
  blockerNote?: string;
  columns: ColumnsType<T>;
  query: UseQueryResult<MasterPageResult<T>, Error>;
  table: UseTablePatternReturn;
  filters: FilterConfig[];
  detailFields: DetailField<T>[];
  scrollX: number;
  emptyText: string;
  toolbarExtra?: ReactNode;
}

function statusTag(status: string | number) {
  const normalized = String(status).toLowerCase();
  const color =
    normalized === "active" || status === "1"
      ? "success"
      : normalized === "inactive" || status === "0"
        ? "default"
        : normalized === "draft"
          ? "processing"
          : "warning";
  return <Tag color={color}>{String(status)}</Tag>;
}

function boolTag(value?: boolean, yes = "Có", no = "Không") {
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

function productSku(record: ProductRecord) {
  return record.product_code ?? "-";
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
          ? "Không có quyền truy cập dữ liệu"
          : getApiErrorMessage(error)
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
    "code",
    "name",
    "unit",
    "sku_type",
    "is_serial_tracked",
    "status",
  ];
  const csv = `${header.join(",")}\n`;
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
      title="Kết quả import SKU"
      open={open}
      onCancel={onClose}
      onOk={onClose}
      width={920}
      okText="Đóng"
    >
      <Alert
        showIcon
        type={rowErrors.length > 0 ? "warning" : "success"}
        message={result?.message ?? "Backend đã trả kết quả xử lý import."}
        description="UI chỉ hiển thị kết quả theo contract. Rule ghi partial hay rollback toàn bộ do backend HN-MC-001 quyết định."
      />
      <Row gutter={[12, 12]} className="import-summary">
        <Col xs={12} md={4}>
          <Statistic title="Tổng" value={result?.total_rows ?? 0} />
        </Col>
        <Col xs={12} md={4}>
          <Statistic title="Hợp lệ" value={result?.valid_rows ?? 0} />
        </Col>
        <Col xs={12} md={4}>
          <Statistic title="Lỗi" value={result?.error_rows ?? rowErrors.length} />
        </Col>
        <Col xs={12} md={4}>
          <Statistic title="Đã thêm" value={result?.inserted_rows ?? 0} />
        </Col>
        <Col xs={12} md={4}>
          <Statistic title="Đã cập nhật" value={result?.updated_rows ?? 0} />
        </Col>
        <Col xs={12} md={4}>
          <Statistic title="Ghi một phần" value={result?.partial_write ? "Có" : "Không"} />
        </Col>
      </Row>
      <Table
        size="small"
        rowKey={(row, index) => `${row.row}-${row.field ?? "row"}-${index}`}
        dataSource={rowErrors}
        pagination={{ pageSize: 8 }}
        locale={{ emptyText: "Không có lỗi theo dòng" }}
        columns={[
          { title: "Dòng", dataIndex: "row", width: 80 },
          { title: "Trường", dataIndex: "field", width: 160, render: mono },
          { title: "Mã lỗi", dataIndex: "code", width: 160, render: mono },
          { title: "Giá trị", dataIndex: "value", width: 180, render: mono },
          { title: "Thông báo", dataIndex: "message" },
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
  const pageSize = PAGE_SIZE_OPTIONS.includes(config.table.pageSize)
    ? config.table.pageSize
    : PAGE_SIZE_OPTIONS[0];

  useEffect(() => {
    if (!PAGE_SIZE_OPTIONS.includes(config.table.pageSize)) {
      config.table.setPageSize(PAGE_SIZE_OPTIONS[0]);
    }
  }, [config.table]);

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
            Xóa lọc
          </Button>
        </Col>
        <Col xs={24} md={4} className="panel-extra-actions">
          {config.toolbarExtra}
        </Col>
      </Row>
      {config.query.isError ? errorAlert(config.query.error) : null}
      {config.blockerNote ? (
        <Alert
          showIcon
          type="warning"
          className="master-data-state-alert"
          message="Chưa có contract API chính thức"
          description={config.blockerNote}
        />
      ) : null}
      <div className="table-page-size">
        <Select
          size="small"
          value={pageSize}
          style={{ width: 110 }}
          showSearch={false}
          labelRender={({ value }) => `${value} / trang`}
          options={PAGE_SIZE_OPTIONS.map((size) => ({
            value: size,
            label: `${size} / trang`,
          }))}
          onChange={(pageSize) => config.table.setPageSize(pageSize)}
        />
      </div>
      <Table<T>
        rowKey="id"
        columns={[
          ...config.columns,
          {
            title: "Chi tiết",
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
                Xem
              </Button>
            ),
          },
        ]}
        dataSource={data ?? []}
        loading={config.query.isLoading || config.query.isFetching}
        onChange={tableChange(config.table) as TableProps<T>["onChange"]}
        pagination={{
          current: config.table.page,
          pageSize,
          total: config.query.data?.meta.total ?? 0,
          showSizeChanger: false,
          showTotal: (total) => `Tổng ${total} bản ghi`,
        }}
        locale={{
          emptyText: config.query.isError ? "Không tải được dữ liệu" : config.emptyText,
        }}
        scroll={{ x: config.scrollX }}
      />
    </Card>
  );
}

export default function MasterPage() {
  const [activeTab, setActiveTab] = useState<MasterEntityKey>("skus");
  const [isSkuModalOpen, setIsSkuModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | undefined>();
  const [detailState, setDetailState] = useState<{
    record: MasterRecord;
    fields: DetailField<MasterRecord>[];
    title: string;
  }>();
  const [form] = Form.useForm<ProductPayload>();
  const [categoryForm] = Form.useForm<ProductCategoryPayload>();
  const hasPermission = useHasPermission();
  const canManageMasterData =
    hasPermission("sku.manage") || hasPermission("master.manage");

  const categoryTable = useTablePattern({ initialPageSize: 15 });
  const skuTable = useTablePattern({ initialPageSize: 15 });
  const itemTable = useTablePattern({ initialPageSize: 15 });
  const codeTable = useTablePattern({ initialPageSize: 15 });

  const shouldLoadCategories =
    activeTab === "categories" || isCategoryModalOpen || isSkuModalOpen;
  const categoriesQuery = useProductCategories(buildParams(categoryTable), shouldLoadCategories);
  const skus = useSkus(buildParams(skuTable));
  const items = useItems(buildParams(itemTable));
  const codes = usePhysicalCodes(buildParams(codeTable));
  const createSkuMutation = useCreateSku();
  const createCategoryMutation = useCreateProductCategory();
  const updateStatusMutation = useUpdateSkuStatus();

  const handleSkuSave = async () => {
    const values = await form.validateFields();
    try {
      await createSkuMutation.mutateAsync(values);
      message.success("Đã tạo sản phẩm/SKU");
      setIsSkuModalOpen(false);
      form.resetFields();
    } catch (error) {
      const fieldErrors = extractFieldErrorsRaw(error);
      if (fieldErrors) {
        form.setFields(
          Object.entries(fieldErrors).map(([name, errors]) => ({
            name: [name as keyof ProductPayload],
            errors: [errors],
          })),
        );
      }
      message.error(getApiErrorMessage(error, "Không thể tạo sản phẩm"));
    }
  };

  const handleCategorySave = async () => {
    const values = await categoryForm.validateFields();
    try {
      await createCategoryMutation.mutateAsync(values);
      message.success("Đã tạo danh mục sản phẩm");
      setIsCategoryModalOpen(false);
      categoryForm.resetFields();
    } catch (error) {
      const fieldErrors = extractFieldErrorsRaw(error);
      if (fieldErrors) {
        categoryForm.setFields(
          Object.entries(fieldErrors).map(([name, errors]) => ({
            name: [name as keyof ProductCategoryPayload],
            errors: [errors],
          })),
        );
      }
      message.error(getApiErrorMessage(error, "Không thể tạo danh mục"));
    }
  };

  const skuColumns: ColumnsType<ProductRecord> = useMemo(
    () => [
      {
        title: "Mã SP",
        dataIndex: "product_code",
        key: "product_code",
        sorter: true,
        render: mono,
      },
      {
        title: "Barcode",
        dataIndex: "barcode",
        key: "barcode",
        sorter: true,
        render: mono,
      },
      {
        title: "Tên",
        dataIndex: "name",
        key: "name",
        sorter: true,
        render: (value: string) => <strong>{value}</strong>,
      },
      { title: "NCC", dataIndex: "supplier_id", render: mono },
      { title: "Danh mục", dataIndex: "category_id", render: mono },
      { title: "ĐVT", dataIndex: "uom_id", render: mono },
      {
        title: "Giá niêm yết",
        dataIndex: "list_price_net",
        align: "right",
        render: (value?: number) =>
          value !== undefined && value !== null
            ? value.toLocaleString("vi-VN")
            : "-",
      },
      {
        title: "VAT",
        dataIndex: "vat_rate",
        align: "right",
        render: (value?: number) => (value !== undefined && value !== null ? `${value}%` : "-"),
      },
      {
        title: "Trạng thái",
        dataIndex: "status",
        filters: PRODUCT_STATUS_OPTIONS.map((item) => ({
          text: item.label,
          value: item.value,
        })),
        render: (value: string) => statusTag(value),
      },
      {
        title: "Hành động",
        key: "action",
        width: 96,
        render: (_, record) => {
          const isActive = String(record.status).toLowerCase() === "active";
          const nextStatus = isActive ? "inactive" : "active";
          return (
            <Tooltip title={isActive ? "Ngừng hoạt động" : "Kích hoạt"}>
              <ConfirmButton
                type="text"
                size="small"
                danger={isActive}
                icon={
                  isActive ? <StopOutlined /> : <ReloadOutlined />
                }
                title={isActive ? "Ngừng hoạt động sản phẩm?" : "Kích hoạt sản phẩm?"}
                description="Thao tác gửi trạng thái mới lên API theo contract đã duyệt."
                okText="Xác nhận"
                loading={updateStatusMutation.isPending}
                disabled={!canManageMasterData}
                onConfirm={() =>
                  updateStatusMutation.mutate({
                    id: record.id,
                    status: nextStatus,
                  })
                }
              >
                <span className="sr-only">
                  {isActive ? "Ngưng hoạt động" : "Kích hoạt"}
                </span>
              </ConfirmButton>
            </Tooltip>
          );
        },
      },
    ],
    [canManageMasterData, updateStatusMutation],
  );

  const itemColumns: ColumnsType<ItemRecord> = [
    { title: "Mã item", dataIndex: "item_code", render: mono },
    { title: "SKU", dataIndex: "sku_code", render: mono },
    { title: "Tên SKU", dataIndex: "sku_name" },
    { title: "Serial", dataIndex: "serial_no", render: mono },
    { title: "Lot", dataIndex: "lot_no", render: mono },
    { title: "Kho", dataIndex: "warehouse_name", render: (value) => value || "-" },
    { title: "Trạng thái", dataIndex: "status", render: statusTag },
  ];

  const codeColumns: ColumnsType<PhysicalCodeRecord> = [
    { title: "Mã vật lý", dataIndex: "code_value", render: mono },
    { title: "Loại mã", dataIndex: "code_type", render: (value) => <Tag>{value}</Tag> },
    { title: "Vật mang", dataIndex: "carrier", render: (value) => value || "-" },
    { title: "SKU", dataIndex: "sku_code", render: mono },
    { title: "Item", dataIndex: "item_code", render: mono },
    {
      title: "Trùng lặp",
      dataIndex: "duplicate_flag",
      render: (value?: boolean) => boolTag(value),
    },
    { title: "Trạng thái", dataIndex: "status", render: statusTag },
  ];

  const categoryColumns: ColumnsType<ProductCategoryRecord> = [
    { title: "Mã danh mục", dataIndex: "code", render: mono },
    { title: "Tên danh mục", dataIndex: "name", render: (value) => <strong>{value}</strong> },
    { title: "Danh mục cha", dataIndex: "parent_id", render: mono },
    { title: "Cấp", dataIndex: "depth", width: 96 },
    { title: "Thứ tự", dataIndex: "sort_order", width: 96 },
    {
      title: "Trạng thái",
      dataIndex: "status",
      render: (value: number) => statusTag(String(value)),
    },
  ];

  const configs: MasterEntityConfig<MasterRecord>[] = [
    {
      key: "categories",
      label: "Danh mục sản phẩm",
      endpoint: "GET/POST /product-categories",
      permissionNote: "Product Category | backend RBAC",
      searchPlaceholder: "Mã hoặc tên danh mục...",
      columns: categoryColumns as ColumnsType<MasterRecord>,
      query: categoriesQuery,
      table: categoryTable,
      filters: [
        { key: "status", placeholder: "Trạng thái", options: CATEGORY_STATUS_OPTIONS },
      ],
      detailFields: [
        { label: "Mã danh mục", render: (record) => mono((record as ProductCategoryRecord).code) },
        { label: "Tên danh mục", render: (record) => (record as ProductCategoryRecord).name },
        { label: "Danh mục cha", render: (record) => mono((record as ProductCategoryRecord).parent_id) },
        { label: "Cấp", render: (record) => (record as ProductCategoryRecord).depth ?? "-" },
        { label: "Thứ tự", render: (record) => (record as ProductCategoryRecord).sort_order ?? "-" },
        {
          label: "Trạng thái",
          render: (record) => statusTag(String((record as ProductCategoryRecord).status)),
        },
        { label: "Cập nhật", render: (record) => record.updated_at || "-" },
      ],
      scrollX: 820,
      emptyText: "Chưa có danh mục sản phẩm",
      toolbarExtra: (
        <Button
          type="primary"
          icon={<PlusOutlined />}
          disabled={!canManageMasterData}
          onClick={() => setIsCategoryModalOpen(true)}
          className="full-width"
        >
          Tạo danh mục
        </Button>
      ),
    },
    {
      key: "skus",
      label: "Sản phẩm / SKU",
      endpoint: "GET/POST/PATCH /products",
      permissionNote: "sku.manage | master.manage",
      searchPlaceholder: "Tên hoặc code SKU...",
      columns: skuColumns as ColumnsType<MasterRecord>,
      query: skus,
      table: skuTable,
      filters: [
        {
          key: "status",
          placeholder: "Trạng thái",
          options: PRODUCT_STATUS_OPTIONS,
        },
      ],
      detailFields: [
        { label: "ID", render: (record) => mono((record as ProductRecord).id) },
        {
          label: "Mã SP",
          render: (record) => mono(productSku(record as ProductRecord)),
        },
        { label: "Barcode", render: (record) => mono((record as ProductRecord).barcode) },
        { label: "Tên", render: (record) => (record as ProductRecord).name },
        {
          label: "Mô tả",
          render: (record) => (record as ProductRecord).description || "-",
        },
        { label: "NCC", render: (record) => mono((record as ProductRecord).supplier_id) },
        { label: "Danh mục", render: (record) => mono((record as ProductRecord).category_id) },
        { label: "ĐVT", render: (record) => mono((record as ProductRecord).uom_id) },
        {
          label: "Giá niêm yết",
          render: (record) =>
            (record as ProductRecord).list_price_net?.toLocaleString("vi-VN") || "-",
        },
        {
          label: "VAT",
          render: (record) =>
            (record as ProductRecord).vat_rate !== undefined &&
            (record as ProductRecord).vat_rate !== null
              ? `${(record as ProductRecord).vat_rate}%`
              : "-",
        },
        { label: "Trạng thái", render: (record) => statusTag(record.status) },
        {
          label: "Tạo lúc",
          render: (record) => (record as ProductRecord).created_at || "-",
        },
        {
          label: "Cập nhật",
          render: (record) => (record as ProductRecord).updated_at || "-",
        },
      ],
      scrollX: 920,
      emptyText: "Chưa có SKU",
      toolbarExtra: (
        <Button
          icon={<ReloadOutlined />}
          onClick={() => void skus.refetch()}
          className="full-width"
        >
          Làm mới
        </Button>
      ),
    },
    {
      key: "items",
      label: "Item",
      endpoint: "OUT OF SCOPE: /items not in OpenAPI",
      permissionNote: "read-only until BE contract",
      blockerNote:
        "OpenAPI 3.0.0 hiện chưa publish /items. FE giữ pattern UI để BA/QA soát layout nhưng không gọi request ngoài contract; cần BE/BA chốt endpoint, payload, phân quyền và field spec trước khi bật runtime.",
      searchPlaceholder: "Mã item, SKU, serial...",
      columns: itemColumns as ColumnsType<MasterRecord>,
      query: items,
      table: itemTable,
      filters: [{ key: "status", placeholder: "Trạng thái", options: PRODUCT_STATUS_OPTIONS }],
      detailFields: [
        { label: "Mã item", render: (record) => mono((record as ItemRecord).item_code) },
        { label: "SKU", render: (record) => mono((record as ItemRecord).sku_code) },
        { label: "Tên SKU", render: (record) => (record as ItemRecord).sku_name || "-" },
        { label: "Serial", render: (record) => mono((record as ItemRecord).serial_no) },
        { label: "Lot", render: (record) => mono((record as ItemRecord).lot_no) },
        { label: "Kho", render: (record) => (record as ItemRecord).warehouse_name || "-" },
        { label: "Trạng thái", render: (record) => statusTag(record.status) },
        { label: "Cập nhật", render: (record) => record.updated_at || "-" },
      ],
      scrollX: 980,
      emptyText: "Item chờ BE publish OpenAPI, FE không gọi /items",
    },
    {
      key: "codes",
      label: "Mã vật lý",
      endpoint: "OUT OF SCOPE: /physical-codes not in OpenAPI",
      permissionNote: "read-only until BE contract",
      blockerNote:
        "OpenAPI 3.0.0 hiện chưa publish /physical-codes. FE không tự suy diễn luồng QR/barcode/RFID trong Master Data; cần BE/BA baseline endpoint, filter, duplicate rule và detail schema trước khi gỡ khóa.",
      searchPlaceholder: "QR/Barcode/RFID-ready code...",
      columns: codeColumns as ColumnsType<MasterRecord>,
      query: codes,
      table: codeTable,
      filters: [
        { key: "code_type", placeholder: "Loại mã", options: CODE_TYPES },
        { key: "status", placeholder: "Trạng thái", options: PRODUCT_STATUS_OPTIONS },
        {
          key: "duplicate_flag",
          placeholder: "Trùng lặp",
          options: [
            { label: "Có", value: true },
            { label: "Không", value: false },
          ],
        },
      ],
      detailFields: [
        {
          label: "Mã vật lý",
          render: (record) => mono((record as PhysicalCodeRecord).code_value),
        },
        { label: "Loại mã", render: (record) => (record as PhysicalCodeRecord).code_type },
        { label: "Vật mang", render: (record) => (record as PhysicalCodeRecord).carrier || "-" },
        { label: "SKU", render: (record) => mono((record as PhysicalCodeRecord).sku_code) },
        { label: "Item", render: (record) => mono((record as PhysicalCodeRecord).item_code) },
        {
          label: "Trùng lặp",
          render: (record) => boolTag((record as PhysicalCodeRecord).duplicate_flag),
        },
        { label: "Trạng thái", render: (record) => statusTag(record.status) },
        {
          label: "Quét lần cuối",
          render: (record) => (record as PhysicalCodeRecord).last_scanned_at || "-",
        },
      ],
      scrollX: 1040,
      emptyText: "Physical code chờ BE publish OpenAPI, FE không gọi /physical-codes",
    },
  ];

  const activeConfig = configs.find((item) => item.key === activeTab) ?? configs[0];
  const suppliersQuery = useSuppliers(true);
  const uomsQuery = useUoms(true);

  const categoryOptions =
    categoriesQuery.data?.data.map((item) => ({
      label: [item.code, item.name].filter(Boolean).join(" - "),
      value: Number(item.id),
    })) ?? [];

  const supplierOptions =
    suppliersQuery.data?.map((item) => ({
      label: [item.code, item.name].filter(Boolean).join(" - "),
      value: Number(item.id),
    })) ?? [];

  const uomOptions =
    uomsQuery.data?.map((item) => ({
      label: [item.code, item.name].filter(Boolean).join(" - "),
      value: Number(item.id),
    })) ?? [];

  return (
    <div className="master-data-page">
      <div className="page-heading">
        <div>
          <h1>Danh mục /SKU</h1>
          
        </div>
        <Space wrap>
          <Button icon={<DownloadOutlined />} onClick={downloadSkuTemplate}>
            Tải mẫu CSV
          </Button>
          <Tooltip title="Chưa bật: /skus/import-excel không có trong OpenAPI 3.0.0. Chỉ dùng sau khi BE publish endpoint import chính thức.">
            <Button icon={<ImportOutlined />} disabled>
              Import SKU cũ
            </Button>
          </Tooltip>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={!canManageMasterData}
            title={canManageMasterData ? undefined : "Bạn không có quyền tạo sản phẩm"}
            onClick={() => setIsSkuModalOpen(true)}
          >
            Tạo sản phẩm
          </Button>
        </Space>
      </div>

     

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
        title={`Chi tiết ${detailState?.title ?? activeConfig.label}`}
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
        title="Tạo sản phẩm/SKU mới"
        open={isSkuModalOpen}
        onOk={() => void handleSkuSave()}
        okText="Lưu"
        confirmLoading={createSkuMutation.isPending}
        onCancel={() => setIsSkuModalOpen(false)}
        width={760}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            status: "active",
            vat_rate: 8,
          }}
        >
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Mã SP"
                name="product_code"
                rules={[{ required: true, message: "Vui lòng nhập mã sản phẩm" }]}
              >
                <Input placeholder="VD: HN-PV-INV-001" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Barcode" name="barcode">
                <Input placeholder="Để trống để hệ thống tự sinh" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label="Tên sản phẩm"
                name="name"
                rules={[{ required: true, message: "Vui lòng nhập tên sản phẩm" }]}
              >
                <Input placeholder="VD: Bo inverter Hoa Nam PV 220V 3kW" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Mô tả" name="description">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Nhà cung cấp" name="supplier_id">
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  loading={suppliersQuery.isLoading}
                  options={supplierOptions}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Danh mục" name="category_id">
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  loading={categoriesQuery.isLoading}
                  options={categoryOptions}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                label="Đơn vị tính"
                name="uom_id"
                rules={[{ required: true, message: "Vui lòng chọn đơn vị tính" }]}
              >
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  loading={uomsQuery.isLoading}
                  options={uomOptions}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                label="Giá niêm yết (chưa VAT)"
                name="list_price_net"
                rules={[{ required: true, message: "Vui lòng nhập giá niêm yết" }]}
              >
              <InputNumber
                min={0}
                precision={0}
                className="full-width"
                formatter={(value) => `${value ?? 0}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                // @ts-expect-error parser return type is too strict
                parser={(value) => Number((value ?? "").replace(/,/g, ""))}
              />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                label="Thuế VAT (%)"
                name="vat_rate"
                rules={[{ required: true, message: "Vui lòng chọn thuế VAT" }]}
              >
                <Select
                  allowClear
                  options={[
                    { label: "0%", value: 0 },
                    { label: "5%", value: 5 },
                    { label: "8%", value: 8 },
                    { label: "10%", value: 10 },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Trạng thái" name="status" rules={[{ required: true }]}>
                <Select options={PRODUCT_STATUS_OPTIONS} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title="Tạo danh mục sản phẩm"
        open={isCategoryModalOpen}
        onOk={() => void handleCategorySave()}
        okText="Lưu"
        confirmLoading={createCategoryMutation.isPending}
        onCancel={() => setIsCategoryModalOpen(false)}
        width={640}
      >
        <Form
          form={categoryForm}
          layout="vertical"
          initialValues={{ status: 1, sort_order: 0 }}
        >
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item label="Mã danh mục" name="code" rules={[{ required: true }]}>
                <Input placeholder="VD: DM001" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Tên danh mục" name="name" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Danh mục cha" name="parent_id">
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  loading={categoriesQuery.isLoading}
                  options={categoryOptions}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item label="Thứ tự" name="sort_order">
                <InputNumber min={0} precision={0} className="full-width" />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item label="Trạng thái" name="status">
                <Select options={CATEGORY_STATUS_OPTIONS} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}
