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
import { useT, type TranslateFn } from "@/shared/i18n/useT";
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
  SEMANTIC_LIGHT,
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
import { EMPTY_TEXT } from "@/shared/constants/display";

/**
 * BE chưa có tham số lọc "SKU chờ điền thông tin" riêng (không đáng để thêm 1
 * query param chỉ phục vụ 1 nút lọc) — khi bật bộ lọc này, FE quét một trang
 * rộng rồi tự lọc/tự phân trang phía client. 500 đủ cho quy mô danh mục SKU
 * hiện tại (MVP); nếu SKU vượt mốc này, chuyển sang param lọc thật ở BE.
 */
const PENDING_INFO_SCAN_LIMIT = 500;

const statusOptions = (
  t: TranslateFn,
): Array<{ value: MasterStatus; label: string }> => [
  { value: "ACTIVE", label: t("masterData.status.inUse") },
  { value: "INACTIVE", label: t("masterData.status.notInUse") },
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

function masterStatusLabel(status: MasterStatus | string, t: TranslateFn) {
  return businessLabel(
    MASTER_STATUS_LABELS,
    status,
    t("masterData.status.other"),
  );
}

function skuTypeLabel(type: SkuType | string, t: TranslateFn) {
  return businessLabel(SKU_TYPE_LABELS, type, t("masterData.common.typeOther"));
}

/**
 * SKU tự tạo qua luồng quét (materializeSkuIfMissing bên BE) chỉ có
 * sku_code/sku_type, chưa gán Hãng/Nhóm hàng/Model — 3 field bắt buộc của form
 * "Thêm SKU" thủ công (validateSkuForm). Thiếu cả 3 = chắc chắn là SKU tự tạo
 * chờ điền thông tin, không phải SKU đã tạo tay còn thiếu 1-2 trường tuỳ chọn.
 * Cùng tiêu chí với BE (`issues.sku_pending_info` ở dashboard-overview).
 */
function isSkuPendingInfo(row: SkuRecord): boolean {
  return !row.brand_id && !row.category_id && !row.model_id;
}

/**
 * Định mức tồn chưa đặt (null) hiển thị "—"; 0 phải hiện là "0" vì đó là một
 * định mức THẬT (cảnh báo khi hết hàng), không phải "chưa cấu hình".
 */
function stockThresholdLabel(value?: number | string | null): string {
  if (value === null || value === undefined || value === "") return EMPTY_TEXT;
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
  if (!value) return EMPTY_TEXT;
  const found = index.get(value);
  // KHÔNG rơi xuống compactRef(value) (UUID rút gọn): cột này là TÊN hãng/nhóm
  // hàng. Chưa tra ra tên thì hiện "—", không lộ định danh nội bộ.
  return found ? found.name || found.code : EMPTY_TEXT;
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
  unit: "cái", // giá trị mặc định gửi BE, không phải nhãn hiển thị
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
  const t = useT();
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
        <MenuItem value="">{t("masterData.sku.notChosen")}</MenuItem>
        {isMissing ? (
          <MenuItem value={value}>
            {t("masterData.sku.keepInactiveLink")}
          </MenuItem>
        ) : null}
        {rows.map((row) => (
          <MenuItem key={row.id} value={row.id}>
            {row.code} · {row.name}
          </MenuItem>
        ))}
      </UiTextField>
      {!error && isMissing ? (
        <Box sx={FIELD_CAPTION_SX}>{t("masterData.sku.inactiveLinkHint")}</Box>
      ) : null}
    </Box>
  );
}

