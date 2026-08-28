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
import { issueItemPhysicalCode } from "../services/scanService";
import type {
  IssueItemPhysicalCodeResult,
  IssuePhysicalCodeCarrierType,
} from "../types";
import type { ReactNode } from "react";
import { ActionButton } from "@/shared/components/actions";

interface IssuePhysicalCodeModalProps {
  open: boolean;
  onClose: () => void;
  onIssued?: (result: IssueItemPhysicalCodeResult) => void;
}

const CARRIER_OPTIONS: Array<{
  value: IssuePhysicalCodeCarrierType;
  label: string;
}> = [
  { value: "QR", label: "QR" },
  { value: "BARCODE", label: "Mã vạch" },
];

function carrierLabel(value: IssuePhysicalCodeCarrierType) {
  return value === "BARCODE" ? "Mã vạch" : "QR";
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
      toast.success(`Đã tạo mã ${result.code_value} cho sản phẩm mới.`);
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
            : getApiErrorMessage(error, "Không thể tạo mã vật lý mới."),
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
      errors.skuId = "Vui lòng chọn SKU";
    }
    if (codeValue.length > 200) {
      errors.codeValue = "Giá trị mã tối đa 200 ký tự";
    }
    if (serialNumber.length > 100) {
      errors.serialNumber = "Số sê-ri tối đa 100 ký tự";
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
      title="Tạo mã vật lý mới"
      actions={
        result ? (
          <ActionButton kind="close" onClick={handleClose}>
            Đóng
          </ActionButton>
        ) : (
          <>
            <ActionButton
              kind="cancel"
              onClick={handleClose}
              disabled={issueMutation.isPending}
            >
              Hủy
            </ActionButton>
            <ActionButton
              kind="create"
              onClick={handleSubmit}
              disabled={issueMutation.isPending}
            >
              {issueMutation.isPending ? "Đang tạo..." : "Tạo mã"}
            </ActionButton>
          </>
        )
      }
    >
      <Box sx={{ mb: 2 }}>
        <UiAlert tone="info" title="Tạo mã không làm thay đổi tồn kho">
          Hệ thống tạo một sản phẩm cụ thể kèm mã vật lý mới. Thao tác này chỉ
          tạo thông tin nhận diện, chưa làm tăng hoặc giảm tồn kho. Chỉ áp dụng
          cho SKU sản phẩm có quản lý số sê-ri.
        </UiAlert>
      </Box>

      {result ? (
        <Grid container spacing={2}>
          <DetailField label="Mã sản phẩm" value={result.item_id} />
          <DetailField
            label="Giá trị mã"
            value={<UiStatusBadge tone="info" label={result.code_value} />}
          />
          <DetailField
            label="Hình thức mã"
            value={carrierLabel(result.carrier_type)}
          />
          <DetailField label="Số sê-ri" value={result.serial_number} />
          <DetailField
            label="Trạng thái sản phẩm"
            value={businessLabel(
              ITEM_STATUS_LABELS,
              result.item_status,
              "Trạng thái khác",
            )}
          />
          <DetailField
            label="Trạng thái mã"
            value={businessLabel(
              MASTER_STATUS_LABELS,
              result.status,
              "Trạng thái khác",
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
              label="SKU sản phẩm có quản lý số sê-ri"
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
                Chọn SKU...
              </MenuItem>
              {skuOptions.length === 0 ? (
                <MenuItem value="__empty__" disabled>
                  {skuQuery.isLoading
                    ? "Đang tải..."
                    : "Không có SKU sản phẩm đang sử dụng và có quản lý số sê-ri"}
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
              label="Hình thức mã"
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
              {CARRIER_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </UiTextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <UiTextField
              fullWidth
              label="Giá trị mã (bỏ trống để hệ thống tự sinh)"
              placeholder="Ví dụ: SP-0001-20260822-AB12"
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
              label="Số sê-ri (bỏ trống để hệ thống tự sinh)"
              placeholder="Ví dụ: SN-SP-0001-8F3C1A2B"
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
