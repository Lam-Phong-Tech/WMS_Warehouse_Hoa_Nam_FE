import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Descriptions, Modal, Space, Tag } from "antd";
import {
  CloseCircleOutlined,
  CloseOutlined,
  CloudDownloadOutlined,
  CloudUploadOutlined,
  EditOutlined,
  EyeOutlined,
  ImportOutlined,
  PlusOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { toast } from "sonner";
import { SkuImportModal } from "@/modules/master-data/components/SkuImportModal";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import {
  useCreateMvpAgency,
  useCreateMvpDefect,
  useCreateMvpSku,
  useMvpAgencies,
  useMvpDefects,
  useMvpProductCatalogs,
  useMvpSkuHasStock,
  useMvpSkus,
  useSetMvpSkuPublished,
  useUpdateMvpAgency,
  useUpdateMvpDefect,
  useUpdateMvpSku,
} from "@/modules/master-data/hooks/use-mvp-master";
import type {
  AgencyPayload,
  AgencyRecord,
  CatalogRefRecord,
  DefectPayload,
  DefectRecord,
  MasterStatus,
  ProductCatalogRefs,
  SkuPayload,
  SkuRecord,
  SkuType,
} from "@/modules/master-data/types/mvp-master.types";
import {
  getApiErrorMessage,
  getMutationErrorMessage,
  normalizeError,
} from "@/shared/api/api-error";
import {
  MvpPageSizeSelector,
  MvpPaginationFooter,
} from "@/shared/components/mvp/MvpListPagination";
import { resolveApiPagination } from "@/shared/components/mvp/mvp-pagination";
import {
  MvpSelectionCheckbox,
  mvpRowNumber,
} from "@/shared/components/mvp/MvpSelectionCell";
import { WMS_PERMISSION_CATALOG } from "@/shared/constants/wms-permissions";
import {
  MASTER_STATUS_LABELS,
  SKU_TYPE_LABELS,
  businessLabel,
} from "@/shared/constants/business-labels";
import {
  RECIPIENT_TYPES,
  RECIPIENT_TYPE_LABELS,
  recipientTypeLabel,
  type RecipientType,
} from "@/shared/constants/recipient-types";
import { useRowSelection } from "@/shared/hooks/useRowSelection";
import { useAuthStore } from "@/shared/store/auth.store";

const STATUS_OPTIONS: Array<{ value: MasterStatus; label: string }> = [
  { value: "ACTIVE", label: "Đang sử dụng" },
  { value: "INACTIVE", label: "Ngừng sử dụng" },
];

interface ScreenProps {
  openCreateOnMount?: boolean;
}

function useCanManage(permission: string | string[]) {
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  const required = Array.isArray(permission) ? permission : [permission];
  return (
    isSuperAdmin || required.some((code) => permissionCodes.includes(code))
  );
}

function confirmAction({
  title,
  content,
  okText,
}: {
  title: string;
  content: string;
  okText: string;
}): Promise<boolean> {
  return new Promise((resolve) => {
    Modal.confirm({
      title,
      content,
      okText,
      cancelText: "Hủy",
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });
}

function statusClass(status: MasterStatus) {
  return status === "ACTIVE" ? "pill ok" : "pill warn-pill";
}

function masterStatusLabel(status: MasterStatus | string) {
  return businessLabel(MASTER_STATUS_LABELS, status, "Trạng thái khác");
}

function skuTypeLabel(type: SkuType | string) {
  return businessLabel(SKU_TYPE_LABELS, type, "Loại khác");
}

function compactRef(value?: string | null) {
  if (!value) return "—";
  return value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}

function toRefIndex(rows: CatalogRefRecord[] | undefined) {
  return new Map((rows ?? []).map((row) => [row.id, row]));
}

function refLabel(
  index: Map<string, CatalogRefRecord>,
  value?: string | null,
): string {
  if (!value) return "—";
  const found = index.get(value);
  return found ? found.name || found.code : compactRef(value);
}

function ModalActions({
  isSaving,
  onCancel,
  submitLabel,
}: {
  isSaving: boolean;
  onCancel: () => void;
  submitLabel: string;
}) {
  return (
    <div className="toolbar" style={{ marginTop: 16, marginBottom: 0 }}>
      <div className="spacer" />
      <button
        className="btn"
        type="button"
        onClick={onCancel}
        disabled={isSaving}
      >
        <CloseOutlined /> Hủy
      </button>
      <button className="btn primary" type="submit" disabled={isSaving}>
        <SaveOutlined /> {isSaving ? "Đang lưu..." : submitLabel}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}

function MasterSelect({
  value,
  options,
  disabled,
  onChange,
}: {
  value: string;
  options?: CatalogRefRecord[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const rows = options ?? [];
  const isMissing = Boolean(value) && !rows.some((row) => row.id === value);
  return (
    <>
      <select
        className="select"
        style={{ width: "100%" }}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">— Chưa chọn —</option>
        {isMissing ? (
          <option value={value}>
            Giữ liên kết hiện tại (đã ngừng sử dụng)
          </option>
        ) : null}
        {rows.map((row) => (
          <option key={row.id} value={row.id}>
            {row.code} · {row.name}
          </option>
        ))}
      </select>
      {isMissing ? (
        <div className="muted" style={{ marginTop: 4 }}>
          Danh mục đang gán đã ngừng sử dụng — giữ nguyên hoặc chọn danh mục
          khác.
        </div>
      ) : null}
    </>
  );
}

// ===== SKU =====

type SkuFormState = {
  code: string;
  name: string;
  type: SkuType;
  unit: string;
  brandId: string;
  categoryId: string;
  modelId: string;
  powerSourceId: string;
  packageVariantId: string;
  versionCode: string;
  serialTracked: boolean;
  status: MasterStatus;
  publishedToApp: boolean;
};

const EMPTY_SKU_FORM: SkuFormState = {
  code: "",
  name: "",
  type: "PRODUCT",
  unit: "cái",
  brandId: "",
  categoryId: "",
  modelId: "",
  powerSourceId: "",
  packageVariantId: "",
  versionCode: "V1",
  serialTracked: true,
  status: "ACTIVE",
  publishedToApp: false,
};

const EMPTY_CATALOGS: ProductCatalogRefs = {
  brands: [],
  categories: [],
  models: [],
  powerSources: [],
  packageVariants: [],
};

export function SkuMasterScreen({ openCreateOnMount = false }: ScreenProps) {
  const canManage = useCanManage("sku.manage");
  const canPublish = useCanManage(WMS_PERMISSION_CATALOG.PV_PUBLISH);
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<MasterStatus | "">("");
  const [type, setType] = useState<SkuType | "">("");
  const [brandId, setBrandId] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SkuRecord | null>(null);
  const [viewing, setViewing] = useState<SkuRecord | null>(null);
  const [form, setForm] = useState<SkuFormState>(EMPTY_SKU_FORM);
  const [formError, setFormError] = useState("");
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [publishError, setPublishError] = useState<unknown>(null);

  const query = useMvpSkus({
    keyword: keyword.trim(),
    status,
    sku_type: type,
    brand_id: brandId,
    page,
    per_page: perPage,
  });
  const catalogsQuery = useMvpProductCatalogs();
  const createMutation = useCreateMvpSku();
  const updateMutation = useUpdateMvpSku();
  const publishMutation = useSetMvpSkuPublished();
  const isSaving = createMutation.isPending || updateMutation.isPending;
  const editingId = editing?.sku_id ?? editing?.id ?? "";
  const stockLockQuery = useMvpSkuHasStock(
    editingId,
    modalOpen && Boolean(editing),
  );
  const identityLocked = Boolean(editing) && stockLockQuery.data === true;

  const apiRows = useMemo(() => query.data?.data ?? [], [query.data]);
  const catalogs = catalogsQuery.data ?? EMPTY_CATALOGS;
  const brands = catalogs.brands;
  const brandIndex = useMemo(
    () => toRefIndex(catalogs.brands),
    [catalogs.brands],
  );
  const categoryIndex = useMemo(
    () => toRefIndex(catalogs.categories),
    [catalogs.categories],
  );
  const modelIndex = useMemo(
    () => toRefIndex(catalogs.models),
    [catalogs.models],
  );
  const powerSourceIndex = useMemo(
    () => toRefIndex(catalogs.powerSources),
    [catalogs.powerSources],
  );
  const packageVariantIndex = useMemo(
    () => toRefIndex(catalogs.packageVariants),
    [catalogs.packageVariants],
  );
  const rows = useMemo(
    () =>
      brandId ? apiRows.filter((row) => row.brand_id === brandId) : apiRows,
    [apiRows, brandId],
  );
  const pagination = resolveApiPagination(query.data?.meta, {
    page,
    pageSize: perPage,
    rowCount: apiRows.length,
  });
  const rowSelection = useRowSelection(
    rows,
    (record) => record.sku_id ?? record.id ?? "",
  );

  const togglePublish = async (record: SkuRecord) => {
    if (!canPublish) return;
    setPublishError(null);
    const willPublish = !record.published_to_app;
    const skuCode = record.sku_code ?? record.code;
    const confirmed = await confirmAction({
      title: willPublish
        ? "Đưa SKU lên ứng dụng phân vùng?"
        : "Gỡ SKU khỏi ứng dụng phân vùng?",
      content: willPublish
        ? `SKU ${skuCode} sẽ hiển thị trên ứng dụng phân vùng.`
        : `SKU ${skuCode} sẽ không còn hiển thị trên ứng dụng phân vùng.`,
      okText: willPublish ? "Đưa lên ứng dụng" : "Gỡ khỏi ứng dụng",
    });
    if (!confirmed) return;

    try {
      await publishMutation.mutateAsync({
        id: record.sku_id ?? record.id ?? "",
        version: record.version,
        publishedToApp: willPublish,
      });
      toast.success(
        willPublish
          ? "Đã đưa SKU lên ứng dụng phân vùng"
          : "Đã gỡ SKU khỏi ứng dụng phân vùng",
      );
    } catch (error) {
      toast.error(getMutationErrorMessage(error));
      setPublishError(error);
    }
  };

  const openCreate = () => {
    if (!canManage) return;
    setEditing(null);
    setForm({ ...EMPTY_SKU_FORM });
    setFormError("");
    setModalOpen(true);
  };

  useEffect(() => {
    if (openCreateOnMount && canManage) openCreate();
    // openCreate chỉ phụ thuộc trạng thái quyền và cờ mở modal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage, openCreateOnMount]);

  const openEdit = (record: SkuRecord) => {
    if (!canManage) return;
    setEditing(record);
    setForm({
      code: record.sku_code ?? record.code ?? "",
      name: record.sku_name ?? record.name ?? "",
      type: record.sku_type,
      unit: record.unit ?? "",
      brandId: record.brand_id ?? "",
      categoryId: record.category_id ?? "",
      modelId: record.model_id ?? "",
      powerSourceId: record.power_source_id ?? "",
      packageVariantId: record.package_variant_id ?? "",
      versionCode: record.version_code ?? "",
      serialTracked: Boolean(record.is_serial_tracked),
      status: record.status,
      publishedToApp: Boolean(record.published_to_app),
    });
    setFormError("");
    setModalOpen(true);
  };

  const close = () => {
    if (isSaving) return;
    setModalOpen(false);
    setEditing(null);
    setFormError("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    const code = form.code.trim();
    const name = form.name.trim();
    if (!code || !name) {
      setFormError("Mã SKU và tên SKU là bắt buộc.");
      return;
    }
    if (form.publishedToApp && form.status !== "ACTIVE") {
      setFormError("Chỉ SKU đang sử dụng mới được đưa lên ứng dụng phân vùng.");
      return;
    }
    if (
      !form.brandId ||
      !form.categoryId ||
      !form.modelId ||
      !form.powerSourceId
    ) {
      setFormError(
        "Vui lòng chọn đủ Hãng, Nhóm hàng, Model và Nguồn điện cho SKU.",
      );
      return;
    }
    if (form.status === "INACTIVE" && editing?.status === "ACTIVE") {
      const confirmed = await confirmAction({
        title: "Ngừng sử dụng SKU?",
        content:
          "SKU sẽ không còn được chọn cho phiếu mới và sẽ bị gỡ khỏi ứng dụng phân vùng. Lịch sử chứng từ giữ nguyên.",
        okText: "Ngừng sử dụng",
      });
      if (!confirmed) return;
    }

    const payload: SkuPayload = {
      code,
      name,
      sku_type: form.type,
      unit: form.unit.trim() || null,
      is_serial_tracked: form.serialTracked,
      status: form.status,
      published_to_app: form.publishedToApp,
      brand_id: form.brandId,
      category_id: form.categoryId,
      model_id: form.modelId,
      power_source_id: form.powerSourceId,
      package_variant_id: form.packageVariantId,
      version_code: form.versionCode,
    };

    try {
      if (editing) {
        await updateMutation.mutateAsync({
          id: editing.sku_id ?? editing.id ?? "",
          version: editing.version,
          payload,
        });
        toast.success("Đã cập nhật SKU");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Đã thêm SKU");
      }
      setModalOpen(false);
      setEditing(null);
    } catch (error) {
      if (
        normalizeError(error).code === "SKU_IDENTITY_IMMUTABLE_AFTER_STOCK" &&
        editing
      ) {
        setForm((current) => ({
          ...current,
          code: editing.sku_code ?? editing.code ?? current.code,
          serialTracked: Boolean(editing.is_serial_tracked),
        }));
      }
      toast.error(getMutationErrorMessage(error));
      setFormError(getMutationErrorMessage(error));
    }
  };

  return (
    <div className="hn-mvp-source-screen" data-mvp-screen="MST-01">
      <div className="toolbar">
        <input
          className="input search"
          value={keyword}
          onChange={(event) => {
            setKeyword(event.target.value);
            setPage(1);
          }}
          placeholder="Tìm mã / tên SKU"
          aria-label="Tìm SKU"
        />
        <select
          className="select"
          value={type}
          onChange={(event) => {
            setType(event.target.value as SkuType | "");
            setPage(1);
          }}
        >
          <option value="">Loại: Tất cả</option>
          <option value="PRODUCT">Sản phẩm</option>
          <option value="COMPONENT">Linh kiện</option>
        </select>
        <select
          className="select"
          value={brandId}
          aria-label="Lọc theo hãng"
          disabled={catalogsQuery.isLoading}
          onChange={(event) => {
            setBrandId(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Hãng: Tất cả</option>
          {brands.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name || brand.code}
            </option>
          ))}
        </select>
        <select
          className="select"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as MasterStatus | "");
            setPage(1);
          }}
        >
          <option value="">Trạng thái: Tất cả</option>
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <MvpPageSizeSelector
          value={perPage}
          onChange={(value) => {
            setPerPage(value);
            setPage(1);
          }}
        />
        <div className="spacer" />
        {canManage ? (
          <button
            className="btn"
            type="button"
            onClick={() => setImportModalOpen(true)}
          >
            <ImportOutlined /> Nhập từ Excel
          </button>
        ) : null}
        {canManage ? (
          <button className="btn primary" type="button" onClick={openCreate}>
            <PlusOutlined /> Thêm SKU
          </button>
        ) : null}
      </div>

      <ApiErrorAlert
        error={query.error}
        fallback="Không tải được danh sách SKU."
        onRetry={() => void query.refetch()}
      />

      {importModalOpen ? (
        <SkuImportModal
          open={importModalOpen}
          canImport={canManage}
          onClose={() => setImportModalOpen(false)}
          onImported={() => void query.refetch()}
        />
      ) : null}

      {publishError ? (
        <div className="alert" role="alert" style={{ marginBottom: 14 }}>
          {getApiErrorMessage(
            publishError,
            "Không cập nhật được trạng thái hiển thị trên ứng dụng phân vùng.",
          )}{" "}
          <button
            className="btn small"
            type="button"
            onClick={() => setPublishError(null)}
          >
            <CloseCircleOutlined /> Đóng
          </button>
        </div>
      ) : null}

      <div className="table-wrap" aria-busy={query.isLoading}>
        <table>
          <thead>
            <tr>
              <th className="select-col">
                <MvpSelectionCheckbox
                  checked={rowSelection.isAllSelected}
                  indeterminate={rowSelection.isIndeterminate}
                  onChange={rowSelection.toggleAll}
                  ariaLabel="Chọn tất cả SKU"
                />
              </th>
              <th className="stt-col">STT</th>
              <th>SKU</th>
              <th>Loại</th>
              <th>Đơn vị tính</th>
              <th>Hãng</th>
              <th>Nhóm hàng</th>
              <th>Model</th>
              <th>Nguồn điện</th>
              <th>Quản lý số sê-ri</th>
              <th>Trạng thái</th>
              <th>Ứng dụng phân vùng</th>
              <th aria-label="Hành động" />
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              <tr>
                <td colSpan={13} className="muted">
                  Đang tải dữ liệu...
                </td>
              </tr>
            ) : rows.length > 0 ? (
              rows.map((record, index) => {
                const recordId = record.sku_id ?? record.id ?? "";
                const isPublished = Boolean(record.published_to_app);
                const statusAllowsPublish = record.status === "ACTIVE";
                return (
                  <tr key={recordId}>
                    <td className="select-col">
                      <MvpSelectionCheckbox
                        checked={rowSelection.isSelected(recordId)}
                        onChange={(checked) =>
                          rowSelection.toggleOne(recordId, checked)
                        }
                        ariaLabel={`Chọn ${record.sku_code ?? record.code ?? ""}`}
                      />
                    </td>
                    <td className="stt-col">
                      {mvpRowNumber(page, perPage, index)}
                    </td>
                    <td>
                      {record.sku_code ?? record.code}
                      <br />
                      <span className="muted">
                        {record.sku_name ?? record.name}
                      </span>
                    </td>
                    <td>{skuTypeLabel(record.sku_type)}</td>
                    <td>{record.unit || "—"}</td>
                    <td title={record.brand_id ?? undefined}>
                      {refLabel(brandIndex, record.brand_id)}
                    </td>
                    <td title={record.category_id ?? undefined}>
                      {refLabel(categoryIndex, record.category_id)}
                    </td>
                    <td title={record.model_id ?? undefined}>
                      {refLabel(modelIndex, record.model_id)}
                    </td>
                    <td title={record.power_source_id ?? undefined}>
                      {record.power_source_id
                        ? refLabel(powerSourceIndex, record.power_source_id)
                        : record.power_or_voltage || "—"}
                    </td>
                    <td>{record.is_serial_tracked ? "Có" : "Không"}</td>
                    <td>
                      <span className={statusClass(record.status)}>
                        {masterStatusLabel(record.status)}
                      </span>
                    </td>
                    <td>
                      <span
                        className={isPublished ? "pill ok" : "pill warn-pill"}
                        title={
                          isPublished
                            ? "SKU đang hiển thị trên ứng dụng phân vùng"
                            : "SKU chưa hiển thị trên ứng dụng phân vùng"
                        }
                      >
                        {isPublished ? "Đang hiển thị" : "Chưa hiển thị"}
                      </span>
                    </td>
                    <td>
                      <Space size={8} wrap>
                        <button
                          className="btn small"
                          type="button"
                          onClick={() => setViewing(record)}
                        >
                          <EyeOutlined /> Xem
                        </button>
                        {canManage ? (
                          <button
                            className="btn small"
                            type="button"
                            onClick={() => openEdit(record)}
                          >
                            <EditOutlined /> Sửa
                          </button>
                        ) : null}
                        {canPublish ? (
                          <button
                            className="btn small"
                            type="button"
                            disabled={
                              publishMutation.isPending ||
                              (!isPublished && !statusAllowsPublish)
                            }
                            title={
                              !isPublished && !statusAllowsPublish
                                ? "Chỉ SKU đang sử dụng mới được đưa lên ứng dụng phân vùng."
                                : isPublished
                                  ? "Gỡ SKU khỏi ứng dụng phân vùng"
                                  : "Đưa SKU lên ứng dụng phân vùng"
                            }
                            onClick={() => void togglePublish(record)}
                          >
                            {isPublished ? (
                              <>
                                <CloudDownloadOutlined /> Gỡ khỏi ứng dụng
                              </>
                            ) : (
                              <>
                                <CloudUploadOutlined /> Đưa lên ứng dụng
                              </>
                            )}
                          </button>
                        ) : null}
                      </Space>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={13} className="muted">
                  Không có SKU phù hợp bộ lọc.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <MvpPaginationFooter
        current={pagination.current}
        pageSize={perPage}
        total={pagination.total}
        itemLabel="SKU"
        onChange={setPage}
      />

      <Modal
        title="Chi tiết SKU"
        open={Boolean(viewing)}
        onCancel={() => setViewing(null)}
        footer={null}
        width={760}
        centered
        destroyOnHidden
        getContainer={false}
      >
        {viewing ? (
          <Descriptions bordered column={{ xs: 1, md: 2 }} size="small">
            <Descriptions.Item label="Mã SKU">
              {viewing.sku_code ?? viewing.code}
            </Descriptions.Item>
            <Descriptions.Item label="Tên SKU">
              {viewing.sku_name ?? viewing.name}
            </Descriptions.Item>
            <Descriptions.Item label="Loại">
              {skuTypeLabel(viewing.sku_type)}
            </Descriptions.Item>
            <Descriptions.Item label="Đơn vị tính">
              {viewing.unit || "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Hãng">
              {refLabel(brandIndex, viewing.brand_id)}
            </Descriptions.Item>
            <Descriptions.Item label="Nhóm hàng">
              {refLabel(categoryIndex, viewing.category_id)}
            </Descriptions.Item>
            <Descriptions.Item label="Model">
              {refLabel(modelIndex, viewing.model_id)}
            </Descriptions.Item>
            <Descriptions.Item label="Nguồn điện">
              {viewing.power_source_id
                ? refLabel(powerSourceIndex, viewing.power_source_id)
                : viewing.power_or_voltage || "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Quy cách đóng gói">
              {viewing.package_variant_id
                ? refLabel(packageVariantIndex, viewing.package_variant_id)
                : viewing.package_variant || "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Phiên bản sản phẩm">
              {viewing.version_code || "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Quản lý số sê-ri">
              {viewing.is_serial_tracked ? "Có" : "Không"}
            </Descriptions.Item>
            <Descriptions.Item label="Trạng thái">
              <span className={statusClass(viewing.status)}>
                {masterStatusLabel(viewing.status)}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="Ứng dụng phân vùng">
              {viewing.published_to_app ? "Đang hiển thị" : "Chưa hiển thị"}
            </Descriptions.Item>
          </Descriptions>
        ) : null}
      </Modal>

      <Modal
        title={editing ? "Sửa SKU" : "Thêm SKU"}
        open={modalOpen}
        onCancel={close}
        footer={null}
        width={980}
        centered
        getContainer={false}
        mask={{ closable: false }}
        closable={!isSaving}
      >
        <form onSubmit={submit}>
          {formError ? (
            <div className="alert" role="alert">
              {formError}
            </div>
          ) : null}
          <div className="grid-2" style={{ marginTop: formError ? 14 : 0 }}>
            <section className="card">
              <div className="section-title">Thông tin SKU</div>
              <Field label="Mã SKU *">
                <input
                  className="input"
                  style={{ width: "100%" }}
                  value={form.code}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      code: event.target.value,
                    }))
                  }
                  disabled={isSaving || identityLocked}
                />
                {identityLocked ? (
                  <div className="muted" style={{ marginTop: 4 }}>
                    SKU đã có tồn kho — không thể đổi mã SKU.
                  </div>
                ) : null}
              </Field>
              <Field label="Tên SKU *">
                <input
                  className="input"
                  style={{ width: "100%" }}
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  disabled={isSaving}
                />
              </Field>
              <Field label="Loại SKU">
                <select
                  className="select"
                  style={{ width: "100%" }}
                  value={form.type}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      type: event.target.value as SkuType,
                    }))
                  }
                  disabled={isSaving}
                >
                  <option value="PRODUCT">Sản phẩm</option>
                  <option value="COMPONENT">Linh kiện</option>
                </select>
              </Field>
              <Field label="Đơn vị tính">
                <input
                  className="input"
                  style={{ width: "100%" }}
                  value={form.unit}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      unit: event.target.value,
                    }))
                  }
                  disabled={isSaving}
                />
              </Field>
              <Field label="Trạng thái">
                <select
                  className="select"
                  style={{ width: "100%" }}
                  value={form.status}
                  onChange={(event) => {
                    const nextStatus = event.target.value as MasterStatus;
                    setForm((current) => ({
                      ...current,
                      status: nextStatus,
                      publishedToApp:
                        nextStatus === "ACTIVE"
                          ? current.publishedToApp
                          : false,
                    }));
                  }}
                  disabled={isSaving}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Hiển thị trên ứng dụng phân vùng">
                <label
                  style={{ display: "flex", gap: 8, alignItems: "center" }}
                >
                  <input
                    type="checkbox"
                    checked={form.publishedToApp}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        publishedToApp: event.target.checked,
                      }))
                    }
                    disabled={isSaving || form.status !== "ACTIVE"}
                  />
                  Cho phép hiển thị SKU này trên ứng dụng phân vùng
                </label>
                {form.status !== "ACTIVE" ? (
                  <div className="muted" style={{ marginTop: 4 }}>
                    Chỉ SKU đang sử dụng mới được đưa lên ứng dụng.
                  </div>
                ) : null}
              </Field>
            </section>

            <section className="card">
              <div className="section-title">Danh mục tham chiếu</div>
              <div className="muted" style={{ marginBottom: 10 }}>
                Chọn các danh mục đang sử dụng cho Hãng, Nhóm hàng, Model và
                Nguồn điện.
              </div>
              <Field label="Hãng *">
                <MasterSelect
                  value={form.brandId}
                  options={catalogs.brands}
                  disabled={isSaving}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, brandId: value }))
                  }
                />
              </Field>
              <Field label="Nhóm hàng *">
                <MasterSelect
                  value={form.categoryId}
                  options={catalogs.categories}
                  disabled={isSaving}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, categoryId: value }))
                  }
                />
              </Field>
              <Field label="Model *">
                <MasterSelect
                  value={form.modelId}
                  options={catalogs.models}
                  disabled={isSaving}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, modelId: value }))
                  }
                />
              </Field>
              <Field label="Nguồn điện *">
                <MasterSelect
                  value={form.powerSourceId}
                  options={catalogs.powerSources}
                  disabled={isSaving}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, powerSourceId: value }))
                  }
                />
              </Field>
              <Field label="Quy cách đóng gói">
                <MasterSelect
                  value={form.packageVariantId}
                  options={catalogs.packageVariants}
                  disabled={isSaving}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      packageVariantId: value,
                    }))
                  }
                />
              </Field>
              <Field label="Phiên bản sản phẩm">
                <input
                  className="input"
                  style={{ width: "100%" }}
                  value={form.versionCode}
                  placeholder="V1"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      versionCode: event.target.value,
                    }))
                  }
                  disabled={isSaving}
                />
              </Field>
              <Field label="Quản lý số sê-ri">
                <label
                  style={{ display: "flex", gap: 8, alignItems: "center" }}
                >
                  <input
                    type="checkbox"
                    checked={form.serialTracked}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        serialTracked: event.target.checked,
                      }))
                    }
                    disabled={isSaving || identityLocked}
                  />
                  Quản lý riêng từng sản phẩm bằng số sê-ri / mã vật lý
                </label>
                {identityLocked ? (
                  <div className="muted" style={{ marginTop: 4 }}>
                    SKU đã có tồn kho — không thể đổi chế độ quản lý số sê-ri.
                  </div>
                ) : null}
              </Field>
            </section>
          </div>
          <ModalActions
            isSaving={isSaving}
            onCancel={close}
            submitLabel="Lưu SKU"
          />
        </form>
      </Modal>
    </div>
  );
}

