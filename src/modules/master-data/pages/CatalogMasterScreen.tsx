import { useMemo, useState, type ReactElement } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Autocomplete,
  Box,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { toast } from "sonner";
import {
  AppstoreOutlined,
  FileTextOutlined,
  InboxOutlined,
  ShopOutlined,
  ThunderboltOutlined,
} from "@/shared/components/icons";
import { DataTable } from "@/shared/components";
import type { ColumnWithSortType } from "@/shared/components";
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

/** Toolbar filter nhỏ gọn hơn field trong form — đồng bộ chuẩn mui-theme.ts. */
const CATALOG_TOOLBAR_SX = {
  "&, & .MuiOutlinedInput-root": { height: 35 },
  "& .MuiSelect-select, & .MuiInputBase-input": {
    paddingTop: "8px !important",
    paddingBottom: "8px !important",
    fontSize: "13.5px !important",
    boxSizing: "border-box",
  },
};

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
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

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

  const columns: ColumnWithSortType<CatalogMasterRecord> = [
    {
      title: activeTab.codeLabel,
      dataIndex: "code",
      width: 200,
      sorter: (a, b) => a.code.localeCompare(b.code, "vi"),
      render: (value: string) => (
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {value}
        </Typography>
      ),
    },
    {
      title: activeTab.nameLabel,
      dataIndex: "name",
      sorter: (a, b) => a.name.localeCompare(b.name, "vi"),
    },
    ...(supportsBrand
      ? [
          {
            title: "Hãng",
            dataIndex: "brand_id",
            width: 180,
            sorter: (a, b) =>
              (
                brandNameById.get(a.brand_id ?? "") ??
                a.brand_id ??
                ""
              ).localeCompare(
                brandNameById.get(b.brand_id ?? "") ?? b.brand_id ?? "",
                "vi",
              ),
            render: (value: string | null) =>
              value ? (
                (brandNameById.get(value) ?? value)
              ) : (
                <Typography variant="body2" color="text.secondary">
                  —
                </Typography>
              ),
          } as ColumnWithSortType<CatalogMasterRecord>[number],
        ]
      : []),
    {
      title: "Mô tả",
      dataIndex: "description",
      width: 280,
      sorter: (a, b) =>
        (a.description ?? "").localeCompare(b.description ?? "", "vi"),
      render: (value: string | null) =>
        value ? (
          <Typography
            variant="body2"
            sx={{
              maxWidth: 280,
              whiteSpace: "normal",
              wordBreak: "break-word",
            }}
          >
            {value}
          </Typography>
        ) : (
          <Typography variant="body2" color="text.secondary">
            —
          </Typography>
        ),
    },
    {
      title: "Thứ tự",
      dataIndex: "sort_order",
      width: 90,
      align: "right",
      sortType: "value",
      sorter: (a, b) => a.sort_order - b.sort_order,
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      width: 140,
      sortType: "value",
      sorter: (a, b) => a.status.localeCompare(b.status, "vi"),
      render: (value: MasterStatus) => (
        <Chip
          label={businessLabel(MASTER_STATUS_LABELS, value, "Trạng thái khác")}
          size="small"
          color={value === "ACTIVE" ? "success" : "warning"}
        />
      ),
    },
    {
      title: "",
      key: "actions",
      width: 96,
      render: (_, record) =>
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

  const selectedBrandOption =
    brandOptions.find((option) => option.value === formValues.brand_id) ?? null;

  return (
    <>
      <Stack spacing={2}>
        <Card variant="outlined" sx={{ borderRadius: 2 }}>
          <Box
            sx={{ borderBottom: "1px solid", borderColor: "divider", px: 2 }}
          >
            <Tabs
              value={activeKind}
              onChange={(_event, value) =>
                changeTab(value as CatalogMasterKind)
              }
              variant="scrollable"
              scrollButtons="auto"
            >
              {CATALOG_TABS.map((tab) => (
                <Tab
                  key={tab.kind}
                  value={tab.kind}
                  icon={tab.icon}
                  iconPosition="start"
                  label={tab.label}
                  sx={{ minHeight: 40, textTransform: "none" }}
                />
              ))}
            </Tabs>
          </Box>

          <Box sx={{ p: 2 }}>
            {listError ? (
              <Alert severity="error" sx={{ mb: 1.5 }}>
                {listError}
              </Alert>
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
                <TextField
                  value={keyword}
                  placeholder={`Tìm mã / tên ${activeTab.itemLabel}`}
                  slotProps={{
                    htmlInput: { "aria-label": `Tìm ${activeTab.itemLabel}` },
                  }}
                  onChange={(event) => {
                    setKeyword(event.target.value);
                    setPage(1);
                  }}
                  sx={{ minWidth: 220, ...CATALOG_TOOLBAR_SX }}
                />
                <TextField
                  select
                  value={statusFilter}
                  slotProps={{
                    select: { displayEmpty: true },
                    htmlInput: { "aria-label": "Lọc theo trạng thái" },
                  }}
                  onChange={(event) => {
                    setStatusFilter(event.target.value as MasterStatus | "");
                    setPage(1);
                  }}
                  sx={{ minWidth: 168, ...CATALOG_TOOLBAR_SX }}
                >
                  <MenuItem value="">Trạng thái: Tất cả</MenuItem>
                  {STATUS_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  value={perPage}
                  slotProps={{
                    htmlInput: { "aria-label": "Số dòng mỗi trang" },
                  }}
                  onChange={(event) => {
                    setPerPage(Number(event.target.value));
                    setPage(1);
                  }}
                  sx={{ minWidth: 100, ...CATALOG_TOOLBAR_SX }}
                >
                  {MVP_PAGE_SIZE_OPTIONS.map((size) => (
                    <MenuItem key={size} value={size}>
                      {size} / trang
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
              {canManage ? (
                <ActionButton kind="create" onClick={openCreate}>
                  Tạo {activeTab.itemLabel}
                </ActionButton>
              ) : null}
            </Stack>

            <DataTable<CatalogMasterRecord>
              rowKey="id"
              size="small"
              loading={listQuery.isLoading || listQuery.isFetching}
              dataSource={rows}
              columns={columns}
              locale={{ emptyText: `Chưa có ${activeTab.itemLabel} nào.` }}
              scroll={{ x: "max-content" }}
              rowSelection={{
                type: "checkbox",
                selectedRowKeys,
                onChange: setSelectedRowKeys,
              }}
              pagination={{
                current: pagination.current,
                pageSize: perPage,
                total: pagination.total,
                showSizeChanger: false,
                showTotal: (total) => `Tổng ${total} ${activeTab.itemLabel}`,
                onChange: setPage,
              }}
            />
          </Box>
        </Card>

        <Dialog
          open={isModalOpen}
          onClose={guardBackdropClose(closeModal)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ pr: 6, position: "relative" }}>
            {editingRecord ? "Sửa" : "Tạo"} {activeTab.itemLabel}
            <ActionIconButton
              kind="close"
              label="Đóng"
              onClick={closeModal}
              disabled={saveMutation.isPending}
              sx={{ position: "absolute", right: 10, top: 8 }}
            />
          </DialogTitle>
          <DialogContent dividers>
            {formError ? (
              <Alert severity="error" sx={{ mb: "14px" }}>
                {formError}
              </Alert>
            ) : null}
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
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
                <TextField
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
                  <Autocomplete
                    options={brandOptions}
                    getOptionLabel={(option) => option.label}
                    isOptionEqualToValue={(option, value) =>
                      option.value === value.value
                    }
                    value={selectedBrandOption}
                    onChange={(_event, newValue) => {
                      setFormValues((current) => ({
                        ...current,
                        brand_id: newValue?.value,
                      }));
                      setFieldErrors((current) =>
                        current.brand_id
                          ? { ...current, brand_id: "" }
                          : current,
                      );
                    }}
                    loading={brandQuery.isLoading}
                    disabled={saveMutation.isPending}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Hãng"
                        placeholder="Chọn hãng (không bắt buộc)"
                        error={Boolean(fieldErrors.brand_id)}
                        helperText={
                          fieldErrors.brand_id ||
                          "Chỉ hiển thị các hãng đang sử dụng."
                        }
                      />
                    )}
                  />
                </Grid>
              ) : null}
              <Grid size={12}>
                <TextField
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
                <TextField
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
                <TextField
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
                </TextField>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
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
          </DialogActions>
        </Dialog>
      </Stack>
    </>
  );
}
