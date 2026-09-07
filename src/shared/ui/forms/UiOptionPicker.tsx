/**
 * UiOptionPicker — RUỘT của mọi bộ chọn-nhiều mở ra từ một nút (bộ lọc trên
 * thanh công cụ, bộ chọn đối tượng so sánh…).
 *
 * Chỉ là phần bên trong tấm thả xuống: ô tìm kiếm + danh sách có checkbox +
 * dòng trạng thái. Nút bấm mở ra và `<Menu>` neo vào nó vẫn do màn hình tự
 * dựng, vì mỗi thanh công cụ có dáng nút riêng (nút outlined của báo cáo, ô
 * `.report-select` của màn bảo hành…). Cái phải dùng chung là HÀNH VI với danh
 * sách dài, không phải cái nút:
 *
 * · Dài quá ngưỡng thì có ô tìm — cùng ngưỡng với UiSelect (resolveSearchable).
 * · Mở ra chỉ cao 5 dòng, phần còn lại cuộn (option-window).
 * · Chỉ dựng từng nhịp 20 dòng, cuộn tới đáy mới dựng tiếp — danh mục 3.000
 *   SKU không được phép biến một cú bấm thành một nhịp treo.
 * · Có trần lựa chọn thì các ô CHƯA chọn bị khoá kèm câu giải thích, thay vì
 *   im lặng bỏ qua cú bấm.
 *
 * Trước khi có lớp này, ba màn báo cáo tự viết ba bản khác nhau và hai trong ba
 * bản không có ô tìm kiếm.
 */
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import { SEMANTIC_LIGHT as S } from "@/shared/ui/tokens";
import { useT } from "@/shared/i18n/useT";
import { UiButton } from "../components/UiButton";
import { UiTextField } from "../components/UiTextField";
import { resolveSearchable } from "./searchable-options";
import { OPTION_LIST_MAX_HEIGHT, useOptionWindow } from "./option-window";

export interface UiOptionPickerOption {
  value: string;
  label: string;
  /** Dòng phụ dưới nhãn (mã, khu vực…) — cũng được đem đi so khớp khi tìm. */
  hint?: string;
  /** Nội dung căn phải của dòng (sản lượng, số hồ sơ…). */
  meta?: ReactNode;
  disabled?: boolean;
}

export interface UiOptionPickerProps {
  options: UiOptionPickerOption[];
  value: string[];
  onChange: (next: string[]) => void;
  /** Bỏ trống = tự quyết theo số option (xem `resolveSearchable`). */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Câu hiện khi không option nào khớp. */
  emptyText?: string;
  /** Trần lựa chọn — đủ trần thì các ô chưa chọn bị khoá, kèm giải thích. */
  maxSelectable?: number;
  /** Thêm hàng "Chọn tất cả / Bỏ chọn" ngay dưới ô tìm. */
  quickActions?: boolean;
  /** Bề rộng tấm thả xuống; bỏ trống thì co theo nơi đặt. */
  width?: number | string;
  "aria-label"?: string;
}

