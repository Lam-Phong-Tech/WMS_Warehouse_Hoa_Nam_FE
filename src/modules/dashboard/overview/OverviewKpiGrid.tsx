/**
 * Lưới 5 thẻ KPI của demo. Chiều "Loại hàng" ẩn thẻ không còn nghĩa đúng như
 * demo: lọc Sản phẩm thì bỏ thẻ "Xuất linh kiện bảo hành", lọc Linh kiện thì bỏ
 * thẻ "Xuất sản phẩm đã Post".
 */
import { DashIcon } from "../components/DashIcon";
import type { DashboardIconName } from "../components/DashIcon";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { useT } from "@/shared/i18n/useT";
import { OverviewStateBox } from "./OverviewStateBox";
import { fmt, type Trend } from "./overview-data";

export interface KpiCardModel {
  id: string;
  label: string;
  /** null = nguồn đọc chưa trả số ⇒ hiện "Chưa có", KHÔNG thay bằng 0. */
  value: number | null;
  delta: string | null;
  trend: Trend;
  note: string;
  icon: DashboardIconName;
  /** Chuỗi vẽ sparkline (đã theo thứ tự thời gian). Rỗng = không vẽ. */
  spark: number[];
  source: string;
}

/**
 * Toạ độ polyline y hệt demo: hộp 48×30, giá trị chuẩn hoá về 0..100 rồi
 * `y = 29 − v × 0.27`.
 */
function sparkPoints(values: number[]): string {
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const step = 48 / (values.length - 1);
  return values
    .map((value, index) => {
      const scaled = span === 0 ? 50 : ((value - min) / span) * 100;
      return `${Math.round(index * step)},${Math.round(29 - scaled * 0.27)}`;
    })
    .join(" ");
}

export function OverviewKpiGrid({
  cards,
  periodName,
  loading,
  failed,
  failedCopy,
  forbidden,
}: {
  cards: KpiCardModel[];
  periodName: string;
  loading: boolean;
  failed: boolean;
  /** Câu giải thích khi `failed` — trang tính một lần theo nguyên nhân thật. */
  failedCopy: string;
  forbidden: boolean;
}) {
  const t = useT();

  if (loading) {
    return (
      <div className="kpi-grid" id="kpi-grid">
        {cards.map((card) => (
          <article
            key={card.id}
            className="card kpi-card skeleton"
            data-kpi-id={card.id}
            aria-label={t("dashboard.kpi.loadingAria", { label: card.label })}
            aria-busy="true"
          >
            <div className="skeleton-line" />
            <div className="skeleton-line" />
            <div className="skeleton-line" />
          </article>
        ))}
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="kpi-grid" id="kpi-grid">
        {cards.map((card) => (
          <article
            key={card.id}
            className="card kpi-card"
            data-kpi-id={card.id}
          >
            <OverviewStateBox
              kind="forbidden"
              title={t("dashboard.kpi.forbiddenTitle")}
              copy={t("dashboard.kpi.forbiddenCopy", {
                label: card.label.toLowerCase(),
              })}
            />
          </article>
        ))}
      </div>
    );
  }

  if (failed) {
    return (
      <div className="kpi-grid" id="kpi-grid">
        {cards.map((card) => (
          <article
            key={card.id}
            className="card kpi-card"
            data-kpi-id={card.id}
          >
            <OverviewStateBox
              kind="unavailable"
              title={t("dashboard.kpi.failedTitle")}
              copy={failedCopy}
            />
          </article>
        ))}
      </div>
    );
  }

  return (
    <div className="kpi-grid" id="kpi-grid">
      {cards.map((card) => {
        const points = sparkPoints(card.spark);
        return (
          <article
            key={card.id}
            className="card kpi-card"
            tabIndex={0}
            title={t("dashboard.kpi.cardTitle", {
              label: card.label,
              period: periodName,
            })}
            data-kpi-id={card.id}
            data-source={card.source}
          >
            <div className="kpi-top">
              <span className="kpi-label">{card.label}</span>
              <span className="kpi-icon" aria-hidden="true">
                <DashIcon name={card.icon} />
              </span>
            </div>
            <div className="kpi-value">
              {card.value === null ? EMPTY_TEXT : fmt(card.value)}
            </div>
            <div className="kpi-bottom">
              <div className="kpi-foot">
                {card.delta ? (
                  <span className={`delta ${card.trend}`}>{card.delta}</span>
                ) : null}
                <span>{card.note}</span>
              </div>
              {points ? (
                <svg
                  className="kpi-spark"
                  viewBox="0 0 48 30"
                  aria-hidden="true"
                >
                  <polyline points={points} />
                </svg>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
