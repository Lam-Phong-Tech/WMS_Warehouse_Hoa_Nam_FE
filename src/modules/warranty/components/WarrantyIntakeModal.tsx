import { useEffect, useMemo, useState } from "react";
import { useActiveWarehouses } from "@/shared/data/reference-queries";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  Box,
  FormControlLabel,
  Grid,
  Radio,
  SEMANTIC_LIGHT,
  Stack,
  UiAddressField,
  UiAlert,
  UiDialog,
  UiFormAutocomplete,
  UiStatusBadge,
  UiText,
  UiTextField,
} from "@/shared/ui";
import {
  DeleteOutlined,
  PlayCircleOutlined,
  UploadOutlined,
} from "@/shared/components/icons";
import {
  extractFieldErrorsRaw,
  getApiErrorMessage,
  resolveFormErrors,
} from "@/shared/api/api-error";
import { ACTION_ICON_COLORS } from "@/shared/theme/actionIconColors";
import {
  ITEM_STATUS_LABELS,
  businessLabel,
} from "@/shared/constants/business-labels";
import { useDialogExit } from "@/shared/utils/useDialogExit";
import { useT } from "@/shared/i18n/useT";
import { ScanInput } from "@/shared/components/forms/ScanInput";
import { useCanAny } from "@/shared/components/permission";
import {
  useCreateMvpDefect,
  useMvpDefects,
} from "@/modules/master-data/hooks/use-mvp-master";
import { classifyScanCodes } from "@/modules/scan/services/scanService";
import {
  useCreateWarrantyCase,
  useUploadWarrantyAttachment,
} from "@/modules/warranty/hooks/use-warranty";
import type {
  WarrantyCase,
  WarrantyIdentificationType,
} from "@/modules/warranty/types";
import { ActionButton, ActionIconButton } from "@/shared/components/actions";
import {
  AnimatedInlineList,
  AnimatedInlineItem,
} from "@/shared/components/motion";
import { createRowKey } from "@/shared/components/motion/row-key";
import { validatePhone } from "@/shared/constants/validation.constants";
import {
  FILE_RULES,
  acceptAttribute,
  checkFile,
} from "@/shared/validation/file-rules";
import {
  MAX_WARRANTY_IMAGES,
  MAX_WARRANTY_VIDEOS,
  MAX_WARRANTY_VIDEO_DURATION_SECONDS,
  probeVideoDurationSeconds,
} from "@/modules/warranty/components/warranty-attachment-limits";
import {
  checkDate,
  dateInputBounds,
  pastDateBounds,
} from "@/shared/validation/date-rules";

/** BE create case: item_code maxLength 200 (OpenAPI SCR-WAR-01). */
const ITEM_CODE_MAX_LENGTH = 200;
/** Mô tả bệnh/lỗi mới: dùng chung trần văn bản tự do 2000 (BE không giới hạn). */
const DEFECT_DESCRIPTION_MAX_LENGTH = 2000;

/**
 * Khóa ổn định cho từng tệp đã chọn.
 *
 * Không dùng `${file.name}-${index}`: chọn hai tệp trùng tên (rất thường gặp
 * với ảnh chụp từ điện thoại) sẽ đụng khóa, và xóa chip ở giữa làm mọi chip
 * phía sau đổi khóa nên React coi như "đổi nội dung" thay vì "bị xóa" — mất
 * hiệu ứng thu nhỏ. WeakMap bám theo chính đối tượng File (ổn định suốt vòng
 * đời state) nên không cần đổi kiểu state đang là File[].
 */
const fileRowKeys = new WeakMap<File, string>();
function fileRowKey(file: File): string {
  let key = fileRowKeys.get(file);
  if (!key) {
    key = createRowKey("file");
    fileRowKeys.set(file, key);
  }
  return key;
}

// Annex D SCR-WAR-01 field `images`: jpg/png/webp; <=10 files; <=10MB/file.
// Trần số ảnh/video + đo thời lượng dùng chung với màn chi tiết — xem
// warranty-attachment-limits.ts.
const MAX_INTAKE_IMAGES = MAX_WARRANTY_IMAGES;
/**
 * Đuôi/MIME/dung lượng của tệp lấy từ lớp luật dùng chung (file-rules.ts) —
 * cùng một luật với màn chi tiết, không chép lại lần hai.
 */
const IMAGE_RULE = FILE_RULES.warrantyImage;

// WAR-02 video đính kèm: mp4/mov/webm, tách riêng khỏi 10 ảnh; <=2 video;
// <=300MB và <=5 phút/video (BE đo lại thời lượng bằng getID3, đây chỉ là
// kiểm tra sớm phía client để không mất công tải file quá dài).
const MAX_INTAKE_VIDEOS = MAX_WARRANTY_VIDEOS;
const MAX_INTAKE_VIDEO_DURATION_SECONDS = MAX_WARRANTY_VIDEO_DURATION_SECONDS;
const VIDEO_RULE = FILE_RULES.warrantyVideo;

