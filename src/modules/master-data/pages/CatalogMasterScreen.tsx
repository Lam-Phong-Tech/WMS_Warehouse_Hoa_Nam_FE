import { useEffect, useMemo, useState, type ReactElement } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invalidateMasterDerived } from "@/shared/cache/invalidation";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { CatalogFeedback, CatalogNotice } from "../components/CatalogFeedback";
import "./catalog-master.css";
import {
  AppstoreOutlined,
  SearchOutlined,
  FilterOutlined,
  CloseOutlined,
  FileTextOutlined,
  InboxOutlined,
  ShopOutlined,
  ThunderboltOutlined,
} from "@/shared/components/icons";
import { TruncatedText } from "@/shared/components/data-display/TruncatedText";
import { mvpRowNumber } from "@/shared/components/mvp/MvpSelectionCell";
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
import { ActionButton, ActionIconButton, RowActionButton } from "@/shared/components/actions";
import {
  Box,
  Grid,
  MenuItem,
  UiAlert,
  UiAutocomplete,
  UiCard,
  UiDialog,
  UiPagination,
  UiSelect,
  UiTabs,
  UiTextField,
  UiNumberField,
} from "@/shared/ui";
import { NUMBER_RULES, checkNumber } from "@/shared/validation/number-rules";
import { codeFormatError } from "@/shared/validation/text-rules";
import { rowIndexOf } from "@/shared/components/data-display/row-index";

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
  // Giữ CHUỖI đang gõ để "1e5"/"-1" bị báo lỗi thay vì bị ép về 0 âm thầm.
  sort_order: string;
  status: MasterStatus;
}

