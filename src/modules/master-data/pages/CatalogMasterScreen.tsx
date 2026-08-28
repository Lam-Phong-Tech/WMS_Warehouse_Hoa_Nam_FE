import { useMemo, useState, type ReactElement } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AppstoreOutlined,
  FileTextOutlined,
  InboxOutlined,
  ShopOutlined,
  ThunderboltOutlined,
} from "@/shared/components/icons";
import { ResponsiveDataTable } from "@/shared/components";
import type { ResponsiveTableColumn } from "@/shared/components";
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
import {
  getApiErrorMessage,
  normalizeError,
  resolveFormErrors,
} from "@/shared/api/api-error";
import {
  MVP_PAGE_SIZE_OPTIONS,
  resolveApiPagination,
} from "@/shared/components/mvp/mvp-pagination";
import { useCan } from "@/shared/components/permission";
import { WMS_PERMISSION_CATALOG as P } from "@/shared/constants/wms-permissions";
import { guardBackdropClose } from "@/shared/utils/dialogGuard";
import {
  MASTER_STATUS_LABELS,
  businessLabel,
} from "@/shared/constants/business-labels";
import { ActionButton, ActionIconButton } from "@/shared/components/actions";
import { useRowSelection } from "@/shared/hooks/useRowSelection";
import {
  Box,
  Grid,
  MenuItem,
  Stack,
  UiAlert,
  UiCard,
  UiDialog,
  UiPagination,
  UiSelect,
  UiStatusBadge,
  UiTabs,
  UiText,
  UiTextField,
} from "@/shared/ui";

interface CatalogTabMeta {
  kind: CatalogMasterKind;
  label: string;
  icon: ReactElement;
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
    icon: <ShopOutlined style={{ fontSize: 15 }} />,
    itemLabel: "hãng",
    codeLabel: "Mã hãng",
    nameLabel: "Tên hãng",
    codePlaceholder: "DONGCHENG",
    namePlaceholder: "Dongcheng",
  },
  {
    kind: "CATEGORY",
    label: "Nhóm hàng",
    icon: <AppstoreOutlined style={{ fontSize: 15 }} />,
    itemLabel: "nhóm hàng",
    codeLabel: "Mã nhóm hàng",
    nameLabel: "Tên nhóm hàng",
    codePlaceholder: "DRILL",
    namePlaceholder: "Máy khoan",
  },
  {
    kind: "MODEL",
    label: "Mẫu sản phẩm",
    icon: <FileTextOutlined style={{ fontSize: 15 }} />,
    itemLabel: "mẫu sản phẩm",
    codeLabel: "Mã mẫu sản phẩm",
    nameLabel: "Tên mẫu sản phẩm",
    codePlaceholder: "DJZ10A",
    namePlaceholder: "Máy khoan DJZ10A",
  },
  {
    kind: "POWER_SOURCE",
    label: "Nguồn điện",
    icon: <ThunderboltOutlined style={{ fontSize: 15 }} />,
    itemLabel: "nguồn điện",
    codeLabel: "Mã nguồn điện",
    nameLabel: "Tên nguồn điện",
    codePlaceholder: "MAINS_DIRECT",
    namePlaceholder: "Điện lưới trực tiếp",
  },
  {
    kind: "PACKAGE",
    label: "Quy cách đóng gói",
    icon: <InboxOutlined style={{ fontSize: 15 }} />,
    itemLabel: "quy cách đóng gói",
    codeLabel: "Mã quy cách",
    nameLabel: "Tên quy cách",
    codePlaceholder: "BOX-STD",
    namePlaceholder: "Hộp tiêu chuẩn",
  },
];

