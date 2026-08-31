import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
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
  resolveFormErrors,
} from "@/shared/api/api-error";
import { MvpPaginationFooter } from "@/shared/components/mvp/MvpListPagination";
import {
  MVP_PAGE_SIZE_OPTIONS,
  resolveApiPagination,
} from "@/shared/components/mvp/mvp-pagination";
import {
  MvpSelectionCheckbox,
  mvpRowNumber,
} from "@/shared/components/mvp/MvpSelectionCell";
import {
  WMS_PERMISSION_CATALOG,
  hasAnyWmsPermission,
} from "@/shared/constants/wms-permissions";
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
import { SortableTh } from "@/shared/components/data-display/SortableTh";
import { useClientSort } from "@/shared/components/data-display/useClientSort";
import { guardBackdropClose } from "@/shared/utils/dialogGuard";
import { ActionButton, ActionIconButton } from "@/shared/components/actions";
import {
  Box,
  Checkbox,
  FormControlLabel,
  Grid,
  MenuItem,
  Stack,
  UiAlert,
  UiDescriptions,
  UiDialog,
  UiSelect,
  UiStatusBadge,
  UiTextField,
  useUiConfirm,
} from "@/shared/ui";
import { useSearchParams } from "react-router-dom";

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
  // hasAnyWmsPermission thay cho `includes()` tự viết: giữ đúng một quy tắc so
  // khớp mã quyền cho toàn FE (route guard, menu, nút hành động), tránh ba cách
  // hiểu khác nhau về cùng một mã alias.
  return hasAnyWmsPermission(permissionCodes, required, isSuperAdmin);
}

// confirmAction cấp module (antd Modal.confirm) đã thay bằng useUiConfirm
// trong từng screen (Part 3) — cùng promise-contract, render UiConfirmDialog.

// statusClass (`.pill ok/warn-pill` của wireframe CSS) đã thay bằng
// UiStatusBadge tone success/warning render trực tiếp tại chỗ (Part 4).

function masterStatusTone(status: MasterStatus): "success" | "warning" {
  return status === "ACTIVE" ? "success" : "warning";
}

function masterStatusLabel(status: MasterStatus | string) {
  return businessLabel(MASTER_STATUS_LABELS, status, "Trạng thái khác");
}

function skuTypeLabel(type: SkuType | string) {
  return businessLabel(SKU_TYPE_LABELS, type, "Loại khác");
}

/**
 * Định mức tồn chưa đặt (null) hiển thị "—"; 0 phải hiện là "0" vì đó là một
 * định mức THẬT (cảnh báo khi hết hàng), không phải "chưa cấu hình".
 */
function stockThresholdLabel(value?: number | string | null): string {
  if (value === null || value === undefined || value === "") return "—";
  const num = Number(value);
  return Number.isFinite(num) ? num.toLocaleString("vi-VN") : String(value);
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
  // KHÔNG rơi xuống compactRef(value) (UUID rút gọn): cột này là TÊN hãng/nhóm
  // hàng. Chưa tra ra tên thì hiện "—", không lộ định danh nội bộ.
  return found ? found.name || found.code : "—";
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
  // GĐ1 Dashboard "tồn dưới/vượt định mức": chuỗi rỗng = chưa đặt định mức,
  // không tính cảnh báo cho SKU này (khác 0 — 0 vẫn là 1 định mức thật).
  minStock: string;
  maxStock: string;
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
  minStock: "",
  maxStock: "",
};

/**
 * Các ô nhập có chỗ hiển thị lỗi riêng (`error` + `helperText`) trong modal SKU.
 * Lỗi server thuộc field nằm ngoài danh sách này sẽ rơi về banner tổng — xem
 * `resolveFormErrors`. Tên field ở dạng camelCase vì `extractFieldErrors` đã
 * chuyển snake_case của BE (`power_source_id`) sang camelCase (`powerSourceId`).
 */
const SKU_FORM_FIELDS = [
  "code",
  "name",
  "unit",
  "brandId",
  "categoryId",
  "modelId",
  "powerSourceId",
  "packageVariantId",
  "versionCode",
  "publishedToApp",
  "minStock",
  "maxStock",
] as const satisfies readonly (keyof SkuFormState)[];

const EMPTY_CATALOGS: ProductCatalogRefs = {
  brands: [],
  categories: [],
  models: [],
  powerSources: [],
  packageVariants: [],
};

/**
 * Cột chứa văn bản tự do dài (Địa chỉ, Mô tả) cần ghi đè `white-space: nowrap`
 * mặc định của bảng MVP (hn-wms-source-screen.css) để tránh bảng bị kéo giãn
 * bất thường theo chiều ngang khi dữ liệu dài — cho xuống dòng có kiểm soát
 * thay vì tràn ngang. Không áp cho cột mã (SKU/hãng/lỗi) vì các mã đó ngắn và
 * không được phép ẩn/cắt.
 */
const WRAP_TEXT_CELL_STYLE: CSSProperties = {
  whiteSpace: "normal",
  wordBreak: "break-word",
  maxWidth: 320,
};

/**
 * Khung cuộn của bảng HTML thô — thay class `.table-wrap` (wireframe CSS):
 * cùng border/radius nhưng lấy từ theme token, không phụ thuộc CSS global.
 */
const TABLE_WRAP_SX = {
  overflowX: "auto",
  border: 1,
  borderColor: "divider",
  borderRadius: 2.5,
} as const;

/** Thanh công cụ lọc — thay class `.toolbar` (wireframe CSS). */
const TOOLBAR_SX = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 1,
  mb: "14px",
} as const;

/** Chú thích phụ dưới ô nhập (thay Typography caption của MUI). */
const FIELD_CAPTION_SX = {
  display: "block",
  mt: 0.5,
  fontSize: 12,
  color: "text.secondary",
} as const;

/**
 * Bản UiTextField select cho form SKU — KHÔNG dùng lại UiSelect (bản toolbar,
 * không có label nổi/error/helperText). Giữ đúng hành vi gốc: option "Giữ liên
 * kết hiện tại (đã ngừng sử dụng)" khi giá trị đang chọn không còn trong danh
 * sách ACTIVE.
 */
function SkuCatalogSelect({
  id,
  label,
  required,
  value,
  options,
  disabled,
  onChange,
  error,
}: {
  id: string;
  label: string;
  required?: boolean;
  value: string;
  options?: CatalogRefRecord[];
  disabled?: boolean;
  onChange: (value: string) => void;
  error?: string;
}) {
  const rows = options ?? [];
  const isMissing = Boolean(value) && !rows.some((row) => row.id === value);
  return (
    <Box>
      <UiTextField
        id={id}
        select
        label={label}
        required={required}
        disabled={disabled}
        fullWidth
        value={value}
        onChange={(event) => onChange(event.target.value)}
        error={Boolean(error)}
        helperText={error}
        slotProps={{
          select: { displayEmpty: true },
          inputLabel: { shrink: true },
        }}
      >
        <MenuItem value="">— Chưa chọn —</MenuItem>
        {isMissing ? (
          <MenuItem value={value}>
            Giữ liên kết hiện tại (đã ngừng sử dụng)
          </MenuItem>
        ) : null}
        {rows.map((row) => (
          <MenuItem key={row.id} value={row.id}>
            {row.code} · {row.name}
          </MenuItem>
        ))}
      </UiTextField>
      {!error && isMissing ? (
        <Box sx={FIELD_CAPTION_SX}>
          Danh mục đang gán đã ngừng sử dụng — giữ nguyên hoặc chọn danh mục
          khác.
        </Box>
      ) : null}
    </Box>
  );
}

