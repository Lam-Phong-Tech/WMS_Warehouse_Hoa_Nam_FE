import type { ReactNode } from "react";
import { Box, Stack, UiButton } from "@/shared/ui";
import { CARD_SX, CAPTION_SX, SECTION_TITLE_SX } from "./dashboard-styles";

/**
 * Nhóm nút chọn kỳ/chiều xem.
 *
 * Design system không có ToggleButtonGroup; đây là pattern filled/outlined đã dùng
 * sẵn cho bộ chọn kỳ của dashboard — giữ nguyên để cả trang chỉ có MỘT kiểu toggle.
 */
export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
  label: string;
}) {
  return (
    <Stack
      direction="row"
      spacing={1}
      role="group"
      aria-label={label}
      // minWidth:0 + maxWidth:100% để nhóm nút co được trong flex cha; thiếu hai
      // dòng này thì ở 375px nhóm giữ nguyên bề rộng max-content và nút cuối bị
      // cắt mất khỏi màn hình thay vì xuống dòng.
      sx={{ flexWrap: "wrap", rowGap: 1, minWidth: 0, maxWidth: "100%" }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <UiButton
            key={option.value}
            size="small"
            appearance={active ? "filled" : "outlined"}
            aria-pressed={active}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </UiButton>
        );
      })}
    </Stack>
  );
}

/** Card bọc một biểu đồ: tiêu đề + mô tả + thanh toggle + vùng vẽ. */
export function ChartCard({
  title,
  description,
  toggle,
  children,
  footer,
  fullWidth,
}: {
  title: string;
  description: string;
  toggle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  fullWidth?: boolean;
}) {
  const titleId = `chart-${title.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <Box
      component="section"
      aria-labelledby={titleId}
      sx={{ ...CARD_SX, ...(fullWidth ? { gridColumn: "1 / -1" } : null) }}
    >
      <Stack
        direction="row"
        sx={{
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 1.5,
          mb: 1.5,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Box component="h3" id={titleId} sx={SECTION_TITLE_SX}>
            {title}
          </Box>
          <Box sx={{ ...CAPTION_SX, mt: 0.5 }}>{description}</Box>
        </Box>
        {toggle}
      </Stack>
      {children}
      {footer}
    </Box>
  );
}
