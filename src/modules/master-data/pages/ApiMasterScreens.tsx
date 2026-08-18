import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Modal } from "antd";
import {
  CloseCircleOutlined,
  CloseOutlined,
  CloudDownloadOutlined,
  CloudUploadOutlined,
  EditOutlined,
  ImportOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { toast } from "sonner";
import { SkuImportModal } from "@/modules/master-data/components/SkuImportModal";
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
import { useAuthStore } from "@/shared/store/auth.store";

const STATUS_OPTIONS: Array<{ value: MasterStatus; label: string }> = [
  { value: "ACTIVE", label: "ACTIVE" },
  { value: "INACTIVE", label: "INACTIVE" },
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

/**
 * Annex D §8.3: các màn luồng 01 phải hỏi xác nhận trước hành động phá hủy /
 * publish / deactivate. Bọc Modal.confirm thành promise để dùng trong submit
 * handler async mà không phải lồng callback.
 */
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

function compactRef(value?: string | null) {
  if (!value) return "—";
  return value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}

function toRefIndex(rows: CatalogRefRecord[] | undefined) {
  return new Map((rows ?? []).map((row) => [row.id, row]));
}

// MST-01 (wireframe): cột "Hãng" hiển thị tên danh mục, không phải UUID. Nếu
// danh mục chưa nạp được thì rơi về mã rút gọn để vẫn phân biệt được bản ghi.
function refLabel(
  index: Map<string, CatalogRefRecord>,
  value?: string | null,
): string {
  if (!value) return "—";
  const found = index.get(value);
  return found ? found.name || found.code : compactRef(value);
}

function ApiErrorAlert({
  error,
  fallback,
  onRetry,
}: {
  error: unknown;
  fallback: string;
  onRetry: () => void;
}) {
  if (!error) return null;
  return (
    <div className="alert" role="alert" style={{ marginBottom: 14 }}>
      {getApiErrorMessage(error, fallback)}{" "}
      <button className="btn small" type="button" onClick={onRetry}>
        <ReloadOutlined /> Thử lại
      </button>
    </div>
  );
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

/**
 * MST-02: master của SKU là FK theo ERD bảng 16, nên chọn từ danh mục ACTIVE
 * thay vì gõ mã tự do. Giá trị rỗng = chưa gán / gỡ liên kết.
 */
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
  // Bản ghi đang trỏ tới master đã INACTIVE (không nằm trong danh sách ACTIVE)
  // vẫn phải hiển thị được, nếu không việc mở form sửa sẽ âm thầm gỡ liên kết.
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
          <option value={value}>Giữ liên kết hiện tại (đã ngừng dùng)</option>
        ) : null}
        {rows.map((row) => (
          <option key={row.id} value={row.id}>
            {row.code} · {row.name}
          </option>
        ))}
      </select>
      {isMissing ? (
        <div className="muted" style={{ marginTop: 4 }}>
          Master đang gán không còn ACTIVE — giữ nguyên hoặc chọn master khác.
        </div>
      ) : null}
    </>
  );
}

