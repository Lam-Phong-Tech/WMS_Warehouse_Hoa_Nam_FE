import { useState, type ReactNode } from "react";
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

  /**
   * BẢN NHÁP CỤC BỘ của ô tìm kiếm — nửa còn lại của cặp đôi mô tả ở
   * `useSectionFilter.setKeyword` (nó ghi state của MÀN trong `startTransition`).
   *
   * Ký tự vừa gõ phải hiện ngay, mà lượt render lại của cả màn báo cáo tốn
   * ~200 ms. Giữ chữ đang gõ ở ĐÂY thì mỗi phím chỉ dựng lại đúng thanh lọc này;
   * việc lọc + vẽ lại danh sách chạy sau ở mức ưu tiên thấp và ngắt được.
   *
   * Đồng bộ ngược từ `state.keyword` là bắt buộc: nút "Xoá lọc" (và mọi đường
   * đặt lại khác) đổi từ khoá ở ngoài ô này — thiếu bước đó thì ô vẫn còn chữ cũ
   * trong khi danh sách đã bỏ lọc. Dùng cách "chỉnh state ngay trong lúc render"
   * mà React khuyến nghị cho tình huống này, KHÔNG dùng `useEffect`: effect sẽ
   * vẽ một lượt với chữ cũ rồi mới sửa, tức là nháy một nhịp.
   */
  const [draft, setDraft] = useState(state.keyword);
  const [syncedKeyword, setSyncedKeyword] = useState(state.keyword);
  if (state.keyword !== syncedKeyword) {
    setSyncedKeyword(state.keyword);
    setDraft(state.keyword);
  }

  const onSearchChange = (value: string) => {
    setDraft(value);
    state.setKeyword(value);
  };

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
          /*
           * `size="small"` cho ô cao đúng 39px như UiSelect đứng cạnh — mặc
           * định của TextField là cỡ "medium" (54px), nhìn ra ngay là một ô
           * to kệch giữa hàng control.
           *
           * `flex: 1 1 0` để ô tìm kiếm là thứ NHƯỜNG chỗ khi thanh lọc nằm
           * trong cột hẹp: bộ đếm và nút "Xoá lọc" nhờ đó ở lại đúng hàng trên
           * thay vì bị đẩy xuống hàng thứ hai.
           */
          size="small"
          sx={{ flex: "1 1 0", minWidth: 100 }}
          width={config.searchWidth ?? 240}
          value={draft}
          onChange={onSearchChange}
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
        sx={{ ml: "auto", alignItems: "center", flexShrink: 0 }}
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