export function UiOptionPicker({
  options,
  value,
  onChange,
  searchable,
  searchPlaceholder,
  emptyText,
  maxSelectable,
  quickActions = false,
  width,
  "aria-label": ariaLabel,
}: UiOptionPickerProps) {
  const t = useT();
  const [keyword, setKeyword] = useState("");

  const selectedSet = useMemo(() => new Set(value), [value]);
  const matched = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    if (!needle) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(needle) ||
        (option.hint ?? "").toLowerCase().includes(needle),
    );
  }, [options, keyword]);

  const listWindow = useOptionWindow(matched.length, keyword);
  const visible = matched.slice(0, listWindow.limit);
  const atLimit = maxSelectable !== undefined && value.length >= maxSelectable;
  const withSearch = resolveSearchable(options, searchable);

  const toggle = (optionValue: string) => {
    if (selectedSet.has(optionValue)) {
      onChange(value.filter((item) => item !== optionValue));
      return;
    }
    if (atLimit) return;
    onChange([...value, optionValue]);
  };

  const selectMatched = () => {
    const next = new Set(value);
    for (const option of matched) {
      if (option.disabled) continue;
      if (maxSelectable !== undefined && next.size >= maxSelectable) break;
      next.add(option.value);
    }
    onChange([...next]);
  };

  return (
    <Box sx={{ width, maxWidth: "92vw" }}>
      {withSearch || quickActions || atLimit ? (
        <>
          <Box sx={{ px: 1.25, pt: 0.5, pb: 1 }}>
            {withSearch ? (
              <UiTextField
                fullWidth
                autoFocus
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder={
                  searchPlaceholder ?? t("shared.form.pickerSearchPlaceholder")
                }
                aria-label={
                  searchPlaceholder ?? t("shared.form.pickerSearchPlaceholder")
                }
                slotProps={{
                  input: {
                    startAdornment: (
                      <Box
                        aria-hidden="true"
                        sx={{ mr: 0.75, color: S.textMedium, fontSize: 13 }}
                      >
                        <i className="fi fi-rr-search" />
                      </Box>
                    ),
                  },
                }}
              />
            ) : null}
            {quickActions ? (
              <Stack
                direction="row"
                sx={{ mt: withSearch ? 0.75 : 0, gap: 0.75 }}
              >
                <UiButton
                  appearance="text"
                  size="small"
                  disabled={matched.length === 0 || atLimit}
                  onClick={selectMatched}
                >
                  {t("shared.form.pickerSelectAll")}
                </UiButton>
                <UiButton
                  appearance="text"
                  size="small"
                  color="secondary"
                  disabled={value.length === 0}
                  onClick={() => onChange([])}
                >
                  {t("shared.form.pickerClear")}
                </UiButton>
              </Stack>
            ) : null}
            {atLimit ? (
              <Box sx={{ mt: 0.75, fontSize: 11.5, color: S.warningText }}>
                {t("shared.form.pickerLimitReached", {
                  count: maxSelectable ?? 0,
                })}
              </Box>
            ) : null}
          </Box>
          <Divider />
        </>
      ) : null}

      <Box
        role="listbox"
        aria-multiselectable="true"
        aria-label={ariaLabel}
        onScroll={listWindow.onListScroll}
        sx={{ maxHeight: OPTION_LIST_MAX_HEIGHT, overflowY: "auto", py: 0.5 }}
      >
        {visible.length === 0 ? (
          <Box sx={{ px: 2, py: 1.5, fontSize: 13, color: S.textMedium }}>
            {emptyText ?? t("shared.form.noOptions")}
          </Box>
        ) : (
          visible.map((option) => {
            const checked = selectedSet.has(option.value);
            return (
              <Box
                key={option.value}
                component="button"
                type="button"
                role="option"
                aria-selected={checked}
                disabled={option.disabled || (!checked && atLimit)}
                onClick={() => toggle(option.value)}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.75,
                  width: "100%",
                  px: 1.25,
                  py: 0.5,
                  border: 0,
                  bgcolor: "transparent",
                  textAlign: "left",
                  font: "inherit",
                  cursor: "pointer",
                  color: S.textHigh,
                  "&:disabled": { opacity: 0.45, cursor: "not-allowed" },
                  "&:hover:not(:disabled)": { bgcolor: S.bgSubtle },
                }}
              >
                <Checkbox
                  size="small"
                  checked={checked}
                  tabIndex={-1}
                  sx={{ p: 0.25 }}
                />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Box
                    sx={{
                      fontSize: 13,
                      fontWeight: 600,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {option.label}
                  </Box>
                  {option.hint ? (
                    <Box sx={{ fontSize: 11, color: S.textMedium }}>
                      {option.hint}
                    </Box>
                  ) : null}
                </Box>
                {option.meta != null ? (
                  <Box
                    sx={{
                      flex: "none",
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: S.textMedium,
                    }}
                  >
                    {option.meta}
                  </Box>
                ) : null}
              </Box>
            );
          })
        )}
      </Box>

      {/*
       * Dòng cuối nói THẲNG là danh sách đang bị cắt. Không có nó, người dùng
       * gõ tìm một SKU không thấy đâu sẽ tưởng kho không có mặt hàng đó, trong
       * khi thật ra nó nằm ở nhịp dựng sau.
       */}
      {listWindow.hidden > 0 ? (
        <>
          <Divider />
          <Box sx={{ px: 1.5, py: 0.75, fontSize: 11.5, color: S.textMedium }}>
            {t("shared.form.pickerShowing", {
              shown: visible.length,
              total: matched.length,
            })}
          </Box>
        </>
      ) : null}
    </Box>
  );
}
