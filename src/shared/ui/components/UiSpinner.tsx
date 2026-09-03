/**
 * UiSpinner — vòng quay chờ canonical, thay MUI CircularProgress.
 *
 * Lý do thay: CircularProgress vẽ bằng <svg>+<circle> của MUI, tức là một
 * "hình vẽ" nằm ngoài bộ icon chốt của dự án. Bản này dùng glyph Flaticon
 * `spinner` + keyframes `hn-spin` (src/index.css) nên toàn bộ ký hiệu
 * trên UI đến từ MỘT nguồn duy nhất. `prefers-reduced-motion` đã được tắt
 * animation ở hn-motion.css nên không cần xử lý riêng.
 *
 * A11y giữ nguyên hợp đồng cũ: role="progressbar" + tên accessible mặc định.
 */
import { COMPONENT_TOKENS } from "@/shared/ui/tokens";
import { flatIconClass } from "@/shared/ui/icons/icon-family";
import { useT } from "@/shared/i18n/useT";

export interface UiSpinnerProps {
  /** Cỡ glyph (px) — mặc định icon.md của token. */
  size?: number;
  /** Màu; bỏ trống ⇒ kế thừa màu chữ (giống color="inherit" của MUI). */
  color?: string;
  /** Tên accessible; đặt null khi có nhãn mô tả ngay bên cạnh. */
  label?: string | null;
  className?: string;
  "data-testid"?: string;
}

export function UiSpinner({
  size = COMPONENT_TOKENS.icon.md,
  color,
  label,
  className,
  "data-testid": dataTestId,
}: UiSpinnerProps) {
  const t = useT();
  // label === null nghĩa là "đã có nhãn mô tả bên cạnh" → bỏ aria-label;
  // không truyền thì dùng nhãn mặc định theo ngôn ngữ.
  const resolvedLabel =
    label === null ? undefined : (label ?? t("shared.states.loadingPlain"));
  return (
    <span
      role="progressbar"
      aria-label={resolvedLabel}
      aria-busy="true"
      className={className ? `hn-spinner ${className}` : "hn-spinner"}
      data-testid={dataTestId}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        ...(color ? { color } : null),
      }}
    >
      <i
        aria-hidden="true"
        className={flatIconClass("spinner")}
        style={{
          fontSize: size,
          lineHeight: 1,
          display: "inline-flex",
          animation: "hn-spin 900ms linear infinite",
        }}
      />
    </span>
  );
}