function formatIntakeFileSize(bytes: number): string {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const INTAKE_TILE_DELETE_SX = {
  width: 22,
  height: 22,
  bgcolor: "rgba(0, 0, 0, 0.55)",
  color: SEMANTIC_LIGHT.onPrimary,
  "&:hover": { bgcolor: "rgba(0, 0, 0, 0.78)" },
} as const;

const INTAKE_TILE_LABEL_SX = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
} as const;

/**
 * Ô ảnh vuông kiểu thư viện — đồng bộ giao diện với `ImageAttachmentTile` ở
 * màn chi tiết case (WarrantyDetailModal). Khác biệt duy nhất: ảnh ở đây chưa
 * tải lên server (chỉ tải sau khi case được tạo) nên xem trước bằng object
 * URL sinh tại chỗ từ chính `File`, không có nút tải xuống.
 */
function IntakeImageTile({
  file,
  onDelete,
}: {
  file: File;
  onDelete: () => void;
}) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  return (
    <Box sx={{ minWidth: 0 }}>
      <Box
        sx={{
          position: "relative",
          width: "100%",
          aspectRatio: "1 / 1",
          borderRadius: 2,
          overflow: "hidden",
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "action.hover",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          "&:hover .hn-intake-image-delete": { opacity: 1 },
        }}
      >
        <Box
          component="img"
          src={url}
          alt={file.name}
          sx={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
        <Box
          className="hn-intake-image-delete"
          sx={{ position: "absolute", top: 4, right: 4, opacity: 0 }}
        >
          <ActionIconButton
            kind="delete"
            onClick={onDelete}
            sx={INTAKE_TILE_DELETE_SX}
          />
        </Box>
      </Box>
      <Box
        title={file.name}
        sx={{
          typography: "caption",
          display: "block",
          mt: 0.5,
          ...INTAKE_TILE_LABEL_SX,
        }}
      >
        {file.name}
      </Box>
      <Box
        sx={{
          typography: "caption",
          color: "text.secondary",
          display: "block",
          fontSize: 11,
          ...INTAKE_TILE_LABEL_SX,
        }}
      >
        {formatIntakeFileSize(file.size)}
      </Box>
    </Box>
  );
}

interface WarrantyIntakeModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (created: WarrantyCase) => void;
}

/**
 * WAR-02 · Tiếp nhận bảo hành (BP-WMS-08 IDENTIFIED / BP-WMS-09 TEMP_ONLY).
 * Stock-neutral: tạo case không sinh movement; mã tạm do BE sinh.
 */
