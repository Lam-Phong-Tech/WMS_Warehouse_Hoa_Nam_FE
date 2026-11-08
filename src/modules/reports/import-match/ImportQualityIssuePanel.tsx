import { useState } from "react";
import {
  useImportQualityIssues,
  type ImportQualityIssue,
} from "./import-quality-api";
import "./import-quality-issues.css";

type Props = { batchId: string; sourceFile: string };

function issueTone(issue: ImportQualityIssue) {
  return issue.severity.toUpperCase() === "WARNING" ||
    issue.code.toUpperCase().includes("DUPLICATE")
    ? "warning"
    : "error";
}

function IssueDetail({
  issue,
  sourceFile,
}: {
  issue: ImportQualityIssue;
  sourceFile: string;
}) {
  return (
    <section
      className="hn-import-issues__detail"
      aria-label={`Chi tiết dòng ${issue.rowNo}`}
    >
      <h4>Chi tiết dòng cần kiểm tra</h4>
      <div className={`hn-import-issues__callout is-${issueTone(issue)}`}>
        <span>{issueTone(issue) === "warning" ? "Chênh lệch" : "Lỗi"}</span>
        <strong>{issue.message || issue.code}</strong>
      </div>
      <dl>
        <div>
          <dt>Dòng nguồn</dt>
          <dd>
            Dòng {issue.rowNo} · {sourceFile || "Tệp nguồn"}
          </dd>
        </div>
        <div>
          <dt>Cột / trường</dt>
          <dd>{issue.field || "—"}</dd>
        </div>
        <div>
          <dt>Giá trị trong tệp</dt>
          <dd>{issue.rawValue || "(Trống)"}</dd>
        </div>
        <div>
          <dt>Quy tắc kiểm tra</dt>
          <dd>{issue.code || "—"}</dd>
        </div>
      </dl>
      <h4>Hướng dẫn xử lý</h4>
      <p>
        {issue.suggestedAction ||
          "Kiểm tra dữ liệu trong tệp nguồn rồi nhập lại."}
      </p>
    </section>
  );
}

export function ImportQualityIssuePanel({ batchId, sourceFile }: Props) {
  const [page, setPage] = useState(1);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const query = useImportQualityIssues(batchId, page);
  const rows = query.data?.rows ?? [];
  const activeIndex = Math.min(selectedIndex, rows.length - 1);
  return (
    <section className="hn-import-issues" aria-label="Các dòng cần kiểm tra">
      <div className="hn-import-issues__heading">
        <h3>Dòng cần kiểm tra</h3>
        <strong>{query.data?.total ?? "—"}</strong>
      </div>
      {query.isLoading ? <p role="status">Đang tải dòng lỗi…</p> : null}
      {query.error ? (
        <p role="alert">Không tải được dòng lỗi của đợt nhập. Hãy thử lại.</p>
      ) : null}
      {!query.isLoading && !query.error && rows.length === 0 ? (
        <p>Đợt nhập này không có dòng lỗi đã lưu.</p>
      ) : null}
      {rows.length ? (
        <ol className="hn-import-issues__rows">
          {rows.map((row, index) => (
            <li
              key={`${row.rowNo}-${row.field}-${index}`}
              className={activeIndex === index ? "is-selected" : undefined}
            >
              <button
                type="button"
                className="hn-import-issues__select"
                onClick={() => setSelectedIndex(index)}
                aria-pressed={activeIndex === index}
                aria-label={`Dòng ${row.rowNo}: ${row.message}`}
              >
                <span className="hn-import-issues__row-heading">
                  <strong>Dòng {row.rowNo}</strong>
                  <span
                    className={`hn-import-issues__badge is-${issueTone(row)}`}
                  >
                    {issueTone(row) === "warning" ? "Chênh lệch" : "Lỗi"}
                  </span>
                </span>
                <span className="hn-import-issues__message">
                  {row.message || row.code}
                </span>
                <small>{row.field || "—"}</small>
              </button>
              {activeIndex === index ? (
                <IssueDetail issue={row} sourceFile={sourceFile} />
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
      {(query.data?.lastPage ?? 1) > 1 ? (
        <nav
          className="hn-import-issues__pages"
          aria-label="Phân trang dòng lỗi"
        >
          <button
            type="button"
            aria-label="Trang dòng lỗi trước"
            disabled={page <= 1}
            onClick={() => {
              setPage((current) => current - 1);
              setSelectedIndex(0);
            }}
          >
            ‹
          </button>
          <span>
            {page} / {query.data?.lastPage}
          </span>
          <button
            type="button"
            aria-label="Trang dòng lỗi sau"
            disabled={page >= (query.data?.lastPage ?? 1)}
            onClick={() => {
              setPage((current) => current + 1);
              setSelectedIndex(0);
            }}
          >
            ›
          </button>
        </nav>
      ) : null}
    </section>
  );
}
