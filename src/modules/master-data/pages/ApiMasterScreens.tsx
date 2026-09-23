import { DefectOverview } from "@/modules/master-data/components/DefectOverview";
import { DefectEmptyState, DefectNotice } from "@/modules/master-data/components/DefectFeedback";
import { DefectMutationNotice, type DefectMutationNoticeValue } from "@/modules/master-data/components/DefectMutationNotice";
import { DefectSymbol } from "@/modules/master-data/components/DefectSymbol";
import "@/modules/master-data/components/agency-list.css";
import {
  SkuListMutationNotice,
  type SkuListMutationNoticeValue,
} from "@/modules/master-data/components/SkuListMutationNotice";
import { SearchOutlined } from "@/shared/components/icons";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { SkuListOverview } from "@/modules/master-data/components/SkuListOverview";
import {
  SkuListNotice,
  SkuListEmptyState,
} from "@/modules/master-data/components/SkuListFeedback";
import "./sku-list.css";
import "./defect-list.css";
import {
  useEffect,
  useMemo,
  useRef,
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
import { mvpRowNumber } from "@/shared/components/mvp/MvpSelectionCell";
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
import { useAuthStore } from "@/shared/store/auth.store";
import { SortableTh } from "@/shared/components/data-display/SortableTh";
import { SkuLink } from "@/shared/components/data-display/SkuLink";
import { SkuThumbnail } from "@/shared/components/data-display/SkuThumbnail";
import { TruncatedText } from "@/shared/components/data-display/TruncatedText";
import { useClientSort } from "@/shared/components/data-display/useClientSort";
import { guardBackdropClose } from "@/shared/utils/dialogGuard";
import { ActionButton, ActionIconButton, RowActionButton, RowActionGroup } from "@/shared/components/actions";
import {
  Box,
  Checkbox,
  FormControlLabel,
  Grid,
  MenuItem,
  Stack,
  UiAddressField,
  UiAlert,
  UiAutocomplete,
  type UiAutocompleteOption,
  UiDescriptions,
  UiDialog,
  UiNumberField,
  UiPagination,
  UiSelect,
  UiStatusBadge,
  UiTextField,
  useUiConfirm,
} from "@/shared/ui";
import { NUMBER_RULES, checkNumber } from "@/shared/validation/number-rules";
import { validatePhone } from "@/shared/constants/validation.constants";
import { codeFormatError } from "@/shared/validation/text-rules";
import { formatAddress } from "@/shared/lib/vn-address";
import { useSearchParams } from "react-router-dom";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { agencyPlaceLabel } from "@/shared/constants/agency-place-labels";

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
 * Trần độ dài ô chữ của SKU — khớp BE StoreProductRequest/UpdateProductRequest
 * (sku_code max:100, sku_name max:255, unit max:30, version_code max:30) để
 * người dùng bị chặn ngay ở ô nhập thay vì nhận 422 sau khi bấm Lưu.
 */
const SKU_TEXT_MAX = {
  code: 100,
  name: 255,
  unit: 30,
  versionCode: 30,
} as const;

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
/** Ô chữ dài (địa chỉ, mô tả): chặn bề ngang để TruncatedText cắt được. */
const TRUNCATE_CELL_STYLE: CSSProperties = {
  maxWidth: 320,
  whiteSpace: "normal",
};

/** Chú thích phụ dưới ô nhập (thay Typography caption của MUI). */
const FIELD_CAPTION_SX = {
  display: "block",
  mt: 0.5,
  fontSize: 12,
  color: "text.secondary",
} as const;

/**
 * Select danh mục cho form SKU — Hãng/Nhóm hàng/Model/Nguồn điện/Quy cách là
 * các danh mục dài vài chục dòng nên dùng UiAutocomplete (gõ để lọc theo mã +
 * tên) thay cho menu cuộn. Giữ đúng hành vi gốc: option "Giữ liên kết hiện tại
 * (đã ngừng sử dụng)" khi giá trị đang chọn không còn trong danh sách ACTIVE.
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
  // UiAutocomplete tra nhãn từ chính mảng options: thiếu dòng "giữ liên kết
  // cũ" thì SKU đang trỏ vào danh mục đã ngừng sử dụng sẽ hiện ô trống.
  const choices: UiAutocompleteOption[] = [
    ...(isMissing
      ? [{ value, label: t("masterData.sku.keepInactiveLink") }]
      : []),
    ...rows.map((row) => ({
      value: row.id,
      label: `${row.code} · ${row.name}`,
    })),
  ];
  return (
    <Box>
      <UiAutocomplete
        data-testid={id}
        label={label}
        required={required}
        disabled={disabled}
        value={value || null}
        options={choices}
        onChange={(next) => onChange(next == null ? "" : String(next))}
        placeholder={t("masterData.sku.catalogSearchPlaceholder")}
        error={Boolean(error)}
        helperText={error}
      />
      {!error && isMissing ? (
        <Box sx={FIELD_CAPTION_SX}>{t("masterData.sku.inactiveLinkHint")}</Box>
      ) : null}
    </Box>
  );
}

export function SkuMasterScreen({ openCreateOnMount = false }: ScreenProps) {
  const t = useT();
  const [overviewRefreshKey, setOverviewRefreshKey] = useState(0);
  const language = useLanguageStore((state) => state.language);
  const copy = (vi: string, en: string) => (language === "vi" ? vi : en);
  const [offline, setOffline] = useState(() => !navigator.onLine);
  useEffect(() => {
    const updateConnection = () => setOffline(!navigator.onLine);
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
    };
  }, []);
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
  const [mutationNotice, setMutationNotice] =
    useState<SkuListMutationNoticeValue | null>(null);

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
  const { sortedRows, sortState, requestSort, originalIndexOf } = useClientSort(
    rows,
    {
      skuCode: (r) => r.sku_code ?? r.code,
      type: (r) => skuTypeLabel(r.sku_type, t),
      brand: (r) => refLabel(brandIndex, r.brand_id),
      category: (r) => refLabel(categoryIndex, r.category_id),
      minStock: (r) => r.min_stock ?? null,
      maxStock: (r) => r.max_stock ?? null,
      status: (r) => r.status,
      published: (r) => (r.published_to_app ? 1 : 0),
    },
  );

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

  /**
   * Kiểm tra định mức tồn theo luật chung (NUMBER_RULES.stockMin/stockMax) —
   * trả về giá trị đã parse để `submit` gửi thẳng, không parse lại lần hai.
   */
  const parseStockThresholds = (): {
    errors: Record<string, string>;
    minStock: number | null;
    maxStock: number | null;
  } => {
    const errors: Record<string, string> = {};
    // Định mức tồn (phục vụ báo cáo định mức tồn): min ≥ 0 — 0 là định mức
    // THẬT, không phải "chưa đặt"; max ≥ 1; max PHẢI LỚN HƠN min (không phải ≥).
    // Để trống = chưa đặt định mức, không bắt buộc. Cùng rule với BE
    // ValidatesSkuStockThresholds + CHECK chk_skus_stock_thresholds; trần/số lẻ
    // lấy từ NUMBER_RULES để không nhận "10000000000000" hay "1e5".
    const minCheck = checkNumber(form.minStock, NUMBER_RULES.stockMin);
    const maxCheck = checkNumber(form.maxStock, NUMBER_RULES.stockMax);
    if (!minCheck.ok) errors.minStock = minCheck.message;
    if (!maxCheck.ok) errors.maxStock = maxCheck.message;
    const minStock = minCheck.ok ? minCheck.value : null;
    const maxStock = maxCheck.ok ? maxCheck.value : null;
    if (
      !errors.minStock &&
      !errors.maxStock &&
      minStock !== null &&
      maxStock !== null &&
      maxStock <= minStock
    ) {
      errors.maxStock = t("masterData.sku.errMaxLessMin");
    }
    return { errors, minStock, maxStock };
  };

  const validateSkuForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.code.trim()) errors.code = t("masterData.sku.errCode");
    else if (form.code.trim().length > SKU_TEXT_MAX.code)
      errors.code = t("shared.validation.textMaxLength", {
        max: SKU_TEXT_MAX.code,
      });
    else {
      const codeError = codeFormatError(form.code.trim(), editing?.code);
      if (codeError) errors.code = codeError;
    }
    if (!form.name.trim()) errors.name = t("masterData.sku.errName");
    else if (form.name.trim().length > SKU_TEXT_MAX.name)
      errors.name = t("shared.validation.textMaxLength", {
        max: SKU_TEXT_MAX.name,
      });
    if (form.unit.trim().length > SKU_TEXT_MAX.unit)
      errors.unit = t("shared.validation.textMaxLength", {
        max: SKU_TEXT_MAX.unit,
      });
    if (form.versionCode.trim().length > SKU_TEXT_MAX.versionCode)
      errors.versionCode = t("shared.validation.textMaxLength", {
        max: SKU_TEXT_MAX.versionCode,
      });
    if (!form.brandId) errors.brandId = t("masterData.sku.errBrand");
    if (!form.categoryId) errors.categoryId = t("masterData.sku.errCategory");
    if (!form.modelId) errors.modelId = t("masterData.sku.errModel");
    if (!form.powerSourceId)
      errors.powerSourceId = t("masterData.sku.errPowerSource");
    if (form.publishedToApp && form.status !== "ACTIVE") {
      errors.publishedToApp = t("masterData.sku.errPublishInactive");
    }
    Object.assign(errors, parseStockThresholds().errors);
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    if (!validateSkuForm()) return;
    const code = form.code.trim();
    const name = form.name.trim();
    // Đã qua validate nên chỉ còn lấy giá trị parse sẵn cho payload.
    const { minStock, maxStock } = parseStockThresholds();
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
      version_code: form.versionCode.trim(),
      min_stock: minStock,
      max_stock: maxStock,
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
        setMutationNotice({ kind: "success", code });
      }
      setModalOpen(false);
      setEditing(null);
    } catch (error) {
      if (!editing) {
        const normalized = normalizeError(error);
        const transportCode =
          typeof error === "object" && error !== null && "code" in error
            ? String(error.code)
            : "";
        const outcomeUnknown = [
          "ECONNABORTED",
          "ETIMEDOUT",
          "ERR_NETWORK",
        ].includes(transportCode);
        const duplicate =
          normalized.status === 409 &&
          /DUPLICATE|ALREADY_EXISTS|SKU_CODE/i.test(normalized.code ?? "");
        setMutationNotice({
          kind: outcomeUnknown ? "unknown" : duplicate ? "duplicate" : "failed",
          code,
          message: outcomeUnknown ? undefined : getMutationErrorMessage(error),
        });
      }
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

  const hasFilters = Boolean(
    keyword.trim() || status || type || brandId || pendingInfoOnly,
  );
  const resetFilters = () => {
    setKeyword("");
    setStatus("");
    setType("");
    setBrandId("");
    setPendingInfoOnly(false);
    setPage(1);
  };
  const refreshList = () => {
    void query.refetch();
    setOverviewRefreshKey((current) => current + 1);
  };
  const listUnavailable =
    !query.isLoading && rows.length === 0 && Boolean(query.error || offline);
  const listErrorStatus = query.error
    ? normalizeError(query.error).status
    : undefined;

  return (
    <>
      <div
        className="hn-mvp-source-screen hn-sku-screen"
        data-mvp-screen="MST-01"
        data-list-state={
          listUnavailable
            ? "unavailable"
            : query.isLoading
              ? "loading"
              : "ready"
        }
        data-system-error={
          (listUnavailable &&
            [403, 404, 500, 503].includes(listErrorStatus ?? 0)) ||
          undefined
        }
      >
        {confirmDialog}
        <header className="hn-sku-header">
          <div>
            <h1>{copy("Danh sách SKU", "SKU list")}</h1>
            <p>
              {copy(
                "Quản lý thông tin định danh và trạng thái sử dụng của sản phẩm",
                "Manage product identification and usage status",
              )}
            </p>
          </div>
          <div className="hn-sku-header-actions">
            {canManage ? (
              <>
                <ActionButton
                  kind="import"
                  onClick={() => setImportModalOpen(true)}
                >
                  {t("masterData.sku.importExcel")}
                </ActionButton>
                <ActionButton
                  kind="create"
                  className="hn-sku-primary"
                  onClick={openCreate}
                  disabled={offline || query.isLoading}
                >
                  {t("masterData.sku.create")}
                </ActionButton>
              </>
            ) : (
              <span className="hn-sku-readonly">
                {copy("Chỉ xem", "Read only")}
              </span>
            )}
          </div>
        </header>
        <SkuListOverview refreshKey={overviewRefreshKey} />
        <form
          className="hn-sku-filters"
          onSubmit={(event) => {
            event.preventDefault();
            refreshList();
          }}
        >
          <div className="hn-sku-filter hn-sku-filter-search">
            <label htmlFor="sku-list-search">
              {copy("Tìm kiếm", "Search")}
            </label>
            <UiTextField
              id="sku-list-search"
              value={keyword}
              onChange={(event) => {
                setKeyword(event.target.value);
                setPage(1);
              }}
              placeholder={t("masterData.sku.searchPlaceholder")}
              slotProps={{
                htmlInput: { "aria-label": t("masterData.sku.searchAria") },
                input: {
                  startAdornment: (
                    <SearchOutlined className="hn-sku-search-icon" />
                  ),
                },
              }}
              fullWidth
            />
            <span className="hn-sku-filter-hint">
              {copy(
                "Có thể tìm theo mã SKU hoặc tên sản phẩm",
                "Search by SKU code or product name",
              )}
            </span>
          </div>
          <div className="hn-sku-filter">
            <span className="hn-sku-filter-label">
              {t("masterData.sku.colType")}
            </span>
            <UiSelect
              aria-label={t("masterData.sku.typeFilterAria")}
              value={type}
              onChange={(value) => {
                setType(value as SkuType | "");
                setPage(1);
              }}
              placeholder={copy("Tất cả", "All")}
              fullWidth
              menuClassName="hn-sku-menu"
              options={[
                { value: "PRODUCT", label: t("masterData.sku.typeProduct") },
                {
                  value: "COMPONENT",
                  label: t("masterData.sku.typeComponent"),
                },
              ]}
            />
          </div>
          <div className="hn-sku-filter">
            <span className="hn-sku-filter-label">
              {t("masterData.sku.colBrand")}
            </span>
            <UiSelect
              aria-label={t("masterData.sku.brandFilterAria")}
              value={brandId}
              disabled={catalogsQuery.isLoading}
              onChange={(value) => {
                setBrandId(value);
                setPage(1);
              }}
              placeholder={copy("Tất cả", "All")}
              fullWidth
              menuClassName="hn-sku-menu"
              options={brands.map((brand) => ({
                value: brand.id,
                label: brand.name || brand.code,
              }))}
            />
          </div>
          <div className="hn-sku-filter">
            <span className="hn-sku-filter-label">
              {t("masterData.status.label")}
            </span>
            <UiSelect
              aria-label={t("masterData.status.filterAria")}
              value={status}
              onChange={(value) => {
                setStatus(value as MasterStatus | "");
                setPage(1);
              }}
              placeholder={copy("Tất cả", "All")}
              fullWidth
              menuClassName="hn-sku-menu"
              options={statusOptions(t)}
            />
          </div>
          <div className="hn-sku-filter-actions">
            <ActionButton
              kind="filter"
              icon={<span />}
              className="hn-sku-primary"
              type="submit"
              loading={query.isFetching && !query.isLoading}
              disabled={offline}
            >
              {copy("Áp dụng", "Apply")}
            </ActionButton>
            <ActionButton kind="reset" icon={<span />} onClick={resetFilters}>
              {copy("Đặt lại", "Reset")}
            </ActionButton>
          </div>
        </form>
        {hasFilters ? (
          <div
            className="hn-sku-filter-chips"
            aria-label={copy("Bộ lọc đang áp dụng", "Applied filters")}
          >
            {[
              { value: keyword, label: keyword, clear: () => setKeyword("") },
              {
                value: type,
                label: skuTypeLabel(type, t),
                clear: () => setType(""),
              },
              {
                value: brandId,
                label: refLabel(brandIndex, brandId),
                clear: () => setBrandId(""),
              },
              {
                value: status,
                label: masterStatusLabel(status, t),
                clear: () => setStatus(""),
              },
            ]
              .filter((filter) => Boolean(filter.value))
              .map((filter, index) => (
                <button
                  type="button"
                  key={index}
                  onClick={() => {
                    filter.clear();
                    setPage(1);
                  }}
                  aria-label={`${copy("Xóa bộ lọc", "Remove filter")}: ${filter.label}`}
                >
                  <span>{filter.label}</span>
                  <span aria-hidden="true">×</span>
                </button>
              ))}
          </div>
        ) : null}
        <SkuListMutationNotice
          notice={mutationNotice}
          onDismiss={() => setMutationNotice(null)}
          onRetry={() => {
            setModalOpen(true);
            setMutationNotice(null);
          }}
          onCheck={() => {
            resetFilters();
            setKeyword(mutationNotice?.code ?? "");
            setMutationNotice(null);
          }}
        />
        <SkuListNotice
          error={query.error}
          loading={query.isLoading}
          refreshing={query.isFetching && !query.isLoading}
          hasRows={rows.length > 0}
          hasFilters={hasFilters}
          offline={offline}
          readonly={!canManage}
          onRetry={refreshList}
          onReset={resetFilters}
          onCreate={canManage ? openCreate : undefined}
          updatedAt={query.dataUpdatedAt}
        />

        {importModalOpen ? (
          <SkuImportModal
            open={importModalOpen}
            canImport={canManage}
            onClose={() => setImportModalOpen(false)}
            onImported={refreshList}
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

        <section className="hn-sku-list-card" aria-labelledby="sku-list-title">
          <div className="hn-sku-list-heading">
            <h2 id="sku-list-title">
              {copy("Danh sách SKU", "SKU list")}{" "}
              <span className="hn-sku-count">
                {query.isLoading
                  ? "—"
                  : pagination.total.toLocaleString(
                      language === "vi" ? "vi-VN" : "en-US",
                    )}
              </span>
            </h2>
            <div className="hn-sku-list-tools">
              <ActionButton
                kind="filter"
                aria-pressed={pendingInfoOnly}
                className="hn-sku-pending-filter"
                onClick={() => {
                  setPendingInfoOnly((current) => !current);
                  setPage(1);
                }}
                title={t("masterData.sku.pendingTooltip")}
              >
                {t("masterData.sku.pendingInfo")}
              </ActionButton>
              <ActionButton
                kind="refresh"
                iconOnly
                label={copy("Làm mới danh sách SKU", "Refresh SKU list")}
                onClick={refreshList}
                loading={query.isFetching}
                disabled={offline}
              />
            </div>
          </div>
          <div
            className="hn-sku-table-scroll"
            role="region"
            aria-label={copy(
              "Bảng danh sách SKU, cuộn ngang để xem đầy đủ",
              "SKU table, scroll horizontally to view all columns",
            )}
            tabIndex={0}
            aria-busy={query.isLoading}
          >
            <table className="sku-table">
              <thead>
                <tr>
                  <th className="stt-col">STT</th>
                  {/* Cột ảnh: nhận diện hàng bằng hình nhanh hơn đọc mã — nhiều mã
                    DongCheng chỉ khác nhau ở cỡ/đuôi mã máy. */}
                  <th
                    className="thumb-col"
                    aria-label={t("masterData.sku.colImage")}
                  />
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
                    className="wrap-col"
                    sortState={sortState}
                    onSort={requestSort}
                  />
                  <SortableTh
                    label={t("masterData.sku.colMinStock")}
                    sortKey="minStock"
                    className="wrap-col"
                    sortState={sortState}
                    onSort={requestSort}
                    sortType="value"
                  />
                  <SortableTh
                    label={t("masterData.sku.colMaxStock")}
                    sortKey="maxStock"
                    className="wrap-col"
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
                    className="wrap-col"
                    sortState={sortState}
                    onSort={requestSort}
                    sortType="value"
                  />
                  <th aria-label={t("masterData.common.actionsAria")}>
                    {copy("Chi tiết", "Details")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {query.isLoading ? (
                  <tr>
                    <td colSpan={11} className="muted">
                      <SkuListEmptyState
                        loading
                        hasRows={false}
                        hasFilters={hasFilters}
                        offline={offline}
                        refreshing={false}
                        readonly={!canManage}
                        onRetry={refreshList}
                        onReset={resetFilters}
                      />
                    </td>
                  </tr>
                ) : sortedRows.length > 0 ? (
                  sortedRows.map((record) => {
                    const recordId = record.sku_id ?? record.id ?? "";
                    const isPublished = Boolean(record.published_to_app);
                    const statusAllowsPublish = record.status === "ACTIVE";
                    return (
                      <tr
                        key={recordId}
                        data-status={record.status}
                        data-created={
                          (mutationNotice?.kind === "success" &&
                            mutationNotice.code ===
                              (record.sku_code ?? record.code)) ||
                          undefined
                        }
                      >
                        <td className="stt-col">
                          {mvpRowNumber(page, perPage, originalIndexOf(record))}
                        </td>
                        <td className="thumb-col">
                          <SkuThumbnail
                            url={record.image_url}
                            name={record.sku_name ?? record.name}
                          />
                        </td>
                        <td className="name-col">
                          <TruncatedText lines={1} maxWidth={300}>
                            <SkuLink
                              id={record.sku_id ?? undefined}
                              code={record.sku_code ?? record.code ?? ""}
                            />
                          </TruncatedText>
                          <TruncatedText
                            lines={1}
                            maxWidth={300}
                            className="muted"
                          >
                            {record.sku_name ?? record.name ?? ""}
                          </TruncatedText>
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
                        <td className="actions-col">
                          <RowActionGroup>
                            {/* Nhãn mặc định của kind="view" đã là "Xem"/"View"
                              song ngữ — trước đây ghi cứng "Xem" nên bản tiếng
                              Anh vẫn ra tiếng Việt (file này được miễn quét
                              trong i18n-coverage nên guard không bắt được). */}
                            <RowActionButton
                              kind="view"
                              onClick={() => setViewing(record)}
                            />
                            {canManage ? (
                              <RowActionButton
                                kind="edit"
                                iconOnly
                                title={t("masterData.common.edit")}
                                onClick={() => openEdit(record)}
                              >
                                {t("masterData.common.edit")}
                              </RowActionButton>
                            ) : null}
                            {canPublish ? (
                              <RowActionButton
                                // Nút 2 trạng thái: màu phải đổi theo NGHĨA của
                                // lần bấm sắp tới — đỏ khi sắp gỡ, xanh khi sắp đưa lên.
                                kind={isPublished ? "unpublish" : "publish"}
                                iconOnly
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
                              </RowActionButton>
                            ) : null}
                          </RowActionGroup>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={11} className="muted">
                      <SkuListEmptyState
                        error={query.error}
                        loading={false}
                        hasRows={false}
                        hasFilters={hasFilters}
                        offline={offline}
                        refreshing={false}
                        readonly={!canManage}
                        onRetry={refreshList}
                        onReset={resetFilters}
                        onCreate={canManage ? openCreate : undefined}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="hn-sku-pagination">
            <div className="hn-sku-page-info">
              <span>
                {copy("Hiển thị", "Showing")}{" "}
                {pagination.total ? (pagination.current - 1) * perPage + 1 : 0}–
                {Math.min(pagination.current * perPage, pagination.total)} /{" "}
                {pagination.total.toLocaleString(
                  language === "vi" ? "vi-VN" : "en-US",
                )}{" "}
                SKU
              </span>
              <UiSelect
                aria-label={t("masterData.common.pageSizeAria")}
                value={perPage}
                onChange={(value) => {
                  setPerPage(Number(value));
                  setPage(1);
                }}
                menuClassName="hn-sku-menu"
                options={perPageOptions.map((size) => ({
                  value: size,
                  label: `${size} / ${copy("trang", "page")}`,
                }))}
              />
            </div>
            <UiPagination
              page={pagination.current}
              pageSize={perPage}
              total={pagination.total}
              onPageChange={setPage}
              showTotal={false}
              disabled={query.isLoading}
            />
          </div>
        </section>

        <UiDialog
          className="hn-sku-dialog"
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
              {/* Ảnh sản phẩm mở đầu modal: xem chi tiết một mã hàng thì thứ
                  đầu tiên người dùng cần là nhìn thấy nó trông thế nào. */}
              <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
                <SkuThumbnail
                  url={viewing.image_url}
                  name={viewing.sku_name ?? viewing.name}
                  size={180}
                />
              </Box>
              <UiDescriptions
                columns={2}
                items={[
                  {
                    label: t("masterData.sku.fieldCode"),
                    value: (
                      <SkuLink
                        id={viewing.sku_id ?? undefined}
                        code={viewing.sku_code ?? viewing.code ?? ""}
                      />
                    ),
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
          className="hn-sku-dialog"
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
                className="hn-sku-primary"
                loading={isSaving}
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
                      slotProps={{
                        htmlInput: { maxLength: SKU_TEXT_MAX.code },
                      }}
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
                      slotProps={{
                        htmlInput: { maxLength: SKU_TEXT_MAX.name },
                      }}
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
                      slotProps={{
                        htmlInput: { maxLength: SKU_TEXT_MAX.unit },
                      }}
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
                      slotProps={{
                        htmlInput: { maxLength: SKU_TEXT_MAX.versionCode },
                      }}
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
                    <UiNumberField
                      id="sku-min-stock"
                      label={t("masterData.sku.fieldMinStock")}
                      fullWidth
                      value={form.minStock}
                      rule={NUMBER_RULES.stockMin}
                      placeholder={t("masterData.sku.thresholdPlaceholder")}
                      helperText={
                        fieldErrors.minStock ||
                        t("masterData.sku.minStockHelper")
                      }
                      error={Boolean(fieldErrors.minStock)}
                      onChange={(next) => {
                        setForm((current) => ({ ...current, minStock: next }));
                        // Lỗi "max ≤ min" gắn ở ô max nhưng sửa min cũng làm
                        // nó hết đúng → xoá cả hai.
                        setFieldErrors((current) =>
                          current.minStock || current.maxStock
                            ? { ...current, minStock: "", maxStock: "" }
                            : current,
                        );
                      }}
                      disabled={isSaving}
                    />
                    <UiNumberField
                      id="sku-max-stock"
                      label={t("masterData.sku.fieldMaxStock")}
                      fullWidth
                      value={form.maxStock}
                      rule={NUMBER_RULES.stockMax}
                      placeholder={t("masterData.sku.thresholdPlaceholder")}
                      helperText={
                        fieldErrors.maxStock ||
                        t("masterData.sku.maxStockHelper")
                      }
                      error={Boolean(fieldErrors.maxStock)}
                      onChange={(next) => {
                        setForm((current) => ({ ...current, maxStock: next }));
                        setFieldErrors((current) =>
                          current.maxStock
                            ? { ...current, maxStock: "" }
                            : current,
                        );
                      }}
                      disabled={isSaving}
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
/**
 * Trần độ dài ô chữ nơi nhận — khớp BE BaM1RecipientController /
 * StoreAgencyRequest (agency_code 50, agency_name 255, market/region 120,
 * contact_name 200). Giữ ĐỒNG BỘ với `RecipientCreateDialog` (form tạo nhanh).
 */
const AGENCY_TEXT_MAX = {
  agency_code: 50,
  agency_name: 255,
  market: 120,
  region: 120,
  contact_name: 200,
  // Địa chỉ lưu dạng JSON (UiAddressField): chi tiết 200 + tên tỉnh/xã + khoá
  // ≈ 350 ký tự, trần 500 cùng số với màn cấu hình kho.
  address: 500,
} as const;

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
  const { sortedRows, sortState, requestSort, originalIndexOf } = useClientSort(
    rows,
    {
      code: (r) => r.agency_code,
      name: (r) => r.agency_name,
      recipientType: (r) =>
        r.recipient_type ? recipientTypeLabel(r.recipient_type) : null,
      // Sắp theo CHỮ người dùng đọc: mã `CAN_THO` và nhãn 'Cần Thơ' cho ra
      // hai thứ tự khác nhau, xếp theo mã thì cột nhìn như xếp lung tung.
      market: (r) => agencyPlaceLabel(r.market) || null,
      region: (r) => agencyPlaceLabel(r.region) || null,
      contact: (r) => r.contact_name,
      phone: (r) => r.phone,
      address: (r) => formatAddress(r.address),
      status: (r) => r.status,
    },
  );

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
    } else {
      const codeError = codeFormatError(
        form.agency_code.trim(),
        editing?.agency_code,
      );
      if (codeError) errors.agency_code = codeError;
    }
    if (!form.agency_name.trim()) {
      errors.agency_name = t("masterData.recipient.errName");
    }
    // Trần độ dài theo BE — chỉ ghi lỗi khi ô chưa có lỗi "bắt buộc".
    for (const key of Object.keys(AGENCY_TEXT_MAX) as Array<
      keyof typeof AGENCY_TEXT_MAX
    >) {
      const max = AGENCY_TEXT_MAX[key];
      if (!errors[key] && (form[key] ?? "").trim().length > max) {
        errors[key] = t("shared.validation.textMaxLength", { max });
      }
    }
    const phone = form.phone?.trim() ?? "";
    if (phone) {
      // Dùng luật SĐT dùng chung (10 số, đầu số VN) thay vì regex chép tay.
      const phoneCheck = validatePhone(phone);
      if (!phoneCheck.isValid) {
        errors.phone =
          phoneCheck.errorMessage ?? t("masterData.recipient.errPhone");
      }
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
      <div
        className="hn-mvp-source-screen hn-agency-screen"
        data-mvp-screen="AGY-01"
      >
        {confirmDialog}
        <header className="agy-heading">
          <div>
            <h1>Đại lý &amp; Nơi nhận</h1>
            <p>Quản lý hồ sơ đối tượng nhận hàng phục vụ nghiệp vụ xuất kho</p>
          </div>
          {canManage ? (
            <ActionButton kind="create" onClick={openCreate}>
              {t("masterData.recipient.create")}
            </ActionButton>
          ) : null}
        </header>
        <section
          className="agy-list-card"
          aria-label="Danh sách đại lý và nơi nhận"
        >
          <div className="agy-list-heading">
            <h2>Danh sách đại lý &amp; nơi nhận</h2>
            <span className="agy-total">
              {query.isLoading ? "—" : pagination.total.toLocaleString("vi-VN")}
            </span>
          </div>
          <div className="agy-toolbar">
            <div className="agy-filter">
              <span>Tìm kiếm</span>
              <div className="agy-search">
                <SearchOutlined aria-hidden="true" />
                <UiTextField
                  value={keyword}
                  onChange={(event) => {
                    setKeyword(event.target.value);
                    setPage(1);
                  }}
                  placeholder={t("masterData.recipient.searchPlaceholder")}
                  fullWidth
                  slotProps={{
                    htmlInput: {
                      "aria-label": t("masterData.recipient.searchAria"),
                    },
                  }}
                />
              </div>
            </div>
            <div className="agy-filter">
              <span>Loại nơi nhận</span>
              <UiSelect
                aria-label={t("masterData.recipient.typeFilterAria")}
                value={recipientType}
                onChange={(value) => {
                  setRecipientType(value as RecipientType | "");
                  setPage(1);
                }}
                placeholder={t("masterData.recipient.typeFilterPlaceholder")}
                fullWidth
                menuClassName="agy-select-menu"
                options={RECIPIENT_TYPES.map((value) => ({
                  value,
                  label: RECIPIENT_TYPE_LABELS[value],
                }))}
              />
            </div>
            <div className="agy-filter">
              <span>Trạng thái</span>
              <UiSelect
                aria-label={t("masterData.status.filterAria")}
                value={status}
                onChange={(value) => {
                  setStatus(value as MasterStatus | "");
                  setPage(1);
                }}
                placeholder={t("masterData.status.allPlaceholder")}
                fullWidth
                menuClassName="agy-select-menu"
                options={statusOptions(t)}
              />
            </div>
          </div>

          <ApiErrorAlert
            error={query.error}
            fallback={t("masterData.recipient.errLoad")}
            onRetry={() => void query.refetch()}
          />

          <Box className="agy-table-wrap" aria-busy={query.isLoading}>
            <table className="agy-table">
              <thead>
                <tr>
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
                  <th aria-label={t("masterData.common.actionsAria")}>
                    Thao tác
                  </th>
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
                  sortedRows.map((record) => (
                    <tr key={record.agency_id}>
                      <td className="stt-col">
                        {mvpRowNumber(page, perPage, originalIndexOf(record))}
                      </td>
                      <td>{record.agency_code}</td>
                      <td style={TRUNCATE_CELL_STYLE}>
                        <TruncatedText lines={1} maxWidth={220}>
                          {record.agency_name}
                        </TruncatedText>
                      </td>
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
                      <td>{agencyPlaceLabel(record.market) || EMPTY_TEXT}</td>
                      <td>{agencyPlaceLabel(record.region) || EMPTY_TEXT}</td>
                      <td>{record.contact_name || EMPTY_TEXT}</td>
                      <td>{record.phone || EMPTY_TEXT}</td>
                      <td style={TRUNCATE_CELL_STYLE}>
                        <TruncatedText maxWidth={300}>
                          {formatAddress(record.address) || EMPTY_TEXT}
                        </TruncatedText>
                      </td>
                      <td
                        className={
                          record.status === "ACTIVE"
                            ? "agy-status-active"
                            : "agy-status-inactive"
                        }
                      >
                        <UiStatusBadge
                          tone={masterStatusTone(record.status)}
                          label={masterStatusLabel(record.status, t)}
                        />
                      </td>
                      <td>
                        {canManage ? (
                          <RowActionButton
                            kind="edit"
                            onClick={() => openEdit(record)}
                          >
                            {t("masterData.common.edit")}
                          </RowActionButton>
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
                    <td colSpan={11} className="muted">
                      {t("masterData.recipient.empty")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Box>

          <div className="agy-footer-row">
            <MvpPaginationFooter
              current={pagination.current}
              pageSize={perPage}
              total={pagination.total}
              itemLabel={t("masterData.recipient.itemLabel")}
              onChange={setPage}
            />
            <div className="agy-filter agy-page-size">
              <span>Số dòng mỗi trang</span>
              <UiSelect
                aria-label={t("masterData.common.pageSizeAria")}
                value={perPage}
                onChange={(value) => {
                  setPerPage(Number(value));
                  setPage(1);
                }}
                fullWidth
                menuClassName="agy-select-menu"
                options={perPageOptions.map((size) => ({
                  value: size,
                  label: `${size} / trang`,
                }))}
              />
            </div>
          </div>
        </section>
        <UiDialog
          className="agy-dialog"
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
                  slotProps={{
                    htmlInput: { maxLength: AGENCY_TEXT_MAX.agency_code },
                  }}
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
                  slotProps={{
                    htmlInput: { maxLength: AGENCY_TEXT_MAX.agency_name },
                  }}
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
                    select: {
                      displayEmpty: true,
                      MenuProps: {
                        slotProps: { paper: { className: "agy-select-menu" } },
                      },
                    },
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
                  slotProps={{
                    htmlInput: { maxLength: AGENCY_TEXT_MAX.market },
                  }}
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
                  slotProps={{
                    htmlInput: { maxLength: AGENCY_TEXT_MAX.region },
                  }}
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
                  slotProps={{
                    htmlInput: { maxLength: AGENCY_TEXT_MAX.contact_name },
                  }}
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
                  slotProps={{
                    select: {
                      MenuProps: {
                        slotProps: { paper: { className: "agy-select-menu" } },
                      },
                    },
                  }}
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
                <UiAddressField
                  id="agency-address"
                  data-testid="agency-address"
                  label={t("masterData.recipient.colAddress")}
                  value={form.address ?? ""}
                  onChange={(value) => {
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
 * Trần độ dài ô chữ lỗi/bệnh — khớp BE StoreDefectCatalogRequest (defect_code
 * 80, defect_name 200); `description` BE không chặn nên FE tự đặt 2000 (mức
 * chung cho mô tả tự do của dự án).
 */
const DEFECT_TEXT_MAX = {
  defect_code: 80,
  defect_name: 200,
  description: 2000,
} as const;

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
  const language = useLanguageStore((state) => state.language);
  const copy = (vi: string, en: string) => (language === "en" ? en : vi);
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
  const [refreshKey, setRefreshKey] = useState(0);
  const [offline, setOffline] = useState(() => !navigator.onLine);
  const [notice, setNotice] = useState<DefectMutationNoticeValue | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [verificationCode, setVerificationCode] = useState<string | null>(null);
  const [reloadingRecord, setReloadingRecord] = useState(false);
  const recoverySession = useRef(0);
  const verificationRequest = useRef(0);
  const defectFormRef = useRef<HTMLFormElement>(null);
  const warehouseName = useAuthStore(
    (state) => state.currentContext?.warehouse_name,
  );
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      recoverySession.current += 1;
      verificationRequest.current += 1;
    };
  }, []);

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
  const { sortedRows, sortState, requestSort, originalIndexOf } = useClientSort(
    rows,
    {
      code: (r) => r.defect_code,
      name: (r) => r.defect_name,
      description: (r) => r.description,
      status: (r) => r.status,
    },
  );

  // Recovery responses belong to the form session that requested them.
  const resetRecovery = () => {
    recoverySession.current += 1;
    verificationRequest.current += 1;
    setReloadingRecord(false);
    setVerificationCode(null);
  };

  const openCreate = () => {
    setNotice(null);
    if (!canManage) return;
    resetRecovery();
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
    setNotice(null);
    if (!canManage) return;
    resetRecovery();
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

  const closeNow = () => {
    if (isSaving) return;
    resetRecovery();
    setModalOpen(false);
    setEditing(null);
    setFormError("");
    setFieldErrors({});
    setNotice(null);
    setDiscardOpen(false);
  };
  const initialForm = editing
    ? {
        defect_code: editing.defect_code,
        defect_name: editing.defect_name,
        description: editing.description ?? "",
        status: editing.status,
      }
    : EMPTY_DEFECT_FORM;
  const dirty = (Object.keys(initialForm) as (keyof DefectPayload)[]).some(
    (key) => (form[key] ?? "") !== (initialForm[key] ?? ""),
  );
  const close = () => {
    if (isSaving) return;
    // Stop a late reload from replacing the draft while the exit prompt is open.
    if (reloadingRecord) {
      recoverySession.current += 1;
      setReloadingRecord(false);
    }
    if (dirty) setDiscardOpen(true);
    else closeNow();
  };
  const resetFilters = () => {
    setKeyword("");
    setStatus("");
    setPage(1);
  };
  const refresh = () => {
    setRefreshKey((key) => key + 1);
    void query.refetch();
  };
  const hasFilters = Boolean(keyword.trim() || status);
  const blockingError = rows.length === 0 && Boolean(query.error || offline);
  const busy = query.isLoading && !offline;
  const refreshing = Boolean(query.isFetching && !query.isLoading);
  const stale = rows.length > 0 && Boolean(query.error || offline);
  const mutationDisabled = busy || refreshing || stale || blockingError;
  const feedback = {
    error: query.error,
    loading: busy,
    refreshing,
    hasRows: rows.length > 0,
    hasFilters,
    offline,
    readonly: !canManage,
    onRetry: refresh,
    onReset: resetFilters,
    updatedAt: query.dataUpdatedAt,
  };
  const checkSavedResult = () => {
    // Verify the attempted code with an unfiltered, fresh read; never retry the write.
    const code = form.defect_code.trim();
    resetRecovery();
    setKeyword(code);
    setStatus("");
    setPage(1);
    setModalOpen(false);
    setVerificationCode(code);
  };
  const { refetch: refetchDefects } = query;
  useEffect(() => {
    if (
      verificationCode === null ||
      keyword !== verificationCode ||
      status !== "" ||
      page !== 1
    )
      return;
    const request = ++verificationRequest.current;
    const finish = () => {
      if (verificationRequest.current === request) setVerificationCode(null);
    };
    // A filter change does not cancel settlement of this pending verification.
    // A replaced/closed form or unmount invalidates its request token instead.
    void refetchDefects().then(finish, finish);
  }, [verificationCode, keyword, status, page, refetchDefects]);
  const reloadEditing = async () => {
    if (reloadingRecord || !editing || !modalOpen) return;
    const session = recoverySession.current;
    const recordId = editing.defect_id;
    setReloadingRecord(true);
    try {
      const result = await query.refetch();
      if (recoverySession.current !== session) return;
      if (result.isError || result.error) {
        setFormError(
          copy(
            "Không thể tải dữ liệu mới. Vui lòng thử lại; bản đang nhập vẫn được giữ nguyên.",
            "Unable to load the latest data. Try again; your draft has been preserved.",
          ),
        );
        return;
      }
      const current = result.data?.data.find(
        (row) => row.defect_id === recordId,
      );
      if (current) openEdit(current);
      else
        setFormError(
          copy(
            "Hồ sơ không còn trong kết quả hiện tại. Đóng biểu mẫu và cập nhật danh sách để kiểm tra lại.",
            "This record is no longer in the current results. Close the form and refresh the list to check it.",
          ),
        );
    } catch {
      if (recoverySession.current !== session) return;
      setFormError(
        copy(
          "Không thể tải dữ liệu mới. Vui lòng thử lại.",
          "Unable to load the latest data. Please try again.",
        ),
      );
    } finally {
      if (recoverySession.current === session) setReloadingRecord(false);
    }
  };

  const validateDefectForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.defect_code.trim())
      errors.defect_code = t("masterData.defect.errCode");
    else {
      const codeError = codeFormatError(
        form.defect_code.trim(),
        editing?.defect_code,
      );
      if (codeError) errors.defect_code = codeError;
    }
    if (!form.defect_name.trim())
      errors.defect_name = t("masterData.defect.errName");
    for (const key of Object.keys(DEFECT_TEXT_MAX) as Array<
      keyof typeof DEFECT_TEXT_MAX
    >) {
      const max = DEFECT_TEXT_MAX[key];
      if (!errors[key] && (form[key] ?? "").trim().length > max) {
        errors[key] = t("shared.validation.textMaxLength", { max });
      }
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    if (
      isSaving ||
      !canManage ||
      notice?.kind === "unknown" ||
      notice?.kind === "conflict"
    )
      return;
    setNotice(null);
    if (!validateDefectForm()) {
      setNotice({ kind: "validation" });
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLInputElement>(
            '#defect-master-form [aria-invalid="true"]',
          )
          ?.focus(),
      );
      return;
    }
    const payload: DefectPayload = {
      defect_code: form.defect_code.trim(),
      defect_name: form.defect_name.trim(),
      description: form.description?.trim() || null,
      status: form.status,
    };
    if (form.status === "INACTIVE" && editing?.status === "ACTIVE") {
      const confirmed = await confirmAction({
        title: t("masterData.defect.deactivateTitle"),
        content: (
          <span className="hn-defect-confirm-content">
            {t("masterData.defect.deactivateBody")}
          </span>
        ),
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
      setNotice({
        kind: "success",
        code: payload.defect_code,
        name: payload.defect_name,
        editing: Boolean(editing),
      });
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
      const normalized = normalizeError(error);
      const transportCode =
        typeof error === "object" && error !== null && "code" in error
          ? String(error.code)
          : "";
      const unknown = ["ECONNABORTED", "ETIMEDOUT", "ERR_NETWORK"].includes(
        transportCode,
      );
      const conflict =
        normalized.status === 412 ||
        /STALE_VERSION|VERSION_CONFLICT|CONCURRENCY/i.test(
          normalized.code ?? "",
        );
      const duplicate =
        Boolean(serverFieldErrors.defectCode) ||
        /DUPLICATE|ALREADY_EXISTS/i.test(normalized.code ?? "");
      setNotice({
        kind: unknown
          ? "unknown"
          : conflict
            ? "conflict"
            : duplicate
              ? "duplicate"
              : normalized.status === 422
                ? "validation"
                : "failed",
        code: payload.defect_code,
        editing: Boolean(editing),
      });
      setFormError(message ?? "");
    }
  };

  const perPageOptions = MVP_PAGE_SIZE_OPTIONS.includes(
    perPage as (typeof MVP_PAGE_SIZE_OPTIONS)[number],
  )
    ? MVP_PAGE_SIZE_OPTIONS
    : [...MVP_PAGE_SIZE_OPTIONS, perPage].sort((a, b) => a - b);

  return (
    <div
      className="hn-mvp-source-screen hn-defect-screen"
      data-mvp-screen="DEF-01"
    >
      {confirmDialog}
      <header className="hn-defect-header">
        <div className="hn-defect-heading-copy">
          <div className="hn-defect-title-row">
            <h1>{copy("Danh mục bệnh / lỗi", "Defect catalog")}</h1>
            {!canManage && (
              <span className="hn-defect-readonly">
                <DefectSymbol name="eye" />
                {copy("Chỉ xem", "View only")}
              </span>
            )}
          </div>
          <p>
            {copy(
              "Quản lý hồ sơ bệnh/lỗi phục vụ nghiệp vụ bảo hành",
              "Manage defect records for warranty operations",
            )}
          </p>
        </div>
        <div className="hn-defect-header-actions">
          <div className="hn-defect-warehouse">
            <DefectSymbol name="warehouse" />
            <div>
              <strong>{warehouseName || "Kho Hoa Nam"}</strong>
              <span>
                <i />
                {copy("Đang hoạt động", "Active")}
              </span>
            </div>
          </div>
          {canManage && (
            <ActionButton
              kind="create"
              icon={<DefectSymbol name="plus" />}
              aria-label={t("masterData.defect.create")}
              className="hn-defect-primary"
              onClick={openCreate}
              disabled={mutationDisabled}
            >
              {copy("Thêm lỗi / bệnh", "Add defect")}
            </ActionButton>
          )}
        </div>
      </header>
      {!blockingError && (
        <>
          <DefectOverview refreshKey={refreshKey} loading={busy} stale={stale} />
          <form
            className="hn-defect-filters"
            onSubmit={(event) => {
              event.preventDefault();
              refresh();
            }}
          >
            <div className="hn-defect-filter hn-defect-filter-search">
              <label htmlFor="defect-list-search">
                {copy("Tìm kiếm", "Search")}
              </label>
              <UiTextField
                id="defect-list-search"
                value={keyword}
                disabled={busy}
                onChange={(event) => {
                  setKeyword(event.target.value);
                  setPage(1);
                }}
                placeholder={copy(
                  "Nhập mã hoặc tên bệnh/lỗi",
                  "Enter defect code or name",
                )}
                slotProps={{
                  htmlInput: {
                    "aria-label": t("masterData.defect.searchAria"),
                  },
                  input: {
                    startAdornment: (
                      <DefectSymbol
                        name="search"
                        className="hn-defect-search-icon"
                      />
                    ),
                    endAdornment: keyword ? (
                      <button
                        className="hn-defect-clear"
                        type="button"
                        onClick={() => {
                          setKeyword("");
                          setPage(1);
                        }}
                        aria-label={copy("Xóa từ khóa", "Clear keyword")}
                      >
                        <DefectSymbol name="close" />
                      </button>
                    ) : undefined,
                  },
                }}
                fullWidth
              />
            </div>
            <div className="hn-defect-filter">
              <label htmlFor="defect-list-status">
                {t("masterData.status.label")}
              </label>
              <UiSelect
                id="defect-list-status"
                aria-label={t("masterData.status.filterAria")}
                value={status}
                disabled={busy}
                onChange={(value) => {
                  setStatus(value as MasterStatus | "");
                  setPage(1);
                }}
                fullWidth
                displayEmpty
                menuClassName="hn-defect-menu"
                options={[
                  { value: "", label: copy("Tất cả", "All") },
                  ...statusOptions(t),
                ]}
              />
            </div>
            <div className="hn-defect-filter-actions">
              <ActionButton
                kind="filter"
                icon={<span />}
                className="hn-defect-primary"
                type="submit"
                disabled={busy || refreshing || offline}
              >
                {copy("Áp dụng", "Apply")}
              </ActionButton>
              <ActionButton
                kind="reset"
                icon={<span />}
                className="hn-defect-secondary"
                onClick={resetFilters}
                disabled={busy}
              >
                {copy("Đặt lại", "Reset")}
              </ActionButton>
            </div>
          </form>
          {!canManage && (
            <div className="hn-defect-readonly-note">
              <DefectSymbol name="info" />
              {copy(
                "Bạn có thể tra cứu danh mục; chức năng thêm và sửa không khả dụng với quyền hiện tại.",
                "You can browse the catalog; adding and editing are unavailable with your current permissions.",
              )}
            </div>
          )}
        </>
      )}
      {stale && <DefectNotice {...feedback} />}
      {!modalOpen && notice && (
        <DefectMutationNotice
          notice={notice}
          placement="list"
          busy={verificationCode !== null}
          onDismiss={() => setNotice(null)}
          onCheck={checkSavedResult}
          onRetry={() => setModalOpen(true)}
          onReload={() => void reloadEditing()}
        />
      )}
      {blockingError ? (
        <section className="hn-defect-blocking">
          <DefectEmptyState {...feedback} />
        </section>
      ) : (
        <section
          className="hn-defect-list-card"
          aria-labelledby="defect-list-title"
        >
          <div className="hn-defect-list-heading">
            <h2 id="defect-list-title">
              {copy("Danh sách bệnh / lỗi", "Defect list")}
              <span className="hn-defect-count">
                {busy
                  ? "—"
                  : pagination.total.toLocaleString(
                      language === "en" ? "en-US" : "vi-VN",
                    )}{" "}
                {hasFilters
                  ? copy("kết quả", "results")
                  : copy("hồ sơ", "records")}
              </span>
              {stale && (
                <span className="hn-defect-stale-badge">
                  {copy("Dữ liệu gần nhất", "Last available data")}
                </span>
              )}
            </h2>
            <ActionButton
              kind="refresh"
              icon={<DefectSymbol name="refresh" />}
              className="hn-defect-secondary hn-defect-refresh"
              onClick={refresh}
              disabled={busy || offline}
              loading={refreshing}
            >
              {refreshing
                ? copy("Đang cập nhật...", "Updating...")
                : copy("Cập nhật mới nhất", "Refresh latest")}
            </ActionButton>
          </div>
          {refreshing && !stale && <DefectNotice {...feedback} />}
          {hasFilters && (
            <div className="hn-defect-applied">
              <DefectSymbol name="filter" />
              <strong>{copy("Đã áp dụng", "Applied")}</strong>
              {keyword.trim() && (
                <span>
                  {copy("Tìm kiếm:", "Search:")} {keyword.trim()}
                </span>
              )}
              {status && (
                <span>
                  {t("masterData.status.label")}: {masterStatusLabel(status, t)}
                </span>
              )}
            </div>
          )}
          <div
            className="hn-defect-table-scroll"
            role="region"
            aria-label={copy(
              "Bảng danh mục bệnh / lỗi",
              "Defect catalog table",
            )}
            tabIndex={0}
            aria-busy={busy || refreshing}
          >
            <table
              className="defect-table"
              data-empty={(!busy && sortedRows.length === 0) || undefined}
            >
              <thead>
                <tr>
                  <th className="stt-col">STT</th>
                  <SortableTh
                    className="code-col"
                    label={
                      <>
                        <span className="hn-defect-desktop-label">
                          {t("masterData.defect.colCode")}
                        </span>
                        <span className="hn-defect-tablet-label">
                          {copy("Mã / Tên lỗi, bệnh", "Code / Defect name")}
                        </span>
                      </>
                    }
                    tooltipLabel={t("masterData.defect.colCode")}
                    sortKey="code"
                    sortState={sortState}
                    onSort={requestSort}
                  />
                  <SortableTh
                    className="name-col"
                    label={t("masterData.defect.colName")}
                    sortKey="name"
                    sortState={sortState}
                    onSort={requestSort}
                  />
                  <SortableTh
                    className="description-col"
                    label={t("masterData.common.description")}
                    sortKey="description"
                    sortState={sortState}
                    onSort={requestSort}
                  />
                  <SortableTh
                    className="status-col"
                    label={t("masterData.status.label")}
                    sortKey="status"
                    sortState={sortState}
                    onSort={requestSort}
                    sortType="value"
                  />
                  <th className="actions-col">{copy("Thao tác", "Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {busy ? (
                  Array.from({ length: 7 }, (_, row) => (
                    <tr
                      key={row}
                      aria-hidden="true"
                      className="hn-defect-skeleton-row"
                    >
                      {[
                        "stt-col",
                        "code-col",
                        "name-col",
                        "description-col",
                        "status-col",
                        "actions-col",
                      ].map((col) => (
                        <td className={col} key={col}>
                          <span className="hn-defect-skeleton" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : sortedRows.length > 0 ? (
                  sortedRows.map((record) => (
                    <tr
                      key={record.defect_id}
                      data-status={record.status}
                      data-recently-saved={
                        (notice?.kind === "success" &&
                          notice.code === record.defect_code) ||
                        undefined
                      }
                    >
                      <td className="stt-col">
                        {String(
                          mvpRowNumber(page, perPage, originalIndexOf(record)),
                        ).padStart(2, "0")}
                      </td>
                      <td className="code-col">
                        <span>{record.defect_code}</span>
                        <span className="hn-defect-tablet-name">
                          {record.defect_name}
                        </span>
                      </td>
                      <td className="name-col">
                        <TruncatedText lines={1} maxWidth="100%">
                          {record.defect_name}
                        </TruncatedText>
                      </td>
                      <td className="description-col">
                        <TruncatedText lines={2} maxWidth="100%">
                          {record.description || EMPTY_TEXT}
                        </TruncatedText>
                      </td>
                      <td className="status-col">
                        <UiStatusBadge
                          tone={masterStatusTone(record.status)}
                          label={masterStatusLabel(record.status, t)}
                        />
                      </td>
                      <td className="actions-col">
                        {canManage ? (
                          <RowActionButton
                            kind="edit"
                            onClick={() => openEdit(record)}
                            disabled={mutationDisabled}
                          >
                            {t("masterData.common.edit")}
                          </RowActionButton>
                        ) : (
                          <span aria-label={copy("Chỉ xem", "View only")}>
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>
                      <DefectEmptyState {...feedback} />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {busy && (
            <span className="hn-defect-sr-only" role="status">
              {t("masterData.common.loadingData")}
            </span>
          )}
          <div className="hn-defect-pagination">
            <span>
              {copy("Hiển thị", "Showing")}{" "}
              {pagination.total === 0
                ? 0
                : (pagination.current - 1) * perPage + 1}
              {pagination.total > 0
                ? "–" + Math.min(pagination.current * perPage, pagination.total)
                : ""}{" "}
              / {pagination.total}{" "}
              {hasFilters
                ? copy("kết quả", "results")
                : copy("hồ sơ", "records")}
            </span>
            <div className="hn-defect-page-controls">
              <UiSelect
                aria-label={t("masterData.common.pageSizeAria")}
                value={perPage}
                disabled={busy}
                onChange={(value) => {
                  setPerPage(Number(value));
                  setPage(1);
                }}
                menuClassName="hn-defect-menu"
                options={perPageOptions.map((size) => ({
                  value: size,
                  label: t("shared.table.perPage", { size }),
                }))}
              />
              <UiPagination
                page={pagination.current}
                pageSize={perPage}
                total={pagination.total}
                showTotal={false}
                onPageChange={setPage}
              />
            </div>
          </div>
        </section>
      )}
      <UiDialog
        className="hn-defect-dialog"
        open={modalOpen}
        onClose={(event, reason) => guardBackdropClose(close)(event, reason)}
        maxWidth="sm"
        fullWidth
        title={
          <>
            <span className="hn-defect-dialog-title">
              <span className="hn-defect-dialog-icon">
                <DefectSymbol name={editing ? "edit" : "clipboard"} />
              </span>
              <span>
                {editing
                  ? copy("Sửa lỗi / bệnh", "Edit defect")
                  : copy("Thêm lỗi / bệnh", "Add defect")}
                <small>
                  {editing
                    ? copy(
                        "Các trường có dấu * là bắt buộc.",
                        "Fields marked * are required.",
                      )
                    : copy(
                        "Các trường có dấu * là bắt buộc.",
                        "Fields marked * are required.",
                      )}
                </small>
              </span>
            </span>
            <ActionIconButton
              kind="close"
              label={t("common.close")}
              onClick={close}
              disabled={isSaving}
              sx={{ position: "absolute", right: 16, top: 20 }}
            />
          </>
        }
        actions={
          <>
            <ActionButton
              kind="cancel"
              icon={<span />}
              className="hn-defect-secondary"
              onClick={close}
              disabled={isSaving}
            >
              {t("masterData.common.cancel")}
            </ActionButton>
            <ActionButton
              kind="save"
              icon={<span />}
              aria-label={t("masterData.defect.submit")}
              className="hn-defect-primary"
              disabled={
                isSaving ||
                notice?.kind === "unknown" ||
                notice?.kind === "conflict"
              }
              loading={isSaving}
              type="submit"
              form="defect-master-form"
            >
              {isSaving
                ? copy("Đang lưu...", "Saving...")
                : copy("Lưu", "Save")}
            </ActionButton>
          </>
        }
      >
        <form
          ref={defectFormRef}
          id="defect-master-form"
          onSubmit={submit}
          noValidate
        >
          <DefectMutationNotice
            notice={notice}
            placement="form"
            onDismiss={() => setNotice(null)}
            onCheck={checkSavedResult}
            onReload={() => void reloadEditing()}
            onRetry={() => defectFormRef.current?.requestSubmit()}
            busy={isSaving || reloadingRecord || verificationCode !== null}
          />
          {formError && <UiAlert tone="error">{formError}</UiAlert>}
          <div className="hn-defect-fields">
            <UiTextField
              id="defect-code"
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: { maxLength: DEFECT_TEXT_MAX.defect_code },
              }}
              label={t("masterData.defect.colCode")}
              required
              fullWidth
              autoFocus={!editing}
              value={form.defect_code}
              placeholder={copy("Nhập mã lỗi", "Enter defect code")}
              onChange={(event) => {
                setForm((current) => ({
                  ...current,
                  defect_code: event.target.value,
                }));
                setFieldErrors((current) => ({ ...current, defect_code: "" }));
              }}
              disabled={
                isSaving || reloadingRecord || notice?.kind === "unknown"
              }
              error={Boolean(fieldErrors.defect_code)}
              helperText={fieldErrors.defect_code}
            />
            <UiTextField
              id="defect-name"
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: { maxLength: DEFECT_TEXT_MAX.defect_name },
              }}
              label={t("masterData.defect.colName")}
              required
              fullWidth
              autoFocus={Boolean(editing)}
              value={form.defect_name}
              placeholder={copy("Nhập tên lỗi / bệnh", "Enter defect name")}
              onChange={(event) => {
                setForm((current) => ({
                  ...current,
                  defect_name: event.target.value,
                }));
                setFieldErrors((current) => ({ ...current, defect_name: "" }));
              }}
              disabled={
                isSaving || reloadingRecord || notice?.kind === "unknown"
              }
              error={Boolean(fieldErrors.defect_name)}
              helperText={fieldErrors.defect_name}
            />
            <UiTextField
              id="defect-description"
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: { maxLength: DEFECT_TEXT_MAX.description },
              }}
              label={t("masterData.common.description")}
              fullWidth
              multiline
              minRows={3}
              value={form.description ?? ""}
              placeholder={copy("Nhập mô tả", "Enter description")}
              onChange={(event) => {
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                }));
                setFieldErrors((current) => ({ ...current, description: "" }));
              }}
              disabled={
                isSaving || reloadingRecord || notice?.kind === "unknown"
              }
              error={Boolean(fieldErrors.description)}
              helperText={fieldErrors.description}
            />
            <UiTextField
              id="defect-status"
              slotProps={{
                inputLabel: { shrink: true },
                select: {
                  MenuProps: {
                    slotProps: { paper: { className: "hn-defect-menu" } },
                  },
                },
              }}
              select
              label={t("masterData.status.label")}
              fullWidth
              disabled={
                isSaving || reloadingRecord || notice?.kind === "unknown"
              }
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
          </div>
          {isSaving && (
            <div className="hn-defect-saving" role="status">
              <span className="hn-defect-loader" />
              {copy(
                "Đang lưu thông tin lỗi/bệnh...",
                "Saving defect information...",
              )}
            </div>
          )}
        </form>
      </UiDialog>
      <UiDialog
        className="hn-defect-dialog hn-defect-discard"
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        title={copy("Bạn có thay đổi chưa lưu", "You have unsaved changes")}
        actions={
          <>
            <ActionButton
              kind="confirm"
              icon={<span />}
              className="hn-defect-secondary"
              onClick={closeNow}
            >
              {copy("Bỏ thay đổi", "Discard changes")}
            </ActionButton>
            <ActionButton
              kind="cancel"
              icon={<span />}
              className="hn-defect-primary"
              autoFocus
              onClick={() => setDiscardOpen(false)}
            >
              {copy("Tiếp tục chỉnh sửa", "Continue editing")}
            </ActionButton>
          </>
        }
      >
        <p>
          {copy(
            "Rời khỏi biểu mẫu sẽ bỏ các thay đổi chưa lưu.",
            "Leaving the form will discard unsaved changes.",
          )}
        </p>
      </UiDialog>
    </div>
  );
}
