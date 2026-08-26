import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Modal, Tag } from "antd";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  ThemeProvider,
  Typography,
} from "@mui/material";
import { muiTheme } from "@/app/mui-theme";
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
} from "@/shared/components/icons";
import { toast } from "sonner";
import { SkuImportModal } from "@/modules/master-data/components/SkuImportModal";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { ACTION_ICON_COLORS } from "@/shared/theme/actionIconColors";
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
import { MvpPaginationFooter } from "@/shared/components/mvp/MvpListPagination";
import {
  MVP_PAGE_SIZE_OPTIONS,
  resolveApiPagination,
} from "@/shared/components/mvp/mvp-pagination";
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

/**
 * Toolbar filter cần nhỏ gọn hơn field trong form (đồng bộ chuẩn với
 * IamUserScreen) — dùng chung cho toolbar của cả Sku/Agency/Defect Master.
 * Xem gotcha #4 trong memory pilot MUI: sx gốc của TextField áp vào
 * .MuiFormControl-root (khung bọc ngoài) chứ không phải .MuiOutlinedInput-root,
 * còn Select thì gốc sx chính là khung viền — selector kép
 * "&, & .MuiOutlinedInput-root" xử lý được cả hai.
 */
const MASTER_TOOLBAR_SX = {
  "&, & .MuiOutlinedInput-root": { height: 35 },
  "& .MuiSelect-select, & .MuiInputBase-input": {
    paddingTop: "8px !important",
    paddingBottom: "8px !important",
    fontSize: "13.5px !important",
    boxSizing: "border-box",
  },
};

function skuStatusChipColor(status: MasterStatus): "success" | "warning" {
  return status === "ACTIVE" ? "success" : "warning";
}

/** Cặp nhãn/giá trị trong Dialog "Chi tiết SKU" (thay antd Descriptions.Item). */
function SkuDetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Grid size={{ xs: 12, md: 6 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
        {label}
      </Typography>
      <Typography variant="body2" component="div">
        {value}
      </Typography>
    </Grid>
  );
}

/**
 * Bản MUI riêng cho form SKU — KHÔNG dùng lại component `MasterSelect` (antd
 * shim) vì nó còn dùng chung cho AgencyMasterScreen/DefectMasterScreen trong
 * cùng file này; đổi `MasterSelect` sẽ ảnh hưởng 2 màn đó ngoài phạm vi yêu
 * cầu. Giữ đúng hành vi gốc: option "Giữ liên kết hiện tại (đã ngừng sử
 * dụng)" khi giá trị đang chọn không còn trong danh sách ACTIVE.
 */
