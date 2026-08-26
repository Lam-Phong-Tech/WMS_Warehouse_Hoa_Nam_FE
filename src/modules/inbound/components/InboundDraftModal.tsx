import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  TextField,
  ThemeProvider,
} from "@mui/material";
import { CloseOutlined, SaveOutlined } from "@/shared/components/icons";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { muiTheme } from "@/app/mui-theme";
import { getApiErrorMessage, normalizeError } from "@/shared/api/api-error";
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
 * GĐ1 IN-02 — create/edit only the receipt header.
 * SKU and quantity are never entered here; scan is the authoritative source.
 */
export function InboundDraftModal({
  documentId,
  onClose,
  onSaved,
}: InboundDraftModalProps) {
  const [formValues, setFormValues] = useState<FormValues>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
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
      return;
    }
    if (!detail || initializedRef.current === documentId) return;
    setFormValues({
      documentDate: detail.document.date?.slice(0, 10) || localToday(),
      warehouseId: detail.document.warehouseId,
      sourceName: detail.document.source === "-" ? "" : detail.document.source,
      note: detail.document.note ?? "",
    });
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
  const selectedWarehouseOption =
    warehouseOptions.find((option) => option.value === formValues.warehouseId) ??
    null;

  const handleSave = async () => {
    setFormError("");
    if (!formValues.documentDate) {
      setFormError("Chọn ngày chứng từ.");
      return;
    }
    if (!documentId && !formValues.warehouseId) {
      setFormError("Chọn kho nhận.");
      return;
    }
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
        toast.success("Đã cập nhật thông tin phiếu nhập.");
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
      toast.success(
        "Đã tạo phiếu nhập. Quét hàng để hệ thống tự nhận SKU và số lượng.",
      );
      onSaved(created.id);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không lưu được phiếu nhập."));
      if (documentId) {
        initializedRef.current = null;
        await detailQuery.refetch();
      }
    }
  };

  return (
    <ThemeProvider theme={muiTheme}>
      <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pr: 6, position: "relative" }}>
          {documentId ? "Thông tin phiếu nhập" : "Tạo phiếu nhập"}
          <IconButton
            aria-label="Đóng"
            onClick={onClose}
            disabled={saving}
            sx={{ position: "absolute", right: 10, top: 8 }}
          >
            <CloseOutlined style={{ fontSize: 15 }} />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 2 }}>
            Không nhập SKU hoặc số lượng dự kiến. Sau khi tạo phiếu, quét
            QR/Barcode sản phẩm; hệ thống tự nhận SKU, tự cộng số lượng theo
            SKU và chỉ tăng tồn khi bấm Ghi nhận nhập.
          </Alert>

          {detailQuery.isError ? (
            <Alert
              severity={
                normalizeError(detailQuery.error).status === 403
                  ? "warning"
                  : "error"
              }
              sx={{ mb: 2 }}
            >
              {getApiErrorMessage(detailQuery.error, "Không tải được phiếu nhập.")}
            </Alert>
          ) : null}

          {documentId && !mutable ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              Phiếu đã kết thúc và chỉ được xem
            </Alert>
          ) : null}

          {formError ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {formError}
            </Alert>
          ) : null}

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                id="inbound-doc-date"
                label="Ngày chứng từ"
                type="date"
                required
                fullWidth
                value={formValues.documentDate}
                onChange={(event) =>
                  setFormValues((current) => ({
                    ...current,
                    documentDate: event.target.value,
                  }))
                }
                disabled={!mutable}
                slotProps={{ inputLabel: { shrink: true } }}
                helperText="Định dạng: ngày/tháng/năm"
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Autocomplete
                options={warehouseOptions}
                getOptionLabel={(option) => option.label}
                isOptionEqualToValue={(option, value) => option.value === value.value}
                value={selectedWarehouseOption}
                onChange={(_event, newValue) =>
                  setFormValues((current) => ({
                    ...current,
                    warehouseId: newValue?.value ?? "",
                  }))
                }
                loading={warehousesQuery.isLoading}
                disabled={!mutable || Boolean(documentId)}
                renderInput={(params) => (
                  <TextField {...params} label="Kho nhận" required placeholder="Chọn kho nhận" />
                )}
              />
            </Grid>
            <Grid size={12}>
              <TextField
                id="inbound-source"
                label="Nguồn / tham chiếu"
                fullWidth
                placeholder="Chứng từ vận chuyển / nhà cung cấp (tùy chọn)"
                value={formValues.sourceName}
                onChange={(event) =>
                  setFormValues((current) => ({
                    ...current,
                    sourceName: event.target.value,
                  }))
                }
                disabled={!mutable}
                slotProps={{ htmlInput: { maxLength: 200 } }}
              />
            </Grid>
            <Grid size={12}>
              <TextField
                id="inbound-note"
                label="Ghi chú"
                fullWidth
                multiline
                minRows={3}
                value={formValues.note}
                onChange={(event) =>
                  setFormValues((current) => ({
                    ...current,
                    note: event.target.value,
                  }))
                }
                disabled={!mutable}
                helperText={`${formValues.note.length}/1000`}
                slotProps={{ htmlInput: { maxLength: 1000 } }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Đóng</Button>
          {mutable && canCreate ? (
            <Button
              variant="contained"
              onClick={() => void handleSave()}
              disabled={saving}
              startIcon={<SaveOutlined />}
            >
              {documentId ? "Lưu thông tin" : "Tạo phiếu & quét hàng"}
            </Button>
          ) : null}
        </DialogActions>
      </Dialog>
    </ThemeProvider>
  );
}
