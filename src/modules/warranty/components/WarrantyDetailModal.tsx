import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import dayjs from "dayjs";
import { useForm } from "react-hook-form";
import {
  Box,
  Grid,
  MenuItem,
  SEMANTIC_LIGHT,
  Stack,
  UiAlert,
  UiDialog,
  UiFormAutocomplete,
  UiStatusBadge,
  UiTabs,
  UiTextField,
  type UiStatusTone,
  type UiTabItem,
} from "@/shared/ui";
import {
  HistoryOutlined,
  PaperClipOutlined,
  PlayCircleOutlined,
  ProfileOutlined,
  ToolOutlined,
  UploadOutlined,
} from "@/shared/components/icons";
import {
  extractFieldErrorsRaw,
  getApiErrorMessage,
} from "@/shared/api/api-error";
import { ACTION_ICON_COLORS } from "@/shared/theme/actionIconColors";
import { guardBackdropClose } from "@/shared/utils/dialogGuard";
import { useDialogExit } from "@/shared/utils/useDialogExit";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { http } from "@/shared/api/http";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import {
  ResponsiveDataTable,
  type ResponsiveTableColumn,
} from "@/shared/components/data-display/ResponsiveDataTable";
import { useCanAny } from "@/shared/components/permission";
import { useMvpDefects } from "@/modules/master-data/hooks/use-mvp-master";
import { formatDate } from "@/shared/utils/format-date";
import {
  WARRANTY_ATTACHMENT_TYPE_LABELS,
  WARRANTY_BASELINE_STATUSES,
  WARRANTY_DIAGNOSIS_REQUIRED_TARGETS,
  WARRANTY_NEXT_STATUS,
  WARRANTY_NOTE_REQUIRED_LABELS,
  warrantyPiiText,
  WARRANTY_STATUS_COLORS,
  WARRANTY_STATUS_LABELS,
  WARRANTY_TERMINAL_STATUSES,
  formatWarrantyDateTime,
} from "@/modules/warranty/constants";
import {
  useComponentIssues,
  useDeleteWarrantyAttachment,
  useUpdateWarrantyCase,
  useUploadWarrantyAttachment,
  useWarrantyAttachments,
  useWarrantyCase,
  useWarrantyEvents,
} from "@/modules/warranty/hooks/use-warranty";
import { downloadWarrantyAttachment } from "@/modules/warranty/services/warrantyService";
import type { ComponentIssueDocument } from "@/modules/warranty/services/componentIssueService";
import type {
  WarrantyAttachment,
  WarrantyAttachmentType,
  WarrantyCaseStatus,
} from "@/modules/warranty/types";
import { ActionButton, ActionIconButton } from "@/shared/components/actions";
import {
  AnimatedList,
  AnimatedListItem,
  AnimatedInlineList,
  AnimatedInlineItem,
} from "@/shared/components/motion";

const RETURN_ATTACHMENT_TYPES = Object.entries(
  WARRANTY_ATTACHMENT_TYPE_LABELS,
) as Array<[WarrantyAttachmentType, string]>;

// KHÔNG nối request_id: đó là mã tra cứu kỹ thuật cho debug, người dùng đọc
// không hiểu (xem ApiErrorAlert.tsx — request_id chỉ hiện ở dòng phụ có nhãn
// rõ, không bao giờ nối thẳng vào câu chính như toast ở đây).
function errorText(error: unknown, fallback: string): string {
  return getApiErrorMessage(error, fallback);
}

/** Annex D SCR-WAR-01 field `images`: jpg/png/webp. */
const WARRANTY_IMAGE_MIMES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];
const WARRANTY_IMAGE_ACCEPT = ".jpg,.jpeg,.png,.webp";
const MAX_ATTACHMENT_IMAGE_BYTES = 10 * 1024 * 1024;

/** WAR-02: video đính kèm bổ sung được ở màn chi tiết, không chỉ lúc tiếp nhận. */
const WARRANTY_VIDEO_MIMES = ["video/mp4", "video/quicktime", "video/webm"];
const WARRANTY_VIDEO_ACCEPT = ".mp4,.mov,.webm";
const MAX_ATTACHMENT_VIDEO_BYTES = 300 * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds: number | null | undefined): string | null {
  if (!seconds || seconds <= 0) return null;
  const mm = Math.floor(seconds / 60);
  const ss = Math.floor(seconds % 60);
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

/** Tham chiếu ổn định cho danh sách rỗng: dùng làm dependency của effect tải ảnh. */
const EMPTY_ATTACHMENTS: WarrantyAttachment[] = [];

/**
 * Preset màu antd Tag cũ → tone soft-tint của UiStatusBadge (Part 4 Vuexy
 * sync). Màu không nằm trong bảng fail-safe về neutral.
 */
const TAG_COLOR_TO_TONE: Record<string, UiStatusTone> = {
  green: "success",
  success: "success",
  red: "error",
  error: "error",
  volcano: "error",
  orange: "warning",
  gold: "warning",
  warning: "warning",
  blue: "info",
  processing: "info",
  geekblue: "info",
  cyan: "info",
  purple: "primary",
  default: "neutral",
};

function tagTone(color: string | undefined): UiStatusTone {
  return (color ? TAG_COLOR_TO_TONE[color] : undefined) ?? "neutral";
}

type WarrantyDetailTab = "overview" | "media" | "issues" | "history";

/**
 * `media_kind` do BE gắn khi upload; bản ghi cũ (trước WAR-02) có thể trống nên
 * suy thêm từ content_type để ảnh cũ vẫn vào lưới ảnh thay vì rơi xuống "tệp khác".
 */
function isVideoAttachment(attachment: WarrantyAttachment): boolean {
  return (
    attachment.media_kind === "VIDEO" ||
    (attachment.content_type ?? "").startsWith("video/")
  );
}

function isImageAttachment(attachment: WarrantyAttachment): boolean {
  return (
    attachment.media_kind === "IMAGE" ||
    (attachment.content_type ?? "").startsWith("image/")
  );
}

/**
 * Nhãn tệp gợi ý theo trạng thái case: ảnh chụp ở giai đoạn nào gần như luôn
 * thuộc nhãn của giai đoạn đó, nên không bắt người dùng chọn tay mỗi lần tải.
 */
const ATTACHMENT_TYPE_BY_STATUS: Partial<
  Record<WarrantyCaseStatus, WarrantyAttachmentType>
> = {
  RECEIVED: "INTAKE",
  CHECKING: "DIAGNOSTIC",
  REPAIRING: "DIAGNOSTIC",
  COMPLETED: "RETURN",
  RETURNED: "RETURN",
};

/**
 * Ảnh nằm trên private disk (không có URL public) nên phải tải blob qua endpoint
 * download rồi dựng object URL. Tải một lần ở cấp modal và chia sẻ cho cả ô
 * thumbnail lẫn khung xem lớn — nếu để mỗi component tự tải thì mở xem ảnh sẽ
 * gọi mạng lại lần hai cho đúng tệp vừa hiển thị.
 *
 * Video KHÔNG tải trước: một tệp có thể tới 300MB, chỉ hiện icon + thời lượng.
 */
function useAttachmentImageUrls(
  attachments: WarrantyAttachment[],
): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    const created: string[] = [];
    attachments.filter(isImageAttachment).forEach((attachment) => {
      http
        .downloadBlob(
          API_ENDPOINTS.WARRANTY_ATTACHMENT_DOWNLOAD.replace(
            ":id",
            attachment.id,
          ),
        )
        .then((blob) => {
          if (cancelled) return;
          const objectUrl = URL.createObjectURL(blob);
          created.push(objectUrl);
          setUrls((current) => ({ ...current, [attachment.id]: objectUrl }));
        })
        .catch(() => {
          // Ảnh lỗi/không tải được: giữ trống, ô thumbnail render fallback icon.
        });
    });
    return () => {
      cancelled = true;
      created.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
      setUrls({});
    };
  }, [attachments]);
  return urls;
}

const OVERLAY_ICON_BUTTON_SX = {
  width: 22,
  height: 22,
  bgcolor: "rgba(0, 0, 0, 0.55)",
  color: SEMANTIC_LIGHT.onPrimary,
  "&:hover": { bgcolor: "rgba(0, 0, 0, 0.78)" },
} as const;

/** Ba thuộc tính tương đương `noWrap` của MUI Typography cũ. */
const NOWRAP_SX = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
} as const;

