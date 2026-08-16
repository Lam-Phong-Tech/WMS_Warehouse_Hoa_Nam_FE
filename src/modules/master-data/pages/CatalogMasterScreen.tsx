import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  Tabs,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  EditOutlined,
  PlusOutlined,
  ProfileOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  catalogMasterSupportsBrand,
  createCatalogMaster,
  getActiveBrandOptions,
  getCatalogMasters,
  updateCatalogMaster,
  type CatalogMasterKind,
  type CatalogMasterPayload,
  type CatalogMasterRecord,
} from "@/modules/master-data/services/catalog-master.service";
import type { MasterStatus } from "@/modules/master-data/types/mvp-master.types";
import { getApiErrorMessage, normalizeError } from "@/shared/api/api-error";
import { MvpPageSizeSelector } from "@/shared/components/mvp/MvpListPagination";
import { resolveApiPagination } from "@/shared/components/mvp/mvp-pagination";
import { useCan } from "@/shared/components/permission";
import { WMS_PERMISSION_CATALOG as P } from "@/shared/constants/wms-permissions";

interface CatalogTabMeta {
  kind: CatalogMasterKind;
  label: string;
  /** Danh từ dùng trong nút tạo, tiêu đề modal và tổng số dòng. */
  itemLabel: string;
  codeLabel: string;
  nameLabel: string;
  codePlaceholder: string;
  namePlaceholder: string;
}

const CATALOG_TABS: CatalogTabMeta[] = [
  {
    kind: "BRAND",
    label: "Hãng",
    itemLabel: "hãng",
    codeLabel: "Mã hãng",
    nameLabel: "Tên hãng",
    codePlaceholder: "DONGCHENG",
    namePlaceholder: "Dongcheng",
  },
  {
    kind: "CATEGORY",
    label: "Nhóm hàng",
    itemLabel: "nhóm hàng",
    codeLabel: "Mã nhóm hàng",
    nameLabel: "Tên nhóm hàng",
    codePlaceholder: "DRILL",
    namePlaceholder: "Máy khoan",
  },
  {
    kind: "MODEL",
    label: "Model",
    itemLabel: "model",
    codeLabel: "Mã model",
    nameLabel: "Tên model",
    codePlaceholder: "DJZ10A",
    namePlaceholder: "Máy khoan DJZ10A",
  },
  {
    kind: "POWER_SOURCE",
    label: "Nguồn điện",
    itemLabel: "nguồn điện",
    codeLabel: "Mã nguồn điện",
    nameLabel: "Tên nguồn điện",
    codePlaceholder: "MAINS_DIRECT",
    namePlaceholder: "Điện lưới trực tiếp",
  },
  {
    kind: "PACKAGE",
    label: "Quy cách đóng gói",
    itemLabel: "quy cách đóng gói",
    codeLabel: "Mã quy cách",
    nameLabel: "Tên quy cách",
    codePlaceholder: "BOX-STD",
    namePlaceholder: "Hộp tiêu chuẩn",
  },
];

const STATUS_OPTIONS: Array<{ value: MasterStatus; label: string }> = [
  { value: "ACTIVE", label: "Đang dùng" },
  { value: "INACTIVE", label: "Ngừng dùng" },
];

interface CatalogFormValues {
  code: string;
  name: string;
  brand_id?: string;
  description?: string;
  sort_order?: number;
  status: MasterStatus;
}

const EMPTY_FORM: CatalogFormValues = {
  code: "",
  name: "",
  brand_id: undefined,
  description: "",
  sort_order: 0,
  status: "ACTIVE",
};

/**
 * BE (CurrentBaselineMasterController) là nguồn thực thi BR-MST-01..07; FE chỉ
 * diễn giải mã lỗi thành câu hướng dẫn thao tác tiếp theo.
 */
