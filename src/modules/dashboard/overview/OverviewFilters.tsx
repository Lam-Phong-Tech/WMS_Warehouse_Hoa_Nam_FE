import { businessToday } from "@/shared/utils/date-time";
/**
 * Bộ lọc Kỳ KPI (kèm khoảng ngày tùy chọn) và Loại hàng.
 *
 * Hai ô khoảng ngày dùng `UiVuexyDateField` — cùng bộ lịch tiếng Việt với các
 * màn báo cáo/nhập kho, thay cho ô date native trông khác nhau theo trình duyệt.
 */
import dayjs from "dayjs";
import { useT } from "@/shared/i18n/useT";
import type { MessageKey } from "@/shared/i18n/messages";
import type { SkuTypeFilter } from "../types";
import {
  PERIOD_NAME_KEYS,
  type DateRange,
  type OverviewPeriod,
} from "./overview-data";
import { UiVuexyDateField } from "@/shared/ui";

const ISO = "YYYY-MM-DD";

const PERIOD_ORDER: OverviewPeriod[] = ["today", "last7", "month", "custom"];

const TYPE_ORDER: Array<{ value: SkuTypeFilter; labelKey: MessageKey }> = [
  { value: "ALL", labelKey: "dashboard.skuType.all" },
  { value: "PRODUCT", labelKey: "dashboard.skuType.product" },
  { value: "COMPONENT", labelKey: "dashboard.skuType.component" },
];

export function OverviewFilters({
  period,
  onPeriodChange,
  rangeLabel,
  custom,
  onCustomChange,
  dateError,
  type,
  onTypeChange,
}: {
  period: OverviewPeriod;
  onPeriodChange: (period: OverviewPeriod) => void;
  /**
   * Khoảng ngày THẬT của kỳ đang chọn, kèm số ngày.
   *
   * Nút kỳ chỉ nói LUẬT ("Tháng này"), không nói kết quả — mùng 4 bấm "Tháng
   * này" chỉ ra 4 ngày dữ liệu mà nhìn nhãn thì tưởng cả tháng. Dòng này nói
   * thẳng kết quả nên không còn chỗ để hiểu nhầm, và nhãn nút vẫn ngắn (nút
   * `white-space: nowrap`, nhồi chữ vào là vỡ dải segmented ở khổ hẹp).
   */
  rangeLabel: string;
  custom: DateRange;
  onCustomChange: (range: DateRange) => void;
  dateError: string;
  type: SkuTypeFilter;
  onTypeChange: (type: SkuTypeFilter) => void;
}) {
  const t = useT();

  return (
    <section className="filter-card" aria-label={t("dashboard.filters.region")}>
      <div className="filter-group">
        <span className="filter-label">
          {t("dashboard.filters.periodLabel")}
        </span>
        <div className="segmented period-buttons">
          {PERIOD_ORDER.map((value) => (
            <button
              key={value}
              type="button"
              className={value === period ? "active" : undefined}
              aria-pressed={value === period}
              onClick={() => onPeriodChange(value)}
            >
              {t(PERIOD_NAME_KEYS[value])}
            </button>
          ))}
        </div>
        <span className="filter-range-note">{rangeLabel}</span>
      </div>

      {period === "custom" ? (
        <div className="custom-range">
          <div className="custom-range-fields">
            <div
              className="custom-range-field"
              data-invalid={Boolean(dateError)}
            >
              <span>{t("dashboard.filters.from")}</span>
              <UiVuexyDateField
                id="dashboard-date-from"
                field="dashboard-date-from"
                aria-label={t("dashboard.filters.from")}
                value={custom.from ? dayjs(custom.from) : null}
                maxDate={businessToday()}
                onChange={(next) => {
                  if (!next) return;
                  onCustomChange({ ...custom, from: next.format(ISO) });
                }}
              />
            </div>
            <div
              className="custom-range-field"
              data-invalid={Boolean(dateError)}
            >
              <span>{t("dashboard.filters.to")}</span>
              <UiVuexyDateField
                id="dashboard-date-to"
                field="dashboard-date-to"
                aria-label={t("dashboard.filters.to")}
                value={custom.to ? dayjs(custom.to) : null}
                maxDate={businessToday()}
                onChange={(next) => {
                  if (!next) return;
                  onCustomChange({ ...custom, to: next.format(ISO) });
                }}
              />
            </div>
          </div>
          <span className="field-error" role="alert">
            {dateError}
          </span>
        </div>
      ) : null}

      <div className="filter-group">
        <span className="filter-label">{t("dashboard.filters.typeLabel")}</span>
        <div className="segmented type-buttons">
          {TYPE_ORDER.map((option) => (
            <button
              key={option.value}
              type="button"
              className={option.value === type ? "active" : undefined}
              aria-pressed={option.value === type}
              onClick={() => onTypeChange(option.value)}
            >
              {t(option.labelKey)}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