const STATUS_OPTIONS: Array<{ value: MasterStatus; label: string }> = [
  { value: "ACTIVE", label: "Đang sử dụng" },
  { value: "INACTIVE", label: "Ngừng sử dụng" },
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
 * Các ô nhập có chỗ hiển thị lỗi riêng (`error` + `helperText`) trong modal.
 * Lỗi server thuộc field ngoài danh sách này rơi về banner tổng — xem
 * `resolveFormErrors`. Khoá bên trái là tên camelCase mà `extractFieldErrors`
 * trả về, giá trị bên phải là tên field mà `fieldErrors` của form này đang
 * dùng; thiếu bước map lại thì lỗi sẽ không khớp ô nào và biến mất.
 */
const CATALOG_FORM_FIELDS = {
  code: "code",
  name: "name",
  brandId: "brand_id",
  description: "description",
  sortOrder: "sort_order",
  status: "status",
} as const satisfies Record<string, keyof CatalogFormValues>;

function saveErrorMessage(error: unknown): string {
  const normalized = normalizeError(error);
  if (normalized.code === "MASTER_CODE_IMMUTABLE_AFTER_USE") {
    return "Mã danh mục đã được SKU sử dụng nên không thể đổi. Hãy giữ nguyên mã và chỉ sửa tên/mô tả, hoặc tạo danh mục mới rồi ngừng sử dụng danh mục cũ.";
  }
  if (normalized.code === "STALE_VERSION") {
    return "Bản ghi đã được người khác cập nhật. Hãy tải lại dữ liệu mới nhất rồi sửa lại.";
  }
  if (normalized.code === "BRAND_NOT_ACTIVE") {
    return "Mẫu sản phẩm chỉ được gắn với hãng đang sử dụng. Hãy chọn hãng khác hoặc kích hoạt lại hãng trước.";
  }
  return getApiErrorMessage(error, "Không lưu được danh mục.");
}

export function CatalogMasterScreen() {
  const queryClient = useQueryClient();
  const canManage = useCan(P.CATALOG_MANAGE);

  const [activeKind, setActiveKind] = useState<CatalogMasterKind>("BRAND");
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<MasterStatus | "">("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] =
    useState<CatalogMasterRecord | null>(null);
  const [formValues, setFormValues] = useState<CatalogFormValues>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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
  const rowSelection = useRowSelection(rows, (record) => record.id);

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

  const changeTab = (kind: CatalogMasterKind) => {
    setActiveKind(kind);
    setKeyword("");
    setStatusFilter("");
    setPage(1);
  };

  const openCreate = () => {
    setEditingRecord(null);
    setFormError("");
    setFieldErrors({});
    setFormValues({ ...EMPTY_FORM });
    setIsModalOpen(true);
  };

  const openEdit = (record: CatalogMasterRecord) => {
    setEditingRecord(record);
    setFormError("");
    setFieldErrors({});
    setFormValues({
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
    setFieldErrors({});
  };

  const validateForm = (values: CatalogFormValues): Record<string, string> => {
    const errors: Record<string, string> = {};
    const code = values.code.trim();
    const name = values.name.trim();
    if (!code) errors.code = `Nhập ${activeTab.codeLabel}.`;
    else if (code.length > 80) errors.code = "Mã tối đa 80 ký tự.";
    if (!name) errors.name = `Nhập ${activeTab.nameLabel}.`;
    else if (name.length > 200) errors.name = "Tên tối đa 200 ký tự.";
    if ((values.description ?? "").length > 2000)
      errors.description = "Mô tả tối đa 2000 ký tự.";
    if (!values.status) errors.status = "Chọn trạng thái.";
    return errors;
  };

  const handleSubmit = async () => {
    setFormError("");
    const values: CatalogFormValues = {
      ...formValues,
      code: formValues.code.trim(),
      name: formValues.name.trim(),
    };
    const errors = validateForm(values);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    try {
      await saveMutation.mutateAsync(values);
      toast.success(
        editingRecord
          ? `Đã cập nhật ${activeTab.itemLabel}.`
          : `Đã thêm ${activeTab.itemLabel}.`,
      );
      setIsModalOpen(false);
      setEditingRecord(null);
    } catch (error) {
      // Lỗi nào gắn được vào ô nhập thì hiện ngay dưới ô đó (vd mã danh mục
      // trùng), banner chỉ giữ phần không thuộc ô nào — trước đây mọi lỗi đều
      // bị dồn vào banner nên người dùng chỉ thấy câu tổng chung chung.
      const { fieldErrors: serverFieldErrors, message } = resolveFormErrors(
        error,
        Object.keys(CATALOG_FORM_FIELDS),
      );
      if (Object.keys(serverFieldErrors).length === 0) {
        // Không có lỗi nào theo trường: giữ nguyên các thông điệp nghiệp vụ
        // riêng của màn này (mã bất biến, STALE_VERSION, hãng ngừng dùng...).
        setFormError(saveErrorMessage(error));
        return;
      }
      setFieldErrors((current) => ({
        ...current,
        ...Object.fromEntries(
          Object.entries(serverFieldErrors).map(([field, msg]) => [
            CATALOG_FORM_FIELDS[field as keyof typeof CATALOG_FORM_FIELDS],
            msg,
          ]),
        ),
      }));
      setFormError(message ?? "");
    }
  };

  const columns: ResponsiveTableColumn<CatalogMasterRecord>[] = [
    {
      key: "code",
      header: activeTab.codeLabel,
      width: 200,
      sortAccessor: (record) => record.code,
      render: (record) => (
        <Box component="span" sx={{ fontWeight: 700 }}>
          {record.code}
        </Box>
      ),
    },
    {
      key: "name",
      header: activeTab.nameLabel,
      sortAccessor: (record) => record.name,
      render: (record) => record.name,
    },
    ...(supportsBrand
      ? [
          {
            key: "brand",
            header: "Hãng",
            width: 180,
            sortAccessor: (record) =>
              brandNameById.get(record.brand_id ?? "") ?? record.brand_id ?? "",
            render: (record) =>
              record.brand_id ? (
                (brandNameById.get(record.brand_id) ?? record.brand_id)
              ) : (
                <Box component="span" sx={{ color: "text.secondary" }}>
                  —
                </Box>
              ),
          } satisfies ResponsiveTableColumn<CatalogMasterRecord>,
        ]
      : []),
    {
      key: "description",
      header: "Mô tả",
      width: 280,
      sortAccessor: (record) => record.description ?? "",
      render: (record) =>
        record.description ? (
          <Box
            component="span"
            sx={{
              display: "inline-block",
              maxWidth: 280,
              whiteSpace: "normal",
              wordBreak: "break-word",
            }}
          >
            {record.description}
          </Box>
        ) : (
          <Box component="span" sx={{ color: "text.secondary" }}>
            —
          </Box>
        ),
    },
    {
      key: "sortOrder",
      header: "Thứ tự",
      width: 90,
      align: "right",
      sortType: "value",
      sortAccessor: (record) => record.sort_order,
      render: (record) => record.sort_order,
    },
    {
      key: "status",
      header: "Trạng thái",
      width: 140,
      sortType: "value",
      sortAccessor: (record) => record.status,
      render: (record) => (
        <UiStatusBadge
          tone={record.status === "ACTIVE" ? "success" : "warning"}
          label={businessLabel(
            MASTER_STATUS_LABELS,
            record.status,
            "Trạng thái khác",
          )}
        />
      ),
    },
    {
      key: "actions",
      header: "",
      width: 96,
      render: (record) =>
        canManage ? (
          <ActionButton
            kind="edit"
            aria-label={`Sửa ${record.code}`}
            onClick={() => openEdit(record)}
          >
            Sửa
          </ActionButton>
        ) : null,
    },
  ];

  const listError = listQuery.error
    ? getApiErrorMessage(listQuery.error, "Không tải được danh mục.")
    : "";

  return (
    <>
      <Stack spacing={2}>
        <UiCard disablePadding>
          <Box sx={{ borderBottom: 1, borderColor: "divider", px: 2 }}>
            <UiTabs
              value={activeKind}
              onChange={(key) => changeTab(key as CatalogMasterKind)}
              aria-label="Loại danh mục"
              items={CATALOG_TABS.map((tab) => ({
                key: tab.kind,
                label: (
                  <Box
                    component="span"
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 0.75,
                    }}
                  >
                    {tab.icon}
                    {tab.label}
                  </Box>
                ),
              }))}
            />
          </Box>

          <Box sx={{ p: 2 }}>
            {listError ? (
              <Box sx={{ mb: 1.5 }}>
                <UiAlert tone="error">{listError}</UiAlert>
              </Box>
            ) : null}

            <Stack
              direction="row"
              spacing={1.5}
              sx={{
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                mb: 1.5,
                rowGap: 1.5,
              }}
            >
              <Stack
                direction="row"
                spacing={1.5}
                sx={{ flexWrap: "wrap", rowGap: 1.5 }}
              >
                <UiTextField
                  value={keyword}
                  placeholder={`Tìm mã / tên ${activeTab.itemLabel}`}
                  slotProps={{
                    htmlInput: { "aria-label": `Tìm ${activeTab.itemLabel}` },
                  }}
                  onChange={(event) => {
                    setKeyword(event.target.value);
                    setPage(1);
                  }}
                  sx={{ minWidth: 220 }}
                />
                <UiSelect
                  aria-label="Lọc theo trạng thái"
                  value={statusFilter}
                  onChange={(value) => {
                    setStatusFilter(value as MasterStatus | "");
                    setPage(1);
                  }}
                  placeholder="Trạng thái: Tất cả"
                  minWidth={168}
                  options={STATUS_OPTIONS}
                />
                <UiSelect
                  aria-label="Số dòng mỗi trang"
                  value={perPage}
                  onChange={(value) => {
                    setPerPage(Number(value));
                    setPage(1);
                  }}
                  minWidth={100}
                  options={MVP_PAGE_SIZE_OPTIONS.map((size) => ({
                    value: size,
                    label: `${size} / trang`,
                  }))}
                />
              </Stack>
              {canManage ? (
                <ActionButton kind="create" onClick={openCreate}>
                  Tạo {activeTab.itemLabel}
                </ActionButton>
              ) : null}
            </Stack>

            <ResponsiveDataTable<CatalogMasterRecord>
              columns={columns}
              rows={rows}
              rowKey={(record) => record.id}
              loading={listQuery.isLoading}
              emptyText={`Chưa có ${activeTab.itemLabel} nào.`}
              rowSelection={rowSelection}
              selectionLabel={(record) => `Chọn ${record.code}`}
            />

            <Stack
              direction="row"
              sx={{
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 1,
                mt: 1.5,
              }}
            >
              <UiText variant="secondary">
                Tổng {pagination.total} {activeTab.itemLabel}
              </UiText>
              <UiPagination
                page={pagination.current}
                pageSize={perPage}
                total={pagination.total}
                showTotal={false}
                onPageChange={setPage}
              />
            </Stack>
          </Box>
        </UiCard>

        <UiDialog
          open={isModalOpen}
          onClose={guardBackdropClose(closeModal)}
          maxWidth="sm"
          fullWidth
          title={
            <>
              {editingRecord ? "Sửa" : "Tạo"} {activeTab.itemLabel}
              <ActionIconButton
                kind="close"
                label="Đóng"
                onClick={closeModal}
                disabled={saveMutation.isPending}
                sx={{ position: "absolute", right: 10, top: 8 }}
              />
            </>
          }
          actions={
            <>
              <ActionButton
                kind="cancel"
                onClick={closeModal}
                disabled={saveMutation.isPending}
              >
                Hủy
              </ActionButton>
              <ActionButton
                kind="save"
                onClick={() => void handleSubmit()}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? "Đang lưu..." : "Lưu"}
              </ActionButton>
            </>
          }
        >
          {formError ? (
            <Box sx={{ mb: "14px" }}>
              <UiAlert tone="error">{formError}</UiAlert>
            </Box>
          ) : null}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <UiTextField
                id="catalog-code"
                label={activeTab.codeLabel}
                required
                fullWidth
                placeholder={activeTab.codePlaceholder}
                value={formValues.code}
                onChange={(event) => {
                  const value = event.target.value;
                  setFormValues((current) => ({ ...current, code: value }));
                  setFieldErrors((current) =>
                    current.code ? { ...current, code: "" } : current,
                  );
                }}
                disabled={saveMutation.isPending}
                error={Boolean(fieldErrors.code)}
                helperText={
                  fieldErrors.code ||
                  (editingRecord
                    ? "Nếu mã đã được SKU sử dụng thì hệ thống sẽ không cho phép đổi."
                    : undefined)
                }
                slotProps={{ htmlInput: { maxLength: 80 } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <UiTextField
                id="catalog-name"
                label={activeTab.nameLabel}
                required
                fullWidth
                placeholder={activeTab.namePlaceholder}
                value={formValues.name}
                onChange={(event) => {
                  const value = event.target.value;
                  setFormValues((current) => ({ ...current, name: value }));
                  setFieldErrors((current) =>
                    current.name ? { ...current, name: "" } : current,
                  );
                }}
                disabled={saveMutation.isPending}
                error={Boolean(fieldErrors.name)}
                helperText={fieldErrors.name}
                slotProps={{ htmlInput: { maxLength: 200 } }}
              />
            </Grid>
            {supportsBrand ? (
              <Grid size={12}>
                <UiTextField
                  id="catalog-brand"
                  select
                  label="Hãng"
                  fullWidth
                  value={formValues.brand_id ?? ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    setFormValues((current) => ({
                      ...current,
                      brand_id: value || undefined,
                    }));
                    setFieldErrors((current) =>
                      current.brand_id ? { ...current, brand_id: "" } : current,
                    );
                  }}
                  disabled={saveMutation.isPending}
                  error={Boolean(fieldErrors.brand_id)}
                  helperText={
                    fieldErrors.brand_id ||
                    "Chỉ hiển thị các hãng đang sử dụng."
                  }
                  slotProps={{
                    select: { displayEmpty: true },
                    inputLabel: { shrink: true },
                  }}
                >
                  <MenuItem value="">Chọn hãng (không bắt buộc)</MenuItem>
                  {brandOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </UiTextField>
              </Grid>
            ) : null}
            <Grid size={12}>
              <UiTextField
                id="catalog-description"
                label="Mô tả"
                fullWidth
                multiline
                minRows={3}
                value={formValues.description ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  setFormValues((current) => ({
                    ...current,
                    description: value,
                  }));
                  setFieldErrors((current) =>
                    current.description
                      ? { ...current, description: "" }
                      : current,
                  );
                }}
                disabled={saveMutation.isPending}
                error={Boolean(fieldErrors.description)}
                helperText={fieldErrors.description}
                slotProps={{ htmlInput: { maxLength: 2000 } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <UiTextField
                id="catalog-sort-order"
                label="Thứ tự hiển thị"
                type="number"
                fullWidth
                value={formValues.sort_order ?? 0}
                onChange={(event) => {
                  const value = Number(event.target.value) || 0;
                  setFormValues((current) => ({
                    ...current,
                    sort_order: value,
                  }));
                  setFieldErrors((current) =>
                    current.sort_order
                      ? { ...current, sort_order: "" }
                      : current,
                  );
                }}
                disabled={saveMutation.isPending}
                error={Boolean(fieldErrors.sort_order)}
                helperText={fieldErrors.sort_order}
                slotProps={{ htmlInput: { min: 0 } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <UiTextField
                id="catalog-status"
                select
                label="Trạng thái"
                required
                fullWidth
                value={formValues.status}
                onChange={(event) => {
                  const value = event.target.value as MasterStatus;
                  setFormValues((current) => ({
                    ...current,
                    status: value,
                  }));
                  setFieldErrors((current) =>
                    current.status ? { ...current, status: "" } : current,
                  );
                }}
                disabled={saveMutation.isPending}
                error={Boolean(fieldErrors.status)}
                helperText={fieldErrors.status}
              >
                {STATUS_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </UiTextField>
            </Grid>
          </Grid>
        </UiDialog>
      </Stack>
    </>
  );
}
