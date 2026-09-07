import { useState } from "react";
import {
  Box,
  Grid,
  Stack,
  UiAlert,
  UiAutocomplete,
  UiDialog,
  UiTextField,
} from "@/shared/ui";
import { toast } from "sonner";
import { getApiErrorMessage, resolveFormErrors } from "@/shared/api/api-error";
import { useDialogExit } from "@/shared/utils/useDialogExit";
import { useT } from "@/shared/i18n/useT";
import { ActionButton, ActionIconButton } from "@/shared/components/actions";
import { checkText, TEXT_RULES } from "@/shared/validation/text-rules";
import { useMvpProductCatalogs } from "@/modules/master-data/hooks/use-mvp-master";
import { useCompleteInboundLineSku } from "@/modules/inbound/hooks/use-inbound";
import type { CatalogRefRecord } from "@/modules/master-data/types/mvp-master.types";
import type { InboundLine } from "@/modules/inbound/types";

/** Khớp `unit max:30` của BE — chặn ngay ở ô nhập thay vì nhận 422 sau khi Lưu. */
const UNIT_MAX = 30;

interface FormValues {
  name: string;
  unit: string;
  brandId: string;
  categoryId: string;
  modelId: string;
  powerSourceId: string;
}

export interface InboundSkuInfoModalProps {
  documentId: string;
  line: InboundLine;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Tên form gửi lên là camelCase của tên trường payload (`extractFieldErrors` đã
 * chuyển sẵn), nên chỉ hai ô có chỗ hiện lỗi riêng mới được liệt kê ở đây; lỗi
 * của field khác rơi về banner tổng thay vì biến mất im lặng.
 */
const SERVER_FIELD_TO_FORM_FIELD: Record<string, keyof FormValues> = {
  skuName: "name",
  unit: "unit",
};

const SERVER_ERROR_FIELDS = Object.keys(SERVER_FIELD_TO_FORM_FIELD);

function refOptions(records: CatalogRefRecord[] | undefined) {
  return (records ?? []).map((record) => ({
    value: record.id,
    label: [record.code, record.name].filter(Boolean).join(" · ") || record.id,
  }));
}

/**
 * Bổ sung thông tin cho SKU MỚI ngay trong phiếu nhập đang quét.
 *
 * Chỉ đòi TÊN đọc được và ĐƠN VỊ TÍNH — hai thứ người nhận hàng nắm chắc. Bốn
 * danh mục (Thương hiệu/Nhóm hàng/Sê-ri/Nguồn điện) để tuỳ chọn: chúng phụ thuộc
 * dữ liệu danh mục có sẵn, mà nhân viên kho không có quyền thêm mục mới
 * (`catalog.manage`) — bắt buộc ở đây thì hàng thuộc sê-ri mới sẽ kẹt luôn không
 * nhập được. Phần bỏ trống hiện ở bộ lọc "SKU chờ điền thông tin" của màn Danh
 * mục SKU để người quản lý danh mục hoàn thiện sau.
 */
export function InboundSkuInfoModal({
  documentId,
  line,
  onClose,
  onSaved,
}: InboundSkuInfoModalProps) {
  const dialog = useDialogExit(onClose);
  const t = useT();
  const catalogsQuery = useMvpProductCatalogs();
  const completeMutation = useCompleteInboundLineSku();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // Tên tạm do hệ thống đặt bằng chính mã SKU không phải một cái tên — để trống
  // ô nhập để người dùng buộc phải gõ, thay vì tưởng đã có sẵn rồi bấm Lưu.
  const [formValues, setFormValues] = useState<FormValues>({
    name: line.skuName && line.skuName !== line.sku ? line.skuName : "",
    unit: line.productUnit,
    brandId: "",
    categoryId: "",
    modelId: "",
    powerSourceId: "",
  });

  const catalogs = catalogsQuery.data;
  const saving = completeMutation.isPending;

  const setField = (field: keyof FormValues, value: string) => {
    setFormValues((current) => ({ ...current, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((current) => ({ ...current, [field]: "" }));
    }
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    const nameCheck = checkText(formValues.name, TEXT_RULES.name);
    if (!nameCheck.ok) {
      errors.name =
        nameCheck.reason === "required"
          ? t("inbound.skuInfo.errName")
          : nameCheck.message;
    } else if (
      nameCheck.value.toUpperCase() === line.sku.trim().toUpperCase()
    ) {
      // Cùng luật với BE (SkuInboundInfoRule): tên trùng mã nghĩa là chưa ai đặt
      // tên thật, để lọt thì phiếu vẫn bị 422 lúc Ghi nhận.
      errors.name = t("inbound.skuInfo.errNameSameAsCode");
    }

    const unitCheck = checkText(formValues.unit, {
      required: true,
      max: UNIT_MAX,
    });
    if (!unitCheck.ok) {
      errors.unit =
        unitCheck.reason === "required"
          ? t("inbound.skuInfo.errUnit")
          : unitCheck.message;
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    try {
      await completeMutation.mutateAsync({
        id: documentId,
        lineId: line.id,
        payload: {
          skuName: formValues.name.trim(),
          unit: formValues.unit.trim(),
          // Chỉ gửi danh mục người dùng thực sự chọn: gửi chuỗi rỗng sẽ bị BE
          // hiểu là "xoá về trống" và thổi bay dữ liệu người quản lý đã điền.
          ...(formValues.brandId ? { brandId: formValues.brandId } : {}),
          ...(formValues.categoryId
            ? { categoryId: formValues.categoryId }
            : {}),
          ...(formValues.modelId ? { modelId: formValues.modelId } : {}),
          ...(formValues.powerSourceId
            ? { powerSourceId: formValues.powerSourceId }
            : {}),
        },
      });
      toast.success(t("inbound.skuInfo.saved", { code: line.sku }));
      onSaved();
    } catch (error) {
      const { fieldErrors: serverFieldErrors, message } = resolveFormErrors(
        error,
        SERVER_ERROR_FIELDS,
      );
      const mapped: Record<string, string> = {};
      for (const [field, fieldMessage] of Object.entries(serverFieldErrors)) {
        mapped[SERVER_FIELD_TO_FORM_FIELD[field]] = fieldMessage;
      }
      const hasFieldErrors = Object.keys(mapped).length > 0;
      setFieldErrors((current) => ({ ...current, ...mapped }));
      if (message !== null) {
        toast.error(
          hasFieldErrors
            ? message
            : getApiErrorMessage(error, t("inbound.skuInfo.saveError")),
        );
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
          <span>{t("inbound.skuInfo.title")}</span>
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
          <ActionButton kind="close" onClick={dialog.close} disabled={saving}>
            {t("common.close")}
          </ActionButton>
          <ActionButton
            kind="save"
            onClick={() => void handleSave()}
            disabled={saving}
          >
            {saving
              ? t("inbound.skuInfo.saving")
              : t("inbound.skuInfo.submit")}
          </ActionButton>
        </>
      }
    >
      <br />

      <Box sx={{ mb: 2 }}>
        <UiAlert tone="info">
          {t("inbound.skuInfo.intro", { code: line.sku })}
        </UiAlert>
      </Box>

      <Grid container spacing={2}>
        <Grid size={12}>
          <UiTextField
            id="inbound-sku-info-code"
            label={t("inbound.skuInfo.fieldCode")}
            fullWidth
            value={line.sku}
            disabled
          />
        </Grid>
        <Grid size={{ xs: 12, md: 8 }}>
          <UiTextField
            id="inbound-sku-info-name"
            label={t("inbound.skuInfo.fieldName")}
            required
            fullWidth
            autoFocus
            value={formValues.name}
            placeholder={t("inbound.skuInfo.namePlaceholder")}
            onChange={(event) => setField("name", event.target.value)}
            disabled={saving}
            slotProps={{ htmlInput: { maxLength: TEXT_RULES.name.max } }}
            error={Boolean(fieldErrors.name)}
            helperText={fieldErrors.name}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <UiTextField
            id="inbound-sku-info-unit"
            label={t("inbound.skuInfo.fieldUnit")}
            required
            fullWidth
            value={formValues.unit}
            placeholder={t("inbound.skuInfo.unitPlaceholder")}
            onChange={(event) => setField("unit", event.target.value)}
            disabled={saving}
            slotProps={{ htmlInput: { maxLength: UNIT_MAX } }}
            error={Boolean(fieldErrors.unit)}
            helperText={fieldErrors.unit}
          />
        </Grid>

        {/* Bốn ô dưới là tuỳ chọn — nói rõ bằng chữ thay vì một banner cảnh
            báo, vì đây là hướng dẫn chứ không phải lỗi. */}
        <Grid size={12}>
          <Box sx={{ typography: "body2", color: "text.secondary" }}>
            {t("inbound.skuInfo.optionalHint")}
          </Box>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <UiAutocomplete
            label={t("inbound.skuInfo.fieldBrand")}
            value={formValues.brandId || null}
            onChange={(next) =>
              setField("brandId", next == null ? "" : String(next))
            }
            disabled={saving || catalogsQuery.isLoading}
            options={refOptions(catalogs?.brands)}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <UiAutocomplete
            label={t("inbound.skuInfo.fieldCategory")}
            value={formValues.categoryId || null}
            onChange={(next) =>
              setField("categoryId", next == null ? "" : String(next))
            }
            disabled={saving || catalogsQuery.isLoading}
            options={refOptions(catalogs?.categories)}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <UiAutocomplete
            label={t("inbound.skuInfo.fieldModel")}
            value={formValues.modelId || null}
            onChange={(next) =>
              setField("modelId", next == null ? "" : String(next))
            }
            disabled={saving || catalogsQuery.isLoading}
            options={refOptions(catalogs?.models)}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <UiAutocomplete
            label={t("inbound.skuInfo.fieldPowerSource")}
            value={formValues.powerSourceId || null}
            onChange={(next) =>
              setField("powerSourceId", next == null ? "" : String(next))
            }
            disabled={saving || catalogsQuery.isLoading}
            options={refOptions(catalogs?.powerSources)}
          />
        </Grid>
      </Grid>
    </UiDialog>
  );
}
