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
}

const ACCEPTED_EXTENSIONS = ".jpg,.jpeg,.png,.webp,.pdf";
const MAX_FILE_BYTES = 15 * 1024 * 1024;

/** Nhãn tiếng Việt cho attachment_type — trước đây in thẳng enum BE ra UI. */
const ATTACHMENT_KIND_LABELS: Record<string, string> = {
  SOURCE_DOCUMENT: "Chứng từ gốc",
  INVOICE: "Hóa đơn",
  DELIVERY_NOTE: "Phiếu giao hàng",
  PHOTO: "Ảnh hiện trạng",
  OTHER: "Khác",
};

/** Tham chiếu ổn định cho danh sách rỗng: dùng làm dependency của effect tải ảnh. */
const EMPTY_ATTACHMENTS: DocumentAttachment[] = [];

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function kindLabel(attachment: DocumentAttachment): string {
  return (
    ATTACHMENT_KIND_LABELS[attachment.attachment_type] ??
    attachment.attachment_type
  );
}

function uploadedAtLabel(attachment: DocumentAttachment): string {
  return attachment.uploaded_at ? formatDateTime(attachment.uploaded_at) : "-";
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
}: DocumentAttachmentsPanelProps) {
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
      toast.success("Đã tải lên chứng từ đính kèm.");
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, "Không thể tải lên chứng từ đính kèm."),
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (attachmentId: string) =>
      deleteDocumentAttachment(attachmentId),
    onSuccess: (_data, attachmentId) => {
      toast.success("Đã xoá chứng từ đính kèm.");
      if (previewId === attachmentId) setPreviewId(null);
      setDeleteConfirmId(null);
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, "Không thể xoá chứng từ đính kèm."),
      );
    },
  });

  function handleFilesChosen(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    if (files.length === 0) return;
    // BE nhận 1 tệp/request; chọn hoặc kéo-thả nhiều tệp thì tải tuần tự.
    files.forEach((file) => {
      if (file.size > MAX_FILE_BYTES) {
        toast.error(`${file.name}: chứng từ vượt quá 15MB.`);
        return;
      }
      uploadMutation.mutate(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const attachments = query.data?.attachments ?? EMPTY_ATTACHMENTS;
  const evidenceStatus = query.data?.evidenceStatus ?? "NOT_REQUIRED";
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
          {`Chứng từ đính kèm${attachments.length ? ` (${attachments.length})` : ""}`}
        </Typography>
        {evidenceStatus === "PENDING" ? (
          <Chip size="small" color="warning" label="Cần bổ sung chứng từ" />
        ) : evidenceStatus === "PROVIDED" ? (
          <Chip size="small" color="success" label="Đã có chứng từ" />
        ) : null}
      </Stack>

      {evidenceStatus === "PENDING" ? (
        <Alert severity="warning">
          Phiếu này bắt buộc có ít nhất một chứng từ đính kèm để đối soát trước
          khi Post.
        </Alert>
      ) : null}

      {query.isLoading ? (
        <Typography variant="body2" color="text.secondary">
          Đang tải danh sách chứng từ...
        </Typography>
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
                      aria-label={`Xem chứng từ ${attachment.file_name}`}
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
                    borderRadius: 2,
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
                    {uploadMutation.isPending ? "Đang tải lên…" : "Đính kèm"}
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
              Chưa có chứng từ nào đính kèm.
            </Typography>
          ) : null}

          {disabled ? null : (
            <Typography variant="caption" color="text.secondary">
              JPG/PNG/WEBP hoặc PDF, mỗi tệp ≤ 15MB. Bấm vào ảnh để xem lớn.
            </Typography>
          )}
        </>
      )}

      {/* Xem chứng từ ngay tại chỗ: trước đây muốn nhìn ảnh phải tải tệp về máy. */}
      <Dialog
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
            label="Đóng xem chứng từ"
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
              Không hiển thị được ảnh — tải tệp xuống để xem.
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
            Ảnh trước
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
            Ảnh sau
          </ActionButton>
          <Box sx={{ flexGrow: 1 }} />
          <ActionButton
            kind="download"
            onClick={() =>
              previewAttachment && handleDownload(previewAttachment)
            }
          >
            Tải xuống
          </ActionButton>
          <ActionButton kind="close" onClick={() => setPreviewId(null)}>
            Đóng
          </ActionButton>
        </DialogActions>
      </Dialog>

      {/* Xoá chứng từ là hành động không hoàn tác — trước đây bấm icon là mất luôn. */}
      <Dialog
        open={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Xoá chứng từ đính kèm này?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {deleteTarget
              ? `${kindLabel(deleteTarget)} · ${deleteTarget.file_name}`
              : ""}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Chứng từ bị gỡ khỏi phiếu và không khôi phục được từ màn này.
          </Typography>
        </DialogContent>
        <DialogActions>
          <ActionButton
            kind="cancel"
            onClick={() => setDeleteConfirmId(null)}
            disabled={deleteMutation.isPending}
          >
            Không
          </ActionButton>
          <ActionButton
            kind="delete"
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (deleteConfirmId) deleteMutation.mutate(deleteConfirmId);
            }}
          >
            Xoá
          </ActionButton>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
