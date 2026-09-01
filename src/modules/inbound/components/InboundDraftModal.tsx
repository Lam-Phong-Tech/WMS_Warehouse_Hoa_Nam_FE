import { useEffect, useRef, useState } from "react";
import {
  Box,
  Grid,
  MenuItem,
  Stack,
  UiAlert,
  UiDialog,
  UiTextField,
} from "@/shared/ui";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getApiErrorMessage,
  normalizeError,
  resolveFormErrors,
} from "@/shared/api/api-error";
import { useDialogExit } from "@/shared/utils/useDialogExit";
import { useT } from "@/shared/i18n/useT";
import { DocumentAttachmentsPanel } from "@/shared/components/DocumentAttachmentsPanel";
import {
  hasAnyWmsPermission,
  WMS_PERMISSION_CATALOG as P,
} from "@/shared/constants/wms-permissions";
import { useAuthStore } from "@/shared/store/auth.store";
import { fetchWarehouses } from "@/modules/master-data/services/warehouse.service";
import {
  useCreateInbound,
  useInboundDetail,
  useUpdateInbound,
} from "@/modules/inbound/hooks/use-inbound";
import type {
  CreateInboundPayload,
  UpdateInboundPayload,
} from "@/modules/inbound/types";
import { ActionButton, ActionIconButton } from "@/shared/components/actions";

interface FormValues {
  warehouseId: string;
  documentDate: string;
  sourceName: string;
  note: string;
}

export interface InboundDraftModalProps {
  documentId: string | null;
  onClose: () => void;
  onSaved: (documentId: string) => void;
}