function SkuCatalogSelect({
  id,
  label,
  required,
  value,
  options,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  required?: boolean;
  value: string;
  options?: CatalogRefRecord[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const rows = options ?? [];
  const isMissing = Boolean(value) && !rows.some((row) => row.id === value);
  const labelId = `${id}-label`;
  return (
    <Box>
      <FormControl fullWidth required={required} disabled={disabled}>
        <InputLabel id={labelId} shrink>
          {label}
        </InputLabel>
        <Select
          id={id}
          labelId={labelId}
          label={label}
          displayEmpty
          value={value}
          onChange={(event) => onChange(event.target.value)}
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
        </Select>
      </FormControl>
      {isMissing ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
          Danh mục đang gán đã ngừng sử dụng — giữ nguyên hoặc chọn danh mục
          khác.
        </Typography>
      ) : null}
    </Box>
  );
}

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

  const perPageOptions = MVP_PAGE_SIZE_OPTIONS.includes(
    perPage as (typeof MVP_PAGE_SIZE_OPTIONS)[number],
  )
    ? MVP_PAGE_SIZE_OPTIONS
    : [...MVP_PAGE_SIZE_OPTIONS, perPage].sort((a, b) => a - b);

  return (
    <ThemeProvider theme={muiTheme}>
      <div className="hn-mvp-source-screen" data-mvp-screen="MST-01">
      <div className="toolbar">
        <TextField
          value={keyword}
          onChange={(event) => {
            setKeyword(event.target.value);
            setPage(1);
          }}
          placeholder="Tìm mã / tên SKU"
          slotProps={{ htmlInput: { "aria-label": "Tìm SKU" } }}
          sx={{ minWidth: 190, ...MASTER_TOOLBAR_SX }}
        />
        <Select
          displayEmpty
          value={type}
          onChange={(event) => {
            setType(event.target.value as SkuType | "");
            setPage(1);
          }}
          inputProps={{ "aria-label": "Lọc theo loại SKU" }}
          sx={{ minWidth: 128, ...MASTER_TOOLBAR_SX }}
        >
          <MenuItem value="">Loại: Tất cả</MenuItem>
          <MenuItem value="PRODUCT">Sản phẩm</MenuItem>
          <MenuItem value="COMPONENT">Linh kiện</MenuItem>
        </Select>
        <Select
          displayEmpty
          value={brandId}
          disabled={catalogsQuery.isLoading}
          onChange={(event) => {
            setBrandId(event.target.value);
            setPage(1);
          }}
          inputProps={{ "aria-label": "Lọc theo hãng" }}
          sx={{ minWidth: 136, ...MASTER_TOOLBAR_SX }}
        >
          <MenuItem value="">Hãng: Tất cả</MenuItem>
          {brands.map((brand) => (
            <MenuItem key={brand.id} value={brand.id}>
              {brand.name || brand.code}
            </MenuItem>
          ))}
        </Select>
        <Select
          displayEmpty
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as MasterStatus | "");
            setPage(1);
          }}
          inputProps={{ "aria-label": "Lọc theo trạng thái" }}
          sx={{ minWidth: 128, ...MASTER_TOOLBAR_SX }}
        >
          <MenuItem value="">Trạng thái: Tất cả</MenuItem>
          {STATUS_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
        <Select
          value={perPage}
          onChange={(event) => {
            setPerPage(Number(event.target.value));
            setPage(1);
          }}
          inputProps={{ "aria-label": "Số dòng mỗi trang" }}
          sx={{ minWidth: 92, ...MASTER_TOOLBAR_SX }}
        >
          {perPageOptions.map((size) => (
            <MenuItem key={size} value={size}>
              {size} / trang
            </MenuItem>
          ))}
        </Select>
        <div className="spacer" />
        {canManage ? (
          <Button
            variant="outlined"
            onClick={() => setImportModalOpen(true)}
            startIcon={
              <ImportOutlined style={{ color: ACTION_ICON_COLORS.upload }} />
            }
          >
            Nhập từ Excel
          </Button>
        ) : null}
        {canManage ? (
          <Button
            variant="contained"
            onClick={openCreate}
            startIcon={<PlusOutlined />}
          >
            Thêm SKU
          </Button>
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
        <Alert
          severity="error"
          sx={{ mb: "14px" }}
          action={
            <Button
              size="small"
              color="inherit"
              onClick={() => setPublishError(null)}
              startIcon={
                <CloseCircleOutlined style={{ color: ACTION_ICON_COLORS.neutral }} />
              }
            >
              Đóng
            </Button>
          }
        >
          {getApiErrorMessage(
            publishError,
            "Không cập nhật được trạng thái hiển thị trên ứng dụng phân vùng.",
          )}
        </Alert>
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
                      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                        <Button
                          size="small"
                          onClick={() => setViewing(record)}
                          startIcon={
                            <EyeOutlined style={{ color: ACTION_ICON_COLORS.view }} />
                          }
                        >
                          Xem
                        </Button>
                        {canManage ? (
                          <Button
                            size="small"
                            onClick={() => openEdit(record)}
                            startIcon={
                              <EditOutlined style={{ color: ACTION_ICON_COLORS.edit }} />
                            }
                          >
                            Sửa
                          </Button>
                        ) : null}
                        {canPublish ? (
                          <Button
                            size="small"
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
                            startIcon={
                              isPublished ? (
                                <CloudDownloadOutlined
                                  style={{ color: ACTION_ICON_COLORS.danger }}
                                />
                              ) : (
                                <CloudUploadOutlined
                                  style={{ color: ACTION_ICON_COLORS.success }}
                                />
                              )
                            }
                          >
                            {isPublished ? "Gỡ khỏi ứng dụng" : "Đưa lên ứng dụng"}
                          </Button>
                        ) : null}
                      </Stack>
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

      <Dialog
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: { maxWidth: 760 } } }}
      >
        <DialogTitle sx={{ pr: 6, position: "relative" }}>
          Chi tiết SKU
          <IconButton
            aria-label="Đóng"
            onClick={() => setViewing(null)}
            sx={{ position: "absolute", right: 10, top: 8 }}
          >
            <CloseOutlined style={{ fontSize: 15 }} />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {viewing ? (
            <Box
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                p: 2,
              }}
            >
              <Grid container spacing={2}>
                <SkuDetailField label="Mã SKU" value={viewing.sku_code ?? viewing.code} />
                <SkuDetailField label="Tên SKU" value={viewing.sku_name ?? viewing.name} />
                <SkuDetailField label="Loại" value={skuTypeLabel(viewing.sku_type)} />
                <SkuDetailField label="Đơn vị tính" value={viewing.unit || "—"} />
                <SkuDetailField label="Hãng" value={refLabel(brandIndex, viewing.brand_id)} />
                <SkuDetailField
                  label="Nhóm hàng"
                  value={refLabel(categoryIndex, viewing.category_id)}
                />
                <SkuDetailField label="Model" value={refLabel(modelIndex, viewing.model_id)} />
                <SkuDetailField
                  label="Nguồn điện"
                  value={
                    viewing.power_source_id
                      ? refLabel(powerSourceIndex, viewing.power_source_id)
                      : viewing.power_or_voltage || "—"
                  }
                />
                <SkuDetailField
                  label="Quy cách đóng gói"
                  value={
                    viewing.package_variant_id
                      ? refLabel(packageVariantIndex, viewing.package_variant_id)
                      : viewing.package_variant || "—"
                  }
                />
                <SkuDetailField
                  label="Phiên bản sản phẩm"
                  value={viewing.version_code || "—"}
                />
                <SkuDetailField
                  label="Quản lý số sê-ri"
                  value={viewing.is_serial_tracked ? "Có" : "Không"}
                />
                <SkuDetailField
                  label="Trạng thái"
                  value={
                    <Chip
                      label={masterStatusLabel(viewing.status)}
                      color={skuStatusChipColor(viewing.status)}
                      size="small"
                    />
                  }
                />
                <SkuDetailField
                  label="Ứng dụng phân vùng"
                  value={viewing.published_to_app ? "Đang hiển thị" : "Chưa hiển thị"}
                />
              </Grid>
            </Box>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={modalOpen} onClose={close} maxWidth="md" fullWidth>
        <DialogTitle sx={{ pr: 6, position: "relative" }}>
          {editing ? "Sửa SKU" : "Thêm SKU"}
          <IconButton
            aria-label="Đóng"
            onClick={close}
            disabled={isSaving}
            sx={{ position: "absolute", right: 10, top: 8 }}
          >
            <CloseOutlined style={{ fontSize: 15 }} />
          </IconButton>
        </DialogTitle>
        <form onSubmit={submit}>
          <DialogContent dividers>
            {formError ? (
              <Alert severity="error" sx={{ mb: "14px" }}>
                {formError}
              </Alert>
            ) : null}
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Box
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    p: 2,
                    height: "100%",
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
                    Thông tin SKU
                  </Typography>
                  <Stack spacing={2}>
                    <TextField
                      id="sku-code"
                      label="Mã SKU"
                      required
                      fullWidth
                      value={form.code}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          code: event.target.value,
                        }))
                      }
                      disabled={isSaving || identityLocked}
                      helperText={
                        identityLocked
                          ? "SKU đã có tồn kho — không thể đổi mã SKU."
                          : undefined
                      }
                    />
                    <TextField
                      id="sku-name"
                      label="Tên SKU"
                      required
                      fullWidth
                      value={form.name}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      disabled={isSaving}
                    />
                    <FormControl fullWidth disabled={isSaving}>
                      <InputLabel id="sku-type-label">Loại SKU</InputLabel>
                      <Select
                        id="sku-type"
                        labelId="sku-type-label"
                        label="Loại SKU"
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
                      </Select>
                    </FormControl>
                    <TextField
                      id="sku-unit"
                      label="Đơn vị tính"
                      fullWidth
                      value={form.unit}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          unit: event.target.value,
                        }))
                      }
                      disabled={isSaving}
                    />
                    <FormControl fullWidth disabled={isSaving}>
                      <InputLabel id="sku-status-label">Trạng thái</InputLabel>
                      <Select
                        id="sku-status"
                        labelId="sku-status-label"
                        label="Trạng thái"
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
                      </Select>
                    </FormControl>
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
                        label="Cho phép hiển thị SKU này trên ứng dụng phân vùng"
                      />
                      {form.status !== "ACTIVE" ? (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: "block", mt: 0.5 }}
                        >
                          Chỉ SKU đang sử dụng mới được đưa lên ứng dụng.
                        </Typography>
                      ) : null}
                    </Box>
                  </Stack>
                </Box>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Box
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    p: 2,
                    height: "100%",
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                    Danh mục tham chiếu
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
                    Chọn các danh mục đang sử dụng cho Hãng, Nhóm hàng, Model và
                    Nguồn điện.
                  </Typography>
                  <Stack spacing={2}>
                    <SkuCatalogSelect
                      id="sku-brand"
                      label="Hãng"
                      required
                      value={form.brandId}
                      options={catalogs.brands}
                      disabled={isSaving}
                      onChange={(value) =>
                        setForm((current) => ({ ...current, brandId: value }))
                      }
                    />
                    <SkuCatalogSelect
                      id="sku-category"
                      label="Nhóm hàng"
                      required
                      value={form.categoryId}
                      options={catalogs.categories}
                      disabled={isSaving}
                      onChange={(value) =>
                        setForm((current) => ({ ...current, categoryId: value }))
                      }
                    />
                    <SkuCatalogSelect
                      id="sku-model"
                      label="Model"
                      required
                      value={form.modelId}
                      options={catalogs.models}
                      disabled={isSaving}
                      onChange={(value) =>
                        setForm((current) => ({ ...current, modelId: value }))
                      }
                    />
                    <SkuCatalogSelect
                      id="sku-power-source"
                      label="Nguồn điện"
                      required
                      value={form.powerSourceId}
                      options={catalogs.powerSources}
                      disabled={isSaving}
                      onChange={(value) =>
                        setForm((current) => ({ ...current, powerSourceId: value }))
                      }
                    />
                    <SkuCatalogSelect
                      id="sku-package-variant"
                      label="Quy cách đóng gói"
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
                    <TextField
                      id="sku-version-code"
                      label="Phiên bản sản phẩm"
                      fullWidth
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
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: "block", mt: 0.5 }}
                        >
                          SKU đã có tồn kho — không thể đổi chế độ quản lý số
                          sê-ri.
                        </Typography>
                      ) : null}
                    </Box>
                  </Stack>
                </Box>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={close}
              disabled={isSaving}
              startIcon={
                <CloseOutlined style={{ color: ACTION_ICON_COLORS.neutral }} />
              }
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={isSaving}
              startIcon={<SaveOutlined />}
            >
              {isSaving ? "Đang lưu..." : "Lưu SKU"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
      </div>
    </ThemeProvider>
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

  const perPageOptions = MVP_PAGE_SIZE_OPTIONS.includes(
    perPage as (typeof MVP_PAGE_SIZE_OPTIONS)[number],
  )
    ? MVP_PAGE_SIZE_OPTIONS
    : [...MVP_PAGE_SIZE_OPTIONS, perPage].sort((a, b) => a - b);

  return (
    <ThemeProvider theme={muiTheme}>
      <div className="hn-mvp-source-screen" data-mvp-screen="AGY-01">
      <div className="toolbar">
        <TextField
          value={keyword}
          onChange={(event) => {
            setKeyword(event.target.value);
            setPage(1);
          }}
          placeholder="Tìm mã / tên / thị trường / khu vực"
          sx={{ minWidth: 220, ...MASTER_TOOLBAR_SX }}
        />
        <Select
          displayEmpty
          value={recipientType}
          onChange={(event) => {
            setRecipientType(event.target.value as RecipientType | "");
            setPage(1);
          }}
          inputProps={{ "aria-label": "Lọc theo loại nơi nhận" }}
          sx={{ minWidth: 160, ...MASTER_TOOLBAR_SX }}
        >
          <MenuItem value="">Loại nơi nhận: Tất cả</MenuItem>
          {RECIPIENT_TYPES.map((value) => (
            <MenuItem key={value} value={value}>
              {RECIPIENT_TYPE_LABELS[value]}
            </MenuItem>
          ))}
        </Select>
        <Select
          displayEmpty
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as MasterStatus | "");
            setPage(1);
          }}
          inputProps={{ "aria-label": "Lọc theo trạng thái" }}
          sx={{ minWidth: 128, ...MASTER_TOOLBAR_SX }}
        >
          <MenuItem value="">Trạng thái: Tất cả</MenuItem>
          {STATUS_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
        <Select
          value={perPage}
          onChange={(event) => {
            setPerPage(Number(event.target.value));
            setPage(1);
          }}
          inputProps={{ "aria-label": "Số dòng mỗi trang" }}
          sx={{ minWidth: 92, ...MASTER_TOOLBAR_SX }}
        >
          {perPageOptions.map((size) => (
            <MenuItem key={size} value={size}>
              {size} / trang
            </MenuItem>
          ))}
        </Select>
        <div className="spacer" />
        {canManage ? (
          <Button variant="contained" onClick={openCreate} startIcon={<PlusOutlined />}>
            Thêm nơi nhận
          </Button>
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
                      <Button
                        size="small"
                        onClick={() => openEdit(record)}
                        startIcon={
                          <EditOutlined style={{ color: ACTION_ICON_COLORS.edit }} />
                        }
                      >
                        Sửa
                      </Button>
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

      <Dialog open={modalOpen} onClose={close} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pr: 6, position: "relative" }}>
          {editing ? "Sửa nơi nhận" : "Thêm nơi nhận"}
          <IconButton
            aria-label="Đóng"
            onClick={close}
            disabled={isSaving}
            sx={{ position: "absolute", right: 10, top: 8 }}
          >
            <CloseOutlined style={{ fontSize: 15 }} />
          </IconButton>
        </DialogTitle>
        <form onSubmit={submit}>
          <DialogContent dividers>
            {formError ? (
              <Alert severity="error" sx={{ mb: "14px" }}>
                {formError}
              </Alert>
            ) : null}
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  id="agency-code"
                  label="Mã nơi nhận"
                  required
                  fullWidth
                  value={form.agency_code}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      agency_code: event.target.value,
                    }))
                  }
                  disabled={isSaving}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  id="agency-name"
                  label="Tên nơi nhận"
                  required
                  fullWidth
                  value={form.agency_name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      agency_name: event.target.value,
                    }))
                  }
                  disabled={isSaving}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth required disabled={isSaving}>
                  <InputLabel id="agency-recipient-type-label" shrink>
                    Loại nơi nhận
                  </InputLabel>
                  <Select
                    id="agency-recipient-type"
                    labelId="agency-recipient-type-label"
                    label="Loại nơi nhận"
                    displayEmpty
                    value={form.recipient_type}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        recipient_type: event.target.value as RecipientType | "",
                      }))
                    }
                  >
                    <MenuItem value="">Chọn loại nơi nhận</MenuItem>
                    {RECIPIENT_TYPES.map((value) => (
                      <MenuItem key={value} value={value}>
                        {RECIPIENT_TYPE_LABELS[value]}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  id="agency-market"
                  label="Thị trường"
                  fullWidth
                  value={form.market ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      market: event.target.value,
                    }))
                  }
                  disabled={isSaving}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  id="agency-region"
                  label="Khu vực"
                  fullWidth
                  value={form.region ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      region: event.target.value,
                    }))
                  }
                  disabled={isSaving}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  id="agency-contact-name"
                  label="Người liên hệ"
                  fullWidth
                  value={form.contact_name ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      contact_name: event.target.value,
                    }))
                  }
                  disabled={isSaving}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  id="agency-phone"
                  label="Điện thoại"
                  fullWidth
                  value={form.phone ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      phone: event.target.value.replace(/\D/g, "").slice(0, 10),
                    }))
                  }
                  disabled={isSaving}
                  slotProps={{ htmlInput: { inputMode: "numeric", maxLength: 10 } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth disabled={isSaving}>
                  <InputLabel id="agency-status-label">Trạng thái</InputLabel>
                  <Select
                    id="agency-status"
                    labelId="agency-status-label"
                    label="Trạng thái"
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
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={12}>
                <TextField
                  id="agency-address"
                  label="Địa chỉ"
                  fullWidth
                  multiline
                  minRows={3}
                  value={form.address ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      address: event.target.value,
                    }))
                  }
                  disabled={isSaving}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={close}
              disabled={isSaving}
              startIcon={
                <CloseOutlined style={{ color: ACTION_ICON_COLORS.neutral }} />
              }
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={isSaving}
              startIcon={<SaveOutlined />}
            >
              {isSaving ? "Đang lưu..." : "Lưu nơi nhận"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
      </div>
    </ThemeProvider>
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

  const perPageOptions = MVP_PAGE_SIZE_OPTIONS.includes(
    perPage as (typeof MVP_PAGE_SIZE_OPTIONS)[number],
  )
    ? MVP_PAGE_SIZE_OPTIONS
    : [...MVP_PAGE_SIZE_OPTIONS, perPage].sort((a, b) => a - b);

  return (
    <ThemeProvider theme={muiTheme}>
      <div className="hn-mvp-source-screen" data-mvp-screen="DEF-01">
      <div className="toolbar">
        <TextField
          value={keyword}
          onChange={(event) => {
            setKeyword(event.target.value);
            setPage(1);
          }}
          placeholder="Tìm mã / tên lỗi"
          sx={{ minWidth: 220, ...MASTER_TOOLBAR_SX }}
        />
        <Select
          displayEmpty
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as MasterStatus | "");
            setPage(1);
          }}
          inputProps={{ "aria-label": "Lọc theo trạng thái" }}
          sx={{ minWidth: 128, ...MASTER_TOOLBAR_SX }}
        >
          <MenuItem value="">Trạng thái: Tất cả</MenuItem>
          {STATUS_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
        <Select
          value={perPage}
          onChange={(event) => {
            setPerPage(Number(event.target.value));
            setPage(1);
          }}
          inputProps={{ "aria-label": "Số dòng mỗi trang" }}
          sx={{ minWidth: 92, ...MASTER_TOOLBAR_SX }}
        >
          {perPageOptions.map((size) => (
            <MenuItem key={size} value={size}>
              {size} / trang
            </MenuItem>
          ))}
        </Select>
        <div className="spacer" />
        {canManage ? (
          <Button variant="contained" onClick={openCreate} startIcon={<PlusOutlined />}>
            Thêm lỗi
          </Button>
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
                      <Button
                        size="small"
                        onClick={() => openEdit(record)}
                        startIcon={
                          <EditOutlined style={{ color: ACTION_ICON_COLORS.edit }} />
                        }
                      >
                        Sửa
                      </Button>
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

      <Dialog open={modalOpen} onClose={close} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pr: 6, position: "relative" }}>
          {editing ? "Sửa lỗi / bệnh" : "Thêm lỗi / bệnh"}
          <IconButton
            aria-label="Đóng"
            onClick={close}
            disabled={isSaving}
            sx={{ position: "absolute", right: 10, top: 8 }}
          >
            <CloseOutlined style={{ fontSize: 15 }} />
          </IconButton>
        </DialogTitle>
        <form onSubmit={submit}>
          <DialogContent dividers>
            {formError ? (
              <Alert severity="error" sx={{ mb: "14px" }}>
                {formError}
              </Alert>
            ) : null}
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  id="defect-code"
                  label="Mã lỗi"
                  required
                  fullWidth
                  value={form.defect_code}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      defect_code: event.target.value,
                    }))
                  }
                  disabled={isSaving}
                  slotProps={{ htmlInput: { maxLength: 80 } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  id="defect-name"
                  label="Tên lỗi / bệnh"
                  required
                  fullWidth
                  value={form.defect_name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      defect_name: event.target.value,
                    }))
                  }
                  disabled={isSaving}
                  slotProps={{ htmlInput: { maxLength: 200 } }}
                />
              </Grid>
              <Grid size={12}>
                <TextField
                  id="defect-description"
                  label="Mô tả"
                  fullWidth
                  multiline
                  minRows={3}
                  value={form.description ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  disabled={isSaving}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth disabled={isSaving}>
                  <InputLabel id="defect-status-label">Trạng thái</InputLabel>
                  <Select
                    id="defect-status"
                    labelId="defect-status-label"
                    label="Trạng thái"
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
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={close}
              disabled={isSaving}
              startIcon={
                <CloseOutlined style={{ color: ACTION_ICON_COLORS.neutral }} />
              }
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={isSaving}
              startIcon={<SaveOutlined />}
            >
              {isSaving ? "Đang lưu..." : "Lưu danh mục lỗi"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
      </div>
    </ThemeProvider>
  );
}
