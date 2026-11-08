import { useRef } from "react";
import { Box, Stack } from "@/shared/ui";
import { ActionButton, ActionIconButton } from "@/shared/components/actions";
import { useT } from "@/shared/i18n/useT";
import { acceptAttribute, FILE_RULES } from "@/shared/validation/file-rules";

export interface PendingInboundAttachment {
  id: string;
  file: File;
  status: "selected" | "uploading" | "uploaded" | "failed";
  error?: string;
}

export function InboundCreateAttachments({
  files,
  busy,
  receiptCreated,
  onSelect,
  onRemove,
}: {
  files: PendingInboundAttachment[];
  busy: boolean;
  receiptCreated: boolean;
  onSelect: (files: File[]) => void;
  onRemove: (id: string) => void;
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
        aria-label={t("inbound.draft.selectAttachments")}
        accept={acceptAttribute(FILE_RULES.documentAttachment)}
        disabled={busy || receiptCreated}
        onChange={(event) => {
          onSelect(Array.from(event.currentTarget.files ?? []));
          event.currentTarget.value = "";
        }}
      />
      {!receiptCreated ? (
        <ActionButton
          kind="upload"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {t("inbound.draft.selectAttachments")}
        </ActionButton>
      ) : null}
      <Box sx={{ typography: "caption", color: "text.secondary", mt: 1 }}>
        {t("inbound.draft.localAttachmentsHint")}
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
                  ? t("inbound.draft.attachmentSelected")
                  : entry.status === "uploading"
                    ? t("shared.attachments.uploading")
                    : entry.status === "uploaded"
                      ? t("inbound.draft.attachmentUploaded")
                      : entry.error || t("shared.attachments.uploadError")}
              </Box>
            </Box>
            {entry.status !== "uploaded" ? (
              <ActionIconButton
                kind="remove"
                disabled={busy}
                label={t("inbound.draft.removeAttachment", {
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
