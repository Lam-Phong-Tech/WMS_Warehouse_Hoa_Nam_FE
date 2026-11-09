import { useRef, type ReactNode } from "react";
import { Box, Stack } from "@/shared/ui";
import { ActionButton, ActionIconButton } from "@/shared/components/actions";
import { useT } from "@/shared/i18n/useT";
import { acceptAttribute, FILE_RULES } from "@/shared/validation/file-rules";

export interface PendingDocumentAttachment {
  id: string;
  file: File;
  status: "selected" | "uploading" | "uploaded" | "failed";
  error?: string;
}

/**
 * Khối chọn nhiều chứng từ (ảnh/PDF) giữ tệp ở local cho tới khi phiếu được
 * tạo. Dùng chung cho form tạo phiếu nhập và form tiếp nhận yêu cầu xuất:
 * cùng luật tệp, cùng trạng thái selected → uploading → uploaded/failed.
 */
export function PendingDocumentAttachments({
  files,
  busy,
  locked,
  onSelect,
  onRemove,
  hint,
}: {
  files: PendingDocumentAttachment[];
  busy: boolean;
  locked: boolean;
  onSelect: (files: File[]) => void;
  onRemove: (id: string) => void;
  hint?: ReactNode;
}) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <Box
      component="section"
      sx={{ mt: 2 }}
      aria-label={t("shared.attachments.title")}
    >
      <Box
        component="h3"
        sx={{ typography: "subtitle2", fontWeight: 700, mb: 1 }}
      >
        {t("shared.attachments.title")}
      </Box>
      <input
        ref={inputRef}
        type="file"
        hidden
        multiple
        aria-label={t("shared.attachments.selectFiles")}
        accept={acceptAttribute(FILE_RULES.documentAttachment)}
        disabled={busy || locked}
        onChange={(event) => {
          onSelect(Array.from(event.currentTarget.files ?? []));
          event.currentTarget.value = "";
        }}
      />
      {!locked ? (
        <ActionButton
          kind="upload"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {t("shared.attachments.selectFiles")}
        </ActionButton>
      ) : null}
      <Box sx={{ typography: "caption", color: "text.secondary", mt: 1 }}>
        {hint ?? t("shared.attachments.pendingHint")}
      </Box>
      <Stack component="ul" spacing={1} sx={{ listStyle: "none", p: 0, my: 1 }}>
        {files.map((entry) => (
          <Stack
            component="li"
            key={entry.id}
            direction="row"
            sx={{
              alignItems: "center",
              gap: 1,
              p: 1,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>
              <Box sx={{ typography: "body2", fontWeight: 600 }}>
                {entry.file.name}
              </Box>
              <Box
                sx={{
                  typography: "caption",
                  color:
                    entry.status === "failed" ? "error.main" : "text.secondary",
                }}
                aria-live="polite"
              >
                {entry.status === "selected"
                  ? t("shared.attachments.pendingSelected")
                  : entry.status === "uploading"
                    ? t("shared.attachments.uploading")
                    : entry.status === "uploaded"
                      ? t("shared.attachments.pendingUploaded")
                      : entry.error || t("shared.attachments.uploadError")}
              </Box>
            </Box>
            {entry.status !== "uploaded" ? (
              <ActionIconButton
                kind="remove"
                disabled={busy}
                label={t("shared.attachments.removeFile", {
                  name: entry.file.name,
                })}
                onClick={() => onRemove(entry.id)}
              />
            ) : null}
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}