export function SkuMasterScreen({ openCreateOnMount = false }: ScreenProps) {
  // Deep-link ?screen=MST-02 (mo modal tao) — page tu xu ly sau khi go bypass layout.
  const [skuSearchParams] = useSearchParams();
  const openCreateRequested =
    openCreateOnMount || skuSearchParams.get("screen") === "MST-02";
  const canManage = useCanManage("sku.manage");
  const { confirm: confirmAction, confirmDialog } = useUiConfirm();
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
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
  const { sortedRows, sortState, requestSort } = useClientSort(rows, {
    skuCode: (r) => r.sku_code ?? r.code,
    type: (r) => skuTypeLabel(r.sku_type),
    brand: (r) => refLabel(brandIndex, r.brand_id),
    category: (r) => refLabel(categoryIndex, r.category_id),
    minStock: (r) => r.min_stock ?? null,
    maxStock: (r) => r.max_stock ?? null,
    status: (r) => r.status,
    published: (r) => (r.published_to_app ? 1 : 0),
  });

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
      confirmText: willPublish ? "Đưa lên ứng dụng" : "Gỡ khỏi ứng dụng",
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
    setFieldErrors({});
    setModalOpen(true);
  };

  useEffect(() => {
    if (openCreateRequested && canManage) openCreate();
    // openCreate chỉ phụ thuộc trạng thái quyền và cờ mở modal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage, openCreateRequested]);

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
      minStock: record.min_stock != null ? String(record.min_stock) : "",
      maxStock: record.max_stock != null ? String(record.max_stock) : "",
    });
    setFormError("");
    setFieldErrors({});
    setModalOpen(true);
  };

  const close = () => {
    if (isSaving) return;
    setModalOpen(false);
    setEditing(null);
    setFormError("");
    setFieldErrors({});
  };

  const validateSkuForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.code.trim()) errors.code = "Mã SKU là bắt buộc.";
    if (!form.name.trim()) errors.name = "Tên SKU là bắt buộc.";
    if (!form.brandId) errors.brandId = "Vui lòng chọn Hãng.";
    if (!form.categoryId) errors.categoryId = "Vui lòng chọn Nhóm hàng.";
    if (!form.modelId) errors.modelId = "Vui lòng chọn Model.";
    if (!form.powerSourceId) errors.powerSourceId = "Vui lòng chọn Nguồn điện.";
    if (form.publishedToApp && form.status !== "ACTIVE") {
      errors.publishedToApp =
        "Chỉ SKU đang sử dụng mới được đưa lên ứng dụng phân vùng.";
    }
    // Định mức tồn (phục vụ báo cáo định mức tồn): min ≥ 0 — 0 là định mức
    // THẬT, không phải "chưa đặt"; max ≥ 1; max PHẢI LỚN HƠN min (không phải ≥).
    // Để trống = chưa đặt định mức, không bắt buộc. Cùng rule với BE
    // ValidatesSkuStockThresholds + CHECK chk_skus_stock_thresholds.
    const minStockTrim = form.minStock.trim();
    const maxStockTrim = form.maxStock.trim();
    const minStockNum = minStockTrim === "" ? null : Number(minStockTrim);
    const maxStockNum = maxStockTrim === "" ? null : Number(maxStockTrim);
    if (
      minStockNum !== null &&
      (!Number.isFinite(minStockNum) || minStockNum < 0)
    ) {
      errors.minStock = "Định mức tối thiểu phải là số ≥ 0.";
    }
    if (
      maxStockNum !== null &&
      (!Number.isFinite(maxStockNum) || maxStockNum < 1)
    ) {
      errors.maxStock = "Định mức tối đa phải là số ≥ 1.";
    }
    if (
      !errors.minStock &&
      !errors.maxStock &&
      minStockNum !== null &&
      maxStockNum !== null &&
      maxStockNum <= minStockNum
    ) {
      errors.maxStock = "Định mức tối đa phải lớn hơn định mức tối thiểu.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    if (!validateSkuForm()) return;
    const code = form.code.trim();
    const name = form.name.trim();
    if (form.status === "INACTIVE" && editing?.status === "ACTIVE") {
      const confirmed = await confirmAction({
        title: "Ngừng sử dụng SKU?",
        content:
          "SKU sẽ không còn được chọn cho phiếu mới và sẽ bị gỡ khỏi ứng dụng phân vùng. Lịch sử chứng từ giữ nguyên.",
        confirmText: "Ngừng sử dụng",
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
      min_stock:
        form.minStock.trim() === "" ? null : Number(form.minStock.trim()),
      max_stock:
        form.maxStock.trim() === "" ? null : Number(form.maxStock.trim()),
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
      // Lỗi nào gắn được vào ô nhập thì hiện ngay dưới ô đó (vd mã SKU trùng),
      // banner chỉ giữ phần không thuộc ô nào — trước đây mọi lỗi đều bị dồn
      // vào banner nên người dùng chỉ thấy "Dữ liệu gửi lên không hợp lệ".
      const { fieldErrors: serverFieldErrors, message } = resolveFormErrors(
        error,
        SKU_FORM_FIELDS,
      );
      setFieldErrors((current) => ({ ...current, ...serverFieldErrors }));
      toast.error(getMutationErrorMessage(error));
      setFormError(message ?? "");
    }
  };

  const perPageOptions = MVP_PAGE_SIZE_OPTIONS.includes(
    perPage as (typeof MVP_PAGE_SIZE_OPTIONS)[number],
  )
    ? MVP_PAGE_SIZE_OPTIONS
    : [...MVP_PAGE_SIZE_OPTIONS, perPage].sort((a, b) => a - b);

  return (
    <>
      <div className="hn-mvp-source-screen" data-mvp-screen="MST-01">
        {confirmDialog}
        <Stack direction="row" sx={TOOLBAR_SX}>
          <UiTextField
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value);
              setPage(1);
            }}
            placeholder="Tìm mã / tên SKU"
            slotProps={{ htmlInput: { "aria-label": "Tìm SKU" } }}
            sx={{ minWidth: 190 }}
          />
          <UiSelect
            aria-label="Lọc theo loại SKU"
            value={type}
            onChange={(value) => {
              setType(value as SkuType | "");
              setPage(1);
            }}
            placeholder="Loại: Tất cả"
            minWidth={128}
            options={[
              { value: "PRODUCT", label: "Sản phẩm" },
              { value: "COMPONENT", label: "Linh kiện" },
            ]}
          />
          <UiSelect
            aria-label="Lọc theo hãng"
            value={brandId}
            disabled={catalogsQuery.isLoading}
            onChange={(value) => {
              setBrandId(value);
              setPage(1);
            }}
            placeholder="Hãng: Tất cả"
            minWidth={136}
            options={brands.map((brand) => ({
              value: brand.id,
              label: brand.name || brand.code,
            }))}
          />
          <UiSelect
            aria-label="Lọc theo trạng thái"
            value={status}
            onChange={(value) => {
              setStatus(value as MasterStatus | "");
              setPage(1);
            }}
            placeholder="Trạng thái: Tất cả"
            minWidth={128}
            options={STATUS_OPTIONS}
          />
          <UiSelect
            aria-label="Số dòng mỗi trang"
            value={perPage}
            onChange={(value) => {
              setPerPage(Number(value));
              setPage(1);
            }}
            minWidth={92}
            options={perPageOptions.map((size) => ({
              value: size,
              label: `${size} / trang`,
            }))}
          />
          <Box sx={{ flex: 1 }} />
          {canManage ? (
            <ActionButton
              kind="import"
              onClick={() => setImportModalOpen(true)}
            >
              Nhập từ Excel
            </ActionButton>
          ) : null}
          {canManage ? (
            <ActionButton kind="create" onClick={openCreate}>
              Thêm SKU
            </ActionButton>
          ) : null}
        </Stack>

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
          <Box sx={{ mb: "14px" }}>
            <UiAlert
              tone="error"
              action={
                <ActionButton
                  kind="close"
                  onClick={() => setPublishError(null)}
                >
                  Đóng
                </ActionButton>
              }
            >
              {getApiErrorMessage(
                publishError,
                "Không cập nhật được trạng thái hiển thị trên ứng dụng phân vùng.",
              )}
            </UiAlert>
          </Box>
        ) : null}

        <Box sx={TABLE_WRAP_SX} aria-busy={query.isLoading}>
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
                <SortableTh
                  label="SKU"
                  sortKey="skuCode"
                  sortState={sortState}
                  onSort={requestSort}
                />
                <SortableTh
                  label="Loại"
                  sortKey="type"
                  sortState={sortState}
                  onSort={requestSort}
                />
                <SortableTh
                  label="Hãng"
                  sortKey="brand"
                  sortState={sortState}
                  onSort={requestSort}
                />
                <SortableTh
                  label="Nhóm hàng"
                  sortKey="category"
                  sortState={sortState}
                  onSort={requestSort}
                />
                <SortableTh
                  label="Định mức tối thiểu"
                  sortKey="minStock"
                  sortState={sortState}
                  onSort={requestSort}
                  sortType="value"
                />
                <SortableTh
                  label="Định mức tối đa"
                  sortKey="maxStock"
                  sortState={sortState}
                  onSort={requestSort}
                  sortType="value"
                />
                <SortableTh
                  label="Trạng thái"
                  sortKey="status"
                  sortState={sortState}
                  onSort={requestSort}
                  sortType="value"
                />
                <SortableTh
                  label="Ứng dụng phân vùng"
                  sortKey="published"
                  sortState={sortState}
                  onSort={requestSort}
                  sortType="value"
                />
                <th aria-label="Hành động" />
              </tr>
            </thead>
            <tbody>
              {query.isLoading ? (
                <tr>
                  <td colSpan={11} className="muted">
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : sortedRows.length > 0 ? (
                sortedRows.map((record, index) => {
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
                      {/* Bỏ title={brand_id/category_id}: tooltip trước đây in
                        nguyên UUID ra khi rê chuột. */}
                      <td>{refLabel(brandIndex, record.brand_id)}</td>
                      <td>{refLabel(categoryIndex, record.category_id)}</td>
                      <td>{stockThresholdLabel(record.min_stock)}</td>
                      <td>{stockThresholdLabel(record.max_stock)}</td>
                      <td>
                        <UiStatusBadge
                          tone={masterStatusTone(record.status)}
                          label={masterStatusLabel(record.status)}
                        />
                      </td>
                      <td>
                        <UiStatusBadge
                          tone={isPublished ? "success" : "warning"}
                          label={
                            isPublished ? "Đang hiển thị" : "Chưa hiển thị"
                          }
                          title={
                            isPublished
                              ? "SKU đang hiển thị trên ứng dụng phân vùng"
                              : "SKU chưa hiển thị trên ứng dụng phân vùng"
                          }
                        />
                      </td>
                      <td>
                        <Stack
                          direction="row"
                          spacing={1}
                          sx={{ flexWrap: "wrap" }}
                        >
                          <ActionButton
                            kind="view"
                            onClick={() => setViewing(record)}
                          >
                            Xem
                          </ActionButton>
                          {canManage ? (
                            <ActionButton
                              kind="edit"
                              onClick={() => openEdit(record)}
                            >
                              Sửa
                            </ActionButton>
                          ) : null}
                          {canPublish ? (
                            <ActionButton
                              // Nút 2 trạng thái: màu phải đổi theo NGHĨA của
                              // lần bấm sắp tới — đỏ khi sắp gỡ, xanh khi sắp đưa lên.
                              kind={isPublished ? "unpublish" : "publish"}
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
                              {isPublished
                                ? "Gỡ khỏi ứng dụng"
                                : "Đưa lên ứng dụng"}
                            </ActionButton>
                          ) : null}
                        </Stack>
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
        </Box>

        <MvpPaginationFooter
          current={pagination.current}
          pageSize={perPage}
          total={pagination.total}
          itemLabel="SKU"
          onChange={setPage}
        />

        <UiDialog
          open={Boolean(viewing)}
          onClose={() => setViewing(null)}
          maxWidth="sm"
          fullWidth
          slotProps={{ paper: { sx: { maxWidth: 760 } } }}
          title={
            <>
              Chi tiết SKU
              <ActionIconButton
                kind="close"
                label="Đóng"
                onClick={() => setViewing(null)}
                sx={{ position: "absolute", right: 10, top: 8 }}
              />
            </>
          }
        >
          {viewing ? (
            <Box
              sx={{
                border: 1,
                borderColor: "divider",
                borderRadius: 2,
                p: 2,
              }}
            >
              <UiDescriptions
                columns={2}
                items={[
                  { label: "Mã SKU", value: viewing.sku_code ?? viewing.code },
                  {
                    label: "Tên SKU",
                    value: viewing.sku_name ?? viewing.name,
                  },
                  { label: "Loại", value: skuTypeLabel(viewing.sku_type) },
                  { label: "Đơn vị tính", value: viewing.unit || "—" },
                  {
                    label: "Hãng",
                    value: refLabel(brandIndex, viewing.brand_id),
                  },
                  {
                    label: "Nhóm hàng",
                    value: refLabel(categoryIndex, viewing.category_id),
                  },
                  {
                    label: "Model",
                    value: refLabel(modelIndex, viewing.model_id),
                  },
                  {
                    label: "Nguồn điện",
                    value: viewing.power_source_id
                      ? refLabel(powerSourceIndex, viewing.power_source_id)
                      : viewing.power_or_voltage || "—",
                  },
                  {
                    label: "Quy cách đóng gói",
                    value: viewing.package_variant_id
                      ? refLabel(
                          packageVariantIndex,
                          viewing.package_variant_id,
                        )
                      : viewing.package_variant || "—",
                  },
                  {
                    label: "Phiên bản sản phẩm",
                    value: viewing.version_code || "—",
                  },
                  {
                    label: "Định mức tối thiểu",
                    value: stockThresholdLabel(viewing.min_stock),
                  },
                  {
                    label: "Định mức tối đa",
                    value: stockThresholdLabel(viewing.max_stock),
                  },
                  {
                    label: "Quản lý số sê-ri",
                    value: viewing.is_serial_tracked ? "Có" : "Không",
                  },
                  {
                    label: "Trạng thái",
                    value: (
                      <UiStatusBadge
                        tone={masterStatusTone(viewing.status)}
                        label={masterStatusLabel(viewing.status)}
                      />
                    ),
                  },
                  {
                    label: "Ứng dụng phân vùng",
                    value: viewing.published_to_app
                      ? "Đang hiển thị"
                      : "Chưa hiển thị",
                  },
                ]}
              />
            </Box>
          ) : null}
        </UiDialog>

        <UiDialog
          open={modalOpen}
          onClose={guardBackdropClose(close)}
          maxWidth="md"
          fullWidth
          title={
            <>
              {editing ? "Sửa SKU" : "Thêm SKU"}
              <ActionIconButton
                kind="close"
                label="Đóng"
                onClick={close}
                disabled={isSaving}
                sx={{ position: "absolute", right: 10, top: 8 }}
              />
            </>
          }
          actions={
            <>
              <ActionButton kind="cancel" onClick={close} disabled={isSaving}>
                Hủy
              </ActionButton>
              <ActionButton
                kind="save"
                disabled={isSaving}
                type="submit"
                form="sku-master-form"
              >
                {isSaving ? "Đang lưu..." : "Lưu SKU"}
              </ActionButton>
            </>
          }
        >
          <form id="sku-master-form" onSubmit={submit} noValidate>
            {formError ? (
              <Box sx={{ mb: "14px" }}>
                <UiAlert tone="error">{formError}</UiAlert>
              </Box>
            ) : null}
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Box
                  sx={{
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 2,
                    p: 2,
                    height: "100%",
                  }}
                >
                  <Box sx={{ fontWeight: 700, fontSize: 14, mb: 2 }}>
                    Thông tin SKU
                  </Box>
                  <Stack spacing={2}>
                    <UiTextField
                      id="sku-code"
                      label="Mã SKU"
                      required
                      fullWidth
                      value={form.code}
                      onChange={(event) => {
                        const value = event.target.value;
                        setForm((current) => ({ ...current, code: value }));
                        setFieldErrors((current) =>
                          current.code ? { ...current, code: "" } : current,
                        );
                      }}
                      disabled={isSaving || identityLocked}
                      error={Boolean(fieldErrors.code)}
                      helperText={
                        fieldErrors.code ||
                        (identityLocked
                          ? "SKU đã có tồn kho — không thể đổi mã SKU."
                          : undefined)
                      }
                    />
                    <UiTextField
                      id="sku-name"
                      label="Tên SKU"
                      required
                      fullWidth
                      value={form.name}
                      onChange={(event) => {
                        const value = event.target.value;
                        setForm((current) => ({ ...current, name: value }));
                        setFieldErrors((current) =>
                          current.name ? { ...current, name: "" } : current,
                        );
                      }}
                      disabled={isSaving}
                      error={Boolean(fieldErrors.name)}
                      helperText={fieldErrors.name}
                    />
                    <UiTextField
                      id="sku-type"
                      select
                      label="Loại SKU"
                      fullWidth
                      disabled={isSaving}
                      value={form.type}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          type: event.target.value as SkuType,
                        }))
                      }
                    >
                      <MenuItem value="PRODUCT">Sản phẩm</MenuItem>
                      <MenuItem value="COMPONENT">Linh kiện</MenuItem>
                    </UiTextField>
                    <UiTextField
                      id="sku-unit"
                      label="Đơn vị tính"
                      fullWidth
                      value={form.unit}
                      onChange={(event) => {
                        const value = event.target.value;
                        setForm((current) => ({ ...current, unit: value }));
                        setFieldErrors((current) =>
                          current.unit ? { ...current, unit: "" } : current,
                        );
                      }}
                      disabled={isSaving}
                      error={Boolean(fieldErrors.unit)}
                      helperText={fieldErrors.unit}
                    />
                    <UiTextField
                      id="sku-status"
                      select
                      label="Trạng thái"
                      fullWidth
                      disabled={isSaving}
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
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </UiTextField>
                    <Box>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={form.publishedToApp}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                publishedToApp: event.target.checked,
                              }))
                            }
                            disabled={isSaving || form.status !== "ACTIVE"}
                          />
                        }
                        label="Cho phép hiển thị SKU này trên ứng dụng xem sản phẩm"
                      />
                      {form.status !== "ACTIVE" ? (
                        <Box sx={FIELD_CAPTION_SX}>
                          Chỉ SKU đang sử dụng mới được đưa lên ứng dụng.
                        </Box>
                      ) : null}
                      {fieldErrors.publishedToApp ? (
                        <Box sx={{ ...FIELD_CAPTION_SX, color: "error.main" }}>
                          {fieldErrors.publishedToApp}
                        </Box>
                      ) : null}
                    </Box>
                  </Stack>
                </Box>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Box
                  sx={{
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 2,
                    p: 2,
                    height: "100%",
                  }}
                >
                  <Box sx={{ fontWeight: 700, fontSize: 14, mb: 1 }}>
                    Danh mục tham chiếu
                  </Box>
                  <Box sx={{ ...FIELD_CAPTION_SX, mt: 0, mb: 2 }}>
                    Chọn các danh mục đang sử dụng cho Hãng, Nhóm hàng, Model và
                    Nguồn điện.
                  </Box>
                  <Stack spacing={2}>
                    <SkuCatalogSelect
                      id="sku-brand"
                      label="Hãng"
                      required
                      value={form.brandId}
                      options={catalogs.brands}
                      disabled={isSaving}
                      error={fieldErrors.brandId}
                      onChange={(value) => {
                        setForm((current) => ({
                          ...current,
                          brandId: value,
                        }));
                        setFieldErrors((current) =>
                          current.brandId
                            ? { ...current, brandId: "" }
                            : current,
                        );
                      }}
                    />
                    <SkuCatalogSelect
                      id="sku-category"
                      label="Nhóm hàng"
                      required
                      value={form.categoryId}
                      options={catalogs.categories}
                      disabled={isSaving}
                      error={fieldErrors.categoryId}
                      onChange={(value) => {
                        setForm((current) => ({
                          ...current,
                          categoryId: value,
                        }));
                        setFieldErrors((current) =>
                          current.categoryId
                            ? { ...current, categoryId: "" }
                            : current,
                        );
                      }}
                    />
                    <SkuCatalogSelect
                      id="sku-model"
                      label="Model"
                      required
                      value={form.modelId}
                      options={catalogs.models}
                      disabled={isSaving}
                      error={fieldErrors.modelId}
                      onChange={(value) => {
                        setForm((current) => ({
                          ...current,
                          modelId: value,
                        }));
                        setFieldErrors((current) =>
                          current.modelId
                            ? { ...current, modelId: "" }
                            : current,
                        );
                      }}
                    />
                    <SkuCatalogSelect
                      id="sku-power-source"
                      label="Nguồn điện"
                      required
                      value={form.powerSourceId}
                      options={catalogs.powerSources}
                      disabled={isSaving}
                      error={fieldErrors.powerSourceId}
                      onChange={(value) => {
                        setForm((current) => ({
                          ...current,
                          powerSourceId: value,
                        }));
                        setFieldErrors((current) =>
                          current.powerSourceId
                            ? { ...current, powerSourceId: "" }
                            : current,
                        );
                      }}
                    />
                    <SkuCatalogSelect
                      id="sku-package-variant"
                      label="Quy cách đóng gói"
                      value={form.packageVariantId}
                      options={catalogs.packageVariants}
                      disabled={isSaving}
                      error={fieldErrors.packageVariantId}
                      onChange={(value) => {
                        setForm((current) => ({
                          ...current,
                          packageVariantId: value,
                        }));
                        setFieldErrors((current) =>
                          current.packageVariantId
                            ? { ...current, packageVariantId: "" }
                            : current,
                        );
                      }}
                    />
                    <UiTextField
                      id="sku-version-code"
                      label="Phiên bản sản phẩm"
                      fullWidth
                      value={form.versionCode}
                      placeholder="V1"
                      onChange={(event) => {
                        const value = event.target.value;
                        setForm((current) => ({
                          ...current,
                          versionCode: value,
                        }));
                        setFieldErrors((current) =>
                          current.versionCode
                            ? { ...current, versionCode: "" }
                            : current,
                        );
                      }}
                      disabled={isSaving}
                      error={Boolean(fieldErrors.versionCode)}
                      helperText={fieldErrors.versionCode}
                    />
                    <UiTextField
                      id="sku-min-stock"
                      label="Định mức tồn tối thiểu"
                      fullWidth
                      type="number"
                      value={form.minStock}
                      placeholder="Để trống = chưa đặt định mức"
                      helperText={
                        fieldErrors.minStock ??
                        "Nhập 0 nếu muốn chỉ cảnh báo khi hết hàng; để trống nếu chưa muốn đặt định mức."
                      }
                      error={Boolean(fieldErrors.minStock)}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          minStock: event.target.value,
                        }))
                      }
                      disabled={isSaving}
                      slotProps={{ htmlInput: { min: 0, step: "any" } }}
                    />
                    <UiTextField
                      id="sku-max-stock"
                      label="Định mức tồn tối đa"
                      fullWidth
                      type="number"
                      value={form.maxStock}
                      placeholder="Để trống = chưa đặt định mức"
                      helperText={
                        fieldErrors.maxStock ??
                        "Phải ≥ 1 và lớn hơn định mức tối thiểu; để trống nếu chưa muốn đặt định mức."
                      }
                      error={Boolean(fieldErrors.maxStock)}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          maxStock: event.target.value,
                        }))
                      }
                      disabled={isSaving}
                      slotProps={{ htmlInput: { min: 1, step: "any" } }}
                    />
                    <Box>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={form.serialTracked}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                serialTracked: event.target.checked,
                              }))
                            }
                            disabled={isSaving || identityLocked}
                          />
                        }
                        label="Quản lý riêng từng sản phẩm bằng số sê-ri / mã vật lý"
                      />
                      {identityLocked ? (
                        <Box sx={FIELD_CAPTION_SX}>
                          SKU đã có tồn kho — không thể đổi chế độ quản lý số
                          sê-ri.
                        </Box>
                      ) : null}
                    </Box>
                  </Stack>
                </Box>
              </Grid>
            </Grid>
          </form>
        </UiDialog>
      </div>
    </>
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

