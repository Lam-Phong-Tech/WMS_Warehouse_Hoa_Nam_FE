/**
 * Hàng "Ưu tiên vận hành" của demo: thẻ "Công việc cần ưu tiên" (kèm bộ lọc mức
 * độ) + thẻ "Điểm cần chú ý".
 *
 * Nhãn mức độ hiển thị bằng tiếng Việt, mã nội bộ P0/P1/P2 chỉ nằm ở `title` và
 * data-attribute — đúng như demo.
 */
import { useState } from "react";
import { DashIcon } from "../components/DashIcon";
import { useT } from "@/shared/i18n/useT";
import { OverviewStateBox } from "./OverviewStateBox";
import { fmt, SEVERITY_NAME_KEYS, type Severity } from "./overview-data";

const SEVERITY_ORDER: Record<Severity, number> = { P0: 0, P1: 1, P2: 2 };

export interface IssueRow {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  technical: string;
  count: number;
  route: string;
}

export interface AlertRow {
  title: string;
  copy: string;
  action: string;
  route: string;
}

type Filter = "ALL" | Severity;

const FILTER_ORDER: Filter[] = ["ALL", "P0", "P1", "P2"];

export function OverviewOperations({
  issues,
  alerts,
  loading,
  failed,
  failedCopy,
  forbidden,
  onNavigate,
}: {
  issues: IssueRow[];
  alerts: AlertRow[];
  loading: boolean;
  failed: boolean;
  /** Câu giải thích khi `failed` — trang tính một lần theo nguyên nhân thật. */
  failedCopy: string;
  forbidden: boolean;
  onNavigate: (route: string) => void;
}) {
  const [severity, setSeverity] = useState<Filter>("ALL");
  const t = useT();

  const severityName = (value: Severity) => t(SEVERITY_NAME_KEYS[value]);
  const filterLabel = (value: Filter) =>
    value === "ALL" ? t("dashboard.operations.filterAll") : severityName(value);

  const filtered = issues
    .filter((item) => severity === "ALL" || item.severity === severity)
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  const visible = filtered.slice(0, 5);

  const renderIssueBody = () => {
    if (loading)
      return (
        <OverviewStateBox
          kind="loading"
          title={t("dashboard.operations.loadingTitle")}
          copy={t("dashboard.operations.loadingCopy")}
        />
      );
    if (forbidden)
      return (
        <OverviewStateBox
          kind="forbidden"
          title={t("dashboard.operations.forbiddenTitle")}
          copy={t("dashboard.operations.forbiddenCopy")}
        />
      );
    if (failed)
      return (
        <OverviewStateBox
          kind="unavailable"
          title={t("dashboard.operations.failedTitle")}
          copy={failedCopy}
        />
      );
    if (visible.length === 0)
      return (
        <OverviewStateBox
          kind="empty"
          title={t("dashboard.operations.emptyTitle")}
          copy={
            severity === "ALL"
              ? t("dashboard.operations.emptyCopy")
              : t("dashboard.operations.emptyBySeverity", {
                  severity: severityName(severity),
                })
          }
        />
      );
    return visible.map((item) => (
      <div
        key={item.id}
        className={`issue-row issue-row-${item.severity.toLowerCase()}`}
        data-kpi-id={item.id}
        data-priority-code={item.severity}
        data-technical-state={item.technical}
      >
        <span
          className={`severity severity-${item.severity.toLowerCase()}`}
          aria-label={severityName(item.severity)}
          title={t("dashboard.operations.internalCode", {
            code: item.severity,
          })}
        >
          {severityName(item.severity)}
        </span>
        <div className="issue-copy">
          <strong>{item.title}</strong>
          <span>{item.detail}</span>
        </div>
        <button
          className="issue-count text-route"
          type="button"
          aria-label={t("dashboard.operations.countAria", {
            count: item.count,
            title: item.title,
          })}
          onClick={() => onNavigate(item.route)}
        >
          {fmt(item.count)} <small>{t("dashboard.operations.unitTask")}</small>
        </button>
      </div>
    ));
  };

  const renderAlertBody = () => {
    if (loading)
      return (
        <OverviewStateBox
          kind="loading"
          title={t("dashboard.operations.alertLoadingTitle")}
          copy={t("dashboard.operations.alertLoadingCopy")}
        />
      );
    if (forbidden)
      return (
        <OverviewStateBox
          kind="forbidden"
          title={t("dashboard.operations.alertForbiddenTitle")}
          copy={t("dashboard.operations.alertForbiddenCopy")}
        />
      );
    if (failed)
      return (
        <OverviewStateBox
          kind="unavailable"
          title={t("dashboard.operations.alertFailedTitle")}
          copy={failedCopy}
        />
      );
    if (alerts.length === 0)
      return (
        <OverviewStateBox
          kind="empty"
          title={t("dashboard.operations.alertEmptyTitle")}
          copy={t("dashboard.operations.alertEmptyCopy")}
        />
      );
    return alerts.map((item) => (
      <div className="alert-item" key={item.title}>
        <span className="alert-dot" aria-hidden="true" />
        <div className="alert-copy">
          <strong>{item.title}</strong>
          <p>{item.copy}</p>
          <button type="button" onClick={() => onNavigate(item.route)}>
            {item.action} <DashIcon name="arrow-right" />
          </button>
        </div>
      </div>
    ));
  };

  const showFooter = !forbidden && !failed;
  const showChip = !forbidden && !failed;

  return (
    <section
      className="operations-grid"
      aria-label={t("dashboard.operations.sectionAria")}
    >
      <article className="card queue-card" aria-labelledby="queue-title">
        <header className="card-head">
          <div>
            <span className="eyebrow">
              {t("dashboard.operations.queueEyebrow")}
            </span>
            <h2 id="queue-title">{t("dashboard.operations.queueTitle")}</h2>
            <span className="card-subtitle">
              {t("dashboard.operations.queueSubtitle")}
            </span>
          </div>
          <div
            className="mini-segmented severity-filter"
            aria-label={t("dashboard.operations.filterAria")}
          >
            {FILTER_ORDER.map((option) => (
              <button
                key={option}
                type="button"
                className={option === severity ? "active" : undefined}
                data-severity={option === "ALL" ? undefined : option}
                aria-pressed={option === severity}
                aria-label={filterLabel(option)}
                title={
                  option === "ALL"
                    ? undefined
                    : t("dashboard.operations.internalCode", { code: option })
                }
                onClick={() => setSeverity(option)}
              >
                {filterLabel(option)}
              </button>
            ))}
          </div>
        </header>
        <div className="issue-list">{renderIssueBody()}</div>
        {showFooter ? (
          <button
            className="text-button"
            type="button"
            onClick={() => onNavigate("/reports/import-quality")}
          >
            {t("dashboard.operations.viewAll", { count: filtered.length })}{" "}
            <DashIcon name="arrow-right" />
          </button>
        ) : null}
      </article>

      <article className="card alert-card" aria-labelledby="alerts-title">
        <header className="card-head">
          <div>
            <span className="eyebrow">
              {t("dashboard.operations.alertEyebrow")}
            </span>
            <h2 id="alerts-title">{t("dashboard.operations.alertTitle")}</h2>
          </div>
          {showChip ? (
            <span className="chip chip-error">
              {t("dashboard.operations.alertChip", { count: alerts.length })}
            </span>
          ) : null}
        </header>
        <div className="alert-list">{renderAlertBody()}</div>
      </article>
    </section>
  );
}