// ===== SKU Master =====

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
  // SRS §3: publish App PV là quyền riêng `pv.publish`, không đi kèm sku.manage.
  const canPublish = useCanManage(["pv.publish", "sku.manage"]);
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<MasterStatus | "">("");
  const [type, setType] = useState<SkuType | "">("");
  const [brandId, setBrandId] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SkuRecord | null>(null);
  const [form, setForm] = useState<SkuFormState>(EMPTY_SKU_FORM);
  const [formError, setFormError] = useState("");
  // WWHN-331 [FE1]: bulk import Excel — cùng quyền sku.manage với CRUD SKU.
  const [importModalOpen, setImportModalOpen] = useState(false);

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
  const [publishError, setPublishError] = useState<unknown>(null);
  const isSaving = createMutation.isPending || updateMutation.isPending;
  const editingId = editing?.sku_id ?? editing?.id ?? "";
  // BR-SKU-10 proactive UX: khoá mã SKU/theo dõi serial ngay khi biết SKU đang
  // có tồn > 0, thay vì chỉ phản ứng sau khi BE trả lỗi 409 lúc lưu. Best-effort
  // (xem hasMvpSkuStock) — BE luôn là chốt chặn thật sự.
  const stockLockQuery = useMvpSkuHasStock(
    editingId,
    modalOpen && Boolean(editing),
  );
  const identityLocked = Boolean(editing) && stockLockQuery.data === true;
  const apiRows = useMemo(() => query.data?.data ?? [], [query.data]);
  const catalogs = catalogsQuery.data ?? EMPTY_CATALOGS;
  const brands = catalogs.brands;
  const brandIndex = useMemo(() => toRefIndex(catalogs.brands), [catalogs]);
  const categoryIndex = useMemo(
    () => toRefIndex(catalogs.categories),
    [catalogs],
  );
  const modelIndex = useMemo(() => toRefIndex(catalogs.models), [catalogs]);
  const powerSourceIndex = useMemo(
    () => toRefIndex(catalogs.powerSources),
    [catalogs],
  );
  // brand_id vẫn được gửi lên GET /products, nhưng BE ProductRepository hiện chỉ
  // filter ['status','sku_type'] nên param có thể bị bỏ qua. Lọc thêm phía client
  // trên trang đang xem để bộ lọc "Hãng" hoạt động ngay; khi BE bổ sung brand_id
  // vào $filterable thì bước lọc này thành no-op.
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

  const togglePublish = async (record: SkuRecord) => {
    if (!canPublish) return;
    setPublishError(null);
    const willPublish = !record.published_to_app;
    // Annex D SCR-IAM-01/§8.3: publish/gỡ publish là thao tác ra ngoài hệ thống
    // (App PV) nên phải xác nhận trước.
    const confirmed = await confirmAction({
      title: willPublish ? "Publish SKU lên App PV?" : "Gỡ SKU khỏi App PV?",
      content: willPublish
        ? `SKU ${record.sku_code ?? record.code} sẽ hiển thị công khai trên App Phân Vùng.`
        : `SKU ${record.sku_code ?? record.code} sẽ không còn hiển thị trên App Phân Vùng.`,
      okText: willPublish ? "Publish" : "Gỡ publish",
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
          ? "Đã publish SKU cho App Phân Vùng"
          : "Đã gỡ publish SKU khỏi App Phân Vùng",
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
    // REQ-SRS-020: chỉ SKU active mới publish. BE là nguồn thực thi (422
    // SKU_PUBLISH_REQUIRES_ACTIVE); chặn thêm phía client để tránh round-trip lỗi.
    if (form.publishedToApp && form.status !== "ACTIVE") {
      setFormError("Chỉ SKU ACTIVE mới được publish cho App PV.");
      return;
    }
    // Wireframe MST-02: Hãng / Category / Model / Nguồn điện là trường bắt buộc.
    if (
      !form.brandId ||
      !form.categoryId ||
      !form.modelId ||
      !form.powerSourceId
    ) {
      setFormError(
        "Vui lòng chọn đủ Hãng, Category, Model và Nguồn điện cho SKU.",
      );
      return;
    }
    // Annex D SCR-MST-01: xác nhận cho hành động phá hủy — ngừng hoạt động SKU.
    if (form.status === "INACTIVE" && editing?.status === "ACTIVE") {
      const confirmed = await confirmAction({
        title: "Ngừng hoạt động SKU?",
        content:
          "SKU sẽ không còn được chọn cho phiếu mới và sẽ bị gỡ khỏi App PV. Lịch sử chứng từ giữ nguyên.",
        okText: "Ngừng hoạt động",
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
      // BR-SKU-10: BE khoá sku_code/is_serial_tracked ngay khi SKU đã có
      // stock/movement, bất kể giá trị mới là gì. Khôi phục 2 ô này về giá trị
      // hiện tại để người dùng có thể lưu lại các thay đổi khác mà không phải
      // tự dò ra field nào gây lỗi. Thông báo lấy trực tiếp từ message của BE
      // (đã thân thiện, tiếng Việt) qua getMutationErrorMessage bên dưới.
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
          <option value="PRODUCT">PRODUCT</option>
          <option value="COMPONENT">COMPONENT</option>
        </select>
        {/* MST-01 wireframe toolbar: bộ lọc "Hãng" cạnh bộ lọc Loại. */}
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
        <div className="spacer" />
        {canManage ? (
          <button
            className="btn"
            type="button"
            onClick={() => setImportModalOpen(true)}
          >
            <ImportOutlined /> Import Excel
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
            "Không cập nhật được trạng thái publish.",
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

      <MvpPageSizeSelector
        value={perPage}
        onChange={(value) => {
          setPerPage(value);
          setPage(1);
        }}
      />

      <div className="table-wrap" aria-busy={query.isLoading}>
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Loại</th>
              <th>ĐVT</th>
              <th>Hãng</th>
              <th>Category</th>
              <th>Model</th>
              <th>Nguồn điện</th>
              <th>Serial</th>
              <th>Trạng thái</th>
              <th>App PV</th>
              <th aria-label="Hành động" />
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              <tr>
                <td colSpan={11} className="muted">
                  Đang tải dữ liệu từ API...
                </td>
              </tr>
            ) : rows.length > 0 ? (
              rows.map((record) => {
                const recordId = record.sku_id ?? record.id ?? "";
                const isPublished = Boolean(record.published_to_app);
                // AC-SRS-020: chỉ SKU ACTIVE mới được publish (khác với quyền
                // `pv.publish` ở biến canPublish cấp màn hình).
                const statusAllowsPublish = record.status === "ACTIVE";
                return (
                  <tr key={recordId}>
                    <td>
                      {record.sku_code ?? record.code}
                      <br />
                      <span className="muted">
                        {record.sku_name ?? record.name}
                      </span>
                    </td>
                    <td>{record.sku_type}</td>
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
                        {record.status}
                      </span>
                    </td>
                    <td>
                      <span
                        className={isPublished ? "pill ok" : "pill warn-pill"}
                        title={
                          isPublished
                            ? "SKU đang hiển thị trên App Phân Vùng"
                            : "SKU chưa được đẩy lên App Phân Vùng"
                        }
                      >
                        {isPublished ? "Đã publish" : "Chưa publish"}
                      </span>
                    </td>
                    <td>
                      {canManage || canPublish ? (
                        <>
                          {canManage ? (
                            <button
                              className="btn small"
                              type="button"
                              onClick={() => openEdit(record)}
                            >
                              <EditOutlined /> Sửa
                            </button>
                          ) : null}{" "}
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
                                  ? "Chỉ SKU ACTIVE mới được publish cho App PV."
                                  : isPublished
                                    ? "Gỡ SKU khỏi App Phân Vùng"
                                    : "Đẩy SKU lên App Phân Vùng"
                              }
                              onClick={() => void togglePublish(record)}
                            >
                              {isPublished ? (
                                <>
                                  <CloudDownloadOutlined /> Gỡ publish
                                </>
                              ) : (
                                <>
                                  <CloudUploadOutlined /> Publish App PV
                                </>
                              )}
                            </button>
                          ) : null}
                        </>
                      ) : (
                        <span className="muted">Chỉ xem</span>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={11} className="muted">
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
                    SKU đã có tồn kho — không thể đổi mã SKU (BR-SKU-10).
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
                  <option value="PRODUCT">PRODUCT</option>
                  <option value="COMPONENT">COMPONENT</option>
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
                    const status = event.target.value as MasterStatus;
                    setForm((current) => ({
                      ...current,
                      status,
                      // AC-SRS-020: inactive không được publish — bỏ publish ngay
                      // trên UI khi chuyển khỏi ACTIVE, khớp cascade unpublish của BE.
                      publishedToApp:
                        status === "ACTIVE" ? current.publishedToApp : false,
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
              <Field label="Publish cho App PV">
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
                  Hiển thị SKU này trên App PV
                </label>
                {form.status !== "ACTIVE" ? (
                  <div className="muted" style={{ marginTop: 4 }}>
                    Chỉ SKU ACTIVE mới publish được.
                  </div>
                ) : null}
              </Field>
            </section>
            <section className="card">
              <div className="section-title">Master tham chiếu</div>
              <div className="muted" style={{ marginBottom: 10 }}>
                Chọn từ danh mục ACTIVE (Danh mục Product Master). Wireframe
                MST-02 yêu cầu Hãng / Category / Model / Nguồn điện.
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
              <Field label="Category *">
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
              <Field label="Phiên bản (version_code)">
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
                <div className="muted" style={{ marginTop: 4 }}>
                  Master phiên bản của SKU (REQ-SRS-029), khác với version dùng
                  cho optimistic locking.
                </div>
              </Field>
              <Field label="Theo dõi serial">
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
                  Có quản lý serial/item identity
                </label>
                {identityLocked ? (
                  <div className="muted" style={{ marginTop: 4 }}>
                    SKU đã có tồn kho — không thể đổi chế độ theo dõi serial
                    (BR-SKU-10).
                  </div>
                ) : null}
              </Field>
              {editing ? (
                <Field label="Version hiện tại">
                  <div className="value">{editing.version}</div>
                </Field>
              ) : null}
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

// ===== Agency =====

const EMPTY_AGENCY_FORM: AgencyPayload = {
  agency_code: "",
  agency_name: "",
  contact_name: "",
  phone: "",
  address: "",
  status: "ACTIVE",
};

export function AgencyMasterScreen({ openCreateOnMount = false }: ScreenProps) {
  const canManage = useCanManage("agency.manage");
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<MasterStatus | "">("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AgencyRecord | null>(null);
  const [form, setForm] = useState<AgencyPayload>(EMPTY_AGENCY_FORM);
  const [formError, setFormError] = useState("");
  const query = useMvpAgencies({
    keyword: keyword.trim(),
    status,
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

  const openCreate = () => {
    if (!canManage) return;
    setEditing(null);
    setForm({ ...EMPTY_AGENCY_FORM });
    setFormError("");
    setModalOpen(true);
  };

  useEffect(() => {
    if (openCreateOnMount && canManage) openCreate();
  }, [canManage, openCreateOnMount]);

  const openEdit = (record: AgencyRecord) => {
    if (!canManage) return;
    setEditing(record);
    setForm({
      agency_code: record.agency_code,
      agency_name: record.agency_name,
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
    const payload: AgencyPayload = {
      agency_code: form.agency_code.trim(),
      agency_name: form.agency_name.trim(),
      contact_name: form.contact_name?.trim() || null,
      phone: form.phone?.trim() || null,
      address: form.address?.trim() || null,
      status: form.status,
    };
    if (!payload.agency_code || !payload.agency_name) {
      setFormError("Mã đại lý và tên đại lý là bắt buộc.");
      return;
    }
    // BR-AGY-01: deactivate là hành động phá hủy về mặt nghiệp vụ — đại lý sẽ
    // không còn chọn được cho phiếu mới (Annex D yêu cầu confirm).
    if (form.status === "INACTIVE" && editing?.status === "ACTIVE") {
      const confirmed = await confirmAction({
        title: "Ngừng hoạt động đại lý?",
        content:
          "Đại lý sẽ không còn được chọn cho chứng từ mới. Chứng từ đã lập giữ nguyên.",
        okText: "Ngừng hoạt động",
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
        toast.success("Đã cập nhật đại lý");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Đã thêm đại lý");
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
          placeholder="Tìm mã / tên đại lý"
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
        <div className="spacer" />
        {canManage ? (
          <button className="btn primary" type="button" onClick={openCreate}>
            <PlusOutlined /> Thêm đại lý
          </button>
        ) : null}
      </div>
      <ApiErrorAlert
        error={query.error}
        fallback="Không tải được danh sách đại lý."
        onRetry={() => void query.refetch()}
      />
      <MvpPageSizeSelector
        value={perPage}
        onChange={(value) => {
          setPerPage(value);
          setPage(1);
        }}
      />
      <div className="table-wrap" aria-busy={query.isLoading}>
        <table>
          <thead>
            <tr>
              <th>Mã</th>
              <th>Tên đại lý</th>
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
                <td colSpan={7} className="muted">
                  Đang tải dữ liệu từ API...
                </td>
              </tr>
            ) : rows.length > 0 ? (
              rows.map((record) => (
                <tr key={record.agency_id}>
                  <td>{record.agency_code}</td>
                  <td>{record.agency_name}</td>
                  <td>{record.contact_name || "—"}</td>
                  <td>{record.phone || "—"}</td>
                  <td>{record.address || "—"}</td>
                  <td>
                    <span className={statusClass(record.status)}>
                      {record.status}
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
                  Không có đại lý phù hợp bộ lọc.
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
        itemLabel="đại lý"
        onChange={setPage}
      />
      <Modal
        title={editing ? "Sửa đại lý" : "Thêm đại lý"}
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
            <Field label="Mã đại lý *">
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
            <Field label="Tên đại lý *">
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
                    phone: event.target.value,
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
            submitLabel="Lưu đại lý"
          />
        </form>
      </Modal>
    </div>
  );
}

// ===== Defect Catalog =====

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

  const openCreate = () => {
    if (!canManage) return;
    setEditing(null);
    setForm({ ...EMPTY_DEFECT_FORM });
    setFormError("");
    setModalOpen(true);
  };

  useEffect(() => {
    if (openCreateOnMount && canManage) openCreate();
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
    // BR-DEF-01..04: inactive không chọn mới, lịch sử case giữ nguyên.
    if (form.status === "INACTIVE" && editing?.status === "ACTIVE") {
      const confirmed = await confirmAction({
        title: "Ngừng sử dụng bệnh/lỗi?",
        content:
          "Bệnh/lỗi sẽ không còn được chọn cho hồ sơ bảo hành mới. Hồ sơ đã gán giữ nguyên.",
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
      <MvpPageSizeSelector
        value={perPage}
        onChange={(value) => {
          setPerPage(value);
          setPage(1);
        }}
      />
      <div className="table-wrap" aria-busy={query.isLoading}>
        <table>
          <thead>
            <tr>
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
                <td colSpan={5} className="muted">
                  Đang tải dữ liệu từ API...
                </td>
              </tr>
            ) : rows.length > 0 ? (
              rows.map((record) => (
                <tr key={record.defect_id}>
                  <td>{record.defect_code}</td>
                  <td>{record.defect_name}</td>
                  <td>{record.description || "—"}</td>
                  <td>
                    <span className={statusClass(record.status)}>
                      {record.status}
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
                <td colSpan={5} className="muted">
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
