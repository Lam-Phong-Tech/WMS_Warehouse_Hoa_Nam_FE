/**
 * Hiển thị ID kỹ thuật (UUID nội bộ, request id, mã biến động tồn kho...) an toàn
 * cho người dùng cuối: luôn rút gọn giữa chuỗi + có nút sao chép giá trị đầy đủ
 * (phục vụ tra soát/hỗ trợ), KHÔNG BAO GIỜ in nguyên chuỗi thô lên màn hình.
 *
 * Dùng thay cho việc render trực tiếp `{evidence.requestId}` / `{row.id}` v.v.
 * Dùng `shortId()` (không kèm nút copy) cho các vị trí chỉ nhận text thuần
 * (tiêu đề dialog, chuỗi template) — vẫn không được lộ chuỗi thô đầy đủ.
 */
import { useState } from "react";
import { Box, Stack, type BoxProps } from "@/shared/ui";
import { SEMANTIC_LIGHT as S } from "@/shared/ui/tokens";
import { shortId } from "@/shared/utils/shortId";
import { ActionIconButton } from "../actions/ActionIconButton";
import { useT } from "@/shared/i18n/useT";

export interface CopyableIdProps {
  /** Giá trị đầy đủ — được copy nguyên vẹn, chỉ phần rút gọn được hiển thị. */
  value: string | null | undefined;
  /** Số ký tự giữ lại mỗi đầu khi rút gọn. Mặc định 6. */
  visibleChars?: number;
  sx?: BoxProps["sx"];
}

export function CopyableId({ value, visibleChars = 6, sx }: CopyableIdProps) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  if (!value) return null;

  const handleCopy = () => {
    void navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <Stack
      direction="row"
      spacing={0.5}
      sx={{ display: "inline-flex", alignItems: "center" }}
    >
      <Box
        component="code"
        sx={[
          {
            fontFamily: "var(--wms-font-family)",
            fontSize: 13,
            px: 0.5,
            borderRadius: 1,
            backgroundColor: S.secondarySoft,
            color: S.textHigh,
          },
          ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
        ]}
      >
        {shortId(value, visibleChars)}
      </Box>
      <ActionIconButton
        kind="copy"
        label={copied ? t("shared.copy.copied") : t("shared.copy.copyFullId")}
        onClick={handleCopy}
      />
    </Stack>
  );
}