// ===== Nơi nhận (REQ-001: distributor / đại lý / khách công trình / khách lẻ) =====

/**
 * Form giữ recipient_type = "" khi chưa chọn (payload thật yêu cầu đúng 1 trong
 * 4 mã RECIPIENT_TYPES) — validate chặn trước submit thay vì gửi chuỗi rỗng.
 */
type AgencyFormState = Omit<AgencyPayload, "recipient_type"> & {
  recipient_type: RecipientType | "";
};

const EMPTY_AGENCY_FORM: AgencyFormState = {
  agency_code: "",
  agency_name: "",
  recipient_type: "",
  market: "",
  region: "",
  contact_name: "",
  phone: "",
  address: "",
  status: "ACTIVE",
};

export function AgencyMasterScreen({ openCreateOnMount = false }: ScreenProps) {
  const canManage = useCanManage("agency.manage");
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<MasterStatus | "">("");
  const [recipientType, setRecipientType] = useState<RecipientType | "">("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AgencyRecord | null>(null);
  const [form, setForm] = useState<AgencyFormState>(EMPTY_AGENCY_FORM);
  const [formError, setFormError] = useState("");

  const query = useMvpAgencies({
    keyword: keyword.trim(),
    status,
    recipient_type: recipientType,
    page,
    per_page: perPage,
  });
  const createMutation = useCreateMvpAgency();
  const updateMutation = useUpdateMvpAgency();
  const isSaving = createMutation.isPending || updateMutation.isPending;
  const rows = query.data?.data ?? [];
  const pagination = resolveApiPagination(query.data?.meta, {
    page,
    pageSize: perPage,
    rowCount: rows.length,
  });
  const rowSelection = useRowSelection(rows, (record) => record.agency_id);

  const openCreate = () => {
    if (!canManage) return;
    setEditing(null);
    setForm({ ...EMPTY_AGENCY_FORM });
    setFormError("");
    setModalOpen(true);
  };

  useEffect(() => {
    if (openCreateOnMount && canManage) openCreate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage, openCreateOnMount]);

  const openEdit = (record: AgencyRecord) => {
    if (!canManage) return;
    setEditing(record);
    setForm({
      agency_code: record.agency_code,
      agency_name: record.agency_name,
      recipient_type: record.recipient_type ?? "",
      market: record.market ?? "",
      region: record.region ?? "",
      contact_name: record.contact_name ?? "",
      phone: record.phone ?? "",
      address: record.address ?? "",
      status: record.status,
    });
    setFormError("");
    setModalOpen(true);
  };

  const close = () => {
    if (isSaving) return;
    setModalOpen(false);
    setEditing(null);
    setFormError("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    // recipient_type required (BE BaM1RecipientController) — chặn tại FE để
    // báo lỗi tiếng Việt thay vì đợi 422.
    if (!form.recipient_type) {
      setFormError("Vui lòng chọn loại nơi nhận.");
      return;
    }
    const payload: AgencyPayload = {
      agency_code: form.agency_code.trim(),
      agency_name: form.agency_name.trim(),
      recipient_type: form.recipient_type,
      market: form.market?.trim() || null,
      region: form.region?.trim() || null,
      contact_name: form.contact_name?.trim() || null,
      phone: form.phone?.trim() || null,
      address: form.address?.trim() || null,
      status: form.status,
    };
    if (!payload.agency_code || !payload.agency_name) {
      setFormError("Mã nơi nhận và tên nơi nhận là bắt buộc.");
      return;
    }
    if (payload.phone && !/^0\d{9}$/.test(payload.phone)) {
      setFormError(
        "Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0.",
      );
      return;
    }
    if (form.status === "INACTIVE" && editing?.status === "ACTIVE") {
      const confirmed = await confirmAction({
        title: "Ngừng sử dụng nơi nhận?",
        content:
          "Nơi nhận sẽ không còn được chọn cho chứng từ mới. Chứng từ đã lập giữ nguyên.",
        okText: "Ngừng sử dụng",
      });
      if (!confirmed) return;
    }

    try {
      if (editing) {
        await updateMutation.mutateAsync({
          id: editing.agency_id,
          payload,
          version: editing.version,
        });
        toast.success("Đã cập nhật nơi nhận");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Đã thêm nơi nhận");
      }
      setModalOpen(false);
      setEditing(null);
    } catch (error) {
      toast.error(getMutationErrorMessage(error));
      setFormError(getMutationErrorMessage(error));
    }
  };

  return (
    <div className="hn-mvp-source-screen" data-mvp-screen="AGY-01">
      <div className="toolbar">
        <input
          className="input search"
          value={keyword}
          onChange={(event) => {
            setKeyword(event.target.value);
            setPage(1);
          }}
          placeholder="Tìm mã / tên / thị trường / khu vực"
        />
        <select
          className="select"
          value={recipientType}
          onChange={(event) => {
            setRecipientType(event.target.value as RecipientType | "");
            setPage(1);
          }}
          aria-label="Lọc theo loại nơi nhận"
        >
          <option value="">Loại nơi nhận: Tất cả</option>
          {RECIPIENT_TYPES.map((value) => (
            <option key={value} value={value}>
              {RECIPIENT_TYPE_LABELS[value]}
            </option>
          ))}
        </select>
        <select
          className="select"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as MasterStatus | "");
            setPage(1);
          }}
        >
          <option value="">Trạng thái: Tất cả</option>
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <MvpPageSizeSelector
          value={perPage}
          onChange={(value) => {
            setPerPage(value);
            setPage(1);
          }}
        />
        <div className="spacer" />
        {canManage ? (
          <button className="btn primary" type="button" onClick={openCreate}>
            <PlusOutlined /> Thêm nơi nhận
          </button>
        ) : null}
      </div>

      <ApiErrorAlert
        error={query.error}
        fallback="Không tải được danh sách nơi nhận."
        onRetry={() => void query.refetch()}
      />

      <div className="table-wrap" aria-busy={query.isLoading}>
        <table>
          <thead>
            <tr>
              <th className="select-col">
                <MvpSelectionCheckbox
                  checked={rowSelection.isAllSelected}
                  indeterminate={rowSelection.isIndeterminate}
                  onChange={rowSelection.toggleAll}
                  ariaLabel="Chọn tất cả nơi nhận"
                />
              </th>
              <th className="stt-col">STT</th>
              <th>Mã</th>
              <th>Tên nơi nhận</th>
              <th>Loại nơi nhận</th>
              <th>Thị trường</th>
              <th>Khu vực</th>
              <th>Người liên hệ</th>
              <th>Điện thoại</th>
              <th>Địa chỉ</th>
              <th>Trạng thái</th>
              <th aria-label="Hành động" />
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              <tr>
                <td colSpan={12} className="muted">
                  Đang tải dữ liệu...
                </td>
              </tr>
            ) : rows.length > 0 ? (
              rows.map((record, index) => (
                <tr key={record.agency_id}>
                  <td className="select-col">
                    <MvpSelectionCheckbox
                      checked={rowSelection.isSelected(record.agency_id)}
                      onChange={(checked) =>
                        rowSelection.toggleOne(record.agency_id, checked)
                      }
                      ariaLabel={`Chọn ${record.agency_name}`}
                    />
                  </td>
                  <td className="stt-col">
                    {mvpRowNumber(page, perPage, index)}
                  </td>
                  <td>{record.agency_code}</td>
                  <td>{record.agency_name}</td>
                  <td>
                    {record.recipient_type ? (
                      <Tag>{recipientTypeLabel(record.recipient_type)}</Tag>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{record.market || "—"}</td>
                  <td>{record.region || "—"}</td>
                  <td>{record.contact_name || "—"}</td>
                  <td>{record.phone || "—"}</td>
                  <td>{record.address || "—"}</td>
                  <td>
                    <span className={statusClass(record.status)}>
                      {masterStatusLabel(record.status)}
                    </span>
                  </td>
                  <td>
                    {canManage ? (
                      <button
                        className="btn small"
                        type="button"
                        onClick={() => openEdit(record)}
                      >
                        <EditOutlined /> Sửa
                      </button>
                    ) : (
                      <span className="muted">Chỉ xem</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={12} className="muted">
                  Không có nơi nhận phù hợp bộ lọc.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <MvpPaginationFooter
        current={pagination.current}
        pageSize={perPage}
        total={pagination.total}
        itemLabel="nơi nhận"
        onChange={setPage}
      />

      <Modal
        title={editing ? "Sửa nơi nhận" : "Thêm nơi nhận"}
        open={modalOpen}
        onCancel={close}
        footer={null}
        width={760}
        centered
        getContainer={false}
        mask={{ closable: false }}
        closable={!isSaving}
      >
        <form onSubmit={submit}>
          {formError ? (
            <div className="alert" role="alert" style={{ marginBottom: 14 }}>
              {formError}
            </div>
          ) : null}
          <div className="grid-2">
            <Field label="Mã nơi nhận *">
              <input
                className="input"
                style={{ width: "100%" }}
                value={form.agency_code}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    agency_code: event.target.value,
                  }))
                }
                disabled={isSaving}
              />
            </Field>
            <Field label="Tên nơi nhận *">
              <input
                className="input"
                style={{ width: "100%" }}
                value={form.agency_name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    agency_name: event.target.value,
                  }))
                }
                disabled={isSaving}
              />
            </Field>
            <Field label="Loại nơi nhận *">
              <select
                className="select"
                style={{ width: "100%" }}
                value={form.recipient_type}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    recipient_type: event.target.value as RecipientType | "",
                  }))
                }
                disabled={isSaving}
              >
                <option value="">Chọn loại nơi nhận</option>
                {RECIPIENT_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {RECIPIENT_TYPE_LABELS[value]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Thị trường">
              <input
                className="input"
                style={{ width: "100%" }}
                value={form.market ?? ""}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    market: event.target.value,
                  }))
                }
                disabled={isSaving}
              />
            </Field>
            <Field label="Khu vực">
              <input
                className="input"
                style={{ width: "100%" }}
                value={form.region ?? ""}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    region: event.target.value,
                  }))
                }
                disabled={isSaving}
              />
            </Field>
            <Field label="Người liên hệ">
              <input
                className="input"
                style={{ width: "100%" }}
                value={form.contact_name ?? ""}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    contact_name: event.target.value,
                  }))
                }
                disabled={isSaving}
              />
            </Field>
            <Field label="Điện thoại">
              <input
                className="input"
                style={{ width: "100%" }}
                value={form.phone ?? ""}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    phone: event.target.value.replace(/\D/g, "").slice(0, 10),
                  }))
                }
                inputMode="numeric"
                maxLength={10}
                disabled={isSaving}
              />
            </Field>
            <Field label="Trạng thái">
              <select
                className="select"
                style={{ width: "100%" }}
                value={form.status}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    status: event.target.value as MasterStatus,
                  }))
                }
                disabled={isSaving}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Địa chỉ">
            <textarea
              className="input"
              style={{ width: "100%", minHeight: 88 }}
              value={form.address ?? ""}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  address: event.target.value,
                }))
              }
              disabled={isSaving}
            />
          </Field>
          <ModalActions
            isSaving={isSaving}
            onCancel={close}
            submitLabel="Lưu nơi nhận"
          />
        </form>
      </Modal>
    </div>
  );
}

