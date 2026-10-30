import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { SEMANTIC_LIGHT } from "@/shared/ui/tokens";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  FilePdfOutlined,
  PaperClipOutlined,
  UploadOutlined,
} from "@/shared/components/icons";
import { ACTION_ICON_COLORS } from "@/shared/theme/actionIconColors";
import { getApiErrorMessage } from "@/shared/api/api-error";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { http } from "@/shared/api/http";
import {
  deleteDocumentAttachment,
  downloadDocumentAttachment,
  fetchDocumentAttachments,
  uploadDocumentAttachment,
  type DocumentAttachment,
  type DocumentAttachmentType,
} from "@/shared/api/documentAttachmentService";
import { formatDateTime } from "@/shared/utils/format-date";
import { ActionButton, ActionIconButton } from "@/shared/components/actions";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { tStatic, useT } from "@/shared/i18n/useT";
import {
  FILE_RULES,
  acceptAttribute,
  checkFile,
} from "@/shared/validation/file-rules";
import type { MessageKey } from "@/shared/i18n/messages";

/**
 * "Chứng từ nhập/xuất/hoàn trả": khối đính kèm chứng từ dùng chung cho phiếu
 * nhập/xuất/hoàn trả — cùng một bảng/controller BE (document_attachments,
 * DocumentAttachmentController) nên FE cũng dùng một component tham số hoá
 * theo documentType, thay vì tự lặp lại 3 lần cho mỗi module.
 *
 * Ảnh hiển thị dạng thư viện thumbnail (bấm để xem lớn) thay vì danh sách tên
 * tệp: tên tệp thật do máy ảnh/điện thoại đặt (`72086580_1103086...n.jpg`) không
 * mang thông tin gì cho người đối soát, chỉ làm rối khối chứng từ.
 */
export interface DocumentAttachmentsPanelProps {
  documentType: DocumentAttachmentType;
  documentId: string;
  /** Phiếu đã POSTED/CANCELLED — BE trả 409 STATE_CONFLICT nếu vẫn cố upload. */
  disabled?: boolean;
  /** Optional screen-scoped presentation for the preview and deletion portals. */
  dialogClassName?: string;
}

/**
 * Luật tệp lấy từ lớp dùng chung (file-rules.ts) thay vì hai hằng số tại chỗ:
 * `accept` CHỈ lọc hộp thoại chọn tệp, còn vùng KÉO-THẢ bên dưới đi thẳng vào
 * `handleFilesChosen` — trước đây chỗ đó chỉ đo dung lượng nên thả một `.exe`
 * vào là tệp bay lên API (rà soát 06/09/2026).
 */
const ATTACHMENT_FILE_RULE = FILE_RULES.documentAttachment;
const ACCEPTED_EXTENSIONS = acceptAttribute(ATTACHMENT_FILE_RULE);

/** Nhãn i18n cho attachment_type — trước đây in thẳng enum BE ra UI. */
const ATTACHMENT_KIND_KEYS: Record<string, MessageKey> = {
  SOURCE_DOCUMENT: "shared.attachments.kindSourceDocument",
  INVOICE: "shared.attachments.kindInvoice",
  DELIVERY_NOTE: "shared.attachments.kindDeliveryNote",
  PHOTO: "shared.attachments.kindPhoto",
  OTHER: "shared.attachments.kindOther",
};

/** Tham chiếu ổn định cho danh sách rỗng: dùng làm dependency của effect tải ảnh. */
const EMPTY_ATTACHMENTS: DocumentAttachment[] = [];

function formatFileSize(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) return EMPTY_TEXT;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function kindLabel(attachment: DocumentAttachment): string {
  const key = ATTACHMENT_KIND_KEYS[attachment.attachment_type];
  return key ? tStatic(key) : attachment.attachment_type;
}

function uploadedAtLabel(attachment: DocumentAttachment): string {
  return attachment.uploaded_at
    ? formatDateTime(attachment.uploaded_at)
    : EMPTY_TEXT;
}

/** content_type có thể rỗng ở bản ghi cũ nên suy thêm từ đuôi tệp. */
function isImageAttachment(attachment: DocumentAttachment): boolean {
  return (
    (attachment.content_type ?? "").startsWith("image/") ||
    /\.(jpe?g|png|webp)$/i.test(attachment.file_name)
  );
}

