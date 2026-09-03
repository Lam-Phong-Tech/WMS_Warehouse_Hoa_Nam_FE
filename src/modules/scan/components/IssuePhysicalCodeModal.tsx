import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Grid,
  MenuItem,
  UiAlert,
  UiDialog,
  UiStatusBadge,
  UiTextField,
} from "@/shared/ui";
import { toast } from "sonner";
import { useMvpSkus } from "@/modules/master-data/hooks/use-mvp-master";
import { getApiErrorMessage, resolveFormErrors } from "@/shared/api/api-error";
import { guardBackdropClose } from "@/shared/utils/dialogGuard";
import {
  ITEM_STATUS_LABELS,
  MASTER_STATUS_LABELS,
  businessLabel,
} from "@/shared/constants/business-labels";
import { CopyableId } from "@/shared/components/data-display/CopyableId";
import { issueItemPhysicalCode } from "../services/scanService";
import type {
  IssueItemPhysicalCodeResult,
  IssuePhysicalCodeCarrierType,
} from "../types";
import type { ReactNode } from "react";
import { ActionButton } from "@/shared/components/actions";
import { useT, type TranslateFn } from "@/shared/i18n/useT";

interface IssuePhysicalCodeModalProps {
  open: boolean;
  onClose: () => void;
  onIssued?: (result: IssueItemPhysicalCodeResult) => void;
}

function carrierOptions(t: TranslateFn): Array<{
  value: IssuePhysicalCodeCarrierType;
  label: string;
}> {
  return [
    { value: "QR", label: "QR" },
    { value: "BARCODE", label: t("scan.carrierBarcode") },
  ];
}

function carrierLabel(t: TranslateFn, value: IssuePhysicalCodeCarrierType) {
  return value === "BARCODE" ? t("scan.carrierBarcode") : "QR";
}

/**
 * Các trường có ô hiển thị lỗi riêng trên form (`error` + `helperText`).
 * Tên đã trùng với tên trường payload sau khi đổi sang camelCase
 * (`sku_id`/`carrier_type`/`code_value`/`serial_number`), nên lỗi server gắn
 * thẳng được vào ô. CHỈ liệt kê ô thật sự có chỗ hiện lỗi — liệt kê dư sẽ làm
 * lỗi biến mất im lặng thay vì rơi xuống toast.
 */
const ISSUE_FORM_FIELDS = [
  "skuId",
  "carrierType",
  "codeValue",
  "serialNumber",
] as const;

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Grid size={{ xs: 12, sm: 6 }}>
      <Box
        sx={{
          typography: "caption",
          color: "text.secondary",
          display: "block",
        }}
      >
        {label}
      </Box>
      <Box sx={{ typography: "body2" }}>{value}</Box>
    </Grid>
  );
}

