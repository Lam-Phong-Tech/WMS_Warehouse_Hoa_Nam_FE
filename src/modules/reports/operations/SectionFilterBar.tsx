import type { ReactNode } from "react";
import { useT } from "@/shared/i18n/useT";
import {
  Box,
  Stack,
  UiButton,
  UiSelect,
  RADIUS,
  SEMANTIC_LIGHT as S,
} from "@/shared/ui";
import { SearchInput } from "@/shared/components/data-display/SearchInput";
import { formatQuantity } from "@/shared/utils/format-number";
import { RPT_CONTROL_MOTION_SX } from "./report-tokens";
import type { SectionFilterState } from "./report-section-filter";

/**
 * Thanh lọc hiển thị trong khối. Đặt NGAY DƯỚI tiêu đề khối và NGAY TRÊN bảng
 * / danh sách của khối đó, để người đọc thấy rõ nó chỉ chi phối khối này.
 */
export function SectionFilterBar<T>({
  state,
  label,
  unit,
  extra,
  showCount = true,
  "data-testid": dataTestId,
}: {
  state: SectionFilterState<T>;
  /** Nhãn trợ năng của cả thanh (thường là tên khối). */
  label: string;
  /** Đơn vị đếm của khối: "dòng", "SKU", "chứng từ", "hồ sơ"… */
  unit?: string;
  /** Control riêng của khối, xếp cùng hàng (hiếm dùng). */
  extra?: ReactNode;
  /**
   * Tắt bộ đếm của thanh khi ĐẦU KHỐI đã có sẵn một chip đếm cho chính tập
   * dòng này — hai con số giống hệt nhau cạnh nhau chỉ làm người đọc phải kiểm
   * tra xem chúng có nói cùng một thứ không.
   */
  showCount?: boolean;
  "data-testid"?: string;
}) {
  const t = useT();
  const { config, resolvedSelects } = state;
  const unitLabel = unit ?? t("reports.common.unitRow");
  const countVisible = showCount && state.total > 0;

  return (
    <Box
      role="group"
      aria-label={t("reports.filters.sectionAria", { label })}
      data-testid={dataTestId}
      sx={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 1,
        p: 1,
        mb: 1.5,
        border: `1px solid ${S.border}`,
        borderRadius: `${RADIUS.control}px`,
        bgcolor: S.bgSubtle,
      }}
    >
      {config.searchText ? (
        <SearchInput
          width={config.searchWidth ?? 240}
          value={state.keyword}
          onChange={state.setKeyword}
          placeholder={
            config.searchPlaceholder ??
            t("reports.filters.sectionSearchPlaceholder")
          }
          aria-label={
            config.searchAriaLabel ??
            t("reports.filters.sectionSearchAria", { label })
          }
        />
      ) : null}

      {resolvedSelects.map((select) => (
        <UiSelect
          key={select.key}
          minWidth={select.minWidth ?? 170}
          value={state.values[select.key] ?? ""}
          onChange={(value) => state.setValue(select.key, value)}
          options={select.options}
          placeholder={select.placeholder}
          aria-label={select.ariaLabel ?? select.placeholder}
        />
      ))}

      {extra}

      <Stack
        direction="row"
        spacing={1}
        sx={{ ml: "auto", alignItems: "center" }}
      >
        {countVisible ? (
          <Box
            aria-live="polite"
            sx={{ fontSize: 12, color: S.textMedium, whiteSpace: "nowrap" }}
          >
            {state.active
              ? t("reports.filters.sectionViewing", {
                  shown: formatQuantity(state.rows.length),
                  total: formatQuantity(state.total),
                  unit: unitLabel,
                })
              : t("reports.filters.sectionCount", {
                  total: formatQuantity(state.total),
                  unit: unitLabel,
                })}
          </Box>
        ) : null}
        <UiButton
          type="button"
          size="small"
          appearance="text"
          disabled={!state.active}
          onClick={state.clear}
          sx={RPT_CONTROL_MOTION_SX}
        >
          {t("reports.filters.clearFilters")}
        </UiButton>
      </Stack>
    </Box>
  );
}
