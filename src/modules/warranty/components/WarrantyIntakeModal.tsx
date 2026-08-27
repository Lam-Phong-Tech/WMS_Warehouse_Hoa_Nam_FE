import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Autocomplete,
  Box,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { toast } from "sonner";
import dayjs from "dayjs";
import { DeleteOutlined, PlayCircleOutlined } from "@/shared/components/icons";
import {
  extractFieldErrorsRaw,
  getApiErrorMessage,
  getErrorRequestId,
} from "@/shared/api/api-error";
import { ACTION_ICON_COLORS } from "@/shared/theme/actionIconColors";
import { useDialogExit } from "@/shared/utils/useDialogExit";
import { CameraScanModal } from "@/shared/components/forms/CameraScanModal";
import { ScanInput } from "@/shared/components/forms/ScanInput";
import { useMvpDefects } from "@/modules/master-data/hooks/use-mvp-master";
import { fetchWarehouses } from "@/modules/master-data/services/warehouse.service";
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

// Annex D SCR-WAR-01 field `images`: jpg/png/webp; <=10 files; <=10MB/file.
const MAX_INTAKE_IMAGES = 10;
const MAX_INTAKE_IMAGE_BYTES = 10 * 1024 * 1024;
const INTAKE_IMAGE_MIMES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

// WAR-02 video đính kèm: mp4/mov/webm, tách riêng khỏi 10 ảnh; <=2 video;
// <=300MB và <=5 phút/video (BE đo lại thời lượng bằng getID3, đây chỉ là
// kiểm tra sớm phía client để không mất công tải file quá dài).
const MAX_INTAKE_VIDEOS = 2;
const MAX_INTAKE_VIDEO_BYTES = 300 * 1024 * 1024;
const MAX_INTAKE_VIDEO_DURATION_SECONDS = 300;
const INTAKE_VIDEO_MIMES = ["video/mp4", "video/quicktime", "video/webm"];