/**
 * Các ô nhập có chỗ hiển thị lỗi riêng (`error` + `helperText`) trong modal nơi
 * nhận. Lỗi server thuộc field ngoài danh sách này rơi về banner tổng — xem
 * `resolveFormErrors`. Khoá bên trái là tên camelCase mà `extractFieldErrors`
 * trả về, giá trị bên phải là tên field snake_case mà `fieldErrors` của form
 * này đang dùng; thiếu bước map lại thì lỗi sẽ không khớp ô nào và biến mất.
 */
const AGENCY_FORM_FIELDS = {
  agencyCode: "agency_code",
  agencyName: "agency_name",
  recipientType: "recipient_type",
  market: "market",
  region: "region",
  contactName: "contact_name",
  phone: "phone",
  address: "address",
} as const satisfies Record<string, keyof AgencyFormState>;

export function AgencyMasterScreen({ openCreateOnMount = false }: ScreenProps) {
  const [agencySearchParams] = useSearchParams();
  const openCreateRequested =
    openCreateOnMount || agencySearchParams.get("screen") === "AGY-02";
  const canManage = useCanManage("agency.manage");
  const { confirm: confirmAction, confirmDialog } = useUiConfirm();
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<MasterStatus | "">("");
  const [recipientType, setRecipientType] = useState<RecipientType | "">("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AgencyRecord | null>(null);
  const [form, setForm] = useState<AgencyFormState>(EMPTY_AGENCY_FORM);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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
  const { sortedRows, sortState, requestSort } = useClientSort(rows, {
    code: (r) => r.agency_code,
    name: (r) => r.agency_name,
    recipientType: (r) =>
      r.recipient_type ? recipientTypeLabel(r.recipient_type) : null,
    market: (r) => r.market,
    region: (r) => r.region,
    contact: (r) => r.contact_name,
    phone: (r) => r.phone,
    address: (r) => r.address,
    status: (r) => r.status,
  });

  const openCreate = () => {
    if (!canManage) return;
    setEditing(null);
    setForm({ ...EMPTY_AGENCY_FORM });
    setFormError("");
    setFieldErrors({});
    setModalOpen(true);
  };

  useEffect(() => {
    if (openCreateRequested && canManage) openCreate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage, openCreateRequested]);

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
    setFieldErrors({});
    setModalOpen(true);
  };

  const close = () => {
    if (isSaving) return;
    setModalOpen(false);
    setEditing(null);
    setFormError("");
    setFieldErrors({});
  };

  const validateAgencyForm = (): boolean => {
    const errors: Record<string, string> = {};
    // recipient_type required (BE BaM1RecipientController).
    if (!form.recipient_type) {
      errors.recipient_type = "Vui lòng chọn loại nơi nhận.";
    }
    if (!form.agency_code.trim()) {
      errors.agency_code = "Mã nơi nhận là bắt buộc.";
    }
    if (!form.agency_name.trim()) {
      errors.agency_name = "Tên nơi nhận là bắt buộc.";
    }
    const phone = form.phone?.trim() ?? "";
    if (phone && !/^0\d{9}$/.test(phone)) {
      errors.phone =
        "Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    if (!validateAgencyForm()) return;
    const payload: AgencyPayload = {
      agency_code: form.agency_code.trim(),
      agency_name: form.agency_name.trim(),
      recipient_type: form.recipient_type as RecipientType,
      market: form.market?.trim() || null,
      region: form.region?.trim() || null,
      contact_name: form.contact_name?.trim() || null,
      phone: form.phone?.trim() || null,
      address: form.address?.trim() || null,
      status: form.status,
    };
    if (form.status === "INACTIVE" && editing?.status === "ACTIVE") {
      const confirmed = await confirmAction({
        title: "Ngừng sử dụng nơi nhận?",
        content:
          "Nơi nhận sẽ không còn được chọn cho chứng từ mới. Chứng từ đã lập giữ nguyên.",
        confirmText: "Ngừng sử dụng",
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
      // Lỗi nào gắn được vào ô nhập thì hiện ngay dưới ô đó (vd mã nơi nhận
      // trùng), banner chỉ giữ phần không thuộc ô nào — trước đây mọi lỗi đều
      // bị dồn vào banner nên người dùng chỉ thấy câu tổng chung chung.
      const { fieldErrors: serverFieldErrors, message } = resolveFormErrors(
        error,
        Object.keys(AGENCY_FORM_FIELDS),
      );
      setFieldErrors((current) => ({
        ...current,
        ...Object.fromEntries(
          Object.entries(serverFieldErrors).map(([field, msg]) => [
            AGENCY_FORM_FIELDS[field as keyof typeof AGENCY_FORM_FIELDS],
            msg,
          ]),
        ),
      }));
      toast.error(getMutationErrorMessage(error));
      setFormError(message ?? "");
    }
  };

  const perPageOptions = MVP_PAGE_SIZE_OPTIONS.includes(
    perPage as (typeof MVP_PAGE_SIZE_OPTIONS)[number],
  )
    ? MVP_PAGE_SIZE_OPTIONS
    : [...MVP_PAGE_SIZE_OPTIONS, perPage].sort((a, b) => a - b);

  return (
    <>
      <div className="hn-mvp-source-screen" data-mvp-screen="AGY-01">
        {confirmDialog}
        <Stack direction="row" sx={TOOLBAR_SX}>
          <UiTextField
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value);
              setPage(1);
            }}
            placeholder="Tìm mã / tên / thị trường / khu vực"
            slotProps={{ htmlInput: { "aria-label": "Tìm nơi nhận" } }}
            sx={{ minWidth: 220 }}
          />
          <UiSelect
            aria-label="Lọc theo loại nơi nhận"
            value={recipientType}
            onChange={(value) => {
              setRecipientType(value as RecipientType | "");
              setPage(1);
            }}
            placeholder="Loại nơi nhận: Tất cả"
            minWidth={160}
            options={RECIPIENT_TYPES.map((value) => ({
              value,
              label: RECIPIENT_TYPE_LABELS[value],
            }))}
          />
          <UiSelect
            aria-label="Lọc theo trạng thái"
            value={status}
            onChange={(value) => {
              setStatus(value as MasterStatus | "");
              setPage(1);
            }}
            placeholder="Trạng thái: Tất cả"
            minWidth={128}
            options={STATUS_OPTIONS}
          />
          <UiSelect
            aria-label="Số dòng mỗi trang"
            value={perPage}
            onChange={(value) => {
              setPerPage(Number(value));
              setPage(1);
            }}
            minWidth={92}
            options={perPageOptions.map((size) => ({
              value: size,
              label: `${size} / trang`,
            }))}
          />
          <Box sx={{ flex: 1 }} />
          {canManage ? (
            <ActionButton kind="create" onClick={openCreate}>
              Thêm nơi nhận
            </ActionButton>
          ) : null}
        </Stack>

        <ApiErrorAlert
          error={query.error}
          fallback="Không tải được danh sách nơi nhận."
          onRetry={() => void query.refetch()}
        />

        <Box sx={TABLE_WRAP_SX} aria-busy={query.isLoading}>
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
                <SortableTh
                  label="Mã"
                  sortKey="code"
                  sortState={sortState}
                  onSort={requestSort}
                />
                <SortableTh
                  label="Tên nơi nhận"
                  sortKey="name"
                  sortState={sortState}
                  onSort={requestSort}
                />
                <SortableTh
                  label="Loại nơi nhận"
                  sortKey="recipientType"
                  sortState={sortState}
                  onSort={requestSort}
                />
                <SortableTh
                  label="Thị trường"
                  sortKey="market"
                  sortState={sortState}
                  onSort={requestSort}
                />
                <SortableTh
                  label="Khu vực"
                  sortKey="region"
                  sortState={sortState}
                  onSort={requestSort}
                />
                <SortableTh
                  label="Người liên hệ"
                  sortKey="contact"
                  sortState={sortState}
                  onSort={requestSort}
                />
                <SortableTh
                  label="Điện thoại"
                  sortKey="phone"
                  sortState={sortState}
                  onSort={requestSort}
                />
                <SortableTh
                  label="Địa chỉ"
                  sortKey="address"
                  sortState={sortState}
                  onSort={requestSort}
                />
                <SortableTh
                  label="Trạng thái"
                  sortKey="status"
                  sortState={sortState}
                  onSort={requestSort}
                  sortType="value"
                />
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
              ) : sortedRows.length > 0 ? (
                sortedRows.map((record, index) => (
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
                        <UiStatusBadge
                          tone="neutral"
                          label={recipientTypeLabel(record.recipient_type)}
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{record.market || "—"}</td>
                    <td>{record.region || "—"}</td>
                    <td>{record.contact_name || "—"}</td>
                    <td>{record.phone || "—"}</td>
                    <td style={WRAP_TEXT_CELL_STYLE}>
                      {record.address || "—"}
                    </td>
                    <td>
                      <UiStatusBadge
                        tone={masterStatusTone(record.status)}
                        label={masterStatusLabel(record.status)}
                      />
                    </td>
                    <td>
                      {canManage ? (
                        <ActionButton
                          kind="edit"
                          onClick={() => openEdit(record)}
                        >
                          Sửa
                        </ActionButton>
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
        </Box>

        <MvpPaginationFooter
          current={pagination.current}
          pageSize={perPage}
          total={pagination.total}
          itemLabel="nơi nhận"
          onChange={setPage}
        />

        <UiDialog
          open={modalOpen}
          onClose={guardBackdropClose(close)}
          maxWidth="sm"
          fullWidth
          title={
            <>
              {editing ? "Sửa nơi nhận" : "Thêm nơi nhận"}
              <ActionIconButton
                kind="close"
                label="Đóng"
                onClick={close}
                disabled={isSaving}
                sx={{ position: "absolute", right: 10, top: 8 }}
              />
            </>
          }
          actions={
            <>
              <ActionButton kind="cancel" onClick={close} disabled={isSaving}>
                Hủy
              </ActionButton>
              <ActionButton
                kind="save"
                disabled={isSaving}
                type="submit"
                form="agency-master-form"
              >
                {isSaving ? "Đang lưu..." : "Lưu nơi nhận"}
              </ActionButton>
            </>
          }
        >
          <form id="agency-master-form" onSubmit={submit} noValidate>
            {formError ? (
              <Box sx={{ mb: "14px" }}>
                <UiAlert tone="error">{formError}</UiAlert>
              </Box>
            ) : null}
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <UiTextField
                  id="agency-code"
                  label="Mã nơi nhận"
                  required
                  fullWidth
                  value={form.agency_code}
                  onChange={(event) => {
                    const value = event.target.value;
                    setForm((current) => ({
                      ...current,
                      agency_code: value,
                    }));
                    setFieldErrors((current) =>
                      current.agency_code
                        ? { ...current, agency_code: "" }
                        : current,
                    );
                  }}
                  disabled={isSaving}
                  error={Boolean(fieldErrors.agency_code)}
                  helperText={fieldErrors.agency_code}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <UiTextField
                  id="agency-name"
                  label="Tên nơi nhận"
                  required
                  fullWidth
                  value={form.agency_name}
                  onChange={(event) => {
                    const value = event.target.value;
                    setForm((current) => ({
                      ...current,
                      agency_name: value,
                    }));
                    setFieldErrors((current) =>
                      current.agency_name
                        ? { ...current, agency_name: "" }
                        : current,
                    );
                  }}
                  disabled={isSaving}
                  error={Boolean(fieldErrors.agency_name)}
                  helperText={fieldErrors.agency_name}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <UiTextField
                  id="agency-recipient-type"
                  select
                  label="Loại nơi nhận"
                  required
                  fullWidth
                  disabled={isSaving}
                  value={form.recipient_type}
                  onChange={(event) => {
                    const value = event.target.value as RecipientType | "";
                    setForm((current) => ({
                      ...current,
                      recipient_type: value,
                    }));
                    setFieldErrors((current) =>
                      current.recipient_type
                        ? { ...current, recipient_type: "" }
                        : current,
                    );
                  }}
                  error={Boolean(fieldErrors.recipient_type)}
                  helperText={fieldErrors.recipient_type}
                  slotProps={{
                    select: { displayEmpty: true },
                    inputLabel: { shrink: true },
                  }}
                >
                  <MenuItem value="">Chọn loại nơi nhận</MenuItem>
                  {RECIPIENT_TYPES.map((value) => (
                    <MenuItem key={value} value={value}>
                      {RECIPIENT_TYPE_LABELS[value]}
                    </MenuItem>
                  ))}
                </UiTextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <UiTextField
                  id="agency-market"
                  label="Thị trường"
                  fullWidth
                  value={form.market ?? ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    setForm((current) => ({ ...current, market: value }));
                    setFieldErrors((current) =>
                      current.market ? { ...current, market: "" } : current,
                    );
                  }}
                  disabled={isSaving}
                  error={Boolean(fieldErrors.market)}
                  helperText={fieldErrors.market}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <UiTextField
                  id="agency-region"
                  label="Khu vực"
                  fullWidth
                  value={form.region ?? ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    setForm((current) => ({ ...current, region: value }));
                    setFieldErrors((current) =>
                      current.region ? { ...current, region: "" } : current,
                    );
                  }}
                  disabled={isSaving}
                  error={Boolean(fieldErrors.region)}
                  helperText={fieldErrors.region}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <UiTextField
                  id="agency-contact-name"
                  label="Người liên hệ"
                  fullWidth
                  value={form.contact_name ?? ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    setForm((current) => ({
                      ...current,
                      contact_name: value,
                    }));
                    setFieldErrors((current) =>
                      current.contact_name
                        ? { ...current, contact_name: "" }
                        : current,
                    );
                  }}
                  disabled={isSaving}
                  error={Boolean(fieldErrors.contact_name)}
                  helperText={fieldErrors.contact_name}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <UiTextField
                  id="agency-phone"
                  label="Điện thoại"
                  fullWidth
                  value={form.phone ?? ""}
                  onChange={(event) => {
                    const value = event.target.value
                      .replace(/\D/g, "")
                      .slice(0, 10);
                    setForm((current) => ({ ...current, phone: value }));
                    setFieldErrors((current) =>
                      current.phone ? { ...current, phone: "" } : current,
                    );
                  }}
                  disabled={isSaving}
                  error={Boolean(fieldErrors.phone)}
                  helperText={fieldErrors.phone}
                  slotProps={{
                    htmlInput: { inputMode: "numeric", maxLength: 10 },
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <UiTextField
                  id="agency-status"
                  select
                  label="Trạng thái"
                  fullWidth
                  disabled={isSaving}
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      status: event.target.value as MasterStatus,
                    }))
                  }
                >
                  {STATUS_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </UiTextField>
              </Grid>
              <Grid size={12}>
                <UiTextField
                  id="agency-address"
                  label="Địa chỉ"
                  fullWidth
                  multiline
                  minRows={3}
                  value={form.address ?? ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    setForm((current) => ({ ...current, address: value }));
                    setFieldErrors((current) =>
                      current.address ? { ...current, address: "" } : current,
                    );
                  }}
                  disabled={isSaving}
                  error={Boolean(fieldErrors.address)}
                  helperText={fieldErrors.address}
                />
              </Grid>
            </Grid>
          </form>
        </UiDialog>
      </div>
    </>
  );
}

