/**
 * Khối "Đối soát tồn theo kỳ" của demo.
 *
 * Sáu số hạng lấy thẳng từ sổ Nhập-Xuất-Tồn (`/reports/inventory-xnt-enhanced`)
 * nên đẳng thức là thật, không phải minh hoạ: trạng thái ở cuối thẻ hiển thị
 * CHÊNH LỆCH ĐO ĐƯỢC chứ không mặc định "đã khớp".
 */
import { DashIcon } from "../components/DashIcon";
import { useT } from "@/shared/i18n/useT";
import { OverviewStateBox } from "./OverviewStateBox";
import { fmt, type EquationTotals } from "./overview-data";

type Tone =
  | "opening"
  | "inbound"
  | "product"
  | "component"
  | "reversal"
  | "closing";

interface Term {
  key: string;
  label: string;
  impact: string;
  tone: Tone;
  operator: string;
  value: number;
  result?: boolean;
}

export function OverviewEquation({
  totals,
  loading,
  failed,
  forbidden,
}: {
  totals: EquationTotals;
  loading: boolean;
  failed: boolean;
  forbidden: boolean;
}) {
  const t = useT();
  if (loading)
    return (
      <article className="card equation-card">
        <OverviewStateBox
          kind="loading"
          title={t("dashboard.equation.loadingTitle")}
          copy={t("dashboard.equation.loadingCopy")}
        />
      </article>
    );
  if (forbidden)
    return (
      <article className="card equation-card">
        <OverviewStateBox
          kind="forbidden"
          title={t("dashboard.equation.forbiddenTitle")}
          copy={t("dashboard.equation.forbiddenCopy")}
        />
      </article>
    );
  if (failed)
    return (
      <article className="card equation-card">
        <OverviewStateBox
          kind="unavailable"
          title={t("dashboard.equation.failedTitle")}
          copy={t("dashboard.equation.failedCopy")}
        />
      </article>
    );

  const terms: Term[] = [
    {
      key: "opening",
      label: t("dashboard.equation.opening"),
      impact: t("dashboard.equation.openingImpact"),
      tone: "opening",
      operator: "",
      value: totals.opening,
    },
    {
      key: "receipt",
      label: t("dashboard.equation.receipt"),
      impact: t("dashboard.equation.receiptImpact"),
      tone: "inbound",
      operator: "+",
      value: totals.receipt,
    },
    {
      key: "issue-product",
      label: t("dashboard.equation.issueProduct"),
      impact: t("dashboard.equation.decrease"),
      tone: "product",
      operator: "−",
      value: totals.issueProduct,
    },
    {
      key: "issue-component",
      label: t("dashboard.equation.issueComponent"),
      impact: t("dashboard.equation.decrease"),
      tone: "component",
      operator: "−",
      value: totals.issueComponent,
    },
    {
      key: "reversal",
      label: t("dashboard.equation.reversal"),
      impact: t("dashboard.equation.reversalImpact"),
      tone: "reversal",
      operator: "+",
      value: totals.reversal,
    },
    {
      key: "closing",
      label: t("dashboard.equation.closing"),
      impact: t("dashboard.equation.closingImpact"),
      tone: "closing",
      operator: "=",
      value: totals.closing,
      result: true,
    },
  ];

  const matched = totals.difference === 0;
  const statusText = matched
    ? t("dashboard.equation.matched")
    : t("dashboard.equation.mismatched", {
        difference: fmt(totals.difference),
      });

  return (
    <article className="card equation-card" id="equation-card">
      {terms.map((term) => (
        <div
          key={term.key}
          className={`equation-item ${term.result ? "result" : ""}`}
          data-tone={term.tone}
          data-operator={term.operator}
        >
          <div className="equation-item-head">
            <span className="equation-label">{term.label}</span>
            <span className="equation-impact">{term.impact}</span>
          </div>
          <strong className="equation-value">{fmt(term.value)}</strong>
        </div>
      ))}
      <div className="equation-note">
        <div className="equation-formula">
          <span className="equation-note-label">
            {t("dashboard.equation.formulaLabel")}
          </span>
          <span>{t("dashboard.equation.formula")}</span>
        </div>
        <div
          className={`equation-status ${matched ? "" : "is-mismatch"}`}
          role="status"
          aria-label={statusText}
        >
          <span className="equation-status-icon" aria-hidden="true">
            <DashIcon name={matched ? "circle-dot" : "triangle-alert"} />
          </span>
          <div>
            <span>{t("dashboard.equation.statusLabel")}</span>
            <strong>{statusText}</strong>
          </div>
        </div>
      </div>
    </article>
  );
}
