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
import { useT, type TranslateFn } from "@/shared/i18n/useT";
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
  UiTabPanel,
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

const catalogTabs = (t: TranslateFn): CatalogTabMeta[] => [
  {
    kind: "BRAND",
    label: t("masterData.catalog.brand"),
    icon: <ShopOutlined style={{ fontSize: 15 }} />,
    itemLabel: t("masterData.catalog.brandItem"),
    codeLabel: t("masterData.catalog.brandCode"),
    nameLabel: t("masterData.catalog.brandName"),
    codePlaceholder: "DONGCHENG",
    namePlaceholder: "Dongcheng",
  },
  {
    kind: "CATEGORY",
    label: t("masterData.catalog.category"),
    icon: <AppstoreOutlined style={{ fontSize: 15 }} />,
    itemLabel: t("masterData.catalog.categoryItem"),
    codeLabel: t("masterData.catalog.categoryCode"),
    nameLabel: t("masterData.catalog.categoryName"),
    codePlaceholder: "DRILL",
    namePlaceholder: t("masterData.catalog.categoryPlaceholder"),
  },
  {
    kind: "MODEL",
    label: t("masterData.catalog.model"),
    icon: <FileTextOutlined style={{ fontSize: 15 }} />,
    itemLabel: t("masterData.catalog.modelItem"),
    codeLabel: t("masterData.catalog.modelCode"),
    nameLabel: t("masterData.catalog.modelName"),
    codePlaceholder: "DJZ10A",
    namePlaceholder: t("masterData.catalog.modelPlaceholder"),
  },
  {
    kind: "POWER_SOURCE",
    label: t("masterData.catalog.powerSource"),
    icon: <ThunderboltOutlined style={{ fontSize: 15 }} />,
    itemLabel: t("masterData.catalog.powerSourceItem"),
    codeLabel: t("masterData.catalog.powerSourceCode"),
    nameLabel: t("masterData.catalog.powerSourceName"),
    codePlaceholder: "MAINS_DIRECT",
    namePlaceholder: t("masterData.catalog.powerSourcePlaceholder"),
  },
  {
    kind: "PACKAGE",
    label: t("masterData.catalog.packaging"),
    icon: <InboxOutlined style={{ fontSize: 15 }} />,
    itemLabel: t("masterData.catalog.packagingItem"),
    codeLabel: t("masterData.catalog.packagingCode"),
    nameLabel: t("masterData.catalog.packagingName"),
    codePlaceholder: "BOX-STD",
    namePlaceholder: t("masterData.catalog.packagingPlaceholder"),
  },
];

