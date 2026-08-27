import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormHelperText,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  TextField,
  ThemeProvider,
  Typography,
} from "@mui/material";
import { muiTheme } from "@/app/mui-theme";
import {
  fetchWarehouse,
  fetchWarehouses,
  updateWarehouse,
} from "@/modules/master-data/services/warehouse.service";
import type { MasterStatus } from "@/modules/master-data/types/mvp-master.types";
import {
  getApiErrorMessage,
  isForbiddenErrorCode,
  normalizeError,
  resolveFormErrors,
} from "@/shared/api/api-error";
import { useCan } from "@/shared/components/permission";
import { WMS_PERMISSION_CATALOG as P } from "@/shared/constants/wms-permissions";
import { formatDateTime } from "@/shared/utils/format-date";
import { ActionButton } from "@/shared/components/actions";

interface WarehouseRecord {
  id: string;
  code: string;
  name: string;
  address: string;
  contact_person: string;
  phone: string;
  status: MasterStatus;
}

interface WarehouseFormValues {
  name: string;
  address?: string;
  contact_person?: string;
  phone?: string;
  status: MasterStatus;
}

/**
 * Các ô nhập có chỗ hiển thị lỗi riêng (`error` + `helperText`) trên form.
 * Lỗi server thuộc field ngoài danh sách này rơi về banner tổng — xem
 * `resolveFormErrors`. Khoá bên trái là tên camelCase mà `extractFieldErrors`
 * trả về, giá trị bên phải là tên field mà `fieldErrors` của form này đang
 * dùng; thiếu bước map lại thì lỗi sẽ không khớp ô nào và biến mất.
 */
const WAREHOUSE_FORM_FIELDS = {
  name: "name",
  address: "address",
  contactPerson: "contact_person",
  phone: "phone",
  status: "status",
} as const satisfies Record<string, keyof WarehouseFormValues>;

const STATUS_OPTIONS: Array<{ value: MasterStatus; label: string }> = [
  { value: "ACTIVE", label: "Đang hoạt động" },
  { value: "INACTIVE", label: "Ngừng hoạt động" },
];

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function toWarehouse(row: Record<string, unknown>): WarehouseRecord {
  const status = text(row.status).toUpperCase();
  return {
    id: text(row.id ?? row.warehouse_id),
    code: text(row.code ?? row.warehouse_code),
    name: text(row.name ?? row.warehouse_name),
    address: text(row.address),
    contact_person: text(row.contact_person),
    phone: text(row.phone),
    status: status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
  };
}

function saveErrorMessage(error: unknown): string {
  const normalized = normalizeError(error);
  if (normalized.code === "STATE_CONFLICT") {
    return "Hệ thống chỉ cho phép đúng một kho ở trạng thái Đang hoạt động. Hãy chuyển kho đang hoạt động sang Ngừng hoạt động trước khi kích hoạt kho này.";
  }
  if (normalized.status === 403 || isForbiddenErrorCode(normalized.code)) {
    return "Kho này nằm ngoài phạm vi dữ liệu của tài khoản. Liên hệ quản trị viên để được cấp quyền phù hợp.";
  }
  return getApiErrorMessage(error, "Không lưu được cấu hình kho.");
}

function validateForm(values: WarehouseFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  const name = values.name.trim();
  if (!name) errors.name = "Nhập tên kho.";
  else if (name.length > 200) errors.name = "Tên kho tối đa 200 ký tự.";
  if (!values.status) errors.status = "Chọn trạng thái.";
  if ((values.address ?? "").length > 500) {
    errors.address = "Địa chỉ tối đa 500 ký tự.";
  }
  if ((values.contact_person ?? "").length > 200) {
    errors.contact_person = "Người liên hệ tối đa 200 ký tự.";
  }
  const phone = values.phone ?? "";
  if (phone.length > 30) {
    errors.phone = "Số điện thoại tối đa 30 ký tự.";
  } else if (phone && !/^0\d{9}$/.test(phone)) {
    errors.phone =
      "Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0.";
  }
  return errors;
}