// ===== Danh mục lỗi / bệnh =====

const EMPTY_DEFECT_FORM: DefectPayload = {
  defect_code: "",
  defect_name: "",
  description: "",
  status: "ACTIVE",
};

export function DefectMasterScreen({ openCreateOnMount = false }: ScreenProps) {
  const canManage = useCanManage("defect.manage");
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<MasterStatus | "">("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DefectRecord | null>(null);
  const [form, setForm] = useState<DefectPayload>(EMPTY_DEFECT_FORM);
  const [formError, setFormError] = useState("");

  const query = useMvpDefects({
    keyword: keyword.trim(),
    status,
    page,
    per_page: perPage,
  });
  const createMutation = useCreateMvpDefect();
  const updateMutation = useUpdateMvpDefect();
  const isSaving = createMutation.isPending || updateMutation.isPending;
  const rows = query.data?.data ?? [];
  const pagination = resolveApiPagination(query.data?.meta, {
    page,
    pageSize: perPage,
    rowCount: rows.length,
  });
  const rowSelection = useRowSelection(rows, (record) => record.defect_id);

  const openCreate = () => {
    if (!canManage) return;
    setEditing(null);
    setForm({ ...EMPTY_DEFECT_FORM });
    setFormError("");
    setModalOpen(true);
  };

  useEffect(() => {
    if (openCreateOnMount && canManage) openCreate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage, openCreateOnMount]);

  const openEdit = (record: DefectRecord) => {
    if (!canManage) return;
    setEditing(record);
    setForm({
      defect_code: record.defect_code,
      defect_name: record.defect_name,
      description: record.description ?? "",
      status: record.status,
    });
    setFormError("");
    setModalOpen(true);
  };

  const close = () => {
    if (isSaving) return;
    setModalOpen(false);
    setEditing(null);
    setFormError("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    const payload: DefectPayload = {
      defect_code: form.defect_code.trim(),
      defect_name: form.defect_name.trim(),
      description: form.description?.trim() || null,
      status: form.status,
    };
    if (!payload.defect_code || !payload.defect_name) {
      setFormError("Mã lỗi và tên lỗi là bắt buộc.");
      return;
    }
    if (form.status === "INACTIVE" && editing?.status === "ACTIVE") {
      const confirmed = await confirmAction({
        title: "Ngừng sử dụng lỗi / bệnh?",
        content:
          "Lỗi / bệnh sẽ không còn được chọn cho hồ sơ bảo hành mới. Hồ sơ đã gán giữ nguyên.",
        okText: "Ngừng sử dụng",
      });
      if (!confirmed) return;
    }

    try {
      if (editing) {
        await updateMutation.mutateAsync({
          id: editing.defect_id,
          payload,
          version: editing.version,
        });
        toast.success("Đã cập nhật danh mục lỗi");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Đã thêm danh mục lỗi");
      }
      setModalOpen(false);
      setEditing(null);
    } catch (error) {
      toast.error(getMutationErrorMessage(error));
      setFormError(getMutationErrorMessage(error));
    }
  };

  return (
    <div className="hn-mvp-source-screen" data-mvp-screen="DEF-01">
      <div className="toolbar">
        <input
          className="input search"
          value={keyword}
          onChange={(event) => {
            setKeyword(event.target.value);
            setPage(1);
          }}
          placeholder="Tìm mã / tên lỗi"
        />
        <select
          className="select"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as MasterStatus | "");
            setPage(1);
          }}
        >
          <option value="">Trạng thái: Tất cả</option>
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <MvpPageSizeSelector
          value={perPage}
          onChange={(value) => {
            setPerPage(value);
            setPage(1);
          }}
        />
        <div className="spacer" />
        {canManage ? (
          <button className="btn primary" type="button" onClick={openCreate}>
            <PlusOutlined /> Thêm lỗi
          </button>
        ) : null}
      </div>

      <ApiErrorAlert
        error={query.error}
        fallback="Không tải được danh mục lỗi."
        onRetry={() => void query.refetch()}
      />

      <div className="table-wrap" aria-busy={query.isLoading}>
        <table>
          <thead>
            <tr>
              <th className="select-col">
                <MvpSelectionCheckbox
                  checked={rowSelection.isAllSelected}
                  indeterminate={rowSelection.isIndeterminate}
                  onChange={rowSelection.toggleAll}
                  ariaLabel="Chọn tất cả lỗi / bệnh"
                />
              </th>
              <th className="stt-col">STT</th>
              <th>Mã lỗi</th>
              <th>Tên lỗi / bệnh</th>
              <th>Mô tả</th>
              <th>Trạng thái</th>
              <th aria-label="Hành động" />
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              <tr>
                <td colSpan={7} className="muted">
                  Đang tải dữ liệu...
                </td>
              </tr>
            ) : rows.length > 0 ? (
              rows.map((record, index) => (
                <tr key={record.defect_id}>
                  <td className="select-col">
                    <MvpSelectionCheckbox
                      checked={rowSelection.isSelected(record.defect_id)}
                      onChange={(checked) =>
                        rowSelection.toggleOne(record.defect_id, checked)
                      }
                      ariaLabel={`Chọn ${record.defect_name}`}
                    />
                  </td>
                  <td className="stt-col">
                    {mvpRowNumber(page, perPage, index)}
                  </td>
                  <td>{record.defect_code}</td>
                  <td>{record.defect_name}</td>
                  <td>{record.description || "—"}</td>
                  <td>
                    <span className={statusClass(record.status)}>
                      {masterStatusLabel(record.status)}
                    </span>
                  </td>
                  <td>
                    {canManage ? (
                      <button
                        className="btn small"
                        type="button"
                        onClick={() => openEdit(record)}
                      >
                        <EditOutlined /> Sửa
                      </button>
                    ) : (
                      <span className="muted">Chỉ xem</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="muted">
                  Không có danh mục lỗi phù hợp bộ lọc.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <MvpPaginationFooter
        current={pagination.current}
        pageSize={perPage}
        total={pagination.total}
        itemLabel="lỗi / bệnh"
        onChange={setPage}
      />

      <Modal
        title={editing ? "Sửa lỗi / bệnh" : "Thêm lỗi / bệnh"}
        open={modalOpen}
        onCancel={close}
        footer={null}
        width={760}
        centered
        getContainer={false}
        mask={{ closable: false }}
        closable={!isSaving}
      >
        <form onSubmit={submit}>
          {formError ? (
            <div className="alert" role="alert" style={{ marginBottom: 14 }}>
              {formError}
            </div>
          ) : null}
          <div className="grid-2">
            <Field label="Mã lỗi *">
              <input
                className="input"
                style={{ width: "100%" }}
                maxLength={80}
                value={form.defect_code}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    defect_code: event.target.value,
                  }))
                }
                disabled={isSaving}
              />
            </Field>
            <Field label="Tên lỗi / bệnh *">
              <input
                className="input"
                style={{ width: "100%" }}
                maxLength={200}
                value={form.defect_name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    defect_name: event.target.value,
                  }))
                }
                disabled={isSaving}
              />
            </Field>
          </div>
          <Field label="Mô tả">
            <textarea
              className="input"
              style={{ width: "100%", minHeight: 110 }}
              value={form.description ?? ""}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              disabled={isSaving}
            />
          </Field>
          <Field label="Trạng thái">
            <select
              className="select"
              style={{ width: "100%" }}
              value={form.status}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  status: event.target.value as MasterStatus,
                }))
              }
              disabled={isSaving}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <ModalActions
            isSaving={isSaving}
            onCancel={close}
            submitLabel="Lưu danh mục lỗi"
          />
        </form>
      </Modal>
    </div>
  );
}
