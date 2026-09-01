import { useEffect, useState } from "react";
import {
  Box,
  Grid,
  Stack,
  UiDialog,
  UiPagination,
  UiSelect,
  UiStatusBadge,
  UiTextField,
  type UiStatusTone,
} from "@/shared/ui";
// SKU sản phẩm cần gõ-để-lọc trên toàn danh mục (catalog lớn, không thể tải hết
// vào 1 dropdown) — UiSelect/UiFormAutocomplete (RHF) không hợp; dùng thẳng MUI
// Autocomplete cùng cách UiFormAutocomplete.tsx đã làm.
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import dayjs from "dayjs";
import { toast } from "sonner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getApiErrorMessage } from "@/shared/api/api-error";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import {
  ResponsiveDataTable,
  type ResponsiveTableColumn,
} from "@/shared/components/data-display/ResponsiveDataTable";
import { CopyableId } from "@/shared/components/data-display/CopyableId";
import {
  useMvpAgencies,
  useMvpSkus,
} from "@/modules/master-data/hooks/use-mvp-master";
import type { AgencyRecord } from "@/modules/master-data/types/mvp-master.types";
import { useDialogExit } from "@/shared/utils/useDialogExit";
import {
  AnimatedList,
  AnimatedListItem,
} from "@/shared/components/motion/AnimatedList";
import { createRowKey } from "@/shared/components/motion/row-key";
import {
  consumeOutboundImport,
  fetchAvailableQtyBySku,
  uploadOutboundRequestFile,
  validateOutboundRequestRows,
  type OutboundImportResult,
  type OutboundRequestRowInput,
} from "@/modules/outbound/services/mvpOutboundService";
import { ActionButton, ActionIconButton } from "@/shared/components/actions";
import { useT, type TranslateFn } from "@/shared/i18n/useT";
import type { MessageKey } from "@/shared/i18n/messages";

type IntakeMode = "manual" | "excel";

interface LineInput {
  /** Khóa ổn định cho hiệu ứng thêm/xóa dòng — không gửi lên API. */
  key: string;
  product_id: string;
  required_qty: number;
}

function createEmptyLine(): LineInput {
  return {
    key: createRowKey("outbound-line"),
    product_id: "",
    required_qty: 1,
  };
}

type LineResolution = { sku_id?: string; required_qty?: number };

interface OutboundIntakeModalProps {
  open: boolean;
  canImport: boolean;
  onClose: () => void;
  onConsumed: (outboundDocumentIds: string[]) => void;
}

function makeKey(prefix: string): string {
  const random =
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `${prefix}-${random}`;
}

function text(value: unknown, fallback = ""): string {
  return value === undefined || value === null ? fallback : String(value);
}

type ImportRow = OutboundImportResult["rows"][number];

function rowErrorText(row: ImportRow, t: TranslateFn): string {
  return row.errors
    .map(
      (error) =>
        `${error.field ?? t("outbound.intake.rowLabel", { row: error.row ?? row.rowNo })}: ${error.message ?? error.error_code ?? t("outbound.intake.genericError")}`,
    )
    .join(" · ");
}

/** Tông màu soft-tint theo UiStatusBadge — "processing"/"default" (antd cũ) ⇒ info/neutral. */
const IMPORT_STATUS_TONE: Record<string, UiStatusTone> = {
  UPLOADED: "info",
  VALIDATED: "success",
  REJECTED: "error",
  CONSUMED: "neutral",
};

const IMPORT_STATUS_LABEL: Record<string, MessageKey> = {
  UPLOADED: "outbound.intake.statusUploaded",
  VALIDATED: "outbound.intake.statusValidated",
  REJECTED: "outbound.intake.statusRejected",
  CONSUMED: "outbound.intake.statusConsumed",
};

/** Bảng xem trước phân trang client-side như antd Table cũ (pageSize 10). */
const PREVIEW_PAGE_SIZE = 10;