function isPdfAttachment(attachment: DocumentAttachment): boolean {
  return (
    (attachment.content_type ?? "").includes("pdf") ||
    /\.pdf$/i.test(attachment.file_name)
  );
}

/**
 * Chứng từ nằm trên private disk (không có URL public) nên phải tải blob qua
 * endpoint download rồi dựng object URL. Tải một lần ở cấp panel và chia sẻ cho
 * cả ô thumbnail lẫn khung xem lớn — nếu để mỗi ô tự tải thì mở xem ảnh sẽ gọi
 * mạng lại lần hai cho đúng tệp vừa hiển thị.
 */
function useAttachmentImageUrls(
  attachments: DocumentAttachment[],
): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    const created: string[] = [];
    attachments.filter(isImageAttachment).forEach((attachment) => {
      http
        .downloadBlob(
          API_ENDPOINTS.DOCUMENT_ATTACHMENT_DOWNLOAD.replace(
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

export function DocumentAttachmentsPanel({
  documentType,
  documentId,
  disabled = false,
  dialogClassName,
}: DocumentAttachmentsPanelProps) {
  const t = useT();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryKey = ["document-attachments", documentType, documentId];

  const query = useQuery({
    queryKey,
    queryFn: () => fetchDocumentAttachments(documentType, documentId),
    enabled: Boolean(documentId),
  });

  const [previewId, setPreviewId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: (file: File) =>
      uploadDocumentAttachment({ documentType, documentId, file }),
    onSuccess: () => {
      toast.success(t("shared.attachments.uploadSuccess"));
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, t("shared.attachments.uploadError")),
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (attachmentId: string) =>
      deleteDocumentAttachment(attachmentId),
    onSuccess: (_data, attachmentId) => {
      toast.success(t("shared.attachments.deleteSuccess"));
      if (previewId === attachmentId) setPreviewId(null);
      setDeleteConfirmId(null);
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, t("shared.attachments.deleteError")),
      );
    },
  });

  function handleFilesChosen(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    if (files.length === 0) return;
    // BE nhận 1 tệp/request; chọn hoặc kéo-thả nhiều tệp thì tải tuần tự.
    files.forEach((file) => {
      // Kiểm CẢ loại tệp lẫn dung lượng — đường kéo-thả không qua `accept`.
      const check = checkFile(file, ATTACHMENT_FILE_RULE);
      if (!check.ok) {
        toast.error(check.message);
        return;
      }
      uploadMutation.mutate(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const attachments = query.isError
    ? EMPTY_ATTACHMENTS
    : (query.data?.attachments ?? EMPTY_ATTACHMENTS);
  const evidenceStatus = query.isSuccess ? query.data.evidenceStatus : null;
  const imageAttachments = attachments.filter(isImageAttachment);
  const fileAttachments = attachments.filter(
    (attachment) => !isImageAttachment(attachment),
  );
  const imageUrls = useAttachmentImageUrls(attachments);
  const previewIndex = previewId
    ? imageAttachments.findIndex((attachment) => attachment.id === previewId)
    : -1;
  const previewAttachment =
    previewIndex >= 0 ? imageAttachments[previewIndex] : null;
  const deleteTarget = attachments.find(
    (attachment) => attachment.id === deleteConfirmId,
  );

  const handleDownload = (attachment: DocumentAttachment) =>
    void downloadDocumentAttachment({
      attachmentId: attachment.id,
      fileName: attachment.file_name,
    });

  return (
    <Stack spacing={1.25}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <PaperClipOutlined style={{ fontSize: 16 }} />
        <Typography sx={{ fontWeight: 700 }}>
          {`${t("shared.attachments.title")}${attachments.length ? ` (${attachments.length})` : ""}`}
        </Typography>
        {evidenceStatus === "PENDING" ? (
          <Chip
            size="small"
            color="warning"
            label={t("shared.attachments.evidencePending")}
          />
        ) : evidenceStatus === "PROVIDED" ? (
          <Chip
            size="small"
            color="success"
            label={t("shared.attachments.evidenceProvided")}
          />
        ) : null}
      </Stack>

      {evidenceStatus === "PENDING" ? (
        <Alert severity="warning">
          {t("shared.attachments.evidenceRequiredAlert")}
        </Alert>
      ) : null}

      {query.isLoading ? (
        <Typography variant="body2" color="text.secondary">
          {t("shared.attachments.loadingList")}
        </Typography>
      ) : query.isError ? (
        <ApiErrorAlert
          error={query.error}
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : (
        <>
          {imageAttachments.length || !disabled ? (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))",
                gap: 1.5,
              }}
            >
              {imageAttachments.map((attachment) => (
                <Box key={attachment.id} sx={{ minWidth: 0 }}>
                  <Tooltip
                    title={`${kindLabel(attachment)} · ${attachment.file_name}`}
                  >
                    <Box
                      role="button"
                      tabIndex={0}
                      aria-label={t("shared.attachments.viewAttachment", {
                        name: attachment.file_name,
                      })}
                      onClick={() => setPreviewId(attachment.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setPreviewId(attachment.id);
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
                      {imageUrls[attachment.id] ? (
                        <Box
                          component="img"
                          src={imageUrls[attachment.id]}
                          alt={kindLabel(attachment)}
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
                        sx={{
                          position: "absolute",
                          top: 4,
                          right: 4,
                          opacity: 0,
                        }}
                      >
                        <ActionIconButton
                          kind="download"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDownload(attachment);
                          }}
                          sx={OVERLAY_ICON_BUTTON_SX}
                        />
                        {disabled ? null : (
                          <ActionIconButton
                            kind="delete"
                            onClick={(event) => {
                              event.stopPropagation();
                              setDeleteConfirmId(attachment.id);
                            }}
                            sx={OVERLAY_ICON_BUTTON_SX}
                          />
                        )}
                      </Stack>
                    </Box>
                  </Tooltip>
                  {/* Không in tên tệp thô: nhãn nghiệp vụ + dung lượng mới là thứ
                      người đối soát cần; tên tệp nằm ở tooltip và khung xem lớn. */}
                  <Typography
                    variant="caption"
                    noWrap
                    sx={{ display: "block", mt: 0.5 }}
                  >
                    {kindLabel(attachment)}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    noWrap
                    sx={{ display: "block", fontSize: 11 }}
                  >
                    {formatFileSize(attachment.file_size_bytes)}
                  </Typography>
                </Box>
              ))}

              {disabled ? null : (
                <Box
                  component="label"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    handleFilesChosen(event.dataTransfer.files);
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
                    textAlign: "center",
                    cursor: uploadMutation.isPending
                      ? "not-allowed"
                      : "pointer",
                    opacity: uploadMutation.isPending ? 0.6 : 1,
                    "&:hover": uploadMutation.isPending
                      ? undefined
                      : { borderColor: "primary.main", color: "primary.main" },
                  }}
                >
                  <UploadOutlined style={{ fontSize: 18 }} />
                  <Typography variant="caption">
                    {uploadMutation.isPending
                      ? t("shared.attachments.uploading")
                      : t("shared.attachments.attach")}
                  </Typography>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_EXTENSIONS}
                    multiple
                    hidden
                    disabled={uploadMutation.isPending}
                    onChange={(event) => handleFilesChosen(event.target.files)}
                  />
                </Box>
              )}
            </Box>
          ) : null}

          {fileAttachments.length ? (
            <Stack spacing={1}>
              {fileAttachments.map((attachment) => (
                <Stack
                  key={attachment.id}
                  direction="row"
                  spacing={1.25}
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
                    {isPdfAttachment(attachment) ? (
                      <FilePdfOutlined
                        style={{
                          color: ACTION_ICON_COLORS.danger,
                          fontSize: 18,
                        }}
                      />
                    ) : (
                      <PaperClipOutlined style={{ fontSize: 16 }} />
                    )}
                  </Box>
                  <Stack spacing={0} sx={{ minWidth: 0, flexGrow: 1 }}>
                    <Typography
                      variant="body2"
                      noWrap
                      title={attachment.file_name}
                      sx={{ fontWeight: 600 }}
                    >
                      {kindLabel(attachment)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {`${formatFileSize(attachment.file_size_bytes)} · ${uploadedAtLabel(attachment)}`}
                    </Typography>
                  </Stack>
                  <ActionIconButton
                    kind="download"
                    onClick={() => handleDownload(attachment)}
                  />
                  {disabled ? null : (
                    <ActionIconButton
                      kind="delete"
                      onClick={() => setDeleteConfirmId(attachment.id)}
                    />
                  )}
                </Stack>
              ))}
            </Stack>
          ) : null}

          {attachments.length === 0 && disabled ? (
            <Typography variant="body2" color="text.secondary">
              {t("shared.attachments.noAttachments")}
            </Typography>
          ) : null}

          {disabled ? null : (
            <Typography variant="caption" color="text.secondary">
              {t("shared.attachments.uploadHint")}
            </Typography>
          )}
        </>
      )}

      {/* Xem chứng từ ngay tại chỗ: trước đây muốn nhìn ảnh phải tải tệp về máy. */}
      <Dialog
        className={dialogClassName}
        open={previewAttachment !== null}
        onClose={() => setPreviewId(null)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ pr: 6, position: "relative" }}>
          {/* component="span": DialogTitle đã là <h2>, lồng <h6> vào sẽ vỡ HTML. */}
          <Typography
            variant="subtitle1"
            component="span"
            noWrap
            sx={{ fontWeight: 700, display: "block" }}
          >
            {previewAttachment ? kindLabel(previewAttachment) : ""}
          </Typography>
          <Typography
            variant="caption"
            component="span"
            color="text.secondary"
            sx={{ display: "block" }}
          >
            {previewAttachment
              ? `${previewIndex + 1}/${imageAttachments.length} · ${formatFileSize(
                  previewAttachment.file_size_bytes,
                )} · ${uploadedAtLabel(previewAttachment)} · ${previewAttachment.file_name}`
              : null}
          </Typography>
          <ActionIconButton
            kind="close"
            label={t("shared.attachments.closePreview")}
            onClick={() => setPreviewId(null)}
            sx={{ position: "absolute", right: 10, top: 8 }}
          />
        </DialogTitle>
        <DialogContent
          dividers
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "action.hover",
            minHeight: 320,
          }}
        >
          {previewAttachment && imageUrls[previewAttachment.id] ? (
            <Box
              component="img"
              src={imageUrls[previewAttachment.id]}
              alt={kindLabel(previewAttachment)}
              sx={{
                maxWidth: "100%",
                maxHeight: "68vh",
                objectFit: "contain",
                display: "block",
              }}
            />
          ) : (
            <Typography variant="body2" color="text.secondary">
              {t("shared.attachments.imageFallback")}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <ActionButton
            kind="back"
            disabled={previewIndex <= 0}
            onClick={() =>
              setPreviewId(imageAttachments[previewIndex - 1]?.id ?? null)
            }
          >
            {t("shared.attachments.prevImage")}
          </ActionButton>
          <ActionButton
            kind="next"
            disabled={
              previewIndex < 0 || previewIndex >= imageAttachments.length - 1
            }
            onClick={() =>
              setPreviewId(imageAttachments[previewIndex + 1]?.id ?? null)
            }
          >
            {t("shared.attachments.nextImage")}
          </ActionButton>
          <Box sx={{ flexGrow: 1 }} />
          <ActionButton
            kind="download"
            onClick={() =>
              previewAttachment && handleDownload(previewAttachment)
            }
          >
            {t("shared.actions.download")}
          </ActionButton>
          <ActionButton kind="close" onClick={() => setPreviewId(null)}>
            {t("common.close")}
          </ActionButton>
        </DialogActions>
      </Dialog>

      {/* Xoá chứng từ là hành động không hoàn tác — trước đây bấm icon là mất luôn. */}
      <Dialog
        className={dialogClassName}
        open={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{t("shared.attachments.deleteConfirmTitle")}</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {deleteTarget
              ? `${kindLabel(deleteTarget)} · ${deleteTarget.file_name}`
              : ""}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t("shared.attachments.deleteConfirmNote")}
          </Typography>
        </DialogContent>
        <DialogActions>
          <ActionButton
            kind="cancel"
            onClick={() => setDeleteConfirmId(null)}
            disabled={deleteMutation.isPending}
          >
            {t("shared.actions.no")}
          </ActionButton>
          <ActionButton
            kind="delete"
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (deleteConfirmId) deleteMutation.mutate(deleteConfirmId);
            }}
          >
            {t("shared.actions.delete")}
          </ActionButton>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
