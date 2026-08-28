import { useState } from "react";
import {
  Box,
  Grid,
  MenuItem,
  Stack,
  UiAlert,
  UiDialog,
  UiPagination,
  UiSelect,
  UiStatusBadge,
  UiTextField,
  type UiStatusTone,
} from "@/shared/ui";
import dayjs from "dayjs";
import { toast } from "sonner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getApiErrorMessage } from "@/shared/api/api-error";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import {
  ResponsiveDataTable,
  type ResponsiveTableColumn,
} from "@/shared/components/data-display/ResponsiveDataTable";
import {
  useMvpAgencies,
  useMvpSkus,
} from "@/modules/master-data/hooks/use-mvp-master";
import type { AgencyRecord } from "@/modules/master-data/types/mvp-master.types";
import { useDialogExit } from "@/shared/utils/useDialogExit";
import {
  consumeOutboundImport,
  fetchAvailableQtyBySku,
  uploadOutboundRequestFile,
  validateOutboundRequestRows,
  type OutboundImportResult,
  type OutboundRequestRowInput,
} from "@/modules/outbound/services/mvpOutboundService";
import { ActionButton, ActionIconButton } from "@/shared/components/actions";

type IntakeMode = "manual" | "excel";

interface LineInput {
  product_id: string;
  required_qty: number;
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

function rowErrorText(row: ImportRow): string {
  return row.errors
    .map(
      (error) =>
        `${error.field ?? `dòng ${error.row ?? row.rowNo}`}: ${error.message ?? error.error_code ?? "Lỗi"}`,
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

const IMPORT_STATUS_LABEL: Record<string, string> = {
  UPLOADED: "Đã tải lên",
  VALIDATED: "Dữ liệu hợp lệ",
  REJECTED: "Có lỗi dữ liệu",
  CONSUMED: "Đã tạo phiếu",
};

/** Bảng xem trước phân trang client-side như antd Table cũ (pageSize 10). */
const PREVIEW_PAGE_SIZE = 10;

export function OutboundIntakeModal({
  open,
  canImport,
  onClose,
  onConsumed,
}: OutboundIntakeModalProps) {
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
  const [lines, setLines] = useState<LineInput[]>([
    { product_id: "", required_qty: 1 },
  ]);
  const [formError, setFormError] = useState<string | null>(null);

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
    setLines([{ product_id: "", required_qty: 1 }]);
    setFormError(null);
  };

  const close = () => {
    resetAll();
    dialog.close();
  };

  const validateManualMutation = useMutation({
    mutationFn: async () => {
      if (!requestNo.trim()) {
        throw new Error("__FORM__Nhập mã phiếu yêu cầu xuất");
      }
      if (!recipientName.trim()) {
        throw new Error("__FORM__Nhập người nhận");
      }
      if (recipientPhone && !/^0\d{9}$/.test(recipientPhone)) {
        throw new Error(
          "__FORM__Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0.",
        );
      }
      for (const line of lines) {
        if (!line.product_id) {
          throw new Error("__FORM__Chọn SKU cho tất cả các dòng");
        }
        if (!line.required_qty || line.required_qty < 1) {
          throw new Error("__FORM__Nhập số lượng cho tất cả các dòng");
        }
      }
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
      setFormError(null);
      setPreview(result);
      setPreviewPage(1);
      if (result.status === "VALIDATED") {
        toast.success(
          "Dữ liệu yêu cầu xuất hợp lệ để tiếp nhận. Tồn kho sẽ được kiểm tra lại khi quét và khi hoàn tất xuất kho.",
        );
      } else {
        toast.warning(
          "Dữ liệu còn lỗi bắt buộc — sửa theo từng dòng trước khi tạo phiếu xuất.",
        );
      }
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error);
      if (message.startsWith("__FORM__")) {
        setFormError(message.replace("__FORM__", ""));
        return;
      }
      toast.error(
        getApiErrorMessage(error, "Xác nhận yêu cầu xuất kho thất bại."),
      );
    },
  });

  const validateFileMutation = useMutation({
    mutationFn: async () => {
      if (!file)
        throw new Error("Chọn tệp Excel (.xlsx/.xls) trước khi kiểm tra.");
      return uploadOutboundRequestFile(file);
    },
    onSuccess: (result) => {
      setPreview(result);
      setPreviewPage(1);
      if (result.status === "VALIDATED") {
        toast.success(
          "Dữ liệu Excel hợp lệ để tiếp nhận. Tồn kho sẽ được kiểm tra lại khi quét và khi hoàn tất xuất kho.",
        );
      } else {
        toast.warning(
          "Tệp có dòng lỗi bắt buộc. Cả lô chưa được tạo phiếu cho tới khi các lỗi được xử lý.",
        );
      }
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Kiểm tra tệp thất bại."));
    },
  });

  const consumeMutation = useMutation({
    mutationFn: async () => {
      if (!preview) throw new Error("Chưa có dữ liệu nhập để xác nhận.");
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
        `Đã tạo ${result.outboundRequestIds.length} yêu cầu xuất và ${result.outboundDocumentIds.length} phiếu xuất nháp.`,
      );
      const ids = result.outboundDocumentIds;
      resetAll();
      onConsumed(ids);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Không thể tạo phiếu xuất kho."));
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
    { key: "rowNo", header: "Dòng", width: 70, render: (row) => row.rowNo },
    {
      key: "request",
      header: "Mã yêu cầu",
      width: 170,
      render: (row) => text(row.normalized.request_no, "-"),
    },
    {
      key: "recipient",
      header: "Người nhận",
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
      header: "Gán SKU khi xác nhận",
      width: 260,
      render: (row) => (
        <UiSelect
          aria-label={`Gán SKU khi xác nhận dòng ${row.rowNo}`}
          placeholder="Giữ nguyên theo tệp"
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
      header: "SL yêu cầu",
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
              "aria-label": `SL yêu cầu dòng ${row.rowNo}`,
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
      header: "Khả dụng hiện tại",
      width: 180,
      align: "right",
      render: (row) => {
        const skuId = rowSkuId(row);
        const available = skuId ? availabilityQuery.data?.[skuId] : undefined;
        if (available === undefined) {
          return (
            <Box sx={{ typography: "body2", color: "text.secondary" }}>
              {availabilityQuery.isLoading ? "…" : "Chưa có dữ liệu"}
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
                label={available >= required ? "Đủ hiện tại" : "Thiếu hiện tại"}
              />
            ) : null}
          </Stack>
        );
      },
    },
    {
      key: "result",
      header: "Kết quả kiểm tra",
      width: 220,
      render: (row) => {
        if (row.errors.length > 0) {
          return (
            <Box sx={{ typography: "body2", color: "error.main" }}>
              {rowErrorText(row)}
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
              label="Dữ liệu hợp lệ · Thiếu tồn hiện tại"
            />
          );
        }

        return <UiStatusBadge tone="success" label="Dữ liệu hợp lệ" />;
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
          OUT-REQ-01 · Tiếp nhận phiếu yêu cầu xuất
          <ActionIconButton kind="close" label="Đóng" onClick={close} />
        </Box>
      }
      actions={
        <ActionButton kind="close" onClick={close}>
          Đóng
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
            Nhập tay
          </ActionButton>
          <ActionButton
            kind="import"
            onClick={() => {
              setMode("excel");
              setPreview(null);
            }}
          >
            Nhập từ Excel
          </ActionButton>
        </Stack>

        {mode === "manual" ? (
          <Stack spacing={2}>
            {formError ? <UiAlert tone="error">{formError}</UiAlert> : null}
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <UiTextField
                  required
                  fullWidth
                  label="Mã phiếu yêu cầu xuất"
                  placeholder="VD: REQ-20260813-001"
                  value={requestNo}
                  onChange={(event) => setRequestNo(event.target.value)}
                  slotProps={{ htmlInput: { maxLength: 80 } }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <UiSelect
                  fullWidth
                  label="Đại lý / nơi nhận (tùy chọn)"
                  placeholder="Chọn đại lý để tự điền người nhận / địa chỉ"
                  value={agencyId ?? ""}
                  onChange={(value) => handleAgencyChange(value || null)}
                  options={agencyOptions}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <UiTextField
                  required
                  fullWidth
                  label="Người / nơi nhận"
                  value={recipientName}
                  onChange={(event) => setRecipientName(event.target.value)}
                  slotProps={{ htmlInput: { maxLength: 200 } }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <UiTextField
                  fullWidth
                  label="Địa chỉ nhận"
                  value={recipientAddress}
                  onChange={(event) => setRecipientAddress(event.target.value)}
                  slotProps={{ htmlInput: { maxLength: 1000 } }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <UiTextField
                  fullWidth
                  label="SĐT liên hệ"
                  placeholder="VD: 0901234567"
                  value={recipientPhone}
                  onChange={(event) =>
                    setRecipientPhone(
                      event.target.value.replace(/\D/g, "").slice(0, 10),
                    )
                  }
                  error={
                    Boolean(recipientPhone) && !/^0\d{9}$/.test(recipientPhone)
                  }
                  helperText={
                    Boolean(recipientPhone) && !/^0\d{9}$/.test(recipientPhone)
                      ? "Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0."
                      : undefined
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
                  label="Ngày xuất"
                  value={requestDate}
                  onChange={(event) => setRequestDate(event.target.value)}
                  slotProps={{
                    inputLabel: { shrink: true },
                    htmlInput: { max: dayjs().format("YYYY-MM-DD") },
                  }}
                  helperText="Định dạng: ngày/tháng/năm"
                />
              </Grid>
            </Grid>

            <Stack spacing={1.5}>
              {lines.map((line, index) => (
                <Stack
                  key={`line-${index}`}
                  direction="row"
                  spacing={1.5}
                  sx={{
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    rowGap: 1,
                  }}
                >
                  <UiTextField
                    select
                    required
                    label="SKU sản phẩm"
                    sx={{ minWidth: 380 }}
                    value={line.product_id}
                    onChange={(event) =>
                      updateLine(index, { product_id: event.target.value })
                    }
                  >
                    <MenuItem value="" disabled>
                      Chỉ SKU sản phẩm đang sử dụng
                    </MenuItem>
                    {skuQuery.isLoading && skuOptions.length === 0 ? (
                      <MenuItem value="__loading__" disabled>
                        Đang tải...
                      </MenuItem>
                    ) : null}
                    {skuOptions.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </UiTextField>
                  <UiTextField
                    required
                    type="number"
                    label="Số lượng"
                    value={line.required_qty}
                    onChange={(event) =>
                      updateLine(index, {
                        required_qty: Math.max(
                          1,
                          Math.trunc(Number(event.target.value) || 1),
                        ),
                      })
                    }
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
                    Xóa dòng
                  </ActionButton>
                </Stack>
              ))}
              <Box>
                <ActionButton
                  kind="create"
                  onClick={() =>
                    setLines((current) => [
                      ...current,
                      { product_id: "", required_qty: 1 },
                    ])
                  }
                >
                  Thêm dòng SKU
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
                onClick={() => validateManualMutation.mutate()}
              >
                {validateManualMutation.isPending
                  ? "Đang kiểm tra..."
                  : "Kiểm tra & xem trước"}
              </ActionButton>
              <Box sx={{ typography: "body2", color: "text.secondary" }}>
                Người nhận bắt buộc; địa chỉ/SĐT/ngày toa tùy chọn theo quy định
                hiện hành — thiếu thì nhãn đóng gói để trống trường tương ứng.
              </Box>
            </Stack>
            <ApiErrorAlert
              error={validateManualMutation.error}
              title="Không kiểm tra được yêu cầu xuất"
            />
          </Stack>
        ) : (
          <Stack spacing={1.5}>
            <input
              key={fileInputKey}
              type="file"
              accept=".xlsx,.xls"
              aria-label="Chọn tệp Excel yêu cầu xuất"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <Box sx={{ typography: "body2", color: "text.secondary" }}>
              Tên cột bắt buộc trong tệp: request_no · sku_code · required_qty ·
              recipient_name/customer_name. Cột tùy chọn: request_date ·
              recipient_address · recipient_contact_phone · note. Tối đa 10.000
              dòng, tệp ≤ 20MB; dòng lỗi có thể được xử lý ở bảng xem trước
              trước khi xác nhận.
            </Box>
            <Box>
              <ActionButton
                kind="upload"
                disabled={!canImport || !file || validateFileMutation.isPending}
                onClick={() => validateFileMutation.mutate()}
              >
                {validateFileMutation.isPending
                  ? "Đang tải lên..."
                  : "Tải lên & xem trước"}
              </ActionButton>
            </Box>
            <ApiErrorAlert
              error={validateFileMutation.error}
              title="Không kiểm tra được tệp Excel"
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
            <Box sx={{ typography: "subtitle2", fontWeight: 700, mb: 1.5 }}>
              {`Kết quả xem trước · ${preview.importNo || preview.id}`}
            </Box>
            <Stack spacing={1.5}>
              <Stack
                direction="row"
                spacing={1.5}
                sx={{ flexWrap: "wrap", rowGap: 1, alignItems: "center" }}
              >
                <UiStatusBadge
                  tone={IMPORT_STATUS_TONE[preview.status] ?? "neutral"}
                  label={IMPORT_STATUS_LABEL[preview.status] ?? "Chưa xác định"}
                />
                <Box sx={{ typography: "body2" }}>
                  Tổng: {preview.totalRows}
                </Box>
                <Box sx={{ typography: "body2", color: "success.main" }}>
                  Hợp lệ dữ liệu: {preview.validRows}
                </Box>
                <Box
                  sx={{
                    typography: "body2",
                    color:
                      preview.errorRows > 0 ? "error.main" : "text.primary",
                  }}
                >
                  Lỗi dữ liệu: {preview.errorRows}
                </Box>
              </Stack>
              <ResponsiveDataTable<ImportRow>
                columns={previewColumns}
                rows={pagedPreviewRows}
                rowKey={(row) => row.id}
                emptyText="Không có dòng dữ liệu nào"
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

              <Box
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  p: 1.5,
                }}
              >
                <Box sx={{ typography: "subtitle2", fontWeight: 700, mb: 1 }}>
                  Ghi đè người nhận khi xác nhận (tùy chọn)
                </Box>
                <Stack
                  direction="row"
                  spacing={1.5}
                  sx={{ flexWrap: "wrap", rowGap: 1.5 }}
                >
                  <UiTextField
                    label="Người nhận"
                    sx={{ width: 240 }}
                    slotProps={{ htmlInput: { maxLength: 200 } }}
                    value={recipientOverride.receiver_name}
                    onChange={(event) =>
                      setRecipientOverride((current) => ({
                        ...current,
                        receiver_name: event.target.value,
                      }))
                    }
                  />
                  <UiTextField
                    label="Địa chỉ nhận (tùy chọn)"
                    sx={{ width: 300 }}
                    slotProps={{ htmlInput: { maxLength: 1000 } }}
                    value={recipientOverride.receiver_address}
                    onChange={(event) =>
                      setRecipientOverride((current) => ({
                        ...current,
                        receiver_address: event.target.value,
                      }))
                    }
                  />
                  <UiTextField
                    label="SĐT liên hệ (tùy chọn)"
                    sx={{ width: 200 }}
                    error={!overridePhoneValid}
                    helperText={
                      overridePhoneValid
                        ? undefined
                        : "Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0."
                    }
                    slotProps={{
                      htmlInput: { maxLength: 10, inputMode: "numeric" },
                    }}
                    value={recipientOverride.receiver_contact_phone}
                    onChange={(event) =>
                      setRecipientOverride((current) => ({
                        ...current,
                        receiver_contact_phone: event.target.value
                          .replace(/\D/g, "")
                          .slice(0, 10),
                      }))
                    }
                  />
                </Stack>
              </Box>

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
                    ? "Đang xử lý..."
                    : "Xác nhận & tạo phiếu xuất nháp"}
                </ActionButton>
                {!consumable ? (
                  <Box sx={{ typography: "body2", color: "text.secondary" }}>
                    {!canImport
                      ? "Bạn không có quyền xác nhận yêu cầu xuất."
                      : "Còn dòng lỗi — gán SKU/số lượng hoặc sửa người nhận rồi xác nhận lại."}
                  </Box>
                ) : null}
              </Stack>
              <ApiErrorAlert
                error={consumeMutation.error}
                title="Không xác nhận được yêu cầu xuất"
              />
            </Stack>
          </Box>
        ) : null}
      </Stack>
    </UiDialog>
  );
}