export function SkuMasterScreen({ openCreateOnMount = false }: ScreenProps) {
  const t = useT();
  // Deep-link ?screen=MST-02 (mo modal tao) — page tu xu ly sau khi go bypass layout.
  const [skuSearchParams] = useSearchParams();
  const openCreateRequested =
    openCreateOnMount || skuSearchParams.get("screen") === "MST-02";
  // Deep-link ?filter=pending_info — Dashboard "Vấn đề cần xử lý" trỏ thẳng vào
  // đây kèm bộ lọc đã bật sẵn, không bắt người dùng tự bấm lại nút lọc.
  const pendingInfoRequested = skuSearchParams.get("filter") === "pending_info";
  const canManage = useCanManage("sku.manage");
  const { confirm: confirmAction, confirmDialog } = useUiConfirm();
  const canPublish = useCanManage(WMS_PERMISSION_CATALOG.PV_PUBLISH);
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<MasterStatus | "">("");
  const [type, setType] = useState<SkuType | "">("");
  const [brandId, setBrandId] = useState("");
  const [pendingInfoOnly, setPendingInfoOnly] = useState(pendingInfoRequested);
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
    // "SKU chờ điền thông tin" cần quét rộng để lọc/phân trang phía client (xem
    // PENDING_INFO_SCAN_LIMIT) — page/per_page bình thường không đủ vì SKU thiếu
    // thông tin có thể nằm ở bất kỳ trang nào.
    page: pendingInfoOnly ? 1 : page,
    per_page: pendingInfoOnly ? PENDING_INFO_SCAN_LIMIT : perPage,
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
  const filteredRows = useMemo(() => {
    const brandFiltered = brandId
      ? apiRows.filter((row) => row.brand_id === brandId)
      : apiRows;
    return pendingInfoOnly
      ? brandFiltered.filter(isSkuPendingInfo)
      : brandFiltered;
  }, [apiRows, brandId, pendingInfoOnly]);
  // Chế độ "SKU chờ điền thông tin" đã tải rộng (PENDING_INFO_SCAN_LIMIT) nên tự
  // phân trang phía client; chế độ thường vẫn dùng đúng 1 trang server trả về.
  const rows = useMemo(() => {
    if (!pendingInfoOnly) return filteredRows;
    const start = (page - 1) * perPage;
    return filteredRows.slice(start, start + perPage);
  }, [filteredRows, pendingInfoOnly, page, perPage]);
  const pagination = resolveApiPagination(
    pendingInfoOnly ? undefined : query.data?.meta,
    {
      page,
      pageSize: perPage,
      rowCount: pendingInfoOnly ? filteredRows.length : apiRows.length,
    },
  );
  const rowSelection = useRowSelection(
    rows,
    (record) => record.sku_id ?? record.id ?? "",
  );
  const { sortedRows, sortState, requestSort } = useClientSort(rows, {
    skuCode: (r) => r.sku_code ?? r.code,
    type: (r) => skuTypeLabel(r.sku_type, t),
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
        ? t("masterData.sku.publishTitle")
        : t("masterData.sku.unpublishTitle"),
      content: willPublish
        ? t("masterData.sku.publishBody", { code: skuCode })
        : t("masterData.sku.unpublishBody", { code: skuCode }),
      confirmText: willPublish
        ? t("masterData.sku.publishConfirm")
        : t("masterData.sku.unpublishConfirm"),
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
          ? t("masterData.sku.published")
          : t("masterData.sku.unpublished"),
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
    if (!form.code.trim()) errors.code = t("masterData.sku.errCode");
    if (!form.name.trim()) errors.name = t("masterData.sku.errName");
    if (!form.brandId) errors.brandId = t("masterData.sku.errBrand");
    if (!form.categoryId) errors.categoryId = t("masterData.sku.errCategory");
    if (!form.modelId) errors.modelId = t("masterData.sku.errModel");
    if (!form.powerSourceId)
      errors.powerSourceId = t("masterData.sku.errPowerSource");
    if (form.publishedToApp && form.status !== "ACTIVE") {
      errors.publishedToApp = t("masterData.sku.errPublishInactive");
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
      errors.minStock = t("masterData.sku.errMinStock");
    }
    if (
      maxStockNum !== null &&
      (!Number.isFinite(maxStockNum) || maxStockNum < 1)
    ) {
      errors.maxStock = t("masterData.sku.errMaxStock");
    }
    if (
      !errors.minStock &&
      !errors.maxStock &&
      minStockNum !== null &&
      maxStockNum !== null &&
      maxStockNum <= minStockNum
    ) {
      errors.maxStock = t("masterData.sku.errMaxLessMin");
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
        title: t("masterData.sku.deactivateTitle"),
        content: t("masterData.sku.deactivateBody"),
        confirmText: t("masterData.sku.deactivateConfirm"),
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
        toast.success(t("masterData.sku.updated"));
      } else {
        await createMutation.mutateAsync(payload);
        toast.success(t("masterData.sku.created"));
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
            placeholder={t("masterData.sku.searchPlaceholder")}
            slotProps={{
              htmlInput: { "aria-label": t("masterData.sku.searchAria") },
            }}
            sx={{ minWidth: 190 }}
          />
          <UiSelect
            aria-label={t("masterData.sku.typeFilterAria")}
            value={type}
            onChange={(value) => {
              setType(value as SkuType | "");
              setPage(1);
            }}
            placeholder={t("masterData.sku.typeFilterPlaceholder")}
            minWidth={128}
            options={[
              { value: "PRODUCT", label: t("masterData.sku.typeProduct") },
              { value: "COMPONENT", label: t("masterData.sku.typeComponent") },
            ]}
          />
          <UiSelect
            aria-label={t("masterData.sku.brandFilterAria")}
            value={brandId}
            disabled={catalogsQuery.isLoading}
            onChange={(value) => {
              setBrandId(value);
              setPage(1);
            }}
            placeholder={t("masterData.sku.brandFilterPlaceholder")}
            minWidth={136}
            options={brands.map((brand) => ({
              value: brand.id,
              label: brand.name || brand.code,
            }))}
          />
          <UiSelect
            aria-label={t("masterData.status.filterAria")}
            value={status}
            onChange={(value) => {
              setStatus(value as MasterStatus | "");
              setPage(1);
            }}
            placeholder={t("masterData.status.allPlaceholder")}
            minWidth={128}
            options={statusOptions(t)}
          />
          <UiSelect
            aria-label={t("masterData.common.pageSizeAria")}
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
          <ActionButton
            kind="filter"
            aria-pressed={pendingInfoOnly}
            onClick={() => {
              setPendingInfoOnly((current) => !current);
              setPage(1);
            }}
            title={t("masterData.sku.pendingTooltip")}
            sx={
              pendingInfoOnly
                ? {
                    backgroundColor: SEMANTIC_LIGHT.warningSoft,
                    color: SEMANTIC_LIGHT.warningText,
                  }
                : undefined
            }
          >
            {t("masterData.sku.pendingInfo")}
          </ActionButton>
          {canManage ? (
            <ActionButton
              kind="import"
              onClick={() => setImportModalOpen(true)}
            >
              {t("masterData.sku.importExcel")}
            </ActionButton>
          ) : null}
          {canManage ? (
            <ActionButton kind="create" onClick={openCreate}>
              {t("masterData.sku.create")}
            </ActionButton>
          ) : null}
        </Stack>

        <ApiErrorAlert
          error={query.error}
          fallback={t("masterData.sku.errLoad")}
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
                  {t("common.close")}
                </ActionButton>
              }
            >
              {getApiErrorMessage(
                publishError,
                t("masterData.sku.errPublishToggle"),
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
                    ariaLabel={t("masterData.sku.selectAllAria")}
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
                  label={t("masterData.sku.colType")}
                  sortKey="type"
                  sortState={sortState}
                  onSort={requestSort}
                />
                <SortableTh
                  label={t("masterData.sku.colBrand")}
                  sortKey="brand"
                  sortState={sortState}
                  onSort={requestSort}
                />
                <SortableTh
                  label={t("masterData.sku.colCategory")}
                  sortKey="category"
                  sortState={sortState}
                  onSort={requestSort}
                />
                <SortableTh
                  label={t("masterData.sku.colMinStock")}
                  sortKey="minStock"
                  sortState={sortState}
                  onSort={requestSort}
                  sortType="value"
                />
                <SortableTh
                  label={t("masterData.sku.colMaxStock")}
                  sortKey="maxStock"
                  sortState={sortState}
                  onSort={requestSort}
                  sortType="value"
                />
                <SortableTh
                  label={t("masterData.status.label")}
                  sortKey="status"
                  sortState={sortState}
                  onSort={requestSort}
                  sortType="value"
                />
                <SortableTh
                  label={t("masterData.sku.colPvApp")}
                  sortKey="published"
                  sortState={sortState}
                  onSort={requestSort}
                  sortType="value"
                />
                <th aria-label={t("masterData.common.actionsAria")} />
              </tr>
            </thead>
            <tbody>
              {query.isLoading ? (
                <tr>
                  <td colSpan={11} className="muted">
                    {t("masterData.common.loadingData")}
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
                          ariaLabel={t("masterData.sku.selectRowAria", {
                            code: record.sku_code ?? record.code ?? "",
                          })}
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
                      <td>{skuTypeLabel(record.sku_type, t)}</td>
                      {/* Bỏ title={brand_id/category_id}: tooltip trước đây in
                        nguyên UUID ra khi rê chuột. */}
                      <td>{refLabel(brandIndex, record.brand_id)}</td>
                      <td>{refLabel(categoryIndex, record.category_id)}</td>
                      <td>{stockThresholdLabel(record.min_stock)}</td>
                      <td>{stockThresholdLabel(record.max_stock)}</td>
                      <td>
                        <UiStatusBadge
                          tone={masterStatusTone(record.status)}
                          label={masterStatusLabel(record.status, t)}
                        />
                      </td>
                      <td>
                        <UiStatusBadge
                          tone={isPublished ? "success" : "warning"}
                          label={
                            isPublished
                              ? t("masterData.sku.publishedBadge")
                              : t("masterData.sku.unpublishedBadge")
                          }
                          title={
                            isPublished
                              ? t("masterData.sku.publishedTooltip")
                              : t("masterData.sku.unpublishedTooltip")
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
                              {t("masterData.common.edit")}
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
                                  ? t("masterData.sku.errPublishInactive")
                                  : isPublished
                                    ? t("masterData.sku.unpublishAction")
                                    : t("masterData.sku.publishAction")
                              }
                              onClick={() => void togglePublish(record)}
                            >
                              {isPublished
                                ? t("masterData.sku.unpublishConfirm")
                                : t("masterData.sku.publishConfirm")}
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
                    {t("masterData.sku.empty")}
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
              {t("masterData.sku.detailTitle")}
              <ActionIconButton
                kind="close"
                label={t("common.close")}
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
                  {
                    label: t("masterData.sku.fieldCode"),
                    value: viewing.sku_code ?? viewing.code,
                  },
                  {
                    label: t("masterData.sku.fieldName"),
                    value: viewing.sku_name ?? viewing.name,
                  },
                  {
                    label: t("masterData.sku.colType"),
                    value: skuTypeLabel(viewing.sku_type, t),
                  },
                  {
                    label: t("masterData.sku.fieldUnit"),
                    value: viewing.unit || EMPTY_TEXT,
                  },
                  {
                    label: t("masterData.sku.colBrand"),
                    value: refLabel(brandIndex, viewing.brand_id),
                  },
                  {
                    label: t("masterData.sku.colCategory"),
                    value: refLabel(categoryIndex, viewing.category_id),
                  },
                  {
                    label: "Model",
                    value: refLabel(modelIndex, viewing.model_id),
                  },
                  {
                    label: t("masterData.sku.fieldPowerSource"),
                    value: viewing.power_source_id
                      ? refLabel(powerSourceIndex, viewing.power_source_id)
                      : viewing.power_or_voltage || EMPTY_TEXT,
                  },
                  {
                    label: t("masterData.sku.fieldPackaging"),
                    value: viewing.package_variant_id
                      ? refLabel(
                          packageVariantIndex,
                          viewing.package_variant_id,
                        )
                      : viewing.package_variant || EMPTY_TEXT,
                  },
                  {
                    label: t("masterData.sku.fieldVersion"),
                    value: viewing.version_code || EMPTY_TEXT,
                  },
                  {
                    label: t("masterData.sku.colMinStock"),
                    value: stockThresholdLabel(viewing.min_stock),
                  },
                  {
                    label: t("masterData.sku.colMaxStock"),
                    value: stockThresholdLabel(viewing.max_stock),
                  },
                  {
                    label: t("masterData.sku.fieldSerialTracked"),
                    value: viewing.is_serial_tracked
                      ? t("masterData.sku.yes")
                      : t("masterData.sku.no"),
                  },
                  {
                    label: t("masterData.status.label"),
                    value: (
                      <UiStatusBadge
                        tone={masterStatusTone(viewing.status)}
                        label={masterStatusLabel(viewing.status, t)}
                      />
                    ),
                  },
                  {
                    label: t("masterData.sku.colPvApp"),
                    value: viewing.published_to_app
                      ? t("masterData.sku.publishedBadge")
                      : t("masterData.sku.unpublishedBadge"),
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
              {editing
                ? t("masterData.sku.dialogEdit")
                : t("masterData.sku.dialogCreate")}
              <ActionIconButton
                kind="close"
                label={t("common.close")}
                onClick={close}
                disabled={isSaving}
                sx={{ position: "absolute", right: 10, top: 8 }}
              />
            </>
          }
          actions={
            <>
              <ActionButton kind="cancel" onClick={close} disabled={isSaving}>
                {t("masterData.common.cancel")}
              </ActionButton>
              <ActionButton
                kind="save"
                disabled={isSaving}
                type="submit"
                form="sku-master-form"
              >
                {isSaving
                  ? t("masterData.common.saving")
                  : t("masterData.sku.submit")}
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
                    {t("masterData.sku.sectionInfo")}
                  </Box>
                  <Stack spacing={2}>
                    <UiTextField
                      id="sku-code"
                      label={t("masterData.sku.fieldCode")}
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
                          ? t("masterData.sku.codeLockedHint")
                          : undefined)
                      }
                    />
                    <UiTextField
                      id="sku-name"
                      label={t("masterData.sku.fieldName")}
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
                      label={t("masterData.sku.fieldSkuType")}
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
                      <MenuItem value="PRODUCT">
                        {t("masterData.sku.typeProduct")}
                      </MenuItem>
                      <MenuItem value="COMPONENT">
                        {t("masterData.sku.typeComponent")}
                      </MenuItem>
                    </UiTextField>
                    <UiTextField
                      id="sku-unit"
                      label={t("masterData.sku.fieldUnit")}
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
                      label={t("masterData.status.label")}
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
                      {statusOptions(t).map((option) => (
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
                        label={t("masterData.sku.publishSwitchLabel")}
                      />
                      {form.status !== "ACTIVE" ? (
                        <Box sx={FIELD_CAPTION_SX}>
                          {t("masterData.sku.publishSwitchHint")}
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
                    {t("masterData.sku.sectionCatalog")}
                  </Box>
                  <Box sx={{ ...FIELD_CAPTION_SX, mt: 0, mb: 2 }}>
                    {t("masterData.sku.sectionCatalogHint")}
                  </Box>
                  <Stack spacing={2}>
                    <SkuCatalogSelect
                      id="sku-brand"
                      label={t("masterData.sku.colBrand")}
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
                      label={t("masterData.sku.colCategory")}
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
                      label={t("masterData.sku.fieldPowerSource")}
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
                      label={t("masterData.sku.fieldPackaging")}
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
                      label={t("masterData.sku.fieldVersion")}
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
                      label={t("masterData.sku.fieldMinStock")}
                      fullWidth
                      type="number"
                      value={form.minStock}
                      placeholder={t("masterData.sku.thresholdPlaceholder")}
                      helperText={
                        fieldErrors.minStock ??
                        t("masterData.sku.minStockHelper")
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
                      label={t("masterData.sku.fieldMaxStock")}
                      fullWidth
                      type="number"
                      value={form.maxStock}
                      placeholder={t("masterData.sku.thresholdPlaceholder")}
                      helperText={
                        fieldErrors.maxStock ??
                        t("masterData.sku.maxStockHelper")
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
                        label={t("masterData.sku.serialSwitchLabel")}
                      />
                      {identityLocked ? (
                        <Box sx={FIELD_CAPTION_SX}>
                          {t("masterData.sku.serialLockedHint")}
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
  const t = useT();
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
      errors.recipient_type = t("masterData.recipient.errType");
    }
    if (!form.agency_code.trim()) {
      errors.agency_code = t("masterData.recipient.errCode");
    }
    if (!form.agency_name.trim()) {
      errors.agency_name = t("masterData.recipient.errName");
    }
    const phone = form.phone?.trim() ?? "";
    if (phone && !/^0\d{9}$/.test(phone)) {
      errors.phone = t("masterData.recipient.errPhone");
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
        title: t("masterData.recipient.deactivateTitle"),
        content: t("masterData.recipient.deactivateBody"),
        confirmText: t("masterData.sku.deactivateConfirm"),
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
        toast.success(t("masterData.recipient.updated"));
      } else {
        await createMutation.mutateAsync(payload);
        toast.success(t("masterData.recipient.created"));
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
            placeholder={t("masterData.recipient.searchPlaceholder")}
            slotProps={{
              htmlInput: { "aria-label": t("masterData.recipient.searchAria") },
            }}
            sx={{ minWidth: 220 }}
          />
          <UiSelect
            aria-label={t("masterData.recipient.typeFilterAria")}
            value={recipientType}
            onChange={(value) => {
              setRecipientType(value as RecipientType | "");
              setPage(1);
            }}
            placeholder={t("masterData.recipient.typeFilterPlaceholder")}
            minWidth={160}
            options={RECIPIENT_TYPES.map((value) => ({
              value,
              label: RECIPIENT_TYPE_LABELS[value],
            }))}
          />
          <UiSelect
            aria-label={t("masterData.status.filterAria")}
            value={status}
            onChange={(value) => {
              setStatus(value as MasterStatus | "");
              setPage(1);
            }}
            placeholder={t("masterData.status.allPlaceholder")}
            minWidth={128}
            options={statusOptions(t)}
          />
          <UiSelect
            aria-label={t("masterData.common.pageSizeAria")}
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
              {t("masterData.recipient.create")}
            </ActionButton>
          ) : null}
        </Stack>

        <ApiErrorAlert
          error={query.error}
          fallback={t("masterData.recipient.errLoad")}
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
                    ariaLabel={t("masterData.recipient.selectAllAria")}
                  />
                </th>
                <th className="stt-col">STT</th>
                <SortableTh
                  label={t("masterData.recipient.colCode")}
                  sortKey="code"
                  sortState={sortState}
                  onSort={requestSort}
                />
                <SortableTh
                  label={t("masterData.recipient.colName")}
                  sortKey="name"
                  sortState={sortState}
                  onSort={requestSort}
                />
                <SortableTh
                  label={t("masterData.recipient.colType")}
                  sortKey="recipientType"
                  sortState={sortState}
                  onSort={requestSort}
                />
                <SortableTh
                  label={t("masterData.recipient.colMarket")}
                  sortKey="market"
                  sortState={sortState}
                  onSort={requestSort}
                />
                <SortableTh
                  label={t("masterData.recipient.colRegion")}
                  sortKey="region"
                  sortState={sortState}
                  onSort={requestSort}
                />
                <SortableTh
                  label={t("masterData.recipient.colContact")}
                  sortKey="contact"
                  sortState={sortState}
                  onSort={requestSort}
                />
                <SortableTh
                  label={t("masterData.recipient.colPhone")}
                  sortKey="phone"
                  sortState={sortState}
                  onSort={requestSort}
                />
                <SortableTh
                  label={t("masterData.recipient.colAddress")}
                  sortKey="address"
                  sortState={sortState}
                  onSort={requestSort}
                />
                <SortableTh
                  label={t("masterData.status.label")}
                  sortKey="status"
                  sortState={sortState}
                  onSort={requestSort}
                  sortType="value"
                />
                <th aria-label={t("masterData.common.actionsAria")} />
              </tr>
            </thead>
            <tbody>
              {query.isLoading ? (
                <tr>
                  <td colSpan={12} className="muted">
                    {t("masterData.common.loadingData")}
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
                        ariaLabel={t("masterData.recipient.selectRowAria", {
                          name: record.agency_name,
                        })}
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
                        EMPTY_TEXT
                      )}
                    </td>
                    <td>{record.market || EMPTY_TEXT}</td>
                    <td>{record.region || EMPTY_TEXT}</td>
                    <td>{record.contact_name || EMPTY_TEXT}</td>
                    <td>{record.phone || EMPTY_TEXT}</td>
                    <td style={WRAP_TEXT_CELL_STYLE}>
                      {record.address || EMPTY_TEXT}
                    </td>
                    <td>
                      <UiStatusBadge
                        tone={masterStatusTone(record.status)}
                        label={masterStatusLabel(record.status, t)}
                      />
                    </td>
                    <td>
                      {canManage ? (
                        <ActionButton
                          kind="edit"
                          onClick={() => openEdit(record)}
                        >
                          {t("masterData.common.edit")}
                        </ActionButton>
                      ) : (
                        <span className="muted">
                          {t("masterData.common.viewOnly")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={12} className="muted">
                    {t("masterData.recipient.empty")}
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
          itemLabel={t("masterData.recipient.itemLabel")}
          onChange={setPage}
        />

        <UiDialog
          open={modalOpen}
          onClose={guardBackdropClose(close)}
          maxWidth="sm"
          fullWidth
          title={
            <>
              {editing
                ? t("masterData.recipient.dialogEdit")
                : t("masterData.recipient.dialogCreate")}
              <ActionIconButton
                kind="close"
                label={t("common.close")}
                onClick={close}
                disabled={isSaving}
                sx={{ position: "absolute", right: 10, top: 8 }}
              />
            </>
          }
          actions={
            <>
              <ActionButton kind="cancel" onClick={close} disabled={isSaving}>
                {t("masterData.common.cancel")}
              </ActionButton>
              <ActionButton
                kind="save"
                disabled={isSaving}
                type="submit"
                form="agency-master-form"
              >
                {isSaving
                  ? t("masterData.common.saving")
                  : t("masterData.recipient.submit")}
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
                  label={t("masterData.recipient.fieldCode")}
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
                  label={t("masterData.recipient.colName")}
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
                  label={t("masterData.recipient.colType")}
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
                  <MenuItem value="">
                    {t("masterData.recipient.chooseType")}
                  </MenuItem>
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
                  label={t("masterData.recipient.colMarket")}
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
                  label={t("masterData.recipient.colRegion")}
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
                  label={t("masterData.recipient.colContact")}
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
                  label={t("masterData.recipient.colPhone")}
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
                  label={t("masterData.status.label")}
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
                  {statusOptions(t).map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </UiTextField>
              </Grid>
              <Grid size={12}>
                <UiTextField
                  id="agency-address"
                  label={t("masterData.recipient.colAddress")}
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
  const t = useT();
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
    if (!form.defect_code.trim())
      errors.defect_code = t("masterData.defect.errCode");
    if (!form.defect_name.trim())
      errors.defect_name = t("masterData.defect.errName");
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
        title: t("masterData.defect.deactivateTitle"),
        content: t("masterData.defect.deactivateBody"),
        confirmText: t("masterData.sku.deactivateConfirm"),
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
        toast.success(t("masterData.defect.updated"));
      } else {
        await createMutation.mutateAsync(payload);
        toast.success(t("masterData.defect.created"));
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
            placeholder={t("masterData.defect.searchPlaceholder")}
            slotProps={{
              htmlInput: { "aria-label": t("masterData.defect.searchAria") },
            }}
            sx={{ minWidth: 220 }}
          />
          <UiSelect
            aria-label={t("masterData.status.filterAria")}
            value={status}
            onChange={(value) => {
              setStatus(value as MasterStatus | "");
              setPage(1);
            }}
            placeholder={t("masterData.status.allPlaceholder")}
            minWidth={128}
            options={statusOptions(t)}
          />
          <UiSelect
            aria-label={t("masterData.common.pageSizeAria")}
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
              {t("masterData.defect.create")}
            </ActionButton>
          ) : null}
        </Stack>

        <ApiErrorAlert
          error={query.error}
          fallback={t("masterData.defect.errLoad")}
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
                    ariaLabel={t("masterData.defect.selectAllAria")}
                  />
                </th>
                <th className="stt-col">STT</th>
                <SortableTh
                  label={t("masterData.defect.colCode")}
                  sortKey="code"
                  sortState={sortState}
                  onSort={requestSort}
                />
                <SortableTh
                  label={t("masterData.defect.colName")}
                  sortKey="name"
                  sortState={sortState}
                  onSort={requestSort}
                />
                <SortableTh
                  label={t("masterData.common.description")}
                  sortKey="description"
                  sortState={sortState}
                  onSort={requestSort}
                />
                <SortableTh
                  label={t("masterData.status.label")}
                  sortKey="status"
                  sortState={sortState}
                  onSort={requestSort}
                  sortType="value"
                />
                <th aria-label={t("masterData.common.actionsAria")} />
              </tr>
            </thead>
            <tbody>
              {query.isLoading ? (
                <tr>
                  <td colSpan={7} className="muted">
                    {t("masterData.common.loadingData")}
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
                        ariaLabel={t("masterData.defect.selectRowAria", {
                          name: record.defect_name,
                        })}
                      />
                    </td>
                    <td className="stt-col">
                      {mvpRowNumber(page, perPage, index)}
                    </td>
                    <td>{record.defect_code}</td>
                    <td>{record.defect_name}</td>
                    <td style={WRAP_TEXT_CELL_STYLE}>
                      {record.description || EMPTY_TEXT}
                    </td>
                    <td>
                      <UiStatusBadge
                        tone={masterStatusTone(record.status)}
                        label={masterStatusLabel(record.status, t)}
                      />
                    </td>
                    <td>
                      {canManage ? (
                        <ActionButton
                          kind="edit"
                          onClick={() => openEdit(record)}
                        >
                          {t("masterData.common.edit")}
                        </ActionButton>
                      ) : (
                        <span className="muted">
                          {t("masterData.common.viewOnly")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="muted">
                    {t("masterData.defect.empty")}
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
          itemLabel={t("masterData.defect.itemLabel")}
          onChange={setPage}
        />

        <UiDialog
          open={modalOpen}
          onClose={guardBackdropClose(close)}
          maxWidth="sm"
          fullWidth
          title={
            <>
              {editing
                ? t("masterData.defect.dialogEdit")
                : t("masterData.defect.dialogCreate")}
              <ActionIconButton
                kind="close"
                label={t("common.close")}
                onClick={close}
                disabled={isSaving}
                sx={{ position: "absolute", right: 10, top: 8 }}
              />
            </>
          }
          actions={
            <>
              <ActionButton kind="cancel" onClick={close} disabled={isSaving}>
                {t("masterData.common.cancel")}
              </ActionButton>
              <ActionButton
                kind="save"
                disabled={isSaving}
                type="submit"
                form="defect-master-form"
              >
                {isSaving
                  ? t("masterData.common.saving")
                  : t("masterData.defect.submit")}
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
                  label={t("masterData.defect.colCode")}
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
                  label={t("masterData.defect.colName")}
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
                  label={t("masterData.common.description")}
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
                  label={t("masterData.status.label")}
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
                  {statusOptions(t).map((option) => (
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
