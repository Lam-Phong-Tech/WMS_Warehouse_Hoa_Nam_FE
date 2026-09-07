/**
 * BANNER GỢI Ý BỘ LỌC KỲ — đặt ngay dưới thanh lọc của mỗi màn báo cáo.
 *
 * Nội dung do `buildRangeAdvice` quyết (xem `report-range-advice.ts`); ở đây
 * chỉ lo phần nhìn và hai hành động: ÁP DỤNG khoảng đề xuất, hoặc ĐÓNG.
 *
 * Đóng banner chỉ tắt ĐÚNG lời khuyên đang hiện: đổi kỳ khác mà lại rơi vào
 * tình huống khác thì banner hiện lại. Nếu ghi nhớ theo màn, người dùng bỏ qua
 * một lần rồi mất luôn kênh nhắc cho mọi kỳ sau đó.
 *
 * Component tự dựng vỏ (`UiAlert` của design system) nên KHÔNG thừa hưởng CSS
 * của các trang port — bốn màn báo cáo đang dùng CSS riêng theo mockup, banner
 * phải trông như nhau ở cả tám màn.
 */
import { useState } from "react";
import { Box, UiAlert, UiButton } from "@/shared/ui";
import type { RangeAdvice, SuggestedRange } from "./report-range-advice";

/** Danh tính của một lời khuyên — đổi nội dung là banner hiện lại. */
function adviceId(advice: RangeAdvice): string {
  const range = advice.suggested;
  return `${advice.kind}|${range?.from ?? ""}|${range?.to ?? ""}|${advice.message}`;
}

export function ReportRangeAdviceBanner({
  advice,
  onApply,
}: {
  advice: RangeAdvice | null;
  /** Áp dụng khoảng đề xuất vào bộ lọc kỳ của màn. */
  onApply: (range: SuggestedRange) => void;
}) {
  const [dismissed, setDismissed] = useState<string | null>(null);

  if (advice === null) return null;
  const id = adviceId(advice);
  if (dismissed === id) return null;

  return (
    <Box
      data-testid="report-range-advice"
      data-advice-kind={advice.kind}
      sx={{ mb: 2 }}
    >
      <UiAlert
        tone={advice.tone}
        title={advice.title}
        onClose={() => setDismissed(id)}
      >
        <Box sx={{ fontSize: 13, lineHeight: 1.6 }}>{advice.message}</Box>
        {advice.suggested && advice.actionLabel ? (
          <Box sx={{ mt: 1 }}>
            <UiButton
              size="small"
              appearance="outlined"
              // `inherit` để nút mượn đúng tông chữ của alert (info/warning)
              // thay vì kéo màu primary vào giữa một khối đang nói chuyện khác.
              color="inherit"
              data-testid="report-range-advice-apply"
              onClick={() => {
                // Đóng luôn: bấm xong thì kỳ đổi, lời khuyên cũ không còn đúng
                // nữa và sẽ được tính lại từ dữ liệu của kỳ mới.
                setDismissed(id);
                onApply(advice.suggested as SuggestedRange);
              }}
            >
              {advice.actionLabel}
            </UiButton>
          </Box>
        ) : null}
      </UiAlert>
    </Box>
  );
}

export default ReportRangeAdviceBanner;