function probeVideoDurationSeconds(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const videoEl = document.createElement("video");
    videoEl.preload = "metadata";
    videoEl.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(videoEl.duration);
    };
    videoEl.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("cannot read video metadata"));
    };
    videoEl.src = url;
  });
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
  const [cameraOpen, setCameraOpen] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [videoFiles, setVideoFiles] = useState<File[]>([]);
  const createMutation = useCreateWarrantyCase();
  const uploadMutation = useUploadWarrantyAttachment();
  const defectsQuery = useMvpDefects({ status: "ACTIVE", per_page: 100 });
  const defectOptions = (defectsQuery.data?.data ?? []).map((defect) => ({
    value: defect.defect_id,
    label: `${defect.defect_code} · ${defect.defect_name}`,
  }));
  // Change Pack QR/SKU (guide §13 WAR-02): quét raw QR -> classify(WARRANTY) ->
  // tự điền item/SKU; classify cần warehouse_id (REQ-SRS-001: một kho ACTIVE).
  const warehousesQuery = useQuery({
    queryKey: ["warranty", "intake-warehouse"],
    queryFn: () => fetchWarehouses({ status: "ACTIVE" }),
    enabled: open,
  });
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
        getApiErrorMessage(
          error,
          "Không resolve được mã từ QR; kiểm tra lại hoặc chuyển TEMP_ONLY.",
        ),
      );
    }
  };

  const addImageFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const accepted: File[] = [];
    Array.from(incoming).forEach((file, index) => {
      if (!INTAKE_IMAGE_MIMES.includes(file.type)) {
        toast.error(`${file.name}: chỉ nhận ảnh JPG/PNG/WEBP.`);
        return;
      }
      if (file.size > MAX_INTAKE_IMAGE_BYTES) {
        toast.error(`${file.name}: vượt quá 10MB.`);
        return;
      }
      const slot = imageFiles.length + accepted.length + index * 0;
      if (slot >= MAX_INTAKE_IMAGES) {
        toast.error(`Tối đa ${MAX_INTAKE_IMAGES} ảnh cho một case bảo hành.`);
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
      if (!INTAKE_VIDEO_MIMES.includes(file.type)) {
        toast.error(`${file.name}: chỉ nhận video MP4/MOV/WEBM.`);
        continue;
      }
      if (file.size > MAX_INTAKE_VIDEO_BYTES) {
        toast.error(`${file.name}: vượt quá 300MB.`);
        continue;
      }
      if (videoFiles.length + accepted.length >= MAX_INTAKE_VIDEOS) {
        toast.error(`Tối đa ${MAX_INTAKE_VIDEOS} video cho một case bảo hành.`);
        continue;
      }
      try {
        const duration = await probeVideoDurationSeconds(file);
        if (duration > MAX_INTAKE_VIDEO_DURATION_SECONDS) {
          toast.error(`${file.name}: video vượt quá 5 phút.`);
          continue;
        }
      } catch {
        toast.error(`${file.name}: không đọc được video, thử tệp khác.`);
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
      toast.success(`Đã đính kèm ${imageFiles.length} ảnh tiếp nhận.`);
      return;
    }
    toast.error(
      `Đã tạo case ${created.case_code} nhưng ${failed.length}/${imageFiles.length} ảnh chưa tải lên được. Vào chi tiết case để đính kèm lại.`,
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
      toast.success(`Đã đính kèm ${videoFiles.length} video tiếp nhận.`);
      return;
    }
    toast.error(
      `Đã tạo case ${created.case_code} nhưng ${failed.length}/${videoFiles.length} video chưa tải lên được. Vào chi tiết case để đính kèm lại.`,
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
    setReportedDefect("");
    setAccessoriesReceived("");
    setReceivedCondition("");
    setImageFiles([]);
    setVideoFiles([]);
    setResolvedItem(null);
    setResolveError(null);
    setFormError(null);
  };

  const submit = async () => {
    setFormError(null);
    if (identificationType === "TEMP_ONLY") {
      if (!missingCodeReason.trim()) {
        setFormError("Nhập lý do bắt buộc.");
        return;
      }
      if (!manualProductDescription.trim()) {
        setFormError("Nhập mô tả máy bắt buộc.");
        return;
      }
    } else if (!itemCode.trim()) {
      setFormError("Quét hoặc nhập mã máy cần bảo hành.");
      return;
    }
    if (!customerName.trim()) {
      setFormError("Nhập tên khách gửi.");
      return;
    }
    if (!customerPhone.trim()) {
      setFormError("Nhập số điện thoại.");
      return;
    }
    if (!/^0\d{9}$/.test(customerPhone)) {
      setFormError("Số điện thoại phải đủ 10 chữ số và bắt đầu bằng số 0.");
      return;
    }
    if (!reportedDefect.trim()) {
      setFormError("Nhập mô tả lỗi khách phản ánh.");
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
          ? `Đã tạo case ${created.case_code} — mã tạm ${created.temporary_item_code}.`
          : `Đã tạo case bảo hành ${created.case_code}.`,
      );
      await uploadIntakeImages(created);
      await uploadIntakeVideos(created);
      resetForm();
      onCreated(created);
    } catch (error: unknown) {
      const fieldErrors = extractFieldErrorsRaw(error);
      const requestId = getErrorRequestId(error);
      const errorMsg = `${getApiErrorMessage(error, "Không tạo được case bảo hành.")}${
        requestId ? ` — Request ${requestId}` : ""
      }${fieldErrors ? ` (${Object.values(fieldErrors).flat().join("; ")})` : ""}`;
      toast.error(errorMsg);
      setFormError(errorMsg);
    }
  };

  const busy = createMutation.isPending || uploadMutation.isPending;

  return (
    <>
      <Dialog
        {...dialog.dialogProps}
        open={open && dialog.open}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ pr: 6, position: "relative" }}>
          Tiếp nhận bảo hành
          <ActionIconButton
            kind="close"
            label="Đóng"
            onClick={dialog.close}
            sx={{ position: "absolute", right: 10, top: 8 }}
          />
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {formError ? <Alert severity="error">{formError}</Alert> : null}

            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mb: 0.5 }}
              >
                Loại tiếp nhận *
              </Typography>
              <ToggleButtonGroup
                exclusive
                value={identificationType}
                onChange={(
                  _event,
                  value: WarrantyIdentificationType | null,
                ) => {
                  if (value) setIdentificationType(value);
                }}
                size="small"
                color="primary"
              >
                <ToggleButton value="IDENTIFIED">
                  Có mã máy (IDENTIFIED)
                </ToggleButton>
                <ToggleButton value="TEMP_ONLY">
                  Mất mã (TEMP_ONLY)
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {identificationType === "TEMP_ONLY" ? (
              <>
                <Alert severity="warning">
                  Case TEMP_ONLY không liên kết item gốc, không xác nhận lịch sử
                  bán hàng (NOT_TRACEABLE) và không sinh stock movement. Mã tạm
                  sẽ do hệ thống sinh sau khi lưu.
                </Alert>
                <TextField
                  required
                  fullWidth
                  multiline
                  minRows={2}
                  label="Lý do mất/không có mã"
                  value={missingCodeReason}
                  onChange={(event) => setMissingCodeReason(event.target.value)}
                  slotProps={{ htmlInput: { maxLength: 500 } }}
                  helperText={`${missingCodeReason.length}/500`}
                />
                <TextField
                  required
                  fullWidth
                  multiline
                  minRows={2}
                  label="Mô tả nhận diện máy"
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
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mb: 0.5 }}
                >
                  Mã máy / serial / barcode item *
                </Typography>
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
                      placeholder="Quét QR composite / Barcode hoặc nhập serial"
                      onChange={(value) => {
                        setItemCode(value);
                        setResolvedItem(null);
                        setResolveError(null);
                      }}
                      onScan={(code) => void resolveScannedCode(code)}
                    />
                  </Box>
                  <ActionButton
                    kind="camera"
                    onClick={() => setCameraOpen(true)}
                  >
                    Camera
                  </ActionButton>
                </Stack>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mt: 0.5 }}
                >
                  Item phải đã xuất cho khách (ISSUED hoặc RETURNED_TO_CUSTOMER)
                  và chưa có case bảo hành đang hoạt động.
                </Typography>
                {resolvedItem ? (
                  <Alert severity="success" sx={{ mt: 1 }}>
                    {`Đã nhận diện item${
                      resolvedItem.skuCode
                        ? ` · SKU ${resolvedItem.skuCode}`
                        : ""
                    }${resolvedItem.itemUnique ? ` · ${resolvedItem.itemUnique}` : ""}${
                      resolvedItem.objectStatus
                        ? ` · trạng thái ${resolvedItem.objectStatus}`
                        : ""
                    }`}
                  </Alert>
                ) : null}
                {resolveError ? (
                  <Alert severity="warning" sx={{ mt: 1 }}>
                    <Typography variant="body2">{resolveError}</Typography>
                    <Typography variant="caption">
                      Nếu QR hỏng hoặc item không định danh được, chuyển sang
                      tab "Mất mã (TEMP_ONLY)" — hệ thống không tự suy đoán liên
                      kết item.
                    </Typography>
                  </Alert>
                ) : null}
              </Box>
            )}

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  required
                  fullWidth
                  label="Tên khách gửi"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  slotProps={{ htmlInput: { maxLength: 200 } }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  required
                  fullWidth
                  label="Số điện thoại"
                  value={customerPhone}
                  onChange={(event) =>
                    setCustomerPhone(
                      event.target.value.replace(/\D/g, "").slice(0, 10),
                    )
                  }
                  error={
                    Boolean(customerPhone) && !/^0\d{9}$/.test(customerPhone)
                  }
                  helperText={
                    Boolean(customerPhone) && !/^0\d{9}$/.test(customerPhone)
                      ? "Số điện thoại phải đủ 10 chữ số và bắt đầu bằng số 0."
                      : undefined
                  }
                  slotProps={{
                    htmlInput: { maxLength: 10, inputMode: "numeric" },
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 8 }}>
                <TextField
                  fullWidth
                  label="Địa chỉ khách (PII)"
                  value={customerAddress}
                  onChange={(event) => setCustomerAddress(event.target.value)}
                  slotProps={{ htmlInput: { maxLength: 500 } }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  type="date"
                  label="Ngày mua (nếu có)"
                  value={purchaseDate}
                  onChange={(event) => setPurchaseDate(event.target.value)}
                  slotProps={{
                    inputLabel: { shrink: true },
                    htmlInput: { max: dayjs().format("YYYY-MM-DD") },
                  }}
                  helperText="Định dạng: ngày/tháng/năm"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Autocomplete
                  multiple
                  options={defectOptions}
                  value={defectOptions.filter((option) =>
                    defectIds.includes(option.value),
                  )}
                  loading={defectsQuery.isLoading}
                  getOptionLabel={(option) => option.label}
                  isOptionEqualToValue={(option, value) =>
                    option.value === value.value
                  }
                  onChange={(_event, options) =>
                    setDefectIds(options.map((option) => option.value))
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Bệnh / lỗi (danh mục)"
                      placeholder="Chọn từ danh mục bệnh/lỗi"
                    />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Phụ kiện đi kèm"
                  placeholder="VD: Pin 20V, sạc, hộp"
                  value={accessoriesReceived}
                  onChange={(event) =>
                    setAccessoriesReceived(event.target.value)
                  }
                  slotProps={{ htmlInput: { maxLength: 1000 } }}
                />
              </Grid>
            </Grid>

            <TextField
              required
              fullWidth
              multiline
              minRows={3}
              label="Bệnh / lỗi khách phản ánh"
              value={reportedDefect}
              onChange={(event) => setReportedDefect(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 2000 } }}
              helperText={`${reportedDefect.length}/2000`}
            />

            <TextField
              fullWidth
              multiline
              minRows={2}
              label="Tình trạng máy khi tiếp nhận"
              placeholder="VD: Trầy xước nhẹ thân máy, còn nguyên tem"
              value={receivedCondition}
              onChange={(event) => setReceivedCondition(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 500 } }}
              helperText={`${receivedCondition.length}/500`}
            />

            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                {`Ảnh đính kèm (${imageFiles.length}/${MAX_INTAKE_IMAGES})`}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mb: 1 }}
              >
                JPG/PNG/WEBP, tối đa 10 ảnh, mỗi ảnh ≤ 10MB. Ảnh được tải lên
                sau khi case bảo hành được tạo.
              </Typography>
              <Stack
                direction="row"
                spacing={1}
                sx={{ flexWrap: "wrap", rowGap: 1 }}
              >
                {imageFiles.map((file, index) => (
                  <Chip
                    key={`${file.name}-${index}`}
                    label={file.name}
                    onDelete={() =>
                      setImageFiles((current) =>
                        current.filter((_, i) => i !== index),
                      )
                    }
                    deleteIcon={<DeleteOutlined />}
                  />
                ))}
              </Stack>
              {imageFiles.length < MAX_INTAKE_IMAGES ? (
                <ActionButton
                  kind="upload"
                  component="label"
                  disabled={busy}
                  sx={{ mt: 1 }}
                >
                  Tải ảnh
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    multiple
                    hidden
                    onChange={(event) => {
                      addImageFiles(event.target.files);
                      event.target.value = "";
                    }}
                  />
                </ActionButton>
              ) : null}
            </Box>

            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                {`Video đính kèm (${videoFiles.length}/${MAX_INTAKE_VIDEOS})`}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mb: 1 }}
              >
                MP4/MOV/WEBM, tối đa 2 video, mỗi video ≤ 300MB và ≤ 5 phút.
                Video được tải lên sau khi case bảo hành được tạo.
              </Typography>
              <Stack
                direction="row"
                spacing={1}
                sx={{ flexWrap: "wrap", rowGap: 1, mb: 1 }}
              >
                {videoFiles.map((file, index) => (
                  <Chip
                    key={`${file.name}-${index}`}
                    label={file.name}
                    onDelete={() =>
                      setVideoFiles((current) =>
                        current.filter((_, i) => i !== index),
                      )
                    }
                    deleteIcon={<DeleteOutlined />}
                  />
                ))}
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
                  <PlayCircleOutlined
                    style={{ color: ACTION_ICON_COLORS.upload, fontSize: 24 }}
                  />
                  <Typography variant="body2">
                    Kéo thả video vào đây hoặc bấm để chọn
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Tối đa {MAX_INTAKE_VIDEOS} video, mỗi video ≤ 300MB, ≤ 5
                    phút.
                  </Typography>
                  <input
                    type="file"
                    accept=".mp4,.mov,.webm"
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

          <CameraScanModal
            open={cameraOpen}
            title="Quét mã máy bảo hành"
            onDetected={(code) => {
              // Change Pack QR/SKU: gửi RAW payload cho backend resolve — FE không
              // tự tách/parse; classify trả normalized item_code + SKU để tự điền.
              void resolveScannedCode(code);
              setCameraOpen(false);
            }}
            onClose={() => setCameraOpen(false)}
          />
        </DialogContent>
        <DialogActions>
          <ActionButton kind="cancel" onClick={dialog.close} disabled={busy}>
            Hủy
          </ActionButton>
          <ActionButton
            kind="save"
            disabled={busy}
            onClick={() => void submit()}
          >
            {busy ? "Đang lưu..." : "Lưu tiếp nhận"}
          </ActionButton>
        </DialogActions>
      </Dialog>
    </>
  );
}
