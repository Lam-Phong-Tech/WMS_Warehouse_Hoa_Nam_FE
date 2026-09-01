/**
 * Khối "Đối soát tồn theo kỳ" của demo.
 *
 * Sáu số hạng lấy thẳng từ sổ Nhập-Xuất-Tồn (`/reports/inventory-xnt-enhanced`)
 * nên đẳng thức là thật, không phải minh hoạ: trạng thái ở cuối thẻ hiển thị
 * CHÊNH LỆCH ĐO ĐƯỢC chứ không mặc định "đã khớp".
 */
import { DashIcon } from "../components/DashIcon";
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
  if (loading)
    return (
      <article className="card equation-card">
        <OverviewStateBox
          kind="loading"
          title="Đang đối soát"
          copy="Tổng hợp sổ Nhập-Xuất-Tồn theo kỳ đã chọn."
        />
      </article>
    );
  if (forbidden)
    return (
      <article className="card equation-card">
        <OverviewStateBox
          kind="forbidden"
          title="Không có quyền xem đối soát"
          copy="Ẩn tất cả số hạng để tránh lộ dữ liệu suy diễn."
        />
      </article>
    );
  if (failed)
    return (
      <article className="card equation-card">
        <OverviewStateBox
          kind="unavailable"
          title="Không thể đối soát"
          copy="Thiếu snapshot nhất quán; không suy ngược số hạng."
        />
      </article>
    );

  const terms: Term[] = [
    {
      key: "opening",
      label: "Tồn đầu kỳ",
      impact: "Số dư mở kỳ",
      tone: "opening",
      operator: "",
      value: totals.opening,
    },
    {
      key: "receipt",
      label: "Nhập đã Post",
      impact: "Tăng tồn",
      tone: "inbound",
      operator: "+",
      value: totals.receipt,
    },
    {
      key: "issue-product",
      label: "Xuất sản phẩm",
      impact: "Giảm tồn",
      tone: "product",
      operator: "−",
      value: totals.issueProduct,
    },
    {
      key: "issue-component",
      label: "Xuất linh kiện",
      impact: "Giảm tồn",
      tone: "component",
      operator: "−",
      value: totals.issueComponent,
    },
    {
      key: "reversal",
      label: "Hoàn tác có dấu",
      impact: "Điều chỉnh tồn",
      tone: "reversal",
      operator: "+",
      value: totals.reversal,
    },
    {
      key: "closing",
      label: "Tồn cuối kỳ",
      impact: "Số dư chốt kỳ",
      tone: "closing",
      operator: "=",
      value: totals.closing,
      result: true,
    },
  ];

  const matched = totals.difference === 0;
  const statusText = matched
    ? "Đã khớp · Chênh lệch 0"
    : `Chưa khớp · Chênh lệch ${fmt(totals.difference)}`;

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
          <span className="equation-note-label">Công thức đối soát</span>
          <span>
            Đầu kỳ + Nhập − Xuất sản phẩm − Xuất linh kiện + Hoàn tác có dấu =
            Cuối kỳ
          </span>
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
            <span>Trạng thái đối soát</span>
            <strong>{statusText}</strong>
          </div>
        </div>
      </div>
    </article>
  );
}