interface AttachmentActionProps {
  onDownload: () => void;
  onDelete: () => void;
  canDelete: boolean;
}

/**
 * Ô ảnh vuông kiểu thư viện (giống khối ảnh ở màn Tiếp nhận bảo hành): xem lớn
 * bằng cách bấm vào ảnh, tải/xóa nằm trong lớp phủ nên không chiếm thêm cột.
 */
function ImageAttachmentTile({
  attachment,
  url,
  onPreview,
  onDownload,
  onDelete,
  canDelete,
}: AttachmentActionProps & {
  attachment: WarrantyAttachment;
  url?: string;
  onPreview: () => void;
}) {
  return (
    <Box className="hn-scale-in" sx={{ minWidth: 0 }}>
      <Box
        role="button"
        tabIndex={0}
        aria-label={`Xem ảnh ${attachment.file_name}`}
        onClick={onPreview}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onPreview();
          }
        }}
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
          cursor: "pointer",
          "&:hover .hn-attachment-actions, &:focus-visible .hn-attachment-actions":
            { opacity: 1 },
          "&:hover": { borderColor: "primary.main" },
        }}
      >
        {url ? (
          <Box
            component="img"
            src={url}
            alt={attachment.file_name}
            sx={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          <PaperClipOutlined style={{ fontSize: 18 }} />
        )}
        <Stack
          className="hn-attachment-actions"
          direction="row"
          spacing={0.5}
          sx={{ position: "absolute", top: 4, right: 4, opacity: 0 }}
        >
          <ActionIconButton
            kind="download"
            onClick={(event) => {
              event.stopPropagation();
              onDownload();
            }}
            sx={OVERLAY_ICON_BUTTON_SX}
          />
          {canDelete ? (
            <ActionIconButton
              kind="delete"
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
              sx={OVERLAY_ICON_BUTTON_SX}
            />
          ) : null}
        </Stack>
      </Box>
      {/* Không in tên tệp thô (ảnh từ máy ảnh/điện thoại có tên vô nghĩa): nhãn
          nghiệp vụ + dung lượng mới là thứ người dùng cần, tên tệp nằm ở
          tooltip của ô ảnh và trên khung xem lớn. */}
      <Box
        title={attachment.file_name}
        sx={{
          typography: "caption",
          display: "block",
          mt: 0.5,
          ...NOWRAP_SX,
        }}
      >
        {WARRANTY_ATTACHMENT_TYPE_LABELS[attachment.attachment_type] ??
          attachment.attachment_type}
      </Box>
      <Box
        sx={{
          typography: "caption",
          color: "text.secondary",
          display: "block",
          fontSize: 11,
          ...NOWRAP_SX,
        }}
      >
        {formatBytes(attachment.file_size_bytes)}
      </Box>
    </Box>
  );
}

/** Video/tệp khác: một dòng gọn có icon, tên, dung lượng, thời lượng và thao tác. */
function AttachmentRow({
  attachment,
  icon,
  onDownload,
  onDelete,
  canDelete,
}: AttachmentActionProps & {
  attachment: WarrantyAttachment;
  icon: ReactNode;
}) {
  const durationLabel = formatDuration(attachment.duration_seconds);
  return (
    <Stack
      direction="row"
      spacing={1.25}
      className="hn-scale-in"
      sx={{
        alignItems: "center",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        px: 1.5,
        py: 1,
      }}
    >
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: 1.5,
          bgcolor: "action.hover",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Stack spacing={0} sx={{ minWidth: 0, flexGrow: 1 }}>
        <Box
          title={attachment.file_name}
          sx={{ typography: "body2", fontWeight: 600, ...NOWRAP_SX }}
        >
          {WARRANTY_ATTACHMENT_TYPE_LABELS[attachment.attachment_type] ??
            attachment.attachment_type}
        </Box>
        <Box
          sx={{ typography: "caption", color: "text.secondary", ...NOWRAP_SX }}
        >
          {[
            formatBytes(attachment.file_size_bytes),
            durationLabel,
            formatWarrantyDateTime(attachment.uploaded_at),
          ]
            .filter(Boolean)
            .join(" · ")}
        </Box>
      </Stack>
      <ActionIconButton kind="download" onClick={onDownload} />
      <ActionIconButton
        kind="delete"
        disabled={!canDelete}
        onClick={onDelete}
      />
    </Stack>
  );
}

