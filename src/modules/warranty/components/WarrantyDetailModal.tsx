import "./warranty-dialog.css";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import {
  Box,
  Grid,
  MenuItem,
  SEMANTIC_LIGHT,
  Stack,
  UiAddressField,
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
import {
  classifyConcurrencyError,
  isRetryableAfterReload,
} from "@/shared/api/concurrency-contract";
import { ACTION_ICON_COLORS } from "@/shared/theme/actionIconColors";
import { guardBackdropClose } from "@/shared/utils/dialogGuard";
import { useDialogExit } from "@/shared/utils/useDialogExit";
import { useT } from "@/shared/i18n/useT";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { http } from "@/shared/api/http";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import {
  ResponsiveDataTable,
  type ResponsiveTableColumn,
} from "@/shared/components/data-display/ResponsiveDataTable";
import { useCanAny } from "@/shared/components/permission";
import { SkuLink } from "@/shared/components/data-display/SkuLink";
import { useMvpDefects } from "@/modules/master-data/hooks/use-mvp-master";
import { formatDate } from "@/shared/utils/format-date";
import { EMPTY_TEXT } from "@/shared/constants/display";
import {
  COMPONENT_ISSUE_STATUS_BADGE,
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
  businessLabel,
  ITEM_STATUS_LABELS,
  WARRANTY_IDENTIFICATION_STATUS_LABELS,
} from "@/shared/constants/business-labels";
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
import { WarrantyReturnLabelDialog } from "@/modules/warranty/components/WarrantyReturnLabelDialog";
import type { ComponentIssueDocument } from "@/modules/warranty/services/componentIssueService";
import type {
  WarrantyAttachment,
  WarrantyAttachmentType,
  WarrantyCaseStatus,
} from "@/modules/warranty/types";
import { ActionButton, ActionIconButton } from "@/shared/components/actions";
import { validatePhone } from "@/shared/constants/validation.constants";
import {
  FILE_RULES,
  acceptAttribute,
  checkFile,
  matchesFileRule,
} from "@/shared/validation/file-rules";
import {
  checkDate,
  dateInputBounds,
  futureDateBounds,
  pastDateBounds,
} from "@/shared/validation/date-rules";
import {
  MAX_WARRANTY_IMAGES,
  MAX_WARRANTY_VIDEOS,
  MAX_WARRANTY_VIDEO_DURATION_SECONDS,
  probeVideoDurationSeconds,
} from "@/modules/warranty/components/warranty-attachment-limits";
import {
  AnimatedList,
  AnimatedListItem,
  AnimatedInlineList,
  AnimatedInlineItem,
} from "@/shared/components/motion";

// KHÔNG nối request_id: đó là mã tra cứu kỹ thuật cho debug, người dùng đọc
// không hiểu (xem ApiErrorAlert.tsx — request_id chỉ hiện ở dòng phụ có nhãn
// rõ, không bao giờ nối thẳng vào câu chính như toast ở đây).
function errorText(error: unknown, fallback: string): string {
  return getApiErrorMessage(error, fallback);
}

/**
 * `true` khi lỗi là xung đột đồng thời loại RELOAD_THEN_RETRY (412
 * STALE_VERSION / 409 CONCURRENCY_CONFLICT). Hook mutation đã tải lại hồ sơ,
 * nên form chỉ cần báo đúng việc phải làm — và tuyệt đối KHÔNG đổ
 * `expected_version`/`current_version` ra toast: đó là số kỹ thuật để tra
 * soát, người dùng đọc "(2; 3)" không hiểu gì.
 */
function isStaleVersionConflict(error: unknown): boolean {
  const outcome = classifyConcurrencyError(error);
  return outcome !== null && isRetryableAfterReload(outcome);
}

/**
 * Đuôi/MIME/dung lượng lấy từ lớp luật dùng chung (file-rules.ts) — trước đây
 * bốn bộ hằng số chép tay ở đây, ở WarrantyIntakeModal, OutboundIntakeModal và
 * DocumentAttachmentsPanel. Trần SỐ LƯỢNG ảnh/video và thời lượng video vẫn ở
 * warranty-attachment-limits.ts vì đó là luật nghiệp vụ của hồ sơ, không phải
 * luật của tệp.
 */
const IMAGE_RULE = FILE_RULES.warrantyImage;
const VIDEO_RULE = FILE_RULES.warrantyVideo;
const WARRANTY_IMAGE_ACCEPT = acceptAttribute(IMAGE_RULE);
const WARRANTY_VIDEO_ACCEPT = acceptAttribute(VIDEO_RULE);
/** BE update case: cancel_reason max:1000; FE thêm sàn 5 ký tự để lý do có nghĩa. */
const CANCEL_REASON_MIN_LENGTH = 5;

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
  const t = useT();
  return (
    <Box className="hn-scale-in" sx={{ minWidth: 0 }}>
      <Box
        role="button"
        tabIndex={0}
        aria-label={t("warranty.detail.viewImageAria", {
          name: attachment.file_name,
        })}
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
          borderRadius: "var(--ops-radius-card)",
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
        borderRadius: "var(--ops-radius-card)",
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
  /**
   * Chẩn đoán lúc tiếp nhận có thể sai — cho chọn lại bệnh/lỗi (danh mục) khi
   * chuyển sang Đang sửa chữa/Đã hoàn tất. Rỗng = không đổi, giữ nguyên bệnh
   * lỗi đã ghi trên phiếu (KHÔNG gửi defect_ids lên BE, xem submitStatus).
   */
  defect_ids: string[];
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
  const t = useT();
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
    defect_ids: [],
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

  /**
   * Ô chọn lại bệnh/lỗi trong dialog "Cập nhật trạng thái" (khác dialog "Sửa
   * thông tin case" ở trên) — mini-form riêng vì mặc định PHẢI rỗng (không
   * pre-fill bệnh lỗi hiện có của case), đúng yêu cầu "không chọn thì để
   * trống, không đổi bệnh lỗi cũ".
   */
  const statusDefectForm = useForm<{ defect_ids: string[] }>({
    defaultValues: { defect_ids: [] },
  });

  useEffect(() => {
    const subscription = statusDefectForm.watch((values) => {
      const defectIds = (values.defect_ids ?? []).filter(
        (id): id is string => typeof id === "string",
      );
      setStatusForm((current) => ({ ...current, defect_ids: defectIds }));
    });
    return () => subscription.unsubscribe();
  }, [statusDefectForm]);

  // Mốc ngày tính mỗi lần render để "hôm nay" không đóng băng khi modal mở lâu:
  // ngày mua ≤ hôm nay (BE before_or_equal:today), ngày dự kiến ≥ hôm nay
  // (BE after_or_equal:today), cả hai nằm trong cửa sổ chung của dự án.
  const purchaseBounds = pastDateBounds();
  const purchaseInput = dateInputBounds(purchaseBounds);
  const estimatedBounds = futureDateBounds();
  const estimatedInput = dateInputBounds(estimatedBounds);
  const correctPhoneLiveCheck =
    canViewPii && correctForm.customer_phone
      ? validatePhone(correctForm.customer_phone)
      : null;
  const correctPhoneLiveError =
    correctPhoneLiveCheck && !correctPhoneLiveCheck.isValid
      ? (correctPhoneLiveCheck.errorMessage ??
        t("warranty.detail.errPhoneFormat"))
      : undefined;

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [returnLabelOpen, setReturnLabelOpen] = useState(false);
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

  // Nhãn tệp tự suy theo giai đoạn của case (không còn ô chọn tay): ảnh tải ở
  // bước nào gần như luôn thuộc nhãn của bước đó.
  const attachmentType = detail
    ? (ATTACHMENT_TYPE_BY_STATUS[detail.status] ?? "INTAKE")
    : "INTAKE";
  const isTerminal = detail
    ? WARRANTY_TERMINAL_STATUSES.includes(detail.status)
    : true;
  const nextStatuses = detail
    ? (WARRANTY_NEXT_STATUS[detail.status] ?? [])
    : [];
  const caseActive = detail ? !isTerminal : false;
  // Xuất linh kiện chỉ trong giai đoạn đang xử lý: CHẶN khi case đã "Đã hoàn tất
  // xử lý" (COMPLETED) hoặc "Đã trả khách" (RETURNED / RETURNED_TO_CUSTOMER —
  // isTerminal). Dùng để vừa disable nút mở phiếu, vừa chặn tạo mới trong modal.
  const canIssueComponents = Boolean(
    detail && !isTerminal && detail.status !== "COMPLETED",
  );
  /**
   * Nhãn trả máy chỉ có nghĩa khi máy ĐÃ SỬA XONG: in ở giai đoạn sớm hơn thì
   * khối "bệnh lỗi / linh kiện đã thay" còn dở dang, dán lên máy là sai lệch.
   *
   * Mở từ COMPLETED ("Đã hoàn tất xử lý") — đúng mốc "sửa xong, trước khi trả
   * khách". VẪN cho in sau khi đã chuyển RETURNED: nhãn không bắt buộc và có
   * thể mất/rách trên đường, chặn in lại chỉ tạo ra một hồ sơ không in được mà
   * không bảo vệ được gì (nhãn không phải chứng từ kho, in không đổi tồn).
   */
  const canPrintReturnLabel = Boolean(
    detail &&
    ["COMPLETED", "RETURNED", "RETURNED_TO_CUSTOMER", "CLOSED"].includes(
      detail.status,
    ),
  );
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
      errors.status = t("warranty.detail.errStatus");
    }
    if (diagnosisRequired && !statusForm.confirmed_defect.trim()) {
      errors.confirmed_defect = t("warranty.detail.errCheckResult");
    }
    if (statusForm.status === "CANCELLED") {
      const cancelReason = statusForm.cancel_reason.trim();
      if (!cancelReason) {
        errors.cancel_reason = t("warranty.detail.errCancelReason");
      } else if (cancelReason.length < CANCEL_REASON_MIN_LENGTH) {
        errors.cancel_reason = t("warranty.detail.errCancelReasonShort");
      }
    }
    /*
     * UAT TC_FUNC_01: chỉ validate ngày dự kiến khi ô này THỰC SỰ hiển thị
     * (statusValue === "REPAIRING"). Bản trước validate cả khi chuyển sang
     * Hoàn tất/Trả khách — hồ sơ mang sẵn ngày dự kiến đã qua khiến submit
     * fail âm thầm trên một field không được render: không request, không
     * toast, nút "Cập nhật" như chết.
     */
    if (statusValue === "REPAIRING") {
      if (estimatedDateRequired) {
        errors.estimated_completion_date = t(
          "warranty.detail.errEstimatedDate",
        );
      } else if (statusForm.estimated_completion_date) {
        const estimatedCheck = checkDate(
          statusForm.estimated_completion_date,
          estimatedBounds,
        );
        if (!estimatedCheck.ok) {
          errors.estimated_completion_date = estimatedCheck.message;
        }
      }
    }
    if (noteRequiredLabel && !statusForm.reason.trim()) {
      // UAT TC_UI_10: key này từng được gán THÔ (không qua t()) nên helperText
      // in nguyên "warranty.noteRequired.completed" ra màn hình.
      errors.reason = t(noteRequiredLabel);
    }
    setStatusFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /** Lỗi đầu tiên đang chặn submit — hiển thị cạnh nút Cập nhật (TC_FUNC_01). */
  const statusBlockingError =
    Object.values(statusFieldErrors).find(Boolean) ?? "";

  const submitStatus = async () => {
    if (!detail) return;
    if (!validateStatusForm()) return;
    // Chỉ gửi defect_ids khi ô chọn lại thực sự hiện (Đang sửa chữa/Đã hoàn
    // tất) VÀ người dùng có chọn — BE validate defect_ids (nếu có mặt) phải
    // là mảng min:1, còn field vắng mặt thì case giữ nguyên bệnh lỗi cũ.
    // KHÔNG BAO GIỜ gửi mảng rỗng.
    const defectIds =
      statusValue &&
      WARRANTY_DIAGNOSIS_REQUIRED_TARGETS.includes(statusValue) &&
      statusForm.defect_ids.length > 0
        ? statusForm.defect_ids
        : undefined;
    try {
      const updated = await updateMutation.mutateAsync({
        id: detail.id,
        request: {
          status: statusForm.status || undefined,
          reason: statusForm.reason.trim() || undefined,
          confirmed_defect: statusForm.confirmed_defect.trim() || undefined,
          cancel_reason: statusForm.cancel_reason.trim() || undefined,
          estimated_completion_date:
            statusValue === "REPAIRING"
              ? statusForm.estimated_completion_date || undefined
              : undefined,
          defect_ids: defectIds,
          ifMatch: detail.version,
        },
      });
      toast.success(
        t("warranty.detail.statusUpdated", {
          code: updated.case_code,
          status: businessLabel(WARRANTY_STATUS_LABELS, updated.status),
        }),
      );
      setStatusForm({
        status: "",
        reason: "",
        confirmed_defect: "",
        cancel_reason: "",
        estimated_completion_date: "",
        defect_ids: [],
      });
      statusDefectForm.reset({ defect_ids: [] });
      setStatusFieldErrors({});
      setStatusOpen(false);
    } catch (error: unknown) {
      if (isStaleVersionConflict(error)) {
        setStatusFieldErrors({});
        toast.error(t("warranty.error.caseStaleVersion"));
        return;
      }
      const apiFieldErrors = extractFieldErrorsRaw(error);
      const message = errorText(error, t("warranty.detail.statusUpdateError"));
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
    // BE: defect_ids (khi có mặt) phải là mảng min:1 — dialog này luôn gửi
    // defect_ids nên rỗng là 422 chắc chắn; chặn ngay trên ô.
    if (correctForm.defect_ids.length === 0) {
      errors.defect_ids = t("warranty.detail.errDefectRequired");
    }
    if (canViewPii && correctForm.customer_phone) {
      const phoneCheck = validatePhone(correctForm.customer_phone.trim());
      if (!phoneCheck.isValid) {
        errors.customer_phone =
          phoneCheck.errorMessage ?? t("warranty.detail.errPhoneFormat");
      }
    }
    if (correctForm.purchase_date) {
      const purchaseCheck = checkDate(
        correctForm.purchase_date,
        purchaseBounds,
      );
      if (!purchaseCheck.ok) {
        errors.purchase_date = purchaseCheck.message;
      }
    }
    if (correctForm.estimated_completion_date) {
      const estimatedCheck = checkDate(
        correctForm.estimated_completion_date,
        estimatedBounds,
      );
      if (!estimatedCheck.ok) {
        errors.estimated_completion_date = estimatedCheck.message;
      }
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
          reason:
            correctForm.reason.trim() ||
            t("warranty.detail.defaultCorrectReason"),
          ifMatch: detail.version,
        },
      });
      toast.success(t("warranty.detail.infoUpdated"));
      setCorrectFieldErrors({});
      setCorrectOpen(false);
    } catch (error: unknown) {
      if (isStaleVersionConflict(error)) {
        setCorrectFieldErrors({});
        toast.error(t("warranty.error.caseStaleVersion"));
        return;
      }
      const apiFieldErrors = extractFieldErrorsRaw(error);
      const message = errorText(error, t("warranty.detail.infoUpdateError"));
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

  const uploadAttachmentFile = (file: File) => {
    uploadMutation
      .mutateAsync({ caseId, file, attachmentType })
      .then(() =>
        toast.success(t("warranty.detail.uploaded", { name: file.name })),
      )
      .catch((error: unknown) =>
        toast.error(errorText(error, t("warranty.detail.uploadError"))),
      );
  };

  /**
   * Cùng trần với màn tiếp nhận: ≤10 ảnh, ≤2 video (≤5 phút) cho MỘT hồ sơ —
   * đếm cả tệp đã có trên case, vì ở đây mỗi tệp tải lên ngay chứ không gom
   * vào state như intake. Nhiều tệp một lượt thì đếm dồn theo thứ tự chọn.
   */
  const handleFilesDropped = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    let imageSlots = MAX_WARRANTY_IMAGES - imageAttachments.length;
    let videoSlots = MAX_WARRANTY_VIDEOS - videoAttachments.length;
    // BE nhận 1 file/request; kéo-thả nhiều tệp thì tải tuần tự từng cái.
    for (const file of Array.from(files)) {
      // Phân loại theo LUẬT (đuôi + MIME) chứ không chỉ MIME: trình duyệt trả
      // file.type rỗng cho khá nhiều tệp lấy từ USB/điện thoại cũ.
      const isImage = matchesFileRule(file, IMAGE_RULE);
      const isVideo = matchesFileRule(file, VIDEO_RULE);
      if (!isImage && !isVideo) {
        toast.error(t("warranty.detail.badFileType", { name: file.name }));
        continue;
      }
      if (isImage) {
        const check = checkFile(file, IMAGE_RULE);
        if (!check.ok) {
          toast.error(t("warranty.detail.imageTooLarge", { name: file.name }));
          continue;
        }
        if (imageSlots <= 0) {
          toast.error(
            t("warranty.detail.tooManyImages", { max: MAX_WARRANTY_IMAGES }),
          );
          continue;
        }
        imageSlots -= 1;
        uploadAttachmentFile(file);
        continue;
      }
      const check = checkFile(file, VIDEO_RULE);
      if (!check.ok) {
        toast.error(t("warranty.detail.videoTooLarge", { name: file.name }));
        continue;
      }
      if (videoSlots <= 0) {
        toast.error(
          t("warranty.detail.tooManyVideos", { max: MAX_WARRANTY_VIDEOS }),
        );
        continue;
      }
      try {
        const duration = await probeVideoDurationSeconds(file);
        if (duration > MAX_WARRANTY_VIDEO_DURATION_SECONDS) {
          toast.error(t("warranty.detail.videoTooLong", { name: file.name }));
          continue;
        }
      } catch {
        toast.error(t("warranty.detail.videoUnreadable", { name: file.name }));
        continue;
      }
      videoSlots -= 1;
      uploadAttachmentFile(file);
    }
  };

  const handleDownloadAttachment = (attachment: WarrantyAttachment) => {
    downloadWarrantyAttachment({
      attachmentId: attachment.id,
      fileName: attachment.file_name,
    }).catch((error: unknown) =>
      toast.error(errorText(error, t("warranty.detail.downloadError"))),
    );
  };

  const issueColumns: ResponsiveTableColumn<ComponentIssueDocument>[] = [
    {
      key: "component_issue_no",
      header: t("warranty.detail.colIssueCode"),
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
      header: t("warranty.detail.colDocumentDate"),
      width: 130,
      render: (row) => formatDate(row.document_date),
    },
    {
      key: "status",
      header: t("warranty.detail.colStatus"),
      width: 120,
      render: (row) => (
        <UiStatusBadge
          tone={COMPONENT_ISSUE_STATUS_BADGE[row.status]?.tone ?? "neutral"}
          label={COMPONENT_ISSUE_STATUS_BADGE[row.status]?.label ?? row.status}
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
          <span>{t("warranty.detail.tabOverview")}</span>
        </Stack>
      ),
    },
    {
      key: "media",
      label: (
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
          <PaperClipOutlined style={{ fontSize: 15 }} />
          <span>
            {t("warranty.detail.tabMedia", { count: attachments.length })}
          </span>
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
                <span>
                  {t("warranty.detail.tabComponents", {
                    count: issuesQuery.data?.data.length ?? 0,
                  })}
                </span>
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
          <span>
            {t("warranty.detail.tabHistory", {
              count: eventsQuery.data?.length ?? 0,
            })}
          </span>
        </Stack>
      ),
    },
  ];

  return (
    <>
      <UiDialog
        className="hn-war-dialog"
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
              <span>
                {detail?.case_code ?? t("warranty.detail.fallbackTitle")}
              </span>
              {detail ? (
                <UiStatusBadge
                  tone={tagTone(WARRANTY_STATUS_COLORS[detail.status])}
                  label={businessLabel(WARRANTY_STATUS_LABELS, detail.status)}
                />
              ) : null}
              {detail?.identification_type === "TEMP_ONLY" ? (
                <UiStatusBadge
                  tone="warning"
                  label={WARRANTY_IDENTIFICATION_STATUS_LABELS.TEMP_ONLY}
                />
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
                  t("warranty.detail.receivedAt", {
                    date: formatWarrantyDateTime(detail.received_at),
                  }),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Box>
            ) : null}
            <ActionIconButton
              kind="close"
              label={t("common.close")}
              onClick={dialog.close}
              sx={{ position: "absolute", right: 10, top: 8 }}
            />
          </>
        }
        actions={
          <>
            <ActionButton kind="close" onClick={dialog.close}>
              {t("common.close")}
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
              {t("warranty.detail.editInfo")}
            </ActionButton>
            <ActionButton
              kind="repair"
              disabled={!canIssue || !detail || !canIssueComponents}
              onClick={() =>
                detail &&
                onOpenComponentIssue({
                  caseId,
                  caseCode: detail.case_code,
                  caseActive: canIssueComponents,
                  documentId: null,
                })
              }
            >
              {t("warranty.detail.issueComponents")}
            </ActionButton>
            {/* KHÔNG bắt buộc in — nút chỉ mở bản xem trước, mọi thứ diễn ra ở
                trình duyệt, không gọi API và không đổi trạng thái hồ sơ. */}
            <ActionButton
              kind="print"
              disabled={!detail || !canPrintReturnLabel}
              onClick={() => setReturnLabelOpen(true)}
            >
              {t("warranty.detail.returnLabel")}
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
                  defect_ids: [],
                });
                statusDefectForm.reset({ defect_ids: [] });
                setStatusFieldErrors({});
                setStatusOpen(true);
              }}
            >
              {t("warranty.detail.updateStatus")}
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
              labels={stepStatuses.map((status) =>
                businessLabel(WARRANTY_STATUS_LABELS, status),
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
            title={t("warranty.detail.loadError")}
            onRetry={() => detailQuery.refetch()}
          />

          {detail && isCancelled ? (
            <UiAlert tone="error">
              {t("warranty.detail.cancelledAt", {
                step: businessLabel(
                  WARRANTY_STATUS_LABELS,
                  progressStatus ?? "RECEIVED",
                  EMPTY_TEXT,
                ),
                reason: detail.cancel_reason ?? EMPTY_TEXT,
              })}
            </UiAlert>
          ) : null}

          {!canViewPii && activeTab === "overview" ? (
            <UiAlert tone="info">
              {t("warranty.detail.maskedNotice")}
              warranty.pii.view.
            </UiAlert>
          ) : null}

          {activeTab === "history" ? (
            <Box
              className="hn-fade-in-up"
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: "var(--ops-radius-card)",
                p: 2,
              }}
            >
              <Box sx={{ typography: "subtitle2", fontWeight: 700, mb: 1.5 }}>
                {t("warranty.detail.historyTitle")}
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
                            ? t("warranty.detail.processingNote")
                            : businessLabel(
                                WARRANTY_STATUS_LABELS,
                                event.to_status,
                              )}
                        </Box>
                        <Box
                          sx={{
                            typography: "caption",
                            color: "text.secondary",
                          }}
                        >
                          {formatWarrantyDateTime(event.performed_at)}
                          {event.performed_by && event.performed_by !== "-"
                            ? t("warranty.detail.performedBy", {
                                user: event.performed_by,
                              })
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
                  {t("warranty.detail.historyEmpty")}
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
                        borderRadius: "var(--ops-radius-card)",
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
                        {t("warranty.detail.sectionCustomer")}
                      </Box>
                      <Grid container spacing={2}>
                        {/* §13.8: mask lại ở tầng render — không tin payload đã mask sẵn. */}
                        <DetailField
                          label={t("warranty.detail.fieldCustomer")}
                          value={
                            warrantyPiiText(
                              detail.customer_name,
                              canViewPii,
                              "name",
                            ) || EMPTY_TEXT
                          }
                        />
                        <DetailField
                          label={t("warranty.detail.fieldPhone")}
                          value={
                            warrantyPiiText(
                              detail.customer_phone,
                              canViewPii,
                              "phone",
                            ) || EMPTY_TEXT
                          }
                        />
                        <DetailField
                          label={t("warranty.detail.fieldAddress")}
                          value={
                            warrantyPiiText(
                              detail.customer_address,
                              canViewPii,
                              "address",
                            ) || EMPTY_TEXT
                          }
                        />
                        <DetailField
                          label={t("warranty.detail.fieldPurchaseDate")}
                          value={
                            detail.purchase_date
                              ? formatDate(detail.purchase_date)
                              : EMPTY_TEXT
                          }
                        />
                        <DetailField
                          label={t("warranty.detail.fieldReceivedAt")}
                          value={formatWarrantyDateTime(detail.received_at)}
                        />
                        <DetailField
                          label={t("warranty.detail.fieldAccessories")}
                          value={detail.accessories_received ?? EMPTY_TEXT}
                        />
                        <DetailField
                          label={t("warranty.detail.fieldCondition")}
                          value={detail.received_condition ?? EMPTY_TEXT}
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
                        borderRadius: "var(--ops-radius-card)",
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
                        {t("warranty.detail.sectionDevice")}
                      </Box>
                      <Grid container spacing={2}>
                        <DetailField
                          label={t("warranty.detail.fieldItem")}
                          value={
                            detail.identification_type === "TEMP_ONLY"
                              ? (detail.temporary_item_code ?? EMPTY_TEXT)
                              : (detail.item_code ??
                                detail.serial_number ??
                                EMPTY_TEXT)
                          }
                        />
                        <DetailField
                          label="SKU / model"
                          value={
                            detail.sku ? (
                              <SkuLink code={detail.sku} />
                            ) : (
                              detail.sku_name || EMPTY_TEXT
                            )
                          }
                        />
                        <DetailField
                          label={t("warranty.detail.fieldItemStatus")}
                          value={
                            detail.item_status
                              ? businessLabel(
                                  ITEM_STATUS_LABELS,
                                  detail.item_status,
                                )
                              : EMPTY_TEXT
                          }
                        />
                        <DetailField
                          label={t("warranty.detail.fieldDefectCatalog")}
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
                              // `||` chứ không `??`: hồ sơ chưa gắn bệnh/lỗi thì
                              // service trả CHUỖI RỖNG, `??` sẽ để lọt ô trắng.
                              detail.defect || EMPTY_TEXT
                            )
                          }
                        />
                        <DetailField
                          label={t("warranty.detail.fieldReported")}
                          value={detail.reported_defect ?? EMPTY_TEXT}
                          span2
                        />
                        <DetailField
                          label={t("warranty.detail.fieldCheckResult")}
                          value={
                            detail.confirmed_defect ??
                            t("warranty.detail.noConclusion")
                          }
                          span2
                        />
                        {detail.identification_type === "TEMP_ONLY" ? (
                          <>
                            <DetailField
                              label={t("warranty.detail.fieldLostReason")}
                              value={detail.missing_code_reason ?? EMPTY_TEXT}
                            />
                            <DetailField
                              label={t(
                                "warranty.detail.fieldIdentityDescription",
                              )}
                              value={
                                detail.manual_product_description ?? EMPTY_TEXT
                              }
                            />
                          </>
                        ) : null}
                        {detail.status === "CANCELLED" ? (
                          <DetailField
                            label={t("warranty.detail.fieldCancelReason")}
                            value={detail.cancel_reason ?? EMPTY_TEXT}
                            span2
                          />
                        ) : null}
                        <DetailField
                          label={t("warranty.detail.fieldEstimated")}
                          value={
                            detail.estimated_completion_date
                              ? formatDate(detail.estimated_completion_date)
                              : EMPTY_TEXT
                          }
                        />
                        <DetailField
                          label={t("warranty.detail.fieldCompleted")}
                          value={formatWarrantyDateTime(detail.completed_at)}
                        />
                        <DetailField
                          label={t("warranty.detail.fieldReturned")}
                          value={formatWarrantyDateTime(detail.returned_at)}
                        />
                      </Grid>
                    </Box>
                  </Grid>
                </Grid>
              ) : null}

              {activeTab === "media" ? (
                <Stack className="hn-fade-in-up" spacing={2.5}>
                  <Box>
                    <Box
                      sx={{ typography: "subtitle2", fontWeight: 700, mb: 0.5 }}
                    >
                      {t("warranty.detail.imagesTitle", {
                        count: imageAttachments.length,
                      })}
                    </Box>
                    <Box
                      sx={{
                        typography: "caption",
                        color: "text.secondary",
                        display: "block",
                        mb: 1,
                      }}
                    >
                      {t("warranty.detail.imagesHint")}
                    </Box>
                    {attachmentsQuery.isLoading ? (
                      <Box
                        sx={{ typography: "body2", color: "text.secondary" }}
                      >
                        {t("warranty.detail.loadingFiles")}
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
                              void handleFilesDropped(event.dataTransfer.files);
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
                              borderRadius: "var(--ops-radius-card)",
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
                                ? t("warranty.detail.uploading")
                                : t("warranty.detail.uploadImage")}
                            </Box>
                            <input
                              type="file"
                              accept={WARRANTY_IMAGE_ACCEPT}
                              multiple
                              hidden
                              disabled={uploadMutation.isPending}
                              onChange={(event) => {
                                void handleFilesDropped(event.target.files);
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
                            {t("warranty.detail.imagesEmpty")}
                          </Box>
                        ) : null}
                      </Box>
                    )}
                  </Box>

                  <Box>
                    <Box
                      sx={{ typography: "subtitle2", fontWeight: 700, mb: 0.5 }}
                    >
                      {t("warranty.detail.videosTitle", {
                        count: videoAttachments.length,
                      })}
                    </Box>
                    <Box
                      sx={{
                        typography: "caption",
                        color: "text.secondary",
                        display: "block",
                        mb: 1,
                      }}
                    >
                      {t("warranty.detail.videosHint")}
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
                          void handleFilesDropped(event.dataTransfer.files);
                        }}
                        sx={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 0.5,
                          border: "1px dashed",
                          borderColor: "divider",
                          borderRadius: "var(--ops-radius-card)",
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
                          {t("warranty.detail.videoDrop")}
                        </Box>
                        <Box
                          component="span"
                          sx={{
                            typography: "caption",
                            color: "text.secondary",
                          }}
                        >
                          {t("warranty.detail.videoLimits")}
                        </Box>
                        <input
                          type="file"
                          accept={WARRANTY_VIDEO_ACCEPT}
                          multiple
                          hidden
                          disabled={uploadMutation.isPending}
                          onChange={(event) => {
                            void handleFilesDropped(event.target.files);
                            event.target.value = "";
                          }}
                        />
                      </Box>
                    ) : videoAttachments.length ? null : (
                      <Box
                        sx={{ typography: "body2", color: "text.secondary" }}
                      >
                        {t("warranty.detail.videosEmpty")}
                      </Box>
                    )}
                  </Box>

                  {otherAttachments.length ? (
                    <Box>
                      <Box
                        sx={{ typography: "subtitle2", fontWeight: 700, mb: 1 }}
                      >
                        {t("warranty.detail.otherFilesTitle", {
                          count: otherAttachments.length,
                        })}
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
                    borderRadius: "var(--ops-radius-card)",
                    p: 2,
                  }}
                >
                  <Box
                    sx={{ typography: "subtitle2", fontWeight: 700, mb: 1.5 }}
                  >
                    {t("warranty.detail.issuesTitle", {
                      count: issuesQuery.data?.data.length ?? 0,
                    })}
                  </Box>
                  <ResponsiveDataTable
                    columns={issueColumns}
                    rows={issuesQuery.data?.data ?? []}
                    rowKey={(row) => row.id}
                    loading={issuesQuery.isLoading}
                    emptyText={t("warranty.detail.issuesEmpty")}
                  />
                </Box>
              ) : null}
            </Stack>
          ) : null}
        </Stack>

        {/* Xem ảnh ngay trong modal: trước đây muốn nhìn ảnh phải tải tệp về
            máy rồi mở bằng ứng dụng ngoài. */}
        <UiDialog
          className="hn-war-dialog"
          open={previewAttachment !== null}
          onClose={() => setPreviewId(null)}
          maxWidth="lg"
          fullWidth
          // Giữ accessible name cũ: bỏ aria-labelledby tự sinh để aria-label thắng.
          aria-labelledby={undefined}
          aria-label={t("warranty.detail.previewAria")}
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
                  ? t("warranty.detail.previewCaption", {
                      index: previewIndex + 1,
                      total: imageAttachments.length,
                      size: formatBytes(previewAttachment.file_size_bytes),
                      date: formatWarrantyDateTime(
                        previewAttachment.uploaded_at,
                      ),
                      name: previewAttachment.file_name,
                    })
                  : null}
              </Box>
              <ActionIconButton
                kind="close"
                label={t("warranty.detail.previewClose")}
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
                {t("warranty.detail.previousImage")}
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
                {t("warranty.detail.nextImage")}
              </ActionButton>
              <Box sx={{ flexGrow: 1 }} />
              <ActionButton
                kind="download"
                onClick={() =>
                  previewAttachment &&
                  handleDownloadAttachment(previewAttachment)
                }
              >
                {t("warranty.detail.download")}
              </ActionButton>
              <ActionButton kind="close" onClick={() => setPreviewId(null)}>
                {t("common.close")}
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
              {t("warranty.detail.previewFailed")}
            </Box>
          )}
        </UiDialog>

        <UiDialog
          className="hn-war-dialog"
          open={deleteConfirmId !== null}
          onClose={() => setDeleteConfirmId(null)}
          maxWidth="xs"
          fullWidth
          title={t("warranty.detail.deleteTitle")}
          actions={
            <>
              <ActionButton
                kind="cancel"
                onClick={() => setDeleteConfirmId(null)}
                disabled={deleteAttachmentMutation.isPending}
              >
                {t("warranty.detail.deleteNo")}
              </ActionButton>
              <ActionButton
                kind="delete"
                disabled={deleteAttachmentMutation.isPending}
                onClick={() => {
                  if (!deleteConfirmId) return;
                  deleteAttachmentMutation
                    .mutateAsync(deleteConfirmId)
                    .then(() => {
                      toast.success(t("warranty.detail.deleted"));
                      if (previewId === deleteConfirmId) setPreviewId(null);
                      setDeleteConfirmId(null);
                    })
                    .catch((error: unknown) =>
                      toast.error(
                        errorText(error, t("warranty.detail.deleteError")),
                      ),
                    );
                }}
              >
                {t("warranty.detail.deleteYes")}
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
            {t("warranty.detail.deleteWarning")}
          </Box>
        </UiDialog>

        <UiDialog
          className="hn-war-dialog"
          open={correctOpen}
          onClose={guardBackdropClose(() => {
            setCorrectOpen(false);
            setCorrectFieldErrors({});
          })}
          maxWidth="sm"
          fullWidth
          aria-label={t("warranty.detail.editAria")}
          title={t("warranty.detail.editTitle")}
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
                {t("warranty.detail.editCancel")}
              </ActionButton>
              <ActionButton
                kind="save"
                onClick={() => void submitCorrection()}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending
                  ? t("warranty.detail.editSaving")
                  : t("warranty.detail.editSave")}
              </ActionButton>
            </>
          }
        >
          <Grid container spacing={2}>
            {/* Chỉ giữ nhắc quyền PII khi người dùng KHÔNG có warranty.pii.view
                (giải thích vì sao vài ô bị khóa). Ghi chú "sửa không đổi tồn
                kho / ghi nhật ký / tăng version" đã bỏ theo yêu cầu. */}
            {!canViewPii ? (
              <Grid size={12}>
                <UiAlert tone="info">
                  {t("warranty.detail.editHintMasked")}
                </UiAlert>
              </Grid>
            ) : null}
            <Grid size={12}>
              <UiFormAutocomplete
                control={defectForm.control}
                name="defect_ids"
                multiple
                options={defectOptions}
                label={t("warranty.detail.fieldDefectCatalog")}
                placeholder={t("warranty.detail.editDefectPlaceholder")}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <UiTextField
                fullWidth
                type="date"
                label={t("warranty.detail.editEstimatedDate")}
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
                  htmlInput: { ...estimatedInput },
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <UiTextField
                fullWidth
                type="date"
                label={t("warranty.detail.editPurchaseDate")}
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
                  htmlInput: { ...purchaseInput },
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <UiTextField
                fullWidth
                label={t("warranty.detail.editCustomerName")}
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
                label={t("warranty.detail.editPhone")}
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
                  Boolean(correctPhoneLiveError) ||
                  Boolean(correctFieldErrors.customer_phone)
                }
                helperText={
                  correctPhoneLiveError ?? correctFieldErrors.customer_phone
                }
                slotProps={{
                  htmlInput: { maxLength: 10, inputMode: "numeric" },
                }}
              />
            </Grid>
            <Grid size={12}>
              <UiAddressField
                data-testid="warranty-correct-address"
                label={t("warranty.detail.editAddress")}
                value={correctForm.customer_address}
                disabled={!canViewPii}
                onChange={(value) => {
                  setCorrectForm((current) => ({
                    ...current,
                    customer_address: value,
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
              />
            </Grid>
            <Grid size={12}>
              <UiTextField
                fullWidth
                multiline
                minRows={2}
                label={t("warranty.detail.editReason")}
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
          className="hn-war-dialog"
          open={statusOpen}
          onClose={guardBackdropClose(() => {
            setStatusOpen(false);
            setStatusFieldErrors({});
          })}
          maxWidth="sm"
          fullWidth
          aria-label={t("warranty.detail.statusAria")}
          title={t("warranty.detail.statusTitle")}
          actions={
            <>
              {/* UAT TC_FUNC_01: thân dialog cuộn được nên lỗi field có thể
                  nằm khuất phía trên — nhắc ngay cạnh nút để mọi cú bấm
                  "Cập nhật" đều có phản hồi nhìn thấy. */}
              {statusBlockingError ? (
                <Box
                  role="alert"
                  sx={{
                    mr: "auto",
                    color: "error.main",
                    typography: "caption",
                    maxWidth: 320,
                  }}
                >
                  {statusBlockingError}
                </Box>
              ) : null}
              <ActionButton
                kind="cancel"
                onClick={() => {
                  setStatusOpen(false);
                  setStatusFieldErrors({});
                }}
                disabled={updateMutation.isPending}
              >
                {t("warranty.detail.editCancel")}
              </ActionButton>
              <ActionButton
                kind="edit"
                onClick={() => void submitStatus()}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending
                  ? t("warranty.detail.statusUpdating")
                  : t("warranty.detail.statusSubmit")}
              </ActionButton>
            </>
          }
        >
          <Stack spacing={2}>
            <UiAlert tone="info">{t("warranty.detail.statusHint")}</UiAlert>
            <UiTextField
              select
              required
              fullWidth
              label={t("warranty.detail.statusNew")}
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
                  {businessLabel(WARRANTY_STATUS_LABELS, value)}
                </MenuItem>
              ))}
            </UiTextField>
            {statusValue === "REPAIRING" ? (
              <UiTextField
                fullWidth
                type="date"
                required
                label={t("warranty.detail.statusEstimatedDate")}
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
                  htmlInput: { ...estimatedInput },
                }}
              />
            ) : null}
            {statusValue &&
            WARRANTY_DIAGNOSIS_REQUIRED_TARGETS.includes(statusValue) ? (
              // Chẩn đoán lúc tiếp nhận (defect_ids gốc) có thể sai — cho chọn
              // lại bệnh/lỗi ngay khi chuyển sang Đang sửa chữa/Đã hoàn tất.
              // Mặc định RỖNG (không pre-fill bệnh lỗi hiện có của case):
              // không chọn gì thì submitStatus không gửi defect_ids, case giữ
              // nguyên bệnh lỗi cũ.
              <UiFormAutocomplete
                control={statusDefectForm.control}
                name="defect_ids"
                multiple
                options={defectOptions}
                label={t("warranty.detail.statusRepickDefect")}
                placeholder={t("warranty.detail.statusRepickPlaceholder")}
              />
            ) : null}
            {statusValue &&
            WARRANTY_DIAGNOSIS_REQUIRED_TARGETS.includes(statusValue) ? (
              // Field riêng cho "Kết quả kiểm tra" (confirmed_defect) — KHÔNG
              // phải ô ghi chú chung. Chỉ hiện khi đang chuyển sang bước cần
              // chẩn đoán (Đang sửa chữa/Đã hoàn tất) để tránh người dùng gõ
              // nhầm vào đây ở các bước khác (vd. Đã trả khách) rồi ghi đè mất
              // kết quả kiểm tra đã có trên phiếu.
              <UiTextField
                fullWidth
                multiline
                minRows={2}
                required={diagnosisRequired}
                label={
                  diagnosisRequired
                    ? t("warranty.detail.statusCheckRequired")
                    : t("warranty.detail.statusCheckOptional")
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
                  statusFieldErrors.confirmed_defect ||
                  `${statusForm.confirmed_defect.length}/2000`
                }
                slotProps={{ htmlInput: { maxLength: 2000 } }}
              />
            ) : null}
            {statusValue === "CANCELLED" ? (
              <UiTextField
                fullWidth
                multiline
                minRows={2}
                required
                label={t("warranty.detail.statusCancelReason")}
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
                  statusFieldErrors.cancel_reason ||
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
              label={
                noteRequiredLabel
                  ? t(noteRequiredLabel)
                  : t("warranty.detail.statusNote")
              }
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
                statusFieldErrors.reason || `${statusForm.reason.length}/2000`
              }
              slotProps={{ htmlInput: { maxLength: 2000 } }}
            />
          </Stack>
        </UiDialog>
      </UiDialog>

      {/* Nhãn trả máy — mount NGOÀI dialog chi tiết (anh em của nó) để hộp
          thoại in không phải nằm trong vùng cuộn của modal cha. */}
      <WarrantyReturnLabelDialog
        open={returnLabelOpen}
        detail={detail ?? null}
        onClose={() => setReturnLabelOpen(false)}
      />
    </>
  );
}