// ===== Danh mục lỗi / bệnh =====

const EMPTY_DEFECT_FORM: DefectPayload = {
  defect_code: "",
  defect_name: "",
  description: "",
  status: "ACTIVE",
};

/**
 * Các ô nhập có chỗ hiển thị lỗi riêng (`error` + `helperText`) trong modal lỗi
 * / bệnh. Lỗi server thuộc field ngoài danh sách này rơi về banner tổng — xem
 * `resolveFormErrors`. Khoá bên trái là tên camelCase mà `extractFieldErrors`
 * trả về, giá trị bên phải là tên field snake_case mà `fieldErrors` của form
 * này đang dùng; thiếu bước map lại thì lỗi sẽ không khớp ô nào và biến mất.
 */
const DEFECT_FORM_FIELDS = {
  defectCode: "defect_code",
  defectName: "defect_name",
  description: "description",
} as const satisfies Record<string, keyof DefectPayload>;

export function DefectMasterScreen({ openCreateOnMount = false }: ScreenProps) {
  const [defectSearchParams] = useSearchParams();
  const openCreateRequested =
    openCreateOnMount || defectSearchParams.get("screen") === "DEF-02";
  const canManage = useCanManage("defect.manage");
  const { confirm: confirmAction, confirmDialog } = useUiConfirm();
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<MasterStatus | "">("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DefectRecord | null>(null);
  const [form, setForm] = useState<DefectPayload>(EMPTY_DEFECT_FORM);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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
  const { sortedRows, sortState, requestSort } = useClientSort(rows, {
    code: (r) => r.defect_code,
    name: (r) => r.defect_name,
    description: (r) => r.description,
    status: (r) => r.status,
  });

  const openCreate = () => {
    if (!canManage) return;
    setEditing(null);
    setForm({ ...EMPTY_DEFECT_FORM });
    setFormError("");
    setFieldErrors({});
    setModalOpen(true);
  };

  useEffect(() => {
    if (openCreateRequested && canManage) openCreate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage, openCreateRequested]);

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
    setFieldErrors({});
    setModalOpen(true);
  };

  const close = () => {
    if (isSaving) return;
    setModalOpen(false);
    setEditing(null);
    setFormError("");
    setFieldErrors({});
  };

  const validateDefectForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.defect_code.trim()) errors.defect_code = "Mã lỗi là bắt buộc.";
    if (!form.defect_name.trim())
      errors.defect_name = "Tên lỗi / bệnh là bắt buộc.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    if (!validateDefectForm()) return;
    const payload: DefectPayload = {
      defect_code: form.defect_code.trim(),
      defect_name: form.defect_name.trim(),
      description: form.description?.trim() || null,
      status: form.status,
    };
    if (form.status === "INACTIVE" && editing?.status === "ACTIVE") {
      const confirmed = await confirmAction({
        title: "Ngừng sử dụng lỗi / bệnh?",
        content:
          "Lỗi / bệnh sẽ không còn được chọn cho hồ sơ bảo hành mới. Hồ sơ đã gán giữ nguyên.",
        confirmText: "Ngừng sử dụng",
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
      // Lỗi nào gắn được vào ô nhập thì hiện ngay dưới ô đó (vd mã lỗi trùng),
      // banner chỉ giữ phần không thuộc ô nào — trước đây mọi lỗi đều bị dồn
      // vào banner nên người dùng chỉ thấy câu tổng chung chung.
      const { fieldErrors: serverFieldErrors, message } = resolveFormErrors(
        error,
        Object.keys(DEFECT_FORM_FIELDS),
      );
      setFieldErrors((current) => ({
        ...current,
        ...Object.fromEntries(
          Object.entries(serverFieldErrors).map(([field, msg]) => [
            DEFECT_FORM_FIELDS[field as keyof typeof DEFECT_FORM_FIELDS],
            msg,
          ]),
        ),
      }));
      toast.error(getMutationErrorMessage(error));
      setFormError(message ?? "");
    }
  };

  const perPageOptions = MVP_PAGE_SIZE_OPTIONS.includes(
    perPage as (typeof MVP_PAGE_SIZE_OPTIONS)[number],
  )
    ? MVP_PAGE_SIZE_OPTIONS
    : [...MVP_PAGE_SIZE_OPTIONS, perPage].sort((a, b) => a - b);

  return (
    <>
      <div className="hn-mvp-source-screen" data-mvp-screen="DEF-01">
        {confirmDialog}
        <Stack direction="row" sx={TOOLBAR_SX}>
          <UiTextField
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value);
              setPage(1);
            }}
            placeholder="Tìm mã / tên lỗi"
            slotProps={{ htmlInput: { "aria-label": "Tìm lỗi/bệnh" } }}
            sx={{ minWidth: 220 }}
          />
          <UiSelect
            aria-label="Lọc theo trạng thái"
            value={status}
            onChange={(value) => {
              setStatus(value as MasterStatus | "");
              setPage(1);
            }}
            placeholder="Trạng thái: Tất cả"
            minWidth={128}
            options={STATUS_OPTIONS}
          />
          <UiSelect
            aria-label="Số dòng mỗi trang"
            value={perPage}
            onChange={(value) => {
              setPerPage(Number(value));
              setPage(1);
            }}
            minWidth={92}
            options={perPageOptions.map((size) => ({
              value: size,
              label: `${size} / trang`,
            }))}
          />
          <Box sx={{ flex: 1 }} />
          {canManage ? (
            <ActionButton kind="create" onClick={openCreate}>
              Thêm lỗi
            </ActionButton>
          ) : null}
        </Stack>

        <ApiErrorAlert
          error={query.error}
          fallback="Không tải được danh mục lỗi."
          onRetry={() => void query.refetch()}
        />

        <Box sx={TABLE_WRAP_SX} aria-busy={query.isLoading}>
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
                <SortableTh
                  label="Mã lỗi"
                  sortKey="code"
                  sortState={sortState}
                  onSort={requestSort}
                />
                <SortableTh
                  label="Tên lỗi / bệnh"
                  sortKey="name"
                  sortState={sortState}
                  onSort={requestSort}
                />
                <SortableTh
                  label="Mô tả"
                  sortKey="description"
                  sortState={sortState}
                  onSort={requestSort}
                />
                <SortableTh
                  label="Trạng thái"
                  sortKey="status"
                  sortState={sortState}
                  onSort={requestSort}
                  sortType="value"
                />
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
              ) : sortedRows.length > 0 ? (
                sortedRows.map((record, index) => (
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
                    <td style={WRAP_TEXT_CELL_STYLE}>
                      {record.description || "—"}
                    </td>
                    <td>
                      <UiStatusBadge
                        tone={masterStatusTone(record.status)}
                        label={masterStatusLabel(record.status)}
                      />
                    </td>
                    <td>
                      {canManage ? (
                        <ActionButton
                          kind="edit"
                          onClick={() => openEdit(record)}
                        >
                          Sửa
                        </ActionButton>
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
        </Box>

        <MvpPaginationFooter
          current={pagination.current}
          pageSize={perPage}
          total={pagination.total}
          itemLabel="lỗi / bệnh"
          onChange={setPage}
        />

        <UiDialog
          open={modalOpen}
          onClose={guardBackdropClose(close)}
          maxWidth="sm"
          fullWidth
          title={
            <>
              {editing ? "Sửa lỗi / bệnh" : "Thêm lỗi / bệnh"}
              <ActionIconButton
                kind="close"
                label="Đóng"
                onClick={close}
                disabled={isSaving}
                sx={{ position: "absolute", right: 10, top: 8 }}
              />
            </>
          }
          actions={
            <>
              <ActionButton kind="cancel" onClick={close} disabled={isSaving}>
                Hủy
              </ActionButton>
              <ActionButton
                kind="save"
                disabled={isSaving}
                type="submit"
                form="defect-master-form"
              >
                {isSaving ? "Đang lưu..." : "Lưu danh mục lỗi"}
              </ActionButton>
            </>
          }
        >
          <form id="defect-master-form" onSubmit={submit} noValidate>
            {formError ? (
              <Box sx={{ mb: "14px" }}>
                <UiAlert tone="error">{formError}</UiAlert>
              </Box>
            ) : null}
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <UiTextField
                  id="defect-code"
                  label="Mã lỗi"
                  required
                  fullWidth
                  value={form.defect_code}
                  onChange={(event) => {
                    const value = event.target.value;
                    setForm((current) => ({
                      ...current,
                      defect_code: value,
                    }));
                    setFieldErrors((current) =>
                      current.defect_code
                        ? { ...current, defect_code: "" }
                        : current,
                    );
                  }}
                  disabled={isSaving}
                  error={Boolean(fieldErrors.defect_code)}
                  helperText={fieldErrors.defect_code}
                  slotProps={{ htmlInput: { maxLength: 80 } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <UiTextField
                  id="defect-name"
                  label="Tên lỗi / bệnh"
                  required
                  fullWidth
                  value={form.defect_name}
                  onChange={(event) => {
                    const value = event.target.value;
                    setForm((current) => ({
                      ...current,
                      defect_name: value,
                    }));
                    setFieldErrors((current) =>
                      current.defect_name
                        ? { ...current, defect_name: "" }
                        : current,
                    );
                  }}
                  disabled={isSaving}
                  error={Boolean(fieldErrors.defect_name)}
                  helperText={fieldErrors.defect_name}
                  slotProps={{ htmlInput: { maxLength: 200 } }}
                />
              </Grid>
              <Grid size={12}>
                <UiTextField
                  id="defect-description"
                  label="Mô tả"
                  fullWidth
                  multiline
                  minRows={3}
                  value={form.description ?? ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    setForm((current) => ({
                      ...current,
                      description: value,
                    }));
                    setFieldErrors((current) =>
                      current.description
                        ? { ...current, description: "" }
                        : current,
                    );
                  }}
                  disabled={isSaving}
                  error={Boolean(fieldErrors.description)}
                  helperText={fieldErrors.description}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <UiTextField
                  id="defect-status"
                  select
                  label="Trạng thái"
                  fullWidth
                  disabled={isSaving}
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      status: event.target.value as MasterStatus,
                    }))
                  }
                >
                  {STATUS_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </UiTextField>
              </Grid>
            </Grid>
          </form>
        </UiDialog>
      </div>
    </>
  );
}