function DetailField({
  label,
  value,
  span2,
}: {
  label: string;
  value: ReactNode;
  span2?: boolean;
}) {
  return (
    <Grid size={{ xs: 12, md: span2 ? 12 : 6 }}>
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

/**
 * GĐ1-REQ-024: thay MUI Stepper (alternativeLabel) bằng flex row thuần
 * Box/token — chấm tròn + nhãn dưới, thanh nối 2px giữa các bước. Bước bị hủy
 * (errorIndex) tô S.error, tương đương StepLabel error của bản cũ.
 */
function StatusProgressSteps({
  labels,
  activeStep,
  errorIndex,
}: {
  labels: string[];
  activeStep: number;
  errorIndex: number | null;
}) {
  return (
    <Box sx={{ display: "flex", mb: 1 }}>
      {labels.map((label, index) => {
        const isError = errorIndex === index;
        const reached = index <= activeStep;
        const circleColor = isError
          ? SEMANTIC_LIGHT.error
          : reached
            ? SEMANTIC_LIGHT.primary
            : undefined;
        return (
          <Box
            key={label}
            sx={{
              flex: 1,
              minWidth: 0,
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            {index > 0 ? (
              <Box
                sx={{
                  position: "absolute",
                  top: 11,
                  left: "calc(-50% + 20px)",
                  right: "calc(50% + 20px)",
                  height: "2px",
                  bgcolor: reached
                    ? SEMANTIC_LIGHT.primary
                    : SEMANTIC_LIGHT.border,
                }}
              />
            ) : null}
            <Box
              sx={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                flexShrink: 0,
                zIndex: 1,
                bgcolor: circleColor ?? "transparent",
                border: circleColor
                  ? "none"
                  : `2px solid ${SEMANTIC_LIGHT.border}`,
              }}
            />
            <Box
              sx={{
                mt: 0.75,
                typography: "caption",
                textAlign: "center",
                color: isError
                  ? SEMANTIC_LIGHT.error
                  : reached
                    ? SEMANTIC_LIGHT.textHigh
                    : SEMANTIC_LIGHT.textDisabled,
              }}
            >
              {label}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

interface CorrectionFormValues {
  defect_ids: string[];
  estimated_completion_date: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  purchase_date: string;
  reason: string;
}

interface StatusFormValues {
  status: WarrantyCaseStatus | "";
  reason: string;
  confirmed_defect: string;
  cancel_reason: string;
  estimated_completion_date: string;
}

interface WarrantyDetailModalProps {
  caseId: string;
  onClose: () => void;
  onOpenComponentIssue: (input: {
    caseId: string;
    caseCode?: string;
    caseActive: boolean;
    documentId?: string | null;
  }) => void;
}

/**
 * WAR-03 · Chi tiết bảo hành dạng modal (mở từ danh sách WAR-01, không chuyển trang).
 * Gồm: thông tin case (PII mask theo quyền), chẩn đoán, cập nhật trạng thái theo
 * state machine, tệp đính kèm và các phiếu xuất linh kiện gắn với case.
 */
export function WarrantyDetailModal({
  caseId,
  onClose,
  onOpenComponentIssue,
}: WarrantyDetailModalProps) {
  const dialog = useDialogExit(onClose);
  const canManage = useCanAny(["warranty.manage"]);
  const canIssue = useCanAny(["warranty.component_issue"]);
  const canViewPii = useCanAny(["warranty.pii.view"]);

  const detailQuery = useWarrantyCase(caseId);
  const eventsQuery = useWarrantyEvents(caseId);
  const attachmentsQuery = useWarrantyAttachments(caseId);
  const issuesQuery = useComponentIssues(
    { warranty_case_id: caseId, per_page: 50 },
    canIssue,
  );

  const updateMutation = useUpdateWarrantyCase();
  const uploadMutation = useUploadWarrantyAttachment();
  const deleteAttachmentMutation = useDeleteWarrantyAttachment();

  const [statusOpen, setStatusOpen] = useState(false);
  const [statusFieldErrors, setStatusFieldErrors] = useState<
    Record<string, string>
  >({});
  const [statusForm, setStatusForm] = useState<StatusFormValues>({
    status: "",
    reason: "",
    confirmed_defect: "",
    cancel_reason: "",
    estimated_completion_date: "",
  });
  const [correctOpen, setCorrectOpen] = useState(false);
  const [correctFieldErrors, setCorrectFieldErrors] = useState<
    Record<string, string>
  >({});
  const [correctForm, setCorrectForm] = useState<CorrectionFormValues>({
    defect_ids: [],
    estimated_completion_date: "",
    customer_name: "",
    customer_phone: "",
    customer_address: "",
    purchase_date: "",
    reason: "",
  });
  const defectsQuery = useMvpDefects({ status: "ACTIVE", per_page: 100 });
  const defectOptions = (defectsQuery.data?.data ?? []).map((defect) => ({
    value: defect.defect_id,
    label: `${defect.defect_code} · ${defect.defect_name}`,
  }));

  /**
   * Part 4: field defect_ids của correctForm render qua UiFormAutocomplete
   * (RHF Controller bên trong) — mini form CHỈ giữ mỗi field này; nguồn sự
   * thật khi submit vẫn là correctForm (mirror qua watch bên dưới).
   */
  const defectForm = useForm<{ defect_ids: string[] }>({
    defaultValues: { defect_ids: [] },
  });

  useEffect(() => {
    const subscription = defectForm.watch((values) => {
      const defectIds = (values.defect_ids ?? []).filter(
        (id): id is string => typeof id === "string",
      );
      setCorrectForm((current) => ({ ...current, defect_ids: defectIds }));
      // Giữ đúng hành vi onChange cũ: chọn lại thì xoá lỗi của field này.
      setCorrectFieldErrors((current) =>
        current.defect_ids ? { ...current, defect_ids: "" } : current,
      );
    });
    return () => subscription.unsubscribe();
  }, [defectForm]);

  // Lỗi validate/API gán vào correctFieldErrors.defect_ids phải hiện đỏ trong
  // UiFormAutocomplete (fieldState.error) → mirror sang RHF; hết lỗi thì clear.
  const defectFieldError = correctFieldErrors.defect_ids;
  useEffect(() => {
    if (defectFieldError) {
      defectForm.setError("defect_ids", {
        type: "manual",
        message: defectFieldError,
      });
    } else {
      defectForm.clearErrors("defect_ids");
    }
  }, [defectFieldError, defectForm]);

  const [attachmentTypeOverride, setAttachmentTypeOverride] =
    useState<WarrantyAttachmentType | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<WarrantyDetailTab>("overview");
  const statusValue = statusForm.status;

  const detail = detailQuery.data;

  const attachments = attachmentsQuery.data ?? EMPTY_ATTACHMENTS;
  const imageAttachments = attachments.filter(isImageAttachment);
  const videoAttachments = attachments.filter(isVideoAttachment);
  const otherAttachments = attachments.filter(
    (attachment) =>
      !isImageAttachment(attachment) && !isVideoAttachment(attachment),
  );
  const imageUrls = useAttachmentImageUrls(attachments);
  const previewIndex = previewId
    ? imageAttachments.findIndex((attachment) => attachment.id === previewId)
    : -1;
  const previewAttachment =
    previewIndex >= 0 ? imageAttachments[previewIndex] : null;
  // Case đã hủy là bằng chứng đóng băng: không cho bổ sung tệp mới.
  const canUploadAttachment = Boolean(
    canManage && detail && detail.status !== "CANCELLED",
  );

  // Nhãn tệp bám theo giai đoạn của case cho tới khi người dùng tự chọn khác:
  // bớt một thao tác chọn lại mỗi lần tải ảnh ở đúng bước đang làm.
  const attachmentType =
    attachmentTypeOverride ??
    (detail
      ? (ATTACHMENT_TYPE_BY_STATUS[detail.status] ?? "INTAKE")
      : "INTAKE");
  const isTerminal = detail
    ? WARRANTY_TERMINAL_STATUSES.includes(detail.status)
    : true;
  const nextStatuses = detail
    ? (WARRANTY_NEXT_STATUS[detail.status] ?? [])
    : [];
  const caseActive = detail ? !isTerminal : false;
  // DEC-WAR-STATE-001: chan tai form thay vi de BE tra 422 sau moi lan submit.
  const diagnosisRequired = Boolean(
    detail &&
    detail.status === "CHECKING" &&
    statusValue &&
    WARRANTY_DIAGNOSIS_REQUIRED_TARGETS.includes(statusValue) &&
    !detail.confirmed_defect?.trim(),
  );
  const noteRequiredLabel = statusValue
    ? WARRANTY_NOTE_REQUIRED_LABELS[statusValue]
    : undefined;
  // Yêu cầu nghiệp vụ: sau khi kỹ thuật kiểm tra xong (rời CHECKING sang
  // REPAIRING) phải có ngày dự kiến sửa xong để báo khách — chặn ở FE, BE
  // vẫn coi field này là optional nên không đổi hợp đồng API.
  const estimatedDateRequired = Boolean(
    detail &&
    detail.status === "CHECKING" &&
    statusValue === "REPAIRING" &&
    !statusForm.estimated_completion_date,
  );

  // GĐ1-REQ-024: thanh tiến trình 5 bước Tiếp nhận → Kiểm tra → Sửa chữa → Hoàn tất
  // → Trả khách. CANCELLED không phải một bước — hiển thị trạng thái error tại bước
  // đã đạt trước khi hủy (suy từ warranty_event) để không phá flow timeline.
  const stepStatuses = WARRANTY_BASELINE_STATUSES.filter(
    (status) => status !== "CANCELLED",
  );
  const isCancelled = detail?.status === "CANCELLED";
  const cancelEvent = (eventsQuery.data ?? []).find(
    (event) => event.to_status === "CANCELLED",
  );
  const progressStatus = isCancelled
    ? (cancelEvent?.from_status ?? "RECEIVED")
    : detail?.status;
  const stepIndex = Math.max(
    0,
    stepStatuses.indexOf(progressStatus as (typeof stepStatuses)[number]),
  );

  const validateStatusForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!statusForm.status) {
      errors.status = "Chọn trạng thái mới.";
    }
    if (diagnosisRequired && !statusForm.confirmed_defect.trim()) {
      errors.confirmed_defect =
        "Phải ghi kết quả kiểm tra trước khi rời trạng thái CHECKING.";
    }
    if (statusForm.status === "CANCELLED" && !statusForm.cancel_reason.trim()) {
      errors.cancel_reason = "Hủy case cần lý do/bằng chứng.";
    }
    if (estimatedDateRequired) {
      errors.estimated_completion_date =
        "Nhập ngày dự kiến sửa xong để báo khách trước khi chuyển sang Đang sửa chữa.";
    }
    if (noteRequiredLabel && !statusForm.reason.trim()) {
      errors.reason = noteRequiredLabel;
    }
    setStatusFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submitStatus = async () => {
    if (!detail) return;
    if (!validateStatusForm()) return;
    try {
      const updated = await updateMutation.mutateAsync({
        id: detail.id,
        request: {
          status: statusForm.status || undefined,
          reason: statusForm.reason.trim() || undefined,
          confirmed_defect: statusForm.confirmed_defect.trim() || undefined,
          cancel_reason: statusForm.cancel_reason.trim() || undefined,
          estimated_completion_date:
            statusForm.estimated_completion_date || undefined,
          ifMatch: detail.version,
        },
      });
      toast.success(
        `Đã cập nhật case ${updated.case_code} → ${
          WARRANTY_STATUS_LABELS[updated.status] ?? updated.status
        }.`,
      );
      setStatusForm({
        status: "",
        reason: "",
        confirmed_defect: "",
        cancel_reason: "",
        estimated_completion_date: "",
      });
      setStatusFieldErrors({});
      setStatusOpen(false);
    } catch (error: unknown) {
      const apiFieldErrors = extractFieldErrorsRaw(error);
      const message = errorText(error, "Không cập nhật được trạng thái.");
      toast.error(
        apiFieldErrors
          ? `${message} (${Object.values(apiFieldErrors).flat().join("; ")})`
          : message,
      );
      if (apiFieldErrors) {
        setStatusFieldErrors((current) => ({ ...current, ...apiFieldErrors }));
      }
    }
  };

  /**
   * Annex D SCR-WAR-01: chẩn đoán và PII phải sửa được sau tiếp nhận (nhập sai lúc nhận
   * máy không được buộc mở case mới). PII chỉ gửi khi actor có warranty.pii.view — nếu
   * không, giá trị đang thấy là chuỗi mask và ghi lại sẽ phá dữ liệu thật.
   */
  const validateCorrectionForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (
      canViewPii &&
      correctForm.customer_phone &&
      !/^0\d{9}$/.test(correctForm.customer_phone)
    ) {
      errors.customer_phone =
        "Số điện thoại phải đủ 10 chữ số và bắt đầu bằng số 0.";
    }
    setCorrectFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submitCorrection = async () => {
    if (!detail) return;
    if (!validateCorrectionForm()) return;
    try {
      await updateMutation.mutateAsync({
        id: detail.id,
        request: {
          defect_ids: correctForm.defect_ids,
          estimated_completion_date:
            correctForm.estimated_completion_date || undefined,
          customer_name: canViewPii
            ? correctForm.customer_name.trim() || undefined
            : undefined,
          customer_phone: canViewPii
            ? correctForm.customer_phone.trim() || undefined
            : undefined,
          customer_address: canViewPii
            ? correctForm.customer_address.trim() || undefined
            : undefined,
          purchase_date: correctForm.purchase_date || undefined,
          reason: correctForm.reason.trim() || "Hiệu chỉnh dữ liệu tiếp nhận",
          ifMatch: detail.version,
        },
      });
      toast.success("Đã cập nhật thông tin case.");
      setCorrectFieldErrors({});
      setCorrectOpen(false);
    } catch (error: unknown) {
      const apiFieldErrors = extractFieldErrorsRaw(error);
      const message = errorText(error, "Không cập nhật được thông tin case.");
      toast.error(
        apiFieldErrors
          ? `${message} (${Object.values(apiFieldErrors).flat().join("; ")})`
          : message,
      );
      if (apiFieldErrors) {
        setCorrectFieldErrors((current) => ({ ...current, ...apiFieldErrors }));
      }
    }
  };

  const handleFileSelected = (file: File | undefined) => {
    if (!file) return;
    const isImage = WARRANTY_IMAGE_MIMES.includes(file.type);
    const isVideo = WARRANTY_VIDEO_MIMES.includes(file.type);
    if (!isImage && !isVideo) {
      toast.error(
        `${file.name}: chỉ nhận ảnh JPG/PNG/WEBP hoặc video MP4/MOV/WEBM.`,
      );
      return;
    }
    if (isImage && file.size > MAX_ATTACHMENT_IMAGE_BYTES) {
      toast.error(`${file.name}: ảnh vượt quá 10MB.`);
      return;
    }
    if (isVideo && file.size > MAX_ATTACHMENT_VIDEO_BYTES) {
      toast.error(`${file.name}: video vượt quá 300MB.`);
      return;
    }
    uploadMutation
      .mutateAsync({ caseId, file, attachmentType })
      .then(() => toast.success(`Đã tải lên ${file.name}.`))
      .catch((error: unknown) =>
        toast.error(errorText(error, "Tải tệp lên thất bại.")),
      );
  };

  const handleFilesDropped = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    // BE nhận 1 file/request; kéo-thả nhiều tệp thì tải tuần tự từng cái.
    Array.from(files).forEach((file) => handleFileSelected(file));
  };

  const handleDownloadAttachment = (attachment: WarrantyAttachment) => {
    downloadWarrantyAttachment({
      attachmentId: attachment.id,
      fileName: attachment.file_name,
    }).catch((error: unknown) =>
      toast.error(errorText(error, "Tải tệp xuống thất bại.")),
    );
  };

  const issueColumns: ResponsiveTableColumn<ComponentIssueDocument>[] = [
    {
      key: "component_issue_no",
      header: "Phiếu xuất linh kiện",
      render: (row) => (
        <ActionButton
          kind="detail"
          sx={{ px: 0.5, minWidth: 0 }}
          onClick={() =>
            onOpenComponentIssue({
              caseId,
              caseCode: detail?.case_code,
              caseActive,
              documentId: row.id,
            })
          }
        >
          {row.component_issue_no}
        </ActionButton>
      ),
    },
    {
      key: "document_date",
      header: "Ngày chứng từ",
      width: 130,
      render: (row) => formatDate(row.document_date),
    },
    {
      key: "status",
      header: "Trạng thái",
      width: 120,
      render: (row) => (
        <UiStatusBadge
          tone={
            row.status === "POSTED"
              ? "success"
              : row.status === "CANCELLED"
                ? "error"
                : "info"
          }
          label={row.status}
        />
      ),
    },
  ];

  const tabItems: UiTabItem[] = [
    {
      key: "overview",
      label: (
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
          <ProfileOutlined style={{ fontSize: 15 }} />
          <span>Tổng quan</span>
        </Stack>
      ),
    },
    {
      key: "media",
      label: (
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
          <PaperClipOutlined style={{ fontSize: 15 }} />
          <span>{`Ảnh & video (${attachments.length})`}</span>
        </Stack>
      ),
    },
    ...(canIssue
      ? [
          {
            key: "issues",
            label: (
              <Stack
                direction="row"
                spacing={0.75}
                sx={{ alignItems: "center" }}
              >
                <ToolOutlined style={{ fontSize: 15 }} />
                <span>{`Linh kiện (${issuesQuery.data?.data.length ?? 0})`}</span>
              </Stack>
            ),
          },
        ]
      : []),
    {
      key: "history",
      label: (
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
          <HistoryOutlined style={{ fontSize: 15 }} />
          <span>{`Lịch sử (${eventsQuery.data?.length ?? 0})`}</span>
        </Stack>
      ),
    },
  ];

  return (
    <>
      <UiDialog
        {...dialog.dialogProps}
        maxWidth="lg"
        fullWidth
        sx={{
          "& .MuiDialogTitle-root": { pr: 6, position: "relative", pb: 1 },
        }}
        title={
          <>
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.5 }}
            >
              <span>{detail?.case_code ?? "Chi tiết bảo hành"}</span>
              {detail ? (
                <UiStatusBadge
                  tone={tagTone(WARRANTY_STATUS_COLORS[detail.status])}
                  label={WARRANTY_STATUS_LABELS[detail.status] ?? detail.status}
                />
              ) : null}
              {detail?.identification_type === "TEMP_ONLY" ? (
                <UiStatusBadge tone="warning" label="TEMP_ONLY" />
              ) : null}
            </Stack>
            {/* Dòng tóm tắt: máy · khách · ngày nhận luôn thấy ở mọi tab, đỡ phải
                quay lại tab Tổng quan chỉ để đối chiếu đang xử lý case của ai. */}
            {detail ? (
              <Box
                component="span"
                sx={{
                  typography: "caption",
                  color: "text.secondary",
                  display: "block",
                  mt: 0.25,
                }}
              >
                {[
                  detail.identification_type === "TEMP_ONLY"
                    ? detail.temporary_item_code
                    : (detail.item_code ?? detail.serial_number),
                  detail.sku || detail.sku_name,
                  warrantyPiiText(detail.customer_name, canViewPii, "name"),
                  `Nhận ${formatWarrantyDateTime(detail.received_at)}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Box>
            ) : null}
            <ActionIconButton
              kind="close"
              label="Đóng"
              onClick={dialog.close}
              sx={{ position: "absolute", right: 10, top: 8 }}
            />
          </>
        }
        actions={
          <>
            <ActionButton kind="close" onClick={dialog.close}>
              Đóng
            </ActionButton>
            <ActionButton
              kind="edit"
              disabled={!canManage || !detail || isTerminal}
              onClick={() => {
                if (!detail) return;
                const initialDefectIds =
                  detail.defect_ids ??
                  (detail.defect_id ? [detail.defect_id] : []);
                setCorrectForm({
                  defect_ids: initialDefectIds,
                  estimated_completion_date:
                    detail.estimated_completion_date ?? "",
                  customer_name: canViewPii ? (detail.customer_name ?? "") : "",
                  customer_phone: canViewPii
                    ? (detail.customer_phone ?? "")
                    : "",
                  customer_address: canViewPii
                    ? (detail.customer_address ?? "")
                    : "",
                  purchase_date: detail.purchase_date ?? "",
                  reason: "",
                });
                defectForm.reset({ defect_ids: initialDefectIds });
                setCorrectFieldErrors({});
                setCorrectOpen(true);
              }}
            >
              Sửa thông tin
            </ActionButton>
            <ActionButton
              kind="repair"
              disabled={!canIssue || !detail}
              onClick={() =>
                detail &&
                onOpenComponentIssue({
                  caseId,
                  caseCode: detail.case_code,
                  caseActive,
                  documentId: null,
                })
              }
            >
              Xuất linh kiện
            </ActionButton>
            <ActionButton
              kind="sync"
              disabled={!canManage || isTerminal || nextStatuses.length === 0}
              onClick={() => {
                if (!detail) return;
                setStatusForm({
                  status: nextStatuses[0],
                  reason: "",
                  confirmed_defect: "",
                  cancel_reason: "",
                  estimated_completion_date:
                    detail.estimated_completion_date ?? "",
                });
                setStatusFieldErrors({});
                setStatusOpen(true);
              }}
            >
              Cập nhật trạng thái
            </ActionButton>
          </>
        }
      >
        {/* Thanh tiến trình + tab ở đầu vùng nội dung (mx âm để border chạy hết
            bề ngang dialog như khi còn nằm ngoài DialogContent). */}
        <Box
          sx={{
            px: 3,
            mx: -3,
            mb: 2.5,
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          {detail ? (
            <StatusProgressSteps
              labels={stepStatuses.map(
                (status) => WARRANTY_STATUS_LABELS[status] ?? status,
              )}
              activeStep={stepIndex}
              errorIndex={isCancelled ? stepIndex : null}
            />
          ) : null}
          <UiTabs
            items={tabItems}
            value={activeTab}
            onChange={(key) => setActiveTab(key as WarrantyDetailTab)}
          />
        </Box>

        <Stack spacing={2}>
          <ApiErrorAlert
            error={detailQuery.error}
            title="Không tải được chi tiết case"
            onRetry={() => detailQuery.refetch()}
          />

          {detail && isCancelled ? (
            <UiAlert tone="error">
              {`Case đã hủy tại bước "${
                WARRANTY_STATUS_LABELS[progressStatus ?? "RECEIVED"] ??
                progressStatus
              }". Lý do: ${detail.cancel_reason ?? "—"}`}
            </UiAlert>
          ) : null}

          {!canViewPii && activeTab === "overview" ? (
            <UiAlert tone="info">
              Thông tin khách hàng đang được che (mask) theo quyền
              warranty.pii.view.
            </UiAlert>
          ) : null}

          {activeTab === "history" ? (
            <Box
              className="hn-fade-in-up"
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                p: 2,
              }}
            >
              <Box sx={{ typography: "subtitle2", fontWeight: 700, mb: 1.5 }}>
                Lịch sử xử lý
              </Box>
              {(eventsQuery.data ?? []).length ? (
                <Stack spacing={1.25}>
                  {(eventsQuery.data ?? []).map((event, index) => (
                    <Stack
                      key={`${event.to_status}-${index}`}
                      direction="row"
                      spacing={1.25}
                      sx={{ alignItems: "flex-start" }}
                    >
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          bgcolor: `${WARRANTY_STATUS_COLORS[event.to_status] ?? "primary"}.main`,
                          mt: "6px",
                          flexShrink: 0,
                        }}
                      />
                      <Stack spacing={0}>
                        <Box sx={{ typography: "body2", fontWeight: 700 }}>
                          {event.event_type === "NOTE"
                            ? "Ghi chú xử lý"
                            : (WARRANTY_STATUS_LABELS[event.to_status] ??
                              event.to_status)}
                        </Box>
                        <Box
                          sx={{
                            typography: "caption",
                            color: "text.secondary",
                          }}
                        >
                          {formatWarrantyDateTime(event.performed_at)}
                          {event.performed_by && event.performed_by !== "-"
                            ? ` · ${event.performed_by}`
                            : ""}
                        </Box>
                        <Box sx={{ typography: "body2" }}>
                          {event.description}
                        </Box>
                      </Stack>
                    </Stack>
                  ))}
                </Stack>
              ) : (
                <Box sx={{ typography: "body2", color: "text.secondary" }}>
                  Chưa có lịch sử trạng thái cho case này.
                </Box>
              )}
            </Box>
          ) : null}

          {detail ? (
            <Stack spacing={2}>
              {activeTab === "overview" ? (
                <Grid className="hn-fade-in-up" container spacing={2}>
                  <Grid size={{ xs: 12, lg: 6 }}>
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
                        }}
                      >
                        Khách hàng & tiếp nhận
                      </Box>
                      <Grid container spacing={2}>
                        {/* §13.8: mask lại ở tầng render — không tin payload đã mask sẵn. */}
                        <DetailField
                          label="Khách gửi"
                          value={
                            warrantyPiiText(
                              detail.customer_name,
                              canViewPii,
                              "name",
                            ) || "—"
                          }
                        />
                        <DetailField
                          label="SĐT"
                          value={
                            warrantyPiiText(
                              detail.customer_phone,
                              canViewPii,
                              "phone",
                            ) || "—"
                          }
                        />
                        <DetailField
                          label="Địa chỉ"
                          value={
                            warrantyPiiText(
                              detail.customer_address,
                              canViewPii,
                              "address",
                            ) || "—"
                          }
                        />
                        <DetailField
                          label="Ngày mua"
                          value={
                            detail.purchase_date
                              ? formatDate(detail.purchase_date)
                              : "—"
                          }
                        />
                        <DetailField
                          label="Ngày tiếp nhận"
                          value={formatWarrantyDateTime(detail.received_at)}
                        />
                        <DetailField
                          label="Phụ kiện đi kèm"
                          value={detail.accessories_received ?? "—"}
                        />
                        <DetailField
                          label="Tình trạng tiếp nhận"
                          value={detail.received_condition ?? "—"}
                          span2
                        />
                      </Grid>
                    </Box>
                  </Grid>

                  <Grid size={{ xs: 12, lg: 6 }}>
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
                        }}
                      >
                        Máy & chẩn đoán
                      </Box>
                      <Grid container spacing={2}>
                        <DetailField
                          label="Item / serial / mã tạm"
                          value={
                            detail.identification_type === "TEMP_ONLY"
                              ? (detail.temporary_item_code ?? "—")
                              : (detail.item_code ??
                                detail.serial_number ??
                                "—")
                          }
                        />
                        <DetailField
                          label="SKU / model"
                          value={detail.sku || detail.sku_name || "—"}
                        />
                        <DetailField
                          label="Trạng thái item"
                          value={detail.item_status ?? "—"}
                        />
                        <DetailField
                          label="Bệnh / lỗi (danh mục)"
                          value={
                            detail.defects?.length ? (
                              <Stack
                                direction="row"
                                spacing={0.5}
                                sx={{ flexWrap: "wrap", rowGap: 0.5 }}
                              >
                                {detail.defects.map((defect) => (
                                  <UiStatusBadge
                                    key={defect.defect_id}
                                    tone={
                                      defect.is_primary ? "info" : "neutral"
                                    }
                                    label={
                                      defect.defect_code
                                        ? `${defect.defect_code} · ${defect.defect_name}`
                                        : defect.defect_name
                                    }
                                  />
                                ))}
                              </Stack>
                            ) : detail.defect_code ? (
                              `${detail.defect_code} · ${detail.defect}`
                            ) : (
                              (detail.defect ?? "—")
                            )
                          }
                        />
                        <DetailField
                          label="Khách phản ánh"
                          value={detail.reported_defect ?? "—"}
                          span2
                        />
                        <DetailField
                          label="Kết quả kiểm tra"
                          value={detail.confirmed_defect ?? "Chưa có kết luận"}
                          span2
                        />
                        {detail.identification_type === "TEMP_ONLY" ? (
                          <>
                            <DetailField
                              label="Lý do mất mã"
                              value={detail.missing_code_reason ?? "—"}
                            />
                            <DetailField
                              label="Mô tả nhận diện"
                              value={detail.manual_product_description ?? "—"}
                            />
                          </>
                        ) : null}
                        {detail.status === "CANCELLED" ? (
                          <DetailField
                            label="Lý do hủy"
                            value={detail.cancel_reason ?? "—"}
                            span2
                          />
                        ) : null}
                        <DetailField
                          label="Dự kiến hoàn thành"
                          value={
                            detail.estimated_completion_date
                              ? formatDate(detail.estimated_completion_date)
                              : "—"
                          }
                        />
                        <DetailField
                          label="Hoàn tất sửa"
                          value={formatWarrantyDateTime(detail.completed_at)}
                        />
                        <DetailField
                          label="Trả khách"
                          value={formatWarrantyDateTime(detail.returned_at)}
                        />
                      </Grid>
                    </Box>
                  </Grid>
                </Grid>
              ) : null}

              {activeTab === "media" ? (
                <Stack className="hn-fade-in-up" spacing={2.5}>
                  {canUploadAttachment ? (
                    <UiTextField
                      select
                      label="Nhãn cho tệp sắp tải lên"
                      value={attachmentType}
                      onChange={(event) =>
                        setAttachmentTypeOverride(
                          event.target.value as WarrantyAttachmentType,
                        )
                      }
                      helperText="Đang gợi ý theo bước hiện tại của case; đổi nếu ảnh thuộc bước khác."
                      sx={{ maxWidth: 320 }}
                    >
                      {RETURN_ATTACHMENT_TYPES.map(([value, label]) => (
                        <MenuItem key={value} value={value}>
                          {label}
                        </MenuItem>
                      ))}
                    </UiTextField>
                  ) : null}

                  <Box>
                    <Box
                      sx={{ typography: "subtitle2", fontWeight: 700, mb: 0.5 }}
                    >
                      {`Ảnh đính kèm (${imageAttachments.length})`}
                    </Box>
                    <Box
                      sx={{
                        typography: "caption",
                        color: "text.secondary",
                        display: "block",
                        mb: 1,
                      }}
                    >
                      JPG/PNG/WEBP, mỗi ảnh ≤ 10MB. Bấm vào ảnh để xem lớn; di
                      chuột vào ảnh để tải xuống hoặc xóa.
                    </Box>
                    {attachmentsQuery.isLoading ? (
                      <Box
                        sx={{ typography: "body2", color: "text.secondary" }}
                      >
                        Đang tải danh sách tệp…
                      </Box>
                    ) : (
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fill, minmax(112px, 1fr))",
                          gap: 1.5,
                        }}
                      >
                        <AnimatedInlineList>
                          {imageAttachments.map((attachment) => (
                            <AnimatedInlineItem key={attachment.id}>
                              <ImageAttachmentTile
                                attachment={attachment}
                                url={imageUrls[attachment.id]}
                                canDelete={canManage}
                                onPreview={() => setPreviewId(attachment.id)}
                                onDownload={() =>
                                  handleDownloadAttachment(attachment)
                                }
                                onDelete={() =>
                                  setDeleteConfirmId(attachment.id)
                                }
                              />
                            </AnimatedInlineItem>
                          ))}
                        </AnimatedInlineList>
                        {canUploadAttachment ? (
                          <Box
                            component="label"
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={(event) => {
                              event.preventDefault();
                              handleFilesDropped(event.dataTransfer.files);
                            }}
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
                              cursor: uploadMutation.isPending
                                ? "not-allowed"
                                : "pointer",
                              opacity: uploadMutation.isPending ? 0.6 : 1,
                              "&:hover": uploadMutation.isPending
                                ? undefined
                                : {
                                    borderColor: "primary.main",
                                    color: "primary.main",
                                  },
                            }}
                          >
                            <UploadOutlined style={{ fontSize: 18 }} />
                            <Box
                              component="span"
                              sx={{ typography: "caption" }}
                            >
                              {uploadMutation.isPending
                                ? "Đang tải…"
                                : "Tải ảnh"}
                            </Box>
                            <input
                              type="file"
                              accept={WARRANTY_IMAGE_ACCEPT}
                              multiple
                              hidden
                              disabled={uploadMutation.isPending}
                              onChange={(event) => {
                                handleFilesDropped(event.target.files);
                                event.target.value = "";
                              }}
                            />
                          </Box>
                        ) : null}
                        {!imageAttachments.length && !canUploadAttachment ? (
                          <Box
                            sx={{
                              typography: "body2",
                              color: "text.secondary",
                            }}
                          >
                            Chưa có ảnh đính kèm.
                          </Box>
                        ) : null}
                      </Box>
                    )}
                  </Box>

                  <Box>
                    <Box
                      sx={{ typography: "subtitle2", fontWeight: 700, mb: 0.5 }}
                    >
                      {`Video đính kèm (${videoAttachments.length})`}
                    </Box>
                    <Box
                      sx={{
                        typography: "caption",
                        color: "text.secondary",
                        display: "block",
                        mb: 1,
                      }}
                    >
                      MP4/MOV/WEBM, mỗi video ≤ 300MB. Video không xem trước
                      trong modal — tải xuống để mở.
                    </Box>
                    {/* Không đặt `spacing` ở Stack: khi một dòng thu về 0 thì
                        khoảng cách vẫn còn rồi mất đột ngột — khoảng cách nằm
                        trong `gap` của từng item để co cùng chiều cao. */}
                    <Stack sx={{ mb: videoAttachments.length ? 1.5 : 0 }}>
                      <AnimatedList>
                        {videoAttachments.map((attachment) => (
                          <AnimatedListItem key={attachment.id} gap={8}>
                            <AttachmentRow
                              attachment={attachment}
                              icon={
                                <PlayCircleOutlined
                                  style={{
                                    color: ACTION_ICON_COLORS.upload,
                                    fontSize: 18,
                                  }}
                                />
                              }
                              canDelete={canManage}
                              onDownload={() =>
                                handleDownloadAttachment(attachment)
                              }
                              onDelete={() => setDeleteConfirmId(attachment.id)}
                            />
                          </AnimatedListItem>
                        ))}
                      </AnimatedList>
                    </Stack>
                    {canUploadAttachment ? (
                      <Box
                        component="label"
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          handleFilesDropped(event.dataTransfer.files);
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
                          cursor: uploadMutation.isPending
                            ? "not-allowed"
                            : "pointer",
                          opacity: uploadMutation.isPending ? 0.6 : 1,
                          "&:hover": uploadMutation.isPending
                            ? undefined
                            : {
                                borderColor: "primary.main",
                                color: "primary.main",
                              },
                        }}
                      >
                        <PlayCircleOutlined
                          style={{
                            color: ACTION_ICON_COLORS.upload,
                            fontSize: 24,
                          }}
                        />
                        <Box sx={{ typography: "body2" }}>
                          Kéo thả video vào đây hoặc bấm để chọn
                        </Box>
                        <Box
                          component="span"
                          sx={{
                            typography: "caption",
                            color: "text.secondary",
                          }}
                        >
                          MP4/MOV/WEBM, mỗi video ≤ 300MB.
                        </Box>
                        <input
                          type="file"
                          accept={WARRANTY_VIDEO_ACCEPT}
                          multiple
                          hidden
                          disabled={uploadMutation.isPending}
                          onChange={(event) => {
                            handleFilesDropped(event.target.files);
                            event.target.value = "";
                          }}
                        />
                      </Box>
                    ) : videoAttachments.length ? null : (
                      <Box
                        sx={{ typography: "body2", color: "text.secondary" }}
                      >
                        Chưa có video đính kèm.
                      </Box>
                    )}
                  </Box>

                  {otherAttachments.length ? (
                    <Box>
                      <Box
                        sx={{ typography: "subtitle2", fontWeight: 700, mb: 1 }}
                      >
                        {`Tệp khác (${otherAttachments.length})`}
                      </Box>
                      <Stack>
                        <AnimatedList>
                          {otherAttachments.map((attachment) => (
                            <AnimatedListItem key={attachment.id} gap={8}>
                              <AttachmentRow
                                attachment={attachment}
                                icon={
                                  <PaperClipOutlined style={{ fontSize: 16 }} />
                                }
                                canDelete={canManage}
                                onDownload={() =>
                                  handleDownloadAttachment(attachment)
                                }
                                onDelete={() =>
                                  setDeleteConfirmId(attachment.id)
                                }
                              />
                            </AnimatedListItem>
                          ))}
                        </AnimatedList>
                      </Stack>
                    </Box>
                  ) : null}
                </Stack>
              ) : null}

              {canIssue && activeTab === "issues" ? (
                <Box
                  className="hn-fade-in-up"
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    p: 2,
                  }}
                >
                  <Box
                    sx={{ typography: "subtitle2", fontWeight: 700, mb: 1.5 }}
                  >
                    {`Phiếu xuất linh kiện của phiếu bảo hành (${issuesQuery.data?.data.length ?? 0})`}
                  </Box>
                  <ResponsiveDataTable
                    columns={issueColumns}
                    rows={issuesQuery.data?.data ?? []}
                    rowKey={(row) => row.id}
                    loading={issuesQuery.isLoading}
                    emptyText="Chưa có phiếu xuất linh kiện — dùng nút “Xuất linh kiện” để tạo."
                  />
                </Box>
              ) : null}
            </Stack>
          ) : null}
        </Stack>

        {/* Xem ảnh ngay trong modal: trước đây muốn nhìn ảnh phải tải tệp về
            máy rồi mở bằng ứng dụng ngoài. */}
        <UiDialog
          open={previewAttachment !== null}
          onClose={() => setPreviewId(null)}
          maxWidth="lg"
          fullWidth
          // Giữ accessible name cũ: bỏ aria-labelledby tự sinh để aria-label thắng.
          aria-labelledby={undefined}
          aria-label="Xem ảnh đính kèm"
          sx={{
            "& .MuiDialogTitle-root": { pr: 6, position: "relative" },
            "& .MuiDialogContent-root": {
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: "action.hover",
              minHeight: 320,
            },
          }}
          title={
            <>
              {/* component="span": DialogTitle đã là <h2>, lồng block element vào sẽ vỡ HTML. */}
              <Box
                component="span"
                sx={{
                  typography: "subtitle1",
                  fontWeight: 700,
                  display: "block",
                  ...NOWRAP_SX,
                }}
              >
                {previewAttachment
                  ? (WARRANTY_ATTACHMENT_TYPE_LABELS[
                      previewAttachment.attachment_type
                    ] ?? previewAttachment.attachment_type)
                  : ""}
              </Box>
              <Box
                component="span"
                sx={{
                  typography: "caption",
                  color: "text.secondary",
                  display: "block",
                }}
              >
                {previewAttachment
                  ? `${previewIndex + 1}/${imageAttachments.length} · ${formatBytes(
                      previewAttachment.file_size_bytes,
                    )} · ${formatWarrantyDateTime(
                      previewAttachment.uploaded_at,
                    )} · ${previewAttachment.file_name}`
                  : null}
              </Box>
              <ActionIconButton
                kind="close"
                label="Đóng xem ảnh"
                onClick={() => setPreviewId(null)}
                sx={{ position: "absolute", right: 10, top: 8 }}
              />
            </>
          }
          actions={
            <>
              <ActionButton
                kind="back"
                disabled={previewIndex <= 0}
                onClick={() =>
                  setPreviewId(imageAttachments[previewIndex - 1]?.id ?? null)
                }
              >
                Ảnh trước
              </ActionButton>
              <ActionButton
                kind="next"
                disabled={
                  previewIndex < 0 ||
                  previewIndex >= imageAttachments.length - 1
                }
                onClick={() =>
                  setPreviewId(imageAttachments[previewIndex + 1]?.id ?? null)
                }
              >
                Ảnh sau
              </ActionButton>
              <Box sx={{ flexGrow: 1 }} />
              <ActionButton
                kind="download"
                onClick={() =>
                  previewAttachment &&
                  handleDownloadAttachment(previewAttachment)
                }
              >
                Tải xuống
              </ActionButton>
              <ActionButton kind="close" onClick={() => setPreviewId(null)}>
                Đóng
              </ActionButton>
            </>
          }
        >
          {previewAttachment && imageUrls[previewAttachment.id] ? (
            <Box
              component="img"
              src={imageUrls[previewAttachment.id]}
              alt={previewAttachment.file_name}
              sx={{
                maxWidth: "100%",
                maxHeight: "68vh",
                objectFit: "contain",
                display: "block",
              }}
            />
          ) : (
            <Box sx={{ typography: "body2", color: "text.secondary" }}>
              Không hiển thị được ảnh — tải tệp xuống để xem.
            </Box>
          )}
        </UiDialog>

        <UiDialog
          open={deleteConfirmId !== null}
          onClose={() => setDeleteConfirmId(null)}
          maxWidth="xs"
          fullWidth
          title="Xóa tệp đính kèm này?"
          actions={
            <>
              <ActionButton
                kind="cancel"
                onClick={() => setDeleteConfirmId(null)}
                disabled={deleteAttachmentMutation.isPending}
              >
                Không
              </ActionButton>
              <ActionButton
                kind="delete"
                disabled={deleteAttachmentMutation.isPending}
                onClick={() => {
                  if (!deleteConfirmId) return;
                  deleteAttachmentMutation
                    .mutateAsync(deleteConfirmId)
                    .then(() => {
                      toast.success("Đã xóa tệp đính kèm.");
                      if (previewId === deleteConfirmId) setPreviewId(null);
                      setDeleteConfirmId(null);
                    })
                    .catch((error: unknown) =>
                      toast.error(errorText(error, "Không xóa được tệp.")),
                    );
                }}
              >
                Xóa
              </ActionButton>
            </>
          }
        >
          <Box sx={{ typography: "body2" }}>
            {attachments.find((attachment) => attachment.id === deleteConfirmId)
              ?.file_name ?? ""}
          </Box>
          <Box
            component="span"
            sx={{ typography: "caption", color: "text.secondary" }}
          >
            Tệp bị gỡ khỏi hồ sơ bảo hành và không khôi phục được từ màn này.
          </Box>
        </UiDialog>

        <UiDialog
          open={correctOpen}
          onClose={guardBackdropClose(() => {
            setCorrectOpen(false);
            setCorrectFieldErrors({});
          })}
          maxWidth="sm"
          fullWidth
          aria-label="Sửa thông tin case bảo hành"
          title="Sửa thông tin case bảo hành"
          actions={
            <>
              <ActionButton
                kind="cancel"
                onClick={() => {
                  setCorrectOpen(false);
                  setCorrectFieldErrors({});
                }}
                disabled={updateMutation.isPending}
              >
                Hủy
              </ActionButton>
              <ActionButton
                kind="save"
                onClick={() => void submitCorrection()}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? "Đang lưu..." : "Lưu"}
              </ActionButton>
            </>
          }
        >
          <Grid container spacing={2}>
            <Grid size={12}>
              <UiAlert tone="info">
                {canViewPii
                  ? "Sửa thông tin là stock-neutral; mọi thay đổi được ghi audit (không lưu giá trị PII vào log) và tăng version."
                  : "Bạn không có quyền warranty.pii.view nên chỉ sửa được bệnh/lỗi và ngày mua; thông tin khách hàng bị khóa."}
              </UiAlert>
            </Grid>
            <Grid size={12}>
              <UiFormAutocomplete
                control={defectForm.control}
                name="defect_ids"
                multiple
                options={defectOptions}
                label="Bệnh / lỗi (danh mục)"
                placeholder="Chọn từ danh mục bệnh/lỗi ACTIVE"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <UiTextField
                fullWidth
                type="date"
                label="Ngày dự kiến sửa xong"
                value={correctForm.estimated_completion_date}
                onChange={(event) => {
                  setCorrectForm((current) => ({
                    ...current,
                    estimated_completion_date: event.target.value,
                  }));
                  if (correctFieldErrors.estimated_completion_date) {
                    setCorrectFieldErrors((current) => ({
                      ...current,
                      estimated_completion_date: "",
                    }));
                  }
                }}
                error={Boolean(correctFieldErrors.estimated_completion_date)}
                helperText={correctFieldErrors.estimated_completion_date}
                slotProps={{
                  inputLabel: { shrink: true },
                  htmlInput: { min: dayjs().format("YYYY-MM-DD") },
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <UiTextField
                fullWidth
                type="date"
                label="Ngày mua"
                value={correctForm.purchase_date}
                onChange={(event) => {
                  setCorrectForm((current) => ({
                    ...current,
                    purchase_date: event.target.value,
                  }));
                  if (correctFieldErrors.purchase_date) {
                    setCorrectFieldErrors((current) => ({
                      ...current,
                      purchase_date: "",
                    }));
                  }
                }}
                error={Boolean(correctFieldErrors.purchase_date)}
                helperText={correctFieldErrors.purchase_date}
                slotProps={{
                  inputLabel: { shrink: true },
                  htmlInput: { max: dayjs().format("YYYY-MM-DD") },
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <UiTextField
                fullWidth
                label="Tên khách gửi (PII)"
                value={correctForm.customer_name}
                disabled={!canViewPii}
                onChange={(event) => {
                  setCorrectForm((current) => ({
                    ...current,
                    customer_name: event.target.value,
                  }));
                  if (correctFieldErrors.customer_name) {
                    setCorrectFieldErrors((current) => ({
                      ...current,
                      customer_name: "",
                    }));
                  }
                }}
                error={Boolean(correctFieldErrors.customer_name)}
                helperText={correctFieldErrors.customer_name}
                slotProps={{ htmlInput: { maxLength: 200 } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <UiTextField
                fullWidth
                label="Số điện thoại (PII)"
                value={correctForm.customer_phone}
                disabled={!canViewPii}
                // Rà soát validate định dạng input (Flow04 Warranty): SĐT khách VN —
                // đủ 10 chữ số, bắt đầu bằng 0, không cho nhập chữ.
                onChange={(event) => {
                  setCorrectForm((current) => ({
                    ...current,
                    customer_phone: event.target.value
                      .replace(/\D/g, "")
                      .slice(0, 10),
                  }));
                  if (correctFieldErrors.customer_phone) {
                    setCorrectFieldErrors((current) => ({
                      ...current,
                      customer_phone: "",
                    }));
                  }
                }}
                error={
                  (Boolean(correctForm.customer_phone) &&
                    !/^0\d{9}$/.test(correctForm.customer_phone)) ||
                  Boolean(correctFieldErrors.customer_phone)
                }
                helperText={
                  Boolean(correctForm.customer_phone) &&
                  !/^0\d{9}$/.test(correctForm.customer_phone)
                    ? "Số điện thoại phải đủ 10 chữ số và bắt đầu bằng số 0."
                    : correctFieldErrors.customer_phone
                }
                slotProps={{
                  htmlInput: { maxLength: 10, inputMode: "numeric" },
                }}
              />
            </Grid>
            <Grid size={12}>
              <UiTextField
                fullWidth
                label="Địa chỉ khách (PII)"
                value={correctForm.customer_address}
                disabled={!canViewPii}
                onChange={(event) => {
                  setCorrectForm((current) => ({
                    ...current,
                    customer_address: event.target.value,
                  }));
                  if (correctFieldErrors.customer_address) {
                    setCorrectFieldErrors((current) => ({
                      ...current,
                      customer_address: "",
                    }));
                  }
                }}
                error={Boolean(correctFieldErrors.customer_address)}
                helperText={correctFieldErrors.customer_address}
                slotProps={{ htmlInput: { maxLength: 500 } }}
              />
            </Grid>
            <Grid size={12}>
              <UiTextField
                fullWidth
                multiline
                minRows={2}
                label="Lý do hiệu chỉnh (hiện trên timeline)"
                value={correctForm.reason}
                onChange={(event) => {
                  setCorrectForm((current) => ({
                    ...current,
                    reason: event.target.value,
                  }));
                  if (correctFieldErrors.reason) {
                    setCorrectFieldErrors((current) => ({
                      ...current,
                      reason: "",
                    }));
                  }
                }}
                error={Boolean(correctFieldErrors.reason)}
                helperText={
                  correctFieldErrors.reason ??
                  `${correctForm.reason.length}/2000`
                }
                slotProps={{ htmlInput: { maxLength: 2000 } }}
              />
            </Grid>
          </Grid>
        </UiDialog>

        <UiDialog
          open={statusOpen}
          onClose={guardBackdropClose(() => {
            setStatusOpen(false);
            setStatusFieldErrors({});
          })}
          maxWidth="sm"
          fullWidth
          aria-label="Cập nhật trạng thái bảo hành"
          title="Cập nhật trạng thái bảo hành"
          actions={
            <>
              <ActionButton
                kind="cancel"
                onClick={() => {
                  setStatusOpen(false);
                  setStatusFieldErrors({});
                }}
                disabled={updateMutation.isPending}
              >
                Hủy
              </ActionButton>
              <ActionButton
                kind="edit"
                onClick={() => void submitStatus()}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? "Đang cập nhật..." : "Cập nhật"}
              </ActionButton>
            </>
          }
        >
          <Stack spacing={2}>
            <UiAlert tone="info">
              Cập nhật trạng thái là stock-neutral: item không tự quay lại tồn
              bán; trả khách chuyển item sang RETURNED_TO_CUSTOMER.
            </UiAlert>
            <UiTextField
              select
              required
              fullWidth
              label="Trạng thái mới"
              value={statusForm.status}
              onChange={(event) => {
                setStatusForm((current) => ({
                  ...current,
                  status: event.target.value as WarrantyCaseStatus,
                }));
                if (statusFieldErrors.status) {
                  setStatusFieldErrors((current) => ({
                    ...current,
                    status: "",
                  }));
                }
              }}
              error={Boolean(statusFieldErrors.status)}
              helperText={statusFieldErrors.status}
            >
              {nextStatuses.map((value) => (
                <MenuItem key={value} value={value}>
                  {WARRANTY_STATUS_LABELS[value] ?? value}
                </MenuItem>
              ))}
            </UiTextField>
            {statusValue === "REPAIRING" ? (
              <UiTextField
                fullWidth
                type="date"
                required
                label="Ngày dự kiến sửa xong (bắt buộc, để báo khách)"
                value={statusForm.estimated_completion_date}
                onChange={(event) => {
                  setStatusForm((current) => ({
                    ...current,
                    estimated_completion_date: event.target.value,
                  }));
                  if (statusFieldErrors.estimated_completion_date) {
                    setStatusFieldErrors((current) => ({
                      ...current,
                      estimated_completion_date: "",
                    }));
                  }
                }}
                error={Boolean(statusFieldErrors.estimated_completion_date)}
                helperText={statusFieldErrors.estimated_completion_date}
                slotProps={{
                  inputLabel: { shrink: true },
                  htmlInput: { min: dayjs().format("YYYY-MM-DD") },
                }}
              />
            ) : null}
            <UiTextField
              fullWidth
              multiline
              minRows={2}
              required={diagnosisRequired}
              label={
                "Ghi chú (không bắt buộc)"
              }
              value={statusForm.confirmed_defect}
              onChange={(event) => {
                setStatusForm((current) => ({
                  ...current,
                  confirmed_defect: event.target.value,
                }));
                if (statusFieldErrors.confirmed_defect) {
                  setStatusFieldErrors((current) => ({
                    ...current,
                    confirmed_defect: "",
                  }));
                }
              }}
              error={Boolean(statusFieldErrors.confirmed_defect)}
              helperText={
                statusFieldErrors.confirmed_defect ??
                `${statusForm.confirmed_defect.length}/2000`
              }
              slotProps={{ htmlInput: { maxLength: 2000 } }}
            />
            {statusValue === "CANCELLED" ? (
              <UiTextField
                fullWidth
                multiline
                minRows={2}
                required
                label="Lý do hủy (bắt buộc)"
                value={statusForm.cancel_reason}
                onChange={(event) => {
                  setStatusForm((current) => ({
                    ...current,
                    cancel_reason: event.target.value,
                  }));
                  if (statusFieldErrors.cancel_reason) {
                    setStatusFieldErrors((current) => ({
                      ...current,
                      cancel_reason: "",
                    }));
                  }
                }}
                error={Boolean(statusFieldErrors.cancel_reason)}
                helperText={
                  statusFieldErrors.cancel_reason ??
                  `${statusForm.cancel_reason.length}/1000`
                }
                slotProps={{ htmlInput: { maxLength: 1000 } }}
              />
            ) : null}
            <UiTextField
              fullWidth
              multiline
              minRows={2}
              required={Boolean(noteRequiredLabel)}
              label={noteRequiredLabel ?? "Ghi chú xử lý (hiện trên timeline)"}
              value={statusForm.reason}
              onChange={(event) => {
                setStatusForm((current) => ({
                  ...current,
                  reason: event.target.value,
                }));
                if (statusFieldErrors.reason) {
                  setStatusFieldErrors((current) => ({
                    ...current,
                    reason: "",
                  }));
                }
              }}
              error={Boolean(statusFieldErrors.reason)}
              helperText={
                statusFieldErrors.reason ?? `${statusForm.reason.length}/2000`
              }
              slotProps={{ htmlInput: { maxLength: 2000 } }}
            />
          </Stack>
        </UiDialog>
      </UiDialog>
    </>
  );
}
