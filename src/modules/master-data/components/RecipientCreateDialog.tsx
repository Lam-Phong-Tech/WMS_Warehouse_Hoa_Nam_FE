import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  Box,
  Grid,
  MenuItem,
  UiAlert,
  UiDialog,
  UiTextField,
} from "@/shared/ui";
import { ActionButton, ActionIconButton } from "@/shared/components/actions";
import { guardBackdropClose } from "@/shared/utils/dialogGuard";
import { useT, type TranslateFn } from "@/shared/i18n/useT";
import {
  getMutationErrorMessage,
  resolveFormErrors,
} from "@/shared/api/api-error";
import {
  RECIPIENT_TYPES,
  RECIPIENT_TYPE_LABELS,
  type RecipientType,
} from "@/shared/constants/recipient-types";
import { useCreateMvpAgency } from "@/modules/master-data/hooks/use-mvp-master";
import type {
  AgencyPayload,
  AgencyRecord,
  MasterStatus,
} from "@/modules/master-data/types/mvp-master.types";

/**
 * Dialog THÊM MỚI nơi nhận (đại lý) tách riêng để dùng lại: màn "Danh mục đại lý
 * / nơi nhận" mở nó qua nút "Thêm nơi nhận", và ô autocomplete đại lý ở
 * OUT-REQ-01 mở nó ngay trong dropdown khi chưa tìm thấy. Cùng payload / cùng
 * validate / cùng nhãn i18n (masterData.recipient.*) với form gốc trong
 * AgencyMasterScreen — chỉ khác: chỉ tạo mới (không sửa), và trả bản ghi vừa tạo
 * qua onCreated để nơi gọi tự chọn.
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

// Map camelCase (extractFieldErrors) → snake_case (state form). Phải khớp với
// AGENCY_FORM_FIELDS trong AgencyMasterScreen để lỗi server gắn đúng ô.
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

const statusOptions = (
  t: TranslateFn,
): Array<{ value: MasterStatus; label: string }> => [
  { value: "ACTIVE", label: t("masterData.status.inUse") },
  { value: "INACTIVE", label: t("masterData.status.notInUse") },
];

interface RecipientCreateDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (record: AgencyRecord) => void;
  /** Prefill tên nơi nhận bằng từ khoá vừa gõ ở ô autocomplete. */
  initialName?: string;
}

export function RecipientCreateDialog({
  open,
  onClose,
  onCreated,
  initialName = "",
}: RecipientCreateDialogProps) {
  const t = useT();
  const createMutation = useCreateMvpAgency();
  const isSaving = createMutation.isPending;
  const [form, setForm] = useState<AgencyFormState>(EMPTY_AGENCY_FORM);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Mỗi lần mở lại: reset form và seed tên bằng từ khoá đã gõ.
  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY_AGENCY_FORM, agency_name: initialName });
      setFormError("");
      setFieldErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ seed khi dialog chuyển sang mở.
  }, [open]);

  const close = () => {
    if (isSaving) return;
    onClose();
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
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
    if (!validate()) return;
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
    try {
      const record = await createMutation.mutateAsync(payload);
      toast.success(t("masterData.recipient.created"));
      onCreated(record);
    } catch (error) {
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

  return (
    <UiDialog
      open={open}
      onClose={guardBackdropClose(close)}
      maxWidth="sm"
      fullWidth
      title={
        <>
          {t("masterData.recipient.dialogCreate")}
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
            form="recipient-create-form"
          >
            {isSaving
              ? t("masterData.common.saving")
              : t("masterData.recipient.submit")}
          </ActionButton>
        </>
      }
    >
      <form id="recipient-create-form" onSubmit={submit} noValidate>
        {formError ? (
          <Box sx={{ mb: "14px" }}>
            <UiAlert tone="error">{formError}</UiAlert>
          </Box>
        ) : null}
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <UiTextField
              label={t("masterData.recipient.fieldCode")}
              required
              fullWidth
              value={form.agency_code}
              onChange={(event) => {
                const value = event.target.value;
                setForm((current) => ({ ...current, agency_code: value }));
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
              label={t("masterData.recipient.colName")}
              required
              fullWidth
              value={form.agency_name}
              onChange={(event) => {
                const value = event.target.value;
                setForm((current) => ({ ...current, agency_name: value }));
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
              select
              label={t("masterData.recipient.colType")}
              required
              fullWidth
              disabled={isSaving}
              value={form.recipient_type}
              onChange={(event) => {
                const value = event.target.value as RecipientType | "";
                setForm((current) => ({ ...current, recipient_type: value }));
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
              label={t("masterData.recipient.colContact")}
              fullWidth
              value={form.contact_name ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                setForm((current) => ({ ...current, contact_name: value }));
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
              slotProps={{ htmlInput: { inputMode: "numeric", maxLength: 10 } }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <UiTextField
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
  );
}