const statusOptions = (
  t: TranslateFn,
): Array<{ value: MasterStatus; label: string }> => [
  { value: "ACTIVE", label: t("masterData.status.inUse") },
  { value: "INACTIVE", label: t("masterData.status.notInUse") },
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

function saveErrorMessage(error: unknown, t: TranslateFn): string {
  const normalized = normalizeError(error);
  if (normalized.code === "MASTER_CODE_IMMUTABLE_AFTER_USE") {
    return t("masterData.catalog.errCodeInUse");
  }
  if (normalized.code === "STALE_VERSION") {
    return t("masterData.catalog.errStale");
  }
  if (normalized.code === "BRAND_NOT_ACTIVE") {
    return t("masterData.catalog.errBrandInactive");
  }
  return getApiErrorMessage(error, t("masterData.catalog.errSave"));
}

export function CatalogMasterScreen() {
  const t = useT();
  const tabs = useMemo(() => catalogTabs(t), [t]);
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

  const activeTab = tabs.find((tab) => tab.kind === activeKind) ?? tabs[0];
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
    // Rỗng có chủ đích: màn này chủ ý chỉ hiện banner lỗi dưới form
    // (setFormError), không toast. Thiếu onError thì global MutationCache
    // (query-client.ts) vẫn tự bắn thêm 1 toast ngoài ý muốn, chồng lên banner.
    onError: () => {},
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
    if (!code)
      errors.code = t("masterData.catalog.errCodeRequired", {
        label: activeTab.codeLabel,
      });
    else if (code.length > 80)
      errors.code = t("masterData.catalog.errCodeLength");
    if (!name)
      errors.name = t("masterData.catalog.errNameRequired", {
        label: activeTab.nameLabel,
      });
    else if (name.length > 200)
      errors.name = t("masterData.catalog.errNameLength");
    if ((values.description ?? "").length > 2000)
      errors.description = t("masterData.catalog.errDescriptionLength");
    if (!values.status) errors.status = t("masterData.status.chooseStatus");
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
          ? t("masterData.catalog.updated", { item: activeTab.itemLabel })
          : t("masterData.catalog.created", { item: activeTab.itemLabel }),
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
        setFormError(saveErrorMessage(error, t));
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
            header: t("masterData.catalog.brand"),
            width: 180,
            sortAccessor: (record) =>
              brandNameById.get(record.brand_id ?? "") ?? "",
            // KHÔNG rơi xuống brand_id (UUID) khi chưa tra ra tên hãng.
            render: (record) => {
              const brandName = record.brand_id
                ? brandNameById.get(record.brand_id)
                : undefined;
              return brandName ? (
                brandName
              ) : (
                <Box component="span" sx={{ color: "text.secondary" }}>
                  —
                </Box>
              );
            },
          } satisfies ResponsiveTableColumn<CatalogMasterRecord>,
        ]
      : []),
    {
      key: "description",
      header: t("masterData.common.description"),
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
      key: "status",
      header: t("masterData.status.label"),
      width: 140,
      sortType: "value",
      sortAccessor: (record) => record.status,
      render: (record) => (
        <UiStatusBadge
          tone={record.status === "ACTIVE" ? "success" : "warning"}
          label={businessLabel(
            MASTER_STATUS_LABELS,
            record.status,
            t("masterData.status.other"),
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
            aria-label={t("masterData.catalog.editAria", { code: record.code })}
            onClick={() => openEdit(record)}
          >
            {t("masterData.common.edit")}
          </ActionButton>
        ) : null,
    },
  ];

  const listError = listQuery.error
    ? getApiErrorMessage(listQuery.error, t("masterData.catalog.errLoad"))
    : "";

  return (
    <>
      <Stack spacing={2}>
        <UiCard disablePadding>
          <Box sx={{ borderBottom: 1, borderColor: "divider", px: 2 }}>
            <UiTabs
              value={activeKind}
              onChange={(key) => changeTab(key as CatalogMasterKind)}
              aria-label={t("masterData.catalog.typeAria")}
              items={tabs.map((tab) => ({
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

          <UiTabPanel value={activeKind} sx={{ p: 2 }}>
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
                  placeholder={t("masterData.catalog.searchPlaceholder", {
                    item: activeTab.itemLabel,
                  })}
                  slotProps={{
                    htmlInput: {
                      "aria-label": t("masterData.catalog.searchAria", {
                        item: activeTab.itemLabel,
                      }),
                    },
                  }}
                  onChange={(event) => {
                    setKeyword(event.target.value);
                    setPage(1);
                  }}
                  sx={{ minWidth: 220 }}
                />
                <UiSelect
                  aria-label={t("masterData.status.filterAria")}
                  value={statusFilter}
                  onChange={(value) => {
                    setStatusFilter(value as MasterStatus | "");
                    setPage(1);
                  }}
                  placeholder={t("masterData.status.allPlaceholder")}
                  minWidth={168}
                  options={statusOptions(t)}
                />
                <UiSelect
                  aria-label={t("masterData.common.pageSizeAria")}
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
                  {t("masterData.catalog.create", {
                    item: activeTab.itemLabel,
                  })}
                </ActionButton>
              ) : null}
            </Stack>

            <ResponsiveDataTable<CatalogMasterRecord>
              columns={columns}
              rows={rows}
              rowKey={(record) => record.id}
              loading={listQuery.isLoading}
              emptyText={t("masterData.catalog.empty", {
                item: activeTab.itemLabel,
              })}
              rowSelection={rowSelection}
              selectionLabel={(record) =>
                t("masterData.catalog.selectionLabel", { code: record.code })
              }
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
                {t("masterData.catalog.total", {
                  count: pagination.total,
                  item: activeTab.itemLabel,
                })}
              </UiText>
              <UiPagination
                page={pagination.current}
                pageSize={perPage}
                total={pagination.total}
                showTotal={false}
                onPageChange={setPage}
              />
            </Stack>
          </UiTabPanel>
        </UiCard>

        <UiDialog
          open={isModalOpen}
          onClose={guardBackdropClose(closeModal)}
          maxWidth="sm"
          fullWidth
          title={
            <>
              {editingRecord
                ? t("masterData.catalog.dialogEdit", {
                    item: activeTab.itemLabel,
                  })
                : t("masterData.catalog.dialogCreate", {
                    item: activeTab.itemLabel,
                  })}
              <ActionIconButton
                kind="close"
                label={t("common.close")}
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
                {t("masterData.common.cancel")}
              </ActionButton>
              <ActionButton
                kind="save"
                onClick={() => void handleSubmit()}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending
                  ? t("masterData.common.saving")
                  : t("masterData.common.save")}
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
                    ? t("masterData.catalog.codeLockedHint")
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
                  label={t("masterData.catalog.brand")}
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
                    fieldErrors.brand_id || t("masterData.catalog.brandHelper")
                  }
                  slotProps={{
                    select: { displayEmpty: true },
                    inputLabel: { shrink: true },
                  }}
                >
                  <MenuItem value="">
                    {t("masterData.catalog.brandOptional")}
                  </MenuItem>
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
                label={t("masterData.common.description")}
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
                id="catalog-status"
                select
                label={t("masterData.status.label")}
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
                {statusOptions(t).map((option) => (
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