const EMPTY_FORM: CatalogFormValues = {
  code: "",
  name: "",
  brand_id: undefined,
  description: "",
  sort_order: "0",
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
  const english = useLanguageStore((state) => state.language === "en");
  const text = (vi: string, en: string) => (english ? en : vi);
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

  const [offline, setOffline] = useState(() => !navigator.onLine);
  const [dismissedOffline, setDismissedOffline] = useState(false);
  const [successNotice, setSuccessNotice] = useState("");
  const [dismissedNotice, setDismissedNotice] = useState<unknown>(null);
  useEffect(() => {
    const update = () => {
      setOffline(!navigator.onLine);
      if (navigator.onLine) setDismissedOffline(false);
    };
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

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
    mutationFn: ({
      values,
      sortOrder,
    }: {
      values: CatalogFormValues;
      /** Đã parse bằng checkNumber ở handleSubmit — không parse lại. */
      sortOrder: number | null;
    }) => {
      const payload: CatalogMasterPayload = {
        code: values.code,
        name: values.name,
        description: values.description ?? null,
        sort_order: sortOrder ?? 0,
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
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["catalog-master"] }),
        invalidateMasterDerived(queryClient),
      ]),
    // Rỗng có chủ đích: màn này chủ ý chỉ hiện banner lỗi dưới form
    // (setFormError), không toast. Thiếu onError thì global MutationCache
    // (query-client.ts) vẫn tự bắn thêm 1 toast ngoài ý muốn, chồng lên banner.
    onError: () => {},
  });

  const changeTab = (kind: CatalogMasterKind) => {
    setActiveKind(kind);
    setSuccessNotice("");
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
      sort_order: record.sort_order != null ? String(record.sort_order) : "0",
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
    else {
      // Mã danh mục cũng đi vào mã SKU/nhãn in — cùng bộ ký tự với mọi mã khác.
      const codeError = codeFormatError(code, editingRecord?.code);
      if (codeError) errors.code = codeError;
    }
    if (!name)
      errors.name = t("masterData.catalog.errNameRequired", {
        label: activeTab.nameLabel,
      });
    else if (name.length > 200)
      errors.name = t("masterData.catalog.errNameLength");
    if ((values.description ?? "").length > 2000)
      errors.description = t("masterData.catalog.errDescriptionLength");
    // Thứ tự hiển thị: nguyên 0…9999 (BE chỉ có integer|min:0 — trần lấy từ
    // NUMBER_RULES để không nhận số vô nghĩa).
    const sortOrderCheck = checkNumber(
      values.sort_order,
      NUMBER_RULES.sortOrder,
    );
    if (!sortOrderCheck.ok) errors.sort_order = sortOrderCheck.message;
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
    const sortOrderCheck = checkNumber(
      values.sort_order,
      NUMBER_RULES.sortOrder,
    );
    try {
      await saveMutation.mutateAsync({
        values,
        sortOrder: sortOrderCheck.ok ? sortOrderCheck.value : null,
      });
      setSuccessNotice(
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
      key: "stt",
      header: "STT",
      align: "center",
      width: 56,
      hideOnMobile: true,
      // Số lấy theo VỊ TRÍ GỐC trong trang (trước khi bảng tự sắp xếp) nên nó
      // đi theo dòng khi bấm sắp xếp cột, không thành thang 1..n đứng yên.
      render: (record) => mvpRowNumber(page, perPage, rowIndexOf(rows, record)),
    },
    {
      key: "code",
      header: activeTab.codeLabel,
      width: 200,
      sortAccessor: (record) => record.code,
      render: (record) => (
        <span className="hn-catalog-code">
          <span aria-hidden="true">{activeTab.icon}</span>
          <strong>{record.code}</strong>
        </span>
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
      // Mô tả dài trước đây xuống dòng làm hàng cao gấp đôi các hàng khác. Cắt
      // gọn trên MỘT dòng, chữ đầy đủ nằm ở tooltip title.
      render: (record) =>
        record.description ? (
          <TruncatedText lines={1} maxWidth={280}>
            {record.description}
          </TruncatedText>
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
        <span
          className="hn-catalog-status"
          data-active={record.status === "ACTIVE"}
        >
          <span aria-hidden="true" />
          {businessLabel(
            MASTER_STATUS_LABELS,
            record.status,
            t("masterData.status.other"),
          )}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      width: 96,
      // Cột nút: không bọc lớp cắt chữ, tránh xén mất nút.
      truncate: 0,
      render: (record) =>
        canManage ? (
          <RowActionButton
            kind="edit"
            aria-label={t("masterData.catalog.editAria", { code: record.code })}
            onClick={() => openEdit(record)}
          >
            {t("masterData.common.edit")}
          </RowActionButton>
        ) : null,
    },
  ];

  const hasFilters = Boolean(keyword.trim() || statusFilter);
  const resetFilters = () => {
    setKeyword("");
    setStatusFilter("");
    setPage(1);
  };
  const feedback = {
    error: listQuery.error,
    loading: listQuery.isLoading && !offline,
    refreshing: listQuery.isFetching && !listQuery.isLoading,
    hasRows: rows.length > 0,
    hasFilters,
    offline,
    onRetry: () => {
      void listQuery.refetch();
    },
    onReset: resetFilters,
    updatedAt: listQuery.dataUpdatedAt,
  };
  const blockingError = !rows.length && (Boolean(listQuery.error) || offline);
  const displayedFrom = rows.length
    ? (pagination.current - 1) * perPage + 1
    : 0;
  const displayedTo = rows.length ? displayedFrom + rows.length - 1 : 0;

  return (
    <div className="hn-catalog-screen" data-screen="MST-CAT-01">
      <header className="hn-catalog-header">
        <div>
          <h1>{text("Danh mục sản phẩm", "Product catalog")}</h1>
          <p>
            {text(
              "Hãng, nhóm hàng, mẫu sản phẩm, nguồn điện và quy cách đóng gói dùng khi tạo SKU.",
              "Brands, categories, models, power sources and packaging used to create SKUs.",
            )}
          </p>
        </div>
        <div className="hn-catalog-header-actions">
          {canManage ? (
            <ActionButton
              className="hn-catalog-primary"
              kind="create"
              onClick={openCreate}
            >
              {t("masterData.catalog.create", { item: activeTab.itemLabel })}
            </ActionButton>
          ) : (
            <span className="hn-catalog-readonly">
              {text("Chỉ xem", "Read only")}
            </span>
          )}
        </div>
      </header>

      <div className="hn-catalog-tabs">
        <UiTabs
          value={activeKind}
          onChange={(key) => changeTab(key as CatalogMasterKind)}
          aria-label={t("masterData.catalog.typeAria")}
          items={tabs.map((tab) => ({
            key: tab.kind,
            label: (
              <Box
                component="span"
                sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}
              >
                {tab.icon}
                {tab.label}
              </Box>
            ),
          }))}
        />
      </div>

      {(!blockingError || hasFilters) && (
        <section
          className="hn-catalog-filters"
          aria-label={text("Tìm kiếm và lọc", "Search and filters")}
        >
          <h2 className="hn-catalog-filter-title">
            <FilterOutlined />
            {text("Tìm kiếm và lọc", "Search and filters")}
          </h2>
          <div className="hn-catalog-filter-grid">
            <div className="hn-catalog-search">
              <label htmlFor="catalog-search">
                {text("Tìm kiếm", "Search")}
              </label>
              <UiTextField
                id="catalog-search"
                value={keyword}
                fullWidth
                placeholder={t("masterData.catalog.searchPlaceholder", {
                  item: activeTab.itemLabel,
                })}
                slotProps={{
                  htmlInput: {
                    "aria-label": t("masterData.catalog.searchAria", {
                      item: activeTab.itemLabel,
                    }),
                  },
                  input: {
                    startAdornment: (
                      <span className="hn-catalog-input-icon">
                        <SearchOutlined />
                      </span>
                    ),
                    endAdornment: keyword ? (
                      <span className="hn-catalog-input-clear">
                        <ActionIconButton
                          className="hn-catalog-clear"
                          kind="clear"
                          label={text("Xóa tìm kiếm", "Clear search")}
                          onClick={() => {
                            setKeyword("");
                            setPage(1);
                          }}
                        />
                      </span>
                    ) : undefined,
                  },
                }}
                onChange={(event) => {
                  setKeyword(event.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="hn-catalog-field">
              <span>{t("masterData.status.label")}</span>
              <UiSelect
                aria-label={t("masterData.status.filterAria")}
                value={statusFilter}
                fullWidth
                menuClassName="hn-catalog-menu"
                onChange={(value) => {
                  setStatusFilter(value as MasterStatus | "");
                  setPage(1);
                }}
                displayEmpty
                options={[
                  { value: "", label: text("Tất cả", "All") },
                  ...statusOptions(t),
                ]}
              />
            </div>
            <div className="hn-catalog-filter-actions">
              <ActionButton
                className="hn-catalog-primary"
                kind="refresh"
                loading={listQuery.isFetching}
                onClick={() => void listQuery.refetch()}
              >
                {text("Cập nhật", "Refresh")}
              </ActionButton>
              <ActionButton kind="reset" onClick={resetFilters}>
                {text("Đặt lại", "Reset")}
              </ActionButton>
            </div>
          </div>
        </section>
      )}

      {hasFilters && (
        <div
          className="hn-catalog-filter-chips"
          aria-label={text("Bộ lọc đang áp dụng", "Active filters")}
        >
          {keyword.trim() && (
            <button
              type="button"
              onClick={() => {
                setKeyword("");
                setPage(1);
              }}
              aria-label={text("Xóa bộ lọc tìm kiếm", "Remove search filter")}
            >
              {keyword.trim()}
              <CloseOutlined />
            </button>
          )}
          {statusFilter && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter("");
                setPage(1);
              }}
              aria-label={text("Xóa bộ lọc trạng thái", "Remove status filter")}
            >
              {businessLabel(MASTER_STATUS_LABELS, statusFilter)}
              <CloseOutlined />
            </button>
          )}
        </div>
      )}
      {successNotice && (
        <div className="hn-catalog-success" role="status">
          <span>{successNotice}</span>
          <ActionIconButton
            kind="close"
            label={text("Đóng thông báo", "Dismiss notification")}
            onClick={() => setSuccessNotice("")}
          />
        </div>
      )}
      {(dismissedNotice !== listQuery.error ||
        feedback.refreshing ||
        (offline && !dismissedOffline)) && (
        <CatalogNotice
          {...feedback}
          onDismiss={() => {
            setDismissedNotice(listQuery.error);
            setDismissedOffline(offline);
          }}
        />
      )}
      {blockingError ? (
        <CatalogFeedback {...feedback} />
      ) : (
        <UiCard disablePadding className="hn-catalog-table-card">
          <div className="hn-catalog-table-heading">
            <h2>
              {activeTab.label}
              <span className="hn-catalog-count">
                {listQuery.isLoading
                  ? "—"
                  : pagination.total.toLocaleString(
                      english ? "en-US" : "vi-VN",
                    )}
              </span>
            </h2>
            <span className="hn-catalog-updated">
              {listQuery.dataUpdatedAt > 0
                ? text("Cập nhật: ", "Updated: ") +
                  new Date(listQuery.dataUpdatedAt).toLocaleTimeString(
                    english ? "en-US" : "vi-VN",
                    { hour: "2-digit", minute: "2-digit" },
                  )
                : ""}
            </span>
          </div>
          <div className="hn-catalog-table-wrap">
            {listQuery.isLoading && !offline ? (
              <div
                className="hn-catalog-skeleton"
                role="status"
                aria-label={text(
                  "Đang tải danh mục sản phẩm",
                  "Loading product catalog",
                )}
              >
                {Array.from({ length: 7 }, (_, index) => (
                  <div key={index}>
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                ))}
              </div>
            ) : rows.length ? (
              <ResponsiveDataTable<CatalogMasterRecord>
                columns={columns}
                rows={rows}
                rowKey={(record) => record.id}
                loading={false}
                emptyText={t("masterData.catalog.empty", {
                  item: activeTab.itemLabel,
                })}
              />
            ) : (
              <CatalogFeedback {...feedback} />
            )}
          </div>
          <div className="hn-catalog-pagination">
            <span>
              {text("Hiển thị", "Showing")} {displayedFrom}–{displayedTo} /{" "}
              {t("masterData.catalog.total", {
                count: pagination.total,
                item: activeTab.itemLabel,
              })}
            </span>
            <UiSelect
              aria-label={t("masterData.common.pageSizeAria")}
              value={perPage}
              menuClassName="hn-catalog-menu"
              onChange={(value) => {
                setPerPage(Number(value));
                setPage(1);
              }}
              options={MVP_PAGE_SIZE_OPTIONS.map((size) => ({
                value: size,
                label: size + text(" / trang", " / page"),
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
        </UiCard>
      )}

      <UiDialog
        className="hn-catalog-dialog"
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
              className="hn-catalog-primary"
              loading={saveMutation.isPending}
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
              <UiAutocomplete
                data-testid="catalog-brand"
                label={t("masterData.catalog.brand")}
                value={formValues.brand_id ?? null}
                onChange={(next) => {
                  const value = next == null ? "" : String(next);
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
                placeholder={t("masterData.catalog.brandOptional")}
                options={brandOptions.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
              />
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
            <UiNumberField
              id="catalog-sort-order"
              label={t("masterData.catalog.displayOrder")}
              fullWidth
              value={formValues.sort_order}
              rule={NUMBER_RULES.sortOrder}
              onChange={(next) => {
                setFormValues((current) => ({
                  ...current,
                  sort_order: next,
                }));
                setFieldErrors((current) =>
                  current.sort_order ? { ...current, sort_order: "" } : current,
                );
              }}
              disabled={saveMutation.isPending}
              error={Boolean(fieldErrors.sort_order)}
              helperText={fieldErrors.sort_order}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <UiTextField
              id="catalog-status"
              slotProps={{
                select: {
                  MenuProps: {
                    slotProps: { paper: { className: "hn-catalog-menu" } },
                  },
                },
              }}
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
    </div>
  );
}