export function WarrantyIntakeModal({
  open,
  onClose,
  onCreated,
}: WarrantyIntakeModalProps) {
  const dialog = useDialogExit(onClose);
  const t = useT();
  const [identificationType, setIdentificationType] =
    useState<WarrantyIdentificationType>("IDENTIFIED");
  const [itemCode, setItemCode] = useState("");
  const [missingCodeReason, setMissingCodeReason] = useState("");
  const [manualProductDescription, setManualProductDescription] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [defectIds, setDefectIds] = useState<string[]>([]);
  const [reportedDefect, setReportedDefect] = useState("");
  const [accessoriesReceived, setAccessoriesReceived] = useState("");
  const [receivedCondition, setReceivedCondition] = useState("");

  const [formError, setFormError] = useState<string | null>(null);
  /**
   * Lỗi gắn vào từng ô (ngày mua, SĐT, mã hiện vật) — banner `formError` giữ
   * cho lỗi server/lỗi bắt buộc như trước, nhưng lỗi định dạng phải hiện ngay
   * dưới ô sai để người nhập biết sửa ở đâu.
   */
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const clearFieldError = (key: string) =>
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  // Ngày mua ≤ hôm nay (BE: before_or_equal:today); tính mỗi lần render để
  // không "đóng băng" hôm nay khi trang mở qua nửa đêm.
  const purchaseDateBounds = pastDateBounds();
  const purchaseDateInput = dateInputBounds(purchaseDateBounds);
  const phoneLiveCheck = customerPhone ? validatePhone(customerPhone) : null;
  const phoneLiveError =
    phoneLiveCheck && !phoneLiveCheck.isValid
      ? (phoneLiveCheck.errorMessage ?? t("warranty.intake.errPhoneFormat"))
      : undefined;
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [videoFiles, setVideoFiles] = useState<File[]>([]);
  const createMutation = useCreateWarrantyCase();
  const uploadMutation = useUploadWarrantyAttachment();
  const defectsQuery = useMvpDefects({ status: "ACTIVE", per_page: 100 });
  const defectOptions = (defectsQuery.data?.data ?? []).map((defect) => ({
    value: defect.defect_id,
    label: `${defect.defect_code} · ${defect.defect_name}`,
  }));
  // Part 4 Vuexy sync: UiFormAutocomplete là RHF-based nên dùng mini-form cục
  // bộ CHỈ cho field defect_ids; source of truth khi submit vẫn là state
  // `defectIds` (mirror qua watch bên dưới).
  const defectForm = useForm<{ defect_ids: string[] }>({
    defaultValues: { defect_ids: [] },
  });
  useEffect(() => {
    const subscription = defectForm.watch((values) => {
      setDefectIds(
        (values.defect_ids ?? []).filter(
          (id): id is string => typeof id === "string",
        ),
      );
    });
    return () => subscription.unsubscribe();
  }, [defectForm]);

  // Thêm nhanh 1 bệnh/lỗi mới ngay trong dropdown, không cần rời màn Tiếp
  // nhận bảo hành để qua tab "Danh mục bệnh/lỗi" — chỉ hiện dòng "+ Thêm bệnh
  // lỗi" cho ai có quyền quản lý danh mục lỗi (permission tách biệt hoàn toàn
  // với quyền tiếp nhận bảo hành).
  const canManageDefects = useCanAny(["defect.manage"]);
  const createDefectMutation = useCreateMvpDefect();
  const [defectDialogOpen, setDefectDialogOpen] = useState(false);
  const [newDefectForm, setNewDefectForm] = useState({
    defect_code: "",
    defect_name: "",
    description: "",
  });
  const [newDefectErrors, setNewDefectErrors] = useState<
    Record<string, string>
  >({});

  const handleCreateDefect = async () => {
    const errors: Record<string, string> = {};
    if (!newDefectForm.defect_code.trim()) {
      errors.defect_code = t("warranty.intake.errDefectCode");
    }
    if (!newDefectForm.defect_name.trim()) {
      errors.defect_name = t("warranty.intake.errDefectName");
    }
    if (
      newDefectForm.description.trim().length > DEFECT_DESCRIPTION_MAX_LENGTH
    ) {
      errors.description = t("shared.validation.textMaxLength", {
        max: DEFECT_DESCRIPTION_MAX_LENGTH,
      });
    }
    if (Object.keys(errors).length > 0) {
      setNewDefectErrors(errors);
      return;
    }
    try {
      const created = await createDefectMutation.mutateAsync({
        defect_code: newDefectForm.defect_code.trim(),
        defect_name: newDefectForm.defect_name.trim(),
        description: newDefectForm.description.trim() || null,
        status: "ACTIVE",
      });
      defectForm.setValue("defect_ids", [
        ...defectForm.getValues("defect_ids"),
        created.defect_id,
      ]);
      toast.success(
        t("warranty.intake.defectAdded", { code: created.defect_code }),
      );
      setDefectDialogOpen(false);
      setNewDefectForm({ defect_code: "", defect_name: "", description: "" });
      setNewDefectErrors({});
    } catch (error) {
      const { fieldErrors } = resolveFormErrors(error, [
        "defect_code",
        "defect_name",
        "description",
      ]);
      setNewDefectErrors(fieldErrors);
      toast.error(
        getApiErrorMessage(error, t("warranty.intake.defectAddError")),
      );
    }
  };
  // Change Pack QR/SKU (guide §13 WAR-02): quét raw QR -> classify(WARRANTY) ->
  // tự điền item/SKU; classify cần warehouse_id (REQ-SRS-001: một kho ACTIVE).
  const warehousesQuery = useActiveWarehouses({ enabled: open });
  const warehouse = warehousesQuery.data?.[0];
  const [resolvedItem, setResolvedItem] = useState<{
    skuCode?: string;
    itemUnique?: string;
    objectStatus?: string;
  } | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);

  /**
   * AC-QR-06: backend là resolver authoritative — FE gửi RAW payload vào
   * classify, nhận normalized item_code + SKU để tự điền. Không resolve được thì
   * GIỮ nguyên mã đã quét (BE create sẽ revalidate) và gợi ý TEMP_ONLY, tuyệt
   * đối không auto-switch (guide §13: "không auto-switch silent").
   */
  const resolveScannedCode = async (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) return;
    setItemCode(code);
    setResolvedItem(null);
    setResolveError(null);
    if (!warehouse?.id) return;
    try {
      const classified = await classifyScanCodes({
        raw_code: code,
        context: "WARRANTY_RECEIVE",
        warehouse_id: String(warehouse.id),
      });
      setItemCode(classified.normalized_code_value || code);
      setResolvedItem({
        skuCode: classified.sku_code,
        itemUnique: classified.item_unique,
        objectStatus: classified.object_status,
      });
    } catch (error) {
      setResolveError(
        getApiErrorMessage(error, t("warranty.intake.qrUnresolved")),
      );
    }
  };

  const addImageFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const accepted: File[] = [];
    Array.from(incoming).forEach((file, index) => {
      // Kiểm đuôi + MIME + dung lượng bằng một luật duy nhất; câu lỗi giữ
      // nguyên chữ của màn tiếp nhận nên chỉ đọc reason để chọn câu.
      const check = checkFile(file, IMAGE_RULE);
      if (!check.ok) {
        toast.error(
          check.reason === "type"
            ? t("warranty.intake.badImageType", { name: file.name })
            : t("warranty.intake.imageTooLarge", { name: file.name }),
        );
        return;
      }
      const slot = imageFiles.length + accepted.length + index * 0;
      if (slot >= MAX_INTAKE_IMAGES) {
        toast.error(
          t("warranty.intake.tooManyImages", { max: MAX_INTAKE_IMAGES }),
        );
        return;
      }
      accepted.push(file);
    });
    if (accepted.length > 0) {
      setImageFiles((current) =>
        [...current, ...accepted].slice(0, MAX_INTAKE_IMAGES),
      );
    }
  };

  const addVideoFiles = async (incoming: FileList | null) => {
    if (!incoming) return;
    const accepted: File[] = [];
    for (const file of Array.from(incoming)) {
      const check = checkFile(file, VIDEO_RULE);
      if (!check.ok) {
        toast.error(
          check.reason === "type"
            ? t("warranty.intake.badVideoType", { name: file.name })
            : t("warranty.intake.videoTooLarge", { name: file.name }),
        );
        continue;
      }
      if (videoFiles.length + accepted.length >= MAX_INTAKE_VIDEOS) {
        toast.error(
          t("warranty.intake.tooManyVideos", { max: MAX_INTAKE_VIDEOS }),
        );
        continue;
      }
      try {
        const duration = await probeVideoDurationSeconds(file);
        if (duration > MAX_INTAKE_VIDEO_DURATION_SECONDS) {
          toast.error(t("warranty.intake.videoTooLong", { name: file.name }));
          continue;
        }
      } catch {
        toast.error(t("warranty.intake.videoUnreadable", { name: file.name }));
        continue;
      }
      accepted.push(file);
    }
    if (accepted.length > 0) {
      setVideoFiles((current) =>
        [...current, ...accepted].slice(0, MAX_INTAKE_VIDEOS),
      );
    }
  };

  // Annex D SCR-WAR-01: `images` chỉ lưu attachment IDs nên case phải tồn tại
  // trước mới đính kèm được. Lỗi upload không rollback case: case là bản ghi
  // nghiệp vụ chính, ảnh có thể bổ sung lại ở màn chi tiết case (WAR-03).
  const uploadIntakeImages = async (created: WarrantyCase) => {
    if (imageFiles.length === 0) return;
    const results = await Promise.allSettled(
      imageFiles.map((file) =>
        uploadMutation.mutateAsync({
          caseId: created.id,
          file,
          attachmentType: "INTAKE",
        }),
      ),
    );
    const failed = results.filter((result) => result.status === "rejected");
    if (failed.length === 0) {
      toast.success(
        t("warranty.intake.imagesAttached", { count: imageFiles.length }),
      );
      return;
    }
    toast.error(
      t("warranty.intake.imagesPartial", {
        code: created.case_code,
        failed: failed.length,
        total: imageFiles.length,
      }),
    );
  };

  const uploadIntakeVideos = async (created: WarrantyCase) => {
    if (videoFiles.length === 0) return;
    const results = await Promise.allSettled(
      videoFiles.map((file) =>
        uploadMutation.mutateAsync({
          caseId: created.id,
          file,
          attachmentType: "INTAKE",
        }),
      ),
    );
    const failed = results.filter((result) => result.status === "rejected");
    if (failed.length === 0) {
      toast.success(
        t("warranty.intake.videosAttached", { count: videoFiles.length }),
      );
      return;
    }
    toast.error(
      t("warranty.intake.videosPartial", {
        code: created.case_code,
        failed: failed.length,
        total: videoFiles.length,
      }),
    );
  };

  const resetForm = () => {
    setIdentificationType("IDENTIFIED");
    setItemCode("");
    setMissingCodeReason("");
    setManualProductDescription("");
    setCustomerName("");
    setCustomerPhone("");
    setCustomerAddress("");
    setPurchaseDate("");
    setDefectIds([]);
    defectForm.reset({ defect_ids: [] });
    setReportedDefect("");
    setAccessoriesReceived("");
    setReceivedCondition("");
    setImageFiles([]);
    setVideoFiles([]);
    setResolvedItem(null);
    setResolveError(null);
    setFormError(null);
    setFieldErrors({});
  };

  const submit = async () => {
    setFormError(null);
    // Kiểm tra định dạng từng ô trước, gom hết lỗi rồi mới dừng — người dùng
    // thấy mọi ô sai một lượt thay vì sửa từng lỗi qua banner.
    const errors: Record<string, string> = {};
    if (
      identificationType === "IDENTIFIED" &&
      itemCode.trim().length > ITEM_CODE_MAX_LENGTH
    ) {
      errors.itemCode = t("shared.validation.textMaxLength", {
        max: ITEM_CODE_MAX_LENGTH,
      });
    }
    if (customerPhone.trim()) {
      const phoneCheck = validatePhone(customerPhone.trim());
      if (!phoneCheck.isValid) {
        errors.customerPhone =
          phoneCheck.errorMessage ?? t("warranty.intake.errPhoneFormat");
      }
    }
    if (purchaseDate) {
      const dateCheck = checkDate(purchaseDate, purchaseDateBounds);
      if (!dateCheck.ok) {
        errors.purchaseDate = dateCheck.message;
      }
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setFormError(Object.values(errors)[0] ?? null);
      return;
    }
    if (identificationType === "TEMP_ONLY") {
      if (!missingCodeReason.trim()) {
        setFormError(t("warranty.intake.errReason"));
        return;
      }
      if (!manualProductDescription.trim()) {
        setFormError(t("warranty.intake.errDescription"));
        return;
      }
    } else if (!itemCode.trim()) {
      setFormError(t("warranty.intake.errItemCode"));
      return;
    }
    if (!customerName.trim()) {
      setFormError(t("warranty.intake.errCustomerName"));
      return;
    }
    if (!customerPhone.trim()) {
      setFormError(t("warranty.intake.errPhone"));
      return;
    }
    if (!reportedDefect.trim()) {
      setFormError(t("warranty.intake.errDefectReported"));
      return;
    }

    try {
      const created = await createMutation.mutateAsync({
        identification_type: identificationType,
        item_code: itemCode.trim() || undefined,
        missing_code_reason: missingCodeReason.trim() || undefined,
        manual_product_description:
          manualProductDescription.trim() || undefined,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_address: customerAddress.trim() || undefined,
        purchase_date: purchaseDate || undefined,
        defect_ids: defectIds,
        defect_description: reportedDefect.trim(),
        reported_defect: reportedDefect.trim(),
        accessories_received: accessoriesReceived.trim() || undefined,
        received_condition: receivedCondition.trim() || undefined,
      });
      toast.success(
        created.identification_type === "TEMP_ONLY" &&
          created.temporary_item_code
          ? t("warranty.intake.createdTemporary", {
              code: created.case_code,
              temporary: created.temporary_item_code,
            })
          : t("warranty.intake.created", { code: created.case_code }),
      );
      await uploadIntakeImages(created);
      await uploadIntakeVideos(created);
      resetForm();
      onCreated(created);
    } catch (error: unknown) {
      // Toast ngắn đã hiện qua onError của createMutation (use-warranty.ts).
      // Ở đây chỉ dựng banner lỗi CỐ ĐỊNH trong form — kèm chi tiết từng field
      // sai (hữu ích hơn khi đọc trong banner so với nhét vào một dòng toast).
      // Không kèm request_id: đó là mã tra cứu kỹ thuật, người dùng đọc không
      // hiểu (xem ApiErrorAlert.tsx — request_id chỉ hiện ở dòng phụ có nhãn).
      const fieldErrors = extractFieldErrorsRaw(error);
      const errorMsg = `${getApiErrorMessage(error, t("warranty.error.createCase"))}${
        fieldErrors ? ` (${Object.values(fieldErrors).flat().join("; ")})` : ""
      }`;
      setFormError(errorMsg);
    }
  };

  const busy = createMutation.isPending || uploadMutation.isPending;

  // Giữ nguyên hành vi handler của ToggleButtonGroup cũ (onChange nhận
  // value | null và bỏ qua null); radio không bao giờ emit null nên nhánh
  // "deselect về null" đơn giản là không xảy ra.
  const changeIdentificationType = (
    value: WarrantyIdentificationType | null,
  ) => {
    if (value) setIdentificationType(value);
  };

  return (
    <UiDialog
      {...dialog.dialogProps}
      open={open && dialog.open}
      maxWidth="md"
      fullWidth
      title={
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: "center", justifyContent: "space-between" }}
        >
          <Box component="span">{t("warranty.intake.title")}</Box>
          <ActionIconButton
            kind="close"
            label={t("common.close")}
            onClick={dialog.close}
          />
        </Stack>
      }
      actions={
        <>
          <ActionButton kind="cancel" onClick={dialog.close} disabled={busy}>
            {t("warranty.intake.cancel")}
          </ActionButton>
          <ActionButton
            kind="save"
            disabled={busy}
            onClick={() => void submit()}
          >
            {busy ? t("warranty.intake.saving") : t("warranty.intake.save")}
          </ActionButton>
        </>
      }
    >
      <Stack spacing={2}>
        {formError ? <UiAlert tone="error">{formError}</UiAlert> : null}

        <Box>
          <Box sx={{ mb: 0.5 }}>
            <UiText variant="caption" color={SEMANTIC_LIGHT.textMedium}>
              {t("warranty.intake.intakeType")}
            </UiText>
          </Box>
          <Box
            role="radiogroup"
            aria-label={t("warranty.intake.intakeTypeAria")}
            sx={{ display: "flex", flexWrap: "wrap", columnGap: 2 }}
          >
            <FormControlLabel
              label={t("warranty.intake.hasCode")}
              control={
                <Radio
                  size="small"
                  name="warranty-intake-identification-type"
                  value="IDENTIFIED"
                  checked={identificationType === "IDENTIFIED"}
                  onChange={() => changeIdentificationType("IDENTIFIED")}
                />
              }
            />
            <FormControlLabel
              label={t("warranty.intake.lostCode")}
              control={
                <Radio
                  size="small"
                  name="warranty-intake-identification-type"
                  value="TEMP_ONLY"
                  checked={identificationType === "TEMP_ONLY"}
                  onChange={() => changeIdentificationType("TEMP_ONLY")}
                />
              }
            />
          </Box>
        </Box>

        {identificationType === "TEMP_ONLY" ? (
          <>
            <UiTextField
              required
              fullWidth
              multiline
              minRows={2}
              label={t("warranty.intake.lostReason")}
              value={missingCodeReason}
              onChange={(event) => setMissingCodeReason(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 500 } }}
              helperText={`${missingCodeReason.length}/500`}
            />
            <UiTextField
              required
              fullWidth
              multiline
              minRows={2}
              label={t("warranty.intake.identityDescription")}
              value={manualProductDescription}
              onChange={(event) =>
                setManualProductDescription(event.target.value)
              }
              slotProps={{ htmlInput: { maxLength: 2000 } }}
              helperText={`${manualProductDescription.length}/2000`}
            />
          </>
        ) : (
          <Box>
            <Box sx={{ mb: 0.5 }}>
              <UiText variant="caption" color={SEMANTIC_LIGHT.textMedium}>
                {t("warranty.intake.itemCode")}
              </UiText>
            </Box>
            <Stack
              direction="row"
              spacing={1}
              sx={{ flexWrap: "wrap", rowGap: 1 }}
            >
              <Box sx={{ flex: 1, minWidth: 240 }}>
                <ScanInput
                  value={itemCode}
                  size="middle"
                  // Annex D SCR-WAR-01 scan-focus: ô quét tự nhận focus khi mở WAR-02
                  // ở nhánh IDENTIFIED để đầu đọc bắn được ngay.
                  autoFocus
                  placeholder={t("warranty.intake.itemCodePlaceholder")}
                  onChange={(value) => {
                    setItemCode(value);
                    setResolvedItem(null);
                    setResolveError(null);
                    clearFieldError("itemCode");
                  }}
                  onScan={(code) => void resolveScannedCode(code)}
                  error={fieldErrors.itemCode ?? null}
                />
              </Box>
            </Stack>
            <Box sx={{ mt: 0.5 }}>
              <UiText variant="caption" color={SEMANTIC_LIGHT.textMedium}>
                {t("warranty.intake.itemCodeHint")}
              </UiText>
            </Box>
            {resolvedItem ? (
              <Box sx={{ mt: 1 }}>
                <UiAlert tone="success">
                  {t("warranty.intake.resolved", {
                    sku: resolvedItem.skuCode
                      ? t("warranty.intake.resolvedSku", {
                          sku: resolvedItem.skuCode,
                        })
                      : "",
                    unique: resolvedItem.itemUnique
                      ? ` · ${resolvedItem.itemUnique}`
                      : "",
                    status: resolvedItem.objectStatus
                      ? t("warranty.intake.resolvedStatus", {
                          status: businessLabel(
                            ITEM_STATUS_LABELS,
                            resolvedItem.objectStatus,
                          ),
                        })
                      : "",
                  })}
                </UiAlert>
              </Box>
            ) : null}
            {resolveError ? (
              <Box sx={{ mt: 1 }}>
                <UiAlert tone="warning">
                  <Box>{resolveError}</Box>
                  <Box component="span" sx={{ fontSize: 12 }}>
                    {t("warranty.intake.lostCodeHint")}
                  </Box>
                </UiAlert>
              </Box>
            ) : null}
          </Box>
        )}

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <UiTextField
              required
              fullWidth
              label={t("warranty.intake.customerName")}
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 200 } }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <UiTextField
              required
              fullWidth
              label={t("warranty.intake.phone")}
              value={customerPhone}
              onChange={(event) => {
                setCustomerPhone(
                  event.target.value.replace(/\D/g, "").slice(0, 10),
                );
                clearFieldError("customerPhone");
              }}
              error={Boolean(fieldErrors.customerPhone ?? phoneLiveError)}
              helperText={fieldErrors.customerPhone ?? phoneLiveError}
              slotProps={{
                htmlInput: { maxLength: 10, inputMode: "numeric" },
              }}
            />
          </Grid>
          <Grid size={12}>
            <UiAddressField
              data-testid="warranty-intake-address"
              label={t("warranty.intake.address")}
              value={customerAddress}
              onChange={setCustomerAddress}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <UiTextField
              fullWidth
              type="date"
              label={t("warranty.intake.purchaseDate")}
              value={purchaseDate}
              onChange={(event) => {
                setPurchaseDate(event.target.value);
                clearFieldError("purchaseDate");
              }}
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: { ...purchaseDateInput },
              }}
              error={Boolean(fieldErrors.purchaseDate)}
              helperText={
                fieldErrors.purchaseDate ?? t("warranty.intake.dateHelper")
              }
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <UiFormAutocomplete
              control={defectForm.control}
              name="defect_ids"
              multiple
              options={defectOptions}
              label={t("warranty.intake.defectCatalog")}
              placeholder={t("warranty.intake.defectCatalogPlaceholder")}
              {...(canManageDefects
                ? {
                    onAddNew: () => setDefectDialogOpen(true),
                    addNewLabel: t("warranty.intake.addDefect"),
                  }
                : {})}
            />
          </Grid>
          <Grid size={12}>
            <UiTextField
              fullWidth
              label={t("warranty.intake.accessories")}
              placeholder={t("warranty.intake.accessoriesPlaceholder")}
              value={accessoriesReceived}
              onChange={(event) => setAccessoriesReceived(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 1000 } }}
            />
          </Grid>
        </Grid>

        <UiTextField
          required
          fullWidth
          multiline
          minRows={3}
          label={t("warranty.intake.defectReported")}
          value={reportedDefect}
          onChange={(event) => setReportedDefect(event.target.value)}
          slotProps={{ htmlInput: { maxLength: 2000 } }}
          helperText={`${reportedDefect.length}/2000`}
        />

        <UiTextField
          fullWidth
          multiline
          minRows={2}
          label={t("warranty.intake.conditionOnIntake")}
          placeholder={t("warranty.intake.conditionPlaceholder")}
          value={receivedCondition}
          onChange={(event) => setReceivedCondition(event.target.value)}
          slotProps={{ htmlInput: { maxLength: 500 } }}
          helperText={`${receivedCondition.length}/500`}
        />

        <Box>
          <Box sx={{ mb: 0.5 }}>
            <UiText variant="body">
              <Box component="span" sx={{ fontWeight: 600 }}>
                {t("warranty.intake.imagesTitle", {
                  count: imageFiles.length,
                  max: MAX_INTAKE_IMAGES,
                })}
              </Box>
            </UiText>
          </Box>
          <Box sx={{ mb: 1 }}>
            <UiText variant="caption" color={SEMANTIC_LIGHT.textMedium}>
              {t("warranty.intake.imagesHint")}
            </UiText>
          </Box>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(112px, 1fr))",
              gap: 1.5,
            }}
          >
            <AnimatedInlineList>
              {imageFiles.map((file, index) => (
                <AnimatedInlineItem key={fileRowKey(file)}>
                  <IntakeImageTile
                    file={file}
                    onDelete={() =>
                      setImageFiles((current) =>
                        current.filter((_, i) => i !== index),
                      )
                    }
                  />
                </AnimatedInlineItem>
              ))}
            </AnimatedInlineList>
            {imageFiles.length < MAX_INTAKE_IMAGES ? (
              <Box
                component="label"
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 0.5,
                  width: "100%",
                  aspectRatio: "1 / 1",
                  border: "1px dashed",
                  borderColor: "divider",
                  borderRadius: 2,
                  color: "text.secondary",
                  cursor: busy ? "not-allowed" : "pointer",
                  opacity: busy ? 0.6 : 1,
                  "&:hover": busy
                    ? undefined
                    : { borderColor: "primary.main", color: "primary.main" },
                }}
              >
                <UploadOutlined style={{ fontSize: 18 }} />
                <Box component="span" sx={{ typography: "caption" }}>
                  {t("warranty.intake.uploadImage")}
                </Box>
                <input
                  type="file"
                  accept={acceptAttribute(IMAGE_RULE)}
                  multiple
                  hidden
                  disabled={busy}
                  onChange={(event) => {
                    addImageFiles(event.target.files);
                    event.target.value = "";
                  }}
                />
              </Box>
            ) : null}
          </Box>
        </Box>

        <Box>
          <Box sx={{ mb: 0.5 }}>
            <UiText variant="body">
              <Box component="span" sx={{ fontWeight: 600 }}>
                {t("warranty.intake.videosTitle", {
                  count: videoFiles.length,
                  max: MAX_INTAKE_VIDEOS,
                })}
              </Box>
            </UiText>
          </Box>
          <Box sx={{ mb: 1 }}>
            <UiText variant="caption" color={SEMANTIC_LIGHT.textMedium}>
              {t("warranty.intake.videosHint")}
            </UiText>
          </Box>
          <Stack
            direction="row"
            spacing={1}
            sx={{ flexWrap: "wrap", rowGap: 1, mb: 1 }}
          >
            <AnimatedInlineList>
              {videoFiles.map((file, index) => (
                <AnimatedInlineItem key={fileRowKey(file)}>
                  <UiStatusBadge
                    tone="neutral"
                    label={file.name}
                    onDelete={() =>
                      setVideoFiles((current) =>
                        current.filter((_, i) => i !== index),
                      )
                    }
                    deleteIcon={<DeleteOutlined />}
                  />
                </AnimatedInlineItem>
              ))}
            </AnimatedInlineList>
          </Stack>
          {videoFiles.length < MAX_INTAKE_VIDEOS ? (
            <Box
              component="label"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                void addVideoFiles(event.dataTransfer.files);
              }}
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 0.5,
                border: "1px dashed",
                borderColor: "divider",
                borderRadius: 2,
                py: 3,
                cursor: busy ? "not-allowed" : "pointer",
                opacity: busy ? 0.6 : 1,
              }}
            >
              <Box
                component="span"
                sx={{
                  color: ACTION_ICON_COLORS.upload,
                  fontSize: 24,
                  lineHeight: 1,
                  display: "inline-flex",
                }}
              >
                <PlayCircleOutlined />
              </Box>
              <UiText variant="body">{t("warranty.intake.videoDrop")}</UiText>
              <UiText variant="caption" color={SEMANTIC_LIGHT.textMedium}>
                {t("warranty.intake.videoLimits", { max: MAX_INTAKE_VIDEOS })}
              </UiText>
              <input
                type="file"
                accept={acceptAttribute(VIDEO_RULE)}
                multiple
                hidden
                disabled={busy}
                onChange={(event) => {
                  void addVideoFiles(event.target.files);
                  event.target.value = "";
                }}
              />
            </Box>
          ) : null}
        </Box>
      </Stack>

      <UiDialog
        open={defectDialogOpen}
        maxWidth="xs"
        fullWidth
        title={
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", justifyContent: "space-between" }}
          >
            <Box component="span">{t("warranty.intake.defectDialogTitle")}</Box>
            <ActionIconButton
              kind="close"
              label={t("common.close")}
              onClick={() => setDefectDialogOpen(false)}
            />
          </Stack>
        }
        actions={
          <>
            <ActionButton
              kind="cancel"
              onClick={() => setDefectDialogOpen(false)}
              disabled={createDefectMutation.isPending}
            >
              {t("warranty.intake.cancel")}
            </ActionButton>
            <ActionButton
              kind="save"
              disabled={createDefectMutation.isPending}
              onClick={() => void handleCreateDefect()}
            >
              {createDefectMutation.isPending
                ? t("warranty.intake.defectSaving")
                : t("warranty.intake.defectSave")}
            </ActionButton>
          </>
        }
      >
        <Stack spacing={2} sx={{ pt: 1 }}>
          <UiTextField
            fullWidth
            required
            label={t("warranty.intake.defectCode")}
            value={newDefectForm.defect_code}
            onChange={(event) =>
              setNewDefectForm((current) => ({
                ...current,
                defect_code: event.target.value,
              }))
            }
            error={Boolean(newDefectErrors.defect_code)}
            helperText={newDefectErrors.defect_code}
            slotProps={{ htmlInput: { maxLength: 80 } }}
          />
          <UiTextField
            fullWidth
            required
            label={t("warranty.intake.defectName")}
            value={newDefectForm.defect_name}
            onChange={(event) =>
              setNewDefectForm((current) => ({
                ...current,
                defect_name: event.target.value,
              }))
            }
            error={Boolean(newDefectErrors.defect_name)}
            helperText={newDefectErrors.defect_name}
            slotProps={{ htmlInput: { maxLength: 200 } }}
          />
          <UiTextField
            fullWidth
            multiline
            minRows={2}
            label={t("warranty.intake.defectDescription")}
            value={newDefectForm.description}
            onChange={(event) =>
              setNewDefectForm((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
            error={Boolean(newDefectErrors.description)}
            helperText={newDefectErrors.description}
            slotProps={{
              htmlInput: { maxLength: DEFECT_DESCRIPTION_MAX_LENGTH },
            }}
          />
        </Stack>
      </UiDialog>
    </UiDialog>
  );
}
