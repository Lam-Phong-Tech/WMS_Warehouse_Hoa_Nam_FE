/**
 * Hàng "Ưu tiên vận hành" của demo: thẻ "Công việc cần ưu tiên" (kèm bộ lọc mức
 * độ) + thẻ "Điểm cần chú ý".
 *
 * Nhãn mức độ hiển thị bằng tiếng Việt, mã nội bộ P0/P1/P2 chỉ nằm ở `title` và
 * data-attribute — đúng như demo.
 */
import { useState } from "react";
import { DashIcon } from "../components/DashIcon";
import { OverviewStateBox } from "./OverviewStateBox";
import { fmt, SEVERITY_NAMES, type Severity } from "./overview-data";

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

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "ALL", label: "Tất cả" },
  { value: "P0", label: SEVERITY_NAMES.P0 },
  { value: "P1", label: SEVERITY_NAMES.P1 },
  { value: "P2", label: SEVERITY_NAMES.P2 },
];

export function OverviewOperations({
  issues,
  alerts,
  loading,
  failed,
  forbidden,
  onNavigate,
}: {
  issues: IssueRow[];
  alerts: AlertRow[];
  loading: boolean;
  failed: boolean;
  forbidden: boolean;
  onNavigate: (route: string) => void;
}) {
  const [severity, setSeverity] = useState<Filter>("ALL");

  const filtered = issues
    .filter((item) => severity === "ALL" || item.severity === severity)
    .sort(
      (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
    );
  const visible = filtered.slice(0, 5);

  const renderIssueBody = () => {
    if (loading)
      return (
        <OverviewStateBox
          kind="loading"
          title="Đang tải hàng việc"
          copy="Giữ cấu trúc để tránh dịch chuyển bố cục."
        />
      );
    if (forbidden)
      return (
        <OverviewStateBox
          kind="forbidden"
          title="Không có quyền xem hàng việc"
          copy="Widget này cần report.view và quyền route đích."
        />
      );
    if (failed)
      return (
        <OverviewStateBox
          kind="unavailable"
          title="Không thể tải hàng việc"
          copy="Nguồn đọc không phản hồi; không có count nào được suy diễn."
        />
      );
    if (visible.length === 0)
      return (
        <OverviewStateBox
          kind="empty"
          title="Không có việc cần xử lý"
          copy={
            severity === "ALL"
              ? "Không có bản ghi phù hợp bộ lọc hiện tại."
              : `Không có công việc thuộc mức ${SEVERITY_NAMES[severity]}.`
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
          aria-label={SEVERITY_NAMES[item.severity]}
          title={`Mã nội bộ ${item.severity}`}
        >
          {SEVERITY_NAMES[item.severity]}
        </span>
        <div className="issue-copy">
          <strong>{item.title}</strong>
          <span>{item.detail}</span>
        </div>
        <button
          className="issue-count text-route"
          type="button"
          aria-label={`${item.count} công việc: ${item.title}`}
          onClick={() => onNavigate(item.route)}
        >
          {fmt(item.count)} <small>việc</small>
        </button>
      </div>
    ));
  };

  const renderAlertBody = () => {
    if (loading)
      return (
        <OverviewStateBox
          kind="loading"
          title="Đang tải cảnh báo"
          copy="Không suy diễn số liệu khi chưa có nguồn."
        />
      );
    if (forbidden)
      return (
        <OverviewStateBox
          kind="forbidden"
          title="Không có quyền xem cảnh báo"
          copy="Không suy diễn số liệu khi chưa có nguồn."
        />
      );
    if (failed)
      return (
        <OverviewStateBox
          kind="unavailable"
          title="Không thể tải cảnh báo"
          copy="Nguồn đọc lỗi; dùng Làm mới để thử lại."
        />
      );
    if (alerts.length === 0)
      return (
        <OverviewStateBox
          kind="empty"
          title="Không có cảnh báo"
          copy="Không có ngoại lệ đang mở trong phạm vi lọc."
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
    <section className="operations-grid" aria-label="Ưu tiên vận hành">
      <article className="card queue-card" aria-labelledby="queue-title">
        <header className="card-head">
          <div>
            <span className="eyebrow">ƯU TIÊN VẬN HÀNH</span>
            <h2 id="queue-title">Công việc cần ưu tiên</h2>
            <span className="card-subtitle">
              Tập trung xử lý công việc ảnh hưởng vận hành trước
            </span>
          </div>
          <div
            className="mini-segmented severity-filter"
            aria-label="Lọc công việc theo mức độ"
          >
            {FILTERS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={option.value === severity ? "active" : undefined}
                data-severity={option.value === "ALL" ? undefined : option.value}
                aria-pressed={option.value === severity}
                aria-label={option.label}
                title={
                  option.value === "ALL"
                    ? undefined
                    : `Mã nội bộ ${option.value}`
                }
                onClick={() => setSeverity(option.value)}
              >
                {option.label}
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
            Xem tất cả {filtered.length} công việc <DashIcon name="arrow-right" />
          </button>
        ) : null}
      </article>

      <article className="card alert-card" aria-labelledby="alerts-title">
        <header className="card-head">
          <div>
            <span className="eyebrow">TÍN HIỆU HIỆN TẠI</span>
            <h2 id="alerts-title">Điểm cần chú ý</h2>
          </div>
          {showChip ? (
            <span className="chip chip-error">{alerts.length} ưu tiên</span>
          ) : null}
        </header>
        <div className="alert-list">{renderAlertBody()}</div>
      </article>
    </section>
  );
}