export function IssuePhysicalCodeModal({
  open,
  onClose,
  onIssued,
}: IssuePhysicalCodeModalProps) {
  const t = useT();
  const [skuId, setSkuId] = useState<string | null>(null);
  const [carrierType, setCarrierType] =
    useState<IssuePhysicalCodeCarrierType>("QR");
  const [codeValue, setCodeValue] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();

  const skuQuery = useMvpSkus({
    status: "ACTIVE",
    sku_type: "PRODUCT",
    per_page: 200,
  });
  const skuOptions = useMemo(
    () =>
      (skuQuery.data?.data ?? [])
        .filter((sku) => sku.is_serial_tracked)
        .map((sku) => ({
          value: sku.sku_id,
          label: `${sku.sku_code} — ${sku.sku_name}`,
        })),
    [skuQuery.data],
  );

  const issueMutation = useMutation({
    mutationFn: (values: {
      sku_id: string;
      carrier_type: IssuePhysicalCodeCarrierType;
      code_value?: string;
      serial_number?: string;
    }) =>
      issueItemPhysicalCode({
        skuId: values.sku_id,
        carrier_type: values.carrier_type,
        code_value: values.code_value,
        serial_number: values.serial_number,
      }),
    onSuccess: (result) => {
      toast.success(t("scan.issue.created", { code: result.code_value }));
      queryClient.invalidateQueries({ queryKey: ["scan"] });
      onIssued?.(result);
      resetForm();
    },
    onError: (error: unknown) => {
      // Lỗi nhập liệu từ server hiện ngay dưới ô sai; `message` chỉ còn phần
      // không gắn được vào ô nào — `null` nghĩa là đã gắn hết, lúc đó bỏ toast
      // tổng đi thay vì lặp lại câu chung chung.
      const { fieldErrors: serverFieldErrors, message } = resolveFormErrors(
        error,
        ISSUE_FORM_FIELDS,
      );
      const hasFieldErrors = Object.keys(serverFieldErrors).length > 0;
      setFieldErrors((current) => ({ ...current, ...serverFieldErrors }));
      if (message !== null) {
        toast.error(
          hasFieldErrors
            ? message
            : getApiErrorMessage(error, t("scan.issue.createFailed")),
        );
      }
    },
  });

  const resetForm = () => {
    setSkuId(null);
    setCarrierType("QR");
    setCodeValue("");
    setSerialNumber("");
    setFieldErrors({});
  };

  const handleClose = () => {
    if (issueMutation.isPending) return;
    issueMutation.reset();
    resetForm();
    onClose();
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!skuId) {
      errors.skuId = t("scan.issue.skuRequired");
    }
    if (codeValue.length > 200) {
      errors.codeValue = t("scan.issue.codeMax");
    }
    if (serialNumber.length > 100) {
      errors.serialNumber = t("scan.issue.serialMax");
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm() || !skuId) return;
    issueMutation.mutate({
      sku_id: skuId,
      carrier_type: carrierType,
      code_value: codeValue.trim() || undefined,
      serial_number: serialNumber.trim() || undefined,
    });
  };

  const result = issueMutation.data;

  return (
    <UiDialog
      open={open}
      onClose={guardBackdropClose(handleClose)}
      maxWidth="sm"
      fullWidth
      title={t("scan.issue.title")}
      actions={
        result ? (
          <ActionButton kind="close" onClick={handleClose}>
            {t("common.close")}
          </ActionButton>
        ) : (
          <>
            <ActionButton
              kind="cancel"
              onClick={handleClose}
              disabled={issueMutation.isPending}
            >
              {t("scan.issue.cancel")}
            </ActionButton>
            <ActionButton
              kind="create"
              onClick={handleSubmit}
              disabled={issueMutation.isPending}
            >
              {issueMutation.isPending
                ? t("scan.issue.creating")
                : t("scan.issue.submit")}
            </ActionButton>
          </>
        )
      }
    >
      <Box sx={{ mb: 2 }}>
        <UiAlert tone="info" title={t("scan.issue.alertTitle")}>
          {t("scan.issue.alertBody")}
        </UiAlert>
      </Box>

      {result ? (
        <Grid container spacing={2}>
          {/* Trước đây nhãn ghi "Mã sản phẩm" nhưng in item_id (UUID nội bộ) —
            vừa sai nhãn vừa lộ chuỗi thô, trong khi mã nhận diện thật của sản
            phẩm chính là "Giá trị mã" + "Số sê-ri" ngay bên dưới. Giữ giá trị
            để tra soát nhưng gọi đúng tên và hiển thị rút gọn. */}
          <DetailField
            label={t("scan.issue.fieldInternalId")}
            value={<CopyableId value={result.item_id} />}
          />
          <DetailField
            label={t("scan.issue.fieldCodeValue")}
            value={<UiStatusBadge tone="info" label={result.code_value} />}
          />
          <DetailField
            label={t("scan.issue.fieldCarrier")}
            value={carrierLabel(t, result.carrier_type)}
          />
          <DetailField
            label={t("scan.issue.fieldSerial")}
            value={result.serial_number}
          />
          <DetailField
            label={t("scan.issue.fieldItemStatus")}
            value={businessLabel(
              ITEM_STATUS_LABELS,
              result.item_status,
              t("scan.statusOther"),
            )}
          />
          <DetailField
            label={t("scan.issue.fieldCodeStatus")}
            value={businessLabel(
              MASTER_STATUS_LABELS,
              result.status,
              t("scan.statusOther"),
            )}
          />
        </Grid>
      ) : (
        <Grid container spacing={2}>
          <Grid size={12}>
            <UiTextField
              select
              required
              fullWidth
              label={t("scan.issue.skuLabel")}
              value={skuId ?? ""}
              onChange={(event) => {
                setSkuId(event.target.value || null);
                if (fieldErrors.skuId) {
                  setFieldErrors((current) => ({ ...current, skuId: "" }));
                }
              }}
              error={Boolean(fieldErrors.skuId)}
              helperText={fieldErrors.skuId}
            >
              <MenuItem value="" disabled>
                {t("scan.issue.skuPlaceholder")}
              </MenuItem>
              {skuOptions.length === 0 ? (
                <MenuItem value="__empty__" disabled>
                  {skuQuery.isLoading
                    ? t("scan.issue.loading")
                    : t("scan.issue.skuEmpty")}
                </MenuItem>
              ) : null}
              {skuOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </UiTextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <UiTextField
              select
              required
              fullWidth
              label={t("scan.issue.fieldCarrier")}
              value={carrierType}
              onChange={(event) => {
                setCarrierType(
                  event.target.value as IssuePhysicalCodeCarrierType,
                );
                if (fieldErrors.carrierType) {
                  setFieldErrors((current) => ({
                    ...current,
                    carrierType: "",
                  }));
                }
              }}
              // Trường bắt buộc gửi lên server nên phải có chỗ hiện lỗi
              // riêng, nếu không lỗi của nó chỉ còn đường rơi vào toast.
              error={Boolean(fieldErrors.carrierType)}
              helperText={fieldErrors.carrierType}
            >
              {carrierOptions(t).map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </UiTextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <UiTextField
              fullWidth
              label={t("scan.issue.codeValueLabel")}
              placeholder={t("scan.issue.codeValuePlaceholder")}
              value={codeValue}
              onChange={(event) => {
                setCodeValue(event.target.value);
                if (fieldErrors.codeValue) {
                  setFieldErrors((current) => ({
                    ...current,
                    codeValue: "",
                  }));
                }
              }}
              error={Boolean(fieldErrors.codeValue)}
              helperText={fieldErrors.codeValue}
              slotProps={{ htmlInput: { maxLength: 200 } }}
            />
          </Grid>
          <Grid size={12}>
            <UiTextField
              fullWidth
              label={t("scan.issue.serialLabel")}
              placeholder={t("scan.issue.serialPlaceholder")}
              value={serialNumber}
              onChange={(event) => {
                setSerialNumber(event.target.value);
                if (fieldErrors.serialNumber) {
                  setFieldErrors((current) => ({
                    ...current,
                    serialNumber: "",
                  }));
                }
              }}
              error={Boolean(fieldErrors.serialNumber)}
              helperText={fieldErrors.serialNumber}
              slotProps={{ htmlInput: { maxLength: 100 } }}
            />
          </Grid>
        </Grid>
      )}
    </UiDialog>
  );
}