function localToday(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function text(value: unknown): string {
  return value === undefined || value === null ? "" : String(value);
}

function useInboundPermission(code: string) {
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  return hasAnyWmsPermission(permissionCodes, [code], isSuperAdmin);
}

const EMPTY_FORM: FormValues = {
  warehouseId: "",
  documentDate: "",
  sourceName: "",
  note: "",
};

/**
 * Nối tên trường của server về đúng ô nhập trên form.
 *
 * Server báo lỗi theo tên trường của payload (`doc_date`, `dst_warehouse_id`,
 * `source_reference` — đã được chuyển sang camelCase), còn form đặt tên riêng
 * (`documentDate`, `warehouseId`, `sourceName`). Thiếu bảng nối này thì lỗi
 * server rơi vào khoá không ô nào đọc và biến mất im lặng.
 *
 * CHỈ liệt kê trường thực sự có `error` + `helperText` trên form — liệt kê dư
 * cũng là nuốt lỗi.
 */
const SERVER_FIELD_TO_FORM_FIELD: Record<string, keyof FormValues> = {
  docDate: "documentDate",
  documentDate: "documentDate",
  dstWarehouseId: "warehouseId",
  warehouseId: "warehouseId",
  sourceReference: "sourceName",
  sourceName: "sourceName",
  note: "note",
};

const SERVER_ERROR_FIELDS = Object.keys(SERVER_FIELD_TO_FORM_FIELD);

/**
 * GĐ1 IN-02 — create/edit only the receipt header.
 * SKU and quantity are never entered here; scan is the authoritative source.
 */
export function InboundDraftModal({
  documentId,
  onClose,
  onSaved,
}: InboundDraftModalProps) {
  const dialog = useDialogExit(onClose);
  const t = useT();
  const [formValues, setFormValues] = useState<FormValues>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const initializedRef = useRef<string | null>(null);
  const detailQuery = useInboundDetail(documentId);
  const warehousesQuery = useQuery({
    queryKey: ["warehouses", "inbound-active"],
    queryFn: () => fetchWarehouses({ status: "ACTIVE", per_page: 100 }),
  });
  const createMutation = useCreateInbound();
  const updateMutation = useUpdateInbound();
  const canCreate = useInboundPermission(P.INBOUND_CREATE);
  const detail = detailQuery.data;
  const status = detail?.document.status;
  const mutable = !documentId || status === "DRAFT" || status === "SCANNING";
  const saving = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    if (!documentId) {
      const firstWarehouse = warehousesQuery.data?.[0] as
        | Record<string, unknown>
        | undefined;
      setFormValues({
        documentDate: localToday(),
        warehouseId: text(firstWarehouse?.id ?? firstWarehouse?.warehouse_id),
        sourceName: "",
        note: "",
      });
      setFieldErrors({});
      return;
    }
    if (!detail || initializedRef.current === documentId) return;
    setFormValues({
      documentDate: detail.document.date?.slice(0, 10) || localToday(),
      warehouseId: detail.document.warehouseId,
      sourceName: detail.document.source === "-" ? "" : detail.document.source,
      note: detail.document.note ?? "",
    });
    setFieldErrors({});
    initializedRef.current = documentId;
  }, [detail, documentId, warehousesQuery.data]);

  const warehouseOptions = (warehousesQuery.data ?? []).map(
    (warehouse: Record<string, unknown>) => {
      const id = text(warehouse.id ?? warehouse.warehouse_id);
      const label = [text(warehouse.code), text(warehouse.name)]
        .filter(Boolean)
        .join(" · ");
      return { value: id, label: label || id };
    },
  );
  // Giá trị kho đang chọn có thể chưa nằm trong danh sách (danh sách đang tải
  // hoặc kho đã ngừng hoạt động) — vẫn phải liệt kê để Select hiển thị đúng
  // lựa chọn hiện tại thay vì cảnh báo out-of-range và hiện rỗng.
  const warehouseSelectOptions =
    formValues.warehouseId &&
    !warehouseOptions.some((option) => option.value === formValues.warehouseId)
      ? [
          ...warehouseOptions,
          { value: formValues.warehouseId, label: formValues.warehouseId },
        ]
      : warehouseOptions;

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formValues.documentDate) {
      errors.documentDate = t("inbound.draft.errDocumentDate");
    } else if (formValues.documentDate > localToday()) {
      errors.documentDate = t("inbound.draft.errDocumentDateFuture");
    }
    if (!documentId && !formValues.warehouseId) {
      errors.warehouseId = t("inbound.draft.errWarehouse");
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    if (!canCreate || !mutable) return;
    try {
      if (documentId) {
        if (!detail) return;
        const payload: UpdateInboundPayload = {
          doc_date: formValues.documentDate || null,
          source_reference: formValues.sourceName?.trim() || null,
          note: formValues.note?.trim() || null,
        };
        const updated = await updateMutation.mutateAsync({
          id: documentId,
          payload,
          ifMatch: detail.document.version,
        });
        toast.success(t("inbound.draft.updated"));
        onSaved(updated.id);
        return;
      }

      const payload: CreateInboundPayload = {
        doc_date: formValues.documentDate || null,
        dst_warehouse_id: formValues.warehouseId,
        source_reference: formValues.sourceName?.trim() || null,
        note: formValues.note?.trim() || null,
      };
      const created = await createMutation.mutateAsync(payload);
      toast.success(t("inbound.draft.created"));
      onSaved(created.id);
    } catch (error) {
      // Lỗi nhập liệu từ server phải hiện ngay dưới ô sai, không dồn hết vào
      // một câu tổng chung chung; `message` là phần còn lại không gắn được vào
      // ô nào, `null` nghĩa là đã gắn hết nên không cần toast tổng nữa.
      const { fieldErrors: serverFieldErrors, message } = resolveFormErrors(
        error,
        SERVER_ERROR_FIELDS,
      );
      const mappedErrors: Record<string, string> = {};
      for (const [field, fieldMessage] of Object.entries(serverFieldErrors)) {
        mappedErrors[SERVER_FIELD_TO_FORM_FIELD[field]] = fieldMessage;
      }
      const hasFieldErrors = Object.keys(mappedErrors).length > 0;
      setFieldErrors((current) => ({ ...current, ...mappedErrors }));

      if (message !== null) {
        toast.error(
          hasFieldErrors
            ? message
            : getApiErrorMessage(error, t("inbound.draft.saveError")),
        );
      }

      // Nạp lại phiếu để lấy version mới (vd 412 STALE_VERSION). Bỏ qua khi là
      // lỗi nhập liệu: refetch sẽ ghi đè form từ server và xoá sạch fieldErrors
      // vừa gắn, người dùng mất cả nội dung đang sửa lẫn chỗ báo sai.
      if (documentId && !hasFieldErrors) {
        initializedRef.current = null;
        await detailQuery.refetch();
      }
    }
  };

  return (
    <UiDialog
      {...dialog.dialogProps}
      maxWidth="sm"
      title={
        <Stack
          direction="row"
          sx={{ alignItems: "center", justifyContent: "space-between", gap: 1 }}
        >
          <span>
            {documentId
              ? t("inbound.draft.titleEdit")
              : t("inbound.draft.titleCreate")}
          </span>
          <ActionIconButton
            kind="close"
            label={t("common.close")}
            onClick={dialog.close}
            disabled={saving}
          />
        </Stack>
      }
      actions={
        <>
          <ActionButton kind="close" onClick={dialog.close}>
            {t("common.close")}
          </ActionButton>
          {mutable && canCreate ? (
            <ActionButton
              kind="save"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {documentId
                ? t("inbound.draft.submitEdit")
                : t("inbound.draft.submitCreate")}
            </ActionButton>
          ) : null}
        </>
      }
    >
      <br />

      {detailQuery.isError ? (
        <Box sx={{ mb: 2 }}>
          <UiAlert
            tone={
              normalizeError(detailQuery.error).status === 403
                ? "warning"
                : "error"
            }
          >
            {getApiErrorMessage(
              detailQuery.error,
              t("inbound.draft.loadError"),
            )}
          </UiAlert>
        </Box>
      ) : null}

      {documentId && !mutable ? (
        <Box sx={{ mb: 2 }}>
          <UiAlert tone="info">{t("inbound.draft.readonly")}</UiAlert>
        </Box>
      ) : null}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <UiTextField
            id="inbound-doc-date"
            label={t("inbound.draft.documentDate")}
            type="date"
            required
            fullWidth
            value={formValues.documentDate}
            onChange={(event) => {
              setFormValues((current) => ({
                ...current,
                documentDate: event.target.value,
              }));
              if (fieldErrors.documentDate) {
                setFieldErrors((current) => ({
                  ...current,
                  documentDate: "",
                }));
              }
            }}
            disabled={!mutable}
            slotProps={{
              inputLabel: { shrink: true },
              htmlInput: { max: localToday() },
            }}
            error={Boolean(fieldErrors.documentDate)}
            helperText={
              fieldErrors.documentDate || t("inbound.draft.documentDateHelper")
            }
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          {/* Part 4 Vuexy sync: Autocomplete (MUI trần) → UiTextField select
              cùng danh sách kho; chọn kho vẫn chỉ cập nhật state form. */}
          <UiTextField
            select
            label={t("inbound.draft.warehouse")}
            required
            fullWidth
            value={formValues.warehouseId}
            onChange={(event) => {
              setFormValues((current) => ({
                ...current,
                warehouseId: event.target.value,
              }));
              if (fieldErrors.warehouseId) {
                setFieldErrors((current) => ({
                  ...current,
                  warehouseId: "",
                }));
              }
            }}
            disabled={!mutable || Boolean(documentId)}
            error={Boolean(fieldErrors.warehouseId)}
            helperText={fieldErrors.warehouseId}
          >
            {warehouseSelectOptions.length === 0 ? (
              <MenuItem value="" disabled>
                {t("inbound.draft.warehousePlaceholder")}
              </MenuItem>
            ) : null}
            {warehouseSelectOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </UiTextField>
        </Grid>
        <Grid size={12}>
          <UiTextField
            id="inbound-source"
            label={t("inbound.draft.sourceRef")}
            fullWidth
            placeholder={t("inbound.draft.sourceRefPlaceholder")}
            value={formValues.sourceName}
            onChange={(event) => {
              setFormValues((current) => ({
                ...current,
                sourceName: event.target.value,
              }));
              if (fieldErrors.sourceName) {
                setFieldErrors((current) => ({
                  ...current,
                  sourceName: "",
                }));
              }
            }}
            disabled={!mutable}
            slotProps={{ htmlInput: { maxLength: 200 } }}
            error={Boolean(fieldErrors.sourceName)}
            helperText={fieldErrors.sourceName}
          />
        </Grid>
        <Grid size={12}>
          <UiTextField
            id="inbound-note"
            label={t("inbound.draft.note")}
            fullWidth
            multiline
            minRows={3}
            value={formValues.note}
            onChange={(event) => {
              setFormValues((current) => ({
                ...current,
                note: event.target.value,
              }));
              if (fieldErrors.note) {
                setFieldErrors((current) => ({ ...current, note: "" }));
              }
            }}
            disabled={!mutable}
            // Lỗi server (vd quá độ dài) chiếm chỗ helperText đếm ký tự —
            // báo sai ở đâu quan trọng hơn số ký tự còn lại.
            error={Boolean(fieldErrors.note)}
            helperText={fieldErrors.note || `${formValues.note.length}/1000`}
            slotProps={{ htmlInput: { maxLength: 1000 } }}
          />
        </Grid>
      </Grid>

      {documentId ? (
        <Grid size={12} sx={{ mt: 2 }}>
          <DocumentAttachmentsPanel
            documentType="INBOUND"
            documentId={documentId}
            disabled={!mutable}
          />
        </Grid>
      ) : null}
    </UiDialog>
  );
}