export function WarehouseConfigScreen() {
  const queryClient = useQueryClient();
  const canManage = useCan(P.WAREHOUSE_MANAGE);

  const [selectedId, setSelectedId] = useState("");
  const [saveError, setSaveError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [savedAt, setSavedAt] = useState("");
  const [formValues, setFormValues] = useState<WarehouseFormValues>({
    name: "",
    address: "",
    contact_person: "",
    phone: "",
    status: "ACTIVE",
  });
  const [confirmOpen, setConfirmOpen] = useState(false);

  const listQuery = useQuery({
    queryKey: ["warehouse", "list"],
    queryFn: () => fetchWarehouses({ per_page: 50 }),
  });

  const warehouses = useMemo(
    () => (listQuery.data ?? []).map(toWarehouse).filter((row) => row.id),
    [listQuery.data],
  );

  const resolvedId =
    warehouses.find((row) => row.id === selectedId)?.id ??
    warehouses.find((row) => row.status === "ACTIVE")?.id ??
    warehouses[0]?.id ??
    "";

  const detailQuery = useQuery({
    queryKey: ["warehouse", "detail", resolvedId],
    queryFn: () => fetchWarehouse(resolvedId),
    enabled: Boolean(resolvedId),
  });

  const warehouse = useMemo(
    () => (detailQuery.data ? toWarehouse(detailQuery.data) : null),
    [detailQuery.data],
  );

  useEffect(() => {
    if (!warehouse) return;
    setFormValues({
      name: warehouse.name,
      address: warehouse.address,
      contact_person: warehouse.contact_person,
      phone: warehouse.phone,
      status: warehouse.status,
    });
  }, [warehouse]);

  const saveMutation = useMutation({
    mutationFn: (values: WarehouseFormValues) =>
      updateWarehouse(resolvedId, {
        name: values.name.trim(),
        address: values.address?.trim() || null,
        contact_person: values.contact_person?.trim() || null,
        phone: values.phone?.trim() || null,
        status: values.status,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["warehouse"] }),
  });

  const doSave = async () => {
    setSaveError("");
    setSavedAt("");
    const values: WarehouseFormValues = {
      ...formValues,
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
      setSavedAt(formatDateTime(new Date().toISOString()));
    } catch (error) {
      // Lỗi nào gắn được vào ô nhập thì hiện ngay dưới ô đó (vd tên kho quá
      // dài), banner chỉ giữ phần không thuộc ô nào — trước đây mọi lỗi đều bị
      // dồn vào banner nên người dùng chỉ thấy câu tổng chung chung.
      const { fieldErrors: serverFieldErrors, message } = resolveFormErrors(
        error,
        Object.keys(WAREHOUSE_FORM_FIELDS),
      );
      if (Object.keys(serverFieldErrors).length === 0) {
        // Không có lỗi nào theo trường: giữ nguyên các thông điệp nghiệp vụ
        // riêng của màn này (chỉ một kho hoạt động, ngoài phạm vi dữ liệu...).
        setSaveError(saveErrorMessage(error));
        return;
      }
      setFieldErrors((current) => ({
        ...current,
        ...Object.fromEntries(
          Object.entries(serverFieldErrors).map(([field, msg]) => [
            WAREHOUSE_FORM_FIELDS[field as keyof typeof WAREHOUSE_FORM_FIELDS],
            msg,
          ]),
        ),
      }));
      setSaveError(message ?? "");
    }
  };

  const handleSubmit = async () => {
    if (statusChanged) {
      setConfirmOpen(true);
      return;
    }
    await doSave();
  };

  const confirmStatusChange = async () => {
    setConfirmOpen(false);
    await doSave();
  };

  const listError = listQuery.error
    ? getApiErrorMessage(listQuery.error, "Không tải được danh sách kho.")
    : "";
  const detailError = detailQuery.error
    ? getApiErrorMessage(detailQuery.error, "Không tải được thông tin kho.")
    : "";

  const statusChanged =
    Boolean(warehouse) &&
    Boolean(formValues.status) &&
    formValues.status !== warehouse?.status;

  const fieldsDisabled = !canManage || saveMutation.isPending;

  return (
    <ThemeProvider theme={muiTheme}>
      <Stack spacing={2} sx={{ maxWidth: 880, mx: "auto", width: "100%" }}>
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <ActionButton
            kind="save"
            onClick={() => void handleSubmit()}
            disabled={!canManage || !resolvedId || saveMutation.isPending}
          >
            {saveMutation.isPending ? "Đang lưu..." : "Lưu cấu hình"}
          </ActionButton>
        </Box>

        <Alert severity="info">
          <Typography
            component="strong"
            sx={{ fontWeight: 700, display: "block" }}
          >
            Hệ thống sử dụng một kho tổng
          </Typography>
          <Typography variant="body2">
            Trong phạm vi hiện tại, hệ thống vận hành một kho tổng. Người dùng
            chỉ xem và cập nhật thông tin kho; không tạo hoặc xóa kho trực tiếp
            tại màn hình này.
          </Typography>
        </Alert>

        {listError ? <Alert severity="error">{listError}</Alert> : null}
        {detailError ? <Alert severity="error">{detailError}</Alert> : null}
        {saveError ? <Alert severity="error">{saveError}</Alert> : null}
        {savedAt ? (
          <Alert severity="success">
            <Typography
              component="strong"
              sx={{ fontWeight: 700, display: "block" }}
            >
              Đã lưu cấu hình kho
            </Typography>
            <Typography variant="body2">Cập nhật lúc {savedAt}.</Typography>
          </Alert>
        ) : null}

        {!listQuery.isLoading && warehouses.length === 0 && !listError ? (
          <Alert severity="warning">
            <Typography
              component="strong"
              sx={{ fontWeight: 700, display: "block" }}
            >
              Chưa có kho tổng trong hệ thống
            </Typography>
            <Typography variant="body2">
              Liên hệ quản trị hệ thống để khởi tạo kho tổng trước khi cấu hình.
            </Typography>
          </Alert>
        ) : null}

        {warehouses.length > 1 ? (
          <Alert severity="warning">
            <Typography
              component="strong"
              sx={{ fontWeight: 700, display: "block" }}
            >
              Đang có {warehouses.length} kho trong dữ liệu
            </Typography>
            <Typography variant="body2">
              Chỉ được giữ đúng một kho Đang hoạt động. Hãy chọn từng kho bên
              dưới để ngừng hoạt động kho thừa.
            </Typography>
          </Alert>
        ) : null}

        <Card variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          {listQuery.isLoading || detailQuery.isLoading ? (
            <Stack spacing={1}>
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} variant="text" height={28} />
              ))}
            </Stack>
          ) : !warehouse ? (
            <Typography variant="body2" color="text.secondary">
              Chưa có kho để hiển thị.
            </Typography>
          ) : (
            <>
              {warehouses.length > 1 ? (
                <Grid container sx={{ mb: 2 }}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <FormControl fullWidth>
                      <InputLabel id="warehouse-select-label" shrink>
                        Chọn kho
                      </InputLabel>
                      <Select
                        id="warehouse-select"
                        labelId="warehouse-select-label"
                        label="Chọn kho"
                        value={resolvedId}
                        onChange={(event) => {
                          setSelectedId(event.target.value);
                          setSaveError("");
                          setSavedAt("");
                          setFieldErrors({});
                        }}
                      >
                        {warehouses.map((row) => (
                          <MenuItem key={row.id} value={row.id}>
                            {row.code} · {row.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              ) : null}

              <Box
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  p: 2,
                  mb: 2,
                }}
              >
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block" }}
                    >
                      Mã kho
                    </Typography>
                    <Typography variant="body2">{warehouse.code}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block" }}
                    >
                      Trạng thái hiện tại
                    </Typography>
                    <Chip
                      label={
                        warehouse.status === "ACTIVE"
                          ? "Đang hoạt động"
                          : "Ngừng hoạt động"
                      }
                      color={
                        warehouse.status === "ACTIVE" ? "success" : "warning"
                      }
                      size="small"
                    />
                  </Grid>
                </Grid>
              </Box>

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    id="warehouse-name"
                    label="Tên kho"
                    required
                    fullWidth
                    placeholder="Kho tổng Hoa Nam"
                    value={formValues.name}
                    onChange={(event) => {
                      const value = event.target.value;
                      setFormValues((current) => ({ ...current, name: value }));
                      setFieldErrors((current) =>
                        current.name ? { ...current, name: "" } : current,
                      );
                    }}
                    disabled={fieldsDisabled}
                    error={Boolean(fieldErrors.name)}
                    helperText={fieldErrors.name}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControl
                    fullWidth
                    required
                    disabled={fieldsDisabled}
                    error={Boolean(fieldErrors.status)}
                  >
                    <InputLabel id="warehouse-status-label">
                      Trạng thái
                    </InputLabel>
                    <Select
                      id="warehouse-status"
                      labelId="warehouse-status-label"
                      label="Trạng thái"
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
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                    {fieldErrors.status ? (
                      <FormHelperText>{fieldErrors.status}</FormHelperText>
                    ) : null}
                  </FormControl>
                </Grid>
                <Grid size={12}>
                  <TextField
                    id="warehouse-address"
                    label="Địa chỉ"
                    fullWidth
                    multiline
                    minRows={2}
                    value={formValues.address ?? ""}
                    onChange={(event) => {
                      const value = event.target.value;
                      setFormValues((current) => ({
                        ...current,
                        address: value,
                      }));
                      setFieldErrors((current) =>
                        current.address ? { ...current, address: "" } : current,
                      );
                    }}
                    disabled={fieldsDisabled}
                    error={Boolean(fieldErrors.address)}
                    helperText={fieldErrors.address}
                    slotProps={{ htmlInput: { maxLength: 500 } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    id="warehouse-contact-person"
                    label="Người liên hệ"
                    fullWidth
                    value={formValues.contact_person ?? ""}
                    onChange={(event) => {
                      const value = event.target.value;
                      setFormValues((current) => ({
                        ...current,
                        contact_person: value,
                      }));
                      setFieldErrors((current) =>
                        current.contact_person
                          ? { ...current, contact_person: "" }
                          : current,
                      );
                    }}
                    disabled={fieldsDisabled}
                    error={Boolean(fieldErrors.contact_person)}
                    helperText={fieldErrors.contact_person}
                    slotProps={{ htmlInput: { maxLength: 200 } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    id="warehouse-phone"
                    label="Số điện thoại"
                    fullWidth
                    value={formValues.phone ?? ""}
                    onChange={(event) => {
                      const value = event.target.value
                        .replace(/\D/g, "")
                        .slice(0, 10);
                      setFormValues((current) => ({
                        ...current,
                        phone: value,
                      }));
                      setFieldErrors((current) =>
                        current.phone ? { ...current, phone: "" } : current,
                      );
                    }}
                    disabled={fieldsDisabled}
                    error={Boolean(fieldErrors.phone)}
                    helperText={fieldErrors.phone}
                    slotProps={{
                      htmlInput: { inputMode: "numeric", maxLength: 10 },
                    }}
                  />
                </Grid>
              </Grid>

              {!canManage ? (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 2 }}
                >
                  Tài khoản hiện tại chỉ có quyền xem nên không thể sửa cấu hình
                  kho.
                </Typography>
              ) : null}
            </>
          )}
        </Card>

        <Dialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>Đổi trạng thái kho?</DialogTitle>
          <DialogContent>
            <Typography variant="body2">
              Hệ thống chỉ cho phép đúng một kho Đang hoạt động. Thao tác đổi
              trạng thái không tạo chứng từ và không làm thay đổi tồn kho.
            </Typography>
          </DialogContent>
          <DialogActions>
            <ActionButton kind="cancel" onClick={() => setConfirmOpen(false)}>
              Hủy
            </ActionButton>
            <ActionButton
              kind="confirm"
              onClick={() => void confirmStatusChange()}
            >
              Đồng ý
            </ActionButton>
          </DialogActions>
        </Dialog>
      </Stack>
    </ThemeProvider>
  );
}