export function OutboundIntakeModal({
  open,
  canImport,
  onClose,
  onConsumed,
}: OutboundIntakeModalProps) {
  const t = useT();
  const dialog = useDialogExit(onClose);
  const [mode, setMode] = useState<IntakeMode>("manual");
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [preview, setPreview] = useState<OutboundImportResult | null>(null);
  const [previewPage, setPreviewPage] = useState(1);
  const [resolutions, setResolutions] = useState<
    Record<number, LineResolution>
  >({});
  const [recipientOverride, setRecipientOverride] = useState({
    receiver_name: "",
    receiver_address: "",
    receiver_contact_phone: "",
  });

  const [requestNo, setRequestNo] = useState("");
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [recipientName, setRecipientName] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [requestDate, setRequestDate] = useState("");
  const [lines, setLines] = useState<LineInput[]>([createEmptyLine()]);
  // Lỗi kiểm tra hiển thị INLINE ngay dưới từng ô (thay cho một khối lỗi tổng
  // data-ui-state="error"): người dùng thấy đúng ô nào cần sửa.
  const [fieldErrors, setFieldErrors] = useState<{
    requestNo?: string;
    recipientName?: string;
    recipientPhone?: string;
    lines: Record<number, { product_id?: string; required_qty?: string }>;
  }>({ lines: {} });

  const clearFieldError = (
    field: "requestNo" | "recipientName" | "recipientPhone",
  ) =>
    setFieldErrors((prev) =>
      prev[field] ? { ...prev, [field]: undefined } : prev,
    );

  const clearLineError = (index: number) =>
    setFieldErrors((prev) => {
      if (!prev.lines[index]) return prev;
      const nextLines = { ...prev.lines };
      delete nextLines[index];
      return { ...prev, lines: nextLines };
    });

  const validateManualForm = () => {
    const errors: typeof fieldErrors = { lines: {} };
    if (!requestNo.trim()) errors.requestNo = t("outbound.intake.errRequestNo");
    if (!recipientName.trim())
      errors.recipientName = t("outbound.intake.errRecipient");
    if (recipientPhone && !/^0\d{9}$/.test(recipientPhone)) {
      errors.recipientPhone = t("outbound.intake.errPhone");
    }
    lines.forEach((line, index) => {
      const lineError: { product_id?: string; required_qty?: string } = {};
      if (!line.product_id) lineError.product_id = t("outbound.intake.errSku");
      if (!line.required_qty || line.required_qty < 1) {
        lineError.required_qty = t("outbound.intake.errQty");
      }
      if (lineError.product_id || lineError.required_qty) {
        errors.lines[index] = lineError;
      }
    });
    return errors;
  };

  const hasFieldErrors = (errors: typeof fieldErrors) =>
    Boolean(
      errors.requestNo ||
      errors.recipientName ||
      errors.recipientPhone ||
      Object.keys(errors.lines).length > 0,
    );

  const skuQuery = useMvpSkus({
    status: "ACTIVE",
    sku_type: "PRODUCT",
    per_page: 100,
  });
  const agencyQuery = useMvpAgencies({ status: "ACTIVE", per_page: 100 });
  const skuRows = skuQuery.data?.data ?? [];
  const agencyRows = agencyQuery.data?.data ?? [];
  const skuOptions = skuRows.map((sku) => ({
    value: sku.sku_id,
    label: `${sku.sku_code} · ${sku.sku_name}`,
  }));

  // Ô "SKU sản phẩm" ở dòng nhập tay: catalog có thể lên tới hàng trăm/nghìn
  // SKU nên KHÔNG được cắt cứng ở per_page như skuOptions phía trên (chỉ 100
  // dòng đầu — nhiều SKU sẽ không bao giờ hiện). Gõ-để-lọc gọi BE theo keyword
  // (ProductRepository::$searchable = sku_code/sku_name, LIKE cả 2 cột).
  const [skuKeyword, setSkuKeyword] = useState("");
  const skuSearchQuery = useMvpSkus({
    status: "ACTIVE",
    sku_type: "PRODUCT",
    keyword: skuKeyword.trim(),
    per_page: 50,
  });
  const skuSearchRows = skuSearchQuery.data?.data ?? [];
  const skuSearchOptions = skuSearchRows.map((sku) => ({
    value: sku.sku_id,
    label: `${sku.sku_code} · ${sku.sku_name}`,
  }));

  // Nhãn hiển thị của SKU ĐÃ CHỌN phải bền vững qua mọi lần gõ tìm — nếu chỉ
  // dựa vào skuSearchOptions (đổi theo keyword hiện tại), dòng đang không được
  // gõ sẽ mất nhãn ngay khi kết quả tìm kiếm của dòng khác không còn chứa SKU
  // đó (Autocomplete dùng chung 1 query keyword cho mọi dòng).
  const [skuLabelById, setSkuLabelById] = useState<Map<string, string>>(
    new Map(),
  );
  useEffect(() => {
    const merged = [...skuOptions, ...skuSearchOptions];
    if (merged.length === 0) return;
    setSkuLabelById((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const option of merged) {
        if (next.get(option.value) !== option.label) {
          next.set(option.value, option.label);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ cần re-run khi 2 danh sách nguồn đổi, không phải mọi lần skuOptions/skuSearchOptions tạo lại tham chiếu.
  }, [skuRows, skuSearchRows]);
  const agencyOptions = agencyRows.map((agency) => ({
    value: agency.agency_id,
    label: `${agency.agency_code} · ${agency.agency_name}`,
  }));

  const previewSkuIds = [
    ...new Set([
      ...(preview?.rows ?? [])
        .map((row) => text(row.normalized.sku_id))
        .filter(Boolean),
      ...Object.values(resolutions)
        .map((resolution) => resolution.sku_id ?? "")
        .filter(Boolean),
    ]),
  ];
  const availabilityQuery = useQuery({
    queryKey: ["mvp-outbound", "availability", preview?.id, previewSkuIds],
    enabled: previewSkuIds.length > 0,
    retry: false,
    queryFn: () => fetchAvailableQtyBySku(previewSkuIds),
  });

  const rowSkuId = (row: ImportRow): string =>
    resolutions[row.rowNo]?.sku_id || text(row.normalized.sku_id);

  const rowRequiredQty = (row: ImportRow): number =>
    resolutions[row.rowNo]?.required_qty ??
    Number(row.normalized.required_qty ?? 0);

  const resetAll = () => {
    setPreview(null);
    setPreviewPage(1);
    setResolutions({});
    setRecipientOverride({
      receiver_name: "",
      receiver_address: "",
      receiver_contact_phone: "",
    });
    setFile(null);
    setFileInputKey((key) => key + 1);
    setMode("manual");
    setRequestNo("");
    setAgencyId(null);
    setRecipientName("");
    setRecipientAddress("");
    setRecipientPhone("");
    setRequestDate("");
    setLines([createEmptyLine()]);
    setFieldErrors({ lines: {} });
  };

  const close = () => {
    resetAll();
    dialog.close();
  };

  const validateManualMutation = useMutation({
    mutationFn: async () => {
      // Validate client-side đã chạy TRƯỚC ở nút bấm (setFieldErrors) — ở đây
      // chỉ dựng dữ liệu và gọi dry-run BE.
      const rows: OutboundRequestRowInput[] = lines.map((line) => ({
        request_no: requestNo.trim(),
        request_date: requestDate || undefined,
        customer_name: recipientName.trim(),
        customer_address: recipientAddress.trim(),
        recipient_contact_phone: recipientPhone.trim() || undefined,
        sku_id: line.product_id,
        required_qty: Number(line.required_qty),
        agency_id: agencyId || null,
      }));
      return validateOutboundRequestRows(rows);
    },
    onSuccess: (result) => {
      setFieldErrors({ lines: {} });
      setPreview(result);
      setPreviewPage(1);
      if (result.status === "VALIDATED") {
        toast.success(t("outbound.intake.manualValid"));
      } else {
        toast.warning(t("outbound.intake.manualInvalid"));
      }
    },
    onError: (error) => {
      // Lỗi máy chủ/mạng (không phải lỗi từng ô) — báo qua toast, không dựng
      // lại khối lỗi tổng.
      toast.error(getApiErrorMessage(error, t("outbound.intake.manualError")));
    },
  });

  const handleValidateManual = () => {
    const errors = validateManualForm();
    setFieldErrors(errors);
    if (hasFieldErrors(errors)) return;
    validateManualMutation.mutate();
  };

  const validateFileMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error(t("outbound.intake.needFile"));
      return uploadOutboundRequestFile(file);
    },
    onSuccess: (result) => {
      setPreview(result);
      setPreviewPage(1);
      if (result.status === "VALIDATED") {
        toast.success(t("outbound.intake.excelValid"));
      } else {
        toast.warning(t("outbound.intake.excelInvalid"));
      }
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, t("outbound.intake.excelError")));
    },
  });

  const consumeMutation = useMutation({
    mutationFn: async () => {
      if (!preview) throw new Error(t("outbound.intake.needPreview"));
      const consumeLines = Object.entries(resolutions)
        .map(([rowNo, value]) => ({
          row_no: Number(rowNo),
          ...(value.sku_id ? { sku_id: value.sku_id } : {}),
          ...(value.required_qty ? { required_qty: value.required_qty } : {}),
        }))
        .filter((line) => line.sku_id || line.required_qty);
      const recipient = Object.fromEntries(
        Object.entries(recipientOverride).filter(
          ([, value]) => value.trim() !== "",
        ),
      );
      return consumeOutboundImport(
        preview.id,
        makeKey("confirm-outbound"),
        preview.version,
        {
          ...(consumeLines.length ? { lines: consumeLines } : {}),
          ...recipient,
        },
      );
    },
    onSuccess: (result) => {
      toast.success(
        t("outbound.intake.created", {
          requests: result.outboundRequestIds.length,
          documents: result.outboundDocumentIds.length,
        }),
      );
      const ids = result.outboundDocumentIds;
      resetAll();
      onConsumed(ids);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, t("outbound.intake.createError")));
    },
  });

  const handleAgencyChange = (nextAgencyId: string | null) => {
    setAgencyId(nextAgencyId);
    const agency: AgencyRecord | undefined = nextAgencyId
      ? agencyRows.find((row) => row.agency_id === nextAgencyId)
      : undefined;
    if (!agency) return;
    setRecipientName(agency.agency_name);
    setRecipientAddress(agency.address ?? "");
  };

  const updateLine = (index: number, patch: Partial<LineInput>) => {
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  };

  const previewColumns: ResponsiveTableColumn<ImportRow>[] = [
    {
      key: "rowNo",
      header: t("outbound.intake.colRow"),
      width: 70,
      render: (row) => row.rowNo,
    },
    {
      key: "request",
      header: t("outbound.intake.colRequestNo"),
      width: 170,
      render: (row) => text(row.normalized.request_no, "-"),
    },
    {
      key: "recipient",
      header: t("outbound.intake.colRecipient"),
      width: 180,
      render: (row) =>
        text(
          row.normalized.recipient_name ?? row.normalized.customer_name,
          "-",
        ),
    },
    {
      key: "sku",
      header: "SKU",
      width: 220,
      render: (row) =>
        text(row.normalized.sku_code ?? row.normalized.sku_id, "-"),
    },
    {
      key: "sku_mapping",
      header: t("outbound.intake.colReassignSku"),
      width: 260,
      render: (row) => (
        <UiSelect
          aria-label={t("outbound.intake.reassignAria", { row: row.rowNo })}
          placeholder={t("outbound.intake.keepAsIs")}
          minWidth={240}
          value={resolutions[row.rowNo]?.sku_id ?? ""}
          onChange={(value) =>
            setResolutions((current) => ({
              ...current,
              [row.rowNo]: {
                ...current[row.rowNo],
                sku_id: value || undefined,
              },
            }))
          }
          options={skuOptions}
        />
      ),
    },
    {
      key: "qty",
      header: t("outbound.intake.colRequiredQty"),
      width: 140,
      align: "right",
      render: (row) => (
        <UiTextField
          type="number"
          sx={{ width: 110 }}
          slotProps={{
            htmlInput: {
              min: 1,
              step: 1,
              "aria-label": t("outbound.intake.requiredQtyAria", {
                row: row.rowNo,
              }),
            },
          }}
          value={
            resolutions[row.rowNo]?.required_qty ??
            (Number(row.normalized.required_qty ?? 0) || "")
          }
          onChange={(event) => {
            const parsed = Number(event.target.value);
            setResolutions((current) => ({
              ...current,
              [row.rowNo]: {
                ...current[row.rowNo],
                required_qty: parsed ? parsed : undefined,
              },
            }));
          }}
        />
      ),
    },
    {
      key: "available",
      header: t("outbound.intake.colAvailable"),
      width: 180,
      align: "right",
      render: (row) => {
        const skuId = rowSkuId(row);
        const available = skuId ? availabilityQuery.data?.[skuId] : undefined;
        if (available === undefined) {
          return (
            <Box sx={{ typography: "body2", color: "text.secondary" }}>
              {availabilityQuery.isLoading
                ? "…"
                : t("outbound.intake.noAvailability")}
            </Box>
          );
        }
        const required = rowRequiredQty(row);
        return (
          <Stack
            direction="row"
            spacing={0.5}
            sx={{ alignItems: "center", justifyContent: "flex-end" }}
          >
            <span>{available}</span>
            {row.errors.length === 0 ? (
              <UiStatusBadge
                tone={available >= required ? "success" : "warning"}
                label={
                  available >= required
                    ? t("outbound.intake.enoughNow")
                    : t("outbound.intake.shortNow")
                }
              />
            ) : null}
          </Stack>
        );
      },
    },
    {
      key: "result",
      header: t("outbound.intake.colCheckResult"),
      width: 220,
      render: (row) => {
        if (row.errors.length > 0) {
          return (
            <Box sx={{ typography: "body2", color: "error.main" }}>
              {rowErrorText(row, t)}
            </Box>
          );
        }

        const skuId = rowSkuId(row);
        const available = skuId ? availabilityQuery.data?.[skuId] : undefined;
        const required = rowRequiredQty(row);
        if (available !== undefined && available < required) {
          return (
            <UiStatusBadge
              tone="warning"
              label={t("outbound.intake.validButShort")}
            />
          );
        }

        return (
          <UiStatusBadge tone="success" label={t("outbound.intake.valid")} />
        );
      },
    },
  ];

  const overridePhoneValid =
    recipientOverride.receiver_contact_phone === "" ||
    /^0\d{9}$/.test(recipientOverride.receiver_contact_phone);
  const consumable = Boolean(preview) && canImport && overridePhoneValid;

  const previewRows = preview?.rows ?? [];
  const previewPaged = previewRows.length > PREVIEW_PAGE_SIZE;
  const pagedPreviewRows = previewPaged
    ? previewRows.slice(
        (previewPage - 1) * PREVIEW_PAGE_SIZE,
        previewPage * PREVIEW_PAGE_SIZE,
      )
    : previewRows;

  return (
    <UiDialog
      {...dialog.dialogProps}
      open={open && dialog.open}
      onClose={close}
      maxWidth="lg"
      fullWidth
      title={
        <Box
          component="span"
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          {t("outbound.intake.title")}
          <ActionIconButton
            kind="close"
            label={t("common.close")}
            onClick={close}
          />
        </Box>
      }
      actions={
        <ActionButton kind="close" onClick={close}>
          {t("common.close")}
        </ActionButton>
      }
    >
      <Stack spacing={2}>
        <Stack direction="row" spacing={1.5}>
          <ActionButton
            kind="edit"
            onClick={() => {
              setMode("manual");
              setPreview(null);
            }}
          >
            {t("outbound.intake.tabManual")}
          </ActionButton>
          <ActionButton
            kind="import"
            onClick={() => {
              setMode("excel");
              setPreview(null);
            }}
          >
            {t("outbound.intake.tabExcel")}
          </ActionButton>
        </Stack>

        {mode === "manual" ? (
          <Stack spacing={2}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <UiTextField
                  required
                  fullWidth
                  label={t("outbound.intake.fieldRequestNo")}
                  placeholder="VD: REQ-20260813-001"
                  value={requestNo}
                  onChange={(event) => {
                    setRequestNo(event.target.value);
                    clearFieldError("requestNo");
                  }}
                  error={Boolean(fieldErrors.requestNo)}
                  helperText={fieldErrors.requestNo}
                  slotProps={{ htmlInput: { maxLength: 80 } }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <UiSelect
                  fullWidth
                  label={t("outbound.intake.fieldAgency")}
                  placeholder={t("outbound.intake.fieldAgencyPlaceholder")}
                  value={agencyId ?? ""}
                  onChange={(value) => handleAgencyChange(value || null)}
                  options={agencyOptions}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <UiTextField
                  required
                  fullWidth
                  label={t("outbound.intake.fieldRecipient")}
                  value={recipientName}
                  onChange={(event) => {
                    setRecipientName(event.target.value);
                    clearFieldError("recipientName");
                  }}
                  error={Boolean(fieldErrors.recipientName)}
                  helperText={fieldErrors.recipientName}
                  slotProps={{ htmlInput: { maxLength: 200 } }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <UiTextField
                  fullWidth
                  label={t("outbound.intake.fieldAddress")}
                  value={recipientAddress}
                  onChange={(event) => setRecipientAddress(event.target.value)}
                  slotProps={{ htmlInput: { maxLength: 1000 } }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <UiTextField
                  fullWidth
                  label={t("outbound.intake.fieldPhone")}
                  placeholder="VD: 0901234567"
                  value={recipientPhone}
                  onChange={(event) => {
                    setRecipientPhone(
                      event.target.value.replace(/\D/g, "").slice(0, 10),
                    );
                    clearFieldError("recipientPhone");
                  }}
                  error={
                    Boolean(fieldErrors.recipientPhone) ||
                    (Boolean(recipientPhone) &&
                      !/^0\d{9}$/.test(recipientPhone))
                  }
                  helperText={
                    fieldErrors.recipientPhone ??
                    (Boolean(recipientPhone) && !/^0\d{9}$/.test(recipientPhone)
                      ? t("outbound.intake.errPhone")
                      : undefined)
                  }
                  slotProps={{
                    htmlInput: { maxLength: 10, inputMode: "numeric" },
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <UiTextField
                  fullWidth
                  type="date"
                  label={t("outbound.intake.fieldRequestDate")}
                  value={requestDate}
                  onChange={(event) => setRequestDate(event.target.value)}
                  slotProps={{
                    inputLabel: { shrink: true },
                    htmlInput: { max: dayjs().format("YYYY-MM-DD") },
                  }}
                  helperText={t("outbound.intake.dateHelper")}
                />
              </Grid>
            </Grid>

            <Stack spacing={1.5}>
              <AnimatedList>
                {lines.map((line, index) => (
                  <AnimatedListItem key={line.key} gap={12}>
                    <Stack
                      direction="row"
                      spacing={1.5}
                      sx={{
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                        rowGap: 1,
                      }}
                    >
                      <Autocomplete
                        size="small"
                        sx={{ minWidth: 380 }}
                        options={skuSearchOptions}
                        value={
                          line.product_id
                            ? {
                                value: line.product_id,
                                label:
                                  skuLabelById.get(line.product_id) ??
                                  line.product_id,
                              }
                            : null
                        }
                        onChange={(_event, next) => {
                          updateLine(index, { product_id: next?.value ?? "" });
                          clearLineError(index);
                        }}
                        onInputChange={(_event, value, reason) => {
                          if (reason === "input") setSkuKeyword(value);
                        }}
                        getOptionLabel={(option) => option.label}
                        isOptionEqualToValue={(option, val) =>
                          option.value === val.value
                        }
                        loading={skuSearchQuery.isFetching}
                        noOptionsText={
                          skuKeyword.trim()
                            ? t("outbound.intake.skuNoMatch")
                            : t("outbound.intake.skuTypeToSearch")
                        }
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            required
                            label={t("outbound.intake.fieldSku")}
                            placeholder={t(
                              "outbound.intake.fieldSkuPlaceholder",
                            )}
                            error={Boolean(
                              fieldErrors.lines[index]?.product_id,
                            )}
                            helperText={
                              fieldErrors.lines[index]?.product_id ||
                              t("outbound.intake.skuHelper")
                            }
                          />
                        )}
                      />
                      <UiTextField
                        required
                        type="number"
                        label={t("outbound.intake.fieldQty")}
                        value={line.required_qty}
                        onChange={(event) => {
                          updateLine(index, {
                            required_qty: Math.max(
                              1,
                              Math.trunc(Number(event.target.value) || 1),
                            ),
                          });
                          clearLineError(index);
                        }}
                        error={Boolean(fieldErrors.lines[index]?.required_qty)}
                        helperText={fieldErrors.lines[index]?.required_qty}
                        sx={{ width: 130 }}
                        slotProps={{ htmlInput: { min: 1, step: 1 } }}
                      />
                      <ActionButton
                        kind="delete"
                        disabled={lines.length === 1}
                        onClick={() =>
                          setLines((current) =>
                            current.filter((_, i) => i !== index),
                          )
                        }
                        sx={{ mt: "8px" }}
                      >
                        {t("outbound.intake.removeLine")}
                      </ActionButton>
                    </Stack>
                  </AnimatedListItem>
                ))}
              </AnimatedList>
              <Box>
                <ActionButton
                  kind="create"
                  onClick={() =>
                    setLines((current) => [...current, createEmptyLine()])
                  }
                >
                  {t("outbound.intake.addLine")}
                </ActionButton>
              </Box>
            </Stack>

            <Stack
              direction="row"
              spacing={1.5}
              sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}
            >
              <ActionButton
                kind="view"
                disabled={!canImport || validateManualMutation.isPending}
                onClick={handleValidateManual}
              >
                {validateManualMutation.isPending
                  ? t("outbound.intake.validating")
                  : t("outbound.intake.validate")}
              </ActionButton>
              <Box sx={{ typography: "body2", color: "text.secondary" }}>
                {t("outbound.intake.manualHint")}
              </Box>
            </Stack>
          </Stack>
        ) : (
          <Stack spacing={1.5}>
            <input
              key={fileInputKey}
              type="file"
              accept=".xlsx,.xls"
              aria-label={t("outbound.intake.fileAria")}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <Box sx={{ typography: "body2", color: "text.secondary" }}>
              {t("outbound.intake.fileHint")}
            </Box>
            <Box>
              <ActionButton
                kind="upload"
                disabled={!canImport || !file || validateFileMutation.isPending}
                onClick={() => validateFileMutation.mutate()}
              >
                {validateFileMutation.isPending
                  ? t("outbound.intake.uploading")
                  : t("outbound.intake.upload")}
              </ActionButton>
            </Box>
            <ApiErrorAlert
              error={validateFileMutation.error}
              title={t("outbound.intake.uploadErrorTitle")}
            />
          </Stack>
        )}

        {preview ? (
          <Box
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              p: 2,
            }}
          >
            <Box
              sx={{
                typography: "subtitle2",
                fontWeight: 700,
                mb: 1.5,
                display: "flex",
                alignItems: "center",
                gap: 0.5,
              }}
            >
              {t("outbound.intake.previewTitle")}{" "}
              {preview.importNo || <CopyableId value={preview.id} />}
            </Box>
            <Stack spacing={1.5}>
              <Stack
                direction="row"
                spacing={1.5}
                sx={{ flexWrap: "wrap", rowGap: 1, alignItems: "center" }}
              >
                <UiStatusBadge
                  tone={IMPORT_STATUS_TONE[preview.status] ?? "neutral"}
                  label={
                    IMPORT_STATUS_LABEL[preview.status]
                      ? t(IMPORT_STATUS_LABEL[preview.status])
                      : t("outbound.intake.statusUnknown")
                  }
                />
                <Box sx={{ typography: "body2" }}>
                  {t("outbound.intake.previewTotal", {
                    count: preview.totalRows,
                  })}
                </Box>
                <Box sx={{ typography: "body2", color: "success.main" }}>
                  {t("outbound.intake.previewValid", {
                    count: preview.validRows,
                  })}
                </Box>
                <Box
                  sx={{
                    typography: "body2",
                    color:
                      preview.errorRows > 0 ? "error.main" : "text.primary",
                  }}
                >
                  {t("outbound.intake.previewErrors", {
                    count: preview.errorRows,
                  })}
                </Box>
              </Stack>
              {/* Bảng xem trước lấy từ kết quả kiểm tra (mutation, không phải
                  query) — hiện loading khi đang kiểm tra lại dữ liệu/tệp. */}
              <ResponsiveDataTable<ImportRow>
                columns={previewColumns}
                rows={pagedPreviewRows}
                rowKey={(row) => row.id}
                loading={
                  validateManualMutation.isPending ||
                  validateFileMutation.isPending
                }
                emptyText={t("outbound.intake.previewEmpty")}
              />
              {previewPaged ? (
                <UiPagination
                  page={previewPage}
                  pageSize={PREVIEW_PAGE_SIZE}
                  total={previewRows.length}
                  showTotal={false}
                  onPageChange={setPreviewPage}
                />
              ) : null}

              <Stack
                direction="row"
                spacing={1.5}
                sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}
              >
                <ActionButton
                  kind="confirm"
                  disabled={!consumable || consumeMutation.isPending}
                  onClick={() => consumeMutation.mutate()}
                >
                  {consumeMutation.isPending
                    ? t("outbound.intake.confirming")
                    : t("outbound.intake.confirm")}
                </ActionButton>
                {!consumable ? (
                  <Box sx={{ typography: "body2", color: "text.secondary" }}>
                    {!canImport
                      ? t("outbound.intake.noPermission")
                      : t("outbound.intake.stillInvalid")}
                  </Box>
                ) : null}
              </Stack>
              <ApiErrorAlert
                error={consumeMutation.error}
                title={t("outbound.intake.confirmErrorTitle")}
              />
            </Stack>
          </Box>
        ) : null}
      </Stack>
    </UiDialog>
  );
}