function saveErrorMessage(error: unknown): string {
  const normalized = normalizeError(error);
  if (normalized.code === "MASTER_CODE_IMMUTABLE_AFTER_USE") {
    return "Mã master đã được SKU tham chiếu nên không được đổi (BR-MST). Giữ nguyên mã và chỉ sửa tên/mô tả, hoặc tạo master mới rồi ngừng dùng master cũ.";
  }
  if (normalized.code === "STALE_VERSION") {
    return "Bản ghi đã được người khác cập nhật. Bấm Làm mới để tải bản mới nhất rồi sửa lại.";
  }
  if (normalized.code === "BRAND_NOT_ACTIVE") {
    return "Model chỉ được tham chiếu hãng đang ở trạng thái Đang dùng. Chọn hãng khác hoặc kích hoạt lại hãng trước.";
  }
  return getApiErrorMessage(error, "Không lưu được danh mục.");
}

export function CatalogMasterScreen() {
  const [form] = Form.useForm<CatalogFormValues>();
  const queryClient = useQueryClient();
  const canManage = useCan(P.CATALOG_MANAGE);

  const [activeKind, setActiveKind] = useState<CatalogMasterKind>("BRAND");
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<MasterStatus | "">("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] =
    useState<CatalogMasterRecord | null>(null);
  const [formError, setFormError] = useState("");

  const activeTab =
    CATALOG_TABS.find((tab) => tab.kind === activeKind) ?? CATALOG_TABS[0];
  const supportsBrand = catalogMasterSupportsBrand(activeKind);

  const listParams = {
    keyword: keyword.trim(),
    status: statusFilter,
    page,
    per_page: perPage,
  };

  const listQuery = useQuery({
    queryKey: ["catalog-master", activeKind, listParams],
    queryFn: () => getCatalogMasters(activeKind, listParams),
  });

  // Danh sách hãng nạp riêng vì bảng Model chỉ lưu brand_id, cần map sang tên
  // và cấp option cho form; danh mục đổi ít nên cache lâu.
  const brandQuery = useQuery({
    queryKey: ["catalog-master", "brand-options"],
    queryFn: getActiveBrandOptions,
    enabled: supportsBrand,
    staleTime: 5 * 60_000,
  });

  const rows = listQuery.data?.data ?? [];
  const pagination = resolveApiPagination(listQuery.data?.meta, {
    page,
    pageSize: perPage,
    rowCount: rows.length,
  });

  const brandOptions = useMemo(
    () =>
      (brandQuery.data ?? []).map((brand) => ({
        value: brand.id,
        label: `${brand.code} · ${brand.name}`,
      })),
    [brandQuery.data],
  );
  const brandNameById = useMemo(() => {
    const map = new Map<string, string>();
    (brandQuery.data ?? []).forEach((brand) => map.set(brand.id, brand.name));
    return map;
  }, [brandQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (values: CatalogFormValues) => {
      const payload: CatalogMasterPayload = {
        code: values.code,
        name: values.name,
        description: values.description ?? null,
        sort_order: values.sort_order ?? 0,
        status: values.status,
        brand_id: supportsBrand ? (values.brand_id ?? null) : null,
      };
      return editingRecord
        ? updateCatalogMaster(
            activeKind,
            editingRecord.id,
            payload,
            editingRecord.version,
          )
        : createCatalogMaster(activeKind, payload);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["catalog-master"] }),
  });

  const changeTab = (key: string) => {
    setActiveKind(key as CatalogMasterKind);
    setKeyword("");
    setStatusFilter("");
    setPage(1);
  };

  const openCreate = () => {
    setEditingRecord(null);
    setFormError("");
    form.resetFields();
    setIsModalOpen(true);
  };

  const openEdit = (record: CatalogMasterRecord) => {
    setEditingRecord(record);
    setFormError("");
    form.setFieldsValue({
      code: record.code,
      name: record.name,
      brand_id: record.brand_id ?? undefined,
      description: record.description ?? "",
      sort_order: record.sort_order,
      status: record.status,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (saveMutation.isPending) return;
    setIsModalOpen(false);
    setEditingRecord(null);
    setFormError("");
  };

  const handleSubmit = async () => {
    setFormError("");
    let values: CatalogFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    try {
      await saveMutation.mutateAsync(values);
      setIsModalOpen(false);
      setEditingRecord(null);
    } catch (error) {
      setFormError(saveErrorMessage(error));
    }
  };

  const columns: ColumnsType<CatalogMasterRecord> = [
    {
      title: activeTab.codeLabel,
      dataIndex: "code",
      width: 200,
      render: (value: string) => <Typography.Text strong>{value}</Typography.Text>,
    },
    { title: activeTab.nameLabel, dataIndex: "name" },
    ...(supportsBrand
      ? [
          {
            title: "Hãng",
            dataIndex: "brand_id",
            width: 180,
            render: (value: string | null) =>
              value ? (
                (brandNameById.get(value) ?? value)
              ) : (
                <Typography.Text type="secondary">—</Typography.Text>
              ),
          } as ColumnsType<CatalogMasterRecord>[number],
        ]
      : []),
    {
      title: "Mô tả",
      dataIndex: "description",
      render: (value: string | null) =>
        value ? value : <Typography.Text type="secondary">—</Typography.Text>,
    },
    { title: "Thứ tự", dataIndex: "sort_order", width: 90, align: "right" },
    {
      title: "Trạng thái",
      dataIndex: "status",
      width: 130,
      render: (value: MasterStatus) => (
        <Tag color={value === "ACTIVE" ? "success" : "default"}>
          {value === "ACTIVE" ? "Đang dùng" : "Ngừng dùng"}
        </Tag>
      ),
    },
    {
      title: "",
      key: "actions",
      width: 96,
      render: (_, record) =>
        canManage ? (
          <Button
            type="text"
            icon={<EditOutlined />}
            aria-label={`Sửa ${record.code}`}
            onClick={() => openEdit(record)}
          >
            Sửa
          </Button>
        ) : null,
    },
  ];

  const listError = listQuery.error
    ? getApiErrorMessage(listQuery.error, "Không tải được danh mục.")
    : "";

  const panel = (
    <>
      {listError && (
        <Alert
          type="error"
          showIcon
          title={listError}
          style={{ marginBottom: 12 }}
        />
      )}

      <Row gutter={[12, 12]} align="middle" style={{ marginBottom: 12 }}>
        <Col xs={24} md={10}>
          <Input
            allowClear
            value={keyword}
            placeholder={`Tìm mã / tên ${activeTab.itemLabel}`}
            aria-label={`Tìm ${activeTab.itemLabel}`}
            onChange={(event) => {
              setKeyword(event.target.value);
              setPage(1);
            }}
          />
        </Col>
        <Col xs={24} md={6}>
          <Select<MasterStatus | "">
            value={statusFilter}
            style={{ width: "100%" }}
            aria-label="Lọc theo trạng thái"
            onChange={(value) => {
              setStatusFilter(value);
              setPage(1);
            }}
            options={[
              { value: "", label: "Trạng thái: Tất cả" },
              ...STATUS_OPTIONS,
            ]}
          />
        </Col>
        <Col xs={24} md={8}>
          <MvpPageSizeSelector
            value={perPage}
            onChange={(value) => {
              setPerPage(value);
              setPage(1);
            }}
          />
        </Col>
      </Row>

      <Table<CatalogMasterRecord>
        rowKey="id"
        size="small"
        loading={listQuery.isLoading || listQuery.isFetching}
        dataSource={rows}
        columns={columns}
        locale={{ emptyText: `Chưa có ${activeTab.itemLabel} nào.` }}
        pagination={{
          current: pagination.current,
          pageSize: perPage,
          total: pagination.total,
          showSizeChanger: false,
          showTotal: (total) => `Tổng ${total} ${activeTab.itemLabel}`,
          onChange: setPage,
        }}
      />
    </>
  );

  return (
    <Space orientation="vertical" size={16} style={{ width: "100%" }}>
      <Row justify="space-between" align="middle" gutter={[12, 12]}>
        <Col>
          <Space align="center">
            <ProfileOutlined />
            <div>
              <Typography.Title level={3} style={{ margin: 0 }}>
                Danh mục Product Master
              </Typography.Title>
              <Typography.Text type="secondary">
                Hãng / nhóm hàng / model / nguồn điện / quy cách đóng gói dùng
                cho form tạo SKU (REQ-SRS-029).
              </Typography.Text>
            </div>
          </Space>
        </Col>
        <Col>
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                void listQuery.refetch();
                void brandQuery.refetch();
              }}
            >
              Làm mới
            </Button>
            {canManage && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={openCreate}
              >
                Tạo {activeTab.itemLabel}
              </Button>
            )}
          </Space>
        </Col>
      </Row>

      <Alert
        type="info"
        showIcon
        title="Quy tắc danh mục (BR-MST)"
        description="Danh mục không có thao tác xoá: ngừng dùng bằng cách chuyển trạng thái sang INACTIVE. Mã đã được SKU tham chiếu là bất biến — muốn đổi mã phải tạo master mới. Model chỉ được gắn hãng đang ở trạng thái Đang dùng."
      />

      <Card styles={{ body: { paddingTop: 12 } }}>
        <Tabs
          activeKey={activeKind}
          onChange={changeTab}
          items={CATALOG_TABS.map((tab) => ({
            key: tab.kind,
            label: tab.label,
            // Chỉ tab đang mở mới dựng bảng: mọi tab dùng chung một bộ state
            // filter/paging nên tránh render năm bảng cùng lúc.
            children: tab.kind === activeKind ? panel : null,
          }))}
        />
      </Card>

      <Modal
        title={`${editingRecord ? "Sửa" : "Tạo"} ${activeTab.itemLabel}`}
        open={isModalOpen}
        onCancel={closeModal}
        onOk={handleSubmit}
        okText={saveMutation.isPending ? "Đang lưu..." : "Lưu"}
        cancelText="Hủy"
        confirmLoading={saveMutation.isPending}
        centered
        width={640}
        mask={{ closable: false }}
        // Form phải mount sẵn thì form.setFieldsValue lúc bấm Sửa mới nạp được
        // dữ liệu dòng đang chọn (antd bỏ qua lời gọi khi instance chưa gắn).
        forceRender
      >
        {formError && (
          <Alert
            type="error"
            showIcon
            title={formError}
            style={{ marginBottom: 12 }}
          />
        )}
        <Form form={form} layout="vertical" initialValues={EMPTY_FORM}>
          <Form.Item
            name="code"
            label={activeTab.codeLabel}
            rules={[
              { required: true, message: `Nhập ${activeTab.codeLabel}.` },
              { max: 80, message: "Tối đa 80 ký tự." },
            ]}
            extra={
              editingRecord
                ? "Mã đã được SKU tham chiếu sẽ bị BE từ chối khi đổi (409 MASTER_CODE_IMMUTABLE_AFTER_USE)."
                : undefined
            }
          >
            <Input
              placeholder={activeTab.codePlaceholder}
              disabled={saveMutation.isPending}
            />
          </Form.Item>
          <Form.Item
            name="name"
            label={activeTab.nameLabel}
            rules={[
              { required: true, message: `Nhập ${activeTab.nameLabel}.` },
              { max: 200, message: "Tối đa 200 ký tự." },
            ]}
          >
            <Input
              placeholder={activeTab.namePlaceholder}
              disabled={saveMutation.isPending}
            />
          </Form.Item>
          {supportsBrand && (
            <Form.Item
              name="brand_id"
              label="Hãng"
              extra="Chỉ liệt kê hãng đang ở trạng thái Đang dùng."
            >
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Chọn hãng (không bắt buộc)"
                loading={brandQuery.isLoading}
                options={brandOptions}
                disabled={saveMutation.isPending}
              />
            </Form.Item>
          )}
          <Form.Item
            name="description"
            label="Mô tả"
            rules={[{ max: 2000, message: "Tối đa 2000 ký tự." }]}
          >
            <Input.TextArea rows={3} disabled={saveMutation.isPending} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="sort_order" label="Thứ tự hiển thị">
                <InputNumber
                  min={0}
                  style={{ width: "100%" }}
                  disabled={saveMutation.isPending}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="status"
                label="Trạng thái"
                rules={[{ required: true, message: "Chọn trạng thái." }]}
              >
                <Select
                  options={STATUS_OPTIONS}
                  disabled={saveMutation.isPending}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </Space>
  );
}
